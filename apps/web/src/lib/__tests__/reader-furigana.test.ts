// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
    READER_FURIGANA_KEY,
    readFurigana,
    rubySegments,
    writeFurigana,
} from '../reader-furigana';

describe('furigana preference', () => {
    beforeEach(() => localStorage.clear());

    it('is on unless turned off', () => {
        expect(readFurigana()).toBe(true);
        expect(readFurigana(null)).toBe(true);
        const throwing = {
            getItem: () => {
                throw new Error('denied');
            },
        } as unknown as Storage;
        expect(readFurigana(throwing)).toBe(true);
    });

    it('saves off and clears the key when turned back on', () => {
        writeFurigana(false);
        expect(localStorage.getItem(READER_FURIGANA_KEY)).toBe('off');
        expect(readFurigana()).toBe(false);

        writeFurigana(true);
        expect(localStorage.getItem(READER_FURIGANA_KEY)).toBeNull();
        expect(readFurigana()).toBe(true);
    });

    it('ignores storage that throws on write', () => {
        const throwing = {
            setItem: () => {
                throw new Error('full');
            },
        } as unknown as Storage;
        expect(() => writeFurigana(false, throwing)).not.toThrow();
    });
});

describe('rubySegments', () => {
    it('cuts a line into plain runs and runs with readings', () => {
        expect(
            rubySegments('今日は雨だ。', [
                { start: 0, end: 2, reading: 'きょう' },
                { start: 3, end: 4, reading: 'あめ' },
            ])
        ).toEqual([
            { text: '今日', reading: 'きょう' },
            { text: 'は' },
            { text: '雨', reading: 'あめ' },
            { text: 'だ。' },
        ]);
    });

    it('drops spans that overlap or fall outside the text, keeping all text', () => {
        const segments = rubySegments('今日は', [
            { start: 0, end: 2, reading: 'きょう' },
            { start: 1, end: 2, reading: 'ひ' },
            { start: 2, end: 9, reading: 'は' },
        ]);
        expect(segments).toEqual([
            { text: '今日', reading: 'きょう' },
            { text: 'は' },
        ]);
        expect(segments.map(s => s.text).join('')).toBe('今日は');
    });
});
