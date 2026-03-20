import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import MainMenu from '../MainMenu.svelte';

// Mock @aquila/dialogue
vi.mock('@aquila/dialogue', () => ({
    getTranslations: vi.fn(() => ({
        menu: {
            heading: 'AQUILA',
            startGame: 'Start Game',
            bookmarks: 'Bookmarks',
            settings: 'Settings',
            settingsComingSoon: 'Settings coming soon!',
        },
        common: {
            logout: 'Logout',
            login: 'Login',
            back: 'Back',
        },
    })),
}));

// Mock UserStatus with a minimal Svelte 5 compatible stub (components are functions in Svelte 5)
vi.mock('../UserStatus.svelte', () => ({
    default: vi.fn(() => undefined),
}));

// Mock window methods
const mockLocationAssign = vi.fn();
const mockAlert = vi.fn();

Object.defineProperty(window, 'location', {
    value: {
        href: '',
        pathname: '/en/',
        assign: mockLocationAssign,
    },
    writable: true,
});

window.alert = mockAlert;

// Mock localStorage
const mockLocalStorageSetItem = vi.fn();
const mockLocalStorageGetItem = vi.fn();
Object.defineProperty(window, 'localStorage', {
    value: {
        setItem: mockLocalStorageSetItem,
        getItem: mockLocalStorageGetItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
    },
    writable: true,
});

describe('MainMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.pathname = '/en/';
        document.documentElement.lang = 'en';
    });

    describe('rendering', () => {
        it('renders the game title heading', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('AQUILA')).toBeInTheDocument();
        });

        it('renders the Start Game button', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('Start Game')).toBeInTheDocument();
        });

        it('renders the Bookmarks button', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('Bookmarks')).toBeInTheDocument();
        });

        it('renders the Settings button', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('Settings')).toBeInTheDocument();
        });

        it('renders English and Chinese language links', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('English')).toBeInTheDocument();
            expect(screen.getByText('中文')).toBeInTheDocument();
        });

        it('renders the start game link with correct locale href', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const startLink = screen.getByText('Start Game').closest('a');
            expect(startLink).toHaveAttribute('href', '/en/stories');
        });

        it('renders start game link with zh locale when document lang is zh', async () => {
            document.documentElement.lang = 'zh';
            render(MainMenu, {
                props: { user: null, locale: 'zh' },
            });

            await vi.runAllTimersAsync();

            const startLink = screen.getByText('Start Game').closest('a');
            expect(startLink).toHaveAttribute('href', '/zh/stories');
        });

        it('renders English language link pointing to /en/', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const enLink = screen.getByText('English').closest('a');
            expect(enLink).toHaveAttribute('href', '/en/');
        });

        it('renders Chinese language link pointing to /zh/', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const zhLink = screen.getByText('中文').closest('a');
            expect(zhLink).toHaveAttribute('href', '/zh/');
        });
    });

    describe('language click handler', () => {
        it('saves language preference to localStorage on English click', async () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const enLink = screen.getByText('English');
            await fireEvent.click(enLink);

            expect(mockLocalStorageSetItem).toHaveBeenCalledWith(
                'aquila:language',
                'en'
            );
        });

        it('saves language preference to localStorage on Chinese click', async () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const zhLink = screen.getByText('中文');
            await fireEvent.click(zhLink);

            expect(mockLocalStorageSetItem).toHaveBeenCalledWith(
                'aquila:language',
                'zh'
            );
        });

        it('handles localStorage error gracefully', async () => {
            mockLocalStorageSetItem.mockImplementationOnce(() => {
                throw new Error('localStorage quota exceeded');
            });

            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const enLink = screen.getByText('English');
            await fireEvent.click(enLink);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('settings button', () => {
        it('shows settings alert when settings button is clicked', async () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const settingsBtn = screen.getByText('Settings').closest('button');
            await fireEvent.click(settingsBtn!);

            expect(mockAlert).toHaveBeenCalledWith('Settings coming soon!');
        });

        it('settings button has correct id', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(document.getElementById('settings-btn')).toBeInTheDocument();
        });
    });

    describe('bookmarks button', () => {
        it('navigates to English bookmarks on click from English path', async () => {
            window.location.pathname = '/en/';

            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const bookmarksBtn = screen
                .getByText('Bookmarks')
                .closest('button');
            await fireEvent.click(bookmarksBtn!);

            expect(window.location.href).toBe('/en/bookmarks');
        });

        it('navigates to Chinese bookmarks on click from Chinese path', async () => {
            window.location.pathname = '/zh/stories';

            render(MainMenu, {
                props: { user: null, locale: 'zh' },
            });

            const bookmarksBtn = screen
                .getByText('Bookmarks')
                .closest('button');
            await fireEvent.click(bookmarksBtn!);

            expect(window.location.href).toBe('/zh/bookmarks');
        });
    });

    describe('start game button', () => {
        it('start button has correct id', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(document.getElementById('start-btn')).toBeInTheDocument();
        });
    });

    describe('with user prop', () => {
        const mockUser = {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            image: null,
        };

        it('renders without error when user is provided', () => {
            expect(() => {
                render(MainMenu, {
                    props: { user: mockUser as any, locale: 'en' },
                });
            }).not.toThrow();
        });
    });
});
