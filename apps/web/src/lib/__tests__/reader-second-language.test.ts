// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { DialogueEntry } from '@aquila/stories';
import {
    READER_SECOND_LANGUAGE_KEY,
    alignSecondDialogue,
    readSecondLanguage,
    secondChoiceLabels,
    secondLanguageOptions,
    writeSecondLanguage,
} from '../reader-second-language';

const line = (dialogue: string): DialogueEntry => ({
    characterId: 'narrator',
    dialogue,
});

describe('second language preference', () => {
    beforeEach(() => localStorage.clear());

    it('defaults to off for a missing, unknown or unreadable value', () => {
        expect(readSecondLanguage()).toBe('off');
        localStorage.setItem(READER_SECOND_LANGUAGE_KEY, 'fr');
        expect(readSecondLanguage()).toBe('off');
        expect(readSecondLanguage(null)).toBe('off');
        const throwing = {
            getItem: () => {
                throw new Error('denied');
            },
        } as unknown as Storage;
        expect(readSecondLanguage(throwing)).toBe('off');
    });

    it('saves a language and clears the key when turned off', () => {
        writeSecondLanguage('ja');
        expect(localStorage.getItem(READER_SECOND_LANGUAGE_KEY)).toBe('ja');
        expect(readSecondLanguage()).toBe('ja');

        writeSecondLanguage('off');
        expect(localStorage.getItem(READER_SECOND_LANGUAGE_KEY)).toBeNull();
    });

    it('swallows storage write errors', () => {
        const throwing = {
            setItem: () => {
                throw new Error('quota');
            },
            removeItem: () => {
                throw new Error('quota');
            },
        } as unknown as Storage;
        expect(() => writeSecondLanguage('zh', throwing)).not.toThrow();
        expect(() => writeSecondLanguage('off', throwing)).not.toThrow();
    });
});

describe('second language options', () => {
    it('offers every language except the one being read', () => {
        expect(secondLanguageOptions('ja')).toEqual(['en', 'zh']);
        expect(secondLanguageOptions('zh')).toEqual(['en', 'ja']);
        expect(secondLanguageOptions('en')).toEqual(['zh', 'ja']);
    });
});

describe('alignSecondDialogue', () => {
    it('pairs lines when both scenes have the same length', () => {
        const main = [line('One.'), line('Two.')];
        const second = [line('一。'), line('二。')];
        expect(alignSecondDialogue(main, second)).toEqual(second);
    });

    it('returns null for a missing or mismatched scene', () => {
        const main = [line('One.'), line('Two.')];
        expect(alignSecondDialogue(main, undefined)).toBeNull();
        expect(alignSecondDialogue(main, [line('一。')])).toBeNull();
    });
});

describe('secondChoiceLabels', () => {
    const choice = {
        prompt: 'What now?',
        options: [
            { id: 'a', nextScene: 's1', label: 'Go' },
            { id: 'b', nextScene: 's2', label: 'Stay' },
        ],
    };

    it('keys the second-language labels by option id', () => {
        expect(
            secondChoiceLabels(choice, {
                prompt: 'どうする？',
                options: [
                    { id: 'b', nextScene: 's2', label: '残る' },
                    { id: 'a', nextScene: 's1', label: '行く' },
                ],
            })
        ).toEqual({ prompt: 'どうする？', labels: { a: '行く', b: '残る' } });
    });

    it('returns null without both choices', () => {
        expect(secondChoiceLabels(null, choice)).toBeNull();
        expect(secondChoiceLabels(choice, undefined)).toBeNull();
    });
});
