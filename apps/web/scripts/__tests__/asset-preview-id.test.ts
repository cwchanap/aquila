/**
 * Tests for asset-preview-id.ts.
 *
 * Covers the asset preview-id contracts:
 *  - `derivePreviewId` must not merge distinct refs into one preview namespace
 *    (slugification is lossy, so a digest discriminator is appended to every
 *    non-empty slug).
 *  - `previewIdForEnv` must honour an explicit `PUBLIC_ASSET_PREVIEW_ID` for
 *    spoiler-sensitive previews instead of always deriving from the branch.
 *  - `writePreviewId` is the thin CLI writer these contracts feed into.
 *
 * The `main` composition and the `import.meta.main` Bun CLI entrypoint are
 * exercised by the co-located suite in
 * `src/lib/visual-assets/__tests__/preview-id.test.ts`, which drives the
 * script the same way the build does.
 */
import { describe, it, expect } from 'vitest';
import {
    derivePreviewId,
    previewIdForEnv,
    writePreviewId,
} from '../asset-preview-id';
import { isPreviewId } from '@aquila/stories/runtime-assets';

const PREVIEW_ENV = {
    VERCEL_ENV: 'preview',
    PUBLIC_ASSET_BASE_URL: 'https://assets.example.dev/',
    PUBLIC_ASSET_ENVIRONMENT: 'preview',
    VERCEL_GIT_COMMIT_REF: 'feature/foo',
} as const;

// A realistic branch that already overflows the 64-character clamp; used to
// exercise the slug-prefix clamp and sibling-distinctness behaviour.
const LONG_BRANCH =
    'jack65786656/hpa-229-provision-isolated-aquila-r2-visual-asset-delivery';

describe('derivePreviewId', () => {
    it('produces ids that satisfy isPreviewId()', () => {
        const refs = [
            'feature/foo',
            'feature-foo',
            'Feature/Foo',
            'a__b',
            'a--b',
            'HPA-229',
            'author/ticket-long-description-that-overflows-the-sixty-four-character-slug-budget',
            'main',
            'release/1.2.3',
        ];
        for (const ref of refs) {
            const id = derivePreviewId(ref);
            expect(isPreviewId(id), `${ref} -> ${id}`).toBe(true);
        }
    });

    it('never exceeds the 64-character isPreviewId limit', () => {
        const longRef = `author/ticket-${'a'.repeat(200)}-description`;
        expect(derivePreviewId(longRef).length).toBeLessThanOrEqual(64);
    });

    it('is deterministic: the same ref always maps to the same id', () => {
        expect(derivePreviewId('feature/foo')).toBe(
            derivePreviewId('feature/foo')
        );
    });

    it('does not collide across refs that slugify identically', () => {
        // Slugification collapses all three to `feature-foo`; without a digest
        // they would share one preview namespace and publishing one would
        // overwrite another's assets.
        const a = derivePreviewId('feature/foo');
        const b = derivePreviewId('feature-foo');
        const c = derivePreviewId('Feature/Foo');
        expect(a).not.toBe(b);
        expect(a).not.toBe(c);
        expect(b).not.toBe(c);
    });

    it('does not collide across separator variants', () => {
        expect(derivePreviewId('a__b')).not.toBe(derivePreviewId('a--b'));
    });

    it('distinguishes refs that differ only in case', () => {
        // The digest is over the NFC ref before lowercasing, so case differences
        // survive even when the slug collides.
        expect(derivePreviewId('Feature/Foo')).not.toBe(
            derivePreviewId('feature/foo')
        );
    });

    it('returns a preview- prefixed digest for a ref that slugifies to empty', () => {
        // `derivePreviewId` is a pure function; a ref whose slug is empty still
        // yields a valid id. This path is reachable for refs like `'日本語'`,
        // but previewIdForEnv never reaches it with an absent ref (see below).
        const id = derivePreviewId('日本語');
        expect(id).toMatch(/^preview-[a-f0-9]{8}$/);
        expect(isPreviewId(id)).toBe(true);
        expect(derivePreviewId('日本語')).toBe(id);
    });

    it('lowercases, replaces slashes, and appends a ref digest', () => {
        // The digest is over the NFC ref before lowercasing, so the slug stays
        // readable while refs that slugify identically remain distinct.
        expect(derivePreviewId('feature/Foo_Bar')).toMatch(
            /^feature-foo_bar-[0-9a-f]{12}$/
        );
    });

    it('strips leading and trailing separators before digesting', () => {
        expect(derivePreviewId('-HPA-229-')).toMatch(/^hpa-229-[0-9a-f]{12}$/);
    });

    it('collapses runs of separators before digesting', () => {
        expect(derivePreviewId('a///b')).toMatch(/^a-b-[0-9a-f]{12}$/);
        expect(derivePreviewId('a__b')).toMatch(/^a-b-[0-9a-f]{12}$/);
        expect(derivePreviewId('a-_-b')).toMatch(/^a-b-[0-9a-f]{12}$/);
    });

    it('clamps the slug prefix so the whole id stays within 64 characters', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(64);
        expect(isPreviewId(result)).toBe(true);
    });

    it('appends a digest to every non-empty slug, even when it fits', () => {
        // The discriminator is not conditional on truncation: a bare slug
        // would merge refs that slugify identically (`feature/foo` and
        // `feature-foo`), so every non-empty slug gets one. The prefix is
        // clamped to 51 chars, leaving room for `-` plus the 12-hex digest,
        // so the whole id stays within the 64-char isPreviewId limit.
        expect(derivePreviewId('a'.repeat(63))).toMatch(/^a{51}-[0-9a-f]{12}$/);
        expect(derivePreviewId('a'.repeat(64))).toMatch(/^a{51}-[0-9a-f]{12}$/);
        expect(derivePreviewId('a'.repeat(65))).toMatch(/^a{51}-[0-9a-f]{12}$/);
    });

    it('keeps sibling branches that differ only past the clamp distinct', () => {
        const siblings = [
            LONG_BRANCH,
            `${LONG_BRANCH}-followup`,
            'jack65786656/hpa-229-provision-isolated-aquila-r2-visual-asset-fix',
        ];
        const ids = siblings.map(derivePreviewId);

        expect(new Set(ids).size).toBe(siblings.length);
        for (const id of ids) {
            expect(id.length).toBeLessThanOrEqual(64);
            expect(isPreviewId(id)).toBe(true);
        }
    });

    it('gives canonically equivalent refs the same id', () => {
        // 'e' + combining acute normalizes to precomposed 'é'. Both take the
        // hash-fallback path, so the hash input must be normalized as well.
        expect(derivePreviewId('e\u0301')).toBe(derivePreviewId('\u00e9'));
    });
});

describe('previewIdForEnv missing-ref handling', () => {
    const PREVIEW_ENV_NO_REF = {
        VERCEL_ENV: 'preview',
        PUBLIC_ASSET_BASE_URL: 'https://assets.example.dev/',
        PUBLIC_ASSET_ENVIRONMENT: 'preview',
    } as const;

    it('fails the build when VERCEL_GIT_COMMIT_REF is absent', () => {
        // Hashing the empty string is deterministic, so every ref-less build
        // would otherwise collapse onto one shared preview namespace. Fail
        // instead of silently sharing one.
        expect(() => previewIdForEnv(PREVIEW_ENV_NO_REF)).toThrow(
            /VERCEL_GIT_COMMIT_REF is absent/
        );
        expect(() =>
            previewIdForEnv({
                ...PREVIEW_ENV_NO_REF,
                VERCEL_GIT_COMMIT_REF: '',
            })
        ).toThrow(/VERCEL_GIT_COMMIT_REF is absent/);
        expect(() =>
            previewIdForEnv({
                ...PREVIEW_ENV_NO_REF,
                VERCEL_GIT_COMMIT_REF: '   ',
            })
        ).toThrow(/VERCEL_GIT_COMMIT_REF is absent/);
    });

    it('honours an explicit id instead of failing on an absent ref', () => {
        const explicit = 'unguessable-preview-9f3a';
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV_NO_REF,
                PUBLIC_ASSET_PREVIEW_ID: explicit,
            })
        ).toBe(explicit);
    });
});

describe('previewIdForEnv', () => {
    it('returns empty outside VERCEL_ENV=preview', () => {
        expect(
            previewIdForEnv({ ...PREVIEW_ENV, VERCEL_ENV: 'production' })
        ).toBe('');
        expect(previewIdForEnv({ ...PREVIEW_ENV, VERCEL_ENV: undefined })).toBe(
            ''
        );
    });

    it('returns empty without a base URL', () => {
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_BASE_URL: undefined,
            })
        ).toBe('');
        expect(
            previewIdForEnv({ ...PREVIEW_ENV, PUBLIC_ASSET_BASE_URL: '   ' })
        ).toBe('');
    });

    it('returns empty when the environment is not preview', () => {
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toBe('');
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_ENVIRONMENT: undefined,
            })
        ).toBe('');
    });

    it('derives from the branch ref when no explicit id is set', () => {
        expect(previewIdForEnv(PREVIEW_ENV)).toBe(
            derivePreviewId('feature/foo')
        );
    });

    it('honours an explicit PUBLIC_ASSET_PREVIEW_ID instead of deriving', () => {
        const explicit = 'unguessable-preview-9f3a';
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_PREVIEW_ID: explicit,
            })
        ).toBe(explicit);
    });

    it('trims an explicit id before honouring it', () => {
        const explicit = 'unguessable-preview-9f3a';
        expect(
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_PREVIEW_ID: `  ${explicit}  `,
            })
        ).toBe(explicit);
    });

    it('treats a whitespace-only explicit id as unset and derives', () => {
        expect(
            previewIdForEnv({ ...PREVIEW_ENV, PUBLIC_ASSET_PREVIEW_ID: '   ' })
        ).toBe(derivePreviewId('feature/foo'));
    });

    it('throws on an explicit id that fails isPreviewId', () => {
        expect(() =>
            previewIdForEnv({
                ...PREVIEW_ENV,
                PUBLIC_ASSET_PREVIEW_ID: 'Bad/Preview Id!',
            })
        ).toThrow(/invalid id/);
    });
});

describe('writePreviewId', () => {
    it('writes a valid id to stdout and returns 0', () => {
        const chunks: string[] = [];
        const stdout = { write: (c: string) => (chunks.push(c), true) };
        const stderr = { write: () => true };
        const code = writePreviewId('feature-foo-abcdef123456', stdout, stderr);
        expect(code).toBe(0);
        expect(chunks.join('')).toBe('feature-foo-abcdef123456');
    });

    it('writes an error and returns 1 for an invalid id', () => {
        const stderrChunks: string[] = [];
        const stdout = { write: () => true };
        const stderr = { write: (c: string) => (stderrChunks.push(c), true) };
        const code = writePreviewId('Bad/Id!', stdout, stderr);
        expect(code).toBe(1);
        expect(stderrChunks.join('')).toMatch(/invalid preview id/);
    });

    it('writes nothing and returns 0 for an empty id', () => {
        const chunks: string[] = [];
        const stdout = { write: (c: string) => (chunks.push(c), true) };
        const stderr = { write: () => true };
        const code = writePreviewId('', stdout, stderr);
        expect(code).toBe(0);
        expect(chunks.join('')).toBe('');
    });
});
