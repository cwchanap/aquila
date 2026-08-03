import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from '@aquila/stories/runtime-assets';
import {
    parseBrowserEvidenceV1,
    type BrowserEvidenceFlowV1,
    type BrowserEvidenceV1,
} from '@aquila/infra-cloudflare/release-gate';
import type {
    FullConfig,
    Reporter,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';
import { loadReleaseGateRunContext } from '../tests/support/release-gate-env';

type BrowserEvidenceAggregateInput = Omit<
    BrowserEvidenceV1,
    'projects' | 'status'
>;

type ProjectEvidenceInput = {
    evidence: unknown;
    screenshotSources: string[];
};

function evidenceObject(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? { ...value }
        : {};
}

function projectNameFromEvidence(value: unknown): string {
    const project = evidenceObject(value).project;
    return typeof project === 'string' ? project : '';
}

async function copyScreenshots(
    evidenceDir: string,
    project: string,
    sources: readonly string[]
): Promise<string[]> {
    if (sources.length === 0) return [];

    const outputDir = join(evidenceDir, 'screenshots', project);
    await mkdir(outputDir, { recursive: true });
    const copied: string[] = [];
    for (const [index, source] of sources.entries()) {
        const relativePath = `screenshots/${project}/screenshot-${index}.png`;
        await copyFile(resolve(source), join(evidenceDir, relativePath));
        copied.push(relativePath);
    }
    return copied;
}

/**
 * Retains one canonical, inline browser-evidence aggregate. The reporter
 * stores screenshots under the evidence directory but never serializes raw
 * Playwright traces, request headers, cookies, or source attachment paths.
 */
export async function writeReleaseGateEvidence(input: {
    evidenceDir: string;
    aggregate: BrowserEvidenceAggregateInput;
    projectEvidence: readonly ProjectEvidenceInput[];
}): Promise<void> {
    const evidenceDir = resolve(input.evidenceDir);
    await mkdir(evidenceDir, { recursive: true });

    const ordered = [...input.projectEvidence].sort((left, right) =>
        projectNameFromEvidence(left.evidence).localeCompare(
            projectNameFromEvidence(right.evidence)
        )
    );
    const projects = new Set<string>();
    const retainedProjects: unknown[] = [];
    for (const projectEvidence of ordered) {
        const project = projectNameFromEvidence(projectEvidence.evidence);
        if (projects.has(project)) {
            throw new Error(
                `Release-gate evidence already exists for ${project}`
            );
        }
        projects.add(project);

        const screenshots = await copyScreenshots(
            evidenceDir,
            project,
            projectEvidence.screenshotSources
        );
        retainedProjects.push({
            ...evidenceObject(projectEvidence.evidence),
            screenshots,
        });
    }

    const evidence = parseBrowserEvidenceV1({
        ...input.aggregate,
        status: retainedProjects.every(
            project => evidenceObject(project).status === 'passed'
        )
            ? 'passed'
            : 'failed',
        projects: retainedProjects,
    });
    await writeFile(
        join(evidenceDir, 'browser-evidence.json'),
        `${canonicalJson(evidence)}\n`,
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

async function readEvidenceAttachment(result: TestResult): Promise<unknown> {
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
    return JSON.parse(text) as unknown;
}

function flowForTarget(
    target: 'preview' | 'production'
): BrowserEvidenceFlowV1 {
    return target === 'preview' ? 'preview-release-gate' : 'production-smoke';
}

function scenarioCaseIds(flow: BrowserEvidenceFlowV1): readonly string[] {
    return flow === 'preview-release-gate'
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
        : ['direct-open', 'identity-and-decode', 'progression', 'read-only'];
}

function fallbackProjectEvidence(
    project: string,
    run: Awaited<ReturnType<typeof loadReleaseGateRunContext>>
): unknown {
    const flow = flowForTarget(run.env.target);
    return {
        schemaVersion: 1,
        flow,
        project,
        status: 'failed',
        storyId: run.scenario.storyId,
        target: run.env.publicationTarget,
        assetEnvironment: run.env.expectedIdentity.assetEnvironment,
        releaseId: run.env.expectedIdentity.releaseId,
        manifestSha256: run.env.expectedIdentity.manifestSha256,
        scenarioSha256: run.scenarioSha256,
        requestPaths: {
            pointerRequestUrl: null,
            manifestRequestUrl: null,
        },
        scenarioCases: scenarioCaseIds(flow).map(id => ({
            id,
            status: 'not-run' as const,
        })),
        screenshots: [],
    };
}

function aggregateEvidence(
    run: Awaited<ReturnType<typeof loadReleaseGateRunContext>>
): BrowserEvidenceAggregateInput {
    return {
        schemaVersion: 1,
        flow: flowForTarget(run.env.target),
        storyId: run.scenario.storyId,
        target: run.env.publicationTarget,
        releaseId: run.env.expectedIdentity.releaseId,
        manifestSha256: run.env.expectedIdentity.manifestSha256,
        scenarioSha256: run.scenarioSha256,
    };
}

export default class ReleaseGateReporter implements Reporter {
    private readonly projects = new Set<string>();
    private readonly evidence = new Map<string, unknown>();
    private readonly screenshots = new Map<string, string[]>();
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

        const priorScreenshots = this.screenshots.get(project) ?? [];
        this.screenshots.set(project, [
            ...new Set([
                ...priorScreenshots,
                ...attachmentSources(result, 'image/png'),
            ]),
        ]);

        const pending = (async () => {
            const browserEvidence = await readEvidenceAttachment(result);
            if (browserEvidence === undefined) return;
            const evidence = evidenceObject(browserEvidence);
            this.evidence.set(project, {
                ...evidence,
                status: result.status === 'passed' ? evidence.status : 'failed',
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
        const projectEvidence = [...this.projects].sort().map(project => ({
            evidence:
                this.evidence.get(project) ??
                fallbackProjectEvidence(project, run),
            screenshotSources: this.screenshots.get(project) ?? [],
        }));
        await writeReleaseGateEvidence({
            evidenceDir,
            aggregate: aggregateEvidence(run),
            projectEvidence,
        });
    }
}
