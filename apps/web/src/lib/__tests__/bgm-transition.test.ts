import { describe, expect, it } from 'vitest';
import type { DialogueEntry, StoryFlowConfig } from '@aquila/stories';
import { activeBgmAt, nextBgmSelection } from '@/lib/audio/bgm-transition';
import type { LinePosition } from '@/lib/audio/sfx-transition';

const entries: DialogueEntry[] = [
    { dialogue: 'a', bgm: 'dawn-apartment' },
    { dialogue: 'b' },
    { dialogue: 'c', bgm: 'tension-pulse' },
    { dialogue: 'd' },
    { dialogue: 'e', bgm: null },
    { dialogue: 'f' },
];

const linearFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
    ],
} as unknown as StoryFlowConfig;

const jumpFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: 'act3' },
        { kind: 'scene', id: 'act3', sceneId: 'act3', next: null },
    ],
} as unknown as StoryFlowConfig;

const choiceFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'choice:fork' },
        {
            kind: 'choice',
            id: 'choice:fork',
            choiceId: 'fork',
            nextByOption: { left: 'act2', right: 'act3' },
        },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
        { kind: 'scene', id: 'act3', sceneId: 'act3', next: null },
    ],
} as unknown as StoryFlowConfig;

const p = (sceneId: string, index: number): LinePosition => ({
    storyId: 'story',
    sceneId,
    index,
});

describe('activeBgmAt', () => {
    it('resolves the current scene command by scanning backward', () => {
        expect(activeBgmAt(entries, 0)).toBe('dawn-apartment');
        expect(activeBgmAt(entries, 1)).toBe('dawn-apartment');
        expect(activeBgmAt(entries, 3)).toBe('tension-pulse');
        expect(activeBgmAt(entries, 5)).toBeNull();
    });

    it('returns undefined when the current scene has no answer', () => {
        expect(activeBgmAt([{ dialogue: 'x' }], 0)).toBeUndefined();
        expect(activeBgmAt([], 0)).toBeUndefined();
    });
});

describe('nextBgmSelection', () => {
    it('uses a local command on initial restore', () => {
        expect(
            nextBgmSelection(
                null,
                p('act1', 3),
                [
                    { dialogue: 'line 0', bgm: 'dawn-apartment' },
                    { dialogue: 'line 1' },
                    { dialogue: 'line 2' },
                    { dialogue: 'line 3' },
                ],
                null,
                linearFlow
            )
        ).toBe('dawn-apartment');
    });

    it('retains selection over a cue-less forward line', () => {
        expect(
            nextBgmSelection(
                p('act1', 0),
                p('act1', 1),
                [{ dialogue: 'line' }],
                'dawn-apartment',
                linearFlow
            )
        ).toBe('dawn-apartment');
    });

    it('retains selection across direct linear and choice edges', () => {
        const cueLess = [{ dialogue: 'line' }];
        expect(
            nextBgmSelection(
                p('act1', 2),
                p('act2', 0),
                cueLess,
                'dawn-apartment',
                linearFlow
            )
        ).toBe('dawn-apartment');
        expect(
            nextBgmSelection(
                p('act1', 2),
                p('act2', 0),
                cueLess,
                'dawn-apartment',
                choiceFlow
            )
        ).toBe('dawn-apartment');
    });

    it.each([
        ['backward line', p('act1', 2), p('act1', 1)],
        ['forward index jump', p('act1', 0), p('act1', 2)],
        ['non-forward scene jump', p('act1', 2), p('act3', 0)],
    ] as const)(
        '%s clears a cue-less destination',
        (_label, previous, next) => {
            expect(
                nextBgmSelection(
                    previous,
                    next,
                    [{ dialogue: 'line' }],
                    'dawn-apartment',
                    jumpFlow
                )
            ).toBeNull();
        }
    );

    it('uses a local command on a non-forward destination', () => {
        expect(
            nextBgmSelection(
                p('act1', 2),
                p('act3', 0),
                [{ dialogue: 'line', bgm: 'tension-pulse' }],
                'dawn-apartment',
                jumpFlow
            )
        ).toBe('tension-pulse');
    });

    it('clears a local null command on a non-forward destination', () => {
        expect(
            nextBgmSelection(
                p('act1', 2),
                p('act3', 0),
                [{ dialogue: 'line', bgm: null }],
                'dawn-apartment',
                jumpFlow
            )
        ).toBeNull();
    });

    it('clears a cue-less fresh or replacement scene', () => {
        expect(
            nextBgmSelection(
                null,
                p('act1', 0),
                [{ dialogue: 'line' }],
                null,
                null
            )
        ).toBeNull();
        expect(
            nextBgmSelection(
                p('act1', 2),
                { storyId: 'replacement', sceneId: 'act1', index: 0 },
                [{ dialogue: 'line' }],
                'dawn-apartment',
                linearFlow
            )
        ).toBeNull();
    });

    it('uses a local command on a replacement scene', () => {
        expect(
            nextBgmSelection(
                p('act1', 2),
                { storyId: 'replacement', sceneId: 'act1', index: 0 },
                [{ dialogue: 'line', bgm: 'tension-pulse' }],
                'dawn-apartment',
                linearFlow
            )
        ).toBe('tension-pulse');
    });
});
