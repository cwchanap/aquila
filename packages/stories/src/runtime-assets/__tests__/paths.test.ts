import { describe, expect, it } from 'vitest';
import {
    AssetResolverError,
    assertSha256,
    encodeLogicalAssetIdentity,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    isPreviewId,
    isSafeLogicalKey,
    resolveAssetUrl,
} from '..';

const OBJECT_PATH =
    'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';

const RELEASE_ID =
    'sha256-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

describe('runtime asset paths', () => {
    it('accepts CJK, spaces, and nested logical keys and encodes each segment', () => {
        const key = '第一章/鏡 房/夜';
        expect(isSafeLogicalKey(key)).toBe(true);
        expect(encodeLogicalAssetIdentity({ type: 'background', key })).toBe(
            'background/%E7%AC%AC%E4%B8%80%E7%AB%A0/%E9%8F%A1%20%E6%88%BF/%E5%A4%9C'
        );
    });

    it('rejects traversal and backslashes in logical keys', () => {
        expect(isSafeLogicalKey('../secret')).toBe(false);
        expect(isSafeLogicalKey('chapter/../secret')).toBe(false);
        expect(isSafeLogicalKey('chapter\\secret')).toBe(false);
    });

    it('builds canonical production and isolated preview paths', () => {
        expect(
            getReleaseManifestPath('fixture_story', RELEASE_ID, {
                kind: 'production',
            })
        ).toBe(
            `vn/stories/fixture_story/releases/${RELEASE_ID}/runtime-manifest.json`
        );
        expect(
            getCurrentPointerPath('fixture_story', {
                kind: 'preview',
                previewId: 'hpa-227',
            })
        ).toBe('vn/previews/hpa-227/stories/fixture_story/current.json');
        const objectDigest = assertSha256<'object-content'>(
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        );
        expect(getObjectPath(objectDigest, 'webp')).toBe(
            'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp'
        );
    });

    it('rejects transposing a non-object-content digest into getObjectPath', () => {
        // Compile-time guarantee: getObjectPath selects an object path from the
        // digest of an asset's encoded bytes, so it must accept only an
        // ObjectContentSha256. A ManifestByteSha256 or ReleaseContentSha256
        // must not be assignable. The @ts-expect-error directives below are
        // verified by `tsc --noEmit`; if the brand boundary regresses they
        // become unused and the typecheck fails.
        const manifestBytesDigest = assertSha256<'manifest-bytes'>(
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        );
        const releaseContentDigest = assertSha256<'release-content'>(
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
        );
        function compileTimeOnly() {
            // @ts-expect-error - ManifestByteSha256 is not an ObjectContentSha256.
            // prettier-ignore
            getObjectPath(manifestBytesDigest, 'webp');
            // @ts-expect-error - ReleaseContentSha256 is not an ObjectContentSha256.
            // prettier-ignore
            getObjectPath(releaseContentDigest, 'webp');
        }
        // Reference the function so it is not dropped before tsc checks it.
        expect(typeof compileTimeOnly).toBe('function');
    });

    it('combines safe relative paths with local and production base URLs', () => {
        const path =
            'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
        expect(
            resolveAssetUrl('http://127.0.0.1:5090/assets/', path).href
        ).toBe(`http://127.0.0.1:5090/assets/${path}`);
        expect(resolveAssetUrl('https://cdn.example.com/', path).href).toBe(
            `https://cdn.example.com/${path}`
        );
    });

    it('rejects unsafe manifest paths and base URL schemes', () => {
        expect(() =>
            resolveAssetUrl('https://cdn.example.com/', 'https://evil.test/a')
        ).toThrow(AssetResolverError);
        expect(() =>
            resolveAssetUrl('file:///tmp/assets/', 'vn/objects/a.webp')
        ).toThrow(AssetResolverError);
    });

    it('rejects base URLs carrying credentials, query, fragment, or garbage', () => {
        for (const base of [
            'https://user:pass@cdn.example.com/',
            'https://cdn.example.com/?token=secret',
            'https://cdn.example.com/#fragment',
            'not-a-valid-url',
        ]) {
            expect(() => resolveAssetUrl(base, OBJECT_PATH)).toThrow(
                AssetResolverError
            );
        }
    });

    it('appends a trailing slash to the base path before joining', () => {
        expect(
            resolveAssetUrl('https://cdn.example.com/assets', OBJECT_PATH).href
        ).toBe(`https://cdn.example.com/assets/${OBJECT_PATH}`);
    });

    it('rejects unsafe preview ids to prevent path injection', () => {
        expect(isPreviewId('hpa-227')).toBe(true);
        for (const bad of [
            '../evil',
            'bad/id',
            'UPPER',
            '-leading',
            'trailing-',
            'a'.repeat(65),
        ]) {
            expect(isPreviewId(bad)).toBe(false);
        }
        expect(() =>
            getCurrentPointerPath('fixture_story', {
                kind: 'preview',
                previewId: '../evil',
            })
        ).toThrow(AssetResolverError);
        expect(() =>
            getReleaseManifestPath('fixture_story', RELEASE_ID, {
                kind: 'preview',
                previewId: 'bad/id',
            })
        ).toThrow(AssetResolverError);
    });

    it('mints a branded digest and rejects malformed ones', () => {
        expect(assertSha256<'object-content'>('a'.repeat(64))).toBe(
            'a'.repeat(64)
        );
        expect(() => assertSha256<'object-content'>('nope')).toThrow(
            AssetResolverError
        );
        // uppercase hex is not a valid lowercase SHA-256
        expect(() => assertSha256<'object-content'>('A'.repeat(64))).toThrow(
            AssetResolverError
        );
    });

    it('rejects control characters, non-NFC forms, and out-of-bounds logical keys', () => {
        expect(isSafeLogicalKey('chapter\nsecret')).toBe(false);
        expect(isSafeLogicalKey('chapter\x7fsecret')).toBe(false);
        // C1 control range (U+0080-009F) is rejected alongside C0/DEL.
        expect(isSafeLogicalKey('chapter\u0080secret')).toBe(false);
        expect(isSafeLogicalKey('chapter\u009Fsecret')).toBe(false);
        // 'A' + combining ring above (U+030A) is a valid decomposed (NFD)
        // form that is not equal to its NFC composition (U+00C5), so it must
        // be rejected; otherwise one visible key could yield two qualified
        // identities.
        const decomposed = 'A\u030A';
        expect(decomposed).not.toBe(decomposed.normalize('NFC'));
        expect(isSafeLogicalKey(decomposed)).toBe(false);
        expect(isSafeLogicalKey('')).toBe(false);
        expect(isSafeLogicalKey('a'.repeat(512))).toBe(true);
        expect(isSafeLogicalKey('a'.repeat(513))).toBe(false);
    });

    it('rejects Cf-category format characters that enable visual spoofing', () => {
        // U+202E RIGHT-TO-LEFT OVERRIDE and U+200B ZERO WIDTH SPACE are invisible
        // and can reorder or hide portions of a key in logs/UI. CJK keys that the
        // runtime actually uses remain valid.
        expect(isSafeLogicalKey('chapter\u202Esecret')).toBe(false);
        expect(isSafeLogicalKey('chapter\u200Bsecret')).toBe(false);
        expect(isSafeLogicalKey('\uFEFFchapter')).toBe(false);
        expect(isSafeLogicalKey('第一章/鏡 房/夜')).toBe(true);
    });
});
