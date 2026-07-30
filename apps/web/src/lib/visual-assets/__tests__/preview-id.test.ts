import { describe, expect, it } from 'vitest';
import { isPreviewId } from '@aquila/stories/runtime-assets';
import {
    derivePreviewId,
    previewIdForEnv,
} from '../../../../scripts/asset-preview-id';

// The branch this feature was built on: `author/ticket-long-description` is the
// convention in use here, and it already overflows the 63-character clamp.
const LONG_BRANCH =
    'jack65786656/hpa-229-provision-isolated-aquila-r2-visual-asset-delivery';

const CONFIGURED_ENV = {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
    PUBLIC_ASSET_BASE_URL: 'https://assets.aquila.cwchanap.dev/',
    PUBLIC_ASSET_ENVIRONMENT: 'preview',
};

describe('derivePreviewId', () => {
    it('lowercases and replaces slashes', () => {
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('strips leading and trailing separators', () => {
        expect(derivePreviewId('-HPA-229-')).toBe('hpa-229');
    });

    it('collapses runs of separators', () => {
        expect(derivePreviewId('a///b')).toBe('a-b');
        expect(derivePreviewId('a__b')).toBe('a-b');
        expect(derivePreviewId('a-_-b')).toBe('a-b');
    });

    it('clamps to 63 characters without a trailing separator', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(63);
        expect(isPreviewId(result)).toBe(true);
    });

    it('leaves an id that already fits untouched', () => {
        expect(derivePreviewId('a'.repeat(63))).toBe('a'.repeat(63));
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('appends a hash suffix only when it truncates', () => {
        expect(derivePreviewId('a'.repeat(64))).toMatch(/^a{54}-[0-9a-f]{6}$/);
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
            expect(id.length).toBeLessThanOrEqual(63);
            expect(isPreviewId(id)).toBe(true);
        }
    });

    it('derives truncated ids deterministically', () => {
        expect(derivePreviewId(LONG_BRANCH)).toBe(derivePreviewId(LONG_BRANCH));
    });

    it('falls back to a deterministic hash when nothing survives', () => {
        const first = derivePreviewId('日本語');
        expect(first).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(derivePreviewId('日本語')).toBe(first);
    });

    it('gives canonically equivalent refs the same id', () => {
        // 'e' + combining acute normalizes to precomposed 'é'. Both take the
        // hash-fallback path, so the hash input must be normalized as well.
        expect(derivePreviewId('e\u0301')).toBe(derivePreviewId('\u00e9'));
    });

    it('always produces a valid preview id', () => {
        for (const ref of [
            'main',
            'HPA-229',
            'feature/Foo_Bar',
            '日本語',
            '___',
            LONG_BRANCH,
            `${'x'.repeat(200)}`,
        ]) {
            expect(isPreviewId(derivePreviewId(ref))).toBe(true);
        }
    });
});

describe('previewIdForEnv', () => {
    it('derives an id for a fully configured preview build', () => {
        expect(previewIdForEnv(CONFIGURED_ENV)).toBe('feature-foo_bar');
    });

    it('emits nothing outside a preview build', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                VERCEL_ENV: 'production',
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toBe('');
        expect(
            previewIdForEnv({ ...CONFIGURED_ENV, VERCEL_ENV: undefined })
        ).toBe('');
    });

    it('emits nothing when the rest of the asset config is absent', () => {
        expect(
            previewIdForEnv({
                VERCEL_ENV: 'preview',
                VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
            })
        ).toBe('');
    });

    it('emits nothing when only the base URL is configured', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                PUBLIC_ASSET_ENVIRONMENT: undefined,
            })
        ).toBe('');
    });

    it('emits nothing when the asset environment is not preview', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toBe('');
    });

    it('treats blank configuration as absent, like the reader does', () => {
        expect(
            previewIdForEnv({ ...CONFIGURED_ENV, PUBLIC_ASSET_BASE_URL: '   ' })
        ).toBe('');
    });

    it('still yields a valid id when the branch ref is missing', () => {
        const id = previewIdForEnv({
            ...CONFIGURED_ENV,
            VERCEL_GIT_COMMIT_REF: undefined,
        });
        expect(id).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(isPreviewId(id)).toBe(true);
    });
});
