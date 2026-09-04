import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncStoryLoaderResult } from '@aquila/stories/async';
import { StoryLoadError } from '@aquila/stories/async';
import { ReaderManager } from '../reader-manager';
import { readerState } from '../reader-state.svelte';

const { mockMount, mockUnmount } = vi.hoisted(() => ({
    mockMount: vi.fn(() => ({})),
    mockUnmount: vi.fn(),
}));

vi.mock('svelte', () => ({
    mount: mockMount,
    unmount: mockUnmount,
}));

vi.mock('@aquila/stories/translations', () => ({
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
    })),
}));

vi.mock('../ui-dialogs', () => ({
    showAlert: vi.fn().mockResolvedValue(undefined),
    showPrompt: vi.fn().mockResolvedValue(null),
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function storyPayload(): AsyncStoryLoaderResult {
    return {
        flow: {
            start: 'act1',
            nodes: [{ kind: 'scene', id: 'act1', sceneId: 'act1', next: null }],
        },
        dialogue: { act1: [{ dialogue: 'line' }] },
        choices: {},
        locale: 'en',
    };
}

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

function shellModule(): typeof import('@/components/ReaderShell.svelte') {
    return {
        default: class MockReaderShell {},
    } as unknown as typeof import('@/components/ReaderShell.svelte');
}

describe('ReaderManager defensive coverage', () => {
    let manager: ReaderManager | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        readerState.reset();
        document.body.replaceChildren();
        setLocation('');
        Object.defineProperty(window, 'history', {
            value: {
                pushState: vi.fn(),
                replaceState: vi.fn(),
            },
            writable: true,
            configurable: true,
        });
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn().mockReturnValue(null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
            },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        manager?.destroy();
        manager = null;
        readerState.reset();
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('ignores a load request whose generation is already stale', async () => {
        manager = new ReaderManager('en');
        (manager as unknown as { loadGeneration: number }).loadGeneration = 2;

        await (
            manager as unknown as {
                loadIntent: (
                    selection: {
                        kind: 'unknown-story';
                        storyId: string;
                        locale: 'en';
                    },
                    phase: 'initial',
                    generation: number
                ) => Promise<void>;
            }
        ).loadIntent(
            { kind: 'unknown-story', storyId: 'missing', locale: 'en' },
            'initial',
            1
        );

        expect(readerState.loadStatus).toBe('idle');
        expect(readerState.loadError).toBeNull();
    });

    it('unmounts when teardown is triggered synchronously during mount', async () => {
        mountReaderContainer();
        manager = new ReaderManager('en', undefined, {
            loadReaderShell: async () => shellModule(),
        });
        mockMount.mockImplementationOnce(() => {
            manager?.destroy();
            return {};
        });

        await manager.renderReader();

        expect(mockUnmount).toHaveBeenCalledOnce();
        expect(
            (manager as unknown as { readerInstance: unknown }).readerInstance
        ).toBeNull();
    });

    it('logs unexpected popstate load failures at the event boundary', async () => {
        const unexpected = new Error('unexpected import failure');
        const loadStoryContent = vi
            .fn()
            .mockResolvedValueOnce(storyPayload())
            .mockRejectedValueOnce(unexpected);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mountReaderContainer();
        manager = new ReaderManager('en', undefined, {
            loadReaderShell: async () => shellModule(),
            loadStoryContent,
        });
        await manager.initialize();

        setLocation('?story=train_adventure&scene=act1');
        window.dispatchEvent(new PopStateEvent('popstate'));

        await vi.waitFor(() =>
            expect(errorSpy).toHaveBeenCalledWith(
                'Reader popstate load failed',
                unexpected
            )
        );
        expect(readerState.storyId).toBe('the_seventh_mirror');
    });

    it('ignores a rejected replacement after a newer popstate supersedes it', async () => {
        const midnightLoad = deferred<AsyncStoryLoaderResult>();
        const loadStoryContent = vi.fn((storyId: string) => {
            if (storyId === 'dont_save_me_before_midnight') {
                return midnightLoad.promise;
            }
            return Promise.resolve(storyPayload());
        });
        mountReaderContainer();
        manager = new ReaderManager('en', undefined, {
            loadReaderShell: async () => shellModule(),
            loadStoryContent,
        });
        await manager.initialize();

        setLocation('?story=dont_save_me_before_midnight&scene=act1');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await vi.waitFor(() =>
            expect(loadStoryContent).toHaveBeenCalledTimes(2)
        );

        setLocation('?story=train_adventure&scene=act1');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await vi.waitFor(() => expect(readerState.loadStatus).toBe('ready'));

        midnightLoad.reject(
            new StoryLoadError('load-failed', 'stale replacement failed')
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(readerState.storyId).toBe('train_adventure');
        expect(readerState.loadStatus).toBe('ready');
        expect(readerState.loadError).toBeNull();
    });
});
