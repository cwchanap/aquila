import { describe, expect, it } from 'vitest';
import { createVisualRuntime, getAssetResolverSource } from '../source-factory';

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

    it('creates a disposable visual runtime only for a sourced story', async () => {
        const getSceneDialogue = () => null;

        expect(
            createVisualRuntime(
                'train_adventure',
                'http://localhost:5090',
                getSceneDialogue
            )
        ).toBeNull();

        const runtime = createVisualRuntime(
            'the_seventh_mirror',
            'http://localhost:5090',
            getSceneDialogue
        );
        expect(runtime?.controller).toBeDefined();
        expect(runtime?.softRevalidate).toEqual(expect.any(Function));
        expect(runtime?.dispose).toEqual(expect.any(Function));
        await expect(runtime?.dispose()).resolves.toBeUndefined();
    });
});
