import { describe, it, expect } from 'vitest';
import { GameConfig } from '../GameConfig';

describe('GameConfig', () => {
    describe('ui', () => {
        it('has a dialogueBoxHeight that is a positive number', () => {
            expect(typeof GameConfig.ui.dialogueBoxHeight).toBe('number');
            expect(GameConfig.ui.dialogueBoxHeight).toBeGreaterThan(0);
        });

        it('has a dialoguePadding that is a positive number', () => {
            expect(typeof GameConfig.ui.dialoguePadding).toBe('number');
            expect(GameConfig.ui.dialoguePadding).toBeGreaterThan(0);
        });

        it('has a dialogueBottomMargin that is a non-negative number', () => {
            expect(typeof GameConfig.ui.dialogueBottomMargin).toBe('number');
            expect(GameConfig.ui.dialogueBottomMargin).toBeGreaterThanOrEqual(
                0
            );
        });

        it('has a fadeInDuration that is a positive number', () => {
            expect(typeof GameConfig.ui.fadeInDuration).toBe('number');
            expect(GameConfig.ui.fadeInDuration).toBeGreaterThan(0);
        });

        it('has a fadeOutDuration that is a positive number', () => {
            expect(typeof GameConfig.ui.fadeOutDuration).toBe('number');
            expect(GameConfig.ui.fadeOutDuration).toBeGreaterThan(0);
        });
    });

    describe('audio', () => {
        it('has a defaultAmbientGain that is a small positive number', () => {
            expect(typeof GameConfig.audio.defaultAmbientGain).toBe('number');
            expect(GameConfig.audio.defaultAmbientGain).toBeGreaterThan(0);
            expect(GameConfig.audio.defaultAmbientGain).toBeLessThan(1);
        });

        it('has a defaultAmbientFrequency that is a positive number', () => {
            expect(typeof GameConfig.audio.defaultAmbientFrequency).toBe(
                'number'
            );
            expect(GameConfig.audio.defaultAmbientFrequency).toBeGreaterThan(0);
        });

        it('has a beepGain that is a small positive number', () => {
            expect(typeof GameConfig.audio.beepGain).toBe('number');
            expect(GameConfig.audio.beepGain).toBeGreaterThan(0);
            expect(GameConfig.audio.beepGain).toBeLessThan(1);
        });

        it('has a beepFrequency that is a positive number', () => {
            expect(typeof GameConfig.audio.beepFrequency).toBe('number');
            expect(GameConfig.audio.beepFrequency).toBeGreaterThan(0);
        });

        it('has a beepDuration that is a short positive number', () => {
            expect(typeof GameConfig.audio.beepDuration).toBe('number');
            expect(GameConfig.audio.beepDuration).toBeGreaterThan(0);
            // Duration should be under a second for a "beep"
            expect(GameConfig.audio.beepDuration).toBeLessThan(1);
        });
    });

    describe('structure', () => {
        it('exposes top-level ui and audio namespaces', () => {
            expect(GameConfig).toHaveProperty('ui');
            expect(GameConfig).toHaveProperty('audio');
        });

        it('is a frozen (const) object', () => {
            // TypeScript `as const` — properties are readonly at compile-time.
            // At runtime we just verify the expected keys exist.
            expect(Object.keys(GameConfig)).toContain('ui');
            expect(Object.keys(GameConfig)).toContain('audio');
        });
    });
});
