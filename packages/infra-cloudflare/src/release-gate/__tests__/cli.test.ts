import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    closeSync,
    constants,
    lstatSync,
    openSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const descriptorOpenRace = vi.hoisted(() => ({
    beforeOpenAt: undefined as undefined | ((path: string) => void),
}));

vi.mock('bun:ffi', () => {
    const descriptors = new Map<number, string>();
    return {
        FFIType: { i32: 5, ptr: 12 },
        dlopen: () => ({
            close: () => undefined,
            symbols: {
                close: (descriptor: number): number => {
                    descriptors.delete(descriptor);
                    try {
                        closeSync(descriptor);
                        return 0;
                    } catch {
                        return -1;
                    }
                },
                openat: (
                    directoryDescriptor: number,
                    encodedPath: Uint8Array,
                    flags: number
                ): number => {
                    const path = Buffer.from(encodedPath)
                        .toString('utf8')
                        .split('\0', 1)[0]!;
                    descriptorOpenRace.beforeOpenAt?.(path);
                    if (
                        (flags & constants.O_NOFOLLOW) !==
                        constants.O_NOFOLLOW
                    ) {
                        throw new Error(
                            'descriptor open must not follow links'
                        );
                    }
                    const parentPath = descriptors.get(directoryDescriptor);
                    if (directoryDescriptor >= 0 && parentPath === undefined) {
                        return -1;
                    }
                    const candidate =
                        parentPath === undefined
                            ? path
                            : join(parentPath, path);
                    try {
                        const stats = lstatSync(candidate);
                        if (
                            stats.isSymbolicLink() ||
                            ((flags & constants.O_DIRECTORY) !== 0 &&
                                !stats.isDirectory())
                        ) {
                            return -1;
                        }
                        const descriptor = openSync(candidate, flags);
                        descriptors.set(descriptor, candidate);
                        return descriptor;
                    } catch {
                        return -1;
                    }
                },
            },
        }),
        ptr: (value: Uint8Array): Uint8Array => value,
    };
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
    descriptorOpenRace.beforeOpenAt = undefined;
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map(directory => rm(directory, { force: true, recursive: true }))
    );
});

import { runAssetsCli, type AssetsCliDependencies } from '../../publisher/cli';
import type { PublisherReportV1 } from '../../publisher/report';
import type { DeliveryStore } from '../../publisher/stores/delivery-store';
import { validGateReport } from '../__fixtures__/valid-evidence';
import { runReleaseGateCli, type ReleaseGateCliDependencies } from '../cli';
import {
    parseGateDiagnosticV1,
    parseVisualNovelReleaseGateReportV1,
    type VisualNovelReleaseGateReportV1,
} from '../schemas';
import type { GateStageV1 } from '../diagnostics';

function publisherReport(): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: 'plan',
        status: 'success',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        counts: {
            included: 0,
            omitted: 0,
            objectsCreated: 0,
            objectsReused: 0,
            manifestsCreated: 0,
            manifestsReused: 0,
            pointersWritten: 0,
        },
        actions: [],
        warnings: [],
        errors: [],
    };
}

function fakeStore(): DeliveryStore {
    return {
        stat: vi.fn(async () => null),
        read: vi.fn(async () => {
            throw new Error('unused');
        }),
        createImmutable: vi.fn(async () => ({ status: 'created' as const })),
        inspectPointer: vi.fn(async () => ({ exists: false as const })),
        readPointer: vi.fn(async () => ({ exists: false as const })),
        compareAndSwapPointer: vi.fn(async () => ({
            status: 'written' as const,
        })),
        async *listKeys() {},
        async *list() {},
        close: vi.fn(async () => undefined),
    };
}

function harness(): {
    dependencies: AssetsCliDependencies;
    stdout: () => string;
    stderr: () => string;
} {
    let stdout = '';
    let stderr = '';
    const store = fakeStore();
    return {
        dependencies: {
            repositoryRoot: '/workspace/aquila',
            environment: {
                AQUILA_PRODUCTION_WEB_ORIGIN: 'https://aquila.example.com',
            },
            createLocalStore: vi.fn(async () => store),
            createR2Store: vi.fn(async () => store),
            runCommand: vi.fn(async () => publisherReport()),
            stdout: {
                write(chunk) {
                    stdout += String(chunk);
                    return true;
                },
            },
            stderr: {
                write(chunk) {
                    stderr += String(chunk);
                    return true;
                },
            },
        },
        stdout: () => stdout,
        stderr: () => stderr,
    };
}

const retainedEvidencePaths = {
    tier1: 'artifacts/ci-tier1.json',
    publisher: 'artifacts/publisher-candidate.json',
    r2Candidate: 'artifacts/r2-candidate.json',
    publicCandidate: 'artifacts/public-candidate.json',
    publicActive: 'artifacts/public-active.json',
    webIdentity: 'artifacts/web-identity.json',
    browser: 'artifacts/browser-flow.json',
    manualReview: 'artifacts/manual-review.json',
    workflowApproval: 'artifacts/workflow-approval.json',
    productionPointerBefore: 'artifacts/production-pointer-before.json',
    productionPointerAfter: 'artifacts/production-pointer-after.json',
} as const;

const retainedEvidenceOptions = [
    ['--tier1-evidence', 'configuration/missing-tier1-evidence'],
    ['--publisher-report', 'configuration/missing-publisher-report'],
    ['--r2-candidate-evidence', 'configuration/missing-r2-candidate-evidence'],
    [
        '--public-candidate-evidence',
        'configuration/missing-public-candidate-evidence',
    ],
    [
        '--public-active-evidence',
        'configuration/missing-public-active-evidence',
    ],
    ['--web-identity-evidence', 'configuration/missing-web-identity-evidence'],
    ['--browser-evidence', 'configuration/missing-browser-evidence'],
    ['--manual-review', 'configuration/missing-manual-review'],
    ['--workflow-approval', 'configuration/missing-workflow-approval'],
    [
        '--production-pointer-before',
        'configuration/missing-production-pointer-before',
    ],
    [
        '--production-pointer-after',
        'configuration/missing-production-pointer-after',
    ],
] as const;

const verifyPreviewArgs = [
    'verify-preview',
    '--story',
    'the_seventh_mirror',
    '--preview-id',
    'hpa-233',
    '--release',
    `sha256-${'a'.repeat(64)}`,
    '--expect-manifest-sha256',
    'b'.repeat(64),
    '--asset-base-url',
    'https://assets.aquila.example',
    '--web-base-url',
    'https://preview.aquila.example',
    '--tier1-evidence',
    retainedEvidencePaths.tier1,
    '--publisher-report',
    retainedEvidencePaths.publisher,
    '--r2-candidate-evidence',
    retainedEvidencePaths.r2Candidate,
    '--public-candidate-evidence',
    retainedEvidencePaths.publicCandidate,
    '--public-active-evidence',
    retainedEvidencePaths.publicActive,
    '--browser-evidence',
    retainedEvidencePaths.browser,
    '--web-identity-evidence',
    retainedEvidencePaths.webIdentity,
    '--manual-review',
    retainedEvidencePaths.manualReview,
    '--workflow-approval',
    retainedEvidencePaths.workflowApproval,
    '--production-pointer-before',
    retainedEvidencePaths.productionPointerBefore,
    '--production-pointer-after',
    retainedEvidencePaths.productionPointerAfter,
    '--commit-sha',
    'f'.repeat(40),
    '--evidence-dir',
    '/retained/evidence',
] as const;

const assertActivationReadyArgs = [
    'assert-activation-ready',
    '--report',
    'evidence/release-gate-report.json',
    '--story',
    'the_seventh_mirror',
    '--release',
    `sha256-${'a'.repeat(64)}`,
    '--expect-manifest-sha256',
    'b'.repeat(64),
    '--commit-sha',
    'f'.repeat(40),
] as const;

const smokeProductionArgs = [
    'smoke-production',
    '--story',
    'the_seventh_mirror',
    '--release',
    `sha256-${'a'.repeat(64)}`,
    '--expect-manifest-sha256',
    'b'.repeat(64),
    '--asset-base-url',
    'https://assets.aquila.example',
    '--web-base-url',
    'https://aquila.example.com',
    '--browser-evidence',
    'evidence/production-smoke.json',
] as const;

function failedGateReport(
    code: string,
    stage: GateStageV1
): VisualNovelReleaseGateReportV1 {
    return parseVisualNovelReleaseGateReportV1({
        ...validGateReport,
        status: 'failed',
        checks: {
            ...validGateReport.checks,
            webIdentity: { status: 'failed', evidenceIds: ['web'] },
        },
        diagnostics: [
            {
                code,
                stage,
                message: 'Release gate verification failed',
            },
        ],
    });
}

function releaseGateDependencies(
    dependencies: AssetsCliDependencies,
    runVerifyPreview: ReturnType<typeof vi.fn>
): ReleaseGateCliDependencies {
    return {
        environment: dependencies.environment,
        repositoryRoot: dependencies.repositoryRoot,
        stdout: dependencies.stdout,
        stderr: dependencies.stderr,
        runVerifyPreview,
    } as ReleaseGateCliDependencies;
}

function withoutEvidenceOption(option: string): string[] {
    const args = [...verifyPreviewArgs];
    const index = args.indexOf(option);
    if (index < 0) throw new Error(`Missing test option ${option}`);
    args.splice(index, 2);
    return args;
}

function withInvalidEvidencePath(option: string): string[] {
    const args = [...verifyPreviewArgs];
    const index = args.indexOf(option);
    if (index < 0) throw new Error(`Missing test option ${option}`);
    args[index + 1] = '../outside-evidence.json';
    return args;
}

function noReadCoordinatorDependencies(dependencies: AssetsCliDependencies): {
    dependencies: ReleaseGateCliDependencies;
    readValidatedJsonEvidence: ReturnType<typeof vi.fn>;
    runVisualNovelReleaseGate: ReturnType<typeof vi.fn>;
} {
    const readValidatedJsonEvidence = vi.fn(async () => {
        throw new Error('Evidence must not be read for an invalid CLI input');
    });
    const runVisualNovelReleaseGate = vi.fn(async () =>
        parseVisualNovelReleaseGateReportV1(validGateReport)
    );
    return {
        dependencies: {
            ...releaseGateDependencies(
                dependencies,
                vi.fn(async () => validGateReport)
            ),
            runVerifyPreview: undefined,
            readValidatedJsonEvidence,
            runVisualNovelReleaseGate,
        } as ReleaseGateCliDependencies,
        readValidatedJsonEvidence,
        runVisualNovelReleaseGate,
    };
}

const retainedCandidatePublisherReport: PublisherReportV1 = {
    schemaVersion: 1,
    command: 'publish',
    status: 'success',
    storyId: 'the_seventh_mirror',
    target: { kind: 'production' },
    releaseId: `sha256-${'a'.repeat(64)}`,
    manifestSha256: 'b'.repeat(64),
    coverage: {
        storyId: 'the_seventh_mirror',
        byType: {
            background: {
                total: 2,
                included: 1,
                omitted: 1,
                unclassified: 0,
            },
            portrait: {
                total: 1,
                included: 1,
                omitted: 0,
                unclassified: 0,
            },
        },
        bySection: {
            opening: {
                total: 3,
                included: 2,
                omitted: 1,
                unclassified: 0,
            },
        },
        totals: {
            total: 3,
            included: 2,
            omitted: 1,
            unclassified: 0,
        },
    },
    counts: {
        included: 2,
        omitted: 1,
        objectsCreated: 2,
        objectsReused: 1,
        manifestsCreated: 1,
        manifestsReused: 0,
        pointersWritten: 0,
    },
    actions: [
        {
            stage: 'input',
            kind: 'include',
            identity: 'background:opening/station',
        },
        {
            stage: 'input',
            kind: 'include',
            identity: 'portrait:characters/mei',
        },
        {
            stage: 'input',
            kind: 'omit',
            identity: 'background:opening/fallback',
        },
        { stage: 'activation', kind: 'no-op' },
    ],
    warnings: [],
    errors: [],
    pointer: { changed: false },
};

const previewBrowserScenarioCases = [
    { id: 'direct-open', status: 'passed' },
    { id: 'identity-and-requests', status: 'passed' },
    { id: 'visual-transition', status: 'passed' },
    { id: 'mode-swap', status: 'passed' },
    { id: 'viewport-swap', status: 'passed' },
    { id: 'history-focus', status: 'passed' },
    { id: 'bookmark-restore', status: 'passed' },
    { id: 'omitted-fallback', status: 'passed' },
    { id: 'choice', status: 'passed' },
    { id: 'reload-and-lazy-chunk', status: 'passed' },
] as const;

function previewBrowserProject(
    project: 'release-gate-chromium' | 'release-gate-mobile-chrome'
) {
    return {
        schemaVersion: 1,
        flow: 'preview-release-gate' as const,
        project,
        status: 'passed' as const,
        webBaseUrl: 'https://preview.aquila.example',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview' as const, previewId: 'hpa-233' },
        assetEnvironment: 'preview' as const,
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        scenarioSha256: 'c'.repeat(64),
        requestPaths: {
            pointerRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/current.json',
            manifestRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/releases/runtime-manifest.json',
        },
        scenarioCases: previewBrowserScenarioCases.map(scenarioCase => ({
            ...scenarioCase,
        })),
        screenshots: [],
    };
}

const retainedEvidence: Record<string, unknown> = {
    [retainedEvidencePaths.tier1]: {
        schemaVersion: 1,
        commitSha: 'f'.repeat(40),
        lockfileSha256: 'd'.repeat(64),
        bunVersion: '1.3.1',
        nodeVersion: '22.10.0',
        playwrightVersion: '1.55.0',
        commandSetVersion: 1,
        browserMatrix: ['chromium', 'mobile-chrome'],
        status: 'passed',
        completedAt: '2026-08-03T12:00:00.000Z',
    },
    [retainedEvidencePaths.publisher]: retainedCandidatePublisherReport,
    [retainedEvidencePaths.r2Candidate]: {
        schemaVersion: 1,
        status: 'passed',
        depth: 'deep',
        storyId: 'the_seventh_mirror',
        target: { kind: 'production' },
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
    },
    [retainedEvidencePaths.publicCandidate]: {
        schemaVersion: 1,
        status: 'passed',
        mode: 'candidate',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        checks: [{ id: 'manifest.fetch', status: 'passed' }],
        diagnostics: [],
    },
    [retainedEvidencePaths.publicActive]: {
        schemaVersion: 1,
        status: 'passed',
        mode: 'active',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        checks: [{ id: 'manifest.fetch', status: 'passed' }],
        diagnostics: [],
    },
    [retainedEvidencePaths.webIdentity]: {
        schemaVersion: 1,
        target: 'preview',
        webBaseUrl: 'https://preview.aquila.example',
        assetEnvironment: 'preview',
        previewId: 'hpa-233',
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        pointerRequestUrl:
            'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/current.json',
        manifestRequestUrl:
            'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/releases/runtime-manifest.json',
    },
    [retainedEvidencePaths.browser]: {
        schemaVersion: 1,
        flow: 'preview-release-gate',
        status: 'passed',
        webBaseUrl: 'https://preview.aquila.example',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        scenarioSha256: 'c'.repeat(64),
        projects: [
            previewBrowserProject('release-gate-chromium'),
            previewBrowserProject('release-gate-mobile-chrome'),
        ],
    },
    [retainedEvidencePaths.manualReview]: {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        previewId: 'hpa-233',
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        scenarioSha256: 'c'.repeat(64),
        reviewedAt: '2026-08-03T12:00:00.000Z',
        reviewer: 'release-reviewer',
        decision: 'approved',
        includedCount: 2,
        omittedCount: 1,
        representativeRoutes: ['/en/stories/the_seventh_mirror'],
        notes: ['Desktop and mobile review completed.'],
    },
    [retainedEvidencePaths.workflowApproval]: {
        schemaVersion: 1,
        repository: 'cwchan/aquila',
        workflowRef: '.github/workflows/visual-novel-release-live.yml@main',
        runId: 123456,
        runAttempt: 1,
        jobId: 'release-gate-finalize',
        actor: 'release-bot',
        environment: 'visual-novel-release-approval',
        conclusion: 'success',
    },
    [retainedEvidencePaths.productionPointerBefore]: {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        previewId: 'hpa-233',
        productionPointer: {
            exists: true,
            releaseId: `sha256-${'e'.repeat(64)}`,
            manifestSha256: 'f'.repeat(64),
        },
    },
    [retainedEvidencePaths.productionPointerAfter]: {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        previewId: 'hpa-233',
        productionPointer: {
            exists: true,
            releaseId: `sha256-${'e'.repeat(64)}`,
            manifestSha256: 'f'.repeat(64),
        },
    },
};

describe('assets release-gate routing', () => {
    it('routes release-gate without passing the token to publisher parsing', async () => {
        const test = harness();

        const exit = await runAssetsCli(
            ['release-gate', 'verify-preview', '--help'],
            test.dependencies
        );

        expect(exit).toBe(0);
        expect(test.stdout()).toContain('assets release-gate verify-preview');
        expect(test.stderr()).toBe('');
    });

    it('preserves existing publisher help and plan behavior', async () => {
        const help = harness();
        const plan = harness();

        await expect(runAssetsCli(['--help'], help.dependencies)).resolves.toBe(
            0
        );
        await expect(
            runAssetsCli(
                [
                    'plan',
                    '--story',
                    'the_seventh_mirror',
                    '--environment',
                    'preview',
                    '--preview-id',
                    'hpa-233',
                    '--destination-root',
                    '/tmp/aquila-delivery',
                ],
                plan.dependencies
            )
        ).resolves.toBe(0);

        expect(help.stdout()).toContain('Usage: assets <command>');
        expect(plan.stderr()).toContain('command: plan');
    });

    it('passes strict verify-preview input to the gate service and writes one JSON report to stdout', async () => {
        const test = harness();
        const runVerifyPreview = vi.fn(async () => validGateReport);

        const exit = await runReleaseGateCli(
            [...verifyPreviewArgs, '--json'],
            releaseGateDependencies(test.dependencies, runVerifyPreview)
        );

        expect(exit).toBe(0);
        expect(runVerifyPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                storyId: 'the_seventh_mirror',
                previewId: 'hpa-233',
                releaseId: `sha256-${'a'.repeat(64)}`,
                manifestSha256: 'b'.repeat(64),
                assetBaseUrl: 'https://assets.aquila.example',
                webBaseUrl: 'https://preview.aquila.example',
                tier1EvidencePath: retainedEvidencePaths.tier1,
                publisherReportPath: retainedEvidencePaths.publisher,
                r2CandidateEvidencePath: retainedEvidencePaths.r2Candidate,
                publicCandidateEvidencePath:
                    retainedEvidencePaths.publicCandidate,
                publicActiveEvidencePath: retainedEvidencePaths.publicActive,
                browserEvidencePath: retainedEvidencePaths.browser,
                webIdentityEvidencePath: retainedEvidencePaths.webIdentity,
                manualReviewPath: retainedEvidencePaths.manualReview,
                workflowApprovalPath: retainedEvidencePaths.workflowApproval,
                productionPointerBeforePath:
                    retainedEvidencePaths.productionPointerBefore,
                productionPointerAfterPath:
                    retainedEvidencePaths.productionPointerAfter,
                commitSha: 'f'.repeat(40),
                evidenceDir: '/retained/evidence',
            })
        );
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(
            parseVisualNovelReleaseGateReportV1(JSON.parse(test.stdout()))
        ).toEqual(validGateReport);
        expect(test.stderr()).toBe('');
    });

    it('writes a human gate summary to stderr only', async () => {
        const test = harness();

        const exit = await runReleaseGateCli(
            verifyPreviewArgs,
            releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            )
        );

        expect(exit).toBe(0);
        expect(test.stdout()).toBe('');
        expect(test.stderr()).toContain('status: passed');
    });

    it('documents every retained evidence artifact as an explicit preview input', async () => {
        const test = harness();

        const exit = await runReleaseGateCli(
            ['verify-preview', '--help'],
            releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            )
        );

        expect(exit).toBe(0);
        for (const [option] of retainedEvidenceOptions) {
            expect(test.stdout()).toContain(option);
        }
        expect(test.stderr()).toBe('');
    });

    it('assembles retained immutable evidence for the Task 4 coordinator without a publisher store', async () => {
        const test = harness();
        const readValidatedJsonEvidence = vi.fn(
            async (_directory, request: { path: string }) => {
                const evidence = retainedEvidence[request.path];
                if (evidence === undefined)
                    throw new Error(`Missing ${request.path}`);
                return {
                    value: evidence,
                    reference: { ...request, sha256: 'd'.repeat(64) },
                };
            }
        );
        const runVisualNovelReleaseGate = vi.fn(async () =>
            parseVisualNovelReleaseGateReportV1(validGateReport)
        );

        const exit = await runReleaseGateCli([...verifyPreviewArgs, '--json'], {
            ...releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            ),
            runVerifyPreview: undefined,
            readValidatedJsonEvidence,
            runVisualNovelReleaseGate,
        } as unknown as ReleaseGateCliDependencies);

        expect(exit).toBe(0);
        expect(readValidatedJsonEvidence).toHaveBeenCalledTimes(11);
        expect(
            readValidatedJsonEvidence.mock.calls.map(([directory, request]) => [
                directory,
                request.path,
            ])
        ).toEqual([
            ['/retained/evidence', retainedEvidencePaths.publisher],
            ['/retained/evidence', retainedEvidencePaths.tier1],
            ['/retained/evidence', retainedEvidencePaths.r2Candidate],
            ['/retained/evidence', retainedEvidencePaths.publicCandidate],
            ['/retained/evidence', retainedEvidencePaths.publicActive],
            ['/retained/evidence', retainedEvidencePaths.webIdentity],
            ['/retained/evidence', retainedEvidencePaths.browser],
            ['/retained/evidence', retainedEvidencePaths.manualReview],
            ['/retained/evidence', retainedEvidencePaths.workflowApproval],
            [
                '/retained/evidence',
                retainedEvidencePaths.productionPointerBefore,
            ],
            [
                '/retained/evidence',
                retainedEvidencePaths.productionPointerAfter,
            ],
        ]);
        expect(runVisualNovelReleaseGate).toHaveBeenCalledWith(
            expect.objectContaining({
                identity: {
                    storyId: 'the_seventh_mirror',
                    target: { kind: 'preview', previewId: 'hpa-233' },
                    previewId: 'hpa-233',
                    releaseId: `sha256-${'a'.repeat(64)}`,
                    manifestSha256: 'b'.repeat(64),
                    commitSha: 'f'.repeat(40),
                    scenarioSha256: 'c'.repeat(64),
                },
                evidenceDir: '/retained/evidence',
                publisherReport: retainedCandidatePublisherReport,
                evidence: {
                    deterministicCi: expect.objectContaining({
                        path: retainedEvidencePaths.tier1,
                    }),
                    publisherCandidate: expect.objectContaining({
                        path: retainedEvidencePaths.publisher,
                    }),
                    r2Candidate: expect.objectContaining({
                        path: retainedEvidencePaths.r2Candidate,
                    }),
                    publicCandidate: expect.objectContaining({
                        path: retainedEvidencePaths.publicCandidate,
                    }),
                    publicActiveRelease: expect.objectContaining({
                        path: retainedEvidencePaths.publicActive,
                    }),
                    webIdentity: expect.objectContaining({
                        path: retainedEvidencePaths.webIdentity,
                    }),
                    browserFlows: expect.objectContaining({
                        path: retainedEvidencePaths.browser,
                    }),
                    manualReview: expect.objectContaining({
                        path: retainedEvidencePaths.manualReview,
                    }),
                    workflowApproval: expect.objectContaining({
                        path: retainedEvidencePaths.workflowApproval,
                    }),
                    productionPointerBefore: expect.objectContaining({
                        path: retainedEvidencePaths.productionPointerBefore,
                    }),
                    productionPointerAfter: expect.objectContaining({
                        path: retainedEvidencePaths.productionPointerAfter,
                    }),
                },
            })
        );
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(test.stderr()).toBe('');
    });

    it('rejects malformed inline browser evidence before creating retained references', async () => {
        const test = harness();
        const malformedEvidence: Record<string, unknown> = {
            ...retainedEvidence,
            [retainedEvidencePaths.browser]: {
                ...(retainedEvidence[retainedEvidencePaths.browser] as object),
                target: 'preview-with-secret',
            },
        };
        const readValidatedJsonEvidence = vi.fn(
            async (_directory, request: { path: string }) => {
                const evidence = malformedEvidence[request.path];
                if (evidence === undefined)
                    throw new Error(`Missing ${request.path}`);
                return {
                    value: evidence,
                    reference: { ...request, sha256: 'd'.repeat(64) },
                };
            }
        );
        const runVisualNovelReleaseGate = vi.fn();

        const exit = await runReleaseGateCli([...verifyPreviewArgs, '--json'], {
            ...releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            ),
            runVerifyPreview: undefined,
            readValidatedJsonEvidence,
            runVisualNovelReleaseGate,
        } as unknown as ReleaseGateCliDependencies);

        expect(exit).toBe(2);
        expect(runVisualNovelReleaseGate).not.toHaveBeenCalled();
        expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
            expect.objectContaining({
                code: 'input/verify-preview-failed',
                stage: 'input',
            })
        );
        expect(test.stdout()).not.toContain('preview-with-secret');
        expect(test.stderr()).toBe('');
    });

    it.each(retainedEvidenceOptions)(
        'requires %s and never reads a hidden default evidence path',
        async (option, expectedCode) => {
            const test = harness();
            const coordinator = noReadCoordinatorDependencies(
                test.dependencies
            );

            const exit = await runReleaseGateCli(
                [...withoutEvidenceOption(option), '--json'],
                coordinator.dependencies
            );

            expect(exit).toBe(1);
            expect(
                coordinator.readValidatedJsonEvidence
            ).not.toHaveBeenCalled();
            expect(
                coordinator.runVisualNovelReleaseGate
            ).not.toHaveBeenCalled();
            expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
                expect.objectContaining({ code: expectedCode, stage: 'input' })
            );
            expect(test.stderr()).toBe('');
        }
    );

    it.each(retainedEvidenceOptions)(
        'rejects an unsafe value for %s before reading evidence',
        async option => {
            const test = harness();
            const coordinator = noReadCoordinatorDependencies(
                test.dependencies
            );

            const exit = await runReleaseGateCli(
                [...withInvalidEvidencePath(option), '--json'],
                coordinator.dependencies
            );

            expect(exit).toBe(2);
            expect(
                coordinator.readValidatedJsonEvidence
            ).not.toHaveBeenCalled();
            expect(
                coordinator.runVisualNovelReleaseGate
            ).not.toHaveBeenCalled();
            expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
                expect.objectContaining({
                    code: `input/invalid-${option.slice(2)}`,
                    stage: 'input',
                })
            );
            expect(test.stderr()).toBe('');
        }
    );

    it('rejects a preview web origin equal to the configured production origin before reading evidence', async () => {
        const test = harness();
        const runVerifyPreview = vi.fn(async () => validGateReport);

        const exit = await runReleaseGateCli([...verifyPreviewArgs, '--json'], {
            ...releaseGateDependencies(test.dependencies, runVerifyPreview),
            environment: {
                AQUILA_PRODUCTION_WEB_ORIGIN: 'https://preview.aquila.example',
            },
        } as ReleaseGateCliDependencies);

        expect(exit).toBe(5);
        expect(runVerifyPreview).not.toHaveBeenCalled();
        expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
            expect.objectContaining({
                code: 'activation-target/preview-web-origin',
                stage: 'input',
            })
        );
        expect(test.stderr()).toBe('');
    });

    it('rejects malformed verify-preview identity before calling its service', async () => {
        const test = harness();
        const runVerifyPreview = vi.fn(async () => validGateReport);
        const args = [...verifyPreviewArgs];
        const storyIndex = args.indexOf('the_seventh_mirror');
        args[storyIndex] = 'invalid story id';

        const exit = await runReleaseGateCli(
            [...args, '--json'],
            releaseGateDependencies(test.dependencies, runVerifyPreview)
        );

        expect(exit).toBe(2);
        expect(runVerifyPreview).not.toHaveBeenCalled();
        expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
            expect.objectContaining({
                code: 'input/verify-preview-identity',
                stage: 'input',
            })
        );
        expect(test.stderr()).toBe('');
    });

    it.each([
        ['configuration/invalid', 'input', 1],
        ['evidence-binding/invalid', 'evidence-binding', 2],
        ['storage/unavailable', 'input', 3],
        ['concurrency/conflict', 'pointer', 4],
        ['activation-target/guarded', 'input', 5],
    ] as const)(
        'maps %s reports through the existing assets exit taxonomy',
        async (code, stage, expectedExit) => {
            const test = harness();

            const exit = await runReleaseGateCli(
                [...verifyPreviewArgs, '--json'],
                releaseGateDependencies(
                    test.dependencies,
                    vi.fn(async () => failedGateReport(code, stage))
                )
            );

            expect(exit).toBe(expectedExit);
            expect(test.stdout().trim().split('\n')).toHaveLength(1);
            expect(
                parseVisualNovelReleaseGateReportV1(JSON.parse(test.stdout()))
            ).toMatchObject({
                status: 'failed',
                diagnostics: [
                    {
                        code,
                        stage,
                        message: 'Release gate diagnostic',
                    },
                ],
            });
            expect(test.stderr()).toBe('');
        }
    );

    it('maps assert-activation-ready flags to the read-only assertion service', async () => {
        const test = harness();
        const assertion = vi.fn(async () => ({ status: 'passed' as const }));
        const readValidatedJsonFile = vi.fn(async () => validGateReport);
        const dependencies = {
            ...releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            ),
            assertActivationReady: assertion,
            readValidatedJsonFile,
        } as unknown as ReleaseGateCliDependencies;

        const exit = await runReleaseGateCli(
            [...assertActivationReadyArgs, '--json'],
            dependencies
        );

        expect(exit).toBe(0);
        expect(assertion).toHaveBeenCalledWith(
            {
                evidenceDir: '/workspace/aquila/evidence',
                report: validGateReport,
                expected: {
                    storyId: 'the_seventh_mirror',
                    releaseId: `sha256-${'a'.repeat(64)}`,
                    manifestSha256: 'b'.repeat(64),
                    commitSha: 'f'.repeat(40),
                },
            },
            expect.anything()
        );
        expect(JSON.parse(test.stdout())).toEqual({ status: 'passed' });
        expect(test.stderr()).toBe('');
        expect(readValidatedJsonFile).toHaveBeenCalledWith(
            '/workspace/aquila',
            'evidence/release-gate-report.json'
        );
    });

    it('rejects a report swapped to a symlink at the CLI descriptor boundary', async () => {
        const repositoryRoot = await mkdtemp(
            join(tmpdir(), 'aquila-release-gate-cli-')
        );
        temporaryDirectories.push(repositoryRoot);
        const evidenceDirectory = join(repositoryRoot, 'evidence');
        await mkdir(evidenceDirectory);
        const reportPath = join(evidenceDirectory, 'release-gate-report.json');
        const unsafePath = join(repositoryRoot, 'unsafe.json');
        await writeFile(reportPath, JSON.stringify(validGateReport));
        await writeFile(unsafePath, JSON.stringify({ status: 'forged' }));
        let swapped = false;
        descriptorOpenRace.beforeOpenAt = path => {
            if (path !== 'release-gate-report.json' || swapped) return;
            rmSync(reportPath);
            symlinkSync('../unsafe.json', reportPath);
            swapped = true;
        };
        const test = harness();
        const assertion = vi.fn(async () => ({ status: 'passed' as const }));

        const exit = await runReleaseGateCli(
            [...assertActivationReadyArgs, '--json'],
            {
                ...releaseGateDependencies(
                    test.dependencies,
                    vi.fn(async () => validGateReport)
                ),
                repositoryRoot,
                assertActivationReady: assertion,
            }
        );

        expect(swapped).toBe(true);
        expect(exit).toBe(2);
        expect(assertion).not.toHaveBeenCalled();
        expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toMatchObject({
            code: 'evidence/path-outside-root',
        });
    });

    it('maps smoke-production flags to the read-only production coordinator', async () => {
        const test = harness();
        const browserEvidence = {
            schemaVersion: 1,
            flow: 'production-smoke',
            status: 'passed',
            webBaseUrl: 'https://aquila.example.com',
            storyId: 'the_seventh_mirror',
            target: { kind: 'production' },
            releaseId: `sha256-${'a'.repeat(64)}`,
            manifestSha256: 'b'.repeat(64),
            scenarioSha256: 'c'.repeat(64),
            projects: [],
        };
        const smoke = vi.fn(async () => ({
            schemaVersion: 1,
            status: 'passed' as const,
            storyId: 'the_seventh_mirror',
            target: { kind: 'production' as const },
            releaseId: `sha256-${'a'.repeat(64)}`,
            manifestSha256: 'b'.repeat(64),
            checks: [],
            diagnostics: [],
        }));
        const readValidatedJsonFile = vi.fn(async () => browserEvidence);
        const dependencies = {
            ...releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            ),
            runProductionSmoke: smoke,
            readValidatedJsonFile,
        } as unknown as ReleaseGateCliDependencies;

        const exit = await runReleaseGateCli(
            [...smokeProductionArgs, '--json'],
            dependencies
        );

        expect(exit).toBe(0);
        expect(smoke).toHaveBeenCalledWith(
            {
                storyId: 'the_seventh_mirror',
                releaseId: `sha256-${'a'.repeat(64)}`,
                expectedManifestSha256: 'b'.repeat(64),
                assetBaseUrl: 'https://assets.aquila.example',
                webBaseUrl: 'https://aquila.example.com',
                productionWebOrigin: 'https://aquila.example.com',
                browserEvidence,
            },
            expect.anything()
        );
        expect(JSON.parse(test.stdout())).toMatchObject({ status: 'passed' });
        expect(test.stderr()).toBe('');
        expect(readValidatedJsonFile).toHaveBeenCalledWith(
            '/workspace/aquila',
            'evidence/production-smoke.json'
        );
    });

    it.each([
        ['assert-activation-ready', 'configuration/missing-report'],
        ['smoke-production', 'configuration/missing-story'],
    ] as const)(
        'requires Task 11 inputs for %s before calling its read-only service',
        async (command, code) => {
            const test = harness();
            const assertion = vi.fn(async () => ({
                status: 'passed' as const,
            }));
            const smoke = vi.fn(async () => ({ status: 'passed' as const }));

            const exit = await runReleaseGateCli([command, '--json'], {
                ...releaseGateDependencies(
                    test.dependencies,
                    vi.fn(async () => validGateReport)
                ),
                assertActivationReady: assertion,
                runProductionSmoke: smoke,
            } as unknown as ReleaseGateCliDependencies);

            expect(exit).toBe(1);
            expect(assertion).not.toHaveBeenCalled();
            expect(smoke).not.toHaveBeenCalled();
            expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
                expect.objectContaining({ code, stage: 'input' })
            );
            expect(test.stderr()).toBe('');
        }
    );

    it('declares only the narrow typed release-gate package export', () => {
        const packageJson = JSON.parse(
            readFileSync(
                new URL('../../../package.json', import.meta.url),
                'utf8'
            )
        ) as { exports?: unknown };

        expect(packageJson.exports).toEqual({
            './release-gate': './src/release-gate/index.ts',
        });
    });
});
