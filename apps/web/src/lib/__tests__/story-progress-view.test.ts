// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '../auth-client';
import { StoryProgressView } from '../story-progress-view.svelte';
import { storyProgressKey } from '../story-progress-store';

const restoredPageShow = () =>
    Object.assign(new Event('pageshow'), { persisted: true });

const taskTurn = () => vi.advanceTimersByTimeAsync(0);

function serverResponse(payload: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => payload,
    } as Response;
}

describe('StoryProgressView', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(authClient.getSession).mockReset();
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: null,
        } as never);
    });

    it("keeps each mounted instance's account and progress independent", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    elevator_game: {
                        sceneId: 'b1a_act4',
                        dialogueIndex: 9,
                        updatedAt: 30,
                        finished: true,
                        endings: ['b1a_act4'],
                    },
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);
        localStorage.setItem(
            storyProgressKey(null),
            JSON.stringify({
                train_adventure: {
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    updatedAt: 5,
                    finished: false,
                    endings: [],
                },
            })
        );

        const signedOut = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const signedIn = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const disposeOut = signedOut.mount();
        const disposeIn = signedIn.mount();
        try {
            await taskTurn();

            expect(signedOut.authState).toBe('signed-out');
            expect(signedIn.authState).toBe('signed-in');
            expect(signedOut.userId).toBeNull();
            expect(signedIn.userId).toBe('user-1');
            expect(signedIn.syncState).toBe('synced');
            expect(signedOut.syncState).toBe('idle');
            expect(fetchMock).toHaveBeenCalledTimes(1);

            expect(signedOut.progress).toHaveProperty('train_adventure');
            expect(signedOut.progress).not.toHaveProperty('elevator_game');
            expect(signedIn.progress).toHaveProperty('elevator_game');
            expect(signedIn.progress).toHaveProperty('train_adventure');
        } finally {
            disposeOut();
            disposeIn();
            vi.unstubAllGlobals();
        }
    });

    it('flags an unreadable local map for a signed-out visitor instead of reporting empty progress', () => {
        const original = Storage.prototype.getItem;
        const getSpy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(function (this: Storage, key: string) {
                if (key === storyProgressKey(null)) {
                    throw new DOMException('denied', 'SecurityError');
                }
                return original.call(this, key);
            });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const dispose = view.mount();
        try {
            expect(view.localReadFailed).toBe(true);
            expect(view.progress).toEqual({});
            expect(fetchMock).not.toHaveBeenCalled();
            expect(
                original.call(localStorage, storyProgressKey(null))
            ).toBeNull();
        } finally {
            dispose();
            getSpy.mockRestore();
            vi.unstubAllGlobals();
        }
    });

    it('flags malformed persisted JSON and never overwrites or clears it', () => {
        localStorage.setItem(storyProgressKey(null), '{broken');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const dispose = view.mount();
        try {
            expect(view.localReadFailed).toBe(true);
            expect(view.progress).toEqual({});
            expect(fetchMock).not.toHaveBeenCalled();
            expect(localStorage.getItem(storyProgressKey(null))).toBe(
                '{broken'
            );
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('flags the read failure for an unavailable-auth visit too', async () => {
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: { message: 'down' },
        } as never);
        localStorage.setItem(storyProgressKey(null), '{broken');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'unavailable',
            userId: null,
        });
        const dispose = view.mount();
        try {
            await taskTurn();
            expect(view.authState).toBe('unavailable');
            expect(view.localReadFailed).toBe(true);
            expect(view.progress).toEqual({});
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it("never shows the previous account's progress when the new account's map cannot be read", async () => {
        localStorage.setItem(storyProgressKey('user-2'), '{broken');
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    train_adventure: {
                        sceneId: 'act2',
                        dialogueIndex: 0,
                        updatedAt: 5,
                        finished: false,
                        endings: [],
                    },
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const dispose = view.mount();
        try {
            await taskTurn();
            expect(view.progress).toHaveProperty('train_adventure');

            vi.mocked(authClient.getSession).mockResolvedValue({
                data: { user: { id: 'user-2' } },
                error: null,
            } as never);
            window.dispatchEvent(restoredPageShow());
            await taskTurn();

            expect(view.userId).toBe('user-2');
            expect(view.localReadFailed).toBe(true);
            expect(view.progress).toEqual({});
            expect(view.progress).not.toHaveProperty('train_adventure');
            expect(localStorage.getItem(storyProgressKey('user-2'))).toBe(
                '{broken'
            );
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('recovers when a later refresh can read the map again', async () => {
        localStorage.setItem(storyProgressKey(null), '{broken');
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const dispose = view.mount();
        try {
            expect(view.localReadFailed).toBe(true);

            localStorage.setItem(
                storyProgressKey(null),
                JSON.stringify({
                    train_adventure: {
                        sceneId: 'act2',
                        dialogueIndex: 0,
                        updatedAt: 5,
                        finished: false,
                        endings: [],
                    },
                })
            );
            window.dispatchEvent(restoredPageShow());
            await taskTurn();

            expect(view.localReadFailed).toBe(false);
            expect(view.progress).toHaveProperty('train_adventure');
        } finally {
            dispose();
        }
    });

    it('reports failure instead of a stale synced when a restore cannot re-read the session', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const dispose = view.mount();
        try {
            await taskTurn();
            expect(view.syncState).toBe('synced');

            vi.mocked(authClient.getSession).mockResolvedValue({
                data: null,
                error: { message: 'down' },
            } as never);
            window.dispatchEvent(restoredPageShow());
            await taskTurn();

            expect(view.syncState).toBe('failed');
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('does not let a sync that began before a restore reinstate a stale synced', async () => {
        let resolveFirst!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFirst = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const dispose = view.mount();
        try {
            // The mount request is still in flight when the restore's
            // session re-read fails, so the failure owns the status.
            vi.mocked(authClient.getSession).mockResolvedValue({
                data: null,
                error: { message: 'down' },
            } as never);
            window.dispatchEvent(restoredPageShow());
            await taskTurn();
            expect(view.syncState).toBe('failed');

            resolveFirst(serverResponse({ progress: {} }));
            await taskTurn();
            expect(view.syncState).toBe('failed');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('stops answering restores once unmounted', async () => {
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const dispose = view.mount();

        window.dispatchEvent(restoredPageShow());
        await taskTurn();
        expect(vi.mocked(authClient.getSession)).toHaveBeenCalledTimes(1);

        dispose();
        window.dispatchEvent(restoredPageShow());
        await taskTurn();
        expect(vi.mocked(authClient.getSession)).toHaveBeenCalledTimes(1);
    });

    it('recovers from a failed restore session check on retry and online', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const dispose = view.mount();
        try {
            await taskTurn();
            expect(view.syncState).toBe('synced');

            vi.mocked(authClient.getSession).mockResolvedValueOnce({
                data: null,
                error: { message: 'offline' },
            } as never);
            window.dispatchEvent(restoredPageShow());
            await taskTurn();
            expect(view.syncState).toBe('failed');

            vi.mocked(authClient.getSession).mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            } as never);
            window.dispatchEvent(new Event('online'));
            await taskTurn();
            expect(view.syncState).toBe('synced');
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('revalidates a retained signed-out page on online when its restore never answered', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-out',
            userId: null,
        });
        const dispose = view.mount();
        try {
            vi.mocked(authClient.getSession).mockResolvedValueOnce({
                data: null,
                error: { message: 'offline' },
            } as never);
            window.dispatchEvent(restoredPageShow());
            await taskTurn();
            expect(view.syncState).toBe('failed');
            expect(view.authState).toBe('signed-out');

            vi.mocked(authClient.getSession).mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            } as never);
            window.dispatchEvent(new Event('online'));
            await taskTurn();

            expect(view.authState).toBe('signed-in');
            expect(view.userId).toBe('user-1');
            expect(view.syncState).toBe('synced');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });

    it('retries runSync directly when retry() is called after a sync failure', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);
        const view = new StoryProgressView({
            locale: 'en',
            authState: 'signed-in',
            userId: 'user-1',
        });
        const dispose = view.mount();
        try {
            await taskTurn();
            expect(view.syncState).toBe('failed');

            await view.retry();
            expect(view.syncState).toBe('synced');
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            dispose();
            vi.unstubAllGlobals();
        }
    });
});
