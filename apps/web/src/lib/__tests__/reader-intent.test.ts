import { describe, expect, it } from 'vitest';
import type { StoryPayload } from '@aquila/stories/async';
import {
    selectReaderIntent,
    validateLoadedIntent,
    type ReaderIntent,
} from '../reader-intent';

const flow: StoryPayload['flow'] = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
    ],
};

const payload: StoryPayload = {
    flow,
    dialogue: {
        act1: [{ dialogue: 'a' }, { dialogue: 'b' }],
        act2: [{ dialogue: 'c' }],
    },
    choices: {},
};

const deps = { defaultStoryId: 'train_adventure' };

function intent(overrides: Partial<ReaderIntent> = {}): ReaderIntent {
    return {
        source: 'url',
        storyId: 'train_adventure',
        requestedSceneId: 'act1',
        requestedDialogueIndex: null,
        malformedDialogue: false,
        locale: 'en',
        ...overrides,
    };
}

describe('selectReaderIntent', () => {
    it('returns unknown-story for an explicit unknown URL story', () => {
        expect(
            selectReaderIntent(
                new URLSearchParams('story=missing'),
                null,
                'en',
                deps
            )
        ).toEqual({ kind: 'unknown-story', storyId: 'missing', locale: 'en' });
    });

    it('uses the valid explicit URL without inspecting loaded content', () => {
        expect(
            selectReaderIntent(
                new URLSearchParams(
                    'story=train_adventure&scene=act2&dialogue=2'
                ),
                null,
                'en',
                deps
            )
        ).toEqual({
            kind: 'load',
            intent: {
                source: 'url',
                storyId: 'train_adventure',
                requestedSceneId: 'act2',
                requestedDialogueIndex: 1,
                malformedDialogue: false,
                locale: 'en',
            },
        });
    });

    it('ignores a stale persisted unknown story and selects the default', () => {
        expect(
            selectReaderIntent(
                new URLSearchParams(),
                {
                    storyId: 'missing',
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    locale: 'en',
                    version: 2,
                },
                'en',
                deps
            )
        ).toMatchObject({
            kind: 'load',
            intent: { source: 'default', storyId: 'train_adventure' },
        });
    });

    it.each(['0', '00', ''])(
        'keeps dialogue=%s as a valid zero-equivalent popstate request',
        rawDialogue => {
            const selection = selectReaderIntent(
                new URLSearchParams(
                    `story=train_adventure&scene=act1&dialogue=${rawDialogue}`
                ),
                null,
                'en',
                deps
            );

            expect(selection).toMatchObject({
                kind: 'load',
                intent: {
                    requestedDialogueIndex: null,
                    malformedDialogue: false,
                },
            });
            if (selection.kind !== 'load') throw new Error('expected load');
            expect(
                validateLoadedIntent(selection.intent, payload, 'popstate')
            ).toMatchObject({
                kind: 'apply',
                state: { dialogueIndex: 0 },
            });
        }
    );
});

describe('validateLoadedIntent', () => {
    it('canonicalizes an initial URL intent with a missing scene to the flow start', () => {
        expect(
            validateLoadedIntent(
                intent({ requestedSceneId: 'missing' }),
                payload,
                'initial'
            )
        ).toMatchObject({
            kind: 'apply',
            state: { sceneId: 'act1', dialogueIndex: 0 },
        });
    });

    it('soft-rejects a popstate URL intent with a missing scene', () => {
        expect(
            validateLoadedIntent(
                intent({ requestedSceneId: 'missing' }),
                payload,
                'popstate'
            )
        ).toEqual({ kind: 'soft-reject' });
    });

    it('falls back to the default load for an invalid persisted intent', () => {
        expect(
            validateLoadedIntent(
                intent({ source: 'persisted', requestedSceneId: 'missing' }),
                payload,
                'initial'
            )
        ).toEqual({ kind: 'fallback-default' });
    });

    it('applies malformed dialogue as index zero on initial load', () => {
        expect(
            validateLoadedIntent(
                intent({ malformedDialogue: true }),
                payload,
                'initial'
            )
        ).toMatchObject({
            kind: 'apply',
            state: { dialogueIndex: 0 },
        });
    });

    it('soft-rejects malformed dialogue on popstate', () => {
        expect(
            validateLoadedIntent(
                intent({ malformedDialogue: true }),
                payload,
                'popstate'
            )
        ).toEqual({ kind: 'soft-reject' });
    });

    it('clamps a loaded dialogue index after choosing the scene', () => {
        expect(
            validateLoadedIntent(
                intent({ requestedDialogueIndex: 99 }),
                payload,
                'initial'
            )
        ).toMatchObject({
            kind: 'apply',
            state: { dialogueIndex: 1 },
        });
    });
});
