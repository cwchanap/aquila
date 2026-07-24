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
    type PublicationTarget,
    type RuntimeAssetManifestV1,
    type StoryAssetReleasePlanV1,
} from './schemas';

const FORBIDDEN_RUNTIME_KEY_PARTS = [
    'prompt',
    'sourcepath',
    'localpath',
    'provider',
    'credential',
    'secret',
    'token',
    'apikey',
] as const;

function assertKnownVersion(
    input: unknown,
    expectedVersion: number,
    contractName: string
): void {
    if (
        typeof input === 'object' &&
        input !== null &&
        'schemaVersion' in input &&
        typeof input.schemaVersion === 'number' &&
        input.schemaVersion !== expectedVersion
    ) {
        throw new AssetResolverError(
            'unknown-schema-version',
            `Unsupported ${contractName} schema version: ${input.schemaVersion}`
        );
    }
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
        const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
        if (
            FORBIDDEN_RUNTIME_KEY_PARTS.some(part =>
                normalizedKey.includes(part)
            )
        ) {
            findings.push(`${path}.${key}`);
        }
        findings.push(...findForbiddenRuntimeFields(value, `${path}.${key}`));
    }
    return findings;
}

function errorCodeForZod(error: z.ZodError): AssetResolverErrorCode {
    const messages = error.issues.map(issue => issue.message);
    if (messages.some(message => message.startsWith('[unsafe-path]'))) {
        return 'unsafe-path';
    }
    if (messages.some(message => message.startsWith('[integrity]'))) {
        return 'integrity';
    }
    return 'validation';
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
            { details: result.error.issues.map(issue => issue.message) }
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
    actualManifestSha256: string
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
    total: number;
    included: number;
    omitted: number;
    unclassified: number;
};

export type StoryAssetCoverageReport = {
    storyId: string;
    byType: Record<AssetType, CoverageCounts>;
    bySection: Record<string, CoverageCounts>;
    totals: CoverageCounts;
};

function emptyCounts(): CoverageCounts {
    return { total: 0, included: 0, omitted: 0, unclassified: 0 };
}

function increment(
    counts: CoverageCounts,
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

    const report: StoryAssetCoverageReport = {
        storyId: plan.storyId,
        byType: {
            background: emptyCounts(),
            portrait: emptyCounts(),
        },
        bySection: {},
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
