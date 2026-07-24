import { describe, expect, it } from 'vitest';
import {
    AssetResolverError,
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
        expect(
            getObjectPath(
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                'webp'
            )
        ).toBe(
            'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp'
        );
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

    it('rejects control characters, non-NFC forms, and out-of-bounds logical keys', () => {
        expect(isSafeLogicalKey('chapter\nsecret')).toBe(false);
        expect(isSafeLogicalKey('chapter\x7fsecret')).toBe(false);
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
});
