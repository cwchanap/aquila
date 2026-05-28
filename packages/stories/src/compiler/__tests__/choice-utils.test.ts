import { describe, it, expect } from 'vitest';
import { buildChoiceMap } from '../../stories/choice-utils';
import type { FlowConfig } from '../../flow-types';

const flow: FlowConfig = {
    start: 'act1',
    nodes: [
        {
            kind: 'scene',
            id: 'act1',
            sceneId: 'act1',
            next: 'choice:choice_act1',
        },
        {
            kind: 'choice',
            id: 'choice:choice_act1',
            choiceId: 'choice_act1',
            nextByOption: { b1a: 'b1a_act2', b1b: 'b1b_act2' },
        },
        { kind: 'scene', id: 'b1a_act2', sceneId: 'b1a_act2', next: null },
        { kind: 'scene', id: 'b1b_act2', sceneId: 'b1b_act2', next: null },
    ],
};

describe('buildChoiceMap', () => {
    it('merges flow transitions with provided text', () => {
        const map = buildChoiceMap(flow, {
            choice_act1: {
                prompt: 'Pick a path',
                labels: { b1a: 'Left', b1b: 'Right' },
            },
        });
        expect(map.choice_act1.prompt).toBe('Pick a path');
        expect(map.choice_act1.options).toEqual([
            { id: 'b1a', label: 'Left', nextScene: 'b1a_act2' },
            { id: 'b1b', label: 'Right', nextScene: 'b1b_act2' },
        ]);
    });

    it('falls back to TODO markers when text is missing', () => {
        const map = buildChoiceMap(flow, {});
        expect(map.choice_act1.prompt).toContain('TODO');
        expect(map.choice_act1.options[0].label).toContain('TODO');
        expect(map.choice_act1.options[0].nextScene).toBe('b1a_act2');
    });

    it('returns an empty map for a flow with no choice nodes', () => {
        const linearFlow: FlowConfig = {
            start: 'act1',
            nodes: [{ kind: 'scene', id: 'act1', sceneId: 'act1', next: null }],
        };
        expect(buildChoiceMap(linearFlow, {})).toEqual({});
    });
});
