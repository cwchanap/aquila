import { describe, it, expect, vi } from 'vitest';
import { CompletionOverlay } from '../ui/CompletionOverlay';
import { makeMockScene } from './phaserMock';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeScene = () => makeMockScene() as any;

describe('CompletionOverlay', () => {
    describe('visible', () => {
        it('is false initially', () => {
            const overlay = new CompletionOverlay(makeScene());
            expect(overlay.visible).toBe(false);
        });
    });

    describe('show', () => {
        it('sets visible to true', () => {
            const overlay = new CompletionOverlay(makeScene());
            overlay.show('en');
            expect(overlay.visible).toBe(true);
        });

        it('creates a full-screen overlay rectangle', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            expect(scene.add.rectangle).toHaveBeenCalledOnce();
        });

        it('creates three text objects (title, tip, button)', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            expect(scene.add.text).toHaveBeenCalledTimes(3);
        });

        it('shows English title and tip for "en" locale', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            const allText = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(allText).toContain('Chapter Complete');
            expect(allText).toContain('Press Enter to go Home');
        });

        it('shows Chinese title and tip for "zh" locale', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('zh');
            const allText = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(allText).toContain('章節完成');
            expect(allText).toContain('按 Enter 返回主選單');
        });

        it('registers an Enter key listener', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            expect(scene.input.keyboard.addKey).toHaveBeenCalled();
        });

        it('uses a custom homeUrl when provided', () => {
            // We can't directly assert the href navigation (jsdom), but we can
            // ensure show() runs to completion without throwing.
            const overlay = new CompletionOverlay(makeScene());
            expect(() => overlay.show('en', '/custom/')).not.toThrow();
        });

        it('is a no-op when already visible', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            const callsBefore = scene.add.text.mock.calls.length;
            overlay.show('en');
            expect(scene.add.text.mock.calls.length).toBe(callsBefore);
        });
    });

    describe('destroy', () => {
        it('sets visible to false', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            overlay.destroy();
            expect(overlay.visible).toBe(false);
        });

        it('destroys all game objects', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');

            const createdRects = scene.add.rectangle.mock.results.map(
                (r: { value: { destroy: ReturnType<typeof vi.fn> } }) => r.value
            );
            const createdTexts = scene.add.text.mock.results.map(
                (r: { value: { destroy: ReturnType<typeof vi.fn> } }) => r.value
            );

            overlay.destroy();

            createdRects.forEach(
                (el: { destroy: ReturnType<typeof vi.fn> }) => {
                    expect(el.destroy).toHaveBeenCalled();
                }
            );
            createdTexts.forEach(
                (el: { destroy: ReturnType<typeof vi.fn> }) => {
                    expect(el.destroy).toHaveBeenCalled();
                }
            );
        });

        it('is safe to call when not visible', () => {
            const overlay = new CompletionOverlay(makeScene());
            expect(() => overlay.destroy()).not.toThrow();
        });

        it('allows show() to be called again after destroy', () => {
            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en');
            overlay.destroy();
            expect(() => overlay.show('en')).not.toThrow();
            expect(overlay.visible).toBe(true);
        });
    });

    describe('null/empty locale branches', () => {
        it('handles null locale without throwing (covers locale ?? "" branch)', () => {
            const overlay = new CompletionOverlay(makeScene());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => overlay.show(null as any)).not.toThrow();
            expect(overlay.visible).toBe(true);
        });

        it('resolves homeUrl to "/" when locale is null and no homeUrl provided', () => {
            const mockLocation = { href: '' };
            vi.stubGlobal('location', mockLocation);

            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overlay.show(null as any);

            const mockKey = scene.input.keyboard.addKey.mock.results[0].value;
            const onceCb = mockKey.once.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'down'
            )?.[1] as (() => void) | undefined;
            onceCb?.();
            expect(mockLocation.href).toBe('/');

            vi.unstubAllGlobals();
        });
    });

    describe('navigation callbacks', () => {
        it('button pointerup callback sets window.location.href (line 65)', () => {
            const mockLocation = { href: '' };
            vi.stubGlobal('location', mockLocation);

            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en', '/home/');

            // The button is the 3rd text created (title, tip, btn)
            const btn = scene.add.text.mock.results[2].value;
            const pointerupCb = btn.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerup'
            )?.[1] as (() => void) | undefined;

            pointerupCb?.();
            expect(mockLocation.href).toBe('/home/');

            vi.unstubAllGlobals();
        });

        it('keyboard once-down callback sets window.location.href (line 72)', () => {
            const mockLocation = { href: '' };
            vi.stubGlobal('location', mockLocation);

            const scene = makeScene();
            const overlay = new CompletionOverlay(scene);
            overlay.show('en', '/home/');

            // enterKeyListener is the mock key returned by addKey
            const mockKey = scene.input.keyboard.addKey.mock.results[0].value;
            const onceCb = mockKey.once.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'down'
            )?.[1] as (() => void) | undefined;

            onceCb?.();
            expect(mockLocation.href).toBe('/home/');

            vi.unstubAllGlobals();
        });
    });
});
