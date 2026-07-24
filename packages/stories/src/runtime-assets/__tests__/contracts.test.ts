import { describe, expect, it } from 'vitest';
import currentFixture from '../__fixtures__/current.v1.json';
import manifestFixture from '../__fixtures__/runtime-manifest.v1.json';
import planFixture from '../__fixtures__/release-plan.v1.json';
import {
    AssetResolverError,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
    qualifyAssetIdentity,
    validatePointerManifestPair,
} from '..';

function expectCode(
    callback: () => unknown,
    code: AssetResolverError['code']
): void {
    try {
        callback();
        throw new Error('Expected callback to throw');
    } catch (error) {
        expect(error).toBeInstanceOf(AssetResolverError);
        expect((error as AssetResolverError).code).toBe(code);
    }
}

describe('runtime asset wire contracts', () => {
    it('parses the V1 fixtures and ignores additive fields', () => {
        const manifest = parseRuntimeAssetManifest({
            ...manifestFixture,
            futureReaderHint: true,
        });
        const pointer = parseActiveReleasePointer(currentFixture);

        expect(manifest.assets).toHaveLength(2);
        expect('futureReaderHint' in manifest).toBe(false);
        expect(pointer.releaseId).toBe(manifest.releaseId);
    });

    it('keeps identical background and portrait keys distinct', () => {
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const ids = manifest.assets.map(asset =>
            qualifyAssetIdentity(asset.identity)
        );

        expect(ids).toEqual([
            'background:第一章/鏡 房/夜',
            'portrait:第一章/鏡 房/夜',
        ]);
    });

    it('rejects unknown schema versions explicitly', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: 2,
                }),
            'unknown-schema-version'
        );
        expectCode(
            () =>
                parseActiveReleasePointer({
                    ...currentFixture,
                    schemaVersion: 2,
                }),
            'unknown-schema-version'
        );
        expectCode(
            () =>
                parseStoryAssetReleasePlan({
                    ...planFixture,
                    schemaVersion: 2,
                }),
            'unknown-schema-version'
        );
    });

    it('reports a stringified unknown version as a version error, not validation', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: '2',
                }),
            'unknown-schema-version'
        );
    });

    it('reports a stringified *known* version as a validation error, not a version error', () => {
        // Intentional asymmetry with the test above: assertKnownVersion is a
        // fast-path that surfaces a clear `unknown-schema-version` code for
        // *future* versions before Zod rejects them generically. A stringified
        // *current* version ("1") is not unknown — it is a malformed document
        // whose `schemaVersion` has the wrong type, so Zod's `z.literal(1)`
        // correctly rejects it as a plain validation error. Promoting it to a
        // version-specific code would add noise without improving correctness.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: '1',
                }),
            'validation'
        );
        // The numeric known version still parses cleanly.
        expect(() => parseRuntimeAssetManifest(manifestFixture)).not.toThrow();
    });

    it('rejects authoring prompts and local source paths in runtime data', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    prompt: 'private generation prompt',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourcePath: '/Users/example/source.png',
                }),
            'validation'
        );
    });

    it('matches forbidden parts at word boundaries, not as substrings', () => {
        // `secret` must catch `secret`, `secretPath`, and `secret_path` ...
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secret: 'leak',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secretPath: '/etc/secret',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secret_path: '/etc/secret',
                }),
            'validation'
        );
        // ... but must NOT catch `secretary` (substring over-match).
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                secretary: 'narrator',
            })
        ).not.toThrow();
        // `token` must not catch `tokenize`; `apikey` still catches `apiKey`.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                tokenize: true,
            })
        ).not.toThrow();
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    apiKey: 'leak',
                }),
            'validation'
        );
    });

    it('rejects absolute, traversal, and digest-mismatched object paths', () => {
        const unsafeManifest = structuredClone(manifestFixture);
        unsafeManifest.assets[0].variants.webp.path =
            'https://assets.example/object.webp';
        expectCode(
            () => parseRuntimeAssetManifest(unsafeManifest),
            'unsafe-path'
        );

        const traversalManifest = structuredClone(manifestFixture);
        traversalManifest.assets[0].variants.webp.path =
            'vn/objects/../secret.webp';
        expectCode(
            () => parseRuntimeAssetManifest(traversalManifest),
            'unsafe-path'
        );

        const mismatchedManifest = structuredClone(manifestFixture);
        mismatchedManifest.assets[0].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        expectCode(
            () => parseRuntimeAssetManifest(mismatchedManifest),
            'integrity'
        );
    });

    it('rejects duplicate type-qualified identities', () => {
        const duplicateManifest = structuredClone(manifestFixture);
        duplicateManifest.assets.push(
            structuredClone(duplicateManifest.assets[0])
        );
        expectCode(
            () => parseRuntimeAssetManifest(duplicateManifest),
            'validation'
        );
    });

    it('accepts a zero-asset manifest', () => {
        // A story may legitimately ship a release before any images are
        // authored; the schema intentionally does not require assets.min(1).
        // This test pins that behavior so a future tightening is a deliberate
        // change, not an accident.
        const empty = parseRuntimeAssetManifest({
            schemaVersion: 1,
            storyId: 'fixture_story',
            releaseId: `sha256-${'0'.repeat(64)}`,
            assets: [],
        });
        expect(empty.assets).toEqual([]);
    });

    it('validates pointer path and pointer-manifest integrity', () => {
        const pointer = parseActiveReleasePointer(currentFixture);
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        expect(() =>
            validatePointerManifestPair(
                pointer,
                manifest,
                pointer.manifestSha256
            )
        ).not.toThrow();

        expectCode(
            () =>
                validatePointerManifestPair(
                    pointer,
                    manifest,
                    assertSha256<'manifest-bytes'>('a'.repeat(64))
                ),
            'integrity'
        );

        expectCode(
            () =>
                parseActiveReleasePointer({
                    ...currentFixture,
                    manifestPath: 'vn/stories/fixture_story/current.json',
                }),
            'unsafe-path'
        );

        expectCode(
            () =>
                parseActiveReleasePointer(
                    currentFixture,
                    { kind: 'production' },
                    'another_story'
                ),
            'story-mismatch'
        );
    });

    it('distinguishes pointer/manifest story and release mismatches', () => {
        const pointer = parseActiveReleasePointer(currentFixture);
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        expectCode(
            () =>
                validatePointerManifestPair(
                    { ...pointer, storyId: 'other_story' },
                    manifest,
                    pointer.manifestSha256
                ),
            'story-mismatch'
        );
        expectCode(
            () =>
                validatePointerManifestPair(
                    {
                        ...pointer,
                        releaseId: `sha256-${'c'.repeat(64)}`,
                    },
                    manifest,
                    pointer.manifestSha256
                ),
            'release-mismatch'
        );
    });

    it('classifies a malformed digest as an integrity failure and locates it', () => {
        const badDigest = structuredClone(manifestFixture);
        badDigest.assets[0].variants.webp.sha256 = 'not-a-valid-digest';
        try {
            parseRuntimeAssetManifest(badDigest);
            throw new Error('Expected parse to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AssetResolverError);
            expect((error as AssetResolverError).code).toBe('integrity');
            const details =
                (error as AssetResolverError).details?.join(' ') ?? '';
            expect(details).toContain('assets.0.variants.webp.sha256');
        }
    });

    it('defines deterministic release content without a circular release id', () => {
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const canonical = canonicalReleaseContent(manifest);
        expect(canonical).not.toContain('"releaseId"');
        expect(canonical.indexOf('"background"')).toBeLessThan(
            canonical.indexOf('"portrait"')
        );
        expect(() =>
            assertReleaseIdMatchesContentSha256(
                manifest,
                assertSha256<'release-content'>('e'.repeat(64))
            )
        ).not.toThrow();
        expectCode(
            () =>
                assertReleaseIdMatchesContentSha256(
                    manifest,
                    assertSha256<'release-content'>('a'.repeat(64))
                ),
            'integrity'
        );
    });

    it('reports unsafe-path ahead of integrity when both co-occur', () => {
        // Precedence is unsafe-path > integrity > validation (validation.ts).
        // A document with both an unsafe path and an integrity failure must
        // surface unsafe-path, regardless of Zod's traversal order.
        const both = structuredClone(manifestFixture);
        // unsafe-path: traversal segment in the first asset's webp path
        both.assets[0].variants.webp.path = 'vn/objects/../secret.webp';
        // integrity: second asset's webp path does not match its sha256
        both.assets[1].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        expectCode(() => parseRuntimeAssetManifest(both), 'unsafe-path');
    });

    it('reports integrity ahead of validation when both co-occur', () => {
        // No unsafe-path issue here, so integrity must win over validation.
        const both = structuredClone(manifestFixture);
        // integrity: first asset's webp path does not match its sha256
        both.assets[0].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        // validation: duplicate type-qualified identity (custom issue with no
        // assetErrorCode, so it falls through to the default 'validation')
        const duplicate = structuredClone(both.assets[0]);
        duplicate.variants.webp.path =
            'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
        both.assets.push(duplicate);
        expectCode(() => parseRuntimeAssetManifest(both), 'integrity');
    });

    it('prevents transposing a manifest-bytes digest into the release-content verifier', () => {
        // Compile-time guarantee: a ManifestByteSha256 (e.g. pointer.manifestSha256)
        // is not assignable to the ReleaseContentSha256 parameter of
        // assertReleaseIdMatchesContentSha256, and vice versa. The @ts-expect-error
        // directives below are verified by `tsc --noEmit`; if either brand boundary
        // regresses they become unused and the typecheck fails. The offending calls
        // live in a never-invoked function body so they are checked by the
        // compiler but never executed at runtime.
        const pointer = parseActiveReleasePointer(currentFixture);
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const manifestBytesDigest: typeof pointer.manifestSha256 =
            pointer.manifestSha256;
        const releaseContentDigest = assertSha256<'release-content'>(
            'e'.repeat(64)
        );

        function compileTimeOnly() {
            // @ts-expect-error - ManifestByteSha256 is not a ReleaseContentSha256
            assertReleaseIdMatchesContentSha256(manifest, manifestBytesDigest);
            // @ts-expect-error - ReleaseContentSha256 is not a ManifestByteSha256
            validatePointerManifestPair(
                pointer,
                manifest,
                releaseContentDigest
            );
        }
        // Reference the function so it is not dropped before tsc checks it.
        expect(typeof compileTimeOnly).toBe('function');

        // Runtime sanity: the correctly-branded calls typecheck and run cleanly.
        expect(() =>
            validatePointerManifestPair(pointer, manifest, manifestBytesDigest)
        ).not.toThrow();
        expect(() =>
            assertReleaseIdMatchesContentSha256(manifest, releaseContentDigest)
        ).not.toThrow();
    });
});
