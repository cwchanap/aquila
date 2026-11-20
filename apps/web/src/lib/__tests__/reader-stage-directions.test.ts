import { describe, expect, it } from 'vitest';
import { hideStageDirections } from '../reader-stage-directions';

describe('hideStageDirections', () => {
    it.each([
        ['(內心)又是一個喧鬧的夜晚', '又是一個喧鬧的夜晚'],
        ['（點頭）好。', '好。'],
        ['（心の声）……まだ生きてる。', '……まだ生きてる。'],
        ['(thinking) Another loud night...', 'Another loud night...'],
        ['  (低聲)  別出聲。', '別出聲。'],
        ['（低聲）（皺眉）別出聲。', '別出聲。'],
    ])('drops the leading direction of %s', (dialogue, expected) => {
        expect(hideStageDirections({ dialogue }).dialogue).toBe(expected);
    });

    it('returns the same entry when there is nothing to hide', () => {
        const entry = { dialogue: '好。' };
        expect(hideStageDirections(entry)).toBe(entry);
    });

    it('leaves brackets inside the line alone', () => {
        const entry = { dialogue: '那位先生（指著李杰）能過來嗎？' };
        expect(hideStageDirections(entry)).toBe(entry);
        expect(
            hideStageDirections({ dialogue: '(點頭)我確定。(轉頭)小心他。' })
                .dialogue
        ).toBe('我確定。(轉頭)小心他。');
    });

    it('keeps a line that is only a direction', () => {
        const entry = { dialogue: '（沉默）' };
        expect(hideStageDirections(entry)).toBe(entry);
    });

    it('moves furigana to the new start of the text', () => {
        const line = hideStageDirections({
            dialogue: '（心の声）今日は雨。',
            ruby: [
                { start: 1, end: 2, reading: 'こころ' },
                { start: 5, end: 7, reading: 'きょう' },
            ],
        });
        expect(line).toEqual({
            dialogue: '今日は雨。',
            ruby: [{ start: 0, end: 2, reading: 'きょう' }],
        });
    });

    it('does not add furigana to a line that had none', () => {
        expect(hideStageDirections({ dialogue: '（點頭）好。' })).toEqual({
            dialogue: '好。',
        });
    });
});
