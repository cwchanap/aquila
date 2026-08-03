import { describe, expect, it, vi } from 'vitest';

vi.mock('bun:ffi', () => ({
    FFIType: { i32: 5, ptr: 12 },
    dlopen: () => ({
        close: () => undefined,
        symbols: { close: () => 0, openat: () => -1 },
    }),
    ptr: (value: Uint8Array): Uint8Array => value,
}));

import type { PublisherReportV1 } from '../../publisher/report';
import { hashCanonicalEvidence } from '../evidence';
import type { PublicReleaseVerificationResultV1 } from '../schemas';
import {
    runVisualNovelReleaseGate,
    type BrowserEvidenceV1,
    type GateEvidenceBindingsV1,
    type GateRunnerDependencies,
    type ProductionPointerEvidenceV1,
    type R2CandidateEvidenceV1,
    type RunVisualNovelReleaseGateInputV1,
} from '../gate-runner';

const RELEASE_ID = `sha256-${'a'.repeat(64)}`;
const MANIFEST_SHA256 = 'b'.repeat(64);
const COMMIT_SHA = 'c'.repeat(40);
const SCENARIO_SHA256 = 'd'.repeat(64);
const PREVIEW_TARGET = { kind: 'preview', previewId: 'hpa-233' } as const;

function publisherReport(): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: 'publish',
        status: 'success',
        storyId: 'the_seventh_mirror',
        target: { kind: 'production' },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
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
}

function r2Candidate(): R2CandidateEvidenceV1 {
    return {
        schemaVersion: 1,
        status: 'passed',
        depth: 'deep',
        storyId: 'the_seventh_mirror',
        target: { kind: 'production' },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
    };
}

function publicVerification(
    mode: 'candidate' | 'active'
): PublicReleaseVerificationResultV1 {
    return {
        schemaVersion: 1,
        status: 'passed' as const,
        mode,
        storyId: 'the_seventh_mirror',
        target: PREVIEW_TARGET,
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        checks: [{ id: 'manifest.fetch', status: 'passed' as const }],
        diagnostics: [],
    };
}

function browserEvidence(): BrowserEvidenceV1 {
    return {
        schemaVersion: 1,
        status: 'passed',
        storyId: 'the_seventh_mirror',
        target: PREVIEW_TARGET,
        previewId: 'hpa-233',
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        scenarioSha256: SCENARIO_SHA256,
    };
}

function productionPointerEvidence(): ProductionPointerEvidenceV1 {
    return {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        previewId: 'hpa-233',
        productionPointer: {
            exists: true,
            releaseId: `sha256-${'e'.repeat(64)}`,
            manifestSha256: 'f'.repeat(64),
        },
    };
}

type FixtureInput = Omit<RunVisualNovelReleaseGateInputV1, 'evidence'>;

function fixtureInput(): FixtureInput {
    return {
        identity: {
            storyId: 'the_seventh_mirror',
            target: PREVIEW_TARGET,
            previewId: 'hpa-233',
            releaseId: RELEASE_ID,
            manifestSha256: MANIFEST_SHA256,
            commitSha: COMMIT_SHA,
            scenarioSha256: SCENARIO_SHA256,
        },
        evidenceDir: '/retained/evidence',
        tier1: {
            schemaVersion: 1,
            commitSha: COMMIT_SHA,
            lockfileSha256: '1'.repeat(64),
            bunVersion: '1.3.1',
            nodeVersion: '22.10.0',
            playwrightVersion: '1.55.0',
            commandSetVersion: 1,
            browserMatrix: ['chromium', 'mobile-chrome'],
            status: 'passed',
            completedAt: '2026-08-03T12:00:00.000Z',
        },
        publisherReport: publisherReport(),
        r2Candidate: r2Candidate(),
        publicCandidate: publicVerification('candidate'),
        publicActiveRelease: publicVerification('active'),
        webIdentity: {
            schemaVersion: 1,
            target: 'preview',
            webBaseUrl: 'https://preview.aquila.example',
            assetEnvironment: 'preview',
            previewId: 'hpa-233',
            releaseId: RELEASE_ID,
            manifestSha256: MANIFEST_SHA256,
            pointerRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/current.json',
            manifestRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/releases/runtime-manifest.json',
        },
        browserEvidence: browserEvidence(),
        manualReview: {
            schemaVersion: 1,
            storyId: 'the_seventh_mirror',
            previewId: 'hpa-233',
            releaseId: RELEASE_ID,
            manifestSha256: MANIFEST_SHA256,
            scenarioSha256: SCENARIO_SHA256,
            reviewedAt: '2026-08-03T12:00:00.000Z',
            reviewer: 'release-reviewer',
            decision: 'approved',
            includedCount: 2,
            omittedCount: 1,
            representativeRoutes: ['/en/stories/the_seventh_mirror'],
            notes: ['Reviewed preview candidate.'],
        },
        workflowApproval: {
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
        productionPointerBefore: productionPointerEvidence(),
        productionPointerAfter: productionPointerEvidence(),
    };
}

function evidenceBindings(input: FixtureInput): GateEvidenceBindingsV1 {
    const reference = (
        id: string,
        kind: GateEvidenceBindingsV1[keyof GateEvidenceBindingsV1]['kind'],
        value: unknown
    ) => ({
        id,
        kind,
        path: `${id}/result.json`,
        sha256: hashCanonicalEvidence(value),
        mediaType: 'application/json' as const,
    });
    return {
        deterministicCi: reference('ci', 'ci-result', input.tier1),
        publisherCandidate: reference(
            'publisher',
            'publisher-report',
            input.publisherReport
        ),
        r2Candidate: reference('r2', 'r2-verification', input.r2Candidate),
        publicCandidate: reference(
            'public-candidate',
            'public-verification',
            input.publicCandidate
        ),
        publicActiveRelease: reference(
            'public-active',
            'public-verification',
            input.publicActiveRelease
        ),
        webIdentity: reference('web', 'web-identity', input.webIdentity),
        browserFlows: reference(
            'browser',
            'playwright-result',
            input.browserEvidence
        ),
        manualReview: reference('manual', 'manual-review', input.manualReview),
        workflowApproval: reference(
            'workflow',
            'workflow-approval',
            input.workflowApproval
        ),
        productionPointerBefore: reference(
            'pointer-before',
            'pointer-snapshot',
            input.productionPointerBefore
        ),
        productionPointerAfter: reference(
            'pointer-after',
            'pointer-snapshot',
            input.productionPointerAfter
        ),
    };
}

function fixtureGateInput(
    overrides: Partial<FixtureInput> = {}
): RunVisualNovelReleaseGateInputV1 {
    const input = { ...fixtureInput(), ...overrides };
    return { ...input, evidence: evidenceBindings(input) };
}

function allEvidence(input: RunVisualNovelReleaseGateInputV1) {
    return Object.values(input.evidence);
}

function fixtureDependencies(
    input: RunVisualNovelReleaseGateInputV1
): Partial<GateRunnerDependencies> {
    return {
        now: () => new Date('2026-08-03T13:00:00.000Z'),
        createEvidenceReference: async (_directory, request) => {
            const reference = allEvidence(input).find(
                candidate => candidate.id === request.id
            );
            if (reference === undefined) throw new Error('missing evidence');
            return reference;
        },
    };
}

async function runFixture(input = fixtureGateInput()) {
    return runVisualNovelReleaseGate(input, fixtureDependencies(input));
}

describe('visual novel release gate runner', () => {
    it('binds every retained artifact into a deterministic passing report', async () => {
        const input = fixtureGateInput();
        const report = await runFixture(input);

        expect(report.diagnostics).toEqual([]);
        expect(report.status).toBe('passed');
        expect(report.createdAt).toBe('2026-08-03T13:00:00.000Z');
        expect(report.manualReviewSha256).toBe(
            hashCanonicalEvidence(input.manualReview)
        );
        expect(
            Object.values(report.checks).every(
                check => check.status === 'passed'
            )
        ).toBe(true);
        expect(report.evidence).toEqual(allEvidence(input));
    });

    it.each([
        [
            'web release',
            'webIdentity',
            { releaseId: `sha256-${'0'.repeat(64)}` },
        ],
        ['manual checksum', 'manualReview', { manifestSha256: '0'.repeat(64) }],
        ['workflow environment', 'workflowApproval', { environment: 'other' }],
    ] as const)(
        'fails %s mismatch at evidence-binding',
        async (_label, key, patch) => {
            const baseline = fixtureGateInput();
            const input = fixtureGateInput({
                [key]: { ...baseline[key], ...patch },
            });
            const report = await runFixture(input);

            expect(report.status).toBe('failed');
            expect(report.diagnostics).toContainEqual(
                expect.objectContaining({ stage: 'evidence-binding' })
            );
        }
    );

    it('marks later checks not-run after a candidate report failure', async () => {
        const input = fixtureGateInput({
            publisherReport: { ...publisherReport(), command: 'activate' },
        });
        const report = await runFixture(input);

        expect(report.checks.publisherCandidate.status).toBe('failed');
        expect(report.checks.deterministicCi.status).toBe('not-run');
        expect(report.checks.productionPointerUnchanged.status).toBe('not-run');
        expect(report.diagnostics).toContainEqual(
            expect.objectContaining({ stage: 'publisher-candidate' })
        );
    });

    it('classifies malformed retained publisher JSON at publisher-candidate', async () => {
        const input = fixtureGateInput({
            publisherReport: {
                ...publisherReport(),
                counts: { ...publisherReport().counts, included: -1 },
            },
        });

        const report = await runFixture(input);

        expect(report.checks.publisherCandidate.status).toBe('failed');
        expect(report.diagnostics).toContainEqual(
            expect.objectContaining({ stage: 'publisher-candidate' })
        );
    });

    it('rejects an evidence reference whose digest does not match retained bytes', async () => {
        const input = fixtureGateInput();
        input.evidence.webIdentity = {
            ...input.evidence.webIdentity,
            sha256: '0'.repeat(64),
        };

        const report = await runFixture(input);

        expect(report.checks.webIdentity.status).toBe('failed');
        expect(report.checks.browserFlows.status).toBe('not-run');
        expect(report.diagnostics).toContainEqual(
            expect.objectContaining({
                stage: 'evidence-binding',
                evidenceId: 'web',
            })
        );
    });

    it('rejects duplicate retained evidence ids before binding artifacts', async () => {
        const input = fixtureGateInput();
        input.evidence.workflowApproval = {
            ...input.evidence.workflowApproval,
            id: input.evidence.manualReview.id,
        };

        const report = await runFixture(input);

        expect(report.status).toBe('failed');
        expect(report.diagnostics).toContainEqual(
            expect.objectContaining({ stage: 'evidence-binding' })
        );
    });
});
