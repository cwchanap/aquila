import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveCheckpoint,
    loadCheckpoint,
    clearCheckpoint,
    type CheckpointState,
} from '../CheckpointStorage';

describe('CheckpointStorage', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
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
    });
});
