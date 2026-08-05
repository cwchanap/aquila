import {
    parseVisualNovelReleaseGateReportV1,
    type GateCheckV1,
    type GateEvidenceReferenceV1,
    type VisualNovelReleaseGateReportV1,
} from './schemas';
import type { GateDiagnosticV1 } from './diagnostics';
import { EVIDENCE_MEDIA_TYPES } from './evidence';
import { gateDiagnosticExitCode } from './exit-codes';

const SAFE_DIAGNOSTIC_CODE = /^[a-z][a-z0-9]*(?:[/-][a-z0-9]+)*$/;
const SENSITIVE_DIAGNOSTIC_CODE =
    /(?:authorization|bearer|credential|password|private|prompt|secret|token|bucket)/;
const SAFE_COMMIT_SHA = /^[a-f0-9]{7,64}$/i;
const SENSITIVE_REPORT_VALUE =
    /(?:authorization|bearer|credential|password|private|prompt|secret|token|bucket)/i;
const PUBLIC_EVIDENCE_ID_BY_KIND: Record<
    GateEvidenceReferenceV1['kind'],
    string
> = {
    'ci-result': 'ci',
    'publisher-report': 'publisher',
    'r2-verification': 'r2',
    'public-verification': 'public',
    'web-identity': 'web',
    'playwright-result': 'browser',
    'manual-review': 'manual',
    'workflow-approval': 'workflow',
    'pointer-snapshot': 'pointer',
};

function safeDiagnosticCode(code: string): string {
    return code.length <= 128 &&
        SAFE_DIAGNOSTIC_CODE.test(code) &&
        !SENSITIVE_DIAGNOSTIC_CODE.test(code)
        ? code
        : 'gate/diagnostic';
}

function isSafePublicValue(value: string): boolean {
    return value.length <= 1024 && !SENSITIVE_REPORT_VALUE.test(value);
}

function safeCommitSha(value: string): string {
    return SAFE_COMMIT_SHA.test(value) && isSafePublicValue(value)
        ? value
        : '[redacted]';
}

function sanitizeDiagnostic(diagnostic: GateDiagnosticV1): GateDiagnosticV1 {
    return {
        code: safeDiagnosticCode(diagnostic.code),
        stage: diagnostic.stage,
        message: 'Release gate diagnostic',
        ...(diagnostic.storyId === undefined
            ? {}
            : { storyId: diagnostic.storyId }),
        ...(diagnostic.target === undefined
            ? {}
            : { target: diagnostic.target }),
        ...(diagnostic.releaseId === undefined
            ? {}
            : { releaseId: diagnostic.releaseId }),
        ...(diagnostic.manifestSha256 === undefined
            ? {}
            : { manifestSha256: diagnostic.manifestSha256 }),
        ...(diagnostic.identity === undefined
            ? {}
            : isSafePublicValue(diagnostic.identity)
              ? { identity: diagnostic.identity }
              : {}),
    };
}

function isSupportedEvidenceMediaType(mediaType: string): boolean {
    return (EVIDENCE_MEDIA_TYPES as readonly string[]).includes(mediaType);
}

function isPublicEvidenceReference(
    reference: GateEvidenceReferenceV1
): boolean {
    return (
        isSupportedEvidenceMediaType(reference.mediaType) &&
        isSafePublicValue(reference.path)
    );
}

function publicEvidenceId(
    kind: GateEvidenceReferenceV1['kind'],
    occurrence: number
): string {
    const base = PUBLIC_EVIDENCE_ID_BY_KIND[kind];
    return occurrence === 0 ? base : `${base}-${occurrence + 1}`;
}

function publicEvidenceReferences(
    references: readonly GateEvidenceReferenceV1[]
): {
    evidence: GateEvidenceReferenceV1[];
    aliasesBySourceId: ReadonlyMap<string, readonly string[]>;
} {
    const occurrencesByKind = new Map<
        GateEvidenceReferenceV1['kind'],
        number
    >();
    const aliasesBySourceId = new Map<string, string[]>();
    const evidence: GateEvidenceReferenceV1[] = [];

    for (const reference of references) {
        if (!isPublicEvidenceReference(reference)) continue;

        const occurrence = occurrencesByKind.get(reference.kind) ?? 0;
        occurrencesByKind.set(reference.kind, occurrence + 1);
        const id = publicEvidenceId(reference.kind, occurrence);
        const aliases = aliasesBySourceId.get(reference.id) ?? [];
        aliases.push(id);
        aliasesBySourceId.set(reference.id, aliases);
        evidence.push({ ...reference, id });
    }

    return { evidence, aliasesBySourceId };
}

function sanitizeCheck(
    check: GateCheckV1,
    aliasesBySourceId: ReadonlyMap<string, readonly string[]>
): GateCheckV1 {
    return {
        status: check.status,
        evidenceIds: check.evidenceIds.flatMap(
            evidenceId => aliasesBySourceId.get(evidenceId) ?? []
        ),
    };
}

function sanitizeChecks(
    checks: VisualNovelReleaseGateReportV1['checks'],
    aliasesBySourceId: ReadonlyMap<string, readonly string[]>
): VisualNovelReleaseGateReportV1['checks'] {
    return {
        deterministicCi: sanitizeCheck(
            checks.deterministicCi,
            aliasesBySourceId
        ),
        publisherCandidate: sanitizeCheck(
            checks.publisherCandidate,
            aliasesBySourceId
        ),
        r2Candidate: sanitizeCheck(checks.r2Candidate, aliasesBySourceId),
        publicCandidate: sanitizeCheck(
            checks.publicCandidate,
            aliasesBySourceId
        ),
        publicActiveRelease: sanitizeCheck(
            checks.publicActiveRelease,
            aliasesBySourceId
        ),
        webIdentity: sanitizeCheck(checks.webIdentity, aliasesBySourceId),
        browserFlows: sanitizeCheck(checks.browserFlows, aliasesBySourceId),
        manualReview: sanitizeCheck(checks.manualReview, aliasesBySourceId),
        workflowApproval: sanitizeCheck(
            checks.workflowApproval,
            aliasesBySourceId
        ),
        productionPointerUnchanged: sanitizeCheck(
            checks.productionPointerUnchanged,
            aliasesBySourceId
        ),
    };
}

function publicReport(report: unknown): VisualNovelReleaseGateReportV1 {
    const parsed = parseVisualNovelReleaseGateReportV1(report);
    const { evidence, aliasesBySourceId } = publicEvidenceReferences(
        parsed.evidence
    );
    return {
        schemaVersion: parsed.schemaVersion,
        status: parsed.status,
        storyId: parsed.storyId,
        target: parsed.target,
        previewId: parsed.previewId,
        releaseId: parsed.releaseId,
        manifestSha256: parsed.manifestSha256,
        commitSha: safeCommitSha(parsed.commitSha),
        scenarioSha256: parsed.scenarioSha256,
        manualReviewSha256: parsed.manualReviewSha256,
        createdAt: parsed.createdAt,
        checks: sanitizeChecks(parsed.checks, aliasesBySourceId),
        evidence,
        diagnostics: parsed.diagnostics.map(sanitizeDiagnostic),
    };
}

/**
 * Renders a single schema-valid artifact for JSON stdout. Progress and
 * diagnostics remain a CLI concern and must be written to stderr separately.
 */
export function renderGateJsonReport(report: unknown): string {
    return `${JSON.stringify(publicReport(report))}\n`;
}

/**
 * Renders a compact, credential-free operator summary for stderr.
 */
export function renderGateHumanReport(report: unknown): string {
    const safe = publicReport(report);
    const lines = [
        `status: ${safe.status}`,
        `story: ${safe.storyId}`,
        `target: ${safe.target.kind}`,
        ...(safe.target.kind === 'preview' && safe.previewId !== undefined
            ? [`preview: ${safe.previewId}`]
            : []),
        `release: ${safe.releaseId}`,
        `checksum: ${safe.manifestSha256}`,
        `commit: ${safe.commitSha}`,
        'checks:',
    ];
    for (const [checkId, check] of Object.entries(safe.checks)) {
        lines.push(`- ${checkId}: ${check.status}`);
    }
    lines.push(`evidence: ${safe.evidence.length}`);
    if (safe.diagnostics.length === 0) {
        lines.push('diagnostics: none');
    } else {
        lines.push('diagnostics:');
        for (const diagnostic of safe.diagnostics) {
            lines.push(`- ${diagnostic.code}`);
        }
    }
    return `${lines.join('\n')}\n`;
}

export { gateDiagnosticExitCode } from './exit-codes';

export function gateReportExitCode(report: unknown): number {
    const parsed = parseVisualNovelReleaseGateReportV1(report);
    if (parsed.status === 'passed') return 0;

    return gateDiagnosticExitCode(parsed.diagnostics[0]?.code ?? '');
}
