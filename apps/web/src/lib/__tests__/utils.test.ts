import { describe, it, expect, vi } from 'vitest';
import { cn, t, getUserFromCookies, type User } from '../utils';

vi.mock('@aquila/dialogue/translations/en.json', () => ({
    default: {
        common: { hello: 'Hello', goodbye: 'Goodbye' },
        auth: { login: 'Login', logout: 'Logout' },
    },
}));

vi.mock('@aquila/dialogue/translations/zh.json', () => ({
    default: {
        common: { hello: '你好', goodbye: '再见' },
        auth: { login: '登录', logout: '登出' },
    },
}));

describe('Utils', () => {
    describe('cn()', () => {
        it('merges class names', () => {
            expect(cn('a', 'b')).toBe('a b');
        });

        it('handles conditional values', () => {
            const isHidden = false;
            const isVisible = true;
            expect(
                cn('base', isHidden && 'hidden', isVisible && 'visible')
            ).toBe('base visible');
        });

        it('filters falsy values', () => {
            expect(cn('base', undefined, null, '')).toBe('base');
        });

        it('flattens arrays', () => {
            expect(cn(['one', 'two'], 'three')).toBe('one two three');
        });

        it('supports object syntax', () => {
            expect(cn({ one: true, two: false }, 'three')).toBe('one three');
        });
    });

    describe('t()', () => {
        it('returns english translations', () => {
            expect(t('en', 'common.hello')).toBe('Hello');
            expect(t('en', 'auth.login')).toBe('Login');
        });

        it('returns chinese translations', () => {
            expect(t('zh', 'common.hello')).toBe('你好');
            expect(t('zh', 'auth.login')).toBe('登录');
        });

        it('falls back to key for missing entry', () => {
            expect(t('en', 'missing.entry')).toBe('missing.entry');
        });

        it('defaults to english locale', () => {
            expect(t('fr', 'auth.logout')).toBe('Logout');
        });

        it('returns empty string when key is empty', () => {
            expect(t('en', '')).toBe('');
        });

        it('returns key when value is object', () => {
            expect(t('en', 'common')).toBe('common');
        });
    });

    describe('getUserFromCookies()', () => {
        const createRequest = (cookieHeader?: string) => {
            const headers = new Headers();
            if (cookieHeader) headers.set('cookie', cookieHeader);
            return new Request('https://example.com', { headers });
        };

        it('returns null without cookie header', () => {
            expect(getUserFromCookies(createRequest())).toBeNull();
        });

        it('returns null when user cookie missing', () => {
            expect(
                getUserFromCookies(createRequest('session=abc123'))
            ).toBeNull();
        });

        it('parses valid user cookie', () => {
            const user: User = {
                email: 'test@example.com',
                username: 'tester',
            };
            const encoded = encodeURIComponent(JSON.stringify(user));
            const request = createRequest(`session=abc123; user=${encoded}`);

            expect(getUserFromCookies(request)).toEqual(user);
        });

        it('returns null for malformed json', () => {
            const request = createRequest('user=invalid-json');
            expect(getUserFromCookies(request)).toBeNull();
        });

        it('handles multiple cookies', () => {
            const user: User = { email: 'one@example.com', username: 'one' };
            const encoded = encodeURIComponent(JSON.stringify(user));
            const request = createRequest(`foo=bar; user=${encoded}; baz=qux`);

            expect(getUserFromCookies(request)).toEqual(user);
        });

        it('decodes url-encoded values', () => {
            const user: User = {
                email: 'test+user@example.com',
                username: 'test user',
            };
            const encoded = encodeURIComponent(JSON.stringify(user));
            const request = createRequest(`user=${encoded}`);

            expect(getUserFromCookies(request)).toEqual(user);
        });
    });
});
