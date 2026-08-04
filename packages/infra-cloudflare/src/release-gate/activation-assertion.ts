import {
    isReleaseId,
    isSha256,
    isStoryId,
} from '@aquila/stories/runtime-assets';
import {
    hashCanonicalEvidence,
    type CreateEvidenceReferenceInputV1,
    readValidatedJsonEvidence,
    type ValidatedJsonEvidenceV1,
} from './evidence';
import { parseProductionPointerEvidenceV1 } from './gate-runner';
import {
    assertVisualReviewMatchesIdentity,
    parseVisualNovelReleaseGateReportV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    type GateEvidenceReferenceV1,
    type VisualNovelReleaseGateReportV1,
} from './schemas';

export type ActivationReadyIdentityV1 = {
    storyId: string;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
};

export type AssertActivationReadyInputV1 = {
    evidenceDir: string;
    report: unknown;
    expected: ActivationReadyIdentityV1;
};

export type ActivationReadyResultV1 = { status: 'passed' };

export type ActivationAssertionDependencies = {
    readValidatedJsonEvidence: (
        evidenceDirectory: string,
        input: CreateEvidenceReferenceInputV1
    ) => Promise<ValidatedJsonEvidenceV1>;
};

export class ActivationAssertionError extends Error {
    constructor(readonly code: string) {
        super('Activation readiness assertion failed');
        this.name = 'ActivationAssertionError';
    }
}

type RequiredCheck = keyof VisualNovelReleaseGateReportV1['checks'];

const CHECK_EVIDENCE_KINDS: Readonly<
    Record<RequiredCheck, readonly GateEvidenceReferenceV1['kind'][]>
> = {
    deterministicCi: ['ci-result'],
    publisherCandidate: ['publisher-report'],
    r2Candidate: ['r2-verification'],
    publicCandidate: ['public-verification'],
    publicActiveRelease: ['public-verification'],
    webIdentity: ['web-identity'],
    browserFlows: ['playwright-result'],
    manualReview: ['manual-review'],
    workflowApproval: ['workflow-approval'],
    productionPointerUnchanged: ['pointer-snapshot', 'pointer-snapshot'],
};

function assertionError(code: string): never {
    throw new ActivationAssertionError(code);
}

function assertExpectedIdentity(identity: ActivationReadyIdentityV1): void {
    if (
        !isStoryId(identity.storyId) ||
        !isReleaseId(identity.releaseId) ||
        !isSha256(identity.manifestSha256) ||
        identity.commitSha.trim().length === 0
    ) {
        assertionError('input/identity');
    }
}

function assertReportIdentity(
    report: VisualNovelReleaseGateReportV1,
    expected: ActivationReadyIdentityV1
): void {
    if (
        report.status !== 'passed' ||
        report.target.kind !== 'preview' ||
        report.storyId !== expected.storyId ||
        report.releaseId !== expected.releaseId ||
        report.manifestSha256 !== expected.manifestSha256 ||
        report.commitSha !== expected.commitSha
    ) {
        assertionError('activation-target/report-identity-mismatch');
    }
}

function parseFinalReport(input: unknown): VisualNovelReleaseGateReportV1 {
    try {
        return parseVisualNovelReleaseGateReportV1(input);
    } catch {
        return assertionError('evidence-binding/report-invalid');
    }
}

function referencesByCheck(
    report: VisualNovelReleaseGateReportV1
): Map<RequiredCheck, GateEvidenceReferenceV1[]> {
    const byId = new Map<string, GateEvidenceReferenceV1>();
    for (const reference of report.evidence) {
        if (byId.has(reference.id)) {
            assertionError('evidence-binding/duplicate-id');
        }
        byId.set(reference.id, reference);
    }

    const usedIds = new Set<string>();
    const references = new Map<RequiredCheck, GateEvidenceReferenceV1[]>();
    for (const [checkId, expectedKinds] of Object.entries(
        CHECK_EVIDENCE_KINDS
    ) as [RequiredCheck, readonly GateEvidenceReferenceV1['kind'][]][]) {
        const check = report.checks[checkId];
        if (
            check.status !== 'passed' ||
            check.evidenceIds.length !== expectedKinds.length
        ) {
            assertionError(`evidence-binding/${checkId}`);
        }
        const checkReferences = check.evidenceIds.map(id => {
            const reference = byId.get(id);
            if (reference === undefined || usedIds.has(id)) {
                assertionError('evidence-binding/check-reference');
            }
            usedIds.add(id);
            return reference;
        });
        if (
            checkReferences.some(
                (reference, index) =>
                    reference.kind !== expectedKinds[index] ||
                    reference.mediaType !== 'application/json'
            )
        ) {
            assertionError('evidence-binding/check-kind');
        }
        references.set(checkId, checkReferences);
    }

    if (usedIds.size !== byId.size) {
        assertionError('evidence-binding/unreferenced-artifact');
    }
    return references;
}

function resolveDependencies(
    dependencies: Partial<ActivationAssertionDependencies> | undefined
): ActivationAssertionDependencies {
    return {
        readValidatedJsonEvidence:
            dependencies?.readValidatedJsonEvidence ??
            readValidatedJsonEvidence,
    };
}

function assertReferenceMatches(
    expected: GateEvidenceReferenceV1,
    actual: GateEvidenceReferenceV1
): void {
    if (
        actual.id !== expected.id ||
        actual.kind !== expected.kind ||
        actual.path !== expected.path ||
        actual.mediaType !== expected.mediaType ||
        actual.sha256 !== expected.sha256
    ) {
        assertionError('evidence-binding/digest-mismatch');
    }
}

async function readBoundEvidence(
    evidenceDir: string,
    report: VisualNovelReleaseGateReportV1,
    dependencies: ActivationAssertionDependencies
): Promise<Map<string, unknown>> {
    const values = new Map<string, unknown>();
    for (const reference of report.evidence) {
        try {
            const actual = await dependencies.readValidatedJsonEvidence(
                evidenceDir,
                {
                    id: reference.id,
                    kind: reference.kind,
                    path: reference.path,
                    mediaType: reference.mediaType,
                }
            );
            assertReferenceMatches(reference, actual.reference);
            values.set(reference.id, actual.value);
        } catch (error) {
            if (error instanceof ActivationAssertionError) throw error;
            assertionError('evidence-binding/unreadable-artifact');
        }
    }
    return values;
}

function liveWorkflowReferenceIsTrusted(
    workflowRef: string,
    repository: string
): boolean {
    return (
        workflowRef ===
        `${repository}/.github/workflows/visual-novel-release-live.yml@refs/heads/main`
    );
}

function validateSemanticEvidence(
    report: VisualNovelReleaseGateReportV1,
    references: Map<RequiredCheck, GateEvidenceReferenceV1[]>,
    values: Map<string, unknown>
): void {
    const getValue = (check: RequiredCheck, index = 0) => {
        const reference = references.get(check)?.[index];
        if (reference === undefined) assertionError('evidence-binding/missing');
        if (!values.has(reference.id)) {
            assertionError('evidence-binding/unreadable-artifact');
        }
        return values.get(reference.id);
    };

    try {
        const manualReview = parseVisualReviewRecordV1(
            getValue('manualReview')
        );
        assertVisualReviewMatchesIdentity(manualReview, report);
        if (hashCanonicalEvidence(manualReview) !== report.manualReviewSha256) {
            assertionError('evidence-binding/manual-review-digest');
        }

        const workflowApproval = parseWorkflowApprovalEvidenceV1(
            getValue('workflowApproval')
        );
        if (
            workflowApproval.environment !== 'visual-novel-release-approval' ||
            workflowApproval.conclusion !== 'success' ||
            !liveWorkflowReferenceIsTrusted(
                workflowApproval.workflowRef,
                workflowApproval.repository
            )
        ) {
            assertionError('workflow-approval/untrusted');
        }

        const webIdentity = parseWebIdentityEvidenceV1(getValue('webIdentity'));
        if (
            webIdentity.target !== 'preview' ||
            webIdentity.assetEnvironment !== 'preview' ||
            webIdentity.previewId !== report.previewId ||
            webIdentity.releaseId !== report.releaseId ||
            webIdentity.manifestSha256 !== report.manifestSha256
        ) {
            assertionError('web-identity/mismatch');
        }

        const before = parseProductionPointerEvidenceV1(
            getValue('productionPointerUnchanged', 0)
        );
        const after = parseProductionPointerEvidenceV1(
            getValue('productionPointerUnchanged', 1)
        );
        if (
            before.storyId !== report.storyId ||
            after.storyId !== report.storyId ||
            before.previewId !== report.previewId ||
            after.previewId !== report.previewId ||
            hashCanonicalEvidence(before.productionPointer) !==
                hashCanonicalEvidence(after.productionPointer)
        ) {
            assertionError('production-pointer-proof/mismatch');
        }
    } catch (error) {
        if (error instanceof ActivationAssertionError) throw error;
        assertionError('evidence-binding/semantic-artifact-invalid');
    }
}

/**
 * Read-only authorization check for the already retained final gate report.
 * It deliberately has no publisher, R2, or pointer mutation dependency.
 */
export async function assertActivationReady(
    input: AssertActivationReadyInputV1,
    suppliedDependencies: Partial<ActivationAssertionDependencies> = {}
): Promise<ActivationReadyResultV1> {
    assertExpectedIdentity(input.expected);
    const report = parseFinalReport(input.report);
    assertReportIdentity(report, input.expected);
    const references = referencesByCheck(report);
    const dependencies = resolveDependencies(suppliedDependencies);
    const values = await readBoundEvidence(
        input.evidenceDir,
        report,
        dependencies
    );
    validateSemanticEvidence(report, references, values);
    return { status: 'passed' };
}
