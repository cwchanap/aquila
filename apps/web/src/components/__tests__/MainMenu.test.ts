import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import MainMenu from '../MainMenu.svelte';
import UserStatus from '../UserStatus.svelte';

// Mock the lightweight translations boundary used by MainMenu.
vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
    getTranslations: vi.fn(() => ({
        menu: {
            heading: 'AQUILA',
            startGame: 'Start Game',
            bookmarks: 'Bookmarks',
            settings: 'Settings',
        },
        progress: {
            title: 'My Progress',
        },
        bookmarks: {
            english: 'English',
            chinese: 'Chinese',
        },
        languages: {
            english: 'English',
            chinese: '中文',
            japanese: '日本語',
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

        it('renders the My Progress link', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(screen.getByText('My Progress')).toBeInTheDocument();
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

        it('renders Japanese language link pointing to /ja/', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const jaLink = screen.getByText('日本語').closest('a');
            expect(jaLink).toHaveAttribute('href', '/ja/');
            expect(jaLink).toHaveAttribute('lang', 'ja');
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

        it('saves language preference to localStorage on Japanese click', async () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            await fireEvent.click(screen.getByText('日本語'));

            expect(mockLocalStorageSetItem).toHaveBeenCalledWith(
                'aquila:language',
                'ja'
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

    describe('my progress link', () => {
        it('points to the locale progress page', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const progressLink = screen.getByText('My Progress').closest('a');
            expect(progressLink).toHaveAttribute('href', '/en/progress');
        });

        it('uses the document lang locale for the progress href', async () => {
            document.documentElement.lang = 'ja';
            render(MainMenu, {
                props: { user: null, locale: 'ja' },
            });

            await vi.runAllTimersAsync();

            const progressLink = screen.getByText('My Progress').closest('a');
            expect(progressLink).toHaveAttribute('href', '/ja/progress');
        });

        it('orders the actions Start Game → My Progress → Bookmarks', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            const start = screen.getByText('Start Game');
            const progress = screen.getByText('My Progress');
            const bookmarks = screen.getByText('Bookmarks');
            expect(
                start.compareDocumentPosition(progress) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
            expect(
                progress.compareDocumentPosition(bookmarks) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
        });

        it('does not render the retired Settings control', () => {
            render(MainMenu, {
                props: { user: null, locale: 'en' },
            });

            expect(
                document.getElementById('settings-btn')
            ).not.toBeInTheDocument();
            expect(screen.queryByText('Settings')).not.toBeInTheDocument();
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

        it('navigates to Japanese bookmarks on click from Japanese path', async () => {
            window.location.pathname = '/ja/';

            render(MainMenu, {
                props: { user: null, locale: 'ja' },
            });

            const bookmarksBtn = screen
                .getByText('Bookmarks')
                .closest('button');
            await fireEvent.click(bookmarksBtn!);

            expect(window.location.href).toBe('/ja/bookmarks');
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

        it('forwards the user prop to UserStatus (so it renders authed without a client fetch / flash)', () => {
            render(MainMenu, {
                props: { user: mockUser as any, locale: 'en' },
            });

            expect(UserStatus).toHaveBeenCalled();
            // Find the props object Svelte passed to UserStatus and assert the
            // user was forwarded — if MainMenu drops it, UserStatus would fall
            // back to a client-side session fetch and flash the unauthed state.
            const forwardedProps = vi
                .mocked(UserStatus)
                .mock.calls.flat()
                .find(
                    (arg): arg is { user?: unknown } =>
                        !!arg && typeof arg === 'object' && 'user' in arg
                );
            expect(forwardedProps?.user).toEqual(mockUser);
        });
    });
});
