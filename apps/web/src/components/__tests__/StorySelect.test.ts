// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { Locale } from '@aquila/stories';
import type { AuthState } from '../../lib/auth-utils';
import { authClient } from '../../lib/auth-client';
import StorySelect from '../StorySelect.svelte';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
} from '../../lib/story-progress-store';
import { STORY_SELECT_SYNC_TIMEOUT_MS } from '../../lib/story-progress-sync';

function renderSelect(
    props: {
        locale?: Locale;
        authState?: AuthState;
        userId?: string | null;
    } = {}
): ReturnType<typeof render> {
    return render(StorySelect, {
        props: {
            locale: 'en',
            authState: 'signed-out',
            userId: 'user-1',
            ...props,
        },
    });
}

function saveProgress(map: Record<string, unknown>): void {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(map));
}

function serverResponse(payload: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => payload,
    } as Response;
}

function stubSession(data: unknown): void {
    vi.mocked(authClient.getSession).mockResolvedValue({
        data,
        error: null,
    } as never);
}

/** Calls to the sync endpoint only; a persisted restore also re-reads the
 *  session, so bare call counts no longer measure progress requests. */
function progressCalls(
    fetchMock: ReturnType<typeof vi.fn>
): Array<[unknown, RequestInit]> {
    return fetchMock.mock.calls.filter(([url]) => url === '/api/progress');
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

const restoredPageShow = () =>
    Object.assign(new Event('pageshow'), { persisted: true });

/** Flushes a settled request's whole callback chain — response parsing, the
 *  local merge, the queued-rerun hook — so a follow-up request a bug would
 *  fire has already happened. One microtask resolves before that chain
 *  finishes and cannot prove a negative; timers are faked globally, so
 *  advancing them is the task turn. */
const taskTurn = () => vi.advanceTimersByTimeAsync(0);

function cardLink(id: string): HTMLAnchorElement {
    const link = document.querySelector<HTMLAnchorElement>(
        `a.story-card[data-story-id="${id}"]`
    );
    if (!link) throw new Error(`no card for ${id}`);
    return link;
}

describe('StorySelect', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('PUBLIC_ASSET_BASE_URL', 'https://assets.example/');
        // Session re-reads start signed-out; a test that wants a signed-in
        // or sequenced answer stubs its own.
        vi.mocked(authClient.getSession).mockReset();
        stubSession(null);
    });

    afterEach(() => {
        // Unstub before clearing so a test that replaced localStorage
        // cannot poison the next test's setup.
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('puts short stories and sagas on separate shelves', () => {
        renderSelect();

        const quickReads = screen.getByTestId('quick-reads');
        const sagas = screen.getByTestId('sagas');
        expect(
            within(quickReads).getByRole('heading', { name: 'Quick reads' })
        ).toBeInTheDocument();
        expect(quickReads.querySelectorAll('a.story-card')).toHaveLength(5);
        expect(sagas.querySelectorAll('a.story-card')).toHaveLength(3);
        expect(
            within(quickReads).getByText('The Elevator Game')
        ).toBeInTheDocument();
        expect(cardLink('elevator_game')).toHaveTextContent(/\d+ min/);
        expect(cardLink('the_seventh_mirror')).toHaveTextContent('28 chapters');
        expect(screen.queryByTestId('continue-reading')).toBeNull();
        expect(
            screen.queryByTestId('start-over-the_seventh_mirror')
        ).toBeNull();
    });

    it('shows the generated cover for every short story while keeping its accessible title', () => {
        renderSelect();
        for (const id of [
            'elevator_game',
            'demon_lord_is_hiring',
            'three_am_laundromat',
            'day_4012',
            'one_pot_before_dawn',
        ]) {
            const card = cardLink(id);
            const cover = card.querySelector('img');
            expect(cover).toHaveAttribute(
                'src',
                `https://assets.example/vn/covers/${id}.webp`
            );
            expect(cover).toHaveAttribute('alt', '');
            expect(card).toHaveAccessibleName();
        }
    });

    it('shows the icon fallback instead of covers when no asset host is configured', () => {
        vi.stubEnv('PUBLIC_ASSET_BASE_URL', '');
        renderSelect();
        expect(cardLink('elevator_game').querySelector('img')).toBeNull();
    });

    it('drops a cover that fails to load so the icon fallback shows through', async () => {
        // Covers live on the asset host; a missing or stale file must
        // not leave a broken-image frame on the card.
        renderSelect();
        const card = cardLink('elevator_game');
        const cover = card.querySelector('img');
        expect(cover).not.toBeNull();
        await fireEvent.error(cover!);
        expect(card.querySelector('img')).toBeNull();
        // Siblings keep their covers: the failure is tracked per story.
        expect(cardLink('day_4012').querySelector('img')).not.toBeNull();
    });

    it('renders in Chinese', () => {
        renderSelect({ locale: 'zh' });
        expect(cardLink('elevator_game').getAttribute('href')).toBe(
            '/zh/reader?story=elevator_game'
        );
        expect(cardLink('elevator_game')).toHaveTextContent(/\d+ 分鐘/);
    });

    it('renders in Japanese and tags the stories read in Chinese', () => {
        renderSelect({ locale: 'ja' });
        expect(cardLink('elevator_game').getAttribute('href')).toBe(
            '/ja/reader?story=elevator_game'
        );
        expect(
            screen.getByTestId('language-note-the_seventh_mirror')
        ).toHaveTextContent('中国語のみ');
        expect(screen.queryByTestId('language-note-elevator_game')).toBeNull();
    });

    it('shows no language tag when reading in Chinese', () => {
        renderSelect({ locale: 'zh' });
        expect(
            screen.queryByTestId('language-note-the_seventh_mirror')
        ).toBeNull();
    });

    it('offers to continue a saga and keeps short story endings', () => {
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
            elevator_game: {
                sceneId: 'b1a_act4',
                dialogueIndex: 9,
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            },
        });
        renderSelect();

        const resume =
            '/en/reader?story=the_seventh_mirror&scene=ch3_act2&dialogue=5';
        const strip = screen.getByTestId('continue-reading');
        expect(strip).toHaveAttribute('href', resume);
        expect(strip).toHaveTextContent('The Seventh Mirror');
        expect(strip).toHaveTextContent('Chapter 3 of 28');
        expect(cardLink('the_seventh_mirror')).toHaveAttribute('href', resume);
        expect(
            screen.getByTestId('start-over-the_seventh_mirror')
        ).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&restart=1'
        );

        expect(cardLink('elevator_game')).toHaveTextContent('1 of 2 endings');
        expect(cardLink('elevator_game')).toHaveAttribute(
            'href',
            '/en/reader?story=elevator_game&restart=1'
        );
    });

    it('offers Continue for a place saved before per-story progress existed', () => {
        localStorage.setItem(
            'aquila:readerState:en',
            JSON.stringify({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch4_act2',
                dialogueIndex: 6,
                locale: 'en',
                version: 2,
            })
        );
        renderSelect();

        const resume =
            '/en/reader?story=the_seventh_mirror&scene=ch4_act2&dialogue=7';
        expect(screen.getByTestId('continue-reading')).toHaveAttribute(
            'href',
            resume
        );
        expect(cardLink('the_seventh_mirror')).toHaveAttribute('href', resume);
    });

    it('re-reads progress when the page returns from the back/forward cache', async () => {
        stubSession(null);
        vi.stubGlobal('fetch', vi.fn());
        renderSelect();
        expect(screen.queryByTestId('continue-reading')).toBeNull();

        saveProgress({
            train_adventure: {
                sceneId: 'act2',
                dialogueIndex: 0,
                updatedAt: 5,
                finished: false,
                endings: [],
            },
        });
        // A normal pageshow (not from the cache) keeps what was rendered.
        window.dispatchEvent(new Event('pageshow'));
        await Promise.resolve();
        expect(screen.queryByTestId('continue-reading')).toBeNull();

        const restored = Object.assign(new Event('pageshow'), {
            persisted: true,
        });
        window.dispatchEvent(restored);
        expect(await screen.findByTestId('continue-reading')).toHaveAttribute(
            'href',
            '/en/reader?story=train_adventure&scene=act2&dialogue=1'
        );
    });

    it('pulls account progress into Continue for a cloud-only story', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    the_seventh_mirror: {
                        sceneId: 'ch2_act1',
                        dialogueIndex: 3,
                        updatedAt: 20,
                        finished: false,
                        endings: ['ch1_ending'],
                    },
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });

        expect(screen.getByTestId('progress-sync-status')).toHaveTextContent(
            'Syncing your progress…'
        );
        expect(screen.queryByTestId('continue-reading')).toBeNull();

        const strip = await screen.findByTestId('continue-reading');
        expect(strip).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch2_act1&dialogue=4'
        );
        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            progress: {},
        });
        expect(
            JSON.parse(localStorage.getItem(STORY_PROGRESS_KEY) ?? '{}')
        ).toHaveProperty('the_seventh_mirror');
    });

    it('keeps local Continue cards and reports a failed signed-in sync', async () => {
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        renderSelect({ authState: 'signed-in' });

        expect(screen.getByTestId('continue-reading')).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch3_act2&dialogue=5'
        );
        expect(
            await screen.findByText(
                "Couldn't reach your account. Progress is kept in this browser and syncs next time."
            )
        ).toBeInTheDocument();
        expect(screen.getByTestId('continue-reading')).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch3_act2&dialogue=5'
        );
    });

    it('offers the localized login link to a signed-out reader with local progress', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        saveProgress({
            elevator_game: {
                sceneId: 'b1a_act4',
                dialogueIndex: 9,
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            },
        });

        renderSelect({ authState: 'signed-out' });

        const status = screen.getByTestId('progress-sync-status');
        expect(status).toHaveTextContent(
            'Progress is saved in this browser only.'
        );
        expect(
            within(status).getByRole('link', {
                name: 'Sign in to pick it up on any device.',
            })
        ).toHaveAttribute('href', '/en/login');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows nothing and makes no requests for a new signed-out visitor', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-out' });

        expect(screen.queryByTestId('progress-sync-status')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the signed-out line when an unavailable SSR session re-reads as signed-out', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
        });

        renderSelect({ authState: 'unavailable', userId: null });

        // One background session re-read runs; a signed-out answer is then
        // shown like any other signed-out page — no sync request fires.
        expect(
            await screen.findByText('Progress is saved in this browser only.')
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows nothing and makes no requests when the session re-read fails', async () => {
        vi.mocked(authClient.getSession).mockRejectedValue(
            new TypeError('Failed to fetch')
        );
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
        });

        renderSelect({ authState: 'unavailable', userId: null });
        await taskTurn();

        expect(screen.queryByTestId('progress-sync-status')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('recovers a signed-in session when SSR auth was unavailable', async () => {
        stubSession({ user: { id: 'user-9' } });
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'unavailable', userId: null });

        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
        expect(progressCalls(fetchMock)).toHaveLength(1);
    });

    it('reports a local storage failure instead of the network copy', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });

        expect(
            await screen.findByText(
                "This browser couldn't read or save your progress, so nothing was sent to your account."
            )
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('replaces a foreign-owned local map with the signed-in account copy', async () => {
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
        });
        new StoryProgressStore(localStorage).setOwner('user-a');
        const fetchMock = vi.fn().mockResolvedValue(
            serverResponse({
                progress: {
                    train_adventure: {
                        sceneId: 'act2',
                        dialogueIndex: 0,
                        updatedAt: 30,
                        finished: false,
                        endings: [],
                    },
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in', userId: 'user-b' });

        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
        // The other account's map is never uploaded — the request carries
        // an empty upload and the download replaces local outright.
        expect(progressCalls(fetchMock)).toHaveLength(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            progress: {},
        });
        expect(
            JSON.parse(localStorage.getItem(STORY_PROGRESS_KEY) ?? '{}')
        ).not.toHaveProperty('the_seventh_mirror');
        expect(new StoryProgressStore(localStorage).getOwner()).toBe('user-b');
    });

    it('bounds a hung sync request with the story-select timeout', async () => {
        fakeAbortSignalTimeout();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                (_url: unknown, init?: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        // Reject on abort the way a real fetch does.
                        const signal = init?.signal;
                        signal?.addEventListener('abort', () =>
                            reject(signal.reason)
                        );
                    })
            )
        );

        renderSelect({ authState: 'signed-in' });
        expect(screen.getByTestId('progress-sync-status')).toHaveTextContent(
            'Syncing your progress…'
        );

        await vi.advanceTimersByTimeAsync(STORY_SELECT_SYNC_TIMEOUT_MS);
        expect(
            await screen.findByText(
                "Couldn't reach your account. Progress is kept in this browser and syncs next time."
            )
        ).toBeInTheDocument();
    });

    it('uses the current locale for the signed-out login link', () => {
        saveProgress({
            elevator_game: {
                sceneId: 'b1a_act4',
                dialogueIndex: 9,
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            },
        });

        renderSelect({ locale: 'zh', authState: 'signed-out' });

        expect(
            within(screen.getByTestId('progress-sync-status')).getByRole(
                'link',
                { name: '登入後即可在任何裝置接續閱讀。' }
            )
        ).toHaveAttribute('href', '/zh/login');
    });

    it('queues a follow-up sync when a cached page returns mid-request', async () => {
        let resolveFirst!: (response: Response) => void;
        const progressResponses = [
            () =>
                new Promise<Response>(resolve => {
                    resolveFirst = resolve;
                }),
            () => Promise.resolve(serverResponse({ progress: {} })),
        ];
        stubSession({ user: { id: 'user-1' } });
        const fetchMock = vi.fn(() => progressResponses.shift()!());
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(progressCalls(fetchMock)).toHaveLength(1);

        // The return lands while the mount request is still in flight: it
        // joins that request and queues one more pass behind it, since the
        // running request still carries the pre-restore state.
        window.dispatchEvent(restoredPageShow());
        expect(progressCalls(fetchMock)).toHaveLength(1);

        resolveFirst(serverResponse({ progress: {} }));
        await waitFor(() => expect(progressCalls(fetchMock)).toHaveLength(2));
        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
    });

    it('queues at most one follow-up for repeated restores during a request', async () => {
        let resolveFirst!: (response: Response) => void;
        const progressResponses = [
            () =>
                new Promise<Response>(resolve => {
                    resolveFirst = resolve;
                }),
            () => Promise.resolve(serverResponse({ progress: {} })),
        ];
        stubSession({ user: { id: 'user-1' } });
        const fetchMock = vi.fn(() => progressResponses.shift()!());
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(progressCalls(fetchMock)).toHaveLength(1);

        window.dispatchEvent(restoredPageShow());
        window.dispatchEvent(restoredPageShow());
        expect(progressCalls(fetchMock)).toHaveLength(1);

        resolveFirst(serverResponse({ progress: {} }));
        await waitFor(() => expect(progressCalls(fetchMock)).toHaveLength(2));
        // Both joins share the single queued pass — no third request fires
        // once the second request's callbacks have all run.
        await taskTurn();
        expect(progressCalls(fetchMock)).toHaveLength(2);
    });

    it('skips the queued follow-up when auth is lost before the first request settles', async () => {
        let resolveFirst!: (response: Response) => void;
        const progressResponses = [
            () =>
                new Promise<Response>(resolve => {
                    resolveFirst = resolve;
                }),
        ];
        vi.mocked(authClient.getSession)
            .mockResolvedValueOnce({
                data: { user: { id: 'user-1' } },
                error: null,
            } as never)
            .mockResolvedValue({ data: null, error: null } as never);
        const fetchMock = vi.fn(() => progressResponses.shift()!());
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(progressCalls(fetchMock)).toHaveLength(1);

        // Still signed in: the join queues a follow-up behind the request.
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(vi.mocked(authClient.getSession)).toHaveBeenCalled()
        );
        // The next restore revalidates to signed-out before the first
        // request settles, so the queued pass must not fire. The status
        // line disappearing proves the new auth state was applied.
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(screen.queryByTestId('progress-sync-status')).toBeNull()
        );

        resolveFirst(serverResponse({ progress: {} }));
        await taskTurn();
        expect(progressCalls(fetchMock)).toHaveLength(1);
    });

    it('shows syncing again while a restored-page retry is still unseen', async () => {
        let resolveSecond!: (response: Response) => void;
        const progressResponses = [
            () => Promise.resolve(serverResponse({ progress: {} })),
            () =>
                new Promise<Response>(resolve => {
                    resolveSecond = resolve;
                }),
        ];
        stubSession({ user: { id: 'user-1' } });
        const fetchMock = vi.fn(() => progressResponses.shift()!());
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();

        // The retry starts now; the previous result is no longer current.
        window.dispatchEvent(restoredPageShow());
        await waitFor(() => expect(progressCalls(fetchMock)).toHaveLength(2));
        await waitFor(() =>
            expect(
                screen.getByTestId('progress-sync-status')
            ).toHaveTextContent('Syncing your progress…')
        );

        resolveSecond(serverResponse({ progress: {} }));
        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
    });

    it('shows syncing again while a retry follows a failed sync', async () => {
        let resolveSecond!: (response: Response) => void;
        const progressResponses = [
            () => Promise.reject(new TypeError('Failed to fetch')),
            () =>
                new Promise<Response>(resolve => {
                    resolveSecond = resolve;
                }),
        ];
        stubSession({ user: { id: 'user-1' } });
        const fetchMock = vi.fn(() => progressResponses.shift()!());
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(
            await screen.findByText(
                "Couldn't reach your account. Progress is kept in this browser and syncs next time."
            )
        ).toBeInTheDocument();

        window.dispatchEvent(restoredPageShow());
        await waitFor(() => expect(progressCalls(fetchMock)).toHaveLength(2));
        await waitFor(() =>
            expect(
                screen.getByTestId('progress-sync-status')
            ).toHaveTextContent('Syncing your progress…')
        );

        resolveSecond(serverResponse({ progress: {} }));
        expect(
            await screen.findByText('Your progress is saved to your account')
        ).toBeInTheDocument();
    });

    it('revalidates the session and syncs when a signed-in visitor returns to a signed-out cached page', async () => {
        stubSession({ user: { id: 'user-1' } });
        const fetchMock = vi.fn(() =>
            Promise.resolve(
                serverResponse({
                    progress: {
                        the_seventh_mirror: {
                            sceneId: 'ch2_act1',
                            dialogueIndex: 3,
                            updatedAt: 20,
                            finished: false,
                            endings: [],
                        },
                    },
                })
            )
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-out' });
        expect(screen.queryByTestId('progress-sync-status')).toBeNull();

        window.dispatchEvent(restoredPageShow());

        const strip = await screen.findByTestId('continue-reading');
        expect(strip).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch2_act1&dialogue=4'
        );
        expect(progressCalls(fetchMock)).toHaveLength(1);
    });

    it('stays local-only when the revalidated session is still signed out', async () => {
        stubSession(null);
        const fetchMock = vi.fn(() =>
            Promise.resolve(serverResponse({ progress: {} }))
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-out' });
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(vi.mocked(authClient.getSession)).toHaveBeenCalled()
        );

        expect(progressCalls(fetchMock)).toHaveLength(0);
    });

    it('ignores a slower session reply from an earlier restore', async () => {
        let resolveSlow!: (value: unknown) => void;
        vi.mocked(authClient.getSession)
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        resolveSlow = resolve;
                    })
            )
            .mockResolvedValue({ data: null, error: null } as never);
        const fetchMock = vi.fn(() =>
            Promise.resolve(serverResponse({ progress: {} }))
        );
        vi.stubGlobal('fetch', fetchMock);
        saveProgress({
            elevator_game: {
                sceneId: 'b1a_act4',
                dialogueIndex: 9,
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            },
        });

        renderSelect({ authState: 'signed-out' });
        // The first restore's session request hangs; the second restore's
        // answers signed-out first, and that newer answer is the one the
        // page must keep.
        window.dispatchEvent(restoredPageShow());
        window.dispatchEvent(restoredPageShow());
        await taskTurn();

        resolveSlow({ data: { user: { id: 'user-1' } }, error: null });
        await taskTurn();

        // The stale reply is dropped: no sync fires and the status never
        // flips to a signed-in line.
        expect(progressCalls(fetchMock)).toHaveLength(0);
        expect(screen.getByTestId('progress-sync-status')).toHaveTextContent(
            'Progress is saved in this browser only.'
        );
    });
});
