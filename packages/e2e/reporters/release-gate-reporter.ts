import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from '@aquila/stories/runtime-assets';
import type {
    FullConfig,
    Reporter,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';
import {
    createReleaseGateBrowserEvidence,
    type ReleaseGateBrowserEvidenceV1,
} from '../tests/support/release-gate-evidence';
import { loadReleaseGateRunContext } from '../tests/support/release-gate-env';

type ProjectEvidenceInput = Omit<
    ReleaseGateBrowserEvidenceV1,
    'traces' | 'screenshots'
> & {
    traces: string[];
    screenshots: string[];
};

type WrittenProject = {
    project: string;
    path: string;
    status: 'passed' | 'failed';
};

type CapturedArtifacts = {
    traces: string[];
    screenshots: string[];
};

function projectFileName(project: string): string {
    if (!/^[a-z0-9-]+$/.test(project)) {
        throw new Error(
            'Release-gate project name is unsafe for evidence output'
        );
    }
    return `${project}.json`;
}

async function copyArtifacts(
    evidenceDir: string,
    project: string,
    sources: readonly string[],
    kind: 'trace' | 'screenshot'
): Promise<string[]> {
    if (sources.length === 0) return [];

    const outputDir = join(evidenceDir, 'artifacts', project);
    await mkdir(outputDir, { recursive: true });
    const extension = kind === 'trace' ? '.zip' : '.png';
    const copied: string[] = [];
    for (const [index, source] of sources.entries()) {
        const relativePath = `artifacts/${project}/${kind}-${index}${extension}`;
        await copyFile(resolve(source), join(evidenceDir, relativePath));
        copied.push(relativePath);
    }
    return copied;
}

/**
 * Retains one strictly structured, credential-free document per browser
 * project. Artifact source paths are never serialized: copies are named under
 * the evidence directory and referenced only by their safe relative paths.
 */
export async function writeReleaseGateEvidence(input: {
    evidenceDir: string;
    projectEvidence: readonly ProjectEvidenceInput[];
}): Promise<void> {
    const evidenceDir = resolve(input.evidenceDir);
    await mkdir(evidenceDir, { recursive: true });

    const ordered = [...input.projectEvidence].sort((left, right) =>
        left.project.localeCompare(right.project)
    );
    const projects = new Set<string>();
    const written: WrittenProject[] = [];
    for (const projectEvidence of ordered) {
        const project = projectEvidence.project;
        if (projects.has(project)) {
            throw new Error(
                `Release-gate evidence already exists for ${project}`
            );
        }
        projects.add(project);

        const [traces, screenshots] = await Promise.all([
            copyArtifacts(
                evidenceDir,
                project,
                projectEvidence.traces,
                'trace'
            ),
            copyArtifacts(
                evidenceDir,
                project,
                projectEvidence.screenshots,
                'screenshot'
            ),
        ]);
        const evidence = createReleaseGateBrowserEvidence({
            ...projectEvidence,
            traces,
            screenshots,
        });
        const path = projectFileName(project);
        await writeFile(
            join(evidenceDir, path),
            `${canonicalJson(evidence)}\n`,
            'utf8'
        );
        written.push({ project, path, status: evidence.status });
    }

    await writeFile(
        join(evidenceDir, 'index.json'),
        `${canonicalJson({ schemaVersion: 1, projects: written } as const)}\n`,
        'utf8'
    );
}

function projectName(test: TestCase): string | undefined {
    let suite: Suite | undefined = test.parent;
    while (suite !== undefined) {
        const project = suite.project();
        if (project !== undefined) return project.name;
        suite = suite.parent;
    }
    return undefined;
}

function attachmentSources(result: TestResult, contentType: string): string[] {
    return result.attachments
        .filter(
            attachment =>
                attachment.contentType === contentType &&
                attachment.path !== undefined
        )
        .map(attachment => attachment.path!);
}

async function readEvidenceAttachment(
    result: TestResult
): Promise<ReleaseGateBrowserEvidenceV1 | undefined> {
    const attachment = result.attachments.find(
        candidate =>
            candidate.name === 'release-gate-evidence' &&
            candidate.contentType === 'application/json'
    );
    if (attachment === undefined) return undefined;
    const text =
        attachment.body?.toString('utf8') ??
        (attachment.path === undefined
            ? undefined
            : await readFile(attachment.path, 'utf8'));
    if (text === undefined) return undefined;
    return createReleaseGateBrowserEvidence(
        JSON.parse(text) as ReleaseGateBrowserEvidenceV1
    );
}

function fallbackProjectEvidence(
    project: string,
    run: Awaited<ReturnType<typeof loadReleaseGateRunContext>>
): ProjectEvidenceInput {
    const caseIds =
        run.env.target === 'preview'
            ? [
                  'direct-open',
                  'identity-and-requests',
                  'visual-transition',
                  'mode-swap',
                  'viewport-swap',
                  'history-focus',
                  'bookmark-restore',
                  'omitted-fallback',
                  'choice',
                  'reload-and-lazy-chunk',
              ]
            : [
                  'direct-open',
                  'identity-and-decode',
                  'progression',
                  'read-only',
              ];
    return {
        schemaVersion: 1,
        project,
        storyId: run.scenario.storyId,
        target: run.env.target,
        ...(run.env.expectedIdentity.previewId === undefined
            ? {}
            : { previewId: run.env.expectedIdentity.previewId }),
        releaseId: run.env.expectedIdentity.releaseId,
        manifestSha256: run.env.expectedIdentity.manifestSha256,
        scenarioSha256: run.scenarioSha256,
        identity: run.env.expectedIdentity,
        requestPaths: {
            pointerRequestUrl: null,
            manifestRequestUrl: null,
            observedUrls: [],
        },
        scenarioCases: caseIds.map(id => ({ id, status: 'not-run' as const })),
        status: 'failed',
        traces: [],
        screenshots: [],
    };
}

export default class ReleaseGateReporter implements Reporter {
    private readonly projects = new Set<string>();
    private readonly evidence = new Map<string, ProjectEvidenceInput>();
    private readonly artifacts = new Map<string, CapturedArtifacts>();
    private readonly pending = new Set<Promise<void>>();

    onBegin(config: FullConfig): void {
        for (const project of config.projects) {
            if (project.name.startsWith('release-gate-')) {
                this.projects.add(project.name);
            }
        }
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const project = projectName(test);
        if (project === undefined || !this.projects.has(project)) return;
        if (result.status === 'skipped') return;

        const priorArtifacts = this.artifacts.get(project);
        this.artifacts.set(project, {
            traces: [
                ...new Set([
                    ...(priorArtifacts?.traces ?? []),
                    ...attachmentSources(result, 'application/zip'),
                ]),
            ],
            screenshots: [
                ...new Set([
                    ...(priorArtifacts?.screenshots ?? []),
                    ...attachmentSources(result, 'image/png'),
                ]),
            ],
        });

        const pending = (async () => {
            const browserEvidence = await readEvidenceAttachment(result);
            if (browserEvidence === undefined) return;
            const failed = result.status !== 'passed';
            this.evidence.set(project, {
                ...browserEvidence,
                scenarioCases: failed
                    ? [
                          ...browserEvidence.scenarioCases,
                          { id: 'playwright-execution', status: 'failed' },
                      ]
                    : browserEvidence.scenarioCases,
                status: failed ? 'failed' : browserEvidence.status,
                traces: attachmentSources(result, 'application/zip'),
                screenshots: attachmentSources(result, 'image/png'),
            });
        })();
        this.pending.add(pending);
        void pending.then(
            () => this.pending.delete(pending),
            () => this.pending.delete(pending)
        );
    }

    async onEnd(): Promise<void> {
        const evidenceDir = process.env.RELEASE_GATE_EVIDENCE_DIR?.trim();
        if (evidenceDir === undefined || evidenceDir === '') return;

        await Promise.all(this.pending);
        const run = await loadReleaseGateRunContext(process.env);
        const projectEvidence = [...this.projects].sort().map(project => {
            const evidence =
                this.evidence.get(project) ??
                fallbackProjectEvidence(project, run);
            const artifacts = this.artifacts.get(project);
            return {
                ...evidence,
                traces:
                    evidence.traces.length > 0
                        ? evidence.traces
                        : (artifacts?.traces ?? []),
                screenshots:
                    evidence.screenshots.length > 0
                        ? evidence.screenshots
                        : (artifacts?.screenshots ?? []),
            };
        });
        await writeReleaseGateEvidence({ evidenceDir, projectEvidence });
    }
}
