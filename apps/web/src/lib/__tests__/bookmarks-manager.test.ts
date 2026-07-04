import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @aquila/stories
vi.mock('@aquila/stories', () => ({
    getTranslations: vi.fn(() => ({
        bookmarks: {
            title: 'My Bookmarks',
            description: 'Your saved reading positions',
            loading: 'Loading...',
            notLoggedIn: 'You must be logged in to view bookmarks.',
            loginButton: 'Log In',
            error: 'Failed to load bookmarks. Please try again.',
            noBookmarks: 'No bookmarks yet.',
            startReading: 'Start Reading',
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
            localBookmarks: 'Local Bookmarks',
            cloudBookmarks: 'Cloud Bookmarks',
            noLocalBookmarks: 'No local bookmarks.',
            syncToCloud: 'Sync to Cloud',
            syncAllToCloud: 'Sync All to Cloud',
            syncSuccess: 'Bookmark synced to cloud!',
            syncFailed: 'Failed to sync bookmark to cloud.',
            syncAllSuccess: 'All bookmarks synced to cloud!',
            syncAllPartial: '{count} of {total} bookmarks synced.',
            syncAllFailed: 'Failed to sync bookmarks.',
            deleteLocal: 'Delete',
            deleteLocalConfirm: 'Delete this local bookmark?',
            loginToSync: 'Log in to sync bookmarks to the cloud',
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

const localStorageStore: Record<string, string> = {};

function setupContainer() {
    const container = document.createElement('div');
    container.id = 'bookmarks-container';
    document.body.replaceChildren(container);
}

function setupLocalStorage() {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    const origLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
            setItem: vi.fn((key: string, value: string) => {
                localStorageStore[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete localStorageStore[key];
            }),
            clear: vi.fn(() => {
                Object.keys(localStorageStore).forEach(
                    k => delete localStorageStore[k]
                );
            }),
            length: 0,
            key: vi.fn(),
        },
        writable: true,
        configurable: true,
    });
    return origLocalStorage;
}

function restoreLocalStorage(orig: Storage) {
    Object.defineProperty(window, 'localStorage', {
        value: orig,
        writable: true,
        configurable: true,
    });
}

function getContainer() {
    return document.getElementById('bookmarks-container')!;
}

describe('BookmarksManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.replaceChildren();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializeUI', () => {
        it('sets loading text content', () => {
            const loading = document.createElement('div');
            loading.id = 'loading-text';
            document.body.appendChild(loading);

            const manager = new BookmarksManager('en');
            manager.initializeUI();

            expect(document.getElementById('loading-text')!.textContent).toBe(
                'Loading...'
            );
        });

        it('gracefully handles missing UI elements', () => {
            document.body.replaceChildren();
            const manager = new BookmarksManager('en');
            expect(() => manager.initializeUI()).not.toThrow();
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

            it('renders not-logged-in state with error banner on non-401 error response', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'You must be logged in'
                );
                expect(container.textContent).toContain(
                    'Failed to load bookmarks. Please try again.'
                );
            });

            it('renders login link on non-401 error', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 503,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const loginLink = getContainer().querySelector('a');
                expect(loginLink?.getAttribute('href')).toBe('/en/login');
            });
        });

        describe('network / fetch errors', () => {
            it('renders not-logged-in state with error banner when fetch throws', async () => {
                setupContainer();
                global.fetch = vi
                    .fn()
                    .mockRejectedValue(new Error('Network error'));

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'You must be logged in'
                );
                expect(container.textContent).toContain(
                    'Failed to load bookmarks. Please try again.'
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

            // Cloud section + local section = 2 top-level children
            const sections = getContainer().children;
            expect(sections.length).toBe(2);

            // Cloud section contains one card per bookmark
            const cloudCards = sections[0]!.querySelectorAll(
                ':scope > [data-testid="bookmark-card"]'
            );
            expect(cloudCards.length).toBe(sampleBookmarks.length);
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

            const link = [...getContainer().querySelectorAll('a')].find(a =>
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

    describe('local bookmarks rendering', () => {
        let origLS: Storage;
        beforeEach(() => {
            origLS = setupLocalStorage();
        });
        afterEach(() => {
            restoreLocalStorage(origLS);
        });

        it('shows local bookmarks section when logged in with local bookmarks', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain('Local Bookmarks');
            expect(getContainer().textContent).toContain('Local Save');
        });

        it('shows sync all button when logged in with local bookmarks', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const buttons = [...getContainer().querySelectorAll('button')];
            expect(
                buttons.find(b => b.textContent === 'Sync All to Cloud')
            ).toBeDefined();
        });

        it('shows sync-to-cloud button on each local bookmark card when logged in', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const buttons = [...getContainer().querySelectorAll('button')];
            expect(
                buttons.find(b => b.textContent === 'Sync to Cloud')
            ).toBeDefined();
        });

        it('shows login hint when not logged in and has local bookmarks', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain(
                'Log in to sync bookmarks to the cloud'
            );
        });

        it('does not show local section when not logged in and no local bookmarks', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).not.toContain('Local Bookmarks');
        });

        it('shows noLocalBookmarks message when logged in with no local bookmarks', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain('No local bookmarks.');
        });

        it('renders local bookmark card with continue reading link including dialogue param', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: '[dlg:5] My Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const links = [...getContainer().querySelectorAll('a')];
            const continueLink = links.find(
                a =>
                    a.textContent === 'Continue Reading' &&
                    a.getAttribute('href')?.includes('dialogue=5')
            );
            expect(continueLink).toBeDefined();
        });

        it('renders delete local button on local bookmark cards', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const buttons = [...getContainer().querySelectorAll('button')];
            expect(
                buttons.find(
                    b =>
                        b.textContent === 'Delete' &&
                        b.dataset.testid === 'delete-local-bookmark'
                )
            ).toBeDefined();
        });
    });

    describe('syncSingleToCloud', () => {
        let origLS: Storage;
        beforeEach(() => {
            origLS = setupLocalStorage();
        });
        afterEach(() => {
            restoreLocalStorage(origLS);
        });

        it('syncs a local bookmark and removes it from local list', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncBtn = [...getContainer().querySelectorAll('button')].find(
                b => b.textContent === 'Sync to Cloud'
            );

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    id: 'cloud-new',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Synced',
                    locale: 'en',
                    createdAt: '2024-01-01',
                    updatedAt: '2024-01-01',
                }),
            } as any);

            syncBtn!.click();
            await vi.runAllTimersAsync();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/bookmarks',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('shows alert when sync single fails', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncBtn = [...getContainer().querySelectorAll('button')].find(
                b => b.textContent === 'Sync to Cloud'
            );

            global.fetch = vi.fn().mockResolvedValue({ ok: false } as any);

            syncBtn!.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Failed to sync bookmark to cloud.'
            );
        });

        it('shows alert when sync single throws', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncBtn = [...getContainer().querySelectorAll('button')].find(
                b => b.textContent === 'Sync to Cloud'
            );

            global.fetch = vi
                .fn()
                .mockRejectedValue(new Error('Network error'));

            syncBtn!.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Failed to sync bookmark to cloud.'
            );
        });

        it('replaces existing cloud bookmark when upsert returns same id', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncBtn = [...getContainer().querySelectorAll('button')].find(
                b => b.textContent === 'Sync to Cloud'
            );

            // API returns the existing cloud bookmark (same id as bm-1 already loaded)
            const upsertedBookmark = {
                id: 'bm-1',
                storyId: 'train_adventure',
                sceneId: 'act1-updated',
                bookmarkName: 'Updated Name',
                locale: 'en',
                createdAt: '2024-06-01T10:00:00.000Z',
                updatedAt: '2024-06-03T12:00:00.000Z',
            };
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(upsertedBookmark),
            } as any);

            syncBtn!.click();
            await vi.runAllTimersAsync();

            // Should show the updated bookmark, not a duplicate
            const text = getContainer().textContent!;
            const count = (text.match(/Updated Name/g) || []).length;
            expect(count).toBe(1);
            // Should NOT show the original "Chapter 1" name for bm-1
            expect(text).not.toContain('Chapter 1');
        });
    });

    describe('syncAllToCloud', () => {
        let origLS: Storage;
        beforeEach(() => {
            origLS = setupLocalStorage();
        });
        afterEach(() => {
            restoreLocalStorage(origLS);
        });

        it('syncs all local bookmarks and shows success alert', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'l1',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'B1',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'l2',
                    storyId: 's2',
                    sceneId: 'sc2',
                    bookmarkName: 'B2',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncAllBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(b => b.textContent === 'Sync All to Cloud');

            let syncCall = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                syncCall++;
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            id: 'cloud-' + syncCall,
                            storyId: 's' + syncCall,
                            sceneId: 'sc' + syncCall,
                            bookmarkName: 'C' + syncCall,
                            locale: 'en',
                            createdAt: '2024-01-01',
                            updatedAt: '2024-01-01',
                        }),
                });
            });

            syncAllBtn!.click();
            await vi.runAllTimersAsync();

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(mockShowAlert).toHaveBeenCalledWith(
                'All bookmarks synced to cloud!'
            );
        });

        it('shows partial success message when some syncs fail', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'l1',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'B1',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'l2',
                    storyId: 's2',
                    sceneId: 'sc2',
                    bookmarkName: 'B2',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncAllBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(b => b.textContent === 'Sync All to Cloud');

            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                id: 'cloud-1',
                                storyId: 's1',
                                sceneId: 'sc1',
                                bookmarkName: 'C1',
                                locale: 'en',
                                createdAt: '2024-01-01',
                                updatedAt: '2024-01-01',
                            }),
                    });
                }
                return Promise.resolve({ ok: false });
            });

            syncAllBtn!.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                '1 of 2 bookmarks synced.'
            );
        });

        it('shows all-failed message when all syncs fail', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'l1',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'B1',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncAllBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(b => b.textContent === 'Sync All to Cloud');

            global.fetch = vi.fn().mockRejectedValue(new Error('fail'));

            syncAllBtn!.click();
            await vi.runAllTimersAsync();

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Failed to sync bookmarks.'
            );
        });

        it('replaces existing cloud bookmarks on bulk sync upsert', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'l1',
                    storyId: 'train_adventure',
                    sceneId: 'scene_3',
                    bookmarkName: 'Chapter 1',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const syncAllBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(b => b.textContent === 'Sync All to Cloud');

            // The upsert returns bm-1 (same id as an existing cloud bookmark)
            // with updated sceneId — should replace, not duplicate
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    id: 'bm-1',
                    storyId: 'train_adventure',
                    sceneId: 'scene_3-updated',
                    bookmarkName: 'Chapter 1',
                    locale: 'en',
                    createdAt: '2024-06-01T10:00:00.000Z',
                    updatedAt: '2024-06-03T12:00:00.000Z',
                }),
            } as any);

            syncAllBtn!.click();
            await vi.runAllTimersAsync();

            // bm-1 should appear exactly once with the updated scene
            const text = getContainer().textContent!;
            const chapterOneCount = (text.match(/Chapter 1/g) || []).length;
            expect(chapterOneCount).toBe(1);
            expect(text).toContain('scene_3-updated');
        });
    });

    describe('deleteLocalBookmark', () => {
        let origLS: Storage;
        beforeEach(() => {
            origLS = setupLocalStorage();
        });
        afterEach(() => {
            restoreLocalStorage(origLS);
        });

        it('deletes local bookmark when confirmed', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const deleteBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(
                b =>
                    b.textContent === 'Delete' &&
                    b.dataset.testid === 'delete-local-bookmark'
            );

            mockShowConfirm.mockResolvedValue(true);
            deleteBtn!.click();
            await vi.runAllTimersAsync();

            expect(mockShowConfirm).toHaveBeenCalledWith(
                'Delete this local bookmark?'
            );
        });

        it('does not delete when confirmation is cancelled', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'Local Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const deleteBtn = [
                ...getContainer().querySelectorAll('button'),
            ].find(
                b =>
                    b.textContent === 'Delete' &&
                    b.dataset.testid === 'delete-local-bookmark'
            );

            mockShowConfirm.mockResolvedValue(false);
            deleteBtn!.click();
            await vi.runAllTimersAsync();

            expect(getContainer().textContent).toContain('Local Save');
        });
    });

    describe('renderAll no container', () => {
        it('does not throw when container does not exist', async () => {
            document.body.replaceChildren();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue([]),
            } as any);

            const manager = new BookmarksManager('en');
            await expect(manager.loadBookmarks()).resolves.toBeUndefined();
        });
    });
});
