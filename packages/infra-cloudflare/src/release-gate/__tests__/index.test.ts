import { describe, expect, it, vi } from 'vitest';

const imports = vi.hoisted(() => ({
    cli: false,
    evidence: false,
    gateRunner: false,
    publicReleaseVerifier: false,
    publisherActivation: false,
    publisherCli: false,
    r2Store: false,
}));

vi.mock('../cli', () => {
    imports.cli = true;
    return { runReleaseGateCli: vi.fn() };
});

vi.mock('../evidence', () => {
    imports.evidence = true;
    return { createEvidenceReference: vi.fn() };
});

vi.mock('../gate-runner', () => {
    imports.gateRunner = true;
    return { runVisualNovelReleaseGate: vi.fn() };
});

vi.mock('../public-release-verifier', () => {
    imports.publicReleaseVerifier = true;
    return { verifyPublicRelease: vi.fn() };
});

vi.mock('../../publisher/activation', () => {
    imports.publisherActivation = true;
    return { activateStoredRelease: vi.fn() };
});

vi.mock('../../publisher/cli', () => {
    imports.publisherCli = true;
    return { runAssetsCli: vi.fn() };
});

vi.mock('../../publisher/stores/r2-delivery-store', () => {
    imports.r2Store = true;
    return { R2DeliveryStore: vi.fn() };
});

import * as releaseGate from '../index';

describe('public release-gate package boundary', () => {
    it('exports only strict parsers and semantic wire validators', () => {
        expect(Object.keys(releaseGate).sort()).toEqual([
            'assertVisualReviewMatchesIdentity',
            'parseGateCheckV1',
            'parseGateDiagnosticV1',
            'parseGateEvidenceReferenceV1',
            'parsePublicReleaseVerificationInputV1',
            'parsePublicReleaseVerificationResultV1',
            'parsePublicVerificationCheckV1',
            'parsePublicationTargetV1',
            'parseTier1EvidenceV1',
            'parseVisualNovelGateScenarioV1',
            'parseVisualNovelReleaseGateReportV1',
            'parseVisualReviewRecordV1',
            'parseWebIdentityEvidenceV1',
            'parseWorkflowApprovalEvidenceV1',
        ]);
    });

    it('does not load runtime gate services from the E2E-facing subpath', () => {
        expect(imports).toEqual({
            cli: false,
            evidence: false,
            gateRunner: false,
            publicReleaseVerifier: false,
            publisherActivation: false,
            publisherCli: false,
            r2Store: false,
        });
    });
});
