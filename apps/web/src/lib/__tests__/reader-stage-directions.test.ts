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

    it.each([
        '（訊息）好！媽在家等你！',
        '（精靈語）我們需要食物和水。',
        '（隔著門，精靈語）我們需要食物和水。',
        '（用日語，有些不好意思）你好。',
        '（中文和日文）飛往東京成田機場的JL886次航班現在開始登機。',
        '（用標準中文）你好。',
        '（日本語で）こんにちは。',
        '（メッセージ）今夜は遅くなる。',
        '(Elvish) We need food and water.',
    ])('keeps the message or language label of %s', dialogue => {
        const entry = { dialogue };
        expect(hideStageDirections(entry)).toBe(entry);
    });

    it('hides a direction next to a label and keeps the label', () => {
        expect(
            hideStageDirections({ dialogue: '（點頭）（精靈語）好。' }).dialogue
        ).toBe('（精靈語）好。');
        expect(
            hideStageDirections({ dialogue: '（精靈語）（點頭）好。' }).dialogue
        ).toBe('（精靈語）好。');
    });

    it('does not mistake whispering or a phone gesture for a label', () => {
        for (const dialogue of [
            '（喃喃自語）好。',
            '（低語）好。',
            '（接起電話）喂？',
            '（看著訊息，眼眶濕潤）好。',
            '（深吸一口氣，語氣堅定）好。',
        ]) {
            expect(hideStageDirections({ dialogue }).dialogue).toBe(
                dialogue.replace(/^（[^）]*）/, '')
            );
        }
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

    it('moves furigana past a label that stays', () => {
        expect(
            hideStageDirections({
                dialogue: '（うなずき）（エルフ語）今日は雨。',
                ruby: [
                    { start: 1, end: 5, reading: 'うなず' },
                    { start: 12, end: 14, reading: 'きょう' },
                ],
            })
        ).toEqual({
            dialogue: '（エルフ語）今日は雨。',
            ruby: [{ start: 6, end: 8, reading: 'きょう' }],
        });
    });

    it('does not add furigana to a line that had none', () => {
        expect(hideStageDirections({ dialogue: '（點頭）好。' })).toEqual({
            dialogue: '好。',
        });
    });
});
