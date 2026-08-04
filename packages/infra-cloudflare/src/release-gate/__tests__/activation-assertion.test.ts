import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('bun:ffi', () => ({
    FFIType: { i32: 5, ptr: 12 },
    dlopen: () => ({
        close: () => undefined,
        symbols: { close: () => 0, openat: () => -1 },
    }),
    ptr: (value: Uint8Array): Uint8Array => value,
}));

import { hashCanonicalEvidence } from '../evidence';
import {
    assertActivationReady,
    type AssertActivationReadyInputV1,
    type ActivationAssertionDependencies,
} from '../activation-assertion';

const RELEASE_ID = `sha256-${'a'.repeat(64)}`;
const MANIFEST_SHA256 = 'b'.repeat(64);
const COMMIT_SHA = 'c'.repeat(40);
const SCENARIO_SHA256 = 'd'.repeat(64);
const PREVIEW_ID = 'hpa-233';
const STORY_ID = 'the_seventh_mirror';

type FixtureArtifacts = Record<string, unknown>;

function fixtureArtifacts(): FixtureArtifacts {
    return {
        'ci/result.json': { status: 'retained' },
        'publisher/report.json': { status: 'retained' },
        'r2/result.json': { status: 'retained' },
        'public/candidate.json': { status: 'retained' },
        'public/active.json': { status: 'retained' },
        'web/identity.json': {
            schemaVersion: 1,
            target: 'preview',
            webBaseUrl: 'https://preview.aquila.example',
            assetEnvironment: 'preview',
            previewId: PREVIEW_ID,
            releaseId: RELEASE_ID,
            manifestSha256: MANIFEST_SHA256,
            pointerRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/current.json',
            manifestRequestUrl:
                'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/releases/runtime-manifest.json',
        },
        'browser/result.json': { status: 'retained' },
        'manual/review.json': {
            schemaVersion: 1,
            storyId: STORY_ID,
            previewId: PREVIEW_ID,
            releaseId: RELEASE_ID,
            manifestSha256: MANIFEST_SHA256,
            scenarioSha256: SCENARIO_SHA256,
            reviewedAt: '2026-08-03T12:00:00.000Z',
            reviewer: 'release-reviewer',
            decision: 'approved',
            includedCount: 2,
            omittedCount: 1,
            representativeRoutes: ['/en/reader?story=the_seventh_mirror'],
            notes: ['Reviewed the protected preview.'],
        },
        'workflow/approval.json': {
            schemaVersion: 1,
            repository: 'hapadona/aquila',
            workflowRef:
                'hapadona/aquila/.github/workflows/visual-novel-release-live.yml@refs/heads/main',
            runId: 123456,
            runAttempt: 1,
            jobId: 'finalize-live',
            actor: 'release-reviewer',
            environment: 'visual-novel-release-approval',
            conclusion: 'success',
        },
        'pointer/before.json': {
            schemaVersion: 1,
            storyId: STORY_ID,
            previewId: PREVIEW_ID,
            productionPointer: {
                exists: true,
                releaseId: `sha256-${'e'.repeat(64)}`,
                manifestSha256: 'f'.repeat(64),
            },
        },
        'pointer/after.json': {
            schemaVersion: 1,
            storyId: STORY_ID,
            previewId: PREVIEW_ID,
            productionPointer: {
                exists: true,
                releaseId: `sha256-${'e'.repeat(64)}`,
                manifestSha256: 'f'.repeat(64),
            },
        },
    };
}

function fixtureInput(
    patch: Partial<{
        reportStatus: 'passed' | 'failed';
        expectedReleaseId: string;
        evidenceDigestOverride: string;
    }> = {}
): {
    input: AssertActivationReadyInputV1;
    dependencies: Partial<ActivationAssertionDependencies>;
} {
    const artifacts = fixtureArtifacts();
    const reference = (
        id: string,
        kind:
            | 'ci-result'
            | 'publisher-report'
            | 'r2-verification'
            | 'public-verification'
            | 'web-identity'
            | 'playwright-result'
            | 'manual-review'
            | 'workflow-approval'
            | 'pointer-snapshot',
        path: string
    ) => ({
        id,
        kind,
        path,
        sha256: hashCanonicalEvidence(artifacts[path]),
        mediaType: 'application/json',
    });
    const evidence = [
        reference('ci', 'ci-result', 'ci/result.json'),
        reference('publisher', 'publisher-report', 'publisher/report.json'),
        reference('r2', 'r2-verification', 'r2/result.json'),
        reference(
            'public-candidate',
            'public-verification',
            'public/candidate.json'
        ),
        reference('public-active', 'public-verification', 'public/active.json'),
        reference('web', 'web-identity', 'web/identity.json'),
        reference('browser', 'playwright-result', 'browser/result.json'),
        reference('manual', 'manual-review', 'manual/review.json'),
        reference('workflow', 'workflow-approval', 'workflow/approval.json'),
        reference('pointer-before', 'pointer-snapshot', 'pointer/before.json'),
        reference('pointer-after', 'pointer-snapshot', 'pointer/after.json'),
    ];
    const report = {
        schemaVersion: 1,
        status: patch.reportStatus ?? 'passed',
        storyId: STORY_ID,
        target: { kind: 'preview', previewId: PREVIEW_ID },
        previewId: PREVIEW_ID,
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        commitSha: COMMIT_SHA,
        scenarioSha256: SCENARIO_SHA256,
        manualReviewSha256: hashCanonicalEvidence(
            artifacts['manual/review.json']
        ),
        createdAt: '2026-08-03T13:00:00.000Z',
        checks: {
            deterministicCi: { status: 'passed', evidenceIds: ['ci'] },
            publisherCandidate: {
                status: 'passed',
                evidenceIds: ['publisher'],
            },
            r2Candidate: { status: 'passed', evidenceIds: ['r2'] },
            publicCandidate: {
                status: 'passed',
                evidenceIds: ['public-candidate'],
            },
            publicActiveRelease: {
                status: 'passed',
                evidenceIds: ['public-active'],
            },
            webIdentity: { status: 'passed', evidenceIds: ['web'] },
            browserFlows: { status: 'passed', evidenceIds: ['browser'] },
            manualReview: { status: 'passed', evidenceIds: ['manual'] },
            workflowApproval: {
                status: 'passed',
                evidenceIds: ['workflow'],
            },
            productionPointerUnchanged: {
                status: 'passed',
                evidenceIds: ['pointer-before', 'pointer-after'],
            },
        },
        evidence,
        diagnostics: [],
    };

    return {
        input: {
            evidenceDir: '/retained/evidence',
            report,
            expected: {
                storyId: STORY_ID,
                releaseId: patch.expectedReleaseId ?? RELEASE_ID,
                manifestSha256: MANIFEST_SHA256,
                commitSha: COMMIT_SHA,
            },
        },
        dependencies: {
            readEvidenceJson: async (_directory, path) => artifacts[path],
            createEvidenceReference: async (_directory, input) => ({
                ...input,
                sha256:
                    patch.evidenceDigestOverride !== undefined &&
                    input.id === 'web'
                        ? patch.evidenceDigestOverride
                        : hashCanonicalEvidence(artifacts[input.path]),
            }),
        },
    };
}

describe('activation readiness assertion', () => {
    it('accepts only a passing report with matching retained evidence', async () => {
        const { input, dependencies } = fixtureInput();

        await expect(
            assertActivationReady(input, dependencies)
        ).resolves.toEqual({ status: 'passed' });
    });

    it.each([
        ['a failed report', { reportStatus: 'failed' as const }],
        [
            'a different requested release',
            { expectedReleaseId: `sha256-${'f'.repeat(64)}` },
        ],
        [
            'a tampered retained digest',
            { evidenceDigestOverride: '0'.repeat(64) },
        ],
    ])('rejects %s before any activation boundary', async (_label, patch) => {
        const { input, dependencies } = fixtureInput(patch);

        await expect(
            assertActivationReady(input, dependencies)
        ).rejects.toThrow();
    });

    it('maps a malformed final report into the assertion taxonomy', async () => {
        const { input, dependencies } = fixtureInput();

        await expect(
            assertActivationReady({ ...input, report: {} }, dependencies)
        ).rejects.toMatchObject({ code: 'evidence-binding/report-invalid' });
    });

    it('has no publisher activation import or mutation dependency', () => {
        const source = readFileSync(
            new URL('../activation-assertion.ts', import.meta.url),
            'utf8'
        );

        expect(source).not.toMatch(/from ['"][^'"]*publisher\/activation['"]/);
        expect(source).not.toMatch(/from ['"][^'"]*publisher\/stores\//);
    });
});
