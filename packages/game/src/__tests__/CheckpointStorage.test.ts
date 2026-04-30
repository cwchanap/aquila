import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    saveCheckpoint,
    loadCheckpoint,
    clearCheckpoint,
    type CheckpointState,
} from '../CheckpointStorage';
import { SceneDirectory } from '../SceneDirectory';

describe('CheckpointStorage', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();

        // Mock SceneDirectory.isRegisteredScene to accept test scene IDs
        vi.spyOn(SceneDirectory, 'isRegisteredScene').mockImplementation(
            (id: string | null | undefined) =>
                id ? ['scene_1', 'scene_2'].includes(id) : false
        );
    });

    describe('saveCheckpoint', () => {
        it('saves checkpoint to localStorage', () => {
            const state: CheckpointState = {
                sceneId: 'scene_2',
                history: ['scene_1', 'scene_2'],
            };

            saveCheckpoint('trainAdventure', state);

            const saved = localStorage.getItem(
                'aquila:checkpoint:trainAdventure'
            );
            expect(saved).not.toBeNull();

            const parsed = JSON.parse(saved!);
            expect(parsed.version).toBe(1);
            expect(parsed.storyId).toBe('trainAdventure');
            expect(parsed.sceneId).toBe('scene_2');
            expect(parsed.history).toEqual(['scene_1', 'scene_2']);
            expect(typeof parsed.savedAt).toBe('number');
        });

        it('does not save when history is empty', () => {
            const state: CheckpointState = {
                sceneId: 'scene_1',
                history: [],
            };

            saveCheckpoint('trainAdventure', state);

            const saved = localStorage.getItem(
                'aquila:checkpoint:trainAdventure'
            );
            expect(saved).toBeNull();
        });
    });

    describe('loadCheckpoint', () => {
        it('loads valid checkpoint from localStorage', () => {
            const checkpoint = {
                version: 1,
                storyId: 'trainAdventure',
                sceneId: 'scene_2',
                history: ['scene_1', 'scene_2'],
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );

            const loaded = loadCheckpoint('trainAdventure');

            expect(loaded).not.toBeNull();
            expect(loaded!.sceneId).toBe('scene_2');
            expect(loaded!.history).toEqual(['scene_1', 'scene_2']);
        });

        it('returns null for non-existent checkpoint', () => {
            const loaded = loadCheckpoint('nonExistent');
            expect(loaded).toBeNull();
        });

        it('returns null for wrong version', () => {
            const checkpoint = {
                version: 999,
                storyId: 'trainAdventure',
                sceneId: 'scene_1',
                history: ['scene_1'],
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );

            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });

        it('returns null for mismatched storyId', () => {
            const checkpoint = {
                version: 1,
                storyId: 'wrongStory',
                sceneId: 'scene_1',
                history: ['scene_1'],
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );

            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });

        it('returns null for invalid sceneId', () => {
            const checkpoint = {
                version: 1,
                storyId: 'trainAdventure',
                sceneId: 'invalid_scene',
                history: ['invalid_scene'],
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );

            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });

        it('filters invalid scene ids from history', () => {
            const checkpoint = {
                version: 1,
                storyId: 'trainAdventure',
                sceneId: 'scene_2',
                history: ['scene_1', 'invalid', 'scene_2'],
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );

            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).not.toBeNull();
            expect(loaded!.history).toEqual(['scene_1', 'scene_2']);
        });

        it('returns null when parsed JSON is null (line 51 branch)', () => {
            // JSON.parse("null") === null — covers the !parsed guard
            localStorage.setItem('aquila:checkpoint:trainAdventure', 'null');
            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });

        it('falls back to empty array when history is not an array (line 58 false branch)', () => {
            // history is a string instead of an array → filteredHistory = [] → returns null
            const checkpoint = {
                version: 1,
                storyId: 'trainAdventure',
                sceneId: 'scene_2',
                history: 'not-an-array',
                savedAt: Date.now(),
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );
            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });

        it('uses Date.now() fallback when savedAt is not a number (lines 68-71 branch)', () => {
            const checkpoint = {
                version: 1,
                storyId: 'trainAdventure',
                sceneId: 'scene_2',
                history: ['scene_1', 'scene_2'],
                savedAt: 'not-a-number',
            };
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                JSON.stringify(checkpoint)
            );
            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).not.toBeNull();
            expect(typeof loaded!.savedAt).toBe('number');
        });

        it('returns null for corrupted JSON', () => {
            localStorage.setItem(
                'aquila:checkpoint:trainAdventure',
                'not valid json'
            );

            const loaded = loadCheckpoint('trainAdventure');
            expect(loaded).toBeNull();
        });
    });

    describe('clearCheckpoint', () => {
        it('removes checkpoint from localStorage', () => {
            const state: CheckpointState = {
                sceneId: 'scene_1',
                history: ['scene_1'],
            };
            saveCheckpoint('trainAdventure', state);
            expect(
                localStorage.getItem('aquila:checkpoint:trainAdventure')
            ).not.toBeNull();

            clearCheckpoint('trainAdventure');

            expect(
                localStorage.getItem('aquila:checkpoint:trainAdventure')
            ).toBeNull();
        });

        it('does not throw for non-existent checkpoint', () => {
            expect(() => clearCheckpoint('nonExistent')).not.toThrow();
        });

        it('swallows errors when localStorage.removeItem throws (line 84 catch)', () => {
            vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
                throw new Error('Storage error');
            });
            expect(() => clearCheckpoint('trainAdventure')).not.toThrow();
        });
    });

    describe('saveCheckpoint error handling', () => {
        it('swallows errors when localStorage.setItem throws (line 39 catch)', () => {
            vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
                throw new Error('QuotaExceededError');
            });
            const state: CheckpointState = {
                sceneId: 'scene_1',
                history: ['scene_1'],
            };
            expect(() => saveCheckpoint('trainAdventure', state)).not.toThrow();
        });
    });

    describe('localStorage unavailable — all functions (lines 26, 46, 81)', () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('loadCheckpoint returns null when window.localStorage is null', () => {
            vi.stubGlobal('localStorage', null);
            expect(loadCheckpoint('trainAdventure')).toBeNull();
        });

        it('saveCheckpoint returns early when window.localStorage is null', () => {
            vi.stubGlobal('localStorage', null);
            const state: CheckpointState = {
                sceneId: 'scene_1',
                history: ['scene_1'],
            };
            expect(() => saveCheckpoint('trainAdventure', state)).not.toThrow();
        });

        it('clearCheckpoint returns early when window.localStorage is null', () => {
            vi.stubGlobal('localStorage', null);
            expect(() => clearCheckpoint('trainAdventure')).not.toThrow();
        });
    });
});
