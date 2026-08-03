import { describe, expect, it } from 'vitest';
import { GATE_STAGES } from '../diagnostics';
import {
    assertVisualReviewMatchesIdentity,
    parseBrowserEvidenceV1,
    parseGateDiagnosticV1,
    parsePublicReleaseVerificationInputV1,
    parsePublicReleaseVerificationResultV1,
    parseTier1EvidenceV1,
    parseVisualNovelGateScenarioV1,
    parseVisualNovelReleaseGateReportV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    type BrowserEvidenceV1,
} from '../schemas';
import {
    otherValidReleaseId,
    validGateIdentity,
    validGateReport,
    validGateScenario,
    validBrowserEvidence,
    validManualReview,
    validPublicVerificationResult,
    validTier1Evidence,
    validWebIdentityEvidence,
    validWorkflowApproval,
} from '../__fixtures__/valid-evidence';

function browserEvidenceClone(): BrowserEvidenceV1 {
    return structuredClone(
        validBrowserEvidence
    ) as unknown as BrowserEvidenceV1;
}

describe('VisualNovelReleaseGateReportV1', () => {
    it('accepts every required check and evidence kind', () => {
        expect(parseVisualNovelReleaseGateReportV1(validGateReport)).toEqual(
            validGateReport
        );
    });

    it('rejects unknown checks and evidence kinds', () => {
        expect(() =>
            parseVisualNovelReleaseGateReportV1({
                ...validGateReport,
                checks: {
                    ...validGateReport.checks,
                    extra: validGateReport.checks.webIdentity,
                },
            })
        ).toThrow();
        expect(() =>
            parseVisualNovelReleaseGateReportV1({
                ...validGateReport,
                evidence: [
                    ...validGateReport.evidence,
                    {
                        id: 'unknown',
                        kind: 'unknown-evidence',
                        path: 'unknown/result.json',
                        sha256: 'f'.repeat(64),
                        mediaType: 'application/json',
                    },
                ],
            })
        ).toThrow();
    });

    it('requires every final check to pass when the report passes', () => {
        expect(() =>
            parseVisualNovelReleaseGateReportV1({
                ...validGateReport,
                checks: {
                    ...validGateReport.checks,
                    browserFlows: {
                        status: 'not-run',
                        evidenceIds: [],
                    },
                },
            })
        ).toThrow();
    });
});

describe('WorkflowApprovalEvidenceV1', () => {
    it('requires the protected environment and successful conclusion', () => {
        expect(parseWorkflowApprovalEvidenceV1(validWorkflowApproval)).toEqual(
            validWorkflowApproval
        );
        expect(() =>
            parseWorkflowApprovalEvidenceV1({
                ...validWorkflowApproval,
                environment: 'unprotected',
            })
        ).toThrow();
        expect(() =>
            parseWorkflowApprovalEvidenceV1({
                ...validWorkflowApproval,
                conclusion: 'failure',
            })
        ).toThrow();
    });
});

describe('VisualReviewRecordV1', () => {
    it.each([
        ['preview id', { previewId: 'other-preview' }],
        ['release id', { releaseId: otherValidReleaseId }],
        ['checksum', { manifestSha256: '0'.repeat(64) }],
    ])('rejects mismatched %s in manual review binding', (_label, patch) => {
        const review = { ...validManualReview, ...patch };
        const parsedReview = parseVisualReviewRecordV1(review);
        expect(() =>
            assertVisualReviewMatchesIdentity(parsedReview, validGateIdentity)
        ).toThrow();
    });

    it('rejects an invalid release id during parsing', () => {
        expect(() =>
            parseVisualReviewRecordV1({
                ...validManualReview,
                releaseId: 'rel_other',
            })
        ).toThrow();
    });

    it('requires an approved review for authorization binding', () => {
        const review = parseVisualReviewRecordV1({
            ...validManualReview,
            decision: 'rejected',
        });
        expect(() =>
            assertVisualReviewMatchesIdentity(review, validGateIdentity)
        ).toThrow();
    });
});

describe('VisualNovelGateScenarioV1', () => {
    it('rejects unknown and missing position fields', () => {
        expect(parseVisualNovelGateScenarioV1(validGateScenario)).toEqual(
            validGateScenario
        );
        expect(() =>
            parseVisualNovelGateScenarioV1({
                ...validGateScenario,
                directOpen: { dialogueIndex: 1 },
            })
        ).toThrow();
        expect(() =>
            parseVisualNovelGateScenarioV1({
                ...validGateScenario,
                transition: {
                    ...validGateScenario.transition,
                    extra: true,
                },
            })
        ).toThrow();
    });

    it('requires sorted exact deployed unrelated-story chunk pathnames', () => {
        const scenario = {
            ...validGateScenario,
            unrelatedStoryChunks: [
                '/_astro/train-adventure-collection-only.js',
                '/_astro/train-adventure-shared-collection-only.js',
            ],
        };

        expect(parseVisualNovelGateScenarioV1(scenario)).toEqual(scenario);
        expect(() =>
            parseVisualNovelGateScenarioV1({
                ...scenario,
                unrelatedStoryChunks: ['train_adventure'],
            })
        ).toThrow();
        expect(() =>
            parseVisualNovelGateScenarioV1({
                ...scenario,
                unrelatedStoryChunks: [
                    '/_astro/train-adventure-shared-collection-only.js',
                    '/_astro/train-adventure-collection-only.js',
                ],
            })
        ).toThrow();
        expect(() =>
            parseVisualNovelGateScenarioV1({
                ...scenario,
                unrelatedStoryChunks: [
                    '/_astro/train-adventure-collection-only.js',
                    '/_astro/train-adventure-collection-only.js',
                ],
            })
        ).toThrow();
    });
});

describe('BrowserEvidenceV1', () => {
    it('accepts one inline deterministic Desktop and Mobile Chrome aggregate', () => {
        expect(parseBrowserEvidenceV1(validBrowserEvidence)).toEqual(
            validBrowserEvidence
        );
    });

    it('rejects a string target and raw trace or request-secret fields', () => {
        const stringTarget = browserEvidenceClone();
        (stringTarget as { target: unknown }).target = 'preview';
        expect(() => parseBrowserEvidenceV1(stringTarget)).toThrow();

        const rawTrace = browserEvidenceClone();
        (rawTrace.projects[0] as { traces?: unknown }).traces = [
            'traces/retry.zip',
        ];
        expect(() => parseBrowserEvidenceV1(rawTrace)).toThrow();

        const requestSecrets = browserEvidenceClone();
        (
            requestSecrets.projects[0].requestPaths as {
                headers?: unknown;
            }
        ).headers = { authorization: 'secret' };
        expect(() => parseBrowserEvidenceV1(requestSecrets)).toThrow();

        const requestCookies = browserEvidenceClone();
        (
            requestCookies.projects[0].requestPaths as {
                cookies?: unknown;
            }
        ).cookies = ['session=secret'];
        expect(() => parseBrowserEvidenceV1(requestCookies)).toThrow();

        const signedUrl = browserEvidenceClone();
        signedUrl.projects[0].requestPaths.pointerRequestUrl =
            'https://assets.aquila.example/current.json?signature=secret';
        expect(() => parseBrowserEvidenceV1(signedUrl)).toThrow();
    });

    it.each([
        [
            'missing a required project',
            (evidence: any) => evidence.projects.pop(),
        ],
        [
            'contains an extra project',
            (evidence: any) =>
                evidence.projects.push({
                    ...evidence.projects[1],
                    project: 'release-gate-firefox',
                }),
        ],
        [
            'duplicates a project',
            (evidence: any) => (evidence.projects[1] = evidence.projects[0]),
        ],
        [
            'omits a required ordered case',
            (evidence: any) => evidence.projects[0].scenarioCases.pop(),
        ],
        [
            'contains an extra case',
            (evidence: any) =>
                evidence.projects[0].scenarioCases.push({
                    id: 'unexpected-case',
                    status: 'passed',
                }),
        ],
        [
            'duplicates a case',
            (evidence: any) =>
                (evidence.projects[0].scenarioCases[1] =
                    evidence.projects[0].scenarioCases[0]),
        ],
    ])('rejects an aggregate that %s', (_label, mutate) => {
        const evidence = browserEvidenceClone();
        mutate(evidence);
        expect(() => parseBrowserEvidenceV1(evidence)).toThrow();
    });

    it.each([
        [
            'project flow',
            (evidence: any) => (evidence.projects[0].flow = 'production-smoke'),
        ],
        [
            'project release',
            (evidence: any) =>
                (evidence.projects[0].releaseId = `sha256-${'f'.repeat(64)}`),
        ],
        [
            'project target',
            (evidence: any) =>
                (evidence.projects[0].target = { kind: 'production' }),
        ],
        [
            'unsafe screenshot path',
            (evidence: any) =>
                (evidence.projects[0].screenshots = ['../private.png']),
        ],
        [
            'credential-bearing pointer URL',
            (evidence: any) =>
                (evidence.projects[0].requestPaths.pointerRequestUrl =
                    'https://user:secret@assets.aquila.example/current.json'),
        ],
    ])('rejects %s drift from the aggregate identity', (_label, mutate) => {
        const evidence = browserEvidenceClone();
        mutate(evidence);
        expect(() => parseBrowserEvidenceV1(evidence)).toThrow();
    });

    it('accepts a complete failed aggregate without allowing it to masquerade as passed', () => {
        const evidence = browserEvidenceClone();
        evidence.status = 'failed';
        evidence.projects[0].status = 'failed';
        evidence.projects[0].scenarioCases[0].status = 'failed';

        expect(parseBrowserEvidenceV1(evidence)).toMatchObject({
            status: 'failed',
            projects: [
                { project: 'release-gate-chromium', status: 'failed' },
                { project: 'release-gate-mobile-chrome', status: 'passed' },
            ],
        });
    });
});

describe('PublicReleaseVerificationV1', () => {
    it('requires a candidate release and rejects an active override', () => {
        const candidate = {
            storyId: 'the_seventh_mirror',
            target: { kind: 'preview', previewId: 'hpa-233' },
            assetBaseUrl: 'https://assets.aquila.example',
            browserOrigin: 'https://preview.aquila.example',
            mode: 'candidate',
            releaseId: validGateReport.releaseId,
            expectedManifestSha256: validGateReport.manifestSha256,
            omittedIdentities: ['portrait:characters/mei/missing'],
        };

        expect(parsePublicReleaseVerificationInputV1(candidate)).toEqual(
            candidate
        );
        expect(() =>
            parsePublicReleaseVerificationInputV1({
                ...candidate,
                releaseId: undefined,
            })
        ).toThrow();
        expect(() =>
            parsePublicReleaseVerificationInputV1({
                ...candidate,
                mode: 'active',
            })
        ).toThrow();
    });

    it('parses a result with required observed identity', () => {
        expect(
            parsePublicReleaseVerificationResultV1(
                validPublicVerificationResult
            )
        ).toEqual(validPublicVerificationResult);
    });

    it.each([
        ['has no checks', []],
        [
            'contains a failed check',
            [{ id: 'object.integrity', status: 'failed' }],
        ],
    ])('rejects a passing result that %s', (_label, checks) => {
        expect(() =>
            parsePublicReleaseVerificationResultV1({
                ...validPublicVerificationResult,
                checks,
            })
        ).toThrow();
    });
});

describe('WebIdentityEvidenceV1', () => {
    it('requires a preview id only for preview evidence', () => {
        expect(parseWebIdentityEvidenceV1(validWebIdentityEvidence)).toEqual(
            validWebIdentityEvidence
        );
        expect(() =>
            parseWebIdentityEvidenceV1({
                ...validWebIdentityEvidence,
                previewId: undefined,
            })
        ).toThrow();
        expect(() =>
            parseWebIdentityEvidenceV1({
                ...validWebIdentityEvidence,
                target: 'production',
                assetEnvironment: 'production',
            })
        ).toThrow();
    });
});

describe('Tier1EvidenceV1', () => {
    it('locks the exact command set and browser matrix', () => {
        expect(parseTier1EvidenceV1(validTier1Evidence)).toEqual(
            validTier1Evidence
        );
        expect(() =>
            parseTier1EvidenceV1({
                ...validTier1Evidence,
                commandSetVersion: 2,
            })
        ).toThrow();
        expect(() =>
            parseTier1EvidenceV1({
                ...validTier1Evidence,
                browserMatrix: ['chromium'],
            })
        ).toThrow();
    });
});

describe('GateDiagnosticV1', () => {
    it('locks the exact stages and rejects unknown fields', () => {
        expect(GATE_STAGES).toContain('evidence-binding');
        expect(
            parseGateDiagnosticV1({
                code: 'input/invalid',
                stage: 'input',
                message: 'Input is invalid',
                identity: 'portrait:characters/mei/missing',
            })
        ).toEqual({
            code: 'input/invalid',
            stage: 'input',
            message: 'Input is invalid',
            identity: 'portrait:characters/mei/missing',
        });
        expect(() =>
            parseGateDiagnosticV1({
                code: 'input/invalid',
                stage: 'input',
                message: 'Input is invalid',
                privateDetail: 'do not retain',
            })
        ).toThrow();
    });
});
