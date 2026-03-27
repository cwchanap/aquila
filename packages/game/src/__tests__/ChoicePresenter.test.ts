import { describe, it, expect, vi } from 'vitest';
import { ChoicePresenter } from '../ui/ChoicePresenter';
import { makeMockScene } from './phaserMock';
import type { ChoiceMap } from '../dialogue/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeScene = () => makeMockScene() as any;

const testChoiceMap: ChoiceMap = {
    choice_1: {
        prompt: 'What do you do?',
        options: [
            { id: 'opt_a', label: 'Option A', nextScene: 'scene_4a' },
            { id: 'opt_b', label: 'Option B', nextScene: 'scene_4b' },
        ],
    },
};

describe('ChoicePresenter', () => {
    describe('awaiting', () => {
        it('is false initially', () => {
            const presenter = new ChoicePresenter(makeScene(), {});
            expect(presenter.awaiting).toBe(false);
        });
    });

    describe('setChoiceMap', () => {
        it('replaces the choice map used by present()', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, {});
            const onSelect = vi.fn();

            // With empty map, present falls back to onSelect('')
            presenter.present('choice_1', ['opt_a'], onSelect);
            expect(onSelect).toHaveBeenCalledWith('');
            onSelect.mockClear();

            // After setChoiceMap, valid choice creates UI
            presenter.setChoiceMap(testChoiceMap);
            presenter.present('choice_1', ['opt_a'], onSelect);
            expect(presenter.awaiting).toBe(true);
            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    describe('present', () => {
        it('sets awaiting to true when choice definition exists', () => {
            const presenter = new ChoicePresenter(makeScene(), testChoiceMap);
            presenter.present('choice_1', ['opt_a', 'opt_b'], vi.fn());
            expect(presenter.awaiting).toBe(true);
        });

        it('creates backdrop, panel and prompt game objects', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a', 'opt_b'], vi.fn());
            expect(scene.add.rectangle).toHaveBeenCalled();
            expect(scene.add.text).toHaveBeenCalled();
        });

        it('creates one button per matched option', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a', 'opt_b'], vi.fn());
            // backdrop + panel (2 rects) + 2 option button backgrounds (2 rects)
            expect(scene.add.rectangle).toHaveBeenCalledTimes(4);
        });

        it('calls onSelect immediately when choiceId is missing', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            const onSelect = vi.fn();
            presenter.present('nonexistent', ['opt_a'], onSelect);
            expect(onSelect).toHaveBeenCalledWith('');
            expect(presenter.awaiting).toBe(false);
        });

        it('calls onSelect immediately when no option IDs match', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            const onSelect = vi.fn();
            presenter.present('choice_1', ['unknown_opt'], onSelect);
            expect(onSelect).toHaveBeenCalledWith('');
            expect(presenter.awaiting).toBe(false);
        });

        it('destroys previous elements before building new ones', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], vi.fn());

            const mockRectCreatedFirst =
                scene.add.rectangle.mock.results[0].value;

            // Present again without explicit clear - should rebuild and destroy prior elements
            presenter.present('choice_1', ['opt_a'], vi.fn());

            expect(mockRectCreatedFirst.destroy).toHaveBeenCalled();
        });
    });

    describe('clear', () => {
        it('sets awaiting to false', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], vi.fn());
            expect(presenter.awaiting).toBe(true);

            presenter.clear();
            expect(presenter.awaiting).toBe(false);
        });

        it('destroys all created UI elements', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a', 'opt_b'], vi.fn());

            const createdRects = scene.add.rectangle.mock.results.map(
                (r: { value: unknown }) => r.value
            );
            const createdTexts = scene.add.text.mock.results.map(
                (r: { value: unknown }) => r.value
            );

            presenter.clear();

            createdRects.forEach(
                (rect: { destroy: ReturnType<typeof vi.fn> }) => {
                    expect(rect.destroy).toHaveBeenCalled();
                }
            );
            createdTexts.forEach(
                (text: { destroy: ReturnType<typeof vi.fn> }) => {
                    expect(text.destroy).toHaveBeenCalled();
                }
            );
        });

        it('is safe to call when not awaiting', () => {
            const presenter = new ChoicePresenter(makeScene(), {});
            expect(() => presenter.clear()).not.toThrow();
        });
    });

    describe('event callbacks', () => {
        it('backdrop pointerdown callback calls event.stopPropagation (line 57)', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], vi.fn());

            // Backdrop is the first rectangle created
            const backdrop = scene.add.rectangle.mock.results[0].value;
            const pointerdownCb = backdrop.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerdown'
            )?.[1] as
                | ((
                      p: unknown,
                      x: unknown,
                      y: unknown,
                      e: { stopPropagation: () => void }
                  ) => void)
                | undefined;

            const mockEvent = { stopPropagation: vi.fn() };
            pointerdownCb?.(null, 0, 0, mockEvent);
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });

        it('option button pointerover callback calls setFillStyle (line 128)', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], vi.fn());

            // Option button background is the 3rd rectangle (after backdrop + panel)
            const buttonBg = scene.add.rectangle.mock.results[2].value;
            const pointeroverCb = buttonBg.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerover'
            )?.[1] as (() => void) | undefined;

            expect(() => pointeroverCb?.()).not.toThrow();
            expect(buttonBg.setFillStyle).toHaveBeenCalled();
        });

        it('option button pointerout callback calls setFillStyle (line 131)', () => {
            const scene = makeScene();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], vi.fn());

            const buttonBg = scene.add.rectangle.mock.results[2].value;
            const pointeroutCb = buttonBg.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerout'
            )?.[1] as (() => void) | undefined;

            pointeroutCb?.();
            expect(buttonBg.setFillStyle).toHaveBeenCalled();
        });

        it('option button pointerup callback calls clear and onSelect (lines 133-135)', () => {
            const scene = makeScene();
            const onSelect = vi.fn();
            const presenter = new ChoicePresenter(scene, testChoiceMap);
            presenter.present('choice_1', ['opt_a'], onSelect);

            const buttonBg = scene.add.rectangle.mock.results[2].value;
            const pointerupCb = buttonBg.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerup'
            )?.[1] as (() => void) | undefined;

            pointerupCb?.();
            expect(presenter.awaiting).toBe(false);
            expect(onSelect).toHaveBeenCalledWith('opt_a');
        });
    });
});
