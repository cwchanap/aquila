import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the lightweight translations boundary used by BookmarksManager.
vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
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

    describe('server auth state', () => {
        let origLS: Storage;
        beforeEach(() => {
            origLS = setupLocalStorage();
        });
        afterEach(() => {
            restoreLocalStorage(origLS);
        });

        it('skips the cloud request and shows the login state when signed out', async () => {
            setupContainer();
            global.fetch = vi.fn();

            const manager = new BookmarksManager('en', 'signed-out');
            await manager.loadBookmarks();

            expect(global.fetch).not.toHaveBeenCalled();
            const container = getContainer();
            expect(container.textContent).toContain('You must be logged in');
            expect(container.textContent).not.toContain('Cloud Bookmarks');
            expect(container.textContent).not.toContain('Loading...');
        });

        it('renders local cards and a cloud loading label before a signed-in response', async () => {
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
            let resolveFetch!: (response: unknown) => void;
            global.fetch = vi.fn(
                () =>
                    new Promise(resolve => {
                        resolveFetch = resolve;
                    })
            );

            const manager = new BookmarksManager('en', 'signed-in');
            const loading = manager.loadBookmarks();

            const container = getContainer();
            expect(container.textContent).toContain('Local Save');
            expect(container.textContent).toContain('Cloud Bookmarks');
            expect(container.textContent).toContain('Loading...');
            expect(container.textContent).not.toContain('No bookmarks yet.');

            resolveFetch({ ok: true, json: vi.fn().mockResolvedValue([]) });
            await loading;

            expect(container.textContent).toContain('No bookmarks yet.');
            expect(container.textContent).not.toContain('Loading...');
        });

        it('keeps focus on the same local action when the cloud response arrives', async () => {
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
            let resolveFetch!: (response: unknown) => void;
            global.fetch = vi.fn(
                () =>
                    new Promise(resolve => {
                        resolveFetch = resolve;
                    })
            );
            const loading = new BookmarksManager(
                'en',
                'signed-in'
            ).loadBookmarks();
            const link = getContainer().querySelector<HTMLAnchorElement>(
                '[data-testid="local-bookmark-card"] a'
            )!;
            link.focus();
            expect(document.activeElement).toBe(link);
            resolveFetch({
                ok: true,
                json: vi.fn().mockResolvedValue(sampleBookmarks),
            });
            await loading;
            const currentLink = getContainer().querySelector(
                '[data-testid="local-bookmark-card"] a'
            );
            expect(document.activeElement).toBe(currentLink);
        });

        it.each(['Sync to Cloud', 'Sync All to Cloud'])(
            'retains the listing error after a successful %s',
            async action => {
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
                global.fetch = vi
                    .fn()
                    .mockResolvedValueOnce({ ok: false, status: 500 } as any)
                    .mockResolvedValueOnce({
                        ok: true,
                        json: async () => sampleBookmarks[0],
                    } as any);
                await new BookmarksManager('en', 'signed-in').loadBookmarks();
                const button = [
                    ...getContainer().querySelectorAll('button'),
                ].find(b => b.textContent === action)!;
                button.click();
                await vi.runAllTimersAsync();
                expect(getContainer().textContent).toContain(
                    'Failed to load bookmarks. Please try again.'
                );
                expect(getContainer().textContent).toContain('Chapter 1');
                expect(getContainer().textContent).not.toContain(
                    'No bookmarks yet.'
                );
                expect(
                    JSON.parse(localStorageStore['aquila:bookmarks:en'])
                ).toEqual([]);
            }
        );

        it.each(['Sync to Cloud', 'Sync All to Cloud'])(
            'clears the listing error when retrying the cloud list after a successful %s succeeds',
            async action => {
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
                global.fetch = vi
                    .fn()
                    .mockResolvedValueOnce({ ok: false, status: 500 } as any)
                    .mockResolvedValueOnce({
                        ok: true,
                        json: async () => sampleBookmarks[0],
                    } as any)
                    .mockResolvedValueOnce({
                        ok: true,
                        json: async () => sampleBookmarks,
                    } as any);

                await new BookmarksManager('en', 'signed-in').loadBookmarks();
                const button = [
                    ...getContainer().querySelectorAll('button'),
                ].find(b => b.textContent === action)!;
                button.click();
                await vi.runAllTimersAsync();

                const text = getContainer().textContent!;
                expect(text).not.toContain(
                    'Failed to load bookmarks. Please try again.'
                );
                expect(text).toContain('Chapter 1');
                expect(text).toContain('At the station');
            }
        );

        it.each([false, true])(
            'preserves focus when the cloud response re-renders during a local delete confirm (confirmed=%s)',
            async confirmed => {
                setupContainer();
                localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                    {
                        id: 'local-1',
                        storyId: 'train_adventure',
                        sceneId: 'act1',
                        bookmarkName: 'First Save',
                        locale: 'en',
                        createdAt: 1,
                        updatedAt: 1,
                    },
                    {
                        id: 'local-2',
                        storyId: 'train_adventure',
                        sceneId: 'act2',
                        bookmarkName: 'Second Save',
                        locale: 'en',
                        createdAt: 2,
                        updatedAt: 2,
                    },
                ]);
                let resolveFetch!: (response: unknown) => void;
                global.fetch = vi.fn(
                    () =>
                        new Promise(resolve => {
                            resolveFetch = resolve;
                        })
                );

                const loading = new BookmarksManager(
                    'en',
                    'signed-in'
                ).loadBookmarks();

                const firstDelete = getContainer().querySelector<HTMLElement>(
                    '[data-bookmark-id="local-1"] [data-bookmark-action="delete"]'
                )!;
                firstDelete.focus();
                expect(document.activeElement).toBe(firstDelete);

                mockShowConfirm.mockImplementationOnce(async () => {
                    const dialogBtn = document.createElement('button');
                    document.body.appendChild(dialogBtn);
                    dialogBtn.focus();
                    resolveFetch({
                        ok: true,
                        json: async () => sampleBookmarks,
                    });
                    await loading;
                    dialogBtn.remove();
                    return confirmed;
                });

                firstDelete.click();
                await vi.runAllTimersAsync();

                const expectedId = confirmed ? 'local-2' : 'local-1';
                const expectedBtn = getContainer().querySelector(
                    `[data-bookmark-id="${expectedId}"] [data-bookmark-action="delete"]`
                );
                expect(expectedBtn).not.toBeNull();
                expect(document.activeElement).toBe(expectedBtn);
            }
        );

        it('ignores an older recovery response that resolves after a newer one', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'First Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'local-2',
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    bookmarkName: 'Second Save',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ]);
            const bmA = {
                ...sampleBookmarks[0],
                id: 'bm-a',
                bookmarkName: 'Synced A',
            };
            const bmB = {
                ...sampleBookmarks[0],
                id: 'bm-b',
                bookmarkName: 'Synced B',
            };
            const pendingGets: Array<(v: unknown) => void> = [];
            global.fetch = vi
                .fn()
                .mockImplementationOnce(
                    async () => ({ ok: false, status: 500 }) as any
                )
                .mockImplementation((input: unknown, opts?: RequestInit) => {
                    if (opts?.method === 'POST') {
                        const body = JSON.parse(String(opts.body));
                        return Promise.resolve({
                            ok: true,
                            json: async () => ({
                                id: body.sceneId === 'act1' ? 'bm-a' : 'bm-b',
                                storyId: body.storyId,
                                sceneId: body.sceneId,
                                bookmarkName:
                                    body.sceneId === 'act1'
                                        ? 'Synced A'
                                        : 'Synced B',
                                locale: body.locale,
                                createdAt: '2024-01-01',
                                updatedAt: '2024-01-01',
                            }),
                        } as any);
                    }
                    return new Promise(resolve => pendingGets.push(resolve));
                });

            await new BookmarksManager('en', 'signed-in').loadBookmarks();

            const syncBtn = (id: string) =>
                getContainer().querySelector<HTMLElement>(
                    `[data-bookmark-id="${id}"] [data-bookmark-action="sync"]`
                )!;

            syncBtn('local-1').click();
            await vi.runAllTimersAsync();
            syncBtn('local-2').click();
            await vi.runAllTimersAsync();
            expect(pendingGets).toHaveLength(2);

            // The newer GET resolves first; the older one lands last with a
            // smaller list and must not overwrite it.
            pendingGets[1]({ ok: true, json: async () => [bmA, bmB] });
            await vi.runAllTimersAsync();
            pendingGets[0]({ ok: true, json: async () => [bmA] });
            await vi.runAllTimersAsync();

            expect(
                getContainer().querySelectorAll('[data-testid="bookmark-card"]')
            ).toHaveLength(2);
            expect(getContainer().textContent).toContain('Synced A');
            expect(getContainer().textContent).toContain('Synced B');
        });

        it('ignores a recovery response that resolves after a cloud delete', async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'First Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'local-2',
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    bookmarkName: 'Second Save',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ]);
            const bmA = {
                ...sampleBookmarks[0],
                id: 'bm-a',
                bookmarkName: 'Synced A',
            };
            const bmB = {
                ...sampleBookmarks[0],
                id: 'bm-b',
                bookmarkName: 'Synced B',
            };
            const pendingGets: Array<(v: unknown) => void> = [];
            global.fetch = vi
                .fn()
                .mockImplementationOnce(
                    async () => ({ ok: false, status: 500 }) as any
                )
                .mockImplementation((input: unknown, opts?: RequestInit) => {
                    if (opts?.method === 'DELETE') {
                        return Promise.resolve({ ok: true } as any);
                    }
                    if (opts?.method === 'POST') {
                        const body = JSON.parse(String(opts.body));
                        return Promise.resolve({
                            ok: true,
                            json: async () => ({
                                id: body.sceneId === 'act1' ? 'bm-a' : 'bm-b',
                                storyId: body.storyId,
                                sceneId: body.sceneId,
                                bookmarkName:
                                    body.sceneId === 'act1'
                                        ? 'Synced A'
                                        : 'Synced B',
                                locale: body.locale,
                                createdAt: '2024-01-01',
                                updatedAt: '2024-01-01',
                            }),
                        } as any);
                    }
                    return new Promise(resolve => pendingGets.push(resolve));
                });

            await new BookmarksManager('en', 'signed-in').loadBookmarks();

            const syncBtn = (id: string) =>
                getContainer().querySelector<HTMLElement>(
                    `[data-bookmark-id="${id}"] [data-bookmark-action="sync"]`
                )!;

            // Sync A: its recovery GET fails, keeping cloudError so the card
            // renders from the POST upsert alone.
            syncBtn('local-1').click();
            await vi.runAllTimersAsync();
            expect(pendingGets).toHaveLength(1);
            pendingGets[0]({ ok: false, status: 500 });
            await vi.runAllTimersAsync();

            // Sync B starts a second recovery GET and suspends before
            // re-rendering; delete A while that GET is in flight.
            syncBtn('local-2').click();
            await vi.runAllTimersAsync();
            expect(pendingGets).toHaveLength(2);
            mockShowConfirm.mockResolvedValue(true);
            getContainer()
                .querySelector<HTMLElement>(
                    '[data-bookmark-id="bm-a"] [data-bookmark-action="delete"]'
                )!
                .click();
            await vi.runAllTimersAsync();

            // The in-flight GET still lists A — it must not resurrect it.
            pendingGets[1]({ ok: true, json: async () => [bmA, bmB] });
            await vi.runAllTimersAsync();

            expect(
                getContainer().querySelectorAll('[data-testid="bookmark-card"]')
            ).toHaveLength(1);
            expect(getContainer().textContent).toContain('Synced B');
            expect(getContainer().textContent).not.toContain('Synced A');
        });

        it('does not move focus behind a dialog open for another delete', async () => {
            setupContainer();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => sampleBookmarks,
            } as any);

            await new BookmarksManager('en', 'signed-in').loadBookmarks();

            let resolveDelete!: (v: unknown) => void;
            global.fetch = vi.fn(
                () =>
                    new Promise(resolve => {
                        resolveDelete = resolve;
                    })
            ) as any;

            const delBtn = (id: string) =>
                getContainer().querySelector<HTMLElement>(
                    `[data-bookmark-id="${id}"] [data-bookmark-action="delete"]`
                )!;

            delBtn('bm-1').focus();
            delBtn('bm-1').click();
            await vi.runAllTimersAsync();

            // Open a second confirmation and hold it open with focus inside.
            const dialogBtn = document.createElement('button');
            document.body.appendChild(dialogBtn);
            let resolveConfirm!: (v: boolean) => void;
            mockShowConfirm.mockImplementationOnce(() => {
                dialogBtn.focus();
                return new Promise(resolve => {
                    resolveConfirm = resolve;
                });
            });
            delBtn('bm-2').click();
            await vi.runAllTimersAsync();
            expect(document.activeElement).toBe(dialogBtn);

            // bm-1's DELETE completes while the second dialog owns focus:
            // the re-render must not pull focus behind the dialog.
            resolveDelete({ ok: true });
            await vi.runAllTimersAsync();

            expect(document.activeElement).toBe(dialogBtn);
            expect(getContainer().textContent).not.toContain('Chapter 1');

            resolveConfirm(false);
            dialogBtn.remove();
            await vi.runAllTimersAsync();
        });

        it('keeps a loading surface for unavailable auth with no local cards', async () => {
            setupContainer();
            let resolveFetch!: (response: unknown) => void;
            global.fetch = vi.fn(
                () =>
                    new Promise(resolve => {
                        resolveFetch = resolve;
                    })
            );

            const manager = new BookmarksManager('en');
            const loading = manager.loadBookmarks();

            expect(getContainer().textContent).toContain('Loading...');

            resolveFetch({ ok: false, status: 500 });
            await loading;

            const container = getContainer();
            expect(container.textContent).toContain(
                'Failed to load bookmarks. Please try again.'
            );
            expect(container.textContent).not.toContain(
                'You must be logged in'
            );
        });

        it('keeps local cards when an unavailable cloud fetch fails', async () => {
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
            global.fetch = vi
                .fn()
                .mockResolvedValue({ ok: false, status: 500 } as any);

            const manager = new BookmarksManager('en', 'unavailable');
            await manager.loadBookmarks();

            const container = getContainer();
            expect(container.textContent).toContain('Local Save');
            expect(container.textContent).toContain(
                'Failed to load bookmarks. Please try again.'
            );
            expect(container.textContent).not.toContain(
                'You must be logged in'
            );
        });

        it('marks an unavailable visitor signed out only after a real 401', async () => {
            setupContainer();
            global.fetch = vi
                .fn()
                .mockResolvedValue({ ok: false, status: 401 } as any);

            const manager = new BookmarksManager('en', 'unavailable');
            await manager.loadBookmarks();

            expect(getContainer().textContent).toContain(
                'You must be logged in'
            );
        });

        it('does not offer cloud sync while the initial response is pending', async () => {
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
            let resolveFetch!: (response: unknown) => void;
            global.fetch = vi.fn(
                () =>
                    new Promise(resolve => {
                        resolveFetch = resolve;
                    })
            );

            const manager = new BookmarksManager('en', 'signed-in');
            const loading = manager.loadBookmarks();

            const buttons = [...getContainer().querySelectorAll('button')].map(
                button => button.textContent
            );
            expect(buttons).not.toContain('Sync to Cloud');
            expect(buttons).not.toContain('Sync All to Cloud');

            resolveFetch({ ok: true, json: vi.fn().mockResolvedValue([]) });
            await loading;

            expect(
                [...getContainer().querySelectorAll('button')].map(
                    button => button.textContent
                )
            ).toEqual(
                expect.arrayContaining(['Sync to Cloud', 'Sync All to Cloud'])
            );
        });

        it('keeps cloud loading through response parsing', async () => {
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
            let resolveJson!: (value: unknown) => void;
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn(
                    () =>
                        new Promise(resolve => {
                            resolveJson = resolve;
                        })
                ),
            } as any);

            const manager = new BookmarksManager('en', 'signed-in');
            const loading = manager.loadBookmarks();
            await Promise.resolve();

            const container = getContainer();
            expect(container.textContent).toContain('Loading...');
            expect(container.textContent).not.toContain('No bookmarks yet.');
            expect(
                [...container.querySelectorAll('button')].map(
                    button => button.textContent
                )
            ).not.toContain('Sync to Cloud');

            resolveJson([]);
            await loading;

            expect(container.textContent).toContain('No bookmarks yet.');
        });

        it('keeps signed-in local cards and omits the empty state on a 500', async () => {
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
            global.fetch = vi
                .fn()
                .mockResolvedValue({ ok: false, status: 500 } as any);

            const manager = new BookmarksManager('en', 'signed-in');
            await manager.loadBookmarks();

            const container = getContainer();
            expect(container.textContent).toContain('Local Save');
            expect(container.textContent).toContain(
                'Failed to load bookmarks. Please try again.'
            );
            expect(container.textContent).not.toContain('No bookmarks yet.');
            expect(container.textContent).not.toContain('Start Reading');
        });

        it('keeps signed-in local cards and omits the empty state on a network error', async () => {
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
            global.fetch = vi
                .fn()
                .mockRejectedValue(new Error('Network error'));

            const manager = new BookmarksManager('en', 'signed-in');
            await manager.loadBookmarks();

            const container = getContainer();
            expect(container.textContent).toContain('Local Save');
            expect(container.textContent).toContain(
                'Failed to load bookmarks. Please try again.'
            );
            expect(container.textContent).not.toContain('No bookmarks yet.');
            expect(container.textContent).not.toContain('Start Reading');
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

            it('renders error banner without not-logged-in CTA on non-401 error response', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'Failed to load bookmarks. Please try again.'
                );
                expect(container.textContent).not.toContain(
                    'You must be logged in'
                );
            });

            it('does not render login link on non-401 error (auth unknown)', async () => {
                setupContainer();
                global.fetch = vi.fn().mockResolvedValue({
                    ok: false,
                    status: 503,
                } as any);

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const loginLink = getContainer().querySelector(
                    'a[href="/en/login"]'
                );
                expect(loginLink).toBeNull();
            });
        });

        describe('network / fetch errors', () => {
            it('renders error banner without not-logged-in CTA when fetch throws', async () => {
                setupContainer();
                global.fetch = vi
                    .fn()
                    .mockRejectedValue(new Error('Network error'));

                const manager = new BookmarksManager('en');
                await manager.loadBookmarks();

                const container = getContainer();
                expect(container.textContent).toContain(
                    'Failed to load bookmarks. Please try again.'
                );
                expect(container.textContent).not.toContain(
                    'You must be logged in'
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

        it("moves focus to the card that took the deleted card's place", async () => {
            setupContainer();
            localStorageStore['aquila:bookmarks:en'] = JSON.stringify([
                {
                    id: 'local-1',
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    bookmarkName: 'First Save',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'local-2',
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    bookmarkName: 'Second Save',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ]);
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            } as any);

            const manager = new BookmarksManager('en');
            await manager.loadBookmarks();

            const firstDelete = getContainer().querySelector<HTMLElement>(
                '[data-bookmark-id="local-1"] [data-bookmark-action="delete"]'
            )!;
            firstDelete.focus();

            mockShowConfirm.mockResolvedValue(true);
            firstDelete.click();
            await vi.runAllTimersAsync();

            const nextDelete = getContainer().querySelector(
                '[data-bookmark-id="local-2"] [data-bookmark-action="delete"]'
            );
            expect(nextDelete).not.toBeNull();
            expect(document.activeElement).toBe(nextDelete);
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
