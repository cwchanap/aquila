// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncStoryLoaderResult } from '@aquila/stories/async';
import { ReaderManager } from '../reader-manager';
import { readerState } from '../reader-state.svelte';
import type { AuthState } from '../auth-utils';
import { authClient } from '../auth-client';
import type { StoryProgress } from '../story-progress';
import { StoryProgressStore, storyProgressKey } from '../story-progress-store';
import { readerSessionKey } from '../reader-session';

vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
    getTranslations: vi.fn(() => ({
        reader: {
            bookmarkPrompt: 'Save bookmark as:',
            defaultBookmarkName: 'Bookmark',
            bookmarkSaved: 'Bookmark saved!',
            bookmarkFailed: 'Failed to save bookmark',
            bookmarkError: 'Error saving bookmark',
            endOfStory: 'End of story reached',
            loadError: 'Failed to load reader',
            retry: 'Retry',
        },
        locale: 'en',
    })),
}));

const { mockMount, mockUnmount } = vi.hoisted(() => ({
    mockMount: vi.fn(() => ({})),
    mockUnmount: vi.fn(),
}));

vi.mock('svelte', () => ({
    mount: mockMount,
    unmount: mockUnmount,
}));

vi.mock('../ui-dialogs', () => ({
    showAlert: vi.fn().mockResolvedValue(undefined),
    showPrompt: vi.fn().mockResolvedValue('My Bookmark'),
}));

vi.mock('@/components/ReaderShell.svelte', () => ({
    default: class MockReaderShell {},
}));

// jsdom forbids redefining window.location; navigating through the real
// history API is the supported way to change the URL.
function setLocation(search: string): void {
    window.history.replaceState({}, '', `/en/reader${search}`);
    vi.mocked(window.history.replaceState).mockClear();
}

function mountReaderContainer(): void {
    const container = document.createElement('div');
    container.id = 'reader-container';
    document.body.appendChild(container);
}

function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length() {
            return data.size;
        },
        clear: () => data.clear(),
        getItem: key => data.get(key) ?? null,
        key: i => [...data.keys()][i] ?? null,
        removeItem: key => void data.delete(key),
        setItem: (key, value) => void data.set(key, String(value)),
    };
}

function storyPayload(): AsyncStoryLoaderResult {
    return {
        flow: {
            start: 'act1',
            nodes: [
                { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
                { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
            ],
        },
        dialogue: {
            act1: [{ dialogue: 'one' }, { dialogue: 'two' }],
            act2: [{ dialogue: 'three' }],
        },
        choices: {},
        locale: 'en',
        textLocale: 'en',
    };
}

function progressRecord(overrides: Partial<StoryProgress> = {}): StoryProgress {
    return {
        sceneId: 'act1',
        dialogueIndex: 0,
        updatedAt: 10,
        finished: false,
        endings: [],
        ...overrides,
    };
}

function saveProgress(
    map: Record<string, StoryProgress>,
    accountId: string | null = 'user-1'
): void {
    localStorage.setItem(storyProgressKey(accountId), JSON.stringify(map));
}

function readProgress(
    storyId: string,
    accountId: string | null = 'user-1'
): StoryProgress | null {
    return new StoryProgressStore(localStorage, Date.now, accountId).get(
        storyId
    );
}

function progressPosts(
    fetchMock: ReturnType<typeof vi.fn>
): Array<[string, RequestInit]> {
    return fetchMock.mock.calls.filter(
        ([url]) => url === '/api/progress'
    ) as Array<[string, RequestInit]>;
}

function serverResponse(progress: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ progress }),
    } as unknown as Response;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

/** A fetch that never answers but rejects on abort the way a real fetch
 *  does — plain hanging promises deadlock callers that pass a signal. */
function hangingFetch() {
    return vi.fn(
        (_url: unknown, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                const signal = init?.signal;
                if (signal?.aborted) {
                    reject(signal.reason);
                    return;
                }
                signal?.addEventListener('abort', () => reject(signal.reason));
            })
    );
}

/** Lets the fire-and-forget push helpers and dynamic imports settle. */
async function flush(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}

describe('ReaderManager account progress sync', () => {
    let manager: ReaderManager | null = null;
    let loadStoryContent: ReturnType<typeof vi.fn>;

    function createManager(
        authState: AuthState,
        userId: string | null = 'user-1'
    ): ReaderManager {
        return new ReaderManager('en', undefined, {
            authState,
            userId,
            loadStoryContent: loadStoryContent as (
                storyId: string,
                locale: string
            ) => Promise<AsyncStoryLoaderResult>,
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        readerState.reset();
        document.body.replaceChildren();
        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            writable: true,
            configurable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: memoryStorage(),
            writable: true,
            configurable: true,
        });
        // Spy but call through: the reader's URL sync should update the real
        // jsdom URL, and tests assert on call counts after setLocation clears
        // the history.
        vi.spyOn(window.history, 'replaceState');
        vi.spyOn(window.history, 'pushState');
        setLocation('');
        loadStoryContent = vi.fn().mockResolvedValue(storyPayload());
        global.fetch = vi.fn();
        // Session re-reads start signed-out; a test that wants recovery
        // stubs its own response.
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: null,
        } as never);
    });

    afterEach(() => {
        manager?.destroy();
        manager = null;
        readerState.reset();
        document.body.replaceChildren();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each(['signed-out', 'unavailable'] as const)(
        'reads locally without a progress request when auth is %s',
        async authState => {
            setLocation('?story=train_adventure');
            saveProgress(
                {
                    train_adventure: progressRecord({
                        sceneId: 'act1',
                        dialogueIndex: 1,
                    }),
                },
                null
            );
            mountReaderContainer();
            manager = createManager(authState);

            await manager.initialize();

            expect(readerState).toMatchObject({
                storyId: 'train_adventure',
                currentSceneId: 'act1',
                dialogueIndex: 1,
                loadStatus: 'ready',
            });
            window.dispatchEvent(new Event('pagehide'));
            await flush();
            expect(global.fetch).not.toHaveBeenCalled();
        }
    );

    it('waits for the signed-in cloud merge on a bare ?story link', async () => {
        setLocation('?story=train_adventure');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 10,
            }),
        });
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                train_adventure: progressRecord({
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    updatedAt: 20,
                    finished: true,
                    endings: ['act2'],
                }),
            })
        );
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');

        await manager.initialize();

        const posts = progressPosts(fetchMock);
        expect(posts).toHaveLength(1);
        expect(JSON.parse(posts[0][1].body as string)).toEqual({
            progress: {
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                    updatedAt: 10,
                }),
            },
            accountId: 'user-1',
        });
        expect(readerState).toMatchObject({
            storyId: 'train_adventure',
            currentSceneId: 'act2',
            dialogueIndex: 0,
            loadStatus: 'ready',
        });
        expect(readerState.dialogue).toEqual([{ dialogue: 'three' }]);
        expect(readProgress('train_adventure')).toMatchObject({
            sceneId: 'act2',
            finished: true,
            endings: ['act2'],
        });
    });

    it('starts from the local position when the startup sync fails', async () => {
        setLocation('?story=train_adventure');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 1,
            }),
        });
        global.fetch = vi.fn().mockResolvedValue(serverResponse({}, 500));
        mountReaderContainer();
        manager = createManager('signed-in');

        await manager.initialize();

        expect(readerState).toMatchObject({
            storyId: 'train_adventure',
            currentSceneId: 'act1',
            dialogueIndex: 1,
            loadStatus: 'ready',
        });
    });

    it.each([
        [
            'an explicit scene link',
            '?story=train_adventure&scene=act2&dialogue=1',
            { currentSceneId: 'act2', dialogueIndex: 0 },
        ],
        [
            'a restart link',
            '?story=train_adventure&restart=1',
            { currentSceneId: 'act1', dialogueIndex: 0 },
        ],
        ['a bare reader URL', '', { currentSceneId: 'act1', dialogueIndex: 0 }],
    ] as const)(
        'starts immediately without a startup wait for %s',
        async (_label, search, expected) => {
            setLocation(search);
            saveProgress({
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 1,
                }),
            });
            // A startup wait would hang forever on this request.
            global.fetch = vi.fn(() => new Promise<Response>(() => {}));
            mountReaderContainer();
            manager = createManager('signed-in');

            await manager.initialize();

            expect(readerState).toMatchObject({
                ...expected,
                loadStatus: 'ready',
            });
        }
    );

    it('falls back to the local position after the 1,500 ms startup bound', async () => {
        setLocation('?story=train_adventure');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 1,
            }),
        });
        const fetchMock = hangingFetch();
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');

        const initializing = manager.initialize();
        await flush();
        expect(global.fetch).toHaveBeenCalled();
        expect(readerState.hasActivePayload).toBe(false);

        await vi.advanceTimersByTimeAsync(1_400);
        expect(readerState.hasActivePayload).toBe(false);
        await vi.advanceTimersByTimeAsync(100);
        await initializing;

        expect(readerState).toMatchObject({
            storyId: 'train_adventure',
            currentSceneId: 'act1',
            dialogueIndex: 1,
            loadStatus: 'ready',
        });
        // The aborted request is discarded: the local copy stays in the
        // store until a later sync reconciles it against the account.
        await flush();
        expect(readProgress('train_adventure')).toMatchObject({
            sceneId: 'act1',
            dialogueIndex: 1,
        });
    });

    it('pushes at most once per minute from the leading edge, counting the initial sync', async () => {
        setLocation('?story=train_adventure');
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');

        await manager.initialize();
        expect(progressPosts(fetchMock)).toHaveLength(1);

        manager.goToScene('act2');
        expect(progressPosts(fetchMock)).toHaveLength(1);

        vi.advanceTimersByTime(59_000);
        manager.goToScene('act1');
        expect(progressPosts(fetchMock)).toHaveLength(1);

        vi.advanceTimersByTime(1_000);
        manager.goToScene('act2');
        expect(progressPosts(fetchMock)).toHaveLength(2);
    });

    it('flushes local progress then one deduplicated keepalive request on hide', async () => {
        setLocation('?story=train_adventure&scene=act1');
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');
        await manager.initialize();
        manager.goToScene('act2');
        await flush();
        fetchMock.mockClear();

        window.dispatchEvent(new Event('pagehide'));
        await flush();

        const posts = progressPosts(fetchMock);
        expect(posts).toHaveLength(1);
        expect(posts[0][1]).toMatchObject({ keepalive: true });
        expect(JSON.parse(posts[0][1].body as string)).toEqual({
            progress: {
                train_adventure: expect.objectContaining({
                    sceneId: 'act2',
                    dialogueIndex: 0,
                }),
            },
            accountId: 'user-1',
        });
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', 'user-1')) ?? ''
            )
        ).toMatchObject({ storyId: 'train_adventure', sceneId: 'act2' });

        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden',
            writable: true,
            configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(1);
    });

    it('does not re-stamp an unchanged position on the hide flush', async () => {
        setLocation('?story=train_adventure&scene=act1&dialogue=1');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 10,
                visited: ['act1'],
            }),
        });
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        // Past the minute throttle so the mount-time ordinary push definitely
        // fires and marks the account copy current.
        await vi.advanceTimersByTimeAsync(60_001);
        manager = createManager('signed-in');
        await manager.initialize();
        await flush();
        fetchMock.mockClear();

        window.dispatchEvent(new Event('pagehide'));
        await flush();

        // A stale updatedAt here would win the server's timestamp merge over
        // a newer position recorded on another device.
        expect(readProgress('train_adventure')).toMatchObject({
            sceneId: 'act1',
            dialogueIndex: 0,
            updatedAt: 10,
        });
        // And nothing changed since the mount-time upload, so the hide
        // flush makes no request at all.
        expect(progressPosts(fetchMock)).toHaveLength(0);
    });

    it('records a restored position the store does not already hold', async () => {
        setLocation('?story=train_adventure&scene=act2');
        // The restored position differs from everything in the store, so the
        // persist that follows applySession must write it — the unchanged
        // guard must not suppress that first write.
        saveProgress({
            the_seventh_mirror: progressRecord({
                sceneId: 'ch1',
                dialogueIndex: 2,
            }),
        });
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');
        await manager.initialize();
        await flush();

        window.dispatchEvent(new Event('pagehide'));
        await flush();

        expect(readProgress('train_adventure')).toMatchObject({
            sceneId: 'act2',
            dialogueIndex: 0,
        });
    });

    it('sends one keepalive even while an ordinary push is in flight, deduplicated', async () => {
        setLocation('?story=train_adventure&scene=act1');
        global.fetch = vi.fn(() => new Promise<Response>(() => {}));
        mountReaderContainer();
        manager = createManager('signed-in');
        await manager.initialize();
        expect(progressPosts(vi.mocked(global.fetch))).toHaveLength(1);

        window.dispatchEvent(new Event('pagehide'));
        await flush();
        const posts = progressPosts(vi.mocked(global.fetch));
        expect(posts).toHaveLength(2);
        expect(posts[1][1]).toMatchObject({ keepalive: true });

        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(vi.mocked(global.fetch))).toHaveLength(2);
    });

    it('re-arms the hide flush when the tab becomes visible again', async () => {
        setLocation('?story=train_adventure&scene=act1');
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        // Past the minute throttle so the mount-time ordinary push fires
        // and stamps lastPushAt — that keeps the scene changes below inside
        // the window, so every request here is a keepalive.
        await vi.advanceTimersByTimeAsync(60_001);
        manager = createManager('signed-in');
        await manager.initialize();
        await flush();
        fetchMock.mockClear();

        // Each hide sends only when something new waits to upload.
        manager.goToScene('act2');
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        const first = progressPosts(fetchMock);
        expect(first).toHaveLength(1);
        expect(first[0][1]).toMatchObject({ keepalive: true });

        document.dispatchEvent(new Event('visibilitychange'));
        manager.goToScene('act1');
        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden',
            writable: true,
            configurable: true,
        });
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        const second = progressPosts(fetchMock);
        expect(second).toHaveLength(2);
        expect(second[1][1]).toMatchObject({ keepalive: true });
    });

    it('keeps a line read while the startup sync is in flight', async () => {
        setLocation('?story=train_adventure');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 0,
            }),
        });
        const response = deferred<Response>();
        const fetchMock = vi.fn(() => response.promise);
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');

        const initializing = manager.initialize();
        await flush();
        expect(global.fetch).toHaveBeenCalled();

        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act2',
                dialogueIndex: 0,
                updatedAt: 40,
                finished: true,
                endings: ['act2'],
                visited: ['act1', 'act2'],
            }),
        });
        response.resolve(
            serverResponse({
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                    updatedAt: 20,
                }),
            })
        );
        await initializing;

        expect(readerState).toMatchObject({
            storyId: 'train_adventure',
            currentSceneId: 'act2',
            dialogueIndex: 0,
            loadStatus: 'ready',
        });
        expect(readProgress('train_adventure')).toMatchObject({
            sceneId: 'act2',
            finished: true,
            endings: ['act2'],
            visited: ['act1', 'act2'],
        });
    });

    it('tears down lifecycle listeners and ignores a late startup response', async () => {
        setLocation('?story=train_adventure');
        const response = deferred<Response>();
        const fetchMock = vi.fn(() => response.promise);
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');

        const initializing = manager.initialize();
        await flush();
        expect(global.fetch).toHaveBeenCalledOnce();

        manager.destroy();
        response.resolve(
            serverResponse({
                train_adventure: progressRecord({
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    updatedAt: 100,
                    finished: true,
                    endings: ['act2'],
                }),
            })
        );
        await initializing;

        expect(readerState.hasActivePayload).toBe(false);
        expect(window.history.replaceState).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(global.fetch).toHaveBeenCalledOnce();
    });

    it('recovers sync for the visit when an unavailable SSR session re-reads as signed-in', async () => {
        setLocation('?story=train_adventure&scene=act1');
        const banner = document.createElement('div');
        banner.id = 'auth-degraded-banner';
        document.body.appendChild(banner);
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: { user: { id: 'user-9' } },
            error: null,
        } as never);
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('unavailable', null);

        await manager.initialize();
        await flush();

        // The rechecked session enables pushes for the rest of the visit
        // and dismisses the SSR degraded banner.
        expect(document.getElementById('auth-degraded-banner')).toBeNull();
        manager.goToScene('act2');
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(1);
    });

    it('does not queue a second POST behind a timed-out startup sync', async () => {
        setLocation('?story=train_adventure');
        global.fetch = hangingFetch();
        mountReaderContainer();
        manager = createManager('signed-in');

        const initializing = manager.initialize();
        await vi.advanceTimersByTimeAsync(1_500);
        await initializing;

        // The persist inside loadIntent must see the attempt's throttle
        // stamp — the hung request may still hold the server lock.
        expect(progressPosts(vi.mocked(global.fetch))).toHaveLength(1);
    });

    it('keeps another account key intact when signing in and opening an explicit scene', async () => {
        setLocation('?story=train_adventure&scene=act2');
        saveProgress(
            {
                the_seventh_mirror: progressRecord({
                    sceneId: 'ch1_act1',
                    dialogueIndex: 2,
                    updatedAt: 10,
                }),
            },
            'user-a'
        );
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-b');

        await manager.initialize();
        await flush();

        expect(readProgress('train_adventure', 'user-b')).toMatchObject({
            sceneId: 'act2',
            dialogueIndex: 0,
        });
        expect(readProgress('the_seventh_mirror', 'user-a')).toMatchObject({
            sceneId: 'ch1_act1',
            dialogueIndex: 2,
        });
        const posts = progressPosts(fetchMock);
        expect(posts.length).toBeGreaterThan(0);
        expect(JSON.parse(posts[0][1].body as string).progress).toHaveProperty(
            'train_adventure'
        );
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', 'user-b')) ?? 'null'
            )
        ).toMatchObject({ storyId: 'train_adventure', sceneId: 'act2' });
    });

    it('makes no keepalive request when the account copy already covers the local map', async () => {
        setLocation('?story=train_adventure');
        saveProgress({
            train_adventure: progressRecord({
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 10,
            }),
        });
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in');
        await manager.initialize();
        expect(progressPosts(fetchMock)).toHaveLength(1);
        fetchMock.mockClear();

        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(0);
    });

    it('revalidates the account when the tab becomes visible or resumes from bfcache', async () => {
        setLocation('?story=train_adventure&scene=act1');
        saveProgress(
            {
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                }),
            },
            'user-a'
        );
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-a');
        await manager.initialize();
        await flush();
        expect(authClient.getSession).not.toHaveBeenCalled();

        // The session moved to account B while the tab sat in the background.
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: { user: { id: 'user-b' } },
            error: null,
        } as never);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(authClient.getSession).toHaveBeenCalledTimes(1);

        // Non-persisted pageshow does not revalidate; persisted (bfcache) does
        // once the prior check settled.
        window.dispatchEvent(new Event('pageshow'));
        await flush();
        expect(authClient.getSession).toHaveBeenCalledTimes(1);
        window.dispatchEvent(
            Object.assign(new Event('pageshow'), { persisted: true })
        );
        await flush();
        expect(authClient.getSession).toHaveBeenCalledTimes(2);

        // Next record writes to user-b's isolated key, keeping user-a intact.
        manager.goToScene('act2');
        await flush();
        expect(readProgress('train_adventure', 'user-b')).toMatchObject({
            sceneId: 'act2',
        });
        expect(readProgress('train_adventure', 'user-a')).toMatchObject({
            sceneId: 'act1',
        });
    });

    it('makes no getSession request on focus or bfcache restore when signed-out', async () => {
        setLocation('?story=train_adventure&scene=act1');
        mountReaderContainer();
        manager = createManager('signed-out', null);
        await manager.initialize();
        await flush();

        window.dispatchEvent(
            Object.assign(new Event('pageshow'), { persisted: true })
        );
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();

        expect(authClient.getSession).not.toHaveBeenCalled();
    });

    it('coalesces rapid bfcache pageshow and visibilitychange events into one getSession call', async () => {
        setLocation('?story=train_adventure&scene=act1');
        const pending = deferred<unknown>();
        vi.mocked(authClient.getSession).mockImplementation(
            () => pending.promise as never
        );
        mountReaderContainer();
        manager = createManager('signed-in', 'user-a');
        await manager.initialize();
        await flush();

        window.dispatchEvent(
            Object.assign(new Event('pageshow'), { persisted: true })
        );
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();

        expect(authClient.getSession).toHaveBeenCalledTimes(1);
        pending.resolve({ data: { user: { id: 'user-a' } }, error: null });
        await flush();
    });

    it('applies only the newest session reply when delayed revalidations overlap', async () => {
        setLocation('?story=train_adventure&scene=act1');
        saveProgress(
            {
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                }),
            },
            'user-a'
        );
        const first = deferred<unknown>();
        const second = deferred<unknown>();
        vi.mocked(authClient.getSession)
            .mockImplementationOnce(() => first.promise as never)
            .mockImplementationOnce(() => second.promise as never);
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-a');
        await manager.initialize();
        await flush();

        window.dispatchEvent(
            Object.assign(new Event('pageshow'), { persisted: true })
        );
        // After the 5s coalescing window, a second slow revalidation goes out.
        await vi.advanceTimersByTimeAsync(5_000);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(authClient.getSession).toHaveBeenCalledTimes(2);

        // Newer answer resolves first; delayed A reply must not revert user-b.
        second.resolve({ data: { user: { id: 'user-b' } }, error: null });
        await flush();
        first.resolve({ data: { user: { id: 'user-a' } }, error: null });
        await flush();

        await vi.advanceTimersByTimeAsync(60_001);
        manager.goToScene('act2');
        await flush();
        const posts = progressPosts(fetchMock);
        expect(posts.length).toBeGreaterThan(0);
        expect(
            JSON.parse(posts[posts.length - 1][1].body as string).accountId
        ).toBe('user-b');
        expect(readProgress('train_adventure', 'user-b')).toMatchObject({
            sceneId: 'act2',
        });
    });

    it('resumes each signed-in account from its own isolated map and session', async () => {
        setLocation('');
        saveProgress(
            {
                elevator_game: progressRecord({
                    sceneId: 'b2_act4',
                    dialogueIndex: 3,
                    updatedAt: 50,
                }),
            },
            'user-a'
        );
        localStorage.setItem(
            readerSessionKey('en', 'user-a'),
            JSON.stringify({
                storyId: 'elevator_game',
                sceneId: 'b2_act4',
                dialogueIndex: 3,
                locale: 'en',
                version: 2,
            })
        );
        global.fetch = vi.fn(async () => serverResponse({}));
        mountReaderContainer();
        manager = createManager('signed-in', 'user-b');
        await manager.initialize();
        await flush();

        // User B does not resume User A's elevator_game session.
        expect(readerState.storyId).toBe('the_seventh_mirror');
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', 'user-b')) ?? 'null'
            )
        ).toMatchObject({ storyId: 'the_seventh_mirror' });
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', 'user-a')) ?? 'null'
            )
        ).toMatchObject({ storyId: 'elevator_game', sceneId: 'b2_act4' });
        expect(readProgress('elevator_game', 'user-a')).toMatchObject({
            sceneId: 'b2_act4',
        });
    });

    it('still saves the reader session when writing the progress map fails', async () => {
        setLocation('?story=train_adventure&scene=act1');
        const accountProgressKey = storyProgressKey('user-1');
        const origSetItem = Storage.prototype.setItem;
        const setSpy = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(function (
                this: Storage,
                key: string,
                value: string
            ) {
                if (key === accountProgressKey) {
                    throw new Error('QuotaExceededError');
                }
                origSetItem.call(this, key, value);
            });
        global.fetch = vi.fn(async () => serverResponse({}));
        mountReaderContainer();
        try {
            manager = createManager('signed-in', 'user-1');
            await manager.initialize();
            manager.goToScene('act2');
            await flush();

            expect(
                JSON.parse(
                    localStorage.getItem(readerSessionKey('en', 'user-1')) ??
                        'null'
                )
            ).toMatchObject({ storyId: 'train_adventure', sceneId: 'act2' });
        } finally {
            setSpy.mockRestore();
        }
    });

    it('keeps saving to anonymous keys while auth is unavailable without touching another account', async () => {
        setLocation('?story=train_adventure&scene=act1');
        saveProgress(
            {
                the_seventh_mirror: progressRecord({
                    sceneId: 'ch4_act1',
                    dialogueIndex: 2,
                    updatedAt: 50,
                }),
            },
            'user-a'
        );
        vi.mocked(authClient.getSession).mockRejectedValue(
            new Error('auth outage')
        );
        mountReaderContainer();
        manager = createManager('unavailable', null);
        await manager.initialize();
        await flush();

        manager.goToScene('act2');
        await flush();

        expect(readProgress('train_adventure', null)).toMatchObject({
            sceneId: 'act2',
        });
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', null)) ?? 'null'
            )
        ).toMatchObject({ storyId: 'train_adventure', sceneId: 'act2' });
        // User A's map stays untouched and no account sync was sent.
        expect(readProgress('the_seventh_mirror', 'user-a')).toMatchObject({
            sceneId: 'ch4_act1',
        });
        expect(readProgress('train_adventure', 'user-a')).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not write the displayed position into a switched account on lifecycle flush', async () => {
        setLocation('?story=train_adventure&scene=act1');
        saveProgress(
            {
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                }),
            },
            'user-a'
        );
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-a');
        await manager.initialize();
        await flush();

        // Another tab signs into account B; this tab's reader still shows
        // A's restored position and the user never navigates.
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: { user: { id: 'user-b' } },
            error: null,
        } as never);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();

        // Closing the reader flushes the unchanged position.
        window.dispatchEvent(new Event('pagehide'));
        await flush();

        // B's map and session key must not gain A's position, and no
        // upload may carry it under B's account.
        expect(readProgress('train_adventure', 'user-b')).toBeNull();
        expect(
            localStorage.getItem(readerSessionKey('en', 'user-b'))
        ).toBeNull();
        for (const [, init] of progressPosts(fetchMock)) {
            const body = JSON.parse(init.body as string);
            if (body.accountId === 'user-b') {
                expect(body.progress).not.toHaveProperty('train_adventure');
            }
        }
        expect(readProgress('train_adventure', 'user-a')).toMatchObject({
            sceneId: 'act1',
        });

        // The guard is not a deadlock: real navigation still records
        // under the account that is signed in now.
        manager.goToScene('act2');
        await flush();
        expect(readProgress('train_adventure', 'user-b')).toMatchObject({
            sceneId: 'act2',
        });
    });

    it('records a history-navigated position under the switched-to account', async () => {
        setLocation('?story=train_adventure&scene=act1');
        saveProgress(
            {
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 0,
                }),
            },
            'user-a'
        );
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-a');
        await manager.initialize();
        await flush();

        // A second history entry so Back has somewhere to land.
        manager.goToScene('act2');
        await flush();

        // Another tab signs into account B; this tab's session is still
        // bound to A.
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: { user: { id: 'user-b' } },
            error: null,
        } as never);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();

        // Back lands on a destination B's map does not hold: the
        // user-driven position rebinds to B and must be saved. Past the
        // minute throttle so the flush that follows also uploads.
        await vi.advanceTimersByTimeAsync(60_001);
        setLocation('?story=train_adventure&scene=act1');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flush();

        expect(readProgress('train_adventure', 'user-b')).toMatchObject({
            sceneId: 'act1',
            dialogueIndex: 0,
        });
        expect(
            JSON.parse(
                localStorage.getItem(readerSessionKey('en', 'user-b')) ?? 'null'
            )
        ).toMatchObject({ storyId: 'train_adventure', sceneId: 'act1' });
        // The switched-to account's next upload carries the position.
        const posted = progressPosts(fetchMock).some(([, init]) => {
            const body = JSON.parse(init.body as string);
            return (
                body.accountId === 'user-b' &&
                body.progress?.train_adventure?.sceneId === 'act1'
            );
        });
        expect(posted).toBe(true);
        // A's map is untouched by the switch.
        expect(readProgress('train_adventure', 'user-a')).toMatchObject({
            sceneId: 'act2',
        });
    });
});
