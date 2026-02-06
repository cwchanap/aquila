import { describe, it, expect, afterEach } from 'vitest';
import {
    SceneDirectory,
    SceneRegistry,
    type SceneInfo,
} from '../SceneDirectory';

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

        it('returns undefined for invalid scene id', () => {
            const info = SceneDirectory.getInfo('invalid');
            expect(info).toBeUndefined();
        });
    });

    describe('getAll', () => {
        it('returns all scene infos', () => {
            const all = SceneDirectory.getAll();
            expect(all.length).toBeGreaterThanOrEqual(5);
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

        it('returns fallback for invalid scene', () => {
            const key = SceneDirectory.getBackgroundTextureKey('nonexistent');
            expect(key).toBe('bg-generic');
        });
    });

    describe('getAmbientFrequency', () => {
        it('returns frequency for valid scene', () => {
            const freq = SceneDirectory.getAmbientFrequency('scene_3');
            expect(freq).toBe(95);
        });

        it('returns default for invalid scene', () => {
            const freq = SceneDirectory.getAmbientFrequency('nonexistent');
            expect(freq).toBe(80);
        });
    });

    describe('getFallbackColor', () => {
        it('returns color for valid scene', () => {
            const color = SceneDirectory.getFallbackColor('scene_1');
            expect(color).toBe(0x0b1022);
        });

        it('returns default for invalid scene', () => {
            const color = SceneDirectory.getFallbackColor('nonexistent');
            expect(color).toBe(0x000000);
        });
    });

    describe('isRegisteredScene', () => {
        it('returns true for valid scene ids', () => {
            expect(SceneDirectory.isRegisteredScene('scene_1')).toBe(true);
            expect(SceneDirectory.isRegisteredScene('scene_4a')).toBe(true);
        });

        it('returns false for invalid values', () => {
            expect(SceneDirectory.isRegisteredScene('invalid')).toBe(false);
            expect(SceneDirectory.isRegisteredScene(null)).toBe(false);
            expect(SceneDirectory.isRegisteredScene(undefined)).toBe(false);
            expect(SceneDirectory.isRegisteredScene('')).toBe(false);
        });
    });

    describe('defaultStart', () => {
        it('is scene_1 when registry is populated', () => {
            expect(SceneDirectory.defaultStart).toBe('scene_1');
        });

        it('returns null when registry is cleared', () => {
            SceneRegistry.clear();
            expect(SceneDirectory.defaultStart).toBeNull();
            // Restore for other tests
            SceneRegistry.registerMany([
                {
                    id: 'scene_1',
                    label: 'Entry Platform',
                    backgroundTextureKey: 'bg-scene_1',
                    ambientFrequency: 80,
                    fallbackColor: 0x0b1022,
                },
                {
                    id: 'scene_2',
                    label: 'Train Ride',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
                {
                    id: 'scene_3',
                    label: 'Otherworld Station',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4a',
                    label: 'Leave Train',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4b',
                    label: 'Stay On Train',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
            ]);
            SceneRegistry.setDefaultStart('scene_1');
        });
    });
});

describe('SceneRegistry', () => {
    const testScene: SceneInfo = {
        id: 'test_scene',
        label: 'Test Scene',
        backgroundTextureKey: 'bg-test',
        ambientFrequency: 100,
        fallbackColor: 0xff0000,
    };

    afterEach(() => {
        // Clean up test scenes if registered - check both test_scene and test_scene_2
        if (
            SceneRegistry.has('test_scene') ||
            SceneRegistry.has('test_scene_2')
        ) {
            SceneRegistry.clear();
            // Re-register default scenes since clear() removes everything
            SceneRegistry.registerMany([
                {
                    id: 'scene_1',
                    label: 'Entry Platform',
                    backgroundTextureKey: 'bg-scene_1',
                    ambientFrequency: 80,
                    fallbackColor: 0x0b1022,
                },
                {
                    id: 'scene_2',
                    label: 'Train Ride',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
                {
                    id: 'scene_3',
                    label: 'Otherworld Station',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4a',
                    label: 'Leave Train',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4b',
                    label: 'Stay On Train',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
            ]);
            // Reset default start after re-registration
            SceneRegistry.setDefaultStart('scene_1');
        }
    });

    describe('register', () => {
        it('registers a new scene', () => {
            SceneRegistry.register(testScene);
            expect(SceneRegistry.has('test_scene')).toBe(true);
            expect(SceneRegistry.get('test_scene')).toEqual(testScene);
        });
    });

    describe('registerMany', () => {
        it('registers multiple scenes', () => {
            const scenes: SceneInfo[] = [
                testScene,
                { ...testScene, id: 'test_scene_2', label: 'Test Scene 2' },
            ];
            SceneRegistry.registerMany(scenes);
            expect(SceneRegistry.has('test_scene')).toBe(true);
            expect(SceneRegistry.has('test_scene_2')).toBe(true);
        });
    });

    describe('get', () => {
        it('returns scene info for registered scene', () => {
            const info = SceneRegistry.get('scene_1');
            expect(info).toBeDefined();
            expect(info?.id).toBe('scene_1');
        });

        it('returns undefined for unregistered scene', () => {
            expect(SceneRegistry.get('nonexistent')).toBeUndefined();
        });
    });

    describe('has', () => {
        it('returns true for registered scene', () => {
            expect(SceneRegistry.has('scene_1')).toBe(true);
        });

        it('returns false for unregistered scene', () => {
            expect(SceneRegistry.has('nonexistent')).toBe(false);
        });
    });

    describe('all', () => {
        it('returns all registered scenes', () => {
            const all = SceneRegistry.all();
            expect(all.length).toBeGreaterThanOrEqual(5);
            expect(all.some(s => s.id === 'scene_1')).toBe(true);
        });
    });

    describe('defaultStart', () => {
        afterEach(() => {
            // Only set default start if scenes are registered
            if (SceneRegistry.has('scene_1')) {
                SceneRegistry.setDefaultStart('scene_1');
            }
        });

        it('returns scene_1 by default when scenes registered', () => {
            expect(SceneRegistry.defaultStart).toBe('scene_1');
        });

        it('returns null after clear()', () => {
            SceneRegistry.clear();
            expect(SceneRegistry.defaultStart).toBeNull();
            // Restore for other tests
            SceneRegistry.registerMany([
                {
                    id: 'scene_1',
                    label: 'Entry Platform',
                    backgroundTextureKey: 'bg-scene_1',
                    ambientFrequency: 80,
                    fallbackColor: 0x0b1022,
                },
                {
                    id: 'scene_2',
                    label: 'Train Ride',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
                {
                    id: 'scene_3',
                    label: 'Otherworld Station',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4a',
                    label: 'Leave Train',
                    backgroundTextureKey: 'bg-scene_3',
                    ambientFrequency: 95,
                    fallbackColor: 0x2b0000,
                },
                {
                    id: 'scene_4b',
                    label: 'Stay On Train',
                    backgroundTextureKey: 'bg-scene_2',
                    ambientFrequency: 60,
                    fallbackColor: 0x000000,
                },
            ]);
            SceneRegistry.setDefaultStart('scene_1');
        });

        it('can be changed to a registered scene', () => {
            SceneRegistry.setDefaultStart('scene_2');
            expect(SceneRegistry.defaultStart).toBe('scene_2');
        });

        it('throws when setting to unregistered scene', () => {
            expect(() =>
                SceneRegistry.setDefaultStart('nonexistent')
            ).toThrow();
        });
    });

    describe('helper methods', () => {
        it('getBackgroundTextureKey returns texture key', () => {
            expect(SceneRegistry.getBackgroundTextureKey('scene_1')).toBe(
                'bg-scene_1'
            );
        });

        it('getAmbientFrequency returns frequency', () => {
            expect(SceneRegistry.getAmbientFrequency('scene_1')).toBe(80);
        });

        it('getFallbackColor returns color', () => {
            expect(SceneRegistry.getFallbackColor('scene_1')).toBe(0x0b1022);
        });
    });
});
