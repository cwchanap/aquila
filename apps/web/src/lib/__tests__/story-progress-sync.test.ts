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

afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
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

        const result = await syncStoryProgress();

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

        const pending = syncStoryProgress();

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

        expect(await syncStoryProgress()).toEqual({ ok: true });
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

        const result = await syncStoryProgress();

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

        const result = await syncStoryProgress({ keepalive: true });

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

        expect((await syncStoryProgress()).ok).toBe(false);
        expect(readProgress()).toEqual(local);
    });

    it('bounds a hung fetch with the 1,500 ms timeout and aborts it', async () => {
        vi.useFakeTimers();
        try {
            let signal: AbortSignal | undefined;
            const fetchMock = vi.fn(
                (_url: string, init: RequestInit) =>
                    new Promise<Response>(() => {
                        signal = init.signal as AbortSignal;
                    })
            );
            vi.stubGlobal('fetch', fetchMock);

            let settled = false;
            const pending = syncStoryProgress({
                timeoutMs: STORY_PROGRESS_SYNC_TIMEOUT_MS,
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

        await syncStoryProgress({ keepalive: true });

        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
        });
    });
});
