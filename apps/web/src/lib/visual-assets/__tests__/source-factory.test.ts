import { describe, expect, it } from 'vitest';
import { getAssetResolverSource } from '../source-factory';

describe('getAssetResolverSource', () => {
    it('selects the exact local preview source for The Seventh Mirror', () => {
        expect(
            getAssetResolverSource(
                'the_seventh_mirror',
                'http://localhost:5090/reader'
            )
        ).toEqual({
            environment: 'local',
            storyId: 'the_seventh_mirror',
            baseUrl: 'http://localhost:5090/assets/',
            target: { kind: 'preview', previewId: 'hpa-228-local' },
        });
    });

    it('returns null for stories without a visual source', () => {
        expect(
            getAssetResolverSource('train_adventure', 'http://localhost:5090')
        ).toBeNull();
    });
});
