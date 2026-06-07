import { describe, it, expect } from 'vitest';
import { validateStory } from '../validate';
import { CharacterId } from '../../characters';
import type { StoryIR } from '../ir';
import type { PortraitPromptMap } from '../parse-portraits';

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

    it('warns about missing portrait prompts for characters in the story', () => {
        const story: StoryIR = {
            storyId: 'demo',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.Narrator,
                            displayName: '旁白',
                            dialogue: 'a',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        const warnings = validateStory(story, {});
        expect(warnings.join('\n')).toContain('no portrait prompts');
    });

    it('warns about unresolved expression keys', () => {
        const story: StoryIR = {
            storyId: 'demo',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.LiJie,
                            displayName: '李杰',
                            dialogue: 'a',
                            expressionKey: 'nonexistent',
                            portrait: '李杰/nonexistent',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        const portraitMap: PortraitPromptMap = {
            [CharacterId.LiJie]: { base: 'prompt' },
        };
        const warnings = validateStory(story, portraitMap);
        expect(warnings.join('\n')).toContain('unknown expression');
    });

    it('warns when a character with portrait prompts lacks a base expression', () => {
        const story: StoryIR = {
            storyId: 'demo',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.LiJie,
                            displayName: '李杰',
                            dialogue: 'a',
                            expressionKey: 'happy',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        const portraitMap: PortraitPromptMap = {
            [CharacterId.LiJie]: { happy: 'smiling' } as Record<string, string>,
        };
        const warnings = validateStory(story, portraitMap);
        expect(warnings.join('\n')).toContain(
            'missing required "base" expression'
        );
    });
});
