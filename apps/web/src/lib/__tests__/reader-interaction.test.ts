import { describe, expect, it } from 'vitest';
import type { StoryFlowConfig } from '@aquila/stories';
import { getTranslations } from '@aquila/stories/translations';
import {
    advanceLabelKey,
    getReaderAdvanceDecision,
    isChoicePosition,
    isEndingPosition,
    isReaderInteractiveTarget,
    isReaderProgressionTarget,
    type ReaderAdvanceDecision,
} from '@/lib/reader-interaction';

describe('getReaderAdvanceDecision', () => {
    it('allows completion at an ending without advancing past choices or empty content', () => {
        const ending = {
            isTyping: false,
            index: 1,
            length: 2,
            canGoNext: false,
            hasChoice: false,
        };
        expect(getReaderAdvanceDecision(ending)).toBe('complete');
        expect(getReaderAdvanceDecision({ ...ending, hasChoice: true })).toBe(
            'open-choice'
        );
        expect(
            getReaderAdvanceDecision({ ...ending, index: 0, length: 0 })
        ).toBe('none');
    });
    it.each([
        [
            {
                isTyping: true,
                index: 0,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'skip',
        ],
        [
            {
                isTyping: false,
                index: 0,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'advance-line',
        ],
        [
            {
                isTyping: false,
                index: 1,
                length: 2,
                canGoNext: true,
                hasChoice: false,
            },
            'advance-scene',
        ],
        [
            {
                isTyping: false,
                index: 1,
                length: 2,
                canGoNext: true,
                hasChoice: true,
            },
            'open-choice',
        ],
    ] as const)('returns %s', (input, expected) => {
        expect(getReaderAdvanceDecision(input)).toBe(expected);
    });

    it('returns open-choice on a revealed final line with a choice, ignoring canGoNext', () => {
        const atChoice = {
            isTyping: false,
            index: 2,
            length: 3,
            canGoNext: true,
            hasChoice: true,
        };
        expect(getReaderAdvanceDecision(atChoice)).toBe('open-choice');
        expect(
            getReaderAdvanceDecision({ ...atChoice, canGoNext: false })
        ).toBe('open-choice');
    });

    it('keeps typing skip and mid-scene line advances ahead of the choice', () => {
        const inChoiceScene = {
            isTyping: false,
            index: 1,
            length: 3,
            canGoNext: true,
            hasChoice: true,
        };
        expect(getReaderAdvanceDecision(inChoiceScene)).toBe('advance-line');
        expect(
            getReaderAdvanceDecision({ ...inChoiceScene, isTyping: true })
        ).toBe('skip');
        expect(
            getReaderAdvanceDecision({
                ...inChoiceScene,
                index: 2,
                isTyping: true,
            })
        ).toBe('skip');
    });

    it('returns none for a choice scene with no dialogue lines', () => {
        expect(
            getReaderAdvanceDecision({
                isTyping: false,
                index: 0,
                length: 0,
                canGoNext: true,
                hasChoice: true,
            })
        ).toBe('none');
    });

    it('does not open the choice for an index past the final line', () => {
        expect(
            getReaderAdvanceDecision({
                isTyping: false,
                index: 5,
                length: 3,
                canGoNext: true,
                hasChoice: true,
            })
        ).toBe('none');
    });

    it.each([1, 2, 3, 4])(
        'returns open-choice on the final line for a %i-option choice',
        optionCount => {
            expect(
                getReaderAdvanceDecision({
                    isTyping: false,
                    index: 0,
                    length: 1,
                    canGoNext: true,
                    hasChoice: optionCount > 0,
                })
            ).toBe('open-choice');
        }
    );
});

describe('isReaderInteractiveTarget', () => {
    it('recognizes controls, editable content, and marked descendants', () => {
        const root = document.createElement('div');
        const button = document.createElement('button');
        const buttonChild = document.createElement('span');
        button.append(buttonChild);
        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        const marked = document.createElement('div');
        marked.dataset.readerInteractive = '';
        const markedChild = document.createElement('span');
        marked.append(markedChild);
        root.append(button, editor, marked);
        expect(isReaderInteractiveTarget(buttonChild)).toBe(true);
        expect(isReaderInteractiveTarget(editor)).toBe(true);
        expect(isReaderInteractiveTarget(markedChild)).toBe(true);
        expect(isReaderInteractiveTarget(root)).toBe(false);
    });
});

describe('isReaderProgressionTarget', () => {
    it('recognizes marked progression controls and their descendants', () => {
        const button = document.createElement('button');
        button.dataset.readerProgression = '';
        const child = document.createElement('span');
        button.append(child);
        expect(isReaderProgressionTarget(button)).toBe(true);
        expect(isReaderProgressionTarget(child)).toBe(true);
    });

    it('returns false for non-progression interactive elements', () => {
        const button = document.createElement('button');
        const marked = document.createElement('div');
        marked.dataset.readerInteractive = '';
        expect(isReaderProgressionTarget(button)).toBe(false);
        expect(isReaderProgressionTarget(marked)).toBe(false);
    });
});

describe('isEndingPosition', () => {
    const flow: StoryFlowConfig = {
        start: 'act1',
        nodes: [
            { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
            { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
            {
                kind: 'scene',
                id: 'act3_missing_next',
                sceneId: 'act3_missing_next',
            },
        ],
    };

    it('returns true when at the last dialogue line of a terminal scene with next: null', () => {
        expect(isEndingPosition(flow, 'act2', 2, 3, false)).toBe(true);
    });

    it('returns true when next is omitted (undefined) on a terminal scene', () => {
        expect(isEndingPosition(flow, 'act3_missing_next', 0, 1, false)).toBe(
            true
        );
    });

    it('returns false when scene has next node', () => {
        expect(isEndingPosition(flow, 'act1', 0, 1, false)).toBe(false);
    });

    it('returns false when choice is present', () => {
        expect(isEndingPosition(flow, 'act2', 2, 3, true)).toBe(false);
    });

    it('returns false for empty (0-line) scene', () => {
        expect(isEndingPosition(flow, 'act2', 0, 0, false)).toBe(false);
    });

    it('returns false when not on the final dialogue line', () => {
        expect(isEndingPosition(flow, 'act2', 1, 3, false)).toBe(false);
    });
});

describe('isChoicePosition', () => {
    it('is true only at the last line of a nonempty choice scene', () => {
        expect(isChoicePosition(0, 1, true)).toBe(true);
        expect(isChoicePosition(2, 3, true)).toBe(true);
        expect(isChoicePosition(5, 3, true)).toBe(false);
        expect(isChoicePosition(0, 3, true)).toBe(false);
        expect(isChoicePosition(1, 3, true)).toBe(false);
        expect(isChoicePosition(2, 3, false)).toBe(false);
        expect(isChoicePosition(5, 3, false)).toBe(false);
        expect(isChoicePosition(0, 0, true)).toBe(false);
        expect(isChoicePosition(0, 0, false)).toBe(false);
    });
});

describe('advanceLabelKey', () => {
    it.each([
        ['advance-line', 'continue'],
        ['open-choice', 'choose'],
        ['advance-scene', 'nextScene'],
        ['complete', 'complete'],
    ] as const)('maps %s to the %s label', (decision, labelKey) => {
        expect(advanceLabelKey(decision)).toBe(labelKey);
    });

    it.each(['skip', 'none'] as const)('has no label for %s', decision => {
        expect(advanceLabelKey(decision)).toBeNull();
    });

    it('only yields keys that resolve to reader translations', () => {
        const decisions: ReaderAdvanceDecision[] = [
            'skip',
            'advance-line',
            'open-choice',
            'advance-scene',
            'complete',
            'none',
        ];
        const t = getTranslations('en');
        for (const decision of decisions) {
            const key = advanceLabelKey(decision);
            if (key !== null) {
                expect(typeof t.reader[key]).toBe('string');
            }
        }
    });
});
