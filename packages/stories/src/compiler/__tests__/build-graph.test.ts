import { describe, it, expect } from 'vitest';
import { buildStoryGraph } from '../build-graph';
import type { DirNode } from '../scan-story';

// act1 -> act2 -> act3 -(choice)-> {b1a/act4 (terminal), b1b/act4 -> b1b/actFinal}
const tree: DirNode = {
    rel: '',
    acts: ['act1', 'act2', 'act3'],
    children: [
        { rel: 'branch_1a', acts: ['act4'], children: [] },
        { rel: 'branch_1b', acts: ['act4', 'actFinal'], children: [] },
    ],
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
                        },
                    ],
                },
            ],
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
});
