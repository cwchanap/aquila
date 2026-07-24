import { describe, expect, it } from 'vitest';
import manifestFixture from '../__fixtures__/runtime-manifest.v1.json';
import {
    AssetResolverError,
    canonicalJson,
    canonicalReleaseContent,
    parseRuntimeAssetManifest,
    type JsonValue,
} from '..';

describe('canonicalJson', () => {
    it('sorts object keys deterministically and recurses into nested values', () => {
        expect(canonicalJson({ b: 1, a: 2, c: 3 } as JsonValue)).toBe(
            '{"a":2,"b":1,"c":3}'
        );
        expect(
            canonicalJson({ z: { y: 1, x: 2 }, a: [3, 2, 1] } as JsonValue)
        ).toBe('{"a":[3,2,1],"z":{"x":2,"y":1}}');
    });

    it('produces identical output for two shuffled but equal objects', () => {
        const left = { a: 1, nested: { p: true, q: false }, list: [1, 2] };
        const right = { list: [1, 2], nested: { q: false, p: true }, a: 1 };
        expect(canonicalJson(left as JsonValue)).toBe(
            canonicalJson(right as JsonValue)
        );
    });

    it('refuses to silently normalize undefined values or non-finite numbers', () => {
        expect(() =>
            canonicalJson({ a: undefined } as unknown as JsonValue)
        ).toThrow(AssetResolverError);
        expect(() => canonicalJson(Number.NaN as unknown as JsonValue)).toThrow(
            AssetResolverError
        );
        expect(() =>
            canonicalJson(Number.POSITIVE_INFINITY as unknown as JsonValue)
        ).toThrow(AssetResolverError);
    });
});

describe('canonicalReleaseContent', () => {
    it('re-sorts assets by qualified identity before hashing', () => {
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const shuffled = {
            ...manifest,
            assets: [...manifest.assets].reverse(),
        };
        // A broken comparator would leak the reversed input order into the
        // digest basis; canonicalization must normalize both to the same bytes.
        expect(canonicalReleaseContent(shuffled)).toBe(
            canonicalReleaseContent(manifest)
        );
        expect(
            canonicalReleaseContent(manifest).indexOf('"background"')
        ).toBeLessThan(canonicalReleaseContent(manifest).indexOf('"portrait"'));
    });
});
