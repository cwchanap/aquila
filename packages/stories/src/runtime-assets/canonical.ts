import { AssetResolverError } from './errors';
import {
    compareQualifiedAssetIds,
    isSha256,
    qualifyAssetIdentity,
} from './paths';
import type { RuntimeAssetManifestV1 } from './schemas';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
    | JsonPrimitive
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

export function canonicalJson(value: JsonValue): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(item => canonicalJson(item)).join(',')}]`;
    }
    const object = value as { readonly [key: string]: JsonValue };
    return `{${Object.keys(object)
        .sort()
        .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
        .join(',')}}`;
}

/**
 * Canonical release content deliberately excludes releaseId to avoid a
 * circular digest. The resulting SHA-256 becomes `sha256-<digest>`.
 */
export function canonicalReleaseContent(
    manifest: RuntimeAssetManifestV1
): string {
    const assets = [...manifest.assets].sort((left, right) =>
        compareQualifiedAssetIds(
            qualifyAssetIdentity(left.identity),
            qualifyAssetIdentity(right.identity)
        )
    );
    return canonicalJson({
        schemaVersion: manifest.schemaVersion,
        storyId: manifest.storyId,
        assets,
    } as JsonValue);
}

export function releaseIdFromContentSha256(sha256: string): string {
    if (!isSha256(sha256)) {
        throw new AssetResolverError(
            'integrity',
            'Release content digest must be a lowercase SHA-256'
        );
    }
    return `sha256-${sha256}`;
}

export function assertReleaseIdMatchesContentSha256(
    manifest: RuntimeAssetManifestV1,
    contentSha256: string
): void {
    const expectedReleaseId = releaseIdFromContentSha256(contentSha256);
    if (manifest.releaseId !== expectedReleaseId) {
        throw new AssetResolverError(
            'integrity',
            'Runtime manifest release id does not match canonical release content'
        );
    }
}
