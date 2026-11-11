import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncStoryLoaderResult } from '@aquila/stories/async';
import { ReaderManager } from '../reader-manager';
import { readerState } from '../reader-state.svelte';
import type { AuthState } from '../auth-utils';
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

function setLocation(search: string): void {
    Object.defineProperty(window, 'location', {
        value: {
            search,
            href: `http://localhost:3000/en/reader${search}`,
            reload: vi.fn(),
        },
        writable: true,
        configurable: true,
    });
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

/** Lets the fire-and-forget push helpers and dynamic imports settle. */
async function flush(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}

describe('ReaderManager account progress sync', () => {
    let manager: ReaderManager | null = null;
    let loadStoryContent: ReturnType<typeof vi.fn>;

    function createManager(authState: AuthState): ReaderManager {
        return new ReaderManager('en', undefined, {
            authState,
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
        setLocation('');
        Object.defineProperty(window, 'history', {
            value: {
                pushState: vi.fn(),
                replaceState: vi.fn(),
            },
            writable: true,
            configurable: true,
        });
        loadStoryContent = vi.fn().mockResolvedValue(storyPayload());
        global.fetch = vi.fn();
    });

    afterEach(() => {
        manager?.destroy();
        manager = null;
        readerState.reset();
        document.body.replaceChildren();
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
        const response = deferred<Response>();
        const fetchMock = vi.fn(() => response.promise);
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

        // A response that arrives after the deadline cannot reposition the
        // already-started reader.
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
        await flush();
        expect(readerState).toMatchObject({
            currentSceneId: 'act1',
            dialogueIndex: 1,
        });
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
        manager = createManager('signed-in');
        await manager.initialize();
        await flush();
        fetchMock.mockClear();

        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(1);

        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden',
            writable: true,
            configurable: true,
        });
        window.dispatchEvent(new Event('pagehide'));
        await flush();
        expect(progressPosts(fetchMock)).toHaveLength(2);
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
});
