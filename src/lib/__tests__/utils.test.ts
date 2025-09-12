import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cn, t, getUserFromCookies, type User } from '../utils';

// Mock the translation files
vi.mock('../../translations/en.json', () => ({
    default: {
        common: {
            hello: 'Hello',
            goodbye: 'Goodbye',
        },
        auth: {
            login: 'Login',
            logout: 'Logout',
        },
    },
}));

vi.mock('../../translations/zh.json', () => ({
    default: {
        common: {
            hello: '你好',
            goodbye: '再见',
        },
        auth: {
            login: '登录',
            logout: '登出',
        },
    },
}));

describe('Utils', () => {
    describe('cn function', () => {
        it('should merge class names correctly', () => {
            expect(cn('class1', 'class2')).toBe('class1 class2');
        });

        it('should handle conditional classes', () => {
            const isActive = true;
            const isInactive = false;
            expect(
                cn('base', isActive && 'active', isInactive && 'inactive')
            ).toBe('base active');
        });

        it('should handle undefined and null values', () => {
            expect(cn('base', undefined, null, 'valid')).toBe('base valid');
        });

        it('should handle empty strings', () => {
            expect(cn('base', '', 'valid')).toBe('base valid');
        });

        it('should handle array inputs', () => {
            expect(cn(['class1', 'class2'], 'class3')).toBe(
                'class1 class2 class3'
            );
        });

        it('should handle object inputs', () => {
            expect(cn({ class1: true, class2: false }, 'class3')).toBe(
                'class1 class3'
            );
        });
    });

    describe('t function', () => {
        it('should return translation for existing key in English', () => {
            expect(t('en', 'common.hello')).toBe('Hello');
            expect(t('en', 'auth.login')).toBe('Login');
        });

        it('should return translation for existing key in Chinese', () => {
            expect(t('zh', 'common.hello')).toBe('你好');
            expect(t('zh', 'auth.login')).toBe('登录');
        });

        it('should return key for non-existing translation', () => {
            expect(t('en', 'non.existing.key')).toBe('non.existing.key');
        });

        it('should return key for non-existing locale', () => {
            expect(t('fr', 'common.hello')).toBe('Hello');
        });

        it('should handle empty key', () => {
            expect(t('en', '')).toBe('');
        });

        it('should handle single level key', () => {
            expect(t('en', 'common')).toBe('common');
        });
    });

    describe('getUserFromCookies function', () => {
        const mockRequest = {
            headers: {
                get: vi.fn(),
            },
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        /* eslint-disable @typescript-eslint/no-explicit-any */
        it('should return null when no cookie header exists', () => {
            mockRequest.headers.get.mockReturnValue(null);
            expect(getUserFromCookies(mockRequest as any)).toBeNull();
        });

        it('should return null when no user cookie exists', () => {
            mockRequest.headers.get.mockReturnValue('session=abc123');
            expect(getUserFromCookies(mockRequest as any)).toBeNull();
        });

        it('should return parsed user from valid cookie', () => {
            const userData: User = {
                email: 'test@example.com',
                username: 'testuser',
            };
            const encodedUser = encodeURIComponent(JSON.stringify(userData));
            mockRequest.headers.get.mockReturnValue(
                `user=${encodedUser}; session=abc123`
            );

            const result = getUserFromCookies(mockRequest as any);
            expect(result).toEqual(userData);
        });

        it('should return null for malformed JSON', () => {
            mockRequest.headers.get.mockReturnValue(
                'user=invalid-json; session=abc123'
            );
            expect(getUserFromCookies(mockRequest as any)).toBeNull();
        });

        it('should handle multiple cookies correctly', () => {
            const userData: User = {
                email: 'test@example.com',
                username: 'testuser',
            };
            const encodedUser = encodeURIComponent(JSON.stringify(userData));
            mockRequest.headers.get.mockReturnValue(
                `other=value; user=${encodedUser}; another=test`
            );

            const result = getUserFromCookies(mockRequest as any);
            expect(result).toEqual(userData);
        });

        it('should handle URL encoded characters', () => {
            const userData: User = {
                email: 'test+user@example.com',
                username: 'test user',
            };
            const encodedUser = encodeURIComponent(JSON.stringify(userData));
            mockRequest.headers.get.mockReturnValue(`user=${encodedUser}`);

            const result = getUserFromCookies(mockRequest as any);
            expect(result).toEqual(userData);
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */
    });
});
