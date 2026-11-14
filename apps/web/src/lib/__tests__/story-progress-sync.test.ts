// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
    storyProgressKey,
} from '../story-progress-store';
import { readerSessionKey } from '../reader-session';
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

function saveProgress(
    map: Record<string, StoryProgress>,
    accountId: string | null = 'user-1'
): void {
    localStorage.setItem(storyProgressKey(accountId), JSON.stringify(map));
}

function readProgress(accountId: string | null = 'user-1') {
    return new StoryProgressStore(localStorage, Date.now, accountId).getAll();
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

        // The reader records a newer place into this account's key before the
        // response arrives.
        localStorage.setItem(
            storyProgressKey('user-1'),
            JSON.stringify({
                the_seventh_mirror: record({
                    sceneId: 'ch5_act2',
                    dialogueIndex: 9,
                    updatedAt: 40,
                    endings: ['ch1_ending', 'ch5_ending'],
                    visited: ['ch5_act2'],
                }),
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

    it('bounds a hung fetch with the 1,500 ms timeout and aborts without AbortSignal.timeout', async () => {
        vi.useFakeTimers();
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

            expect(await pending).toMatchObject({ ok: false, phase: 'remote' });
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

    it('returns local-save without overwriting when the fresh local read fails after response', async () => {
        const accountKey = storyProgressKey('user-1');
        const initial = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [accountKey]: initial });
        let writes = 0;
        const getItem = storage.getItem.bind(storage);
        const setItem = storage.setItem.bind(storage);
        storage.setItem = (key, value) => {
            if (key === accountKey) writes += 1;
            setItem(key, value);
        };
        vi.stubGlobal('localStorage', storage);
        const advanced = JSON.stringify({
            the_seventh_mirror: record({
                sceneId: 'ch5_act2',
                updatedAt: 40,
            }),
            elevator_game: record({ updatedAt: 30 }),
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async () => {
                // Reader advances during the request, then reads start failing.
                setItem(accountKey, advanced);
                storage.getItem = () => {
                    throw new Error('storage read failed');
                };
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

        expect(result).toMatchObject({ ok: false, phase: 'local-save' });
        expect(writes).toBe(0);
        expect(getItem(accountKey)).toBe(advanced);
    });

    it('aborts the upload when claiming anonymous progress fails', async () => {
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

        expect(result).toMatchObject({ ok: false, phase: 'local-read' });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(storage.getItem(STORY_PROGRESS_KEY)).toBe(original);
    });

    it('returns local-save when the merged map cannot be committed after upload', async () => {
        const accountKey = storyProgressKey('user-1');
        const original = JSON.stringify({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
        const storage = memoryStorage({ [accountKey]: original });
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

        expect(result).toMatchObject({ ok: false, phase: 'local-save' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(storage.getItem(accountKey)).toBe(original);
    });

    it('returns local-read without a request when local storage is unavailable', async () => {
        vi.stubGlobal('localStorage', undefined);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result).toMatchObject({ ok: false, phase: 'local-read' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns local-read before posting when local progress cannot be read', async () => {
        const storage = memoryStorage();
        storage.getItem = () => {
            throw new Error('SecurityError');
        };
        vi.stubGlobal('localStorage', storage);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await syncStoryProgress({ accountId: 'user-1' });

        expect(result).toMatchObject({ ok: false, phase: 'local-read' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('distinguishes local-read, remote, and local-save failures', async () => {
        vi.stubGlobal('localStorage', undefined);
        expect(await syncStoryProgress({ accountId: 'user-1' })).toMatchObject({
            ok: false,
            phase: 'local-read',
        });
        vi.unstubAllGlobals();

        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );
        expect(await syncStoryProgress({ accountId: 'user-1' })).toMatchObject({
            ok: false,
            phase: 'remote',
        });
        vi.unstubAllGlobals();

        const storage = memoryStorage({
            [storyProgressKey('user-1')]: JSON.stringify({}),
        });
        storage.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(serverResponse({ progress: {} }))
        );
        expect(await syncStoryProgress({ accountId: 'user-1' })).toMatchObject({
            ok: false,
            phase: 'local-save',
        });
    });

    it('keeps another account key untouched during sync', async () => {
        saveProgress(
            { the_seventh_mirror: record({ updatedAt: 10 }) },
            'user-a'
        );
        saveProgress({ elevator_game: record({ updatedAt: 20 }) }, 'user-b');
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    train_adventure: record({ updatedAt: 30 }),
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        expect(await syncStoryProgress({ accountId: 'user-b' })).toEqual({
            ok: true,
        });

        expect(bodyOf(fetchMock)).toEqual({
            progress: { elevator_game: record({ updatedAt: 20 }) },
            accountId: 'user-b',
        });
        expect(readProgress('user-b')).toEqual({
            elevator_game: record({ updatedAt: 20 }),
            train_adventure: record({ updatedAt: 30 }),
        });
        expect(readProgress('user-a')).toEqual({
            the_seventh_mirror: record({ updatedAt: 10 }),
        });
    });

    it('claims anonymous progress once for the signing-in account and clears anonymous keys', async () => {
        saveProgress(
            { elevator_game: record({ sceneId: 'act2', updatedAt: 15 }) },
            null
        );
        localStorage.setItem(
            readerSessionKey('en', null),
            JSON.stringify({
                storyId: 'train_adventure',
                sceneId: 'act1',
                dialogueIndex: 2,
                locale: 'en',
                version: 2,
            })
        );

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                serverResponse({
                    progress: {
                        elevator_game: record({
                            sceneId: 'act2',
                            updatedAt: 15,
                        }),
                        train_adventure: record({
                            sceneId: 'act1',
                            dialogueIndex: 2,
                            updatedAt: 0,
                        }),
                    },
                })
            )
            .mockResolvedValueOnce(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        expect(
            await syncStoryProgress({ accountId: 'user-a', locale: 'en' })
        ).toEqual({ ok: true });

        expect(bodyOf(fetchMock)).toEqual({
            progress: {
                elevator_game: record({ sceneId: 'act2', updatedAt: 15 }),
                train_adventure: record({
                    sceneId: 'act1',
                    dialogueIndex: 2,
                    updatedAt: 0,
                }),
            },
            accountId: 'user-a',
        });
        expect(localStorage.getItem(STORY_PROGRESS_KEY)).toBeNull();
        expect(localStorage.getItem(readerSessionKey('en', null))).toBeNull();

        // A later sign-in by another account uploads nothing from anonymous.
        expect(
            await syncStoryProgress({ accountId: 'user-b', locale: 'en' })
        ).toEqual({ ok: true });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
            progress: {},
            accountId: 'user-b',
        });
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
        localStorage.setItem(storyProgressKey('user-1'), JSON.stringify(big));
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
