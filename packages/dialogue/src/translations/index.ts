import enTranslations from './en.json';
import zhTranslations from './zh.json';

export const translations = {
    en: enTranslations,
    zh: zhTranslations,
} as const;

export type Locale = keyof typeof translations;

export function getTranslations(locale: Locale) {
    return {
        ...(translations[locale] || translations.en),
        locale,
    };
}
