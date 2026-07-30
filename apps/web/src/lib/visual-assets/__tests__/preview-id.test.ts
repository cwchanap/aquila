import { describe, expect, it } from 'vitest';
import { isPreviewId } from '@aquila/stories/runtime-assets';
import { derivePreviewId } from '../../../../scripts/asset-preview-id';

describe('derivePreviewId', () => {
    it('lowercases and replaces slashes', () => {
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('strips leading and trailing separators', () => {
        expect(derivePreviewId('-HPA-229-')).toBe('hpa-229');
    });

    it('collapses runs of separators', () => {
        expect(derivePreviewId('a///b')).toBe('a-b');
    });

    it('clamps to 63 characters without a trailing separator', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(63);
        expect(isPreviewId(result)).toBe(true);
    });

    it('falls back to a deterministic hash when nothing survives', () => {
        const first = derivePreviewId('日本語');
        expect(first).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(derivePreviewId('日本語')).toBe(first);
    });

    it('always produces a valid preview id', () => {
        for (const ref of [
            'main',
            'HPA-229',
            'feature/Foo_Bar',
            '日本語',
            '___',
            `${'x'.repeat(200)}`,
        ]) {
            expect(isPreviewId(derivePreviewId(ref))).toBe(true);
        }
    });
});
