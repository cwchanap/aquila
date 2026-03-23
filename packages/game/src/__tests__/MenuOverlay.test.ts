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

    describe('backdrop click triggers close via registered pointerup handler', () => {
        it('backdrop pointerup handler calls close with onResume', () => {
            const scene = makeScene();
            const config = defaultConfig();
            const overlay = new MenuOverlay(scene);
            overlay.show(config);

            // backdrop is the first rectangle created (index 0)
            const backdrop = scene.add.rectangle.mock.results[0].value;
            const pointerupCall = backdrop.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerup'
            );
            expect(pointerupCall).toBeDefined();

            // Invoke the backdrop pointerup callback
            const backdropPointerupCb = pointerupCall[1] as () => void;
            backdropPointerupCb();

            expect(overlay.open).toBe(false);
            expect(config.onResume).toHaveBeenCalled();
        });
    });

    describe('button event handlers', () => {
        it('pointerover on first button calls setFillStyle with hover color', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());

            // Button rectangles start at index 2 (0=backdrop, 1=panel, 2=first button)
            const firstButton = scene.add.rectangle.mock.results[2].value;
            const pointeroverCall = firstButton.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerover'
            );
            expect(pointeroverCall).toBeDefined();

            const pointeroverCb = pointeroverCall[1] as () => void;
            pointeroverCb();

            expect(firstButton.setFillStyle).toHaveBeenCalledWith(
                0x334155,
                0.95
            );
        });

        it('pointerout on first button calls setFillStyle with default color', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());

            const firstButton = scene.add.rectangle.mock.results[2].value;
            const pointeroutCall = firstButton.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerout'
            );
            expect(pointeroutCall).toBeDefined();

            const pointeroutCb = pointeroutCall[1] as () => void;
            pointeroutCb();

            expect(firstButton.setFillStyle).toHaveBeenCalledWith(
                0x1e293b,
                0.9
            );
        });

        it('pointerup on Resume button calls close with onResume', () => {
            const scene = makeScene();
            const config = defaultConfig();
            const overlay = new MenuOverlay(scene);
            overlay.show(config);

            // First button (Resume Story) is at rectangle index 2
            const firstButton = scene.add.rectangle.mock.results[2].value;
            const pointerupCall = firstButton.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerup'
            );
            expect(pointerupCall).toBeDefined();

            const mockEvent = { stopPropagation: vi.fn() };
            const pointerupCb = pointerupCall[1] as (
                ptr: unknown,
                lx: unknown,
                ly: unknown,
                event: { stopPropagation: () => void }
            ) => void;
            pointerupCb(null, null, null, mockEvent);

            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(overlay.open).toBe(false);
            expect(config.onResume).toHaveBeenCalled();
        });

        it('pointerup on Progress Map button calls close with onProgressMap', () => {
            const scene = makeScene();
            const config = defaultConfig();
            const overlay = new MenuOverlay(scene);
            overlay.show(config);

            // Second button (Progress Map) is at rectangle index 3
            const secondButton = scene.add.rectangle.mock.results[3].value;
            const pointerupCall = secondButton.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerup'
            );
            expect(pointerupCall).toBeDefined();

            const mockEvent = { stopPropagation: vi.fn() };
            const pointerupCb = pointerupCall[1] as (
                ptr: unknown,
                lx: unknown,
                ly: unknown,
                event: { stopPropagation: () => void }
            ) => void;
            pointerupCb(null, null, null, mockEvent);

            expect(config.onProgressMap).toHaveBeenCalled();
        });

        it('pointerup on Return Home button calls close with onHome', () => {
            const scene = makeScene();
            const config = defaultConfig();
            const overlay = new MenuOverlay(scene);
            overlay.show(config);

            // Third button (Return Home) is at rectangle index 4
            const thirdButton = scene.add.rectangle.mock.results[4].value;
            const pointerupCall = thirdButton.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerup'
            );
            expect(pointerupCall).toBeDefined();

            const mockEvent = { stopPropagation: vi.fn() };
            const pointerupCb = pointerupCall[1] as (
                ptr: unknown,
                lx: unknown,
                ly: unknown,
                event: { stopPropagation: () => void }
            ) => void;
            pointerupCb(null, null, null, mockEvent);

            expect(config.onHome).toHaveBeenCalled();
        });

        it('stopPropagation handler stops event propagation on panel pointerdown', () => {
            const scene = makeScene();
            const overlay = new MenuOverlay(scene);
            overlay.show(defaultConfig());

            // Panel is at rectangle index 1
            const panel = scene.add.rectangle.mock.results[1].value;
            const pointerdownCall = panel.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'pointerdown'
            );
            expect(pointerdownCall).toBeDefined();

            const mockEvent = { stopPropagation: vi.fn() };
            const stopPropCb = pointerdownCall[1] as (
                ptr: unknown,
                lx: unknown,
                ly: unknown,
                event: { stopPropagation: () => void }
            ) => void;
            stopPropCb(null, null, null, mockEvent);

            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });
    });
});
