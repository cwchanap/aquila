import { AssetResolverError } from './errors';
import {
    compareQualifiedAssetIds,
    isSha256,
    qualifyAssetIdentity,
} from './paths';
import type { RuntimeAssetManifestV1, Sha256 } from './schemas';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
    | JsonPrimitive
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

/**
 * The single normative canonicalizer for runtime-asset release content. Because
 * `releaseId` is a content address that a publisher computes and a reader
 * re-derives across a trust boundary, EVERY producer and verifier must reuse
 * this exact function to obtain byte-identical output — do not substitute a
 * generic JCS/RFC-8785 library, which escapes non-ASCII and orders keys
 * differently. Canonical form: no insignificant whitespace, object keys sorted
 * by UTF-16 code unit (`Array.prototype.sort`), and strings escaped by JS
 * `JSON.stringify`. To keep the digest trustworthy it refuses to silently
 * normalize input: `undefined` values and non-finite numbers throw rather than
 * being dropped or coerced to `null`.
 */
export function canonicalJson(value: JsonValue): string {
    if (value === undefined) {
        throw new AssetResolverError(
            'integrity',
            'Canonical JSON cannot serialize an undefined value'
        );
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new AssetResolverError(
            'integrity',
            'Canonical JSON cannot serialize a non-finite number'
        );
    }
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
 * circular digest. Callers hash the returned bytes; `releaseIdFromContentSha256`
 * then wraps that digest as `sha256-<digest>`.
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

/**
 * Verifies a manifest's declared `releaseId` against its canonical content
 * digest. `contentSha256` MUST be `sha256(canonicalReleaseContent(manifest))`
 * computed by the caller — this module is deliberately crypto-free. Passing any
 * other digest (e.g. the manifest *bytes* digest carried on the pointer as
 * `manifestSha256`) produces a meaningless verdict.
 */
export function assertReleaseIdMatchesContentSha256(
    manifest: RuntimeAssetManifestV1,
    contentSha256: Sha256
): void {
    const expectedReleaseId = releaseIdFromContentSha256(contentSha256);
    if (manifest.releaseId !== expectedReleaseId) {
        throw new AssetResolverError(
            'integrity',
            'Runtime manifest release id does not match canonical release content'
        );
    }
}
