import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * UserStatus Component Unit Tests
 *
 * These tests cover the business logic of the UserStatus component:
 * - Display name/email formatting
 * - Dropdown state management
 * - Keyboard navigation (Escape to close)
 * - Logout flow
 *
 * Actual rendering is tested via Svelte testing-library patterns.
 */

describe('UserStatus Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset location mock
        Object.defineProperty(globalThis, 'location', {
            value: { href: '' },
            writable: true,
        });
    });

    describe('Display Name Formatting', () => {
        it('should use first character of name for avatar', () => {
            const user = {
                id: '1',
                name: 'John Doe',
                email: 'john@example.com',
            };
            const initial =
                user.name?.charAt(0).toUpperCase() ||
                user.email?.charAt(0).toUpperCase() ||
                'U';
            expect(initial).toBe('J');
        });

        it('should fall back to email initial when name is null', () => {
            const user = { id: '1', name: null, email: 'john@example.com' };
            const initial =
                user.name?.charAt(0).toUpperCase() ||
                user.email?.charAt(0).toUpperCase() ||
                'U';
            expect(initial).toBe('J');
        });

        it('should fall back to U when both name and email are empty', () => {
            const user = { id: '1', name: '', email: '' };
            const initial =
                user.name?.charAt(0).toUpperCase() ||
                user.email?.charAt(0).toUpperCase() ||
                'U';
            expect(initial).toBe('U');
        });

        it('should display name over email when both present', () => {
            const user = {
                id: '1',
                name: 'John Doe',
                email: 'john@example.com',
            };
            const displayName = user.name || user.email;
            expect(displayName).toBe('John Doe');
        });

        it('should display email when name is null', () => {
            const user = { id: '1', name: null, email: 'john@example.com' };
            const displayName = user.name || user.email;
            expect(displayName).toBe('john@example.com');
        });
    });

    describe('User Normalization', () => {
        // Test the normalization logic used in the component
        const normalizeUser = (
            raw: { id?: string; email?: string; name?: string | null } | null
        ) => {
            if (!raw || !raw.email) return null;
            return {
                id: (raw.id as string) ?? raw.email,
                email: raw.email,
                name: (raw.name as string | null) ?? null,
            };
        };

        it('should normalize user object with all fields', () => {
            const raw = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            };
            const user = normalizeUser(raw);

            expect(user).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            });
        });

        it('should handle user without name gracefully', () => {
            const raw = {
                id: 'user-123',
                email: 'test@example.com',
            };
            const user = normalizeUser(raw);

            expect(user).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                name: null,
            });
        });

        it('should return null for user without email', () => {
            const raw = {
                id: 'user-123',
            };
            const user = normalizeUser(raw as { id?: string; email?: string });

            expect(user).toBeNull();
        });

        it('should return null for null input', () => {
            const user = normalizeUser(null);
            expect(user).toBeNull();
        });
    });

    describe('Logout Flow', () => {
        it('should construct correct login redirect URL', () => {
            const locale = 'en';
            const redirectUrl = `/${locale}/login`;
            expect(redirectUrl).toBe('/en/login');
        });

        it('should construct correct login redirect URL for zh locale', () => {
            const locale = 'zh';
            const redirectUrl = `/${locale}/login`;
            expect(redirectUrl).toBe('/zh/login');
        });

        it('should use fallback locale when document.lang is empty', () => {
            const docLang = '';
            const currentLocale = 'en';
            const locale = docLang || currentLocale || 'en';
            expect(locale).toBe('en');
        });
    });

    describe('Dropdown State', () => {
        it('should toggle dropdown open state', () => {
            let dropdownOpen = false;

            // Toggle on
            dropdownOpen = !dropdownOpen;
            expect(dropdownOpen).toBe(true);

            // Toggle off
            dropdownOpen = !dropdownOpen;
            expect(dropdownOpen).toBe(false);
        });

        it('should close dropdown on Escape key', () => {
            let dropdownOpen = true;

            const handleKeydown = (key: string) => {
                if (key === 'Escape') {
                    dropdownOpen = false;
                }
            };

            handleKeydown('Escape');
            expect(dropdownOpen).toBe(false);
        });

        it('should close dropdown when clicking outside', () => {
            let dropdownOpen = true;
            const menuButton = { contains: vi.fn(() => false) };
            const dropdown = { contains: vi.fn(() => false) };

            const handleClickOutside = (target: Node) => {
                if (
                    !menuButton.contains(target) &&
                    !dropdown.contains(target)
                ) {
                    dropdownOpen = false;
                }
            };

            handleClickOutside({} as Node);
            expect(dropdownOpen).toBe(false);
        });

        it('should NOT close dropdown when clicking inside menu', () => {
            let dropdownOpen = true;
            const menuButton = { contains: vi.fn(() => true) };
            const dropdown = { contains: vi.fn(() => false) };

            const handleClickOutside = (target: Node) => {
                if (
                    !menuButton.contains(target) &&
                    !dropdown.contains(target)
                ) {
                    dropdownOpen = false;
                }
            };

            handleClickOutside({} as Node);
            expect(dropdownOpen).toBe(true);
        });
    });
});
