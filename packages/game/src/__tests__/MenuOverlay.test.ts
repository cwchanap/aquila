import { describe, it, expect, vi } from 'vitest';
import { MenuOverlay } from '../ui/MenuOverlay';
import { makeMockScene } from './phaserMock';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeScene = () => makeMockScene() as any;

const defaultConfig = () => ({
    locale: 'en',
    onResume: vi.fn(),
    onProgressMap: vi.fn(),
    onHome: vi.fn(),
});

describe('MenuOverlay', () => {
    describe('open', () => {
        it('is false initially', () => {
            const overlay = new MenuOverlay(makeScene());
            expect(overlay.open).toBe(false);
        });
    });

    describe('show', () => {
        it('sets open to true', () => {
            const overlay = new MenuOverlay(makeScene());
            overlay.show(defaultConfig());
            expect(overlay.open).toBe(true);
        });

        it('creates backdrop and panel via scene.add.rectangle', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());
            expect(scene.add.rectangle).toHaveBeenCalled();
        });

        it('creates title and button labels via scene.add.text', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());
            expect(scene.add.text).toHaveBeenCalled();
        });

        it('uses English labels when locale is "en"', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show({ ...defaultConfig(), locale: 'en' });

            const allTextArgs = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(allTextArgs).toContain('Game Menu');
        });

        it('uses Chinese labels when locale starts with "zh"', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show({ ...defaultConfig(), locale: 'zh' });

            const allTextArgs = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(allTextArgs).toContain('遊戲選單');
        });

        it('is a no-op when already open', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            const config = defaultConfig();
            overlay.show(config);
            const rectCallCount = scene.add.rectangle.mock.calls.length;

            overlay.show(config); // second call is a no-op
            expect(scene.add.rectangle.mock.calls.length).toBe(rectCallCount);
        });
    });

    describe('close', () => {
        it('sets open to false', () => {
            const overlay = new MenuOverlay(makeScene());
            overlay.show(defaultConfig());
            overlay.close();
            expect(overlay.open).toBe(false);
        });

        it('destroys all UI elements', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());

            const createdElements = [
                ...scene.add.rectangle.mock.results,
                ...scene.add.text.mock.results,
            ].map(
                (r: { value: { destroy: ReturnType<typeof vi.fn> } }) => r.value
            );

            overlay.close();

            createdElements.forEach(el => {
                expect(el.destroy).toHaveBeenCalled();
            });
        });

        it('calls the onDone callback when provided', () => {
            const overlay = new MenuOverlay(makeScene());
            overlay.show(defaultConfig());
            const onDone = vi.fn();
            overlay.close(onDone);
            expect(onDone).toHaveBeenCalledOnce();
        });

        it('does not call onDone when not open', () => {
            const overlay = new MenuOverlay(makeScene());
            const onDone = vi.fn();
            overlay.close(onDone);
            expect(onDone).not.toHaveBeenCalled();
        });
    });

    describe('forceClose', () => {
        it('sets open to false', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());
            overlay.forceClose();
            expect(overlay.open).toBe(false);
        });

        it('is safe to call when already closed', () => {
            const overlay = new MenuOverlay(makeScene());
            expect(() => overlay.forceClose()).not.toThrow();
            expect(overlay.open).toBe(false);
        });

        it('destroys elements without requiring a callback', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());

            const firstRect = scene.add.rectangle.mock.results[0].value;

            overlay.forceClose();
            expect(firstRect.destroy).toHaveBeenCalled();
        });
    });

    describe('close calls onResume when triggered via backdrop click', () => {
        it('close(onResume) calls the provided resume handler', () => {
            const overlay = new MenuOverlay(makeScene());
            const onResume = vi.fn();
            overlay.show({ ...defaultConfig(), onResume });
            overlay.close(onResume);
            expect(onResume).toHaveBeenCalledOnce();
        });
    });
});
