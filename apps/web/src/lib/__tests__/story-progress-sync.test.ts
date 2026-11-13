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
            accountId: 'user-1',
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

        // The reader records a newer place before the response arrives; the
        // write carries the account tag the sync claimed before the request
        // left.
        localStorage.setItem(
            STORY_PROGRESS_KEY,
            JSON.stringify({
                v: 2,
                owner: 'user-1',
                progress: {
                    the_seventh_mirror: record({
                        sceneId: 'ch5_act2',
                        dialogueIndex: 9,
                        updatedAt: 40,
                        endings: ['ch1_ending', 'ch5_ending'],
                        visited: ['ch5_act2'],
                    }),
                },
            })
        );
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

    it('returns an error for a null progress response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(serverResponse(null)));

        expect((await syncStoryProgress({ accountId: 'user-1' })).ok).toBe(
            false
        );
    });

    it('fails locally when the foreign map cannot be re-read after the response', async () => {
        const initial = JSON.stringify({
            v: 2,
            owner: 'user-a',
            progress: { the_seventh_mirror: record({ updatedAt: 10 }) },
        });
        const storage = memoryStorage({ [STORY_PROGRESS_KEY]: initial });
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async () => {
                // The post-response read fails — the commit cannot verify
                // who owns the map, so nothing may be written over it.
                storage.getItem = () => {
                    throw new Error('SecurityError');
                };
                return serverResponse({
                    progress: { train_adventure: record({ updatedAt: 30 }) },
                });
            })
        );

        expect(await syncStoryProgress({ accountId: 'user-b' })).toMatchObject({
            ok: false,
            local: true,
        });
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
            if (key === STORY_PROGRESS_KEY) reads += 1;
            // Reads 1-3 are the owner check, the upload map, and the
            // claim's re-read — the failing read is the fresh re-read
            // inside update()'s merge.
            if (key === STORY_PROGRESS_KEY && reads === 4) {
                throw new Error('storage read failed');
            }
            return getItem(key);
        };
        storage.setItem = (key, value) => {
            if (key === STORY_PROGRESS_KEY) writes += 1;
            setItem(key, value);
        };
        vi.stubGlobal('localStorage', storage);
        const advanced = JSON.stringify({
            v: 2,
            owner: 'user-1',
            progress: {
                the_seventh_mirror: record({
                    sceneId: 'ch5_act2',
                    updatedAt: 40,
                }),
                elevator_game: record({ updatedAt: 30 }),
            },
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
        expect(writes).toBe(2);
        expect(storage.getItem(STORY_PROGRESS_KEY)).toBe(advanced);
    });

    it('aborts the upload when an unowned map cannot be claimed', async () => {
        const original = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [STORY_PROGRESS_KEY]: original });
        storage.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        vi.stubGlobal('localStorage', storage);
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    elevator_game: record({ updatedAt: 20 }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result).toMatchObject({ ok: false, local: true });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(storage.getItem(STORY_PROGRESS_KEY)).toBe(original);
    });

    it('returns failure when the merged map cannot be committed', async () => {
        const original = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [STORY_PROGRESS_KEY]: original });
        let writes = 0;
        const setItem = storage.setItem.bind(storage);
        storage.setItem = (key, value) => {
            if (key === STORY_PROGRESS_KEY) {
                writes += 1;
                // Write 1 is the pre-upload claim; write 2 is the merge
                // commit for the response.
                if (writes === 2) throw new Error('QuotaExceededError');
            }
            setItem(key, value);
        };
        vi.stubGlobal('localStorage', storage);
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    elevator_game: record({ updatedAt: 20 }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result).toMatchObject({ ok: false, local: true });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // The claim write already landed: the map stays tagged so a later
        // account cannot upload it as unowned progress.
        const stored = new StoryProgressStore(storage).getWithOwnerChecked();
        expect(stored?.owner).toBe('user-1');
        expect(stored?.map).toEqual({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
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
        // The previous owner's reader sessions go with its displaced map.
        localStorage.setItem(
            'aquila:readerState:en',
            JSON.stringify({ storyId: 'the_seventh_mirror' })
        );
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
        expect(bodyOf(fetchMock)).toEqual({
            progress: {},
            accountId: 'user-b',
        });
        expect(readProgress()).toEqual({
            elevator_game: record({ updatedAt: 30 }),
        });
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
        expect(localStorage.getItem('aquila:readerState:en')).toBeNull();
    });

    it('uploads records written while signed out to the next signed-in account', async () => {
        // A synced and signed out; anonymous reading detached A's map into
        // an unowned copy. B's first sync must claim that copy — the
        // alternative would be sidelining anonymous progress under A.
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            null
        );
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: { train_adventure: record({ updatedAt: 30 }) },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-b' })).toEqual({
            ok: true,
        });
        // The unowned copy uploads as B's progress and the download
        // merges into it — nothing of it is stranded under user-a.
        const body = bodyOf(fetchMock) as {
            progress: Record<string, unknown>;
        };
        expect(Object.keys(body.progress)).toEqual(['elevator_game']);
        const stored = readProgress();
        expect(Object.keys(stored).sort()).toEqual([
            'elevator_game',
            'train_adventure',
        ]);
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
        const sidelined = JSON.parse(
            localStorage.getItem(
                'aquila:storyProgress:v1:sidelined:user-a'
            ) as string
        );
        expect(Object.keys(sidelined.progress)).toEqual(['the_seventh_mirror']);
    });

    it('uploads sidelined records whose restore write failed', async () => {
        const storage = memoryStorage({
            [STORY_PROGRESS_KEY]: JSON.stringify({
                the_seventh_mirror: record({ updatedAt: 10 }),
            }),
            'aquila:storyProgress:v1:sidelined:user-1': JSON.stringify({
                v: 2,
                owner: 'user-1',
                progress: { elevator_game: record({ updatedAt: 20 }) },
            }),
        });
        let writes = 0;
        const setItem = storage.setItem.bind(storage);
        storage.setItem = (key, value) => {
            if (key === STORY_PROGRESS_KEY) {
                writes += 1;
                // Write 1 is the merge-back inside restoreSidelined —
                // its failure leaves the sidelined copy waiting.
                if (writes === 1) throw new Error('QuotaExceededError');
            }
            setItem(key, value);
        };
        vi.stubGlobal('localStorage', storage);
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-1' })).toEqual({
            ok: true,
        });
        // The records are this account's own even while they could not
        // merge back into the stored map — the upload carries them.
        const body = bodyOf(fetchMock) as {
            progress: Record<string, unknown>;
        };
        expect(Object.keys(body.progress).sort()).toEqual([
            'elevator_game',
            'the_seventh_mirror',
        ]);
        // The retry after the commit then restores the copy normally.
        expect(
            storage.getItem('aquila:storyProgress:v1:sidelined:user-1')
        ).toBeNull();
        expect(new StoryProgressStore(storage).getOwner()).toBe('user-1');
    });

    it('keeps records written while a foreign-owned sync is in flight', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-b' });

        // A position lands behind the pending download — the syncing
        // account's own reader tab records while the request is out.
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            'user-b'
        );
        resolveFetch(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                },
            })
        );

        expect(await pending).toEqual({ ok: true });
        const stored = readProgress();
        // The new record survives the replacement; the untouched foreign
        // copy does not come back with it.
        expect(stored.elevator_game).toMatchObject({
            sceneId: 'b1a_act1',
            dialogueIndex: 2,
        });
        expect(stored.train_adventure).toEqual(record({ updatedAt: 30 }));
        expect(stored).not.toHaveProperty('the_seventh_mirror');
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
    });

    it('keeps sessions the syncing account wrote while the request was out', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-b' });

        // The account's own record claims the map (clearing the previous
        // owner's sessions); the persist that follows writes its own.
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            'user-b'
        );
        localStorage.setItem(
            'aquila:readerState:en',
            JSON.stringify({
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                locale: 'en',
                version: 2,
            })
        );
        resolveFetch(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                },
            })
        );

        expect(await pending).toEqual({ ok: true });
        // The same-account merge branch must not clear a session written
        // mid-flight — only a displaced foreign map takes sessions with it.
        expect(localStorage.getItem('aquila:readerState:en')).not.toBeNull();
    });

    it('claims an in-flight anonymous record when the download commits', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-b' });

        // An anonymous write lands behind the pending download: it
        // detaches the foreign map into an unowned copy — claimable by
        // the next signed-in account, which is this sync.
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            null
        );
        resolveFetch(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                },
            })
        );

        expect(await pending).toEqual({ ok: true });
        const stored = readProgress();
        // The download merges into the unowned copy under this account's
        // tag — the anonymous record is adopted instead of sidelined
        // under the previous owner.
        expect(Object.keys(stored).sort()).toEqual([
            'elevator_game',
            'train_adventure',
        ]);
        expect(stored.elevator_game).toMatchObject({
            sceneId: 'b1a_act1',
            dialogueIndex: 2,
        });
        expect(stored.train_adventure).toEqual(record({ updatedAt: 30 }));
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
        // Only the previous owner's own records wait sidelined for it.
        const sidelined = JSON.parse(
            localStorage.getItem(
                'aquila:storyProgress:v1:sidelined:user-a'
            ) as string
        );
        expect(Object.keys(sidelined.progress)).toEqual(['the_seventh_mirror']);
    });

    it('leaves a map retagged by a third account behind the request untouched', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-b' });

        // A third account claims the map while the download is out — its
        // records are not this sync's to merge or to discard.
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            'user-c'
        );
        resolveFetch(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                },
            })
        );

        expect(await pending).toMatchObject({ ok: false, local: true });
        const stored = new StoryProgressStore(localStorage);
        expect(stored.getOwner()).toBe('user-c');
        expect(stored.getAll()).toEqual({
            elevator_game: expect.objectContaining({
                sceneId: 'b1a_act1',
            }),
        });
    });

    it('abandons the merge when the map changes hands behind the request', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-1');
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve => {
                    resolveFetch = resolve;
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = syncStoryProgress({ accountId: 'user-1' });

        // Another account's record retags the map mid-request — merging
        // user-1's download into it would feed it to the wrong owner.
        new StoryProgressStore(localStorage).record(
            {
                storyId: 'elevator_game',
                sceneId: 'b1a_act1',
                dialogueIndex: 2,
                atEnding: false,
            },
            'user-b'
        );
        resolveFetch(
            serverResponse({
                progress: {
                    the_seventh_mirror: record({ updatedAt: 20 }),
                },
            })
        );

        expect(await pending).toMatchObject({ ok: false, local: true });
        const stored = new StoryProgressStore(localStorage);
        expect(stored.getOwner()).toBe('user-b');
        expect(stored.getAll()).toEqual({
            elevator_game: expect.objectContaining({
                sceneId: 'b1a_act1',
            }),
        });
    });

    it('claims an unowned map before the upload leaves the browser', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const fetchMock = vi.fn().mockImplementation(async () => {
            // By the time the request goes out, the stored map already
            // carries this account's tag.
            expect(new StoryProgressStore(localStorage).getOwner()).toBe(
                'user-1'
            );
            return serverResponse({ progress: {} });
        });
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-1' })).toEqual({
            ok: true,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the account tag when the request fails mid-flight', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        const result = await syncStoryProgress({ accountId: 'user-1' });

        // A lost request still leaves the copy claimed: the next account
        // on this browser cannot re-upload it as anonymous progress.
        expect(result.ok).toBe(false);
        const stored = new StoryProgressStore(localStorage);
        expect(stored.getOwner()).toBe('user-1');
        expect(stored.getAll()).toEqual({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
    });

    it('restores a sidelined copy into the upload for the returning account', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        localStorage.setItem(
            'aquila:storyProgress:v1:sidelined:user-1',
            JSON.stringify({
                v: 2,
                owner: 'user-1',
                progress: { elevator_game: record({ updatedAt: 20 }) },
            })
        );
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-1' })).toEqual({
            ok: true,
        });
        // The sidelined records are back in the active map and travel with
        // the upload.
        const body = bodyOf(fetchMock) as {
            progress: Record<string, unknown>;
        };
        expect(Object.keys(body.progress).sort()).toEqual([
            'elevator_game',
            'the_seventh_mirror',
        ]);
        expect(
            localStorage.getItem('aquila:storyProgress:v1:sidelined:user-1')
        ).toBeNull();
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-1');
    });

    it('restores a sidelined copy after a foreign sync replaces the map', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        localStorage.setItem(
            'aquila:storyProgress:v1:sidelined:user-b',
            JSON.stringify({
                v: 2,
                owner: 'user-b',
                progress: { elevator_game: record({ updatedAt: 20 }) },
            })
        );
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: { train_adventure: record({ updatedAt: 30 }) },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-b' })).toEqual({
            ok: true,
        });
        const stored = new StoryProgressStore(localStorage);
        // The download replaced the foreign map, then user-b's own
        // sidelined copy merged back into it.
        expect(Object.keys(stored.getAll()).sort()).toEqual([
            'elevator_game',
            'train_adventure',
        ]);
        expect(stored.getOwner()).toBe('user-b');
        expect(
            localStorage.getItem('aquila:storyProgress:v1:sidelined:user-b')
        ).toBeNull();
        // The evicted owner's copy still waits for its own sign-in.
        expect(
            localStorage.getItem('aquila:storyProgress:v1:sidelined:user-a')
        ).not.toBeNull();
    });

    it('uploads a sidelined copy the foreign-owned sync cannot restore yet', async () => {
        saveProgress({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        localStorage.setItem(
            'aquila:storyProgress:v1:sidelined:user-b',
            JSON.stringify({
                v: 2,
                owner: 'user-b',
                progress: { elevator_game: record({ updatedAt: 20 }) },
            })
        );
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                    elevator_game: record({ updatedAt: 20 }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-b' })).toEqual({
            ok: true,
        });
        // The foreign map is still downloaded rather than uploaded, but
        // user-b's own sidelined records ride the request — reporting
        // success no longer strands them locally.
        expect(bodyOf(fetchMock)).toEqual({
            progress: { elevator_game: record({ updatedAt: 20 }) },
            accountId: 'user-b',
        });
        const stored = new StoryProgressStore(localStorage);
        expect(Object.keys(stored.getAll()).sort()).toEqual([
            'elevator_game',
            'train_adventure',
        ]);
        expect(stored.getOwner()).toBe('user-b');
        expect(
            localStorage.getItem('aquila:storyProgress:v1:sidelined:user-b')
        ).toBeNull();
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
            accountId: 'user-1',
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
