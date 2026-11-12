// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncStoryLoaderResult } from '@aquila/stories/async';
import { ReaderManager } from '../reader-manager';
import { readerState } from '../reader-state.svelte';
import type { AuthState } from '../auth-utils';
import { authClient } from '../auth-client';
import type { StoryProgress } from '../story-progress';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
} from '../story-progress-store';
import { READER_SESSION_KEY_PREFIX } from '../reader-session';

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

function saveProgress(map: Record<string, StoryProgress>): void {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(map));
}

function readProgress(storyId: string): StoryProgress | null {
    return new StoryProgressStore(localStorage).get(storyId);
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

/** AbortSignal.timeout ignores fake timers; run it on the fake clock so a
 *  timeout fires inside an advanceTimersByTime window. */
function fakeAbortSignalTimeout(): void {
    class FakeSignal extends EventTarget {
        aborted = false;
        reason: unknown;
        static timeout(ms: number): FakeSignal {
            const signal = new FakeSignal();
            setTimeout(() => {
                signal.aborted = true;
                signal.reason = new DOMException(
                    'The operation timed out.',
                    'TimeoutError'
                );
                signal.dispatchEvent(new Event('abort'));
            }, ms);
            return signal;
        }
    }
    vi.stubGlobal('AbortSignal', FakeSignal);
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
            saveProgress({
                train_adventure: progressRecord({
                    sceneId: 'act1',
                    dialogueIndex: 1,
                }),
            });
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
        fakeAbortSignalTimeout();
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
                localStorage.getItem(`${READER_SESSION_KEY_PREFIX}:en`) ?? ''
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
        fakeAbortSignalTimeout();
        mountReaderContainer();
        manager = createManager('signed-in');

        const initializing = manager.initialize();
        await vi.advanceTimersByTimeAsync(1_500);
        await initializing;

        // The persist inside loadIntent must see the attempt's throttle
        // stamp — the hung request may still hold the server lock.
        expect(progressPosts(vi.mocked(global.fetch))).toHaveLength(1);
    });

    it('quarantines a foreign-owned map before the first signed-in record', async () => {
        // B signs in on a browser whose progress is still tagged for A and
        // opens an explicit scene link — no startup sync runs, so the first
        // record must not write into A's map for a later replaceAll to lose.
        setLocation('?story=train_adventure&scene=act2');
        saveProgress({
            the_seventh_mirror: progressRecord({
                sceneId: 'ch1_act1',
                dialogueIndex: 2,
                updatedAt: 10,
            }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        const fetchMock = vi.fn(async () => serverResponse({}));
        global.fetch = fetchMock;
        mountReaderContainer();
        manager = createManager('signed-in', 'user-b');

        await manager.initialize();
        await flush();

        const stored = new StoryProgressStore(localStorage).getAll();
        expect(Object.keys(stored)).toEqual(['train_adventure']);
        expect(stored.train_adventure).toMatchObject({
            sceneId: 'act2',
            dialogueIndex: 0,
        });
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
        // The quarantined record then uploads as this account's own map —
        // not as an empty download that would drop it.
        const posts = progressPosts(fetchMock);
        expect(posts.length).toBeGreaterThan(0);
        expect(JSON.parse(posts[0][1].body as string).progress).toHaveProperty(
            'train_adventure'
        );
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

        // The merged position matches the store, so nothing new is waiting
        // to upload — the hide flush sends nothing.
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(0);
    });
});
