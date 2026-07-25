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
    return parseSchema(
        RuntimeAssetManifestV1Schema,
        input,
        'runtime asset manifest'
    );
}

export function parseActiveReleasePointer(
    input: unknown,
    target: PublicationTarget = { kind: 'production' },
    expectedStoryId?: string
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
    const pointer = parseSchema(
        ActiveReleasePointerV1Schema,
        input,
        'active-release pointer'
    );
    if (expectedStoryId !== undefined && pointer.storyId !== expectedStoryId) {
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
