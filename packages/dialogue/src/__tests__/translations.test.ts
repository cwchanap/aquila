import { describe, it, expect } from 'vitest';
import { getTranslations, translations } from '../translations';

describe('translations', () => {
    describe('translations object', () => {
        it('has en and zh locales', () => {
            expect(translations.en).toBeDefined();
            expect(translations.zh).toBeDefined();
        });
    });

    describe('getTranslations', () => {
        it('returns English translations for en locale', () => {
            const t = getTranslations('en');
            expect(t.locale).toBe('en');
            expect(typeof t.menu).toBe('object');
        });

        it('returns Chinese translations for zh locale', () => {
            const t = getTranslations('zh');
            expect(t.locale).toBe('zh');
            expect(typeof t.menu).toBe('object');
        });

        it('includes locale in returned object', () => {
            const en = getTranslations('en');
            const zh = getTranslations('zh');

            expect(en.locale).toBe('en');
            expect(zh.locale).toBe('zh');
        });

        it('has consistent keys between locales', () => {
            const en = getTranslations('en');
            const zh = getTranslations('zh');

            // Check top-level keys match (excluding locale which is added)
            const enKeys = Object.keys(en)
                .filter(k => k !== 'locale')
                .sort();
            const zhKeys = Object.keys(zh)
                .filter(k => k !== 'locale')
                .sort();

            expect(enKeys).toEqual(zhKeys);
        });

        it('has menu translations', () => {
            const en = getTranslations('en');
            expect(en.menu).toBeDefined();
            expect(typeof en.menu.heading).toBe('string');
        });

        it('has character-related translations', () => {
            const en = getTranslations('en');
            expect(en.characters).toBeDefined();
        });

        it('has validation translations', () => {
            const en = getTranslations('en');
            expect(en.email).toBeDefined();
            expect(en.username).toBeDefined();
            expect(en.characterName).toBeDefined();
        });
    });
});
