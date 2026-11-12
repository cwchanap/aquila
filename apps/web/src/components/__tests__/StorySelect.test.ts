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
import StorySelect from '../StorySelect.svelte';
import { STORY_PROGRESS_KEY } from '../../lib/story-progress-store';

function renderSelect(
    props: { locale?: Locale; authState?: AuthState } = {}
): ReturnType<typeof render> {
    return render(StorySelect, {
        props: { locale: 'en', authState: 'signed-out', ...props },
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

const SESSION_URL = '/api/auth/get-session';

function sessionResponse(data: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => data,
    } as Response;
}

/** Calls to the sync endpoint only; a persisted restore also re-reads the
 *  session, so bare call counts no longer measure progress requests. */
function progressCalls(
    fetchMock: ReturnType<typeof vi.fn>
): Array<[unknown, RequestInit]> {
    return fetchMock.mock.calls.filter(([url]) => url === '/api/progress');
}

const restoredPageShow = () =>
    Object.assign(new Event('pageshow'), { persisted: true });

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
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
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
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(sessionResponse(null))
        );
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

    it('shows nothing and makes no requests when auth is unavailable', () => {
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

        renderSelect({ authState: 'unavailable' });

        expect(screen.queryByTestId('progress-sync-status')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse({ user: { id: 'user-1' } }))
                : progressResponses.shift()!()
        );
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse({ user: { id: 'user-1' } }))
                : progressResponses.shift()!()
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(progressCalls(fetchMock)).toHaveLength(1);

        window.dispatchEvent(restoredPageShow());
        window.dispatchEvent(restoredPageShow());
        expect(progressCalls(fetchMock)).toHaveLength(1);

        resolveFirst(serverResponse({ progress: {} }));
        await waitFor(() => expect(progressCalls(fetchMock)).toHaveLength(2));
        // Both joins share the single queued pass — no third request fires.
        await Promise.resolve();
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
        const sessionResponses = [
            () => Promise.resolve(sessionResponse({ user: { id: 'user-1' } })),
            () => Promise.resolve(sessionResponse(null)),
        ];
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? sessionResponses.shift()!()
                : progressResponses.shift()!()
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-in' });
        expect(progressCalls(fetchMock)).toHaveLength(1);

        // Still signed in: the join queues a follow-up behind the request.
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([url]) => url === SESSION_URL)
            ).toBe(true)
        );
        // The next restore revalidates to signed-out before the first
        // request settles, so the queued pass must not fire. The status
        // line disappearing proves the new auth state was applied.
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(screen.queryByTestId('progress-sync-status')).toBeNull()
        );

        resolveFirst(serverResponse({ progress: {} }));
        await Promise.resolve();
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse({ user: { id: 'user-1' } }))
                : progressResponses.shift()!()
        );
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse({ user: { id: 'user-1' } }))
                : progressResponses.shift()!()
        );
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse({ user: { id: 'user-1' } }))
                : Promise.resolve(
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
        const fetchMock = vi.fn((input: unknown) =>
            input === SESSION_URL
                ? Promise.resolve(sessionResponse(null))
                : Promise.resolve(serverResponse({ progress: {} }))
        );
        vi.stubGlobal('fetch', fetchMock);

        renderSelect({ authState: 'signed-out' });
        window.dispatchEvent(restoredPageShow());
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([url]) => url === SESSION_URL)
            ).toBe(true)
        );

        expect(progressCalls(fetchMock)).toHaveLength(0);
    });
});
