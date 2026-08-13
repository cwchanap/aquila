import { describe, expect, it } from 'vitest';
import type { StoryFlowConfig } from '@aquila/stories';
import { nextSfxCommand, type LinePosition } from '@/lib/audio/sfx-transition';

const flow = {
    start: 'a',
    nodes: [
        { kind: 'scene', id: 'a', sceneId: 'a', next: 'b' },
        { kind: 'scene', id: 'b', sceneId: 'b', next: 'choice:fork' },
        {
            kind: 'choice',
            id: 'choice:fork',
            choiceId: 'fork',
            nextByOption: { left: 'c', right: 'd' },
        },
        { kind: 'scene', id: 'c', sceneId: 'c', next: null },
        { kind: 'scene', id: 'd', sceneId: 'd', next: null },
        { kind: 'scene', id: 'old', sceneId: 'old', next: null },
    ],
} as unknown as StoryFlowConfig;

const p = (sceneId: string, index: number): LinePosition => ({
    storyId: 'story',
    sceneId,
    index,
});

const visual = { mode: 'visual' as const, enabled: true, flow };

describe('nextSfxCommand', () => {
    it.each([
        ['initial', null, p('a', 0), 'door-open', 'noop'],
        ['same position', p('a', 0), p('a', 0), 'door-open', 'noop'],
        ['forward line', p('a', 0), p('a', 1), 'door-open', 'play'],
        ['backward line', p('a', 2), p('a', 1), 'door-open', 'noop'],
        ['forward index jump', p('a', 0), p('a', 2), 'door-open', 'noop'],
        ['linear scene edge', p('a', 3), p('b', 0), 'door-open', 'play'],
        ['choice scene edge', p('b', 3), p('c', 0), 'door-open', 'play'],
        ['non-adjacent scene jump', p('c', 1), p('a', 0), 'door-open', 'noop'],
        ['reverse scene edge', p('b', 0), p('a', 0), 'door-open', 'noop'],
    ] as const)('%s', (_label, previous, next, cueKey, expected) => {
        expect(nextSfxCommand(previous, next, cueKey, visual).type).toBe(
            expected
        );
    });

    it('stops on story replacement', () => {
        expect(
            nextSfxCommand(
                p('a', 1),
                { storyId: 'replacement', sceneId: 'start', index: 0 },
                'door-open',
                visual
            )
        ).toEqual({ type: 'stop' });
    });

    it.each([
        [{ mode: 'text' as const, enabled: true, flow }, 'text'],
        [{ mode: 'visual' as const, enabled: false, flow }, 'disabled'],
    ])('does not play while %s', (options, label) => {
        expect(label).toMatch(/^(text|disabled)$/);
        expect(
            nextSfxCommand(p('a', 0), p('a', 1), 'door-open', options)
        ).toEqual({
            type: 'noop',
        });
    });

    it('does not play an uncued forward transition', () => {
        expect(nextSfxCommand(p('a', 0), p('a', 1), undefined, visual)).toEqual(
            {
                type: 'noop',
            }
        );
    });
});
