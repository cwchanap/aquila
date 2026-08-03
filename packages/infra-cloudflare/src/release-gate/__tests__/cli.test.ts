import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('bun:ffi', () => ({
    FFIType: { i32: 5, ptr: 12 },
    dlopen: () => ({
        close: () => undefined,
        symbols: { close: () => 0, openat: () => -1 },
    }),
    ptr: (value: Uint8Array): Uint8Array => value,
}));

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
    '--publisher-report',
    'publisher/report.json',
    '--browser-evidence',
    'browser/result.json',
    '--web-identity-evidence',
    'web/identity.json',
    '--manual-review',
    'manual/review.json',
    '--workflow-approval',
    'workflow/approval.json',
    '--commit-sha',
    'f'.repeat(40),
    '--evidence-dir',
    '/retained/evidence',
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

const retainedEvidence: Record<string, unknown> = {
    'ci/result.json': {
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
    'publisher/report.json': retainedCandidatePublisherReport,
    'r2/result.json': {
        schemaVersion: 1,
        status: 'passed',
        depth: 'deep',
        storyId: 'the_seventh_mirror',
        target: { kind: 'production' },
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
    },
    'public/candidate.json': {
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
    'public/active.json': {
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
    'web/identity.json': {
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
    'browser/result.json': {
        schemaVersion: 1,
        status: 'passed',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        previewId: 'hpa-233',
        releaseId: `sha256-${'a'.repeat(64)}`,
        manifestSha256: 'b'.repeat(64),
        scenarioSha256: 'c'.repeat(64),
    },
    'manual/review.json': {
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
    'workflow/approval.json': {
        schemaVersion: 1,
        repository: 'cwchan/aquila',
        workflowRef: '.github/workflows/visual-novel-release-gate.yml@main',
        runId: 123456,
        runAttempt: 1,
        jobId: 'release-gate-finalize',
        actor: 'release-bot',
        environment: 'visual-novel-release-approval',
        conclusion: 'success',
    },
    'pointer/before.json': {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        previewId: 'hpa-233',
        productionPointer: {
            exists: true,
            releaseId: `sha256-${'e'.repeat(64)}`,
            manifestSha256: 'f'.repeat(64),
        },
    },
    'pointer/after.json': {
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
                publisherReportPath: 'publisher/report.json',
                browserEvidencePath: 'browser/result.json',
                webIdentityEvidencePath: 'web/identity.json',
                manualReviewPath: 'manual/review.json',
                workflowApprovalPath: 'workflow/approval.json',
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

    it('assembles retained immutable evidence for the Task 4 coordinator without a publisher store', async () => {
        const test = harness();
        const readEvidenceJson = vi.fn(async (_directory, path: string) => {
            const evidence = retainedEvidence[path];
            if (evidence === undefined) throw new Error(`Missing ${path}`);
            return evidence;
        });
        const createEvidenceReference = vi.fn(async (_directory, request) => ({
            ...request,
            sha256: 'd'.repeat(64),
        }));
        const runVisualNovelReleaseGate = vi.fn(async () =>
            parseVisualNovelReleaseGateReportV1(validGateReport)
        );

        const exit = await runReleaseGateCli([...verifyPreviewArgs, '--json'], {
            ...releaseGateDependencies(
                test.dependencies,
                vi.fn(async () => validGateReport)
            ),
            runVerifyPreview: undefined,
            readEvidenceJson,
            createEvidenceReference,
            runVisualNovelReleaseGate,
        } as ReleaseGateCliDependencies);

        expect(exit).toBe(0);
        expect(readEvidenceJson).toHaveBeenCalledTimes(11);
        expect(createEvidenceReference).toHaveBeenCalledTimes(11);
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
            })
        );
        expect(test.stdout().trim().split('\n')).toHaveLength(1);
        expect(test.stderr()).toBe('');
    });

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

    it.each(['assert-activation-ready', 'smoke-production'] as const)(
        'recognizes %s but safely reports its unavailable Task 11 service',
        async command => {
            const test = harness();

            const exit = await runReleaseGateCli(
                [command, '--json'],
                releaseGateDependencies(
                    test.dependencies,
                    vi.fn(async () => validGateReport)
                )
            );

            expect(exit).toBe(1);
            expect(test.stdout().trim().split('\n')).toHaveLength(1);
            expect(parseGateDiagnosticV1(JSON.parse(test.stdout()))).toEqual(
                expect.objectContaining({
                    code: 'configuration/service-unavailable',
                    stage: 'input',
                })
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
