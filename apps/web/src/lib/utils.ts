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
    const keys = key.split('.');
    let value: Record<string, unknown> =
        translations[locale as keyof typeof translations] || translations.en;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k] as Record<string, unknown>;
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
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
        (acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
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
