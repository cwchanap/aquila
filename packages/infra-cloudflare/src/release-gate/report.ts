import {
    parseVisualNovelReleaseGateReportV1,
    type GateCheckV1,
    type GateEvidenceReferenceV1,
    type VisualNovelReleaseGateReportV1,
} from './schemas';
import type { GateDiagnosticV1 } from './diagnostics';
import { EVIDENCE_MEDIA_TYPES } from './evidence';

const SAFE_DIAGNOSTIC_CODE = /^[a-z][a-z0-9]*(?:[/-][a-z0-9]+)*$/;
const SENSITIVE_DIAGNOSTIC_CODE =
    /(?:authorization|bearer|credential|password|private|prompt|secret|token|bucket)/;
const SAFE_EVIDENCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SENSITIVE_REPORT_VALUE =
    /(?:authorization|bearer|credential|password|private|prompt|secret|token|bucket)/i;

function isDiagnosticCategory(code: string, category: string): boolean {
    return code === category || code.startsWith(`${category}/`);
}

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
        SAFE_EVIDENCE_ID.test(reference.id) &&
        isSafePublicValue(reference.path)
    );
}

function sanitizeCheck(
    check: GateCheckV1,
    evidenceIds: ReadonlySet<string>
): GateCheckV1 {
    return {
        status: check.status,
        evidenceIds: check.evidenceIds.filter(
            evidenceId =>
                SAFE_EVIDENCE_ID.test(evidenceId) && evidenceIds.has(evidenceId)
        ),
    };
}

function sanitizeChecks(
    checks: VisualNovelReleaseGateReportV1['checks'],
    evidenceIds: ReadonlySet<string>
): VisualNovelReleaseGateReportV1['checks'] {
    return {
        deterministicCi: sanitizeCheck(checks.deterministicCi, evidenceIds),
        publisherCandidate: sanitizeCheck(
            checks.publisherCandidate,
            evidenceIds
        ),
        r2Candidate: sanitizeCheck(checks.r2Candidate, evidenceIds),
        publicCandidate: sanitizeCheck(checks.publicCandidate, evidenceIds),
        publicActiveRelease: sanitizeCheck(
            checks.publicActiveRelease,
            evidenceIds
        ),
        webIdentity: sanitizeCheck(checks.webIdentity, evidenceIds),
        browserFlows: sanitizeCheck(checks.browserFlows, evidenceIds),
        manualReview: sanitizeCheck(checks.manualReview, evidenceIds),
        workflowApproval: sanitizeCheck(checks.workflowApproval, evidenceIds),
        productionPointerUnchanged: sanitizeCheck(
            checks.productionPointerUnchanged,
            evidenceIds
        ),
    };
}

function publicReport(report: unknown): VisualNovelReleaseGateReportV1 {
    const parsed = parseVisualNovelReleaseGateReportV1(report);
    const evidence = parsed.evidence.filter(isPublicEvidenceReference);
    const evidenceIds = new Set(evidence.map(reference => reference.id));
    return {
        ...parsed,
        checks: sanitizeChecks(parsed.checks, evidenceIds),
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
        `preview: ${safe.previewId}`,
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

/**
 * Keeps release-gate results in the existing assets command exit taxonomy.
 */
export function gateReportExitCode(report: unknown): number {
    const parsed = parseVisualNovelReleaseGateReportV1(report);
    if (parsed.status === 'passed') return 0;

    const code = parsed.diagnostics[0]?.code ?? '';
    if (isDiagnosticCategory(code, 'configuration')) return 1;
    if (
        isDiagnosticCategory(code, 'storage') ||
        isDiagnosticCategory(code, 'environment') ||
        isDiagnosticCategory(code, 'prerequisite')
    ) {
        return 3;
    }
    if (isDiagnosticCategory(code, 'concurrency')) return 4;
    if (
        isDiagnosticCategory(code, 'activation-target') ||
        isDiagnosticCategory(code, 'operation') ||
        code === 'clock-skew' ||
        code === 'non-monotonic-pointer-time'
    ) {
        return 5;
    }
    return 2;
}
