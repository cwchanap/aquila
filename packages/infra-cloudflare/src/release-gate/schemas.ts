import { z } from 'zod';
import {
    LogicalAssetIdentitySchema,
    isPreviewId,
    isReleaseId,
    isSafeRelativePath,
    isSha256,
    isStoryId,
    qualifyAssetIdentity,
    resolveAssetUrl,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import {
    GATE_EVIDENCE_KINDS,
    GATE_STAGES,
    type GateDiagnosticV1,
} from './diagnostics';

const schemaVersionV1 = z.literal(1);
const nonEmptyString = z.string().trim().min(1);
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

const storyIdV1Schema = z
    .string()
    .refine(isStoryId, 'Story id must be a lowercase underscore slug');
const previewIdV1Schema = z.string().refine(isPreviewId, {
    message: 'Preview id is invalid',
});
const releaseIdV1Schema = z.string().refine(isReleaseId, {
    message: 'Release id must be sha256-<64 lowercase hex>',
});
const sha256V1Schema = z.string().refine(isSha256, {
    message: 'SHA-256 must contain 64 lowercase hex characters',
});
const safeRelativePathV1Schema = z.string().refine(isSafeRelativePath, {
    message: 'Expected a safe relative path',
});

// Runtime-asset pointers use offset-aware ISO timestamps. Gate evidence uses
// the same canonical wire convention rather than a second date parser.
const canonicalTimestampV1Schema = z.string().datetime({ offset: true });

function isQualifiedAssetIdentity(value: string): boolean {
    const separator = value.indexOf(':');
    if (separator <= 0 || separator === value.length - 1) return false;

    const parsed = LogicalAssetIdentitySchema.safeParse({
        type: value.slice(0, separator),
        key: value.slice(separator + 1),
    });
    return parsed.success && qualifyAssetIdentity(parsed.data) === value;
}

const qualifiedAssetIdentityV1Schema = z
    .string()
    .refine(isQualifiedAssetIdentity, {
        message: 'Expected a canonical type-qualified asset identity',
    });

function isHttpsCredentialFreeUrl(value: string): boolean {
    try {
        return (
            resolveAssetUrl(value, 'release-gate-validation').protocol ===
            'https:'
        );
    } catch {
        return false;
    }
}

const httpsCredentialFreeUrlV1Schema = z
    .string()
    .refine(isHttpsCredentialFreeUrl, {
        message: 'Expected an HTTPS credential-free URL',
    });

const productionPublicationTargetV1Schema = z
    .object({
        kind: z.literal('production'),
    })
    .strict();
const previewPublicationTargetV1Schema = z
    .object({
        kind: z.literal('preview'),
        previewId: previewIdV1Schema,
    })
    .strict();

export const publicationTargetV1Schema = z
    .discriminatedUnion('kind', [
        productionPublicationTargetV1Schema,
        previewPublicationTargetV1Schema,
    ])
    .superRefine((target, context) => {
        if (target.kind === 'preview' && !isPreviewId(target.previewId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Preview targets require a valid preview id',
                path: ['previewId'],
            });
        }
    });

export function parsePublicationTargetV1(input: unknown): PublicationTarget {
    return publicationTargetV1Schema.parse(input);
}

const visualNovelGatePositionV1Schema = z
    .object({
        sceneId: nonEmptyString,
        dialogueIndex: nonNegativeInteger,
    })
    .strict();

export const visualNovelGateScenarioV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        storyId: storyIdV1Schema,
        locale: nonEmptyString,
        directOpen: visualNovelGatePositionV1Schema,
        transition: z
            .object({
                from: visualNovelGatePositionV1Schema,
                to: visualNovelGatePositionV1Schema,
                backgroundChanges: z.boolean(),
                portraitChanges: z.boolean(),
            })
            .strict(),
        bookmark: visualNovelGatePositionV1Schema,
        omittedFallback: visualNovelGatePositionV1Schema
            .extend({
                identity: qualifiedAssetIdentityV1Schema,
            })
            .strict(),
        choice: visualNovelGatePositionV1Schema
            .extend({
                choiceIndex: nonNegativeInteger,
                expectedSceneId: nonEmptyString,
            })
            .strict(),
        unrelatedStoryIds: z.array(storyIdV1Schema),
    })
    .strict();
export type VisualNovelGateScenarioV1 = z.infer<
    typeof visualNovelGateScenarioV1Schema
>;

export function parseVisualNovelGateScenarioV1(
    input: unknown
): VisualNovelGateScenarioV1 {
    return visualNovelGateScenarioV1Schema.parse(input);
}

export const visualReviewRecordV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        storyId: storyIdV1Schema,
        previewId: previewIdV1Schema,
        releaseId: releaseIdV1Schema,
        manifestSha256: sha256V1Schema,
        scenarioSha256: sha256V1Schema,
        reviewedAt: canonicalTimestampV1Schema,
        reviewer: nonEmptyString,
        decision: z.enum(['approved', 'rejected']),
        includedCount: nonNegativeInteger,
        omittedCount: nonNegativeInteger,
        representativeRoutes: z.array(nonEmptyString),
        notes: z.array(nonEmptyString),
    })
    .strict();
export type VisualReviewRecordV1 = z.infer<typeof visualReviewRecordV1Schema>;

export function parseVisualReviewRecordV1(
    input: unknown
): VisualReviewRecordV1 {
    return visualReviewRecordV1Schema.parse(input);
}

export const workflowApprovalEvidenceV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        repository: nonEmptyString,
        workflowRef: nonEmptyString,
        runId: positiveInteger,
        runAttempt: positiveInteger,
        jobId: nonEmptyString,
        actor: nonEmptyString,
        environment: z.literal('visual-novel-release-approval'),
        conclusion: z.literal('success'),
    })
    .strict();
export type WorkflowApprovalEvidenceV1 = z.infer<
    typeof workflowApprovalEvidenceV1Schema
>;

export function parseWorkflowApprovalEvidenceV1(
    input: unknown
): WorkflowApprovalEvidenceV1 {
    return workflowApprovalEvidenceV1Schema.parse(input);
}

export const webIdentityEvidenceV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        target: z.enum(['preview', 'production']),
        webBaseUrl: httpsCredentialFreeUrlV1Schema,
        assetEnvironment: z.enum(['preview', 'production']),
        previewId: previewIdV1Schema.optional(),
        releaseId: releaseIdV1Schema,
        manifestSha256: sha256V1Schema,
        pointerRequestUrl: httpsCredentialFreeUrlV1Schema,
        manifestRequestUrl: httpsCredentialFreeUrlV1Schema,
    })
    .strict()
    .superRefine((evidence, context) => {
        if (evidence.target === 'preview' && evidence.previewId === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Preview web identity evidence requires a preview id',
                path: ['previewId'],
            });
        }
        if (
            evidence.target === 'production' &&
            evidence.previewId !== undefined
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Production web identity evidence rejects a preview id',
                path: ['previewId'],
            });
        }
        if (evidence.target !== evidence.assetEnvironment) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Web identity target and asset environment must agree',
                path: ['assetEnvironment'],
            });
        }
    });
export type WebIdentityEvidenceV1 = z.infer<typeof webIdentityEvidenceV1Schema>;

export function parseWebIdentityEvidenceV1(
    input: unknown
): WebIdentityEvidenceV1 {
    return webIdentityEvidenceV1Schema.parse(input);
}

export const tier1EvidenceV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        commitSha: nonEmptyString,
        lockfileSha256: sha256V1Schema,
        bunVersion: nonEmptyString,
        nodeVersion: nonEmptyString,
        playwrightVersion: nonEmptyString,
        commandSetVersion: z.literal(1),
        browserMatrix: z.tuple([
            z.literal('chromium'),
            z.literal('mobile-chrome'),
        ]),
        status: z.literal('passed'),
        completedAt: canonicalTimestampV1Schema,
    })
    .strict();
export type Tier1EvidenceV1 = z.infer<typeof tier1EvidenceV1Schema>;

export function parseTier1EvidenceV1(input: unknown): Tier1EvidenceV1 {
    return tier1EvidenceV1Schema.parse(input);
}

export const publicReleaseVerificationInputV1Schema = z
    .object({
        storyId: storyIdV1Schema,
        target: publicationTargetV1Schema,
        assetBaseUrl: httpsCredentialFreeUrlV1Schema,
        browserOrigin: httpsCredentialFreeUrlV1Schema,
        mode: z.enum(['candidate', 'active']),
        releaseId: releaseIdV1Schema.optional(),
        expectedManifestSha256: sha256V1Schema.optional(),
        omittedIdentities: z.array(qualifiedAssetIdentityV1Schema),
    })
    .strict()
    .superRefine((input, context) => {
        if (input.mode === 'candidate' && input.releaseId === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Candidate verification requires a release id',
                path: ['releaseId'],
            });
        }
        if (input.mode === 'active' && input.releaseId !== undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Active verification rejects a caller-supplied release id',
                path: ['releaseId'],
            });
        }
    });
export type PublicReleaseVerificationInputV1 = z.infer<
    typeof publicReleaseVerificationInputV1Schema
>;

export function parsePublicReleaseVerificationInputV1(
    input: unknown
): PublicReleaseVerificationInputV1 {
    return publicReleaseVerificationInputV1Schema.parse(input);
}

export const publicVerificationCheckV1Schema = z
    .object({
        id: nonEmptyString,
        status: z.enum(['passed', 'failed']),
    })
    .strict();
export type PublicVerificationCheckV1 = z.infer<
    typeof publicVerificationCheckV1Schema
>;

export function parsePublicVerificationCheckV1(
    input: unknown
): PublicVerificationCheckV1 {
    return publicVerificationCheckV1Schema.parse(input);
}

export const gateDiagnosticV1Schema = z
    .object({
        code: nonEmptyString,
        stage: z.enum(GATE_STAGES),
        message: nonEmptyString,
        storyId: storyIdV1Schema.optional(),
        target: publicationTargetV1Schema.optional(),
        releaseId: releaseIdV1Schema.optional(),
        manifestSha256: sha256V1Schema.optional(),
        identity: qualifiedAssetIdentityV1Schema.optional(),
        safePath: safeRelativePathV1Schema.optional(),
        publicUrl: httpsCredentialFreeUrlV1Schema.optional(),
        evidenceId: nonEmptyString.optional(),
    })
    .strict();

export function parseGateDiagnosticV1(input: unknown): GateDiagnosticV1 {
    return gateDiagnosticV1Schema.parse(input);
}

export const publicReleaseVerificationResultV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        status: z.enum(['passed', 'failed']),
        mode: z.enum(['candidate', 'active']),
        storyId: storyIdV1Schema,
        target: publicationTargetV1Schema,
        releaseId: releaseIdV1Schema,
        manifestSha256: sha256V1Schema,
        checks: z.array(publicVerificationCheckV1Schema),
        diagnostics: z.array(gateDiagnosticV1Schema),
    })
    .strict();
export type PublicReleaseVerificationResultV1 = z.infer<
    typeof publicReleaseVerificationResultV1Schema
>;

export function parsePublicReleaseVerificationResultV1(
    input: unknown
): PublicReleaseVerificationResultV1 {
    return publicReleaseVerificationResultV1Schema.parse(input);
}

export const gateCheckV1Schema = z
    .object({
        status: z.enum(['passed', 'failed', 'not-run']),
        evidenceIds: z.array(nonEmptyString),
    })
    .strict();
export type GateCheckV1 = z.infer<typeof gateCheckV1Schema>;

export function parseGateCheckV1(input: unknown): GateCheckV1 {
    return gateCheckV1Schema.parse(input);
}

export const gateEvidenceReferenceV1Schema = z
    .object({
        id: nonEmptyString,
        kind: z.enum(GATE_EVIDENCE_KINDS),
        path: safeRelativePathV1Schema,
        sha256: sha256V1Schema,
        mediaType: nonEmptyString,
    })
    .strict();
export type GateEvidenceReferenceV1 = z.infer<
    typeof gateEvidenceReferenceV1Schema
>;

export function parseGateEvidenceReferenceV1(
    input: unknown
): GateEvidenceReferenceV1 {
    return gateEvidenceReferenceV1Schema.parse(input);
}

export const visualNovelReleaseGateReportV1Schema = z
    .object({
        schemaVersion: schemaVersionV1,
        status: z.enum(['passed', 'failed']),
        storyId: storyIdV1Schema,
        target: publicationTargetV1Schema,
        previewId: previewIdV1Schema,
        releaseId: releaseIdV1Schema,
        manifestSha256: sha256V1Schema,
        commitSha: nonEmptyString,
        scenarioSha256: sha256V1Schema,
        manualReviewSha256: sha256V1Schema,
        createdAt: canonicalTimestampV1Schema,
        checks: z
            .object({
                deterministicCi: gateCheckV1Schema,
                publisherCandidate: gateCheckV1Schema,
                r2Candidate: gateCheckV1Schema,
                publicCandidate: gateCheckV1Schema,
                publicActiveRelease: gateCheckV1Schema,
                webIdentity: gateCheckV1Schema,
                browserFlows: gateCheckV1Schema,
                manualReview: gateCheckV1Schema,
                workflowApproval: gateCheckV1Schema,
                productionPointerUnchanged: gateCheckV1Schema,
            })
            .strict(),
        evidence: z.array(gateEvidenceReferenceV1Schema),
        diagnostics: z.array(gateDiagnosticV1Schema),
    })
    .strict()
    .superRefine((report, context) => {
        if (
            report.target.kind === 'preview' &&
            report.target.previewId !== report.previewId
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Report preview id must match its preview target',
                path: ['previewId'],
            });
        }
        if (report.status === 'passed') {
            for (const [checkId, check] of Object.entries(report.checks)) {
                if (check.status !== 'passed') {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message:
                            'A passing report requires every check to pass',
                        path: ['checks', checkId, 'status'],
                    });
                }
            }
        }
    });
export type VisualNovelReleaseGateReportV1 = z.infer<
    typeof visualNovelReleaseGateReportV1Schema
>;

export function parseVisualNovelReleaseGateReportV1(
    input: unknown
): VisualNovelReleaseGateReportV1 {
    return visualNovelReleaseGateReportV1Schema.parse(input);
}

export function assertVisualReviewMatchesIdentity(
    review: VisualReviewRecordV1,
    expected: Pick<
        VisualNovelReleaseGateReportV1,
        | 'storyId'
        | 'previewId'
        | 'releaseId'
        | 'manifestSha256'
        | 'scenarioSha256'
    >
): void {
    for (const key of [
        'storyId',
        'previewId',
        'releaseId',
        'manifestSha256',
        'scenarioSha256',
    ] as const) {
        if (review[key] !== expected[key]) {
            throw new Error(
                `Visual review ${key} does not match gate identity`
            );
        }
    }

    if (review.decision !== 'approved') {
        throw new Error('Visual review must be approved');
    }
    if (
        !Number.isSafeInteger(review.includedCount) ||
        review.includedCount < 0 ||
        !Number.isSafeInteger(review.omittedCount) ||
        review.omittedCount < 0
    ) {
        throw new Error('Visual review counts must be non-negative integers');
    }
}
