import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    isLocale,
    localeLangTag,
    translations,
    type Locale,
} from '../translations';
import {
    REGISTERED_STORY_IDS,
    STORY_TEXT_LOCALES,
    hasStoryText,
    normalizeStoryLocale,
    resolveStoryTextLocale,
} from '../story-metadata';
import { getStoryContent } from '../stories';
import {
    loadStoryContent,
    resetStoryContentCacheForTests,
} from '../async/registry';

function keyPaths(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object') return [prefix];
    return Object.entries(value as Record<string, unknown>).flatMap(
        ([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key)
    );
}

function leafValues(value: unknown): unknown[] {
    if (!value || typeof value !== 'object') return [value];
    return Object.values(value as Record<string, unknown>).flatMap(leafValues);
}

describe('supported locales', () => {
    it('serves en, zh and ja with en as the default', () => {
        expect(SUPPORTED_LOCALES).toEqual(['en', 'zh', 'ja']);
        expect(DEFAULT_LOCALE).toBe('en');
        expect(Object.keys(translations).sort()).toEqual(
            [...SUPPORTED_LOCALES].sort()
        );
    });

    it('recognizes only supported locale codes', () => {
        expect(isLocale('ja')).toBe(true);
        expect(isLocale('zh')).toBe(true);
        expect(isLocale('fr')).toBe(false);
        expect(isLocale('ja-JP')).toBe(false);
        expect(isLocale(null)).toBe(false);
        expect(isLocale(undefined)).toBe(false);
    });

    it('tags Chinese text as Traditional for lang attributes', () => {
        expect(localeLangTag('zh')).toBe('zh-Hant');
        expect(localeLangTag('ja')).toBe('ja');
        expect(localeLangTag('en')).toBe('en');
    });

    it('normalizes regional Japanese tags to ja', () => {
        expect(normalizeStoryLocale('ja')).toBe('ja');
        expect(normalizeStoryLocale('ja-JP')).toBe('ja');
        expect(normalizeStoryLocale('JA')).toBe('ja');
        expect(normalizeStoryLocale('jav')).toBeNull();
    });
});

describe('ja UI strings', () => {
    it('has exactly the same keys as en and zh, in the same order', () => {
        const en = keyPaths(translations.en);
        expect(keyPaths(translations.zh)).toEqual(en);
        expect(keyPaths(translations.ja)).toEqual(en);
    });

    it('has no empty strings', () => {
        for (const locale of SUPPORTED_LOCALES) {
            for (const value of leafValues(translations[locale])) {
                expect(typeof value).toBe('string');
                expect((value as string).trim()).not.toBe('');
            }
        }
    });

    it('names every language in its own language', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(translations[locale].languages).toEqual({
                english: 'English',
                chinese: '中文',
                japanese: '日本語',
            });
        }
    });
});

describe('story text locales', () => {
    it('lists the zh source for every story', () => {
        for (const storyId of REGISTERED_STORY_IDS) {
            expect(STORY_TEXT_LOCALES[storyId]).toContain('zh');
        }
    });

    it('reads a language the story has, otherwise the zh source', () => {
        expect(resolveStoryTextLocale('elevator_game', 'ja')).toBe('ja');
        expect(resolveStoryTextLocale('elevator_game', 'ja-JP')).toBe('ja');
        expect(resolveStoryTextLocale('elevator_game', 'en')).toBe('en');
        expect(resolveStoryTextLocale('the_seventh_mirror', 'ja')).toBe('zh');
        expect(resolveStoryTextLocale('the_seventh_mirror', 'en')).toBe('zh');
        expect(resolveStoryTextLocale('elevator_game', 'fr')).toBe('zh');
    });

    it('reports which stories have text in a language', () => {
        expect(hasStoryText('day_4012', 'ja')).toBe(true);
        expect(hasStoryText('train_adventure', 'ja')).toBe(false);
        expect(hasStoryText('not_a_story', 'zh')).toBe(false);
    });

    describe.each(
        REGISTERED_STORY_IDS.flatMap(storyId =>
            SUPPORTED_LOCALES.filter(locale => locale !== 'zh').map(
                locale => [storyId, locale] as [string, Locale]
            )
        )
    )('%s in %s', (storyId, locale) => {
        const zh = getStoryContent(storyId, 'zh');
        const translated = getStoryContent(storyId, locale);
        const listed = hasStoryText(storyId, locale);

        if (!listed) {
            it('falls back to the zh source text', () => {
                expect(translated.dialogue).toBe(zh.dialogue);
            });
            return;
        }

        it('has its own text lined up entry for entry with zh', () => {
            expect(translated.dialogue).not.toBe(zh.dialogue);
            expect(Object.keys(translated.dialogue)).toEqual(
                Object.keys(zh.dialogue)
            );
            for (const [sceneId, entries] of Object.entries(zh.dialogue)) {
                const mirror = translated.dialogue[sceneId];
                expect(mirror.map(e => e.characterId)).toEqual(
                    entries.map(e => e.characterId)
                );
                expect(mirror.map(e => e.background)).toEqual(
                    entries.map(e => e.background)
                );
            }
        });

        it('has every choice prompt and label written', () => {
            expect(Object.keys(translated.choices)).toEqual(
                Object.keys(zh.choices)
            );
            for (const [choiceId, choice] of Object.entries(
                translated.choices
            )) {
                expect(choice.prompt.trim()).not.toBe('');
                expect(choice.prompt).not.toMatch(/TODO/);
                expect(choice.options.map(o => o.id)).toEqual(
                    zh.choices[choiceId].options.map(o => o.id)
                );
                for (const option of choice.options) {
                    expect(option.label.trim()).not.toBe('');
                    expect(option.label).not.toMatch(/TODO/);
                }
            }
        });
    });
});

describe('async story loader text locale', () => {
    it('reports the language the text is actually in', async () => {
        resetStoryContentCacheForTests();
        const short = await loadStoryContent('elevator_game', 'ja');
        expect(short.locale).toBe('ja');
        expect(short.textLocale).toBe('ja');

        const saga = await loadStoryContent('the_seventh_mirror', 'ja');
        expect(saga.locale).toBe('ja');
        expect(saga.textLocale).toBe('zh');
    });
});
