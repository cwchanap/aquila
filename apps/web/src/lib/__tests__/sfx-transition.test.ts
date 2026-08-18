import { describe, expect, it } from 'vitest';
import type { StoryFlowConfig } from '@aquila/stories';
import {
    nextSfxCommand,
    pendingSfxAfterTransition,
    sameLinePosition,
    sfxCommandOnInitialRelease,
    type LinePosition,
} from '@/lib/audio/sfx-transition';

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

    it('does not play when the flow is null and the scene changes', () => {
        // Covers isDirectFlowEdge's `if (!flow) return false` branch —
        // a forward scene transition with no flow graph cannot be verified
        // as adjacent, so the command is noop.
        expect(
            nextSfxCommand(p('a', 2), p('b', 0), 'door-open', {
                mode: 'visual',
                enabled: true,
                flow: null,
            })
        ).toEqual({ type: 'noop' });
    });

    it('does not play for a forward jump to a non-adjacent scene via a linear edge', () => {
        // Scene 'a' has next='b'. Jumping from 'a' to 'c' is forward but not
        // a direct edge — covers isDirectFlowEdge's
        // `if (!scene.next.startsWith('choice:')) return false` branch where
        // scene.next is a plain scene id that does not match the target.
        expect(
            nextSfxCommand(p('a', 2), p('c', 0), 'door-open', visual)
        ).toEqual({ type: 'noop' });
    });
});

describe('initial-load SFX timing', () => {
    it('retains only an eligible play command while first load is pending', () => {
        const position = { storyId: 's', sceneId: 'a', index: 1 };
        expect(
            pendingSfxAfterTransition(
                { type: 'play', cueKey: 'door-open' },
                position,
                true
            )
        ).toEqual({ position, cueKey: 'door-open' });
        expect(
            pendingSfxAfterTransition({ type: 'noop' }, position, true)
        ).toBeNull();
    });

    it('plays a pending SFX only on the same eligible destination after load', () => {
        const position = { storyId: 's', sceneId: 'a', index: 1 };
        expect(
            sfxCommandOnInitialRelease(
                { position, cueKey: 'door-open' },
                position,
                { mode: 'visual', enabled: true, cueResolvable: true }
            )
        ).toEqual({ type: 'play', cueKey: 'door-open' });
    });

    it.each([
        ['different current line', { storyId: 's', sceneId: 'a', index: 2 }],
        ['Text mode', { storyId: 's', sceneId: 'a', index: 1 }],
    ] as const)('drops a pending SFX for %s', (_label, current) => {
        const position = { storyId: 's', sceneId: 'a', index: 1 };
        const mode = _label === 'Text mode' ? 'text' : 'visual';
        expect(
            sfxCommandOnInitialRelease(
                { position, cueKey: 'door-open' },
                current,
                { mode, enabled: true, cueResolvable: true }
            )
        ).toEqual({ type: 'noop' });
    });

    it.each([
        [
            'disabled SFX',
            { mode: 'visual' as const, enabled: false, cueResolvable: true },
        ],
        [
            'unresolved cue',
            { mode: 'visual' as const, enabled: true, cueResolvable: false },
        ],
    ] as const)('drops a pending SFX for %s', (_label, options) => {
        const position = { storyId: 's', sceneId: 'a', index: 1 };
        expect(
            sfxCommandOnInitialRelease(
                { position, cueKey: 'door-open' },
                position,
                options
            )
        ).toEqual({ type: 'noop' });
    });

    it('does not play when there is no pending SFX', () => {
        expect(
            sfxCommandOnInitialRelease(
                null,
                { storyId: 's', sceneId: 'a', index: 1 },
                { mode: 'visual', enabled: true, cueResolvable: true }
            )
        ).toEqual({ type: 'noop' });
    });
});

describe('sameLinePosition', () => {
    it('returns false when left is null', () => {
        expect(sameLinePosition(null, p('a', 0))).toBe(false);
    });

    it('returns true when storyId, sceneId, and index all match', () => {
        expect(sameLinePosition(p('a', 0), p('a', 0))).toBe(true);
    });

    it('returns false when the index differs', () => {
        expect(sameLinePosition(p('a', 0), p('a', 1))).toBe(false);
    });

    it('returns false when the sceneId differs', () => {
        expect(sameLinePosition(p('a', 0), p('b', 0))).toBe(false);
    });

    it('returns false when the storyId differs', () => {
        expect(
            sameLinePosition(
                { storyId: 'other', sceneId: 'a', index: 0 },
                p('a', 0)
            )
        ).toBe(false);
    });
});
