import { describe, expect, it } from 'vitest';
import currentFixture from '../__fixtures__/current.v1.json';
import manifestFixture from '../__fixtures__/runtime-manifest.v1.json';
import planFixture from '../__fixtures__/release-plan.v1.json';
import {
    AssetResolverError,
    assertReleaseIdMatchesContentSha256,
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
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
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
                'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            )
        ).not.toThrow();
        expectCode(
            () =>
                assertReleaseIdMatchesContentSha256(
                    manifest,
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                ),
            'integrity'
        );
    });
});
