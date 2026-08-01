import {
    assertReleaseIdMatchesContentSha256,
    canonicalJson,
    canonicalReleaseContent,
    compareQualifiedAssetIds,
    isReleaseId,
    parseRuntimeAssetManifest,
    qualifyAssetIdentity,
    releaseIdFromContentSha256,
    validateRuntimeManifestCoverage,
    type PublicationTarget,
    type RuntimeAssetEntryV1,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanEntryV1,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import { sha256ManifestBytes, sha256ReleaseContent } from './hash';
import type { EncodedAsset, EncodedVariant, PreparedRelease } from './types';

export interface BuildPreparedReleaseInput {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releasePlan: StoryAssetReleasePlanV1;
    readonly encodedAssets: EncodedAsset[];
    readonly coverage: StoryAssetCoverageReport;
}

function coverageError(message: string): PublisherError {
    return new PublisherError('coverage', message);
}

function variantFor(
    variants: readonly EncodedVariant[],
    format: EncodedVariant['format'],
    identity: string
): EncodedVariant {
    const matches = variants.filter(variant => variant.format === format);
    if (matches.length !== 1) {
        throw coverageError(
            `Asset ${identity} must have exactly one ${format.toUpperCase()} variant`
        );
    }
    const variant = matches[0];
    if (variant === undefined) {
        throw coverageError(
            `Asset ${identity} must have exactly one ${format.toUpperCase()} variant`
        );
    }
    return variant;
}

function buildVariants(encoded: EncodedAsset): RuntimeAssetEntryV1['variants'] {
    const identity = qualifyAssetIdentity(encoded.identity);
    const webp = variantFor(encoded.variants, 'webp', identity);
    const runtimeWebp: RuntimeAssetEntryV1['variants']['webp'] = {
        format: 'webp',
        path: webp.path,
        sha256: webp.sha256,
        byteLength: webp.byteLength,
    };
    const avif = encoded.variants.filter(variant => variant.format === 'avif');

    if (encoded.identity.type === 'background') {
        const backgroundAvif = variantFor(encoded.variants, 'avif', identity);
        return {
            webp: runtimeWebp,
            avif: {
                format: 'avif',
                path: backgroundAvif.path,
                sha256: backgroundAvif.sha256,
                byteLength: backgroundAvif.byteLength,
            },
        };
    }

    if (avif.length > 0) {
        throw coverageError(
            `Portrait asset ${identity} must not have an AVIF variant`
        );
    }
    return { webp: runtimeWebp };
}

function includedPlanEntry(
    releasePlan: StoryAssetReleasePlanV1,
    encoded: EncodedAsset
): Extract<StoryAssetReleasePlanEntryV1, { disposition: 'included' }> {
    const identity = qualifyAssetIdentity(encoded.identity);
    const planEntry = releasePlan.entries.find(
        entry => qualifyAssetIdentity(entry.identity) === identity
    );
    if (planEntry?.disposition !== 'included') {
        throw coverageError(
            `Encoded asset ${identity} is not included by its release plan`
        );
    }
    return planEntry;
}

function assertPreparedReleaseId(
    releaseId: string
): asserts releaseId is `sha256-${string}` {
    if (!isReleaseId(releaseId)) {
        throw new PublisherError('integrity', 'Invalid derived release id');
    }
}

function assertInputStoriesMatch(input: BuildPreparedReleaseInput): void {
    if (input.storyId !== input.releasePlan.storyId) {
        throw coverageError(
            'Prepared release story id does not match release plan'
        );
    }
    if (input.storyId !== input.coverage.storyId) {
        throw coverageError(
            'Prepared release story id does not match coverage'
        );
    }
}

export function buildPreparedRelease(
    input: BuildPreparedReleaseInput
): PreparedRelease {
    assertInputStoriesMatch(input);

    const assets = input.encodedAssets
        .map(encoded => {
            const planEntry = includedPlanEntry(input.releasePlan, encoded);
            const section = planEntry.section ?? encoded.authoringSection;
            const entry: RuntimeAssetEntryV1 = {
                identity: encoded.identity,
                variants: buildVariants(encoded),
                width: encoded.width,
                height: encoded.height,
                ...(section === undefined ? {} : { section }),
            };
            return entry;
        })
        .sort((left, right) =>
            compareQualifiedAssetIds(
                qualifyAssetIdentity(left.identity),
                qualifyAssetIdentity(right.identity)
            )
        );

    if (!assets.some(asset => asset.identity.type === 'background')) {
        throw coverageError(
            'Prepared release must include at least one background'
        );
    }

    const validatedDraft = parseRuntimeAssetManifest({
        schemaVersion: 1,
        storyId: input.storyId,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    });
    const releaseContent = canonicalReleaseContent(validatedDraft);
    const releaseContentSha256 = sha256ReleaseContent(releaseContent);
    const releaseId = releaseIdFromContentSha256(releaseContentSha256);
    assertPreparedReleaseId(releaseId);

    const manifest = parseRuntimeAssetManifest({
        ...validatedDraft,
        releaseId,
    });
    assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);

    const manifestBytes = new TextEncoder().encode(
        `${canonicalJson(manifest)}\n`
    );
    const manifestSha256 = sha256ManifestBytes(manifestBytes);
    validateRuntimeManifestCoverage(manifest, input.releasePlan);

    return {
        storyId: input.storyId,
        target: input.target,
        releaseId,
        releaseContentSha256,
        manifest,
        manifestSha256,
        manifestBytes,
        encodedAssets: input.encodedAssets,
        coverage: input.coverage,
    };
}
