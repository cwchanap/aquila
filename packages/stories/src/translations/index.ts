import enTranslations from './en.json';
import zhTranslations from './zh.json';
import jaTranslations from './ja.json';

export const translations = {
    en: enTranslations,
    zh: zhTranslations,
    ja: jaTranslations,
} as const;

export type Locale = keyof typeof translations;

/** Every locale the site is served in, default first. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh', 'ja'];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
    return (
        typeof value === 'string' &&
        (SUPPORTED_LOCALES as readonly string[]).includes(value)
    );
}

/** BCP 47 tag for `lang` attributes. Story text is Traditional Chinese, and
 *  the script subtag keeps browsers from drawing shared Han characters in
 *  their Japanese (or Simplified) forms when both languages are on screen. */
export function localeLangTag(locale: Locale): string {
    return locale === 'zh' ? 'zh-Hant' : locale;
}

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
