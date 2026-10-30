import { describe, expect, it } from 'vitest';
import { assetHostUrl } from '../asset-host';

describe('assetHostUrl', () => {
    it('resolves a path against the configured host', () => {
        expect(
            assetHostUrl('vn/covers/day_4012.webp', 'https://assets.example/')
        ).toBe('https://assets.example/vn/covers/day_4012.webp');
    });

    it('tolerates a host without a trailing slash and surrounding space', () => {
        expect(assetHostUrl('vn/voice', ' https://assets.example ')).toBe(
            'https://assets.example/vn/voice'
        );
    });

    it('is undefined without a configured host', () => {
        expect(assetHostUrl('vn/voice', '')).toBeUndefined();
        expect(assetHostUrl('vn/voice', '   ')).toBeUndefined();
    });
});
