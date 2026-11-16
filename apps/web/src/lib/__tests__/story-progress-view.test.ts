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
        // The helper is per-instance, not a singleton: a signed-in view
        // reads and syncs its own account map while a signed-out view on
        // the same page keeps showing the anonymous one.
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

            // The signed-in view claimed the anonymous place and shows
            // the cloud-only story; the signed-out view keeps the
            // anonymous snapshot it read at mount and never saw the
            // other instance's download.
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

        // After cleanup the pageshow listener is gone: a later restore is
        // not this view's to answer anymore.
        dispose();
        window.dispatchEvent(restoredPageShow());
        await taskTurn();
        expect(vi.mocked(authClient.getSession)).toHaveBeenCalledTimes(1);
    });
});
