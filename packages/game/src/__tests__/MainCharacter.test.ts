import { describe, it, expect, vi } from 'vitest';
import { MainCharacter } from '../characters/MainCharacter';

// Minimal Phaser.Scene mock – only needs what BaseCharacter.constructor uses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockScene = { add: { sprite: vi.fn().mockReturnValue({}) } } as any;

describe('MainCharacter', () => {
    describe('constructor', () => {
        it('creates an instance without throwing', () => {
            expect(() => new MainCharacter(mockScene, 'Hero')).not.toThrow();
        });

        it('stores the name', () => {
            const char = new MainCharacter(mockScene, 'Hero');
            expect((char as any).name).toBe('Hero');
        });

        it('stores the scene reference', () => {
            const char = new MainCharacter(mockScene, 'Hero');
            expect((char as any).scene).toBe(mockScene);
        });
    });

    describe('makeDecision', () => {
        it('logs the character name and choice', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const char = new MainCharacter(mockScene, 'Hero');
            char.makeDecision('left');
            expect(spy).toHaveBeenCalledWith('Hero chooses: left');
            spy.mockRestore();
        });

        it('does not throw for any choice string', () => {
            const char = new MainCharacter(mockScene, 'Hero');
            expect(() => char.makeDecision('any choice')).not.toThrow();
        });
    });
});
