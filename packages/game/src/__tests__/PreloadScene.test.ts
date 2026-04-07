import { describe, it, expect, beforeEach } from 'vitest';
import { PreloadScene } from '../PreloadScene';

describe('PreloadScene', () => {
    describe('constructor', () => {
        it('creates an instance without throwing', () => {
            expect(() => new PreloadScene()).not.toThrow();
        });

        it('is an instance of PreloadScene', () => {
            expect(new PreloadScene()).toBeInstanceOf(PreloadScene);
        });
    });

    describe('init', () => {
        it('stores init data on the scene', () => {
            const scene = new PreloadScene();
            (scene as any).init({
                characterName: 'Tester',
                locale: 'en',
                storyId: 'train_adventure',
            });
            const startData = (scene as any).startData;
            expect(startData.characterName).toBe('Tester');
            expect(startData.locale).toBe('en');
            expect(startData.storyId).toBe('train_adventure');
        });

        it('preserves defaults when init data is falsy', () => {
            const scene = new PreloadScene();
            (scene as any).init(null);
            const startData = (scene as any).startData;
            expect(startData.characterName).toBe('Player');
            expect(startData.locale).toBe('zh');
        });
    });

    describe('preload', () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it('runs without throwing', () => {
            const scene = new PreloadScene();
            expect(() => (scene as any).preload()).not.toThrow();
        });

        it('sets dialogueMap in registry', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const setCall = (scene as any).registry.set.mock.calls.find(
                (call: unknown[]) => call[0] === 'dialogueMap'
            );
            expect(setCall).toBeDefined();
            expect(setCall[1]).toBeDefined();
        });

        it('sets choiceMap in registry', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const setCall = (scene as any).registry.set.mock.calls.find(
                (call: unknown[]) => call[0] === 'choiceMap'
            );
            expect(setCall).toBeDefined();
            expect(setCall[1]).toBeDefined();
        });

        it('sets flowConfig in registry', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const setCall = (scene as any).registry.set.mock.calls.find(
                (call: unknown[]) => call[0] === 'flowConfig'
            );
            expect(setCall).toBeDefined();
        });

        it('sets checkpointState in registry', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const setCall = (scene as any).registry.set.mock.calls.find(
                (call: unknown[]) => call[0] === 'checkpointState'
            );
            expect(setCall).toBeDefined();
        });

        it('registers a loaderror handler', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const loadOn = (scene as any).load.on;
            const errorCall = loadOn.mock.calls.find(
                (call: unknown[]) => call[0] === 'loaderror'
            );
            expect(errorCall).toBeDefined();
        });

        it('loaderror handler creates placeholder graphics for image type', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const loadOn = (scene as any).load.on;
            const errorCall = loadOn.mock.calls.find(
                (call: unknown[]) => call[0] === 'loaderror'
            );
            const errorHandler = errorCall[1] as (file: unknown) => void;
            errorHandler({
                key: 'bg-scene_1',
                src: '/path.png',
                type: 'image',
            });
            expect((scene as any).add.graphics).toHaveBeenCalled();
        });

        it('loaderror handler skips graphics for non-image files (line 51 false branch)', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            const loadOn = (scene as any).load.on;
            const errorCall = loadOn.mock.calls.find(
                (call: unknown[]) => call[0] === 'loaderror'
            );
            const errorHandler = errorCall[1] as (file: unknown) => void;
            // Trigger with a non-image type — should not create graphics
            errorHandler({ key: 'data.json', src: '/data.json', type: 'json' });
            expect((scene as any).add.graphics).not.toHaveBeenCalled();
        });
    });

    describe('create', () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it('runs without throwing', () => {
            const scene = new PreloadScene();
            (scene as any).preload(); // populate registry mocks
            expect(() => (scene as any).create()).not.toThrow();
        });

        it('starts StoryScene via scene.start', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            (scene as any).create();
            const scenePlugin = (scene as any).scene;
            expect(scenePlugin.start).toHaveBeenCalledWith(
                'StoryScene',
                expect.objectContaining({ characterName: expect.any(String) })
            );
        });

        it('falls back to train_adventure when startData.storyId is falsy', () => {
            const scene = new PreloadScene();
            (scene as any).preload();
            // Make storyId falsy so the || fallback fires
            (scene as any).startData.storyId = undefined;
            (scene as any).create();
            expect((scene as any).scene.start).toHaveBeenCalledWith(
                'StoryScene',
                expect.objectContaining({ storyId: 'train_adventure' })
            );
        });
    });
});
