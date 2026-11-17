// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { Locale } from '@aquila/stories';
import { STORY_CATALOG } from '@aquila/stories/catalog';
import type { AuthState } from '../../lib/auth-utils';
import { authClient } from '../../lib/auth-client';
import MyProgress from '../MyProgress.svelte';
import { storyProgressKey } from '../../lib/story-progress-store';

const NOW = new Date('2024-01-01T00:00:00.000Z').getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function renderProgress(
    props: {
        locale?: Locale;
        authState?: AuthState;
        userId?: string | null;
    } = {}
): ReturnType<typeof render> {
    return render(MyProgress, {
        props: {
            locale: 'en',
            authState: 'signed-out',
            userId: null,
            ...props,
        },
    });
}

function saveProgress(
    map: Record<string, unknown>,
    accountId: string | null = null
): void {
    localStorage.setItem(storyProgressKey(accountId), JSON.stringify(map));
}

function serverResponse(payload: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => payload,
    } as Response;
}

function progressCalls(
    fetchMock: ReturnType<typeof vi.fn>
): Array<[unknown, RequestInit]> {
    return fetchMock.mock.calls.filter(([url]) => url === '/api/progress');
}

const taskTurn = () => vi.advanceTimersByTimeAsync(0);

function rowLink(id: string): HTMLAnchorElement {
    const link = document.querySelector<HTMLAnchorElement>(
        `a[data-story-id="${id}"]`
    );
    if (!link) throw new Error(`no row for ${id}`);
    return link;
}

const LOCAL_PROGRESS = {
    train_adventure: {
        sceneId: 'act2',
        dialogueIndex: 4,
        updatedAt: NOW - HOUR,
        finished: false,
        endings: [],
    },
    the_seventh_mirror: {
        sceneId: 'ch2_act1',
        dialogueIndex: 0,
        updatedAt: NOW - 2 * HOUR,
        finished: false,
        endings: [],
    },
    demon_lord_is_hiring: {
        sceneId: 'end',
        dialogueIndex: 0,
        updatedAt: NOW - 3 * DAY,
        finished: true,
        endings: ['a', 'b', 'c'],
    },
    elevator_game: {
        sceneId: 'b1a_act4',
        dialogueIndex: 9,
        updatedAt: NOW - 5 * DAY,
        finished: true,
        endings: ['b1a_act4'],
    },
};

describe('MyProgress', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(authClient.getSession).mockReset();
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: null,
        } as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('shows local progress, counts and recent-first rows when signed out', () => {
        saveProgress(LOCAL_PROGRESS);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        renderProgress();

        expect(screen.getByTestId('save-card')).toHaveTextContent(
            'Saved in this browser only'
        );
        const tip = screen.getByRole('link', { name: 'Sign in' });
        expect(tip).toHaveAttribute('href', '/en/login');

        expect(screen.getByTestId('count-started')).toHaveTextContent('4');
        expect(screen.getByTestId('count-started')).toHaveTextContent('8');
        expect(screen.getByTestId('count-finished')).toHaveTextContent('2');
        expect(screen.getByTestId('count-endings')).toHaveTextContent('4');
        expect(screen.getByTestId('count-endings')).toHaveTextContent(
            String(STORY_CATALOG.reduce((n, e) => n + e.stats.endings, 0))
        );

        const rows = document.querySelectorAll('a[data-story-id]');
        expect([...rows].map(r => r.getAttribute('data-story-id'))).toEqual([
            'train_adventure',
            'the_seventh_mirror',
            'demon_lord_is_hiring',
            'elevator_game',
        ]);
        expect(rowLink('train_adventure')).toHaveTextContent(
            'Last read 1 hour ago'
        );
        expect(progressCalls(fetchMock)).toHaveLength(0);
    });

    it('still offers the sign-in tip with an empty save and shows the empty state', () => {
        renderProgress();

        expect(screen.getByTestId('save-card')).toHaveTextContent(
            'Saved in this browser only'
        );
        expect(
            screen.getByRole('link', { name: 'Sign in' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Nothing read yet' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Browse stories' })
        ).toHaveAttribute('href', '/en/stories');
        expect(screen.queryByTestId('count-started')).toBeNull();
    });

    it('tells a signed-out reader when saved progress cannot be read instead of claiming nothing was read', () => {
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
        try {
            renderProgress();

            expect(screen.getByTestId('read-error')).toHaveTextContent(
                "Couldn't read your progress"
            );
            expect(
                screen.queryByRole('heading', { name: 'Nothing read yet' })
            ).toBeNull();
            expect(screen.queryByTestId('count-started')).toBeNull();
            expect(
                screen.queryAllByRole('link', { name: /Continue/ })
            ).toHaveLength(0);
            expect(progressCalls(fetchMock)).toHaveLength(0);
            expect(
                original.call(localStorage, storyProgressKey(null))
            ).toBeNull();
        } finally {
            getSpy.mockRestore();
        }
    });

    it('shows the read-error state for malformed persisted JSON without touching the saved bytes', () => {
        localStorage.setItem(storyProgressKey(null), '{broken');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        renderProgress();

        expect(screen.getByTestId('read-error')).toHaveTextContent(
            "couldn't read"
        );
        expect(
            screen.queryByRole('heading', { name: 'Nothing read yet' })
        ).toBeNull();
        expect(localStorage.getItem(storyProgressKey(null))).toBe('{broken');
        expect(progressCalls(fetchMock)).toHaveLength(0);
    });

    it('shows the read-error state without a sign-in tip when auth is unavailable and the map is unreadable', async () => {
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: { message: 'down' },
        } as never);
        localStorage.setItem(storyProgressKey(null), '{broken');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        renderProgress({ authState: 'unavailable' });
        await taskTurn();

        const card = screen.getByTestId('save-card');
        expect(card).toHaveTextContent('Showing progress in this browser');
        expect(
            within(card).queryByRole('link', { name: 'Sign in' })
        ).toBeNull();
        expect(screen.getByTestId('read-error')).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Nothing read yet' })
        ).toBeNull();
        expect(localStorage.getItem(storyProgressKey(null))).toBe('{broken');
        expect(progressCalls(fetchMock)).toHaveLength(0);
    });

    it('shows the localized read-error state in zh', () => {
        localStorage.setItem(storyProgressKey(null), '{broken');
        renderProgress({ locale: 'zh' });

        expect(screen.getByTestId('read-error')).toHaveTextContent(
            '無法讀取您的進度'
        );
        expect(
            screen.queryByRole('heading', { name: '還沒有閱讀紀錄' })
        ).toBeNull();
    });

    it('shows local progress without a sign-in tip when auth is unavailable', async () => {
        vi.mocked(authClient.getSession).mockResolvedValue({
            data: null,
            error: { message: 'down' },
        } as never);
        saveProgress(LOCAL_PROGRESS);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        renderProgress({ authState: 'unavailable' });
        await taskTurn();

        const card = screen.getByTestId('save-card');
        expect(card).toHaveTextContent('Showing progress in this browser');
        expect(
            within(card).queryByRole('link', { name: 'Sign in' })
        ).toBeNull();
        expect(screen.getByTestId('count-started')).toHaveTextContent('4');
        expect(progressCalls(fetchMock)).toHaveLength(0);
    });

    it('announces cloud save as synced after a signed-in sync succeeds', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);
        renderProgress({ authState: 'signed-in', userId: 'user-1' });
        await taskTurn();

        const card = screen.getByTestId('save-card');
        expect(card).toHaveTextContent('Cloud save is on');
        expect(within(card).getByRole('status')).toHaveTextContent('Synced');
        expect(progressCalls(fetchMock).length).toBeGreaterThan(0);
    });

    it('announces a readable failure when signed-in sync fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('fetch', fetchMock);
        renderProgress({ authState: 'signed-in', userId: 'user-1' });
        await taskTurn();

        const card = screen.getByTestId('save-card');
        expect(within(card).getByRole('status')).toHaveTextContent(
            'Not synced'
        );
        expect(card).toHaveTextContent("Couldn't reach your account");
    });

    it('marks the chip as saved to the account when only the local copy fails', async () => {
        const accountKey = storyProgressKey('user-1');
        const origSetItem = Storage.prototype.setItem;
        const setSpy = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(function (
                this: Storage,
                key: string,
                value: string
            ) {
                if (key === accountKey) {
                    throw new Error('QuotaExceededError');
                }
                origSetItem.call(this, key, value);
            });
        const fetchMock = vi
            .fn()
            .mockResolvedValue(serverResponse({ progress: {} }));
        vi.stubGlobal('fetch', fetchMock);

        try {
            renderProgress({ authState: 'signed-in', userId: 'user-1' });
            await taskTurn();

            const card = screen.getByTestId('save-card');
            expect(within(card).getByRole('status')).toHaveTextContent(
                'Synced to account'
            );
            expect(within(card).getByRole('status')).not.toHaveTextContent(
                'Not synced'
            );
            expect(card).toHaveTextContent(
                "this browser couldn't save the updated copy locally"
            );
        } finally {
            setSpy.mockRestore();
        }
    });

    it('names each row link with its title and its action', () => {
        saveProgress(LOCAL_PROGRESS);
        renderProgress();

        expect(rowLink('train_adventure')).toHaveAccessibleName(
            'The Platform at the End of the World Continue'
        );
        expect(rowLink('demon_lord_is_hiring')).toHaveAccessibleName(
            'The Demon Lord Is Hiring Read again'
        );
    });

    it('links each row to its saved place and omits last-read for epoch-stamped records', () => {
        saveProgress({
            train_adventure: {
                sceneId: 'act2',
                dialogueIndex: 4,
                updatedAt: 0,
                finished: false,
                endings: [],
            },
        });
        renderProgress();

        const row = rowLink('train_adventure');
        expect(row).toHaveAccessibleName();
        expect(row.getAttribute('href')).toBe(
            '/en/reader?story=train_adventure&scene=act2&dialogue=5'
        );
        expect(row).not.toHaveTextContent('Last read');
    });

    it('links a finished story to a fresh read', () => {
        saveProgress({
            demon_lord_is_hiring: {
                sceneId: 'end',
                dialogueIndex: 0,
                updatedAt: NOW - DAY,
                finished: true,
                endings: ['a'],
            },
        });
        renderProgress();

        const row = rowLink('demon_lord_is_hiring');
        expect(row.getAttribute('href')).toContain('restart=1');
        expect(row).toHaveTextContent('Read again');
    });

    it('shows a Browse stories count for the stories not started', () => {
        saveProgress(LOCAL_PROGRESS);
        renderProgress();

        const browse = screen.getByTestId('browse-stories');
        expect(browse).toHaveTextContent('4 not started yet');
        expect(browse).toHaveAttribute('href', '/en/stories');
    });

    it('uses count-neutral wording when exactly one story is unstarted', () => {
        const started: Record<string, unknown> = {};
        for (const entry of STORY_CATALOG.slice(1)) {
            started[entry.id] = {
                sceneId: 'act2',
                dialogueIndex: 0,
                updatedAt: NOW - HOUR,
                finished: false,
                endings: [],
            };
        }
        saveProgress(started);
        renderProgress();

        const browse = screen.getByTestId('browse-stories');
        expect(browse).toHaveTextContent('1 not started yet');
        expect(browse).not.toHaveTextContent('1 stories');
    });

    it('renders translated chrome for zh', () => {
        saveProgress(LOCAL_PROGRESS);
        renderProgress({ locale: 'zh' });

        expect(screen.getByTestId('save-card')).toHaveTextContent(
            '僅儲存在此瀏覽器'
        );
        expect(
            screen.getByRole('heading', { name: '你的故事' })
        ).toBeInTheDocument();
        expect(rowLink('train_adventure')).toHaveTextContent('1 小時前');
        expect(rowLink('the_seventh_mirror')).toHaveAccessibleName(
            '神鏡七日 繼續'
        );
    });
});
