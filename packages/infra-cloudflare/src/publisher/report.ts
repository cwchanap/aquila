import {
    isPreviewId,
    isReleaseId,
    isSafeRelativePath,
    isSha256,
    isStoryId,
    isSafeLogicalKey,
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
    releases?: PublisherReleaseSummaryV1[];
}

export interface PublisherReleaseSummaryV1 {
    releaseId: string;
    manifestSha256?: string;
    manifestValid: boolean;
    releaseIdentityValid: boolean;
    shallowVerified: boolean;
    deepVerified: boolean;
    active: boolean;
}

export type ProgressSink = (event: PublisherProgressEvent) => void;

interface WritableProgressStream {
    write(chunk: string): unknown;
}

const PUBLISHER_STAGES = new Set([
    'input',
    'coverage',
    'source',
    'decode',
    'encode',
    'hash',
    'inspect',
    'object-inspection',
    'object-upload',
    'manifest',
    'manifest-upload',
    'upload',
    'verification',
    'verify',
    'activation',
    'activate',
    'rollback',
]);
const COMMANDS = new Set<PublisherCommandName>([
    'plan',
    'publish',
    'mirror-preview',
    'activate',
    'verify',
    'releases',
    'rollback',
]);
const STATUSES = new Set<PublisherReportV1['status']>([
    'success',
    'no-op',
    'failed',
    'conflict',
]);
const DIAGNOSTIC_CODES = new Set([
    'configuration',
    'input',
    'coverage',
    'source',
    'encoding',
    'integrity',
    'storage',
    'concurrency',
    'activation-target',
    'clock-skew',
    'non-monotonic-pointer-time',
    'source/aspect-ratio',
    'coverage/source-path-mismatch',
    'coverage/missing-source',
    'coverage/activation-not-allowed',
    'coverage/validation-failed',
    'pointer-invalid',
]);
const ACTION_KINDS = new Set<PublisherActionV1['kind']>([
    'include',
    'omit',
    'reuse-object',
    'create-object',
    'reuse-manifest',
    'create-manifest',
    'write-pointer',
    'no-op',
]);
const PLATFORMS = new Set<NodeJS.Platform>([
    'aix',
    'android',
    'darwin',
    'freebsd',
    'haiku',
    'linux',
    'openbsd',
    'sunos',
    'win32',
    'cygwin',
    'netbsd',
]);
const SAFE_VERSION = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;
const ARCHITECTURES = new Set([
    'arm',
    'arm64',
    'ia32',
    'loong64',
    'mips',
    'mipsel',
    'ppc',
    'ppc64',
    'riscv64',
    's390',
    's390x',
    'x64',
]);
const MAX_COVERAGE_SECTION_LENGTH = 200;
const URL_WITH_AUTHORITY_RE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const FILE_URL_RE = /^file:\//i;
const ABSOLUTE_PATH_PREFIX_RE = /^(?:\/|\\)/;
const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/;
const CANONICAL_ISO_TIMESTAMP_RE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function compareText(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function safeStage(value: string): string {
    return PUBLISHER_STAGES.has(value) ? value : 'publisher';
}

function safeCode(value: string): string {
    return DIAGNOSTIC_CODES.has(value) ? value : 'publisher/diagnostic';
}

function safeIdentity(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const separator = value.indexOf(':');
    if (separator <= 0) return undefined;
    const type = value.slice(0, separator);
    const key = value.slice(separator + 1);
    return (type === 'background' || type === 'portrait') &&
        isSafeLogicalKey(key)
        ? `${type}:${key}`
        : undefined;
}

function safeTimestamp(value: string | undefined): string | undefined {
    if (value === undefined || !CANONICAL_ISO_TIMESTAMP_RE.test(value)) {
        return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value
        ? undefined
        : value;
}

function safeDiagnosticMessage(
    code: string,
    assetType: PublisherDiagnosticV1['assetType']
): string {
    if (code === 'source/aspect-ratio' && assetType !== undefined) {
        return `Source aspect ratio differs from the ${assetType} policy`;
    }
    if (code === 'pointer-invalid') {
        return 'Current active-release pointer is invalid; every release is reported as inactive';
    }
    return 'Publisher diagnostic';
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
    const code = safeCode(diagnostic.code);
    const assetType =
        diagnostic.assetType === 'background' ||
        diagnostic.assetType === 'portrait'
            ? diagnostic.assetType
            : undefined;
    const sampleSafePaths = samples(
        diagnostic.sampleSafePaths?.filter(isSafeRelativePath) ?? []
    );
    const safePath =
        diagnostic.safePath !== undefined &&
        isSafeRelativePath(diagnostic.safePath)
            ? diagnostic.safePath
            : undefined;
    const sampleIdentities = samples(
        diagnostic.sampleIdentities?.map(safeIdentity) ?? []
    );
    const identity = safeIdentity(diagnostic.identity);
    const timestampDiagnostic =
        code === 'clock-skew' || code === 'non-monotonic-pointer-time';
    const previousPublishedAt = timestampDiagnostic
        ? safeTimestamp(diagnostic.previousPublishedAt)
        : undefined;
    const localNow = timestampDiagnostic
        ? safeTimestamp(diagnostic.localNow)
        : undefined;
    return {
        code,
        stage: safeStage(diagnostic.stage),
        message: safeDiagnosticMessage(code, assetType),
        ...(assetType === undefined ? {} : { assetType }),
        ...(identity === undefined ? {} : { identity }),
        ...(safePath === undefined ? {} : { safePath }),
        ...(diagnostic.count === undefined ||
        !Number.isSafeInteger(diagnostic.count) ||
        diagnostic.count < 1
            ? {}
            : { count: diagnostic.count }),
        ...(sampleIdentities.length === 0 ? {} : { sampleIdentities }),
        ...(sampleSafePaths.length === 0 ? {} : { sampleSafePaths }),
        ...(previousPublishedAt === undefined ? {} : { previousPublishedAt }),
        ...(localNow === undefined ? {} : { localNow }),
    };
}

export function normalizeReportDiagnostics(
    diagnostics: readonly PublisherDiagnosticV1[]
): PublisherDiagnosticV1[] {
    const groups = new Map<string, PublisherDiagnosticV1[]>();
    for (const diagnostic of diagnostics.map(sanitizeDiagnostic)) {
        const key = [
            diagnostic.code,
            diagnostic.assetType ?? '',
            diagnostic.previousPublishedAt ?? '',
            diagnostic.localNow ?? '',
        ].join('\u0000');
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [diagnostic]);
        else group.push(diagnostic);
    }
    return [...groups.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([, group]) => {
            const first = [...group].sort((left, right) =>
                compareText(
                    `${left.stage}\u0000${left.message}`,
                    `${right.stage}\u0000${right.message}`
                )
            )[0]!;
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
                ...(first.previousPublishedAt === undefined
                    ? {}
                    : { previousPublishedAt: first.previousPublishedAt }),
                ...(first.localNow === undefined
                    ? {}
                    : { localNow: first.localNow }),
            };
        });
}

function sanitizeAction(action: PublisherActionV1): PublisherActionV1 {
    const identity = safeIdentity(action.identity);
    const kind = ACTION_KINDS.has(action.kind) ? action.kind : 'no-op';
    const key = safeActionKey(kind, action.key);
    return {
        stage: safeStage(action.stage),
        kind,
        ...(identity === undefined ? {} : { identity }),
        ...(key === undefined ? {} : { key }),
    };
}

function safeActionKey(
    kind: PublisherActionV1['kind'],
    key: string | undefined
): string | undefined {
    if (key === undefined || !isSafeRelativePath(key)) return undefined;
    const isOwned =
        kind === 'reuse-object' || kind === 'create-object'
            ? isObjectPath(key)
            : kind === 'reuse-manifest' || kind === 'create-manifest'
              ? isReleaseManifestPath(key)
              : kind === 'write-pointer'
                ? isCurrentPointerPath(key)
                : false;
    return isOwned ? key : undefined;
}

function isObjectPath(key: string): boolean {
    const segments = key.split('/');
    if (
        segments.length !== 3 ||
        segments[0] !== 'vn' ||
        segments[1] !== 'objects'
    ) {
        return false;
    }
    const match = /^([a-f0-9]{64})\.(webp|avif)$/.exec(segments[2]!);
    return match !== null && isSha256(match[1]!);
}

function isReleaseManifestPath(key: string): boolean {
    const segments = key.split('/');
    if (
        segments.length === 6 &&
        segments[0] === 'vn' &&
        segments[1] === 'stories' &&
        isStoryId(segments[2]!) &&
        segments[3] === 'releases' &&
        isReleaseId(segments[4]!) &&
        segments[5] === 'runtime-manifest.json'
    ) {
        return true;
    }
    return (
        segments.length === 8 &&
        segments[0] === 'vn' &&
        segments[1] === 'previews' &&
        isPreviewId(segments[2]!) &&
        segments[3] === 'stories' &&
        isStoryId(segments[4]!) &&
        segments[5] === 'releases' &&
        isReleaseId(segments[6]!) &&
        segments[7] === 'runtime-manifest.json'
    );
}

function isCurrentPointerPath(key: string): boolean {
    const segments = key.split('/');
    if (
        segments.length === 4 &&
        segments[0] === 'vn' &&
        segments[1] === 'stories' &&
        isStoryId(segments[2]!) &&
        segments[3] === 'current.json'
    ) {
        return true;
    }
    return (
        segments.length === 6 &&
        segments[0] === 'vn' &&
        segments[1] === 'previews' &&
        isPreviewId(segments[2]!) &&
        segments[3] === 'stories' &&
        isStoryId(segments[4]!) &&
        segments[5] === 'current.json'
    );
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

function isSafeCoverageSection(section: string): boolean {
    const threatCandidate = section.trim();
    return (
        section.length <= MAX_COVERAGE_SECTION_LENGTH &&
        isSafeLogicalKey(section) &&
        !ABSOLUTE_PATH_PREFIX_RE.test(threatCandidate) &&
        !WINDOWS_DRIVE_PATH_RE.test(threatCandidate) &&
        !URL_WITH_AUTHORITY_RE.test(threatCandidate) &&
        !FILE_URL_RE.test(threatCandidate)
    );
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
        const safeSection = isSafeCoverageSection(section)
            ? section
            : '[redacted-section]';
        bySection[safeSection] = addCoverageCounts(
            bySection[safeSection],
            counts
        );
    }
    return {
        storyId: isStoryId(coverage.storyId)
            ? coverage.storyId
            : '[redacted-story]',
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
        : {
              kind: 'preview',
              previewId: isPreviewId(target.previewId)
                  ? target.previewId
                  : 'redacted',
          };
}

function sanitizeFingerprint(
    fingerprint: EncoderFingerprintV1
): EncoderFingerprintV1 {
    return {
        schemaVersion: 1,
        policyId: 'aquila-vn-encoder-v1',
        sharpVersion: SAFE_VERSION.test(fingerprint.sharpVersion)
            ? fingerprint.sharpVersion
            : '[redacted]',
        libvipsVersion: SAFE_VERSION.test(fingerprint.libvipsVersion)
            ? fingerprint.libvipsVersion
            : '[redacted]',
        platform: PLATFORMS.has(fingerprint.platform)
            ? fingerprint.platform
            : 'linux',
        arch: ARCHITECTURES.has(fingerprint.arch)
            ? fingerprint.arch
            : '[redacted]',
    };
}

function sanitizeReleaseSummaries(
    releases: readonly PublisherReleaseSummaryV1[]
): PublisherReleaseSummaryV1[] {
    return releases
        .filter(release => isReleaseId(release.releaseId))
        .map(release => ({
            releaseId: release.releaseId,
            ...(release.manifestSha256 === undefined ||
            !isSha256(release.manifestSha256)
                ? {}
                : { manifestSha256: release.manifestSha256 }),
            manifestValid: release.manifestValid === true,
            releaseIdentityValid: release.releaseIdentityValid === true,
            shallowVerified: release.shallowVerified === true,
            deepVerified: release.deepVerified === true,
            active: release.active === true,
        }))
        .sort((left, right) => compareText(left.releaseId, right.releaseId));
}

function publicReport(report: PublisherReportV1): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: COMMANDS.has(report.command) ? report.command : 'plan',
        status: STATUSES.has(report.status) ? report.status : 'failed',
        storyId: isStoryId(report.storyId)
            ? report.storyId
            : '[redacted-story]',
        target: sanitizeTarget(report.target),
        ...(report.releaseId === undefined || !isReleaseId(report.releaseId)
            ? {}
            : { releaseId: report.releaseId }),
        ...(report.manifestSha256 === undefined ||
        !isSha256(report.manifestSha256)
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
        warnings: normalizeReportDiagnostics(report.warnings),
        errors: normalizeReportDiagnostics(report.errors),
        ...(report.pointer === undefined
            ? {}
            : {
                  pointer: {
                      ...(report.pointer.beforeReleaseId === undefined ||
                      !isReleaseId(report.pointer.beforeReleaseId)
                          ? {}
                          : {
                                beforeReleaseId: report.pointer.beforeReleaseId,
                            }),
                      ...(report.pointer.afterReleaseId === undefined ||
                      !isReleaseId(report.pointer.afterReleaseId)
                          ? {}
                          : { afterReleaseId: report.pointer.afterReleaseId }),
                      changed: report.pointer.changed,
                  },
              }),
        ...(report.releases === undefined
            ? {}
            : { releases: sanitizeReleaseSummaries(report.releases) }),
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
    if (safe.releases !== undefined) {
        lines.push(`releases: ${safe.releases.length}`);
        for (const release of safe.releases) {
            const verification = release.deepVerified
                ? 'deep verified'
                : release.shallowVerified
                  ? 'shallow verified'
                  : 'unverified';
            lines.push(
                `- ${release.releaseId} ${release.active ? 'active' : 'inactive'}, ${verification}` +
                    (release.manifestSha256 === undefined
                        ? ''
                        : `, manifest ${release.manifestSha256}`)
            );
        }
    }
    return `${lines.join('\n')}\n`;
}

export function createHumanProgressSink(
    stderr: WritableProgressStream = process.stderr
): ProgressSink {
    const safe = (value: number): number =>
        Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    return event => {
        const completed = safe(event.completed);
        const total = safe(event.total);
        stderr.write(`${safeStage(event.stage)} ${completed}/${total}\n`);
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
