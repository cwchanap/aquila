import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import enTranslations from '@aquila/dialogue/translations/en.json';
import zhTranslations from '@aquila/dialogue/translations/zh.json';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const translations = {
    en: enTranslations,
    zh: zhTranslations,
};

export function t(locale: string, key: string): string {
    if (!key) return '';

    const keys = key.split('.');
    const localeTranslations =
        translations[locale as keyof typeof translations] || translations.en;

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
