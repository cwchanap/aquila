import { describe, it, expect, vi } from 'vitest';
import { BaseCharacter } from '../characters/BaseCharacter';

// ── Minimal scene mock ─────────────────────────────────────────────────────

function makeScene() {
    const spriteMock = { destroy: vi.fn(), x: 0, y: 0 };
    return {
        add: {
            sprite: vi.fn().mockReturnValue(spriteMock),
        },
        _spriteMock: spriteMock,
    };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BaseCharacter', () => {
    describe('constructor', () => {
        it('creates an instance without throwing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(
                () => new BaseCharacter(makeScene() as any, 'Hero')
            ).not.toThrow();
        });

        it('stores the name', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(makeScene() as any, 'Alice');
            expect((char as any).name).toBe('Alice');
        });

        it('stores the scene reference', () => {
            const scene = makeScene();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(scene as any, 'Alice');
            expect((char as any).scene).toBe(scene);
        });

        it('initialises sprite as undefined', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(makeScene() as any, 'Hero');
            expect((char as any).sprite).toBeUndefined();
        });
    });

    describe('createSprite', () => {
        it('calls scene.add.sprite with correct arguments', () => {
            const scene = makeScene();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(scene as any, 'Hero');
            char.createSprite(100, 200, 'hero-texture');
            expect(scene.add.sprite).toHaveBeenCalledWith(
                100,
                200,
                'hero-texture'
            );
        });

        it('assigns the returned sprite to this.sprite', () => {
            const scene = makeScene();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(scene as any, 'Hero');
            const result = char.createSprite(0, 0, 'tex');
            expect((char as any).sprite).toBe(result);
        });

        it('returns the sprite created by scene.add.sprite', () => {
            const scene = makeScene();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(scene as any, 'Hero');
            const returned = char.createSprite(10, 20, 'tex');
            expect(returned).toBe(scene._spriteMock);
        });

        it('can be called multiple times (last call wins for sprite)', () => {
            const scene = makeScene();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(scene as any, 'Hero');
            char.createSprite(0, 0, 'tex1');
            const second = char.createSprite(5, 5, 'tex2');
            expect((char as any).sprite).toBe(second);
        });
    });

    describe('speak', () => {
        it('logs character name with the dialogue string', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(makeScene() as any, 'Narrator');
            char.speak('Hello, world!');
            expect(spy).toHaveBeenCalledWith('Narrator: Hello, world!');
            spy.mockRestore();
        });

        it('does not throw for an empty dialogue string', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(makeScene() as any, 'NPC');
            expect(() => char.speak('')).not.toThrow();
        });

        it('uses the exact name provided to the constructor', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const char = new BaseCharacter(makeScene() as any, 'Li Jie');
            char.speak('I wonder...');
            expect(spy).toHaveBeenCalledWith('Li Jie: I wonder...');
            spy.mockRestore();
        });
    });
});
