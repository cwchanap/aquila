// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
} from '../story-progress-store';
import {
    STORY_PROGRESS_SYNC_TIMEOUT_MS,
    syncStoryProgress,
} from '../story-progress-sync';
import type { StoryProgress } from '../story-progress';

function record(overrides: Partial<StoryProgress> = {}): StoryProgress {
    return {
        sceneId: 'ch1_act1',
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

function readProgress() {
    return new StoryProgressStore(localStorage).getAll();
}

function serverResponse(payload: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    } as Response;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): unknown {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const data = new Map(Object.entries(initial));
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

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('syncStoryProgress', () => {
    it('posts the local map and commits the merged server copy', async () => {
        saveProgress({
            the_seventh_mirror: record({
                sceneId: 'ch1_act1',
                dialogueIndex: 4,
                updatedAt: 10,
                endings: ['ch1_ending'],
                visited: ['ch1_act1'],
            }),
        });
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    the_seventh_mirror: record({
                        sceneId: 'ch2_act1',
                        dialogueIndex: 7,
                        updatedAt: 20,
                        endings: ['ch2_ending'],
                        visited: ['ch2_act1'],
                    }),
                    elevator_game: record({
                        sceneId: 'b1a_act4',
                        updatedAt: 30,
                        finished: true,
                        endings: ['b1a_act4'],
                    }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/progress');
        expect(bodyOf(fetchMock)).toEqual({
            progress: {
                the_seventh_mirror: record({
                    sceneId: 'ch1_act1',
                    dialogueIndex: 4,
                    updatedAt: 10,
                    endings: ['ch1_ending'],
                    visited: ['ch1_act1'],
                }),
            },
        });
        expect(readProgress()).toEqual({
            the_seventh_mirror: record({
                sceneId: 'ch2_act1',
                dialogueIndex: 7,
                updatedAt: 20,
                endings: ['ch2_ending', 'ch1_ending'],
                visited: ['ch2_act1', 'ch1_act1'],
            }),
            elevator_game: record({
                sceneId: 'b1a_act4',
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            }),
        });
    });

    it('re-reads local storage and keeps progress recorded while the request was in flight', async () => {
        saveProgress({
            the_seventh_mirror: record({
                sceneId: 'ch1_act1',
                dialogueIndex: 1,
                updatedAt: 10,
                endings: ['ch1_ending'],
            }),
        });
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-1' });

        // The reader records a newer place before the response arrives.
        saveProgress({
            the_seventh_mirror: record({
                sceneId: 'ch5_act2',
                dialogueIndex: 9,
                updatedAt: 40,
                endings: ['ch1_ending', 'ch5_ending'],
                visited: ['ch5_act2'],
            }),
        });
        resolveFetch(
            serverResponse({
                progress: {
                    the_seventh_mirror: record({
                        sceneId: 'ch2_act1',
                        dialogueIndex: 3,
                        updatedAt: 20,
                        endings: ['ch2_ending'],
                        visited: ['ch2_act1'],
                    }),
                },
            })
        );

        expect(await pending).toEqual({ ok: true });
        expect(readProgress().the_seventh_mirror).toEqual(
            record({
                sceneId: 'ch5_act2',
                dialogueIndex: 9,
                updatedAt: 40,
                endings: ['ch1_ending', 'ch5_ending', 'ch2_ending'],
                visited: ['ch5_act2', 'ch2_act1'],
            })
        );
    });

    it('sanitizes the server map and drops malformed records', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    the_seventh_mirror: record({ sceneId: 'ch2_act1' }),
                    broken: { sceneId: 42, endings: 'none' },
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-1' })).toEqual({
            ok: true,
        });
        expect(Object.keys(readProgress())).toEqual(['the_seventh_mirror']);
    });

    it('returns an error and leaves local progress untouched on a failed request', async () => {
        const local = {
            the_seventh_mirror: record({ updatedAt: 10 }),
        };
        saveProgress(local);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(serverResponse({}, 500))
        );

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result.ok).toBe(false);
        expect(readProgress()).toEqual(local);
    });

    it('returns an error and leaves local progress untouched when fetch rejects', async () => {
        const local = { the_seventh_mirror: record({ updatedAt: 10 }) };
        saveProgress(local);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        const result = await syncStoryProgress({
            keepalive: true,
            accountId: 'user-1',
        });

        expect(result.ok).toBe(false);
        expect(readProgress()).toEqual(local);
    });

    it('returns an error for a response without a progress map', async () => {
        const local = { the_seventh_mirror: record({ updatedAt: 10 }) };
        saveProgress(local);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(serverResponse({ progress: [] }))
        );

        expect((await syncStoryProgress({ accountId: 'user-1' })).ok).toBe(
            false
        );
        expect(readProgress()).toEqual(local);
    });

    it('bounds a hung fetch with the 1,500 ms timeout and aborts it', async () => {
        vi.useFakeTimers();
        fakeAbortSignalTimeout();
        try {
            let signal: AbortSignal | undefined;
            const fetchMock = vi.fn(
                (_url: string, init: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        const sig = init.signal as AbortSignal;
                        signal = sig;
                        // Reject on abort the way a real fetch does.
                        sig.addEventListener('abort', () => reject(sig.reason));
                    })
            );
            vi.stubGlobal('fetch', fetchMock);

            let settled = false;
            const pending = syncStoryProgress({
                timeoutMs: STORY_PROGRESS_SYNC_TIMEOUT_MS,
                accountId: 'user-1',
            }).then(result => {
                settled = true;
                return result;
            });

            await vi.advanceTimersByTimeAsync(1400);
            expect(settled).toBe(false);
            await vi.advanceTimersByTimeAsync(100);

            expect(await pending).toMatchObject({ ok: false });
            expect(signal?.aborted).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('passes keepalive through for a pagehide flush', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        await syncStoryProgress({ keepalive: true, accountId: 'user-1' });

        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
        });
    });

    it('returns failure without writing when the fresh local read fails', async () => {
        const initial = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [STORY_PROGRESS_KEY]: initial });
        let reads = 0;
        let writes = 0;
        const getItem = storage.getItem.bind(storage);
        const setItem = storage.setItem.bind(storage);
        storage.getItem = key => {
            reads += 1;
            // Read 1 is the owner tag, read 2 the upload map — the failing
            // read is the fresh re-read inside update()'s merge.
            if (reads === 3) throw new Error('storage read failed');
            return getItem(key);
        };
        storage.setItem = (key, value) => {
            writes += 1;
            setItem(key, value);
        };
        vi.stubGlobal('localStorage', storage);
        const advanced = JSON.stringify({
            the_seventh_mirror: record({ sceneId: 'ch5_act2', updatedAt: 40 }),
            elevator_game: record({ updatedAt: 30 }),
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async () => {
                // The reader advances and discovers another story while the
                // response is in flight.
                storage.setItem(STORY_PROGRESS_KEY, advanced);
                return serverResponse({
                    progress: {
                        the_seventh_mirror: record({
                            sceneId: 'ch2_act1',
                            updatedAt: 20,
                        }),
                    },
                });
            })
        );

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result.ok).toBe(false);
        expect(writes).toBe(1);
        expect(storage.getItem(STORY_PROGRESS_KEY)).toBe(advanced);
    });

    it('returns failure when the merged map cannot be committed', async () => {
        const original = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [STORY_PROGRESS_KEY]: original });
        storage.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                serverResponse({
                    progress: {
                        elevator_game: record({ updatedAt: 20 }),
                    },
                })
            )
        );

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result.ok).toBe(false);
        expect(storage.getItem(STORY_PROGRESS_KEY)).toBe(original);
    });

    it('returns failure without a request when local storage is unavailable', async () => {
        vi.stubGlobal('localStorage', undefined);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns failure before posting when local progress cannot be read', async () => {
        const storage = memoryStorage();
        storage.getItem = () => {
            throw new Error('SecurityError');
        };
        vi.stubGlobal('localStorage', storage);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('marks storage failures as local and request failures as remote', async () => {
        vi.stubGlobal('localStorage', undefined);
        const localResult = await syncStoryProgress({
            accountId: 'user-1',
        });
        expect(localResult).toMatchObject({ ok: false, local: true });
        vi.unstubAllGlobals();

        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );
        const remoteResult = await syncStoryProgress({
            accountId: 'user-1',
        });
        expect(remoteResult).toMatchObject({ ok: false, local: false });
    });

    it('tags the stored map with the account after a successful sync', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(serverResponse({ progress: {} }))
        );

        await syncStoryProgress({ accountId: 'user-1' });

        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-1');
    });

    it('downloads instead of uploading when the stored map is foreign-owned', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    elevator_game: record({ updatedAt: 30 }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-b' });

        expect(result).toEqual({ ok: true });
        // The other account's map never leaves this browser: the upload is
        // an empty map and the download replaces local outright.
        expect(bodyOf(fetchMock)).toEqual({ progress: {} });
        expect(readProgress()).toEqual({
            elevator_game: record({ updatedAt: 30 }),
        });
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
    });

    it('merges normally when the stored map is owned by this account', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-1');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        await syncStoryProgress({ accountId: 'user-1' });

        expect(bodyOf(fetchMock)).toEqual({
            progress: {
                the_seventh_mirror: record({ updatedAt: 10 }),
            },
        });
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-1');
    });

    it('bounds an oversized stored map so the upload cannot 413', async () => {
        const big: Record<string, StoryProgress> = {};
        for (let i = 0; i < 200; i++) {
            big[`story_${i}`] = record({
                updatedAt: i,
                visited: ['x'.repeat(400)],
            });
        }
        // Bypass the store's bounded write to reproduce a pre-bound map.
        localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(big));
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        await syncStoryProgress({ accountId: 'user-1' });

        const body = fetchMock.mock.calls[0][1].body as string;
        expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(
            48 * 1024
        );
    });
});
