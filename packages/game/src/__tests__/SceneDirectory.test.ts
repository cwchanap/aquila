import { describe, it, expect } from 'vitest';
import { SceneDirectory } from '../SceneDirectory';

describe('SceneDirectory', () => {
    describe('getInfo', () => {
        it('returns scene info for valid scene id', () => {
            const info = SceneDirectory.getInfo('scene_1');
            expect(info).toEqual({
                id: 'scene_1',
                label: 'Entry Platform',
                backgroundTextureKey: 'bg-scene_1',
                ambientFrequency: 80,
                fallbackColor: 0x0b1022,
            });
        });
    });

    describe('getAll', () => {
        it('returns all scene infos', () => {
            const all = SceneDirectory.getAll();
            expect(all.length).toBe(5);
            expect(all.map(s => s.id)).toContain('scene_1');
            expect(all.map(s => s.id)).toContain('scene_4a');
            expect(all.map(s => s.id)).toContain('scene_4b');
        });
    });

    describe('getBackgroundTextureKey', () => {
        it('returns texture key for valid scene', () => {
            const key = SceneDirectory.getBackgroundTextureKey('scene_2');
            expect(key).toBe('bg-scene_2');
        });
    });

    describe('getAmbientFrequency', () => {
        it('returns frequency for valid scene', () => {
            const freq = SceneDirectory.getAmbientFrequency('scene_3');
            expect(freq).toBe(95);
        });
    });

    describe('getFallbackColor', () => {
        it('returns color for valid scene', () => {
            const color = SceneDirectory.getFallbackColor('scene_1');
            expect(color).toBe(0x0b1022);
        });
    });

    describe('isSceneId', () => {
        it('returns true for valid scene ids', () => {
            expect(SceneDirectory.isSceneId('scene_1')).toBe(true);
            expect(SceneDirectory.isSceneId('scene_4a')).toBe(true);
        });

        it('returns false for invalid values', () => {
            expect(SceneDirectory.isSceneId('invalid')).toBe(false);
            expect(SceneDirectory.isSceneId(null)).toBe(false);
            expect(SceneDirectory.isSceneId(undefined)).toBe(false);
            expect(SceneDirectory.isSceneId('')).toBe(false);
        });
    });

    describe('defaultStart', () => {
        it('is scene_1', () => {
            expect(SceneDirectory.defaultStart).toBe('scene_1');
        });
    });
});
