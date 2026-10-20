import { describe, expect, it } from 'vitest';
import { parseRuby } from '../ruby';
import { buildChoiceMap } from '../stories/choice-utils';
import type { FlowConfig } from '../flow-types';

describe('parseRuby', () => {
    it('splits furigana markup into plain text and reading spans', () => {
        expect(parseRuby('｜今日《きょう》は｜雨《あめ》だ。')).toEqual({
            text: '今日は雨だ。',
            ruby: [
                { start: 0, end: 2, reading: 'きょう' },
                { start: 3, end: 4, reading: 'あめ' },
            ],
        });
    });

    it('leaves text without markup alone', () => {
        expect(parseRuby('No furigana here.')).toEqual({
            text: 'No furigana here.',
            ruby: [],
        });
    });

    it('does not treat a Chinese book title in 《》 as a reading', () => {
        expect(parseRuby('他在讀《紅樓夢》。')).toEqual({
            text: '他在讀《紅樓夢》。',
            ruby: [],
        });
    });
});

describe('buildChoiceMap furigana', () => {
    const flow = {
        start: 'a',
        nodes: [
            {
                kind: 'choice',
                id: 'choice:c1',
                choiceId: 'c1',
                nextByOption: { left: 'b', right: 'c' },
            },
        ],
    } as unknown as FlowConfig;

    it('moves markup in prompts and labels into ruby fields', () => {
        const map = buildChoiceMap(flow, {
            c1: {
                prompt: '｜道《みち》を選ぶ',
                labels: { left: '｜左《ひだり》へ', right: 'まっすぐ' },
            },
        });
        expect(map.c1.prompt).toBe('道を選ぶ');
        expect(map.c1.promptRuby).toEqual([
            { start: 0, end: 1, reading: 'みち' },
        ]);
        expect(map.c1.options[0]).toMatchObject({
            label: '左へ',
            labelRuby: [{ start: 0, end: 1, reading: 'ひだり' }],
        });
        expect(map.c1.options[1]).not.toHaveProperty('labelRuby');
    });

    it('adds no ruby fields to text without markup', () => {
        const map = buildChoiceMap(flow, {
            c1: {
                prompt: 'Pick one',
                labels: { left: 'Left', right: 'Right' },
            },
        });
        expect(map.c1).not.toHaveProperty('promptRuby');
        expect(map.c1.options[0]).not.toHaveProperty('labelRuby');
    });
});
