import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translations, type Locale } from '@aquila/dialogue';

export type { Locale };

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Retrieves a translated string by key for the given locale.
 * Supports nested keys using dot notation (e.g., 'menu.title').
 *
 * @param locale - The locale to use ('en' or 'zh')
 * @param key - Dot-notation key path (e.g., 'menu.title')
 * @returns The translated string, or the key if not found
 */
export function t(locale: Locale | string, key: string): string {
    if (!key) return '';

    const keys = key.split('.');
    const validLocale: Locale = locale === 'zh' ? 'zh' : 'en';

    // Log warning for invalid locale
    if (locale !== 'en' && locale !== 'zh') {
        if (typeof locale === 'string') {
            console.warn(
                `[i18n] Invalid locale "${locale}" provided to t(); falling back to "en".`
            );
        } else {
            console.warn(
                '[i18n] Invalid locale provided to t(); falling back to "en".'
            );
        }
    }

    const localeTranslations = translations[validLocale];

    // Support both direct JSON exports and modules with a `default` property
    const moduleValue = localeTranslations as Record<string, unknown>;
    const rootValue =
        moduleValue.default && typeof moduleValue.default === 'object'
            ? (moduleValue.default as Record<string, unknown>)
            : moduleValue;
    let value: unknown = rootValue;

    for (const k of keys) {
        if (
            value &&
            typeof value === 'object' &&
            k in (value as Record<string, unknown>)
        ) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return key;
        }
    }

    return typeof value === 'string' ? value : key;
}

export interface User {
    email: string;
    username: string;
}

export function getUserFromCookies(request: Request): User | null {
    const headers = (
        request as unknown as {
            headers?: {
                get?: (name: string) => string | null;
            };
        }
    ).headers;

    const cookieHeader =
        headers?.get?.('cookie') ?? headers?.get?.('Cookie') ?? null;

    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
        (acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            if (key) acc[key] = value;
            return acc;
        },
        {} as Record<string, string>
    );

    const userCookie = cookies.user;
    if (!userCookie) return null;

    try {
        return JSON.parse(decodeURIComponent(userCookie));
    } catch {
        return null;
    }
}
