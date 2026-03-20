import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import UserStatus from '../UserStatus.svelte';

// Mock utils
vi.mock('../../lib/utils.js', () => ({
    t: vi.fn((locale: string, key: string) => {
        const translations: Record<string, string> = {
            'nav.profile': 'Profile',
            'nav.storyConfig': 'Story Config',
            'common.logout': 'Logout',
            'common.login': 'Login',
        };
        return translations[key] ?? key;
    }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
Object.defineProperty(window, 'location', {
    value: {
        href: '',
        pathname: '/en/',
    },
    writable: true,
});

describe('UserStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        document.documentElement.lang = 'en';
        window.location.href = '';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when user prop is provided', () => {
        const mockUser = {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
        };

        it('renders user name when user is provided', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            expect(screen.getByText('Test User')).toBeInTheDocument();
        });

        it('renders user email initial as avatar when name is null', () => {
            const userWithoutName = { ...mockUser, name: null };
            render(UserStatus, {
                props: { user: userWithoutName, currentLocale: 'en' },
            });

            expect(screen.getByText('T')).toBeInTheDocument(); // email initial
        });

        it('renders user name initial as avatar when name is provided', () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            expect(screen.getByText('T')).toBeInTheDocument(); // name initial
        });

        it('renders user menu button', () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            expect(screen.getByTitle('User Menu')).toBeInTheDocument();
        });

        it('does not call fetch when user is provided', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('shows dropdown links when dropdown is opened', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            expect(screen.getByText('Profile')).toBeInTheDocument();
            expect(screen.getByText('Story Config')).toBeInTheDocument();
            expect(screen.getByText('Logout')).toBeInTheDocument();
        });

        it('toggles dropdown on button click', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');

            // Open dropdown
            await fireEvent.click(menuButton);
            expect(screen.getByText('Profile')).toBeInTheDocument();
        });

        it('closes dropdown on Escape key press', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            // Verify dropdown is open (links visible)
            expect(screen.getByText('Profile')).toBeInTheDocument();

            await fireEvent.keyDown(document, { key: 'Escape' });

            // After Escape, dropdown should be closed
            // The dropdown has class opacity-0 when closed
            const dropdown = document.querySelector('[class*="invisible"]');
            expect(dropdown).toBeTruthy();
        });

        it('renders profile link with correct en locale href', async () => {
            document.documentElement.lang = 'en';
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const profileLink = screen.getByText('Profile').closest('a');
            expect(profileLink).toHaveAttribute('href', '/en/profile');
        });

        it('renders profile link with zh locale when document lang is zh', async () => {
            document.documentElement.lang = 'zh';
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const profileLink = screen.getByText('Profile').closest('a');
            expect(profileLink).toHaveAttribute('href', '/zh/profile');
        });

        it('stops propagation on button click to avoid closing dropdown', async () => {
            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            // Dropdown should still be open after click
            expect(screen.getByText('Profile')).toBeInTheDocument();
        });
    });

    describe('when user prop is null', () => {
        it('fetches session on mount', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ user: null }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith('/api/auth/get-session');
        });

        it('renders login link when no user', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ user: null }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            expect(screen.getByText('Login')).toBeInTheDocument();
        });

        it('renders login link with zh locale when document lang is zh', async () => {
            document.documentElement.lang = 'zh';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ user: null }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            const loginLink = screen.getByText('Login').closest('a');
            expect(loginLink).toHaveAttribute('href', '/zh/login');
        });

        it('shows error message when session fetch fails', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            expect(
                screen.getByText(
                    'Unable to verify session. Please try refreshing the page.'
                )
            ).toBeInTheDocument();
        });

        it('shows error when session fetch returns non-ok response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            expect(
                screen.getByText(
                    'Unable to verify session. Please try refreshing the page.'
                )
            ).toBeInTheDocument();
        });

        it('renders user after fetching session', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    user: {
                        id: 'user-1',
                        name: 'Fetched User',
                        email: 'fetched@example.com',
                    },
                }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            expect(screen.getByText('Fetched User')).toBeInTheDocument();
        });
    });

    describe('logout functionality', () => {
        const mockUser = {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
        };

        it('calls logout endpoint on logout form submit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const logoutForm = document.querySelector('form');
            await fireEvent.submit(logoutForm!);

            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/auth/sign-out',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('redirects to locale home after successful logout', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const logoutForm = document.querySelector('form');
            await fireEvent.submit(logoutForm!);

            await vi.runAllTimersAsync();

            expect(window.location.href).toBe('/en/');
        });

        it('calls logout via logout button click', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const logoutButton = screen.getByTitle('Logout');
            await fireEvent.click(logoutButton);

            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/auth/sign-out',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('handles logout failure gracefully (non-ok response)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const logoutForm = document.querySelector('form');
            await fireEvent.submit(logoutForm!);

            await vi.runAllTimersAsync();

            // Fetch was called but failed - user should still be logged in
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/auth/sign-out',
                expect.objectContaining({ method: 'POST' })
            );
            // Location should not have changed
            expect(window.location.href).not.toBe('/en/');
        });

        it('handles logout failure gracefully (network error)', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            const logoutForm = document.querySelector('form');
            await fireEvent.submit(logoutForm!);

            await vi.runAllTimersAsync();

            // Fetch was called but threw - user should still be logged in (no redirect)
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/auth/sign-out',
                expect.objectContaining({ method: 'POST' })
            );
            expect(window.location.href).not.toBe('/en/');
        });
    });

    describe('locale detection on mount', () => {
        it('uses document lang attribute for locale', async () => {
            document.documentElement.lang = 'zh';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ user: null }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            const loginLink = screen.getByText('Login').closest('a');
            expect(loginLink).toHaveAttribute('href', '/zh/login');
        });

        it('defaults to en when document lang is not set', async () => {
            document.documentElement.lang = '';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ user: null }),
            });

            render(UserStatus, {
                props: { user: null, currentLocale: 'en' },
            });

            await vi.runAllTimersAsync();

            const loginLink = screen.getByText('Login').closest('a');
            expect(loginLink).toHaveAttribute('href', '/en/login');
        });
    });

    describe('click outside to close dropdown', () => {
        it('closes dropdown when clicking outside', async () => {
            const mockUser = {
                id: 'user-1',
                name: 'Test User',
                email: 'test@example.com',
            };

            render(UserStatus, {
                props: { user: mockUser, currentLocale: 'en' },
            });

            const menuButton = screen.getByTitle('User Menu');
            await fireEvent.click(menuButton);

            // Click outside the component
            await fireEvent.click(document.body);

            // Dropdown should be hidden
            const dropdown = document.querySelector('[class*="invisible"]');
            expect(dropdown).toBeTruthy();
        });
    });
});
