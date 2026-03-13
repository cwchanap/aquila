import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @aquila/dialogue
vi.mock('@aquila/dialogue', () => ({
    getTranslations: vi.fn(() => ({
        bookmarks: {
            title: 'My Bookmarks',
            description: 'Your saved reading positions',
            backToHome: 'Back to Home',
            loading: 'Loading...',
            notLoggedIn: 'You must be logged in to view bookmarks.',
            loginButton: 'Log In',
            noBookmarks: 'No bookmarks yet.',
            startReading: 'Start Reading',
            error: 'Failed to load bookmarks.',
            retry: 'Retry',
            continueReading: 'Continue Reading',
            delete: 'Delete',
            deleteConfirm: 'Delete this bookmark?',
            deleteFailed: 'Failed to delete bookmark.',
            story: 'Story:',
            scene: 'Scene:',
            language: 'Language:',
            savedAt: 'Saved:',
            chinese: 'Chinese',
            english: 'English',
        },
    })),
}));

// Mock ui-dialogs
vi.mock('../ui-dialogs', () => ({
    showAlert: vi.fn().mockResolvedValue(undefined),
    showConfirm: vi.fn().mockResolvedValue(true),
}));

import { BookmarksManager, type Bookmark } from '../bookmarks-manager';
import { showAlert, showConfirm } from '../ui-dialogs';

const mockShowAlert = vi.mocked(showAlert);
const mockShowConfirm = vi.mocked(showConfirm);

const sampleBookmarks: Bookmark[] = [
    {
        id: 'bm-1',
        storyId: 'train_adventure',
        sceneId: 'scene_3',
        bookmarkName: 'Chapter 1',
        locale: 'en',
        createdAt: '2024-06-01T10:00:00.000Z',
        updatedAt: '2024-06-01T10:00:00.000Z',
    },
    {
        id: 'bm-2',
        storyId: 'train_adventure',
        sceneId: 'scene_5',
        bookmarkName: '[dlg:7] At the station',
        locale: 'zh',
        createdAt: '2024-06-02T12:00:00.000Z',
        updatedAt: '2024-06-02T12:00:00.000Z',
    },
];

function setupContainer(html = '<div id="bookmarks-container"></div>') {
    document.body.innerHTML = html;
}

function getContainer() {
    return document.getElementById('bookmarks-container')!;
}

describe('BookmarksManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializeUI', () => {
        it('sets text content of all UI elements', () => {
            document.body.innerHTML = `
                <div id="page-title"></div>
                <div id="page-description"></div>
                <a id="back-button"></a>
                <div id="loading-text"></div>
            `;

            const manager = new BookmarksManager('en');
            manager.initializeUI();

            expect(document.getElementById('page-title')!.textContent).toBe(
                'My Bookmarks'
            );
            expect(
                document.getElementById('page-description')!.textContent
            ).toBe('Your saved reading positions');
            expect(document.getElementById('back-button')!.textContent).toBe(
                'Back to Home'
            );
            expect(document.getElementById('loading-text')!.textContent).toBe(
                'Loading...'
            );
        });

        it('gracefully handles missing UI elements', () => {
            document.body.innerHTML = '';
            const manager = new BookmarksManager('en');
            expect(() => manager.initializeUI()).not.toThrow();
        });

        it('only updates elements that are present', () => {
            document.body.innerHTML = '<div id="page-title"></div>';
            const manager = new BookmarksManager('en');
            manager.initializeUI();
            expect(document.getElementById('page-title')!.textContent).toBe(
                'My Bookmarks'
            );
        });
    });

    describe('loadBookmarks', () => {
        describe('successful fetch', () => {
            it('renders bookmarks when API returns an array', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue(sampleBookmarks),
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.children.length).toBeGreaterThan(0);
            });

            it('renders bookmarks when API returns { data: [...] }', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ data: sampleBookmarks }),
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.children.length).toBeGreaterThan(0);
            });

            it('renders empty state when API returns empty array', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue([]),
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain('No bookmarks yet.');
            });

            it('renders "start reading" link for empty state', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue([]),
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const link = getContainer().querySelector('a');
                expect(link?.getAttribute('href')).toBe('/en/reader');
            });
        });

        describe('HTTP error responses', () => {
            it('renders not-logged-in state on 401', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 401,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'You must be logged in'
                );
            });

            it('not-logged-in card contains login link pointing to locale login page', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 401,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const loginLink = getContainer().querySelector('a');
                expect(loginLink?.getAttribute('href')).toBe('/en/login');
            });

            it('renders error state on non-401 error response', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'Failed to load bookmarks.'
                );
            });

            it('renders error state with retry button on non-401 error', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 503,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const retryBtn = getContainer().querySelector('button');
                expect(retryBtn?.textContent).toBe('Retry');
            });
        });

        describe('network / fetch errors', () => {
            it('renders error state when fetch throws', async () => {
                setupContainer();
                global.fetch = vi
                    .fn()
                    .mockRejectedValue(new Error('Network error'));

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'Failed to load bookmarks.'
                );
            });
        });
    });

    describe('renderBookmarks (via loadBookmarks)', () => {
        it('renders one card per bookmark', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            // Each bookmark gets its own child card in the container
            const cards = getContainer().children;
            expect(cards.length).toBe(sampleBookmarks.length);
        });

        it('strips [dlg:N] prefix from bookmark name display', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[1]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const titles = getContainer().querySelectorAll('h3');
            expect(titles[0].textContent).toBe('At the station');
        });

        it('shows full bookmark name when no [dlg:N] prefix', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[0]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const title = getContainer().querySelector('h3');
            expect(title?.textContent).toBe('Chapter 1');
        });

        it('includes dialogue number in continue-reading href when [dlg:N] prefix present', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[1]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const link =
                getContainer().querySelector('a.\\[continueLink\\]') ??
                [...getContainer().querySelectorAll('a')].find(a =>
                    a.href.includes('dialogue=7')
                );
            // The href should include &dialogue=7
            expect(link?.getAttribute('href')).toContain('dialogue=7');
        });

        it('does not include dialogue param when no [dlg:N] prefix', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[0]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const links = getContainer().querySelectorAll('a');
            links.forEach(link => {
                expect(link.getAttribute('href')).not.toContain('dialogue=');
            });
        });

        it('shows "Chinese" language label for zh locale bookmarks', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[1]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain('Chinese');
        });

        it('shows "English" language label for en locale bookmarks', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([sampleBookmarks[0]]),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain('English');
        });

        it('renders a delete button for each bookmark', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const deleteButtons = [
                ...getContainer().querySelectorAll('button'),
            ].filter(btn => btn.textContent === 'Delete');
            expect(deleteButtons.length).toBe(sampleBookmarks.length);
        });
    });

    describe('deleteBookmark (via rendered delete button)', () => {
        async function renderAndGetDeleteButton(bookmarkIndex = 0) {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const deleteButtons = [
                ...getContainer().querySelectorAll('button'),
            ].filter(btn => btn.textContent === 'Delete');
            return {
                manager,
                deleteBtn: deleteButtons[bookmarkIndex] as HTMLButtonElement,
            };
        }

        it('shows confirmation dialog before deleting', async () => {
            const { deleteBtn } = await renderAndGetDeleteButton();
            mockShowConfirm.mockResolvedValueOnce(true);
            global.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

            deleteBtn.click();
            await vi.runAllTimersAsync();

            expect(mockShowConfirm).toHaveBeenCalledWith(
                'Delete this bookmark?'
            );
        });

        it('deletes bookmark and re-renders when confirmed', async () => {
            const { deleteBtn } = await renderAndGetDeleteButton();
            mockShowConfirm.mockResolvedValueOnce(true);

            // The DELETE request succeeds
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({ ok: true } as any); // DELETE call
            global.fetch = fetchMock;

            deleteBtn.click();
            await vi.runAllTimersAsync();

            expect(fetchMock).toHaveBeenCalledWith(
                `/api/bookmarks/${sampleBookmarks[0].id}`,
                { method: 'DELETE' }
            );
        });

        it('does not call fetch when confirmation is cancelled', async () => {
            const { deleteBtn } = await renderAndGetDeleteButton();
            mockShowConfirm.mockResolvedValueOnce(false);
            const fetchMock = vi.fn();
            global.fetch = fetchMock;

            deleteBtn.click();
            await vi.runAllTimersAsync();

            // fetch should NOT have been called for DELETE
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('shows alert when delete API call fails', async () => {
            const { deleteBtn } = await renderAndGetDeleteButton();
            mockShowConfirm.mockResolvedValueOnce(true);
            global.fetch = vi
                .fn()
                .mockResolvedValue({ ok: false, status: 500 } as any);

            deleteBtn.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Failed to delete bookmark.'
            );
        });

        it('shows alert when delete throws a network error', async () => {
            const { deleteBtn } = await renderAndGetDeleteButton();
            mockShowConfirm.mockResolvedValueOnce(true);
            global.fetch = vi
                .fn()
                .mockRejectedValue(new Error('Network failure'));

            deleteBtn.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Failed to delete bookmark.'
            );
        });
    });

    describe('locale support', () => {
        it('uses zh locale login URL for zh manager', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('zh');
            await manager.loadBookmarks();

            const loginLink = getContainer().querySelector('a');
            expect(loginLink?.getAttribute('href')).toBe('/zh/login');
        });

        it('uses zh locale reader URL for empty state', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([]),
            } as any);

            const manager = new BookmarksManager('zh');
            await manager.loadBookmarks();

            const link = getContainer().querySelector('a');
            expect(link?.getAttribute('href')).toBe('/zh/reader');
        });
    });
});
