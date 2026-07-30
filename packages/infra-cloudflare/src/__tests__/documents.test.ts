import { describe, expect, it } from 'vitest';
import { asRecord, findVariant, readString, summarize } from '../documents';

describe('asRecord', () => {
    it('returns plain objects unchanged', () => {
        const value = { a: 1 };
        expect(asRecord(value)).toBe(value);
    });

    it('rejects arrays, null, and scalars', () => {
        expect(asRecord([1, 2])).toBeNull();
        expect(asRecord(null)).toBeNull();
        expect(asRecord('x')).toBeNull();
        expect(asRecord(undefined)).toBeNull();
    });
});

describe('readString', () => {
    it('reads a string field', () => {
        expect(readString({ releaseId: 'sha256-abc' }, 'releaseId')).toBe(
            'sha256-abc'
        );
    });

    it('returns null for a non-string field', () => {
        expect(readString({ releaseId: 7 }, 'releaseId')).toBeNull();
    });

    it('returns null for a missing field or a non-object source', () => {
        expect(readString({}, 'releaseId')).toBeNull();
        expect(readString(null, 'releaseId')).toBeNull();
        expect(readString('sha256-abc', 'releaseId')).toBeNull();
    });
});

describe('summarize', () => {
    it('collapses whitespace so a multi-line error body stays on one line', () => {
        expect(summarize('<Error>\n  <Code>NoSuchKey</Code>\n</Error>')).toBe(
            '<Error> <Code>NoSuchKey</Code> </Error>'
        );
    });

    it('truncates a long body', () => {
        const summary = summarize('a'.repeat(400));
        expect(summary).toBe(`${'a'.repeat(120)}...`);
    });

    it('reports an empty or whitespace-only body explicitly', () => {
        expect(summarize('')).toBe('<empty body>');
        expect(summarize('  \n ')).toBe('<empty body>');
    });
});

describe('findVariant', () => {
    const variant = (suffix: string) => ({
        format: 'webp',
        path: `vn/objects/${suffix}.webp`,
        sha256: suffix,
        byteLength: 10,
    });

    it('finds the first usable variant', () => {
        expect(
            findVariant(
                { assets: [{ variants: { webp: variant('aa') } }] },
                'webp'
            )
        ).toEqual({
            kind: 'found',
            variant: { path: 'vn/objects/aa.webp', sha256: 'aa' },
        });
    });

    it('finds a variant carried only by a later asset', () => {
        expect(
            findVariant(
                {
                    assets: [
                        { variants: { webp: variant('aa') } },
                        {
                            variants: {
                                webp: variant('bb'),
                                avif: {
                                    format: 'avif',
                                    path: 'vn/objects/cc.avif',
                                    sha256: 'cc',
                                },
                            },
                        },
                    ],
                },
                'avif'
            )
        ).toEqual({
            kind: 'found',
            variant: { path: 'vn/objects/cc.avif', sha256: 'cc' },
        });
    });

    it('reports the format as absent when no asset carries it', () => {
        expect(
            findVariant(
                {
                    assets: [
                        { variants: { webp: variant('aa') } },
                        { variants: { webp: variant('bb') } },
                    ],
                },
                'avif'
            )
        ).toEqual({
            kind: 'absent',
            detail: 'no avif variant among 2 asset(s)',
        });
    });

    // A malformed variant must never be reported as an absent one: "no webp
    // variant" would send an operator looking for a missing object instead of
    // the bad field that is actually there.
    it('reports a malformed variant as malformed, not absent', () => {
        expect(
            findVariant(
                {
                    assets: [
                        {
                            variants: {
                                webp: {
                                    path: 'vn/objects/aa.webp',
                                    sha256: 12345,
                                },
                            },
                        },
                    ],
                },
                'webp'
            )
        ).toEqual({
            kind: 'malformed',
            detail: 'assets.0.variants.webp is malformed (sha256 is 12345)',
        });
    });

    it('names every missing or non-string field', () => {
        expect(
            findVariant({ assets: [{ variants: { webp: {} } }] }, 'webp')
        ).toEqual({
            kind: 'malformed',
            detail: 'assets.0.variants.webp is malformed (path is absent, sha256 is absent)',
        });
    });

    it('prefers a usable later variant over an earlier malformed one', () => {
        expect(
            findVariant(
                {
                    assets: [
                        { variants: { webp: { path: 7, sha256: 'aa' } } },
                        { variants: { webp: variant('bb') } },
                    ],
                },
                'webp'
            )
        ).toEqual({
            kind: 'found',
            variant: { path: 'vn/objects/bb.webp', sha256: 'bb' },
        });
    });

    it('reports every malformed candidate when none is usable', () => {
        expect(
            findVariant(
                {
                    assets: [
                        { variants: { webp: { path: 7, sha256: 'aa' } } },
                        { variants: { webp: 'vn/objects/bb.webp' } },
                    ],
                },
                'webp'
            )
        ).toEqual({
            kind: 'malformed',
            detail: 'assets.0.variants.webp is malformed (path is 7); assets.1.variants.webp is not an object ("vn/objects/bb.webp")',
        });
    });

    it('reports a non-object asset entry', () => {
        expect(findVariant({ assets: [42] }, 'webp')).toEqual({
            kind: 'malformed',
            detail: 'assets.0 is not an object (42)',
        });
    });

    it('reports a manifest with no assets array', () => {
        expect(findVariant({ assets: {} }, 'webp')).toEqual({
            kind: 'malformed',
            detail: 'manifest has no assets array',
        });
        expect(findVariant(null, 'webp')).toEqual({
            kind: 'malformed',
            detail: 'manifest has no assets array',
        });
    });
});
