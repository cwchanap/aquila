import type { z } from 'zod';
import { AssetResolverError, type AssetResolverErrorCode } from './errors';
import { getReleaseManifestPath, qualifyAssetIdentity } from './paths';
import {
    ActiveReleasePointerV1Schema,
    RuntimeAssetManifestV1Schema,
    StoryAssetReleasePlanV1Schema,
    type ActiveReleasePointerV1,
    type AssetType,
    type LogicalAssetIdentity,
    type ManifestByteSha256,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
    type StoryAssetReleasePlanV1,
} from './schemas';

const FORBIDDEN_RUNTIME_KEY_PARTS = [
    'prompt',
    'prompts',
    'sourcepath',
    'sourcepaths',
    'localpath',
    'localpaths',
    // Equivalent alternative spellings for authoring source/local filesystem
    // paths. The contract forbids source paths in public runtime data
    // regardless of field name; these cover `sourceFile`, `localFile`, and
    // their plurals, which would otherwise bypass the `sourcepath`/`localpath`
    // stems and slip past the forbidden-key heuristic.
    'sourcefile',
    'sourcefiles',
    'localfile',
    'localfiles',
    'provider',
    'providers',
    'credential',
    'credentials',
    'secret',
    'secrets',
    'token',
    'tokens',
    'apikey',
    'apikeys',
] as const;

// Recognize numbers and numeric strings so a stringified version like "2" is
// reported as an unsupported version rather than a generic schema error.
function toVersionNumber(version: unknown): number | undefined {
    if (typeof version === 'number') return version;
    if (typeof version === 'string' && /^\d+$/.test(version)) {
        return Number(version);
    }
    return undefined;
}

function assertKnownVersion(
    input: unknown,
    expectedVersion: number,
    contractName: string
): void {
    if (
        typeof input !== 'object' ||
        input === null ||
        !('schemaVersion' in input)
    ) {
        // An absent version is a malformed document; leave it to the schema's
        // `z.literal` to reject as a plain validation error.
        return;
    }
    const version = (input as { schemaVersion: unknown }).schemaVersion;
    const numericVersion = toVersionNumber(version);
    if (numericVersion !== undefined && numericVersion !== expectedVersion) {
        throw new AssetResolverError(
            'unknown-schema-version',
            `Unsupported ${contractName} schema version: ${String(version)}`
        );
    }
}

// Normalizes a key for forbidden-part matching: lowercases it, drops `_-`
// delimiters, and records which positions in the normalized string begin a new
// word (start-of-string, a delimiter, or a lowercase→uppercase camelCase
// transition). A forbidden part matches only when it spans a whole token — i.e.
// starts and ends at word boundaries — so `secret` catches `secret`,
// `secretPath`, and `secret_path`, but NOT `secretary`; `sourcepath` catches
// `sourcePath` and `source_path` but NOT `sourcepathology`.
function normalizeKeyWithBoundaries(key: string): {
    normalized: string;
    wordStarts: boolean[];
} {
    const chars: string[] = [];
    const wordStarts: boolean[] = [];
    for (let i = 0; i < key.length; i++) {
        const ch = key[i];
        if (ch === '_' || ch === '-') continue;
        const prev = i > 0 ? key[i - 1] : '';
        const isWordStart =
            chars.length === 0 ||
            prev === '_' ||
            prev === '-' ||
            (ch >= 'A' && ch <= 'Z' && prev >= 'a' && prev <= 'z');
        chars.push(ch.toLowerCase());
        wordStarts.push(isWordStart);
    }
    return { normalized: chars.join(''), wordStarts };
}

function keyContainsForbiddenPart(
    normalized: string,
    wordStarts: boolean[],
    part: string
): boolean {
    let from = 0;
    let idx: number;
    while ((idx = normalized.indexOf(part, from)) !== -1) {
        const end = idx + part.length;
        const startsAtBoundary = idx === 0 || wordStarts[idx];
        const endsAtBoundary =
            end === normalized.length || wordStarts[end] === true;
        if (startsAtBoundary && endsAtBoundary) return true;
        from = idx + 1;
    }
    return false;
}

function findForbiddenRuntimeFields(input: unknown, path = '$'): string[] {
    if (Array.isArray(input)) {
        return input.flatMap((item, index) =>
            findForbiddenRuntimeFields(item, `${path}[${index}]`)
        );
    }
    if (typeof input !== 'object' || input === null) return [];

    const findings: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        const { normalized, wordStarts } = normalizeKeyWithBoundaries(key);
        if (
            FORBIDDEN_RUNTIME_KEY_PARTS.some(part =>
                keyContainsForbiddenPart(normalized, wordStarts, part)
            )
        ) {
            findings.push(`${path}.${key}`);
        }
        findings.push(...findForbiddenRuntimeFields(value, `${path}.${key}`));
    }
    return findings;
}

// The contract forbids environment-specific absolute URLs in public runtime
// manifests and pointers (no schemes, credentials, queries, or fragments
// anywhere). The forbidden-key heuristic above only inspects property names, so
// an unknown field such as `sourceUrl` or a nested `metadata.origin` whose
// value is an absolute URL would slip past it and then be silently stripped by
// Zod (the manifest/pointer schemas are intentionally non-strict to allow
// additive forward-compatible fields). The raw document has already exposed
// the value by that point.
//
// This check inspects string VALUES — but only under UNKNOWN (additive) keys.
// Known schema fields are skipped because:
//   1. Their values are already validated by Zod for safety (paths are
//      relative, story IDs are slugs, digests are hex, etc.).
//   2. Some known fields intentionally permit colons — `identity.key` (a
//      logical key) and `section` (free-form prose) can legitimately be
//      `chapter:night` or `prologue:intro`, which a naive scheme-prefix regex
//      would falsely reject as an absolute URL.
// `section` is the exception: its Zod schema only checks length, so a concrete
// URL form (`https://...`, `file:///...`, `//host/...`) or an absolute
// filesystem path (`/Users/...`, `C:\Users\...`, `\\server\share\...`,
// `\Users\...`) would pass Zod and enter the parsed manifest. It is therefore
// registered in `environmentStrictScalars` and checked with both
// `isConcreteUrlValue` (which requires `://` or a leading `//` and so still
// accepts label-style values) and `isAbsoluteFilePathValue` (which rejects
// Unix, Windows drive-letter, UNC, and Windows root-relative paths).
//
// It detects both scheme-bearing absolute URLs (`http:`, `https:`, `file:`,
// ...) and protocol-relative URLs (`//host/path`), which the scheme-only regex
// missed and which would otherwise be silently stripped by the non-strict
// schema as unknown-field values.
//
// Detection runs against `value.trimStart()` because the scan executes BEFORE
// Zod parsing, and several known string fields use `.trim()` — without
// trimming on the detection side, a value like ` https://...` would bypass
// the anchored regex and then be silently normalized by Zod into an absolute
// URL inside the parsed document.
const ABSOLUTE_URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const PROTOCOL_RELATIVE_URL_RE = /^\/\//;
function isAbsoluteUrlValue(value: string): boolean {
    const trimmed = value.trimStart();
    return (
        ABSOLUTE_URL_SCHEME_RE.test(trimmed) ||
        PROTOCOL_RELATIVE_URL_RE.test(trimmed)
    );
}

// A stricter detector used for known scalar fields that legitimately permit
// colon-bearing labels (e.g. `section` can be `chapter:night`). The broad
// `ABSOLUTE_URL_SCHEME_RE` would falsely reject those labels because they
// match `scheme:`. This detector requires `://` after the scheme, which
// distinguishes concrete URL forms (`https://...`, `file:///...`) from
// label-style values (`chapter:night`, `prologue:intro`). Protocol-relative
// URLs (`//host/...`) carry no scheme and are rejected separately.
//
// Scheme-name detection: valid absolute URLs do not always use `://`
// immediately after the scheme. `https:host/path` (opaque path), `file:/path`
// (single-slash file URL per RFC 8089), and `blob:https://origin/id` (blob
// URL) are all absolute, environment-bearing URLs that the `://`-requiring
// regex missed — they would pass the section check and enter the parsed
// manifest, contradicting the contract. To close that gap without rejecting
// label-style values like `chapter:night`, known environment-bearing scheme
// names are rejected regardless of slash count. `chapter` is not in that set,
// so label-style sections remain acceptable.
const ENVIRONMENT_BEARING_SCHEMES = new Set([
    'http',
    'https',
    'file',
    'ftp',
    'blob',
]);
const SCHEME_PREFIX_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const CONCRETE_URL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
function isConcreteUrlValue(value: string): boolean {
    const trimmed = value.trimStart();
    if (CONCRETE_URL_RE.test(trimmed)) return true;
    if (PROTOCOL_RELATIVE_URL_RE.test(trimmed)) return true;
    const schemeMatch = SCHEME_PREFIX_RE.exec(trimmed);
    if (
        schemeMatch !== null &&
        ENVIRONMENT_BEARING_SCHEMES.has(schemeMatch[1].toLowerCase())
    ) {
        return true;
    }
    return false;
}

// Detects absolute filesystem paths in unknown additive metadata. The URL
// scan above catches scheme-bearing and protocol-relative URLs, but a bare
// filesystem path (`/Users/alice/...`, `C:\Users\...`, `C:/Users/...`) is not
// URL-prefixed, so an unknown field carrying one would bypass the URL scan
// and be silently stripped by the non-strict schema — leaving the wire
// document exposed. The contract forbids environment-specific absolute paths
// in public runtime data regardless of field name, so the unknown-field scan
// also rejects obvious absolute filesystem paths. Relative paths do not
// start with `/`, `\`, or a drive letter and remain acceptable.
//
// A leading backslash is treated as an absolute path: it covers Windows UNC
// paths (`\\server\share\...`) and Windows root-relative paths (`\Users\...`)
// that the drive-letter regex missed. The codebase convention is
// forward-slash-only relative paths (`isSafeRelativePath` rejects any value
// containing `\`), so a backslash-leading value in runtime data is never a
// legitimate relative path.
const ABSOLUTE_UNIX_PATH_RE = /^\//;
const WINDOWS_DRIVE_PATH_RE = /^[a-zA-Z]:[\\/]/;
function isAbsoluteFilePathValue(value: string): boolean {
    const trimmed = value.trimStart();
    return (
        ABSOLUTE_UNIX_PATH_RE.test(trimmed) ||
        trimmed.startsWith('\\') ||
        WINDOWS_DRIVE_PATH_RE.test(trimmed)
    );
}

function isEnvironmentSpecificValue(value: string): boolean {
    return isAbsoluteUrlValue(value) || isAbsoluteFilePathValue(value);
}

// Describes the known (schema-validated) shape of a wire document so the URL
// scan can skip known fields and only inspect unknown additive metadata. Scalar
// keys hold primitives validated by Zod; object/array keys describe the nested
// shape to recurse into. Anything not in the shape is unknown and gets fully
// scanned.
//
// `environmentStrictScalars` are known string fields whose Zod schema permits
// colon-bearing labels (e.g. `section` accepts `chapter:night`) and therefore
// cannot be checked with the broad scheme-prefix regex. They are checked with
// the stricter `isConcreteUrlValue` detector (which rejects `scheme://` and
// protocol-relative forms while allowing label-style values) AND with
// `isAbsoluteFilePathValue` (which rejects Unix, Windows drive-letter, UNC,
// and Windows root-relative paths). The broad `isEnvironmentSpecificValue`
// detector is NOT used here because its URL component (`isAbsoluteUrlValue`)
// matches any `scheme:` prefix and would falsely reject label-style values
// like `chapter:night`.
type KnownShape = {
    readonly scalars: ReadonlySet<string>;
    readonly environmentStrictScalars?: ReadonlySet<string>;
    readonly objects: Readonly<Record<string, KnownShape>>;
    readonly arrays: Readonly<Record<string, KnownShape>>;
};

const VARIANT_SHAPE: KnownShape = {
    scalars: new Set(['format', 'path', 'sha256', 'byteLength']),
    objects: {},
    arrays: {},
};

const MANIFEST_SHAPE: KnownShape = {
    scalars: new Set(['schemaVersion', 'storyId', 'releaseId']),
    objects: {},
    arrays: {
        assets: {
            scalars: new Set(['width', 'height']),
            environmentStrictScalars: new Set(['section']),
            objects: {
                identity: {
                    scalars: new Set(['type', 'key']),
                    objects: {},
                    arrays: {},
                },
                variants: {
                    scalars: new Set(),
                    objects: {
                        webp: VARIANT_SHAPE,
                        avif: VARIANT_SHAPE,
                    },
                    arrays: {},
                },
                placeholder: {
                    scalars: new Set([
                        'format',
                        'path',
                        'sha256',
                        'width',
                        'height',
                    ]),
                    objects: {},
                    arrays: {},
                },
            },
            arrays: {},
        },
    },
};

const POINTER_SHAPE: KnownShape = {
    scalars: new Set([
        'schemaVersion',
        'storyId',
        'releaseId',
        'manifestPath',
        'manifestSha256',
        'publishedAt',
    ]),
    objects: {},
    arrays: {},
};

// Scan every string value under `input` for environment-specific absolute
// references — URLs (scheme-bearing or protocol-relative) and absolute
// filesystem paths (Unix `/...` or Windows `C:\...`/`C:/...`) — regardless of
// key names. Used once we've descended into an unknown (additive) field where
// everything below is also unknown.
function scanAllStringsForUrls(input: unknown, path: string): string[] {
    if (typeof input === 'string') {
        return isEnvironmentSpecificValue(input) ? [path] : [];
    }
    if (Array.isArray(input)) {
        return input.flatMap((item, index) =>
            scanAllStringsForUrls(item, `${path}[${index}]`)
        );
    }
    if (typeof input !== 'object' || input === null) return [];
    const findings: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        findings.push(...scanAllStringsForUrls(value, `${path}.${key}`));
    }
    return findings;
}

// Walk `input` alongside the known schema shape. Known scalar keys are skipped
// (Zod validates them). Known object/array keys are recursed into with their
// nested shape. Unknown keys are fully scanned for absolute URL values.
function findAbsoluteUrlValues(
    input: unknown,
    shape: KnownShape,
    path = '$'
): string[] {
    if (typeof input === 'string') {
        // Only reached at the top level if the entire document is a string;
        // treat it as unknown and scan.
        return isEnvironmentSpecificValue(input) ? [path] : [];
    }
    if (Array.isArray(input)) {
        // An array at a position where the shape expects an array element
        // shape — recurse with the same element shape. If the shape doesn't
        // expect an array here, scan everything.
        return input.flatMap((item, index) =>
            findAbsoluteUrlValues(item, shape, `${path}[${index}]`)
        );
    }
    if (typeof input !== 'object' || input === null) return [];
    const findings: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        const childPath = `${path}.${key}`;
        if (shape.scalars.has(key)) {
            // Known scalar — Zod validates its value; skip.
            continue;
        }
        if (shape.environmentStrictScalars?.has(key)) {
            // Known scalar whose Zod schema permits colon-bearing labels
            // (e.g. `section`). Zod only checks length, so a concrete URL
            // form or an absolute filesystem path would pass Zod and enter
            // the parsed manifest. Reject both here: URLs with the stricter
            // `://`-aware detector (which still allows label-style values
            // like `chapter:night`), and filesystem paths with
            // `isAbsoluteFilePathValue` (Unix, Windows drive-letter, UNC,
            // and Windows root-relative). The broad
            // `isEnvironmentSpecificValue` is NOT used because its URL
            // component matches any `scheme:` prefix and would falsely
            // reject `chapter:night`.
            if (
                typeof value === 'string' &&
                (isConcreteUrlValue(value) || isAbsoluteFilePathValue(value))
            ) {
                findings.push(childPath);
            }
            continue;
        }
        // `Object.hasOwn` (not `in`) — `shape.objects`/`shape.arrays` are
        // ordinary objects inheriting from Object.prototype, so `in` would
        // match `constructor`, `toString`, `__proto__`, etc. An additive field
        // named `constructor` would then recurse with `Object.prototype.constructor`
        // (the `Object` function) as the "shape", and `Object.scalars.has(...)`
        // throws a raw TypeError. `Object.hasOwn` restricts the check to own
        // properties so unknown inherited-name keys fall through to the
        // unknown-field scan below.
        if (Object.hasOwn(shape.objects, key)) {
            findings.push(
                ...findAbsoluteUrlValues(value, shape.objects[key], childPath)
            );
        } else if (Object.hasOwn(shape.arrays, key)) {
            const elementShape = shape.arrays[key];
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    findings.push(
                        ...findAbsoluteUrlValues(
                            value[i],
                            elementShape,
                            `${childPath}[${i}]`
                        )
                    );
                }
            }
        } else {
            // Unknown additive key — scan all string values beneath it.
            findings.push(...scanAllStringsForUrls(value, childPath));
        }
    }
    return findings;
}

function errorCodeForZod(error: z.ZodError): AssetResolverErrorCode {
    // Classify by a fixed precedence (unsafe-path > integrity > validation) so a
    // document with several issues always reports the same code regardless of
    // Zod's traversal order. An unsafe path is the most actionable/security-
    // relevant signal, so it wins even when it co-occurs with an integrity issue.
    let integritySeen = false;
    for (const issue of error.issues) {
        // `params` only exists on `ZodCustomIssue`; the union does not expose it.
        if (issue.code !== 'custom') continue;
        const code = (issue.params as { assetErrorCode?: unknown } | undefined)
            ?.assetErrorCode;
        if (code === 'unsafe-path') return 'unsafe-path';
        if (code === 'integrity') integritySeen = true;
    }
    return integritySeen ? 'integrity' : 'validation';
}

function formatZodIssue(issue: z.ZodIssue): string {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
}

function parseSchema<T>(
    schema: {
        safeParse: (input: unknown) => z.SafeParseReturnType<unknown, T>;
    },
    input: unknown,
    contractName: string
): T {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw new AssetResolverError(
            errorCodeForZod(result.error),
            `Invalid ${contractName}`,
            {
                cause: result.error,
                details: result.error.issues.map(formatZodIssue),
            }
        );
    }
    return result.data;
}

export function parseRuntimeAssetManifest(
    input: unknown
): RuntimeAssetManifestV1 {
    assertKnownVersion(input, 1, 'runtime manifest');
    const forbiddenFields = findForbiddenRuntimeFields(input);
    if (forbiddenFields.length > 0) {
        throw new AssetResolverError(
            'validation',
            'Runtime manifests must not expose authoring or provider metadata',
            { details: forbiddenFields }
        );
    }
    const urlFields = findAbsoluteUrlValues(input, MANIFEST_SHAPE);
    if (urlFields.length > 0) {
        throw new AssetResolverError(
            'unsafe-path',
            'Runtime manifests must not contain absolute URL values',
            { details: urlFields }
        );
    }
    return parseSchema(
        RuntimeAssetManifestV1Schema,
        input,
        'runtime asset manifest'
    );
}

export function parseActiveReleasePointer(
    input: unknown,
    target: PublicationTarget = { kind: 'production' },
    expectedStoryId: string
): ActiveReleasePointerV1 {
    assertKnownVersion(input, 1, 'active-release pointer');
    const forbiddenFields = findForbiddenRuntimeFields(input);
    if (forbiddenFields.length > 0) {
        throw new AssetResolverError(
            'validation',
            'Active-release pointers must not expose authoring or provider metadata',
            { details: forbiddenFields }
        );
    }
    const urlFields = findAbsoluteUrlValues(input, POINTER_SHAPE);
    if (urlFields.length > 0) {
        throw new AssetResolverError(
            'unsafe-path',
            'Active-release pointers must not contain absolute URL values',
            { details: urlFields }
        );
    }
    const pointer = parseSchema(
        ActiveReleasePointerV1Schema,
        input,
        'active-release pointer'
    );
    // The pointer is fetched from a story-scoped path (`<storyId>/current.json`)
    // and must agree with the story the resolver requested. Without this check a
    // pointer returned for story A could claim story B's manifest path and pass
    // `validatePointerManifestPair`, which only proves the pointer and manifest
    // agree with each other — not that either agrees with the resolver source.
    // `AssetResolverSource` always carries a `storyId`, so callers always have
    // the required value.
    if (pointer.storyId !== expectedStoryId) {
        throw new AssetResolverError(
            'story-mismatch',
            `Pointer story id ${pointer.storyId} does not match requested story ${expectedStoryId}`
        );
    }
    const expectedPath = getReleaseManifestPath(
        pointer.storyId,
        pointer.releaseId,
        target
    );
    if (pointer.manifestPath !== expectedPath) {
        throw new AssetResolverError(
            'unsafe-path',
            `Pointer manifestPath must equal ${expectedPath}`
        );
    }
    return pointer;
}

export function parseStoryAssetReleasePlan(
    input: unknown
): StoryAssetReleasePlanV1 {
    assertKnownVersion(input, 1, 'story asset release plan');
    return parseSchema(
        StoryAssetReleasePlanV1Schema,
        input,
        'story asset release plan'
    );
}

export function validatePointerManifestPair(
    pointer: ActiveReleasePointerV1,
    manifest: RuntimeAssetManifestV1,
    actualManifestSha256: ManifestByteSha256
): void {
    if (pointer.storyId !== manifest.storyId) {
        throw new AssetResolverError(
            'story-mismatch',
            'Pointer and manifest story ids differ'
        );
    }
    if (pointer.releaseId !== manifest.releaseId) {
        throw new AssetResolverError(
            'release-mismatch',
            'Pointer and manifest release ids differ'
        );
    }
    if (pointer.manifestSha256 !== actualManifestSha256) {
        throw new AssetResolverError(
            'integrity',
            'Manifest bytes do not match the pointer checksum'
        );
    }
}

export type AuthoringAssetReference = {
    identity: LogicalAssetIdentity;
    sourcePath: string;
    section?: string;
};

export type AuthoringAssetCatalog = {
    storyId: string;
    assets: readonly AuthoringAssetReference[];
};

export type CoverageCounts = {
    readonly total: number;
    readonly included: number;
    readonly omitted: number;
    readonly unclassified: number;
};

export type StoryAssetCoverageReport = {
    readonly storyId: string;
    readonly byType: Readonly<Record<AssetType, CoverageCounts>>;
    readonly bySection: Readonly<Record<string, CoverageCounts>>;
    readonly totals: CoverageCounts;
};

// The report is assembled with mutable counters and handed back as the readonly
// public shape, so the `total === included + omitted + unclassified` invariant
// maintained by `increment` cannot be broken by a caller after construction.
type MutableCoverageCounts = {
    total: number;
    included: number;
    omitted: number;
    unclassified: number;
};

type MutableCoverageReport = {
    storyId: string;
    byType: Record<AssetType, MutableCoverageCounts>;
    bySection: Record<string, MutableCoverageCounts>;
    totals: MutableCoverageCounts;
};

function emptyCounts(): MutableCoverageCounts {
    return { total: 0, included: 0, omitted: 0, unclassified: 0 };
}

function increment(
    counts: MutableCoverageCounts,
    disposition: 'included' | 'omitted' | 'unclassified'
): void {
    counts.total += 1;
    counts[disposition] += 1;
}

export function validateReleaseCoverage(
    authoringCatalog: AuthoringAssetCatalog,
    plan: StoryAssetReleasePlanV1,
    availableSourcePaths: ReadonlySet<string>
): StoryAssetCoverageReport {
    if (authoringCatalog.storyId !== plan.storyId) {
        throw new AssetResolverError(
            'story-mismatch',
            'Authoring manifest and release plan story ids differ'
        );
    }
    const authoringAssets = authoringCatalog.assets;
    const authoringById = new Map(
        authoringAssets.map(asset => [
            qualifyAssetIdentity(asset.identity),
            asset,
        ])
    );
    if (authoringById.size !== authoringAssets.length) {
        throw new AssetResolverError(
            'coverage',
            'Authoring manifest contains duplicate type-qualified identities'
        );
    }

    const planById = new Map(
        plan.entries.map(entry => [qualifyAssetIdentity(entry.identity), entry])
    );
    const unknownPlanIds = [...planById.keys()].filter(
        id => !authoringById.has(id)
    );
    if (unknownPlanIds.length > 0) {
        throw new AssetResolverError(
            'coverage',
            'Release plan contains identities absent from the authoring manifest',
            { details: unknownPlanIds }
        );
    }

    const report: MutableCoverageReport = {
        storyId: plan.storyId,
        byType: {
            background: emptyCounts(),
            portrait: emptyCounts(),
        },
        // A null-prototype object prevents a `__proto__` section from hitting
        // Object.prototype via the `??=` lookup below — with a plain `{}`,
        // `bySection['__proto__']` resolves to the inherited prototype (non-
        // nullish), so `??=` skips assignment and `increment` would mutate
        // Object.prototype fields instead of creating a report bucket.
        bySection: Object.create(null) as Record<string, MutableCoverageCounts>,
        totals: emptyCounts(),
    };
    const problems: string[] = [];

    for (const [id, authoring] of authoringById) {
        const entry = planById.get(id);
        const disposition = entry?.disposition ?? 'unclassified';
        increment(report.totals, disposition);
        increment(report.byType[authoring.identity.type], disposition);
        const section = entry?.section ?? authoring.section ?? '_unassigned';
        report.bySection[section] ??= emptyCounts();
        increment(report.bySection[section], disposition);

        if (plan.channel === 'production' && disposition === 'unclassified') {
            problems.push(`Unclassified production asset: ${id}`);
        }
        if (entry?.disposition === 'included') {
            if (entry.sourcePath !== authoring.sourcePath) {
                problems.push(`Source path mismatch for ${id}`);
            }
            if (!availableSourcePaths.has(entry.sourcePath)) {
                problems.push(
                    `Missing included source asset: ${entry.sourcePath}`
                );
            }
        }
    }

    if (problems.length > 0) {
        throw new AssetResolverError(
            'coverage',
            'Release coverage validation failed',
            { details: problems }
        );
    }
    return report;
}

export function validateRuntimeManifestCoverage(
    manifest: RuntimeAssetManifestV1,
    plan: StoryAssetReleasePlanV1
): void {
    if (manifest.storyId !== plan.storyId) {
        throw new AssetResolverError(
            'story-mismatch',
            'Runtime manifest and release plan story ids differ'
        );
    }
    const runtimeIds = new Set(
        manifest.assets.map(asset => qualifyAssetIdentity(asset.identity))
    );
    const includedIds = new Set(
        plan.entries
            .filter(entry => entry.disposition === 'included')
            .map(entry => qualifyAssetIdentity(entry.identity))
    );
    const omittedIds = new Set(
        plan.entries
            .filter(entry => entry.disposition === 'omitted')
            .map(entry => qualifyAssetIdentity(entry.identity))
    );

    const problems = [
        ...[...includedIds]
            .filter(id => !runtimeIds.has(id))
            .map(id => `Included asset missing from runtime manifest: ${id}`),
        ...[...runtimeIds]
            .filter(id => !includedIds.has(id))
            .map(id => `Unplanned asset present in runtime manifest: ${id}`),
        ...[...omittedIds]
            .filter(id => runtimeIds.has(id))
            .map(id => `Omitted asset present in runtime manifest: ${id}`),
    ];
    if (problems.length > 0) {
        throw new AssetResolverError(
            'coverage',
            'Runtime manifest does not match its release plan',
            { details: problems }
        );
    }
}

export function assertActivationAllowed(
    plan: StoryAssetReleasePlanV1,
    target: PublicationTarget
): void {
    if (target.kind === 'production' && plan.channel !== 'production') {
        throw new AssetResolverError(
            'coverage',
            'Preview release plans cannot update the production pointer'
        );
    }
}
