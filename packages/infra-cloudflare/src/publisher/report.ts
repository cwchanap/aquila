import {
    isSafeRelativePath,
    type PublicationTarget,
    type StoryAssetCoverageReport,
} from '@aquila/stories/runtime-assets';
import type {
    EncoderFingerprintV1,
    PublisherActionV1,
    PublisherCommandName,
    PublisherCountsV1,
    PublisherDiagnosticV1,
    PublisherProgressEvent,
} from './types';

export const MAX_REPORT_DIAGNOSTIC_SAMPLES = 5;

export interface PublisherReportV1 {
    schemaVersion: 1;
    command: PublisherCommandName;
    status: 'success' | 'no-op' | 'failed' | 'conflict';
    storyId: string;
    target: PublicationTarget;
    releaseId?: string;
    manifestSha256?: string;
    encoderFingerprint?: EncoderFingerprintV1;
    coverage?: StoryAssetCoverageReport;
    counts: PublisherCountsV1;
    actions: PublisherActionV1[];
    warnings: PublisherDiagnosticV1[];
    errors: PublisherDiagnosticV1[];
    pointer?: {
        beforeReleaseId?: string;
        afterReleaseId?: string;
        changed: boolean;
    };
}

export type ProgressSink = (event: PublisherProgressEvent) => void;

interface WritableProgressStream {
    write(chunk: string): unknown;
}

function compareText(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function redactAbsolutePaths(value: string): string {
    return value
        .replace(/file:\/\/\/[^\s"',)}\]]+/gi, '[redacted-path]')
        .replace(
            /(^|[^A-Za-z0-9._~\\/-])\\\\[^\s"',)}\]]+/g,
            (_match, prefix: string) => `${prefix}[redacted-path]`
        )
        .replace(
            /(^|[^A-Za-z0-9._~/-])\/(?!\/)[^\s"',)}\]]+/g,
            (_match, prefix: string) => `${prefix}[redacted-path]`
        )
        .replace(
            /(^|[^A-Za-z0-9._~/-])[A-Za-z]:\\[^\s"',)}\]]+/g,
            (_match, prefix: string) => `${prefix}[redacted-path]`
        );
}

function safeSingleLine(value: string): string {
    return redactAbsolutePaths(value)
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
}

function samples(values: readonly (string | undefined)[]): string[] {
    return [
        ...new Set(
            values.filter((value): value is string => value !== undefined)
        ),
    ]
        .sort(compareText)
        .slice(0, MAX_REPORT_DIAGNOSTIC_SAMPLES);
}

function sanitizeDiagnostic(
    diagnostic: PublisherDiagnosticV1
): PublisherDiagnosticV1 {
    const sampleSafePaths = samples(
        diagnostic.sampleSafePaths?.filter(isSafeRelativePath) ?? []
    );
    const safePath =
        diagnostic.safePath !== undefined &&
        isSafeRelativePath(diagnostic.safePath)
            ? diagnostic.safePath
            : undefined;
    const sampleIdentities = samples(
        diagnostic.sampleIdentities?.map(safeSingleLine) ?? []
    );
    return {
        code: safeSingleLine(diagnostic.code),
        stage: safeSingleLine(diagnostic.stage),
        message: safeSingleLine(diagnostic.message),
        ...(diagnostic.assetType === undefined
            ? {}
            : { assetType: diagnostic.assetType }),
        ...(diagnostic.identity === undefined
            ? {}
            : { identity: safeSingleLine(diagnostic.identity) }),
        ...(safePath === undefined ? {} : { safePath }),
        ...(diagnostic.count === undefined ? {} : { count: diagnostic.count }),
        ...(sampleIdentities.length === 0 ? {} : { sampleIdentities }),
        ...(sampleSafePaths.length === 0 ? {} : { sampleSafePaths }),
    };
}

export function normalizeReportDiagnostics(
    diagnostics: readonly PublisherDiagnosticV1[]
): PublisherDiagnosticV1[] {
    const groups = new Map<string, PublisherDiagnosticV1[]>();
    for (const diagnostic of diagnostics.map(sanitizeDiagnostic)) {
        const key = [
            diagnostic.code,
            diagnostic.stage,
            diagnostic.assetType ?? '',
            diagnostic.message,
        ].join('\u0000');
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [diagnostic]);
        else group.push(diagnostic);
    }
    return [...groups.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([, group]) => {
            const first = group[0]!;
            const sampleIdentities = samples(
                group.flatMap(diagnostic => [
                    diagnostic.identity,
                    ...(diagnostic.sampleIdentities ?? []),
                ])
            );
            const sampleSafePaths = samples(
                group.flatMap(diagnostic => [
                    diagnostic.safePath,
                    ...(diagnostic.sampleSafePaths ?? []),
                ])
            );
            const count = group.reduce(
                (sum, diagnostic) => sum + (diagnostic.count ?? 1),
                0
            );
            return {
                code: first.code,
                stage: first.stage,
                message: first.message,
                ...(first.assetType === undefined
                    ? {}
                    : { assetType: first.assetType }),
                ...(count === 1 && first.identity !== undefined
                    ? { identity: first.identity }
                    : {}),
                ...(count === 1 && first.safePath !== undefined
                    ? { safePath: first.safePath }
                    : {}),
                count,
                ...(sampleIdentities.length === 0 ? {} : { sampleIdentities }),
                ...(sampleSafePaths.length === 0 ? {} : { sampleSafePaths }),
            };
        });
}

function sanitizeAction(action: PublisherActionV1): PublisherActionV1 {
    return {
        stage: safeSingleLine(action.stage),
        kind: action.kind,
        ...(action.identity === undefined
            ? {}
            : { identity: safeSingleLine(action.identity) }),
        ...(action.key === undefined || !isSafeRelativePath(action.key)
            ? {}
            : { key: action.key }),
    };
}

type CoverageCounts = StoryAssetCoverageReport['totals'];

function copyCoverageCounts(counts: CoverageCounts): CoverageCounts {
    return {
        total: counts.total,
        included: counts.included,
        omitted: counts.omitted,
        unclassified: counts.unclassified,
    };
}

function addCoverageCounts(
    left: CoverageCounts | undefined,
    right: CoverageCounts
): CoverageCounts {
    return {
        total: (left?.total ?? 0) + right.total,
        included: (left?.included ?? 0) + right.included,
        omitted: (left?.omitted ?? 0) + right.omitted,
        unclassified: (left?.unclassified ?? 0) + right.unclassified,
    };
}

function sanitizeCoverage(
    coverage: StoryAssetCoverageReport
): StoryAssetCoverageReport {
    const bySection: Record<string, CoverageCounts> = Object.create(
        null
    ) as Record<string, CoverageCounts>;
    for (const [section, counts] of Object.entries(coverage.bySection).sort(
        ([left], [right]) => compareText(left, right)
    )) {
        const safeSection = safeSingleLine(section);
        bySection[safeSection] = addCoverageCounts(
            bySection[safeSection],
            counts
        );
    }
    return {
        storyId: safeSingleLine(coverage.storyId),
        byType: {
            background: copyCoverageCounts(coverage.byType.background),
            portrait: copyCoverageCounts(coverage.byType.portrait),
        },
        bySection,
        totals: copyCoverageCounts(coverage.totals),
    };
}

function sanitizeTarget(target: PublicationTarget): PublicationTarget {
    return target.kind === 'production'
        ? { kind: 'production' }
        : { kind: 'preview', previewId: safeSingleLine(target.previewId) };
}

function sanitizeFingerprint(
    fingerprint: EncoderFingerprintV1
): EncoderFingerprintV1 {
    return {
        schemaVersion: 1,
        policyId: 'aquila-vn-encoder-v1',
        sharpVersion: safeSingleLine(fingerprint.sharpVersion),
        libvipsVersion: safeSingleLine(fingerprint.libvipsVersion),
        platform: fingerprint.platform,
        arch: safeSingleLine(fingerprint.arch),
    };
}

function publicReport(report: PublisherReportV1): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: report.command,
        status: report.status,
        storyId: safeSingleLine(report.storyId),
        target: sanitizeTarget(report.target),
        ...(report.releaseId === undefined
            ? {}
            : { releaseId: report.releaseId }),
        ...(report.manifestSha256 === undefined
            ? {}
            : { manifestSha256: report.manifestSha256 }),
        ...(report.encoderFingerprint === undefined
            ? {}
            : {
                  encoderFingerprint: sanitizeFingerprint(
                      report.encoderFingerprint
                  ),
              }),
        ...(report.coverage === undefined
            ? {}
            : { coverage: sanitizeCoverage(report.coverage) }),
        counts: {
            included: report.counts.included,
            omitted: report.counts.omitted,
            objectsCreated: report.counts.objectsCreated,
            objectsReused: report.counts.objectsReused,
            manifestsCreated: report.counts.manifestsCreated,
            manifestsReused: report.counts.manifestsReused,
            pointersWritten: report.counts.pointersWritten,
        },
        actions: report.actions.map(sanitizeAction),
        warnings: report.warnings.map(sanitizeDiagnostic),
        errors: report.errors.map(sanitizeDiagnostic),
        ...(report.pointer === undefined
            ? {}
            : {
                  pointer: {
                      ...(report.pointer.beforeReleaseId === undefined
                          ? {}
                          : {
                                beforeReleaseId: report.pointer.beforeReleaseId,
                            }),
                      ...(report.pointer.afterReleaseId === undefined
                          ? {}
                          : { afterReleaseId: report.pointer.afterReleaseId }),
                      changed: report.pointer.changed,
                  },
              }),
    };
}

export function renderJsonReport(report: PublisherReportV1): string {
    return `${JSON.stringify(publicReport(report))}\n`;
}

export function renderHumanReport(report: PublisherReportV1): string {
    const safe = publicReport(report);
    const lines = [
        `command: ${safe.command}`,
        `status: ${safe.status}`,
        `story: ${safe.storyId}`,
    ];
    if (safe.releaseId !== undefined) lines.push(`release: ${safe.releaseId}`);
    lines.push(
        `objects: ${safe.counts.objectsCreated} create, ${safe.counts.objectsReused} reuse`,
        `manifests: ${safe.counts.manifestsCreated} create, ${safe.counts.manifestsReused} reuse`,
        `warnings: ${safe.warnings.length}`,
        `errors: ${safe.errors.length}`
    );
    return `${lines.join('\n')}\n`;
}

export function createHumanProgressSink(
    stderr: WritableProgressStream = process.stderr
): ProgressSink {
    return event => {
        const completed = Math.max(0, Math.trunc(event.completed));
        const total = Math.max(0, Math.trunc(event.total));
        const message = safeSingleLine(event.message);
        stderr.write(
            `${event.stage} ${completed}/${total}${message === '' ? '' : ` ${message}`}\n`
        );
    };
}

export function publisherReportExitCode(report: PublisherReportV1): number {
    if (report.status === 'success' || report.status === 'no-op') return 0;
    if (report.status === 'conflict') return 4;
    const code = report.errors[0]?.code ?? '';
    if (code === 'configuration') return 1;
    if (code === 'storage' || code.startsWith('storage/')) return 3;
    if (
        code === 'activation-target' ||
        code === 'clock-skew' ||
        code === 'non-monotonic-pointer-time'
    ) {
        return 5;
    }
    return 2;
}
