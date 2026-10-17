import { describe, expect, it } from 'vitest';
import {
    STORY_CATALOG,
    ZH_CHARS_PER_MINUTE,
    getCatalogEntry,
} from '../catalog';
import { REGISTERED_STORY_IDS } from '../story-metadata';
import { translations } from '../translations';
import { getStoryContent, getStoryFlow } from '../stories';

const shorts = STORY_CATALOG.filter(entry => entry.format === 'short');

describe('story catalog', () => {
    it('lists every registered story exactly once', () => {
        expect(STORY_CATALOG.map(e => e.id).sort()).toEqual(
            [...REGISTERED_STORY_IDS].sort()
        );
        expect(getCatalogEntry('nope')).toBeUndefined();
    });

    it('has a title, teaser and genre label in both languages', () => {
        for (const locale of ['en', 'zh'] as const) {
            const stories = translations[locale].stories as unknown as Record<
                string,
                unknown
            >;
            const genres = translations[locale].stories.genres as Record<
                string,
                string
            >;
            for (const entry of STORY_CATALOG) {
                expect(stories[entry.translationKey], entry.id).toBeTruthy();
                expect(
                    stories[`${entry.translationKey}Desc`],
                    entry.id
                ).toBeTruthy();
                expect(genres[entry.genre], entry.genre).toBeTruthy();
            }
        }
    });

    it('keeps every short story under ten minutes on its longest path', () => {
        expect(shorts).toHaveLength(5);
        for (const entry of shorts) {
            expect(
                entry.stats.maxPathChars / ZH_CHARS_PER_MINUTE,
                entry.id
            ).toBeLessThan(10);
            expect(entry.stats.endings, entry.id).toBeGreaterThanOrEqual(2);
        }
    });

    it('ships short stories with real English text and choices', () => {
        for (const entry of shorts) {
            const zh = getStoryContent(entry.id, 'zh');
            const en = getStoryContent(entry.id, 'en');
            const flow = getStoryFlow(entry.id)!;
            const start = flow.start!;
            expect(en.dialogue[start]).toHaveLength(zh.dialogue[start].length);
            expect(en.dialogue[start][0].dialogue).not.toBe(
                zh.dialogue[start][0].dialogue
            );
            for (const locale of [en, zh]) {
                for (const choice of Object.values(locale.choices)) {
                    expect(choice.prompt).not.toMatch(/^TODO/);
                    for (const option of choice.options) {
                        expect(option.label).not.toMatch(/^TODO/);
                    }
                }
            }
        }
    });
});
