import { describe, expect, it } from 'vitest';
import { RUNTIME_ASSET_CACHE_POLICY } from '@aquila/stories/runtime-assets';
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
    findForbiddenKeys,
} from '../assertions';

// The assertions derive their required directives from this policy, so feeding
// the policy back into them would prove nothing. Pin the policy to the literal
// contract strings here instead, and assert against literals everywhere else.
describe('cache policy contract', () => {
    it('still declares the two headers the assertions are built from', () => {
        expect(
            RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl
        ).toBe('public, max-age=31536000, immutable');
        expect(
            RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
        ).toBe('no-cache, max-age=0, must-revalidate');
    });
});

describe('assertImmutable', () => {
    it('accepts a year-long immutable directive', () => {
        expect(assertImmutable('public, max-age=31536000, immutable').ok).toBe(
            true
        );
    });

    it('accepts the directives reordered, recased, and loosely spaced', () => {
        expect(
            assertImmutable(' IMMUTABLE ,Max-Age=31536000,  Public ').ok
        ).toBe(true);
    });

    it('rejects a directive missing immutable', () => {
        expect(assertImmutable('public, max-age=31536000').ok).toBe(false);
    });

    it('rejects a shorter max-age', () => {
        expect(assertImmutable('public, max-age=86400, immutable').ok).toBe(
            false
        );
    });

    it('rejects an object that shared caches may not store', () => {
        expect(assertImmutable('max-age=31536000, immutable').ok).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(assertImmutable(null).ok).toBe(false);
    });

    it('names the directives that are absent', () => {
        expect(assertImmutable('public, max-age=60').detail).toBe(
            'cache-control: public, max-age=60 (missing: max-age=31536000, immutable)'
        );
        expect(assertImmutable(null).detail).toBe(
            'cache-control: <missing> (missing: public, max-age=31536000, immutable)'
        );
    });

    it('reports the observed header when it passes', () => {
        expect(
            assertImmutable('public, max-age=31536000, immutable').detail
        ).toBe('cache-control: public, max-age=31536000, immutable');
    });

    // The required-directives check is a subset check, so a header carrying
    // every required directive PLUS one that contradicts the immutable policy
    // would pass while the cache's effective behaviour contradicts the
    // contract. These negative tests pin the conflicting extras that must fail
    // even when `public, max-age=31536000, immutable` is fully present.
    it('rejects no-store appended to an otherwise immutable header', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, no-store'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('no-store');
    });

    it('rejects private appended to an otherwise immutable header', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, private'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('private');
    });

    it('rejects no-cache appended to an otherwise immutable header', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, no-cache'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('no-cache');
    });

    it('rejects a second max-age that overrides the one-year freshness', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, max-age=0'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('max-age=0');
    });

    it('rejects s-maxage=0 that overrides shared-cache freshness', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, s-maxage=0'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('s-maxage=0');
    });

    // The conflict check parses each directive into name/value, including
    // quoted arguments (RFC 7230 quoted-string). A quoted freshness directive
    // is still honoured by real caches — `s-maxage` takes precedence over
    // `max-age` in shared caches — so a quoted zero must not slip past as an
    // unrecognised extra. The previous regex only matched unquoted numerics,
    // so these headers passed while a cache served them as stale.
    it('rejects a quoted max-age that overrides the one-year freshness', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, max-age="0"'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('max-age=0');
    });

    it('rejects a quoted s-maxage that overrides shared-cache freshness', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, s-maxage="0"'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('s-maxage=0');
    });

    // Duplicate freshness directives are ambiguous even when their text is
    // identical: caches may honour either occurrence or treat the response as
    // stale, so a second `max-age=31536000` is not a benign extra.
    it('rejects a duplicate identical max-age', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, max-age=31536000'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('duplicate max-age');
    });

    it('rejects a duplicate identical s-maxage', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, s-maxage=31536000, s-maxage=31536000'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toContain('duplicate s-maxage');
    });

    it('names every conflicting directive when several are present', () => {
        const result = assertImmutable(
            'public, max-age=31536000, immutable, no-store, private, no-cache'
        );
        expect(result.ok).toBe(false);
        expect(result.detail).toBe(
            'cache-control: public, max-age=31536000, immutable, no-store, private, no-cache (conflicting: no-store, private, no-cache)'
        );
    });

    it('still accepts a benign extra that does not contradict immutability', () => {
        // `no-transform` only forbids media-type mangling; it does not change
        // freshness or cacheability, so it must not be flagged as conflicting.
        expect(
            assertImmutable('public, max-age=31536000, immutable, no-transform')
                .ok
        ).toBe(true);
    });
});

describe('assertPointerRevalidation', () => {
    it('requires all three revalidation directives regardless of order', () => {
        expect(
            assertPointerRevalidation('must-revalidate, max-age=0, no-cache').ok
        ).toBe(true);
    });

    it('tolerates an extra directive the edge may add', () => {
        expect(
            assertPointerRevalidation(
                'no-cache, max-age=0, must-revalidate, no-store'
            ).ok
        ).toBe(true);
    });

    it('rejects a pointer cached like an immutable object', () => {
        expect(
            assertPointerRevalidation('public, max-age=31536000, immutable').ok
        ).toBe(false);
    });

    it('rejects a pointer that never revalidates once stale', () => {
        expect(assertPointerRevalidation('no-cache, max-age=0').ok).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(assertPointerRevalidation(null).ok).toBe(false);
    });

    it('names the directives that are absent', () => {
        expect(assertPointerRevalidation('no-cache').detail).toBe(
            'cache-control: no-cache (missing: max-age=0, must-revalidate)'
        );
    });
});

describe('assertContentType', () => {
    it('ignores charset parameters', () => {
        expect(
            assertContentType(
                'application/json; charset=utf-8',
                'application/json'
            ).ok
        ).toBe(true);
    });

    it('ignores case and surrounding whitespace', () => {
        expect(assertContentType(' IMAGE/WebP ', 'image/webp').ok).toBe(true);
    });

    it('normalizes the expected type too, so a recased caller is not a false negative', () => {
        const assertion = assertContentType('image/webp', 'Image/WebP');
        expect(assertion.ok).toBe(true);
        expect(assertion.detail).toBe('content-type: image/webp');
    });

    it('rejects the octet-stream default r2 uses when type is unset', () => {
        expect(
            assertContentType('application/octet-stream', 'image/avif').ok
        ).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(assertContentType(null, 'application/json').ok).toBe(false);
    });

    it('reports what was expected when it fails', () => {
        expect(
            assertContentType('application/octet-stream', 'image/avif').detail
        ).toBe('content-type: application/octet-stream (expected image/avif)');
        expect(assertContentType(null, 'image/avif').detail).toBe(
            'content-type: <missing> (expected image/avif)'
        );
    });
});

describe('findForbiddenKeys', () => {
    it('finds a forbidden key nested in an array', () => {
        expect(findForbiddenKeys({ assets: [{ prompt: 'a wizard' }] })).toEqual(
            ['assets.0.prompt']
        );
    });

    it('does not flag a forbidden word appearing only in a value', () => {
        expect(
            findForbiddenKeys({ assets: [{ key: 'chapter_1/prompt_room' }] })
        ).toEqual([]);
    });

    it('returns nothing for a clean manifest', () => {
        expect(findForbiddenKeys({ schemaVersion: 1, assets: [] })).toEqual([]);
    });

    it('matches key names case-insensitively but reports them as written', () => {
        expect(findForbiddenKeys({ SourcePath: 'raw/a.png' })).toEqual([
            'SourcePath',
        ]);
    });

    it('reports every forbidden key, including nested ones', () => {
        expect(
            findForbiddenKeys({
                provider: 'some-vendor',
                assets: [
                    {
                        identity: { key: 'chapter_1/ch1_act2_s0' },
                        meta: {
                            sourcePath: 'raw/a.png',
                            credentials: { token: 'abc' },
                        },
                    },
                ],
            })
        ).toEqual([
            'provider',
            'assets.0.meta.sourcePath',
            'assets.0.meta.credentials',
            'assets.0.meta.credentials.token',
        ]);
    });

    it('indexes a top-level array without a leading separator', () => {
        expect(findForbiddenKeys([{ prompt: 'a wizard' }])).toEqual([
            '0.prompt',
        ]);
    });

    it('ignores scalars and null', () => {
        expect(findForbiddenKeys(null)).toEqual([]);
        expect(findForbiddenKeys('prompt')).toEqual([]);
        expect(findForbiddenKeys(7)).toEqual([]);
    });
});
