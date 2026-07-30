import type { StoryFlowConfig } from '@aquila/stories';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisualRuntime, getAssetResolverSource } from '../source-factory';
import type { VisualSnapshot } from '../types';
import type { VisualControllerInput } from '../visual-state-controller';

const linearFlow = {
    start: 'scene',
    nodes: [{ kind: 'scene', id: 'scene', sceneId: 'scene', next: null }],
} as unknown as StoryFlowConfig;

/** A line that authors a background, so a resolver-less runtime must fail it. */
function keyedLineInput(): VisualControllerInput {
    return {
        storyId: 'the_seventh_mirror',
        sceneId: 'scene',
        dialogue: [{ dialogue: 'Authored visuals', background: 'room' }],
        dialogueIndex: 0,
        flow: linearFlow,
        presentation: null,
    };
}

async function flushAsyncWork(): Promise<void> {
    for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
    }
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('getAssetResolverSource', () => {
    it('selects the exact local preview source for The Seventh Mirror', () => {
        expect(
            getAssetResolverSource(
                'the_seventh_mirror',
                'http://localhost:5090/reader',
                {}
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
            getAssetResolverSource(
                'train_adventure',
                'http://localhost:5090',
                {}
            )
        ).toBeNull();
    });

    it('selects a production source when configured', () => {
        expect(
            getAssetResolverSource(
                'the_seventh_mirror',
                'http://localhost:5090',
                {
                    baseUrl: 'https://assets.aquila.cwchanap.dev/',
                    environment: 'production',
                }
            )
        ).toEqual({
            environment: 'production',
            storyId: 'the_seventh_mirror',
            baseUrl: 'https://assets.aquila.cwchanap.dev/',
            target: { kind: 'production' },
        });
    });
});

describe('createVisualRuntime', () => {
    it('creates a disposable visual runtime for source-less stories', async () => {
        const getSceneDialogue = () => null;

        const runtime = createVisualRuntime(
            'train_adventure',
            'http://localhost:5090',
            getSceneDialogue
        );
        expect(runtime?.controller).toBeDefined();
        expect(runtime?.softRevalidate).toEqual(expect.any(Function));
        expect(runtime?.dispose).toEqual(expect.any(Function));
        await expect(runtime?.dispose()).resolves.toBeUndefined();
    });

    it('creates a disposable visual runtime for sourced stories', async () => {
        const getSceneDialogue = () => null;

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

    it('degrades to no-visuals instead of throwing on invalid config', async () => {
        // The caller is an unguarded Svelte `$effect`, so a throw here would
        // take the whole reader down over one stray environment variable.
        const invalidConfig = {
            baseUrl: 'https://assets.aquila.cwchanap.dev/',
            environment: 'production',
            previewId: 'hpa-229',
        };
        expect(() =>
            getAssetResolverSource(
                'the_seventh_mirror',
                'http://localhost:5090',
                invalidConfig
            )
        ).toThrow(/preview id is meaningless/i);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const runtime = createVisualRuntime(
            'the_seventh_mirror',
            'http://localhost:5090',
            () => null,
            invalidConfig
        );

        expect(runtime?.controller).toBeDefined();
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('Visual assets disabled'),
            expect.objectContaining({
                message: expect.stringMatching(/preview id is meaningless/i),
            })
        );

        // No resolver was built, so an authored visual reports `unavailable`
        // rather than being fetched.
        const snapshots: VisualSnapshot[] = [];
        runtime!.controller.subscribe(snapshot => snapshots.push(snapshot));
        runtime!.controller.update(keyedLineInput());
        await flushAsyncWork();
        expect(snapshots.at(-1)!.release).toBe('unavailable');
        expect(snapshots.at(-1)!.stagingBackground.state).toBe('failed');

        await expect(runtime?.dispose()).resolves.toBeUndefined();
    });
});
