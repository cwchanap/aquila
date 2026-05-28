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
});
