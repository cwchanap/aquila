import enTranslations from './en.json';
import zhTranslations from './zh.json';

export const translations = {
    en: enTranslations,
    zh: zhTranslations,
} as const;

export type Locale = keyof typeof translations;

type EnTranslations = (typeof translations)['en'];

/**
 * Typed translations object with `characterNames` widened to
 * `Record<string, string>` so that dynamic characterId lookups
 * work without casts in consumer code.
 */
export type Translations = Omit<EnTranslations, 'characterNames'> & {
    characterNames: Record<string, string>;
} & { locale: Locale };

export function getTranslations(locale: Locale): Translations {
    return {
        ...(translations[locale] || translations.en),
        locale,
    } as Translations;
}
