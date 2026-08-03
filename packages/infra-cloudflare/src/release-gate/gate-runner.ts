import { z } from 'zod';
import {
    isPreviewId,
    isReleaseId,
    isSha256,
    isStoryId,
} from '@aquila/stories/runtime-assets';
import type { PublisherReportV1 } from '../publisher/report';
import {
    CandidateEvidenceError,
    type GateIdentityV1,
    validateCandidatePublisherEvidence,
} from './candidate-evidence';
import type { GateDiagnosticV1, GateStageV1 } from './diagnostics';
import {
    createEvidenceReference,
    hashCanonicalEvidence,
    type CreateEvidenceReferenceInputV1,
} from './evidence';
import {
    assertVisualReviewMatchesIdentity,
    parseBrowserEvidenceV1,
    gateEvidenceReferenceV1Schema,
    parseGateEvidenceReferenceV1,
    parsePublicReleaseVerificationResultV1,
    parseTier1EvidenceV1,
    parseVisualNovelReleaseGateReportV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    publicationTargetV1Schema,
    type BrowserEvidenceV1,
    type GateEvidenceReferenceV1,
    type PublicReleaseVerificationResultV1,
    type Tier1EvidenceV1,
    type VisualNovelReleaseGateReportV1,
    type VisualReviewRecordV1,
    type WebIdentityEvidenceV1,
    type WorkflowApprovalEvidenceV1,
} from './schemas';

type GateCheckId = keyof VisualNovelReleaseGateReportV1['checks'];

const r2CandidateEvidenceV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        status: z.enum(['passed', 'failed']),
        depth: z.literal('deep'),
        storyId: z.string().refine(isStoryId, {
            message: 'Story id is invalid',
        }),
        target: publicationTargetV1Schema,
        releaseId: z.string().refine(isReleaseId, {
            message: 'Release id is invalid',
        }),
        manifestSha256: z.string().refine(isSha256, {
            message: 'Manifest checksum is invalid',
        }),
    })
    .strict();
export type R2CandidateEvidenceV1 = z.infer<typeof r2CandidateEvidenceV1Schema>;

// The production pointer capture remains publisher-owned. The gate binds the
// retained production snapshot as opaque read-only evidence and compares the
// captured pointer value, not a reimplemented pointer schema.
const productionPointerEvidenceV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        storyId: z.string().refine(isStoryId, {
            message: 'Story id is invalid',
        }),
        previewId: z.string().refine(isPreviewId, {
            message: 'Preview id is invalid',
        }),
        productionPointer: z.unknown(),
    })
    .passthrough();
export type ProductionPointerEvidenceV1 = z.infer<
    typeof productionPointerEvidenceV1Schema
>;

export type GateEvidenceBindingsV1 = {
    deterministicCi: GateEvidenceReferenceV1;
    publisherCandidate: GateEvidenceReferenceV1;
    r2Candidate: GateEvidenceReferenceV1;
    publicCandidate: GateEvidenceReferenceV1;
    publicActiveRelease: GateEvidenceReferenceV1;
    webIdentity: GateEvidenceReferenceV1;
    browserFlows: GateEvidenceReferenceV1;
    manualReview: GateEvidenceReferenceV1;
    workflowApproval: GateEvidenceReferenceV1;
    productionPointerBefore: GateEvidenceReferenceV1;
    productionPointerAfter: GateEvidenceReferenceV1;
};

export type RunVisualNovelReleaseGateInputV1 = {
    identity: GateIdentityV1;
    evidenceDir: string;
    tier1: Tier1EvidenceV1;
    publisherReport: PublisherReportV1;
    r2Candidate: R2CandidateEvidenceV1;
    publicCandidate: PublicReleaseVerificationResultV1;
    publicActiveRelease: PublicReleaseVerificationResultV1;
    webIdentity: WebIdentityEvidenceV1;
    browserEvidence: BrowserEvidenceV1;
    manualReview: VisualReviewRecordV1;
    workflowApproval: WorkflowApprovalEvidenceV1;
    productionPointerBefore: ProductionPointerEvidenceV1;
    productionPointerAfter: ProductionPointerEvidenceV1;
    evidence: GateEvidenceBindingsV1;
};

export type GateRunnerDependencies = {
    now: () => Date;
    createEvidenceReference: (
        evidenceDirectory: string,
        input: CreateEvidenceReferenceInputV1
    ) => Promise<GateEvidenceReferenceV1>;
};

class GateRunnerError extends Error {
    constructor(
        readonly stage: GateStageV1,
        readonly code: string,
        readonly evidenceId?: string
    ) {
        super('Release gate validation failed');
        this.name = 'GateRunnerError';
    }
}

function gateError(
    stage: GateStageV1,
    code: string,
    evidenceId?: string
): never {
    throw new GateRunnerError(stage, code, evidenceId);
}

function bindingError(code: string, evidenceId?: string): never {
    return gateError('evidence-binding', code, evidenceId);
}

function parseR2CandidateEvidence(input: unknown): R2CandidateEvidenceV1 {
    return r2CandidateEvidenceV1Schema.parse(input);
}

function parseProductionPointerEvidence(
    input: unknown
): ProductionPointerEvidenceV1 {
    return productionPointerEvidenceV1Schema.parse(input);
}

function resolveDependencies(
    dependencies: Partial<GateRunnerDependencies> | undefined
): GateRunnerDependencies {
    return {
        now: dependencies?.now ?? (() => new Date()),
        createEvidenceReference:
            dependencies?.createEvidenceReference ?? createEvidenceReference,
    };
}

function assertGateIdentity(identity: GateIdentityV1): void {
    if (
        !isStoryId(identity.storyId) ||
        !isPreviewId(identity.previewId) ||
        !isReleaseId(identity.releaseId) ||
        !isSha256(identity.manifestSha256) ||
        !isSha256(identity.scenarioSha256) ||
        identity.commitSha.trim().length === 0
    ) {
        gateError('input', 'input/identity');
    }
    const target = publicationTargetV1Schema.safeParse(identity.target);
    if (
        !target.success ||
        target.data.kind !== 'preview' ||
        target.data.previewId !== identity.previewId
    ) {
        gateError('input', 'input/preview-target');
    }
}

function evidenceId(reference: unknown, fallback: string): string {
    return typeof reference === 'object' &&
        reference !== null &&
        'id' in reference &&
        typeof reference.id === 'string' &&
        reference.id.trim().length > 0
        ? reference.id
        : fallback;
}

function allEvidenceReferences(
    evidence: GateEvidenceBindingsV1
): GateEvidenceReferenceV1[] {
    return [
        evidence.deterministicCi,
        evidence.publisherCandidate,
        evidence.r2Candidate,
        evidence.publicCandidate,
        evidence.publicActiveRelease,
        evidence.webIdentity,
        evidence.browserFlows,
        evidence.manualReview,
        evidence.workflowApproval,
        evidence.productionPointerBefore,
        evidence.productionPointerAfter,
    ];
}

function checkEvidenceIds(
    evidence: GateEvidenceBindingsV1
): Record<GateCheckId, string[]> {
    return {
        deterministicCi: [evidenceId(evidence.deterministicCi, 'ci')],
        publisherCandidate: [
            evidenceId(evidence.publisherCandidate, 'publisher'),
        ],
        r2Candidate: [evidenceId(evidence.r2Candidate, 'r2')],
        publicCandidate: [
            evidenceId(evidence.publicCandidate, 'public-candidate'),
        ],
        publicActiveRelease: [
            evidenceId(evidence.publicActiveRelease, 'public-active'),
        ],
        webIdentity: [evidenceId(evidence.webIdentity, 'web')],
        browserFlows: [evidenceId(evidence.browserFlows, 'browser')],
        manualReview: [evidenceId(evidence.manualReview, 'manual')],
        workflowApproval: [evidenceId(evidence.workflowApproval, 'workflow')],
        productionPointerUnchanged: [
            evidenceId(evidence.productionPointerBefore, 'pointer-before'),
            evidenceId(evidence.productionPointerAfter, 'pointer-after'),
        ],
    };
}

function initialChecks(
    evidence: GateEvidenceBindingsV1
): VisualNovelReleaseGateReportV1['checks'] {
    const ids = checkEvidenceIds(evidence);
    return {
        deterministicCi: {
            status: 'not-run' as const,
            evidenceIds: ids.deterministicCi,
        },
        publisherCandidate: {
            status: 'not-run' as const,
            evidenceIds: ids.publisherCandidate,
        },
        r2Candidate: {
            status: 'not-run' as const,
            evidenceIds: ids.r2Candidate,
        },
        publicCandidate: {
            status: 'not-run' as const,
            evidenceIds: ids.publicCandidate,
        },
        publicActiveRelease: {
            status: 'not-run' as const,
            evidenceIds: ids.publicActiveRelease,
        },
        webIdentity: {
            status: 'not-run' as const,
            evidenceIds: ids.webIdentity,
        },
        browserFlows: {
            status: 'not-run' as const,
            evidenceIds: ids.browserFlows,
        },
        manualReview: {
            status: 'not-run' as const,
            evidenceIds: ids.manualReview,
        },
        workflowApproval: {
            status: 'not-run' as const,
            evidenceIds: ids.workflowApproval,
        },
        productionPointerUnchanged: {
            status: 'not-run' as const,
            evidenceIds: ids.productionPointerUnchanged,
        },
    };
}

function safeEvidenceReferences(
    evidence: GateEvidenceBindingsV1
): GateEvidenceReferenceV1[] {
    return allEvidenceReferences(evidence).flatMap(reference => {
        const parsed = gateEvidenceReferenceV1Schema.safeParse(reference);
        return parsed.success ? [parsed.data] : [];
    });
}

function safeManualReviewDigest(review: unknown): string {
    try {
        return hashCanonicalEvidence(review);
    } catch {
        return '0'.repeat(64);
    }
}

function diagnosticFor(
    error: unknown,
    identity: GateIdentityV1
): GateDiagnosticV1 {
    if (error instanceof GateRunnerError) {
        return {
            code: error.code,
            stage: error.stage,
            message: 'Release gate evidence validation failed',
            storyId: identity.storyId,
            target: identity.target,
            releaseId: identity.releaseId,
            manifestSha256: identity.manifestSha256,
            ...(error.evidenceId === undefined
                ? {}
                : { evidenceId: error.evidenceId }),
        };
    }
    if (error instanceof CandidateEvidenceError) {
        return {
            code: 'publisher-candidate/invalid',
            stage: 'publisher-candidate',
            message: 'Candidate publisher evidence is invalid',
            storyId: identity.storyId,
            target: identity.target,
            releaseId: identity.releaseId,
            manifestSha256: identity.manifestSha256,
        };
    }
    return {
        code: 'evidence-binding/invalid',
        stage: 'evidence-binding',
        message: 'Release gate evidence is invalid',
        storyId: identity.storyId,
        target: identity.target,
        releaseId: identity.releaseId,
        manifestSha256: identity.manifestSha256,
    };
}

function assertExactIdentity(
    actual: Pick<GateIdentityV1, 'storyId' | 'releaseId' | 'manifestSha256'>,
    expected: GateIdentityV1,
    evidenceReference: GateEvidenceReferenceV1
): void {
    if (
        actual.storyId !== expected.storyId ||
        actual.releaseId !== expected.releaseId ||
        actual.manifestSha256 !== expected.manifestSha256
    ) {
        bindingError(
            'evidence-binding/identity-mismatch',
            evidenceReference.id
        );
    }
}

async function validateEvidenceReference(
    dependencies: GateRunnerDependencies,
    evidenceDirectory: string,
    reference: GateEvidenceReferenceV1,
    expectedKind: GateEvidenceReferenceV1['kind'],
    value: unknown
): Promise<void> {
    let parsed: GateEvidenceReferenceV1;
    try {
        parsed = parseGateEvidenceReferenceV1(reference);
    } catch {
        bindingError('evidence-binding/reference-invalid');
    }
    if (
        parsed.kind !== expectedKind ||
        parsed.mediaType !== 'application/json'
    ) {
        bindingError('evidence-binding/reference-kind', parsed.id);
    }

    let actual: GateEvidenceReferenceV1;
    try {
        actual = await dependencies.createEvidenceReference(evidenceDirectory, {
            id: parsed.id,
            kind: parsed.kind,
            path: parsed.path,
            mediaType: parsed.mediaType,
        });
    } catch {
        bindingError('evidence-binding/reference-unreadable', parsed.id);
    }
    if (actual.sha256 !== parsed.sha256) {
        bindingError('evidence-binding/digest-mismatch', parsed.id);
    }
    let expectedDigest: string;
    try {
        expectedDigest = hashCanonicalEvidence(value);
    } catch {
        bindingError('evidence-binding/artifact-invalid', parsed.id);
    }
    if (expectedDigest !== parsed.sha256) {
        bindingError('evidence-binding/artifact-mismatch', parsed.id);
    }
}

function assertUniqueEvidenceIds(evidence: GateEvidenceBindingsV1): void {
    const ids = allEvidenceReferences(evidence).map((reference, index) =>
        evidenceId(reference, `evidence-${index + 1}`)
    );
    if (new Set(ids).size !== ids.length) {
        bindingError('evidence-binding/duplicate-id');
    }
}

function assertTier1Evidence(
    evidence: Tier1EvidenceV1,
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (evidence.status !== 'passed') {
        gateError('ci', 'ci/failed', reference.id);
    }
    if (evidence.commitSha !== identity.commitSha) {
        bindingError('evidence-binding/commit-mismatch', reference.id);
    }
}

function assertR2CandidateEvidence(
    evidence: R2CandidateEvidenceV1,
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (evidence.status !== 'passed') {
        gateError('r2-candidate', 'r2-candidate/failed', reference.id);
    }
    if (evidence.target.kind !== 'production') {
        bindingError('evidence-binding/target-mismatch', reference.id);
    }
    assertExactIdentity(evidence, identity, reference);
}

function assertPublicEvidence(
    evidence: PublicReleaseVerificationResultV1,
    expectedMode: 'candidate' | 'active',
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (evidence.status !== 'passed') {
        gateError('public-object', 'public-verification/failed', reference.id);
    }
    if (
        evidence.mode !== expectedMode ||
        evidence.target.kind !== 'preview' ||
        evidence.target.previewId !== identity.previewId
    ) {
        bindingError('evidence-binding/public-target-mismatch', reference.id);
    }
    assertExactIdentity(evidence, identity, reference);
}

function assertWebIdentityEvidence(
    evidence: WebIdentityEvidenceV1,
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (
        evidence.target !== 'preview' ||
        evidence.assetEnvironment !== 'preview' ||
        evidence.previewId !== identity.previewId ||
        evidence.releaseId !== identity.releaseId ||
        evidence.manifestSha256 !== identity.manifestSha256
    ) {
        bindingError('evidence-binding/web-target-mismatch', reference.id);
    }
}

function assertBrowserEvidence(
    evidence: BrowserEvidenceV1,
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (evidence.status !== 'passed') {
        gateError('reader-flow', 'reader-flow/failed', reference.id);
    }
    if (
        evidence.flow !== 'preview-release-gate' ||
        evidence.target.kind !== 'preview' ||
        evidence.target.previewId !== identity.previewId ||
        evidence.storyId !== identity.storyId ||
        evidence.releaseId !== identity.releaseId ||
        evidence.manifestSha256 !== identity.manifestSha256 ||
        evidence.scenarioSha256 !== identity.scenarioSha256 ||
        evidence.projects.length !== 2 ||
        evidence.projects[0]?.project !== 'release-gate-chromium' ||
        evidence.projects[1]?.project !== 'release-gate-mobile-chrome' ||
        evidence.projects.some(
            project =>
                project.flow !== evidence.flow ||
                project.storyId !== evidence.storyId ||
                project.target.kind !== 'preview' ||
                project.target.previewId !== identity.previewId ||
                project.releaseId !== evidence.releaseId ||
                project.manifestSha256 !== evidence.manifestSha256 ||
                project.scenarioSha256 !== evidence.scenarioSha256
        )
    ) {
        bindingError(
            'evidence-binding/browser-identity-mismatch',
            reference.id
        );
    }
    assertExactIdentity(evidence, identity, reference);
}

function assertManualReview(
    review: VisualReviewRecordV1,
    identity: GateIdentityV1,
    includedCount: number,
    omittedCount: number,
    reference: GateEvidenceReferenceV1
): void {
    if (review.decision !== 'approved') {
        gateError('manual-review', 'manual-review/rejected', reference.id);
    }
    try {
        assertVisualReviewMatchesIdentity(review, identity);
    } catch {
        bindingError('evidence-binding/manual-identity-mismatch', reference.id);
    }
    if (
        review.includedCount !== includedCount ||
        review.omittedCount !== omittedCount
    ) {
        bindingError('evidence-binding/manual-coverage-mismatch', reference.id);
    }
}

function assertWorkflowApproval(
    evidence: WorkflowApprovalEvidenceV1,
    reference: GateEvidenceReferenceV1
): void {
    if (
        evidence.environment !== 'visual-novel-release-approval' ||
        evidence.conclusion !== 'success'
    ) {
        bindingError(
            'evidence-binding/workflow-approval-mismatch',
            reference.id
        );
    }
}

function assertProductionPointerProof(
    before: ProductionPointerEvidenceV1,
    after: ProductionPointerEvidenceV1,
    identity: GateIdentityV1,
    reference: GateEvidenceReferenceV1
): void {
    if (
        before.storyId !== identity.storyId ||
        after.storyId !== identity.storyId ||
        before.previewId !== identity.previewId ||
        after.previewId !== identity.previewId
    ) {
        bindingError('evidence-binding/pointer-context-mismatch', reference.id);
    }
    if (
        hashCanonicalEvidence(before.productionPointer) !==
        hashCanonicalEvidence(after.productionPointer)
    ) {
        gateError(
            'production-pointer-proof',
            'production-pointer-proof/changed',
            reference.id
        );
    }
}

function createReport(
    input: RunVisualNovelReleaseGateInputV1,
    checks: ReturnType<typeof initialChecks>,
    diagnostics: GateDiagnosticV1[],
    now: Date
): VisualNovelReleaseGateReportV1 {
    const report = {
        schemaVersion: 1,
        status: diagnostics.length === 0 ? 'passed' : 'failed',
        storyId: input.identity.storyId,
        target: input.identity.target,
        previewId: input.identity.previewId,
        releaseId: input.identity.releaseId,
        manifestSha256: input.identity.manifestSha256,
        commitSha: input.identity.commitSha,
        scenarioSha256: input.identity.scenarioSha256,
        manualReviewSha256: safeManualReviewDigest(input.manualReview),
        createdAt: now.toISOString(),
        checks,
        evidence: safeEvidenceReferences(input.evidence),
        diagnostics,
    };
    return parseVisualNovelReleaseGateReportV1(report);
}

/**
 * Aggregates retained evidence for one preview candidate. It performs no R2,
 * publisher, pointer, or activation mutations; those systems remain owned by
 * their existing services and contribute immutable evidence to this boundary.
 */
export async function runVisualNovelReleaseGate(
    input: RunVisualNovelReleaseGateInputV1,
    suppliedDependencies: Partial<GateRunnerDependencies> = {}
): Promise<VisualNovelReleaseGateReportV1> {
    const dependencies = resolveDependencies(suppliedDependencies);
    const checks = initialChecks(input.evidence);
    const diagnostics: GateDiagnosticV1[] = [];
    const now = dependencies.now();

    try {
        assertGateIdentity(input.identity);
        assertUniqueEvidenceIds(input.evidence);
    } catch (error) {
        diagnostics.push(diagnosticFor(error, input.identity));
        return createReport(input, checks, diagnostics, now);
    }

    const runCheck = async (
        checkId: GateCheckId,
        operation: () => Promise<void> | void
    ): Promise<boolean> => {
        try {
            await operation();
            checks[checkId].status = 'passed';
            return true;
        } catch (error) {
            checks[checkId].status = 'failed';
            diagnostics.push(diagnosticFor(error, input.identity));
            return false;
        }
    };

    let candidateSummary: ReturnType<typeof validateCandidatePublisherEvidence>;
    if (
        !(await runCheck('publisherCandidate', async () => {
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.publisherCandidate,
                'publisher-report',
                input.publisherReport
            );
            candidateSummary = validateCandidatePublisherEvidence(
                input.publisherReport,
                input.identity
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('deterministicCi', async () => {
            const tier1 = parseTier1EvidenceV1(input.tier1);
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.deterministicCi,
                'ci-result',
                tier1
            );
            assertTier1Evidence(
                tier1,
                input.identity,
                input.evidence.deterministicCi
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('r2Candidate', async () => {
            const r2 = parseR2CandidateEvidence(input.r2Candidate);
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.r2Candidate,
                'r2-verification',
                r2
            );
            assertR2CandidateEvidence(
                r2,
                input.identity,
                input.evidence.r2Candidate
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('publicCandidate', async () => {
            const publicCandidate = parsePublicReleaseVerificationResultV1(
                input.publicCandidate
            );
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.publicCandidate,
                'public-verification',
                publicCandidate
            );
            assertPublicEvidence(
                publicCandidate,
                'candidate',
                input.identity,
                input.evidence.publicCandidate
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('publicActiveRelease', async () => {
            const publicActiveRelease = parsePublicReleaseVerificationResultV1(
                input.publicActiveRelease
            );
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.publicActiveRelease,
                'public-verification',
                publicActiveRelease
            );
            assertPublicEvidence(
                publicActiveRelease,
                'active',
                input.identity,
                input.evidence.publicActiveRelease
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('webIdentity', async () => {
            const webIdentity = parseWebIdentityEvidenceV1(input.webIdentity);
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.webIdentity,
                'web-identity',
                webIdentity
            );
            assertWebIdentityEvidence(
                webIdentity,
                input.identity,
                input.evidence.webIdentity
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('browserFlows', async () => {
            const browser = parseBrowserEvidenceV1(input.browserEvidence);
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.browserFlows,
                'playwright-result',
                browser
            );
            assertBrowserEvidence(
                browser,
                input.identity,
                input.evidence.browserFlows
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('manualReview', async () => {
            const manualReview = parseVisualReviewRecordV1(input.manualReview);
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.manualReview,
                'manual-review',
                manualReview
            );
            assertManualReview(
                manualReview,
                input.identity,
                candidateSummary.includedCount,
                candidateSummary.omittedCount,
                input.evidence.manualReview
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    if (
        !(await runCheck('workflowApproval', async () => {
            const workflowApproval = parseWorkflowApprovalEvidenceV1(
                input.workflowApproval
            );
            await validateEvidenceReference(
                dependencies,
                input.evidenceDir,
                input.evidence.workflowApproval,
                'workflow-approval',
                workflowApproval
            );
            assertWorkflowApproval(
                workflowApproval,
                input.evidence.workflowApproval
            );
        }))
    ) {
        return createReport(input, checks, diagnostics, now);
    }

    await runCheck('productionPointerUnchanged', async () => {
        const before = parseProductionPointerEvidence(
            input.productionPointerBefore
        );
        const after = parseProductionPointerEvidence(
            input.productionPointerAfter
        );
        await validateEvidenceReference(
            dependencies,
            input.evidenceDir,
            input.evidence.productionPointerBefore,
            'pointer-snapshot',
            before
        );
        await validateEvidenceReference(
            dependencies,
            input.evidenceDir,
            input.evidence.productionPointerAfter,
            'pointer-snapshot',
            after
        );
        assertProductionPointerProof(
            before,
            after,
            input.identity,
            input.evidence.productionPointerAfter
        );
    });

    return createReport(input, checks, diagnostics, now);
}
