import { describe, expect, it } from 'vitest';
import { GATE_STAGES } from '../diagnostics';
import {
    assertVisualReviewMatchesIdentity,
    parseGateDiagnosticV1,
    parsePublicReleaseVerificationInputV1,
    parsePublicReleaseVerificationResultV1,
    parseTier1EvidenceV1,
    parseVisualNovelGateScenarioV1,
    parseVisualNovelReleaseGateReportV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
} from '../schemas';
import {
    otherValidReleaseId,
    validGateIdentity,
    validGateReport,
    validGateScenario,
    validManualReview,
    validPublicVerificationResult,
    validTier1Evidence,
    validWebIdentityEvidence,
    validWorkflowApproval,
} from '../__fixtures__/valid-evidence';

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
