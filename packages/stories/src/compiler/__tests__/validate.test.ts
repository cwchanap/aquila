import { describe, it, expect } from 'vitest';
import { validateStory } from '../validate';
import { CharacterId } from '../../characters';
import type { StoryIR } from '../ir';

function baseStory(): StoryIR {
    return {
        storyId: 'x',
        name: 'x',
        start: 'act1',
        scenes: [
            {
                id: 'act1',
                entries: [
                    {
                        characterId: CharacterId.Narrator,
                        displayName: '旁白',
                        dialogue: 'hi',
                    },
                ],
                next: 'act2',
                sourcePath: 'act1.md',
            },
            {
                id: 'act2',
                entries: [
                    {
                        characterId: CharacterId.Narrator,
                        displayName: '旁白',
                        dialogue: 'bye',
                    },
                ],
                next: null,
                sourcePath: 'act2.md',
            },
        ],
        choices: [],
    };
}

describe('validateStory', () => {
    it('passes a well-formed story', () => {
        expect(() => validateStory(baseStory())).not.toThrow();
    });

    it('rejects a dangling next', () => {
        const s = baseStory();
        s.scenes[0].next = 'nope';
        expect(() => validateStory(s)).toThrow(/dangling next/);
    });

    it('rejects an unreachable scene', () => {
        const s = baseStory();
        s.scenes[0].next = null; // act2 now orphaned
        expect(() => validateStory(s)).toThrow(/unreachable/);
    });

    it('rejects a choice option pointing at a missing scene', () => {
        const s = baseStory();
        s.scenes[0].next = 'choice:c1';
        s.choices.push({
            choiceId: 'c1',
            fromSceneId: 'act1',
            options: [{ optionId: 'a', nextScene: 'ghost' }],
        });
        expect(() => validateStory(s)).toThrow(/missing scene/);
    });
});
