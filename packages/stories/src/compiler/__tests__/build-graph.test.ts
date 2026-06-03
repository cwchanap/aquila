import { describe, it, expect } from 'vitest';
import { buildStoryGraph } from '../build-graph';
import type { DirNode } from '../scan-story';

// act1 -> act2 -> act3 -(choice)-> {b1a/act4 (terminal), b1b/act4 -> b1b/actFinal}
const tree: DirNode = {
    rel: '',
    acts: ['act1', 'act2', 'act3'],
    children: [
        { rel: 'branch_1a', acts: ['act4'], children: [], chapters: [] },
        {
            rel: 'branch_1b',
            acts: ['act4', 'actFinal'],
            children: [],
            chapters: [],
        },
    ],
    chapters: [],
};

describe('buildStoryGraph', () => {
    it('chains linear scenes and starts at the first root act', () => {
        const g = buildStoryGraph(tree);
        expect(g.start).toBe('act1');
        const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
        expect(byId.act1.next).toBe('act2');
        expect(byId.act2.next).toBe('act3');
    });

    it('makes the last act of a branching dir a choice node', () => {
        const g = buildStoryGraph(tree);
        const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
        expect(byId.act3.next).toBe('choice:choice_act3');
        expect(g.choices).toEqual([
            {
                choiceId: 'choice_act3',
                fromSceneId: 'act3',
                options: [
                    { optionId: 'b1a', nextScene: 'b1a_act4' },
                    { optionId: 'b1b', nextScene: 'b1b_act4' },
                ],
            },
        ]);
    });

    it('terminates leaves and orders actFinal last', () => {
        const g = buildStoryGraph(tree);
        const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
        expect(byId.b1a_act4.next).toBeNull();
        expect(byId.b1b_act4.next).toBe('b1b_actFinal');
        expect(byId.b1b_actFinal.next).toBeNull();
    });

    // act1 -(choice)-> branch_1b/act2 -(choice)-> branch_1b/branch_2c/act3 (terminal)
    it('encodes nested branches into multi-segment scene ids', () => {
        const nested: DirNode = {
            rel: '',
            acts: ['act1'],
            children: [
                {
                    rel: 'branch_1b',
                    acts: ['act2'],
                    children: [
                        {
                            rel: 'branch_1b/branch_2c',
                            acts: ['act3'],
                            children: [],
                            chapters: [],
                        },
                    ],
                    chapters: [],
                },
            ],
            chapters: [],
        };
        const g = buildStoryGraph(nested);
        const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
        expect(byId.act1.next).toBe('choice:choice_act1');
        expect(byId.b1b_act2.next).toBe('choice:choice_b1b_act2');
        expect(byId.b1b_b2c_act3.next).toBeNull();
        expect(g.choices).toEqual([
            {
                choiceId: 'choice_act1',
                fromSceneId: 'act1',
                options: [{ optionId: 'b1b', nextScene: 'b1b_act2' }],
            },
            {
                choiceId: 'choice_b1b_act2',
                fromSceneId: 'b1b_act2',
                options: [{ optionId: 'b2c', nextScene: 'b1b_b2c_act3' }],
            },
        ]);
    });

    describe('chapter support', () => {
        it('links chapters sequentially with ch-prefixed scene IDs', () => {
            const withChapters: DirNode = {
                rel: '',
                acts: [],
                children: [],
                chapters: [
                    {
                        rel: 'chapter_1',
                        acts: ['act1', 'act2', 'act3'],
                        children: [],
                        chapters: [],
                    },
                    {
                        rel: 'chapter_2',
                        acts: ['act1', 'act2'],
                        children: [],
                        chapters: [],
                    },
                ],
            };
            const g = buildStoryGraph(withChapters);
            expect(g.start).toBe('ch1_act1');
            const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
            expect(byId.ch1_act1.next).toBe('ch1_act2');
            expect(byId.ch1_act2.next).toBe('ch1_act3');
            expect(byId.ch1_act3.next).toBe('ch2_act1');
            expect(byId.ch2_act1.next).toBe('ch2_act2');
            expect(byId.ch2_act2.next).toBeNull();
            expect(g.choices).toEqual([]);
        });

        it('supports root acts followed by chapters', () => {
            const mixed: DirNode = {
                rel: '',
                acts: ['act1'],
                children: [],
                chapters: [
                    {
                        rel: 'chapter_1',
                        acts: ['act1', 'act2'],
                        children: [],
                        chapters: [],
                    },
                ],
            };
            const g = buildStoryGraph(mixed);
            expect(g.start).toBe('act1');
            const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
            expect(byId.act1.next).toBe('ch1_act1');
            expect(byId.ch1_act1.next).toBe('ch1_act2');
            expect(byId.ch1_act2.next).toBeNull();
        });

        it('supports chapters with branch directories', () => {
            const withBranches: DirNode = {
                rel: '',
                acts: [],
                children: [],
                chapters: [
                    {
                        rel: 'chapter_1',
                        acts: ['act1', 'act2'],
                        children: [
                            {
                                rel: 'chapter_1/branch_1a',
                                acts: ['act3'],
                                children: [],
                                chapters: [],
                            },
                            {
                                rel: 'chapter_1/branch_1b',
                                acts: ['act3'],
                                children: [],
                                chapters: [],
                            },
                        ],
                        chapters: [],
                    },
                    {
                        rel: 'chapter_2',
                        acts: ['act1'],
                        children: [],
                        chapters: [],
                    },
                ],
            };
            const g = buildStoryGraph(withBranches);
            expect(g.start).toBe('ch1_act1');
            const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
            expect(byId.ch1_act1.next).toBe('ch1_act2');
            expect(byId.ch1_act2.next).toBe('choice:choice_ch1_act2');
            expect(byId.ch1_b1a_act3.next).toBeNull();
            expect(byId.ch1_b1b_act3.next).toBeNull();
            expect(byId.ch2_act1.next).toBeNull();
        });

        it('sorts chapters by name', () => {
            const sorted: DirNode = {
                rel: '',
                acts: [],
                children: [],
                chapters: [
                    {
                        rel: 'chapter_2',
                        acts: ['act1'],
                        children: [],
                        chapters: [],
                    },
                    {
                        rel: 'chapter_1',
                        acts: ['act1'],
                        children: [],
                        chapters: [],
                    },
                ],
            };
            const g = buildStoryGraph(sorted);
            expect(g.start).toBe('ch1_act1');
            const byId = Object.fromEntries(g.scenes.map(s => [s.id, s]));
            expect(byId.ch1_act1.next).toBe('ch2_act1');
            expect(byId.ch2_act1.next).toBeNull();
        });
    });
});
