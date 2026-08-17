import {
    assertReleaseIdMatchesContentSha256,
    canonicalAudioReleaseContent,
    canonicalJson,
    compareQualifiedAssetIds,
    isReleaseId,
    parseRuntimeAudioManifest,
    releaseIdFromContentSha256,
    type JsonValue,
    type PublicationTarget,
    type RuntimeAudioAssetV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import { sha256ManifestBytes, sha256ReleaseContent } from './hash';
import type { AudioCoverageEntryV1 } from './audio-source';
import type { NormalizedAudioAsset } from './audio-encoder';
import type { PreparedAudioRelease } from './types';

export interface BuildPreparedAudioReleaseInput {
    readonly storyId: string;
    readonly target: PublicationTarget;
    /** The normalized assets to include in the runtime release. */
    readonly assets?: readonly NormalizedAudioAsset[];
    readonly coverage: readonly AudioCoverageEntryV1[];
}

function compareAudioIdentity(
    left: Pick<NormalizedAudioAsset, 'type' | 'key'>,
    right: Pick<NormalizedAudioAsset, 'type' | 'key'>
): number {
    return compareQualifiedAssetIds(
        `${left.type}:${left.key}`,
        `${right.type}:${right.key}`
    );
}

function assertReleaseId(
    releaseId: string
): asserts releaseId is `sha256-${string}` {
    if (!isReleaseId(releaseId)) {
        throw new PublisherError(
            'integrity',
            'Invalid derived audio release id'
        );
    }
}

function coverageFor(
    coverage: readonly AudioCoverageEntryV1[]
): readonly AudioCoverageEntryV1[] {
    return [...coverage]
        .sort((left, right) =>
            compareQualifiedAssetIds(
                `${left.type}:${left.key}`,
                `${right.type}:${right.key}`
            )
        )
        .map(entry =>
            entry.disposition === 'included'
                ? {
                      type: entry.type,
                      key: entry.key,
                      usageCount: entry.usageCount,
                      disposition: 'included' as const,
                  }
                : {
                      type: entry.type,
                      key: entry.key,
                      usageCount: entry.usageCount,
                      disposition: 'omitted' as const,
                      reason: entry.reason,
                  }
        );
}

export function buildPreparedAudioRelease(
    input: BuildPreparedAudioReleaseInput
): PreparedAudioRelease {
    const assets = [...(input.assets ?? [])].sort(compareAudioIdentity);
    const manifestAssets: RuntimeAudioAssetV1[] = assets.map(asset => ({
        identity: { type: asset.type, key: asset.key },
        format: 'mp3',
        path: asset.path,
        sha256: asset.sha256,
        byteLength: asset.byteLength,
        durationMs: asset.durationMs,
        loop: asset.loop,
    }));

    const draft = parseRuntimeAudioManifest({
        schemaVersion: 1,
        storyId: input.storyId,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets: manifestAssets,
    });
    const releaseContent = canonicalAudioReleaseContent(draft);
    const releaseContentSha256 = sha256ReleaseContent(releaseContent);
    const releaseId = releaseIdFromContentSha256(releaseContentSha256);
    assertReleaseId(releaseId);

    const manifest = parseRuntimeAudioManifest({
        ...draft,
        releaseId,
    });
    assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);

    const manifestBytes = new TextEncoder().encode(
        `${canonicalJson(manifest as unknown as JsonValue)}\n`
    );
    const manifestSha256 = sha256ManifestBytes(manifestBytes);

    return {
        storyId: input.storyId,
        target: input.target,
        releaseId,
        releaseContentSha256,
        manifest,
        manifestSha256,
        manifestBytes,
        assets,
        coverage: coverageFor(input.coverage),
    };
}
