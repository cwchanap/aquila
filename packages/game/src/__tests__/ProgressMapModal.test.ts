import { describe, it, expect, vi } from 'vitest';
import { ProgressMapModal } from '../ProgressMapModal';
import { makeMockScene } from './phaserMock';
import type { FlowNodeDefinition } from '../SceneFlow';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeScene = () => makeMockScene() as any;

// ── Fixtures ───────────────────────────────────────────────────────────────

const linearNodes: FlowNodeDefinition[] = [
    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1', next: 'scene_2' },
    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2', next: null },
];

const makeConfig = (onClose = vi.fn()) => ({
    mapConfig: {
        nodes: linearNodes,
        currentNodeId: 'scene_1',
        completedHistory: ['scene_1'],
        width: 800,
        height: 400,
        interactive: false,
        locale: 'en',
    },
    onClose,
});

// Find the mock for a text object created with the given label string
function findTextMockByLabel(
    scene: ReturnType<typeof makeScene>,
    label: string
) {
    const idx = (scene.add.text.mock.calls as unknown[][]).findIndex(
        call => call[2] === label
    );
    return idx >= 0 ? scene.add.text.mock.results[idx].value : undefined;
}

// Simulate a pointerup click on the first rectangle (the backdrop)
function clickBackdrop(scene: ReturnType<typeof makeScene>) {
    const backdropMock = scene.add.rectangle.mock.results[0]?.value;
    if (!backdropMock) return;
    const pointerupCall = backdropMock.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'pointerup'
    );
    if (pointerupCall) {
        (pointerupCall[1] as () => void)();
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ProgressMapModal', () => {
    describe('constructor', () => {
        it('creates an instance without throwing', () => {
            expect(
                () => new ProgressMapModal(makeScene(), makeConfig())
            ).not.toThrow();
        });

        it('creates the root container via scene.add.container', () => {
            const scene = makeScene();
            new ProgressMapModal(scene, makeConfig());
            expect(scene.add.container).toHaveBeenCalled();
        });
    });

    describe('isVisible', () => {
        it('is false before show()', () => {
            const modal = new ProgressMapModal(makeScene(), makeConfig());
            expect(modal.isVisible()).toBe(false);
        });

        it('is true after show()', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            expect(modal.isVisible()).toBe(true);
        });
    });

    describe('show', () => {
        it('runs without throwing', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            expect(() => modal.show()).not.toThrow();
        });

        it('creates backdrop, panel, title and close button', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            // backdrop + panel (2 rects minimum)
            expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
            // title + close button (2 texts minimum)
            expect(scene.add.text.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('shows English title for en locale', () => {
            const scene = makeScene();
            scene.registry.get.mockReturnValue('en');
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            const textArgs = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(textArgs).toContain('Story Progress Map');
        });

        it('shows Chinese title when locale is zh', () => {
            const scene = makeScene();
            scene.registry.get.mockReturnValue('zh');
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            const textArgs = scene.add.text.mock.calls.map(
                (call: unknown[]) => call[2]
            );
            expect(textArgs).toContain('故事進度圖');
        });

        it('is a no-op when already visible', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            const rectCallCount = scene.add.rectangle.mock.calls.length;
            modal.show(); // second call
            expect(scene.add.rectangle.mock.calls.length).toBe(rectCallCount);
        });

        it('registers an ESC key listener', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            expect(scene.input.keyboard.addKey).toHaveBeenCalled();
        });
    });

    describe('close via backdrop click', () => {
        it('sets isVisible to false', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            clickBackdrop(scene);
            expect(modal.isVisible()).toBe(false);
        });

        it('calls the onClose callback', () => {
            const scene = makeScene();
            const onClose = vi.fn();
            const modal = new ProgressMapModal(scene, makeConfig(onClose));
            modal.show();
            clickBackdrop(scene);
            expect(onClose).toHaveBeenCalledOnce();
        });
    });

    describe('destroy', () => {
        it('does not throw when called before show()', () => {
            const modal = new ProgressMapModal(makeScene(), makeConfig());
            expect(() => modal.destroy()).not.toThrow();
        });

        it('does not throw when called after show()', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            expect(() => modal.destroy()).not.toThrow();
        });
    });

    describe('updateProgress', () => {
        it('does not throw when map is not shown', () => {
            const modal = new ProgressMapModal(makeScene(), makeConfig());
            expect(() =>
                modal.updateProgress('scene_2', ['scene_1', 'scene_2'])
            ).not.toThrow();
        });

        it('does not throw when called after show()', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            expect(() =>
                modal.updateProgress('scene_2', ['scene_1', 'scene_2'])
            ).not.toThrow();
        });
    });

    describe('isEscListenerHost integration', () => {
        it('calls pauseEscListener on the scene if it is an EscListenerHost', () => {
            const scene = makeScene();
            const pauseFn = vi.fn();
            const resumeFn = vi.fn();
            scene.pauseEscListener = pauseFn;
            scene.resumeEscListener = resumeFn;

            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            expect(pauseFn).toHaveBeenCalled();
        });

        it('calls resumeEscListener on close when scene is an EscListenerHost (line 272)', () => {
            const scene = makeScene();
            const pauseFn = vi.fn();
            const resumeFn = vi.fn();
            scene.pauseEscListener = pauseFn;
            scene.resumeEscListener = resumeFn;

            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();
            clickBackdrop(scene);
            expect(resumeFn).toHaveBeenCalled();
        });
    });

    describe('close button interactions', () => {
        it('closes the modal when close button is clicked (line 131)', () => {
            const scene = makeScene();
            const onClose = vi.fn();
            const modal = new ProgressMapModal(scene, makeConfig(onClose));
            modal.show();

            const closeBtnMock = findTextMockByLabel(scene, '✕ Close');
            const pointerupCb = closeBtnMock?.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerup'
            )?.[1] as (() => void) | undefined;

            pointerupCb?.();
            expect(modal.isVisible()).toBe(false);
            expect(onClose).toHaveBeenCalledOnce();
        });

        it('pointerover callback changes close button color (line 126)', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();

            const closeBtnMock = findTextMockByLabel(scene, '✕ Close');
            const pointeroverCb = closeBtnMock?.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerover'
            )?.[1] as (() => void) | undefined;

            expect(() => pointeroverCb?.()).not.toThrow();
            expect(closeBtnMock?.setColor).toHaveBeenCalledWith('#ffffff');
        });

        it('pointerout callback changes close button color (line 128)', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();

            const closeBtnMock = findTextMockByLabel(scene, '✕ Close');
            const pointeroutCb = closeBtnMock?.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerout'
            )?.[1] as (() => void) | undefined;

            expect(() => pointeroutCb?.()).not.toThrow();
            expect(closeBtnMock?.setColor).toHaveBeenCalledWith('#e5e7eb');
        });
    });

    describe('panel pointer event propagation stop', () => {
        function getPanelMock(scene: ReturnType<typeof makeScene>) {
            // Panel is the 2nd rectangle added (index 1, after backdrop)
            return scene.add.rectangle.mock.results[1]?.value;
        }

        it('pointerdown on panel calls event.stopPropagation (line 84)', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();

            const panel = getPanelMock(scene);
            const pointerdownCb = (panel.on.mock.calls as unknown[][]).find(
                c => c[0] === 'pointerdown'
            )?.[1] as
                | ((
                      _p: unknown,
                      _x: unknown,
                      _y: unknown,
                      e: { stopPropagation: () => void }
                  ) => void)
                | undefined;

            const mockEvent = { stopPropagation: vi.fn() };
            pointerdownCb?.(null, 0, 0, mockEvent);
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });

        it('pointerup on panel calls event.stopPropagation (line 95)', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();

            const panel = getPanelMock(scene);
            const pointerupCb = (panel.on.mock.calls as unknown[][]).find(
                c => c[0] === 'pointerup'
            )?.[1] as
                | ((
                      _p: unknown,
                      _x: unknown,
                      _y: unknown,
                      e: { stopPropagation: () => void }
                  ) => void)
                | undefined;

            const mockEvent = { stopPropagation: vi.fn() };
            pointerupCb?.(null, 0, 0, mockEvent);
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });
    });

    describe('nodeClicked event handler', () => {
        it('calls onNodeSelected and closes modal when nodeClicked fires (lines 155-159)', () => {
            const scene = makeScene();
            const onNodeSelected = vi.fn();
            const onClose = vi.fn();
            const config = {
                ...makeConfig(onClose),
                onNodeSelected,
            };
            const modal = new ProgressMapModal(scene, config);
            modal.show();

            // Emit nodeClicked on the internal StoryProgressionMap's eventEmitter
            const map = (
                modal as unknown as {
                    map: {
                        eventEmitter: {
                            emit: (e: string, ...args: unknown[]) => void;
                        };
                    };
                }
            ).map;
            map.eventEmitter.emit('nodeClicked', { nodeId: 'scene_2' });

            expect(onNodeSelected).toHaveBeenCalledWith('scene_2');
            expect(modal.isVisible()).toBe(false);
        });

        it('closes modal even when onNodeSelected is not set', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, makeConfig());
            modal.show();

            const map = (
                modal as unknown as {
                    map: {
                        eventEmitter: {
                            emit: (e: string, ...args: unknown[]) => void;
                        };
                    };
                }
            ).map;
            map.eventEmitter.emit('nodeClicked', { nodeId: 'scene_1' });

            expect(modal.isVisible()).toBe(false);
        });
    });

    describe('close() guard and callback branches', () => {
        it('returns early when close() is called while already not visible (line 267 early return)', () => {
            const scene = makeScene();
            const onClose = vi.fn();
            const modal = new ProgressMapModal(scene, makeConfig(onClose));
            modal.show();
            clickBackdrop(scene); // first close — visible becomes false, onClose called once
            onClose.mockClear();
            // Call close() again directly — !this.visible is true → early return
            (modal as unknown as { close: () => void }).close();
            expect(onClose).not.toHaveBeenCalled();
        });

        it('does not throw when onClose is not provided (line 275 false branch)', () => {
            const scene = makeScene();
            const modal = new ProgressMapModal(scene, {
                mapConfig: makeConfig().mapConfig,
                // no onClose
            });
            modal.show();
            expect(() => clickBackdrop(scene)).not.toThrow();
            expect(modal.isVisible()).toBe(false);
        });
    });

    describe('ESC key handler', () => {
        it('closes the modal when the ESC handler is invoked (line 166)', () => {
            const scene = makeScene();
            const onClose = vi.fn();
            const modal = new ProgressMapModal(scene, makeConfig(onClose));
            modal.show();

            // Invoke the stored escHandler directly (same function registered with key.on('down'))
            const handler = (modal as unknown as { escHandler?: () => void })
                .escHandler;
            handler?.();

            expect(modal.isVisible()).toBe(false);
            expect(onClose).toHaveBeenCalledOnce();
        });
    });
});
