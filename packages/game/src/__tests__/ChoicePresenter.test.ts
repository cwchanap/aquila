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

            presenter.clear();
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
});
