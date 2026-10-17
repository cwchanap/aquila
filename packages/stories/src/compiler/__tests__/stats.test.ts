import { describe, expect, it } from 'vitest';
import { computeStoryStats } from '../stats';
import type { SceneIR, StoryIR } from '../ir';
import { estimateReadingMinutes } from '../../story-stats';

function scene(id: string, text: string, next: string | null): SceneIR {
    return {
        id,
        next,
        sourcePath: `${id}.md`,
        entries: [
            { characterId: 'narrator', displayName: '旁白', dialogue: text },
        ],
    };
}

function story(scenes: SceneIR[], choices: StoryIR['choices'] = []): StoryIR {
    return { storyId: 's', name: 's', start: scenes[0].id, scenes, choices };
}

describe('computeStoryStats', () => {
    it('measures a linear story', () => {
        const s = story([
            scene('act1', '一二三', 'act2'),
            scene('act2', '四 五', null),
        ]);
        expect(computeStoryStats(s, 0)).toEqual({
            scenes: 2,
            chapters: 0,
            endings: 1,
            minPathChars: 5,
            maxPathChars: 5,
        });
    });

    it('takes the shortest and longest branch through a choice', () => {
        const s = story(
            [
                scene('act1', '一二', 'choice:choice_act1'),
                scene('b1a_act2', '三', null),
                scene('b1b_act2', '三四五六', null),
            ],
            [
                {
                    choiceId: 'choice_act1',
                    fromSceneId: 'act1',
                    options: [
                        { optionId: 'b1a', nextScene: 'b1a_act2' },
                        { optionId: 'b1b', nextScene: 'b1b_act2' },
                    ],
                },
            ]
        );
        const stats = computeStoryStats(s, 2);
        expect(stats.endings).toBe(2);
        expect(stats.chapters).toBe(2);
        expect(stats.minPathChars).toBe(3);
        expect(stats.maxPathChars).toBe(6);
    });

    it('rejects a cyclic scene graph', () => {
        const s = story([
            scene('act1', '一', 'act2'),
            scene('act2', '二', 'act1'),
        ]);
        expect(() => computeStoryStats(s, 0)).toThrow(/cycle/);
    });
});

describe('estimateReadingMinutes', () => {
    it('rounds to whole minutes and never returns 0', () => {
        expect(estimateReadingMinutes(3200)).toBe(8);
        expect(estimateReadingMinutes(10)).toBe(1);
    });
});
