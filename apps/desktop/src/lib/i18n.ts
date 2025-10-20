import en from '@aquila/dialogue/translations/en.json';
import zh from '@aquila/dialogue/translations/zh.json';

export type Locale = 'en' | 'zh';

const translations = { en, zh };

export function getLocale(): Locale {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('aquila:language');
        if (stored === 'en' || stored === 'zh') {
            return stored;
        }
    }
    return 'zh'; // Default to Chinese for Train Adventure
}

export function setLocale(locale: Locale): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('aquila:language', locale);
    }
}

export function t(key: string, locale?: Locale): string {
    const currentLocale = locale || getLocale();
    const keys = key.split('.');
    let value: unknown = translations[currentLocale];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return key;
        }
    }

    return typeof value === 'string' ? value : key;
}
