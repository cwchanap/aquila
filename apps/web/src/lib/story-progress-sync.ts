import type { Locale } from '@aquila/stories';
import { getBrowserStorage } from './reader-mode';
import {
    boundStoryProgressMap,
    mergeStoryProgressMaps,
    normalizeStoryProgressMap,
    type StoryProgressMap,
} from './story-progress';
import { StoryProgressStore } from './story-progress-store';

const PROGRESS_ENDPOINT = '/api/progress';

/** Bounds the reader-start wait for an account refresh. */
export const STORY_PROGRESS_SYNC_TIMEOUT_MS = 1500;

/** Bounds the story-select status request; the cards render without it, so
 *  the wait can be longer than the reader-start bound. */
export const STORY_SELECT_SYNC_TIMEOUT_MS = 10_000;

export interface SyncStoryProgressOptions {
    /** Only the reader-start wait sets this; a timeout settles as an error. */
    timeoutMs?: number;
    /** Best-effort request during pagehide. */
    keepalive?: boolean;
    /** Account the upload belongs to — also sent in the body so the
     *  server can reject the merge when the session no longer matches (a
     *  tab that outlived its sign-in). */
    accountId: string;
    /** Preferred locale when claiming anonymous legacy reader sessions. */
    locale?: Locale;
}

export type StoryProgressSyncFailurePhase =
    'local-read' | 'remote' | 'local-save';

export type StoryProgressSyncResult =
    | { ok: true }
    | {
          ok: false;
          /** Distinguishes pre-upload local failure (`local-read`, nothing
           *  sent), network/server failure (`remote`), and post-upload local
           *  write failure (`local-save`, server already updated). */
          phase: StoryProgressSyncFailurePhase;
          error: unknown;
      };

async function readProgressResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
        throw new Error(`Progress sync failed with status ${response.status}`);
    }
    return response.json();
}

async function postProgress(
    local: StoryProgressMap,
    options: SyncStoryProgressOptions
): Promise<unknown> {
    const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ progress: local, accountId: options.accountId }),
        keepalive: options.keepalive,
    };
    if (!options.timeoutMs) {
        return readProgressResponse(await fetch(PROGRESS_ENDPOINT, init));
    }

    // AbortController + setTimeout works on Safari < 16 where AbortSignal.timeout
    // does not exist, and integrates cleanly with fake timers in tests.
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(
            new DOMException('The operation timed out.', 'TimeoutError')
        );
    }, options.timeoutMs);
    try {
        return await readProgressResponse(
            await fetch(PROGRESS_ENDPOINT, {
                ...init,
                signal: controller.signal,
            })
        );
    } finally {
        clearTimeout(timer);
    }
}

/** Validates the raw `{ progress }` reply; null means unusable. */
function serverProgress(payload: unknown): StoryProgressMap | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const progress = (payload as { progress?: unknown }).progress;
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
        return null;
    }
    return normalizeStoryProgressMap(progress);
}

/**
 * Pushes the account's browser progress and pulls the merged copy.
 * Only a caller that already knows the visitor is signed in should invoke
 * it, and it must pass that account's id. Any anonymous local progress is
 * claimed into this account's isolated key first so it rides the upload.
 */
export async function syncStoryProgress(
    options: SyncStoryProgressOptions
): Promise<StoryProgressSyncResult> {
    const store = new StoryProgressStore(
        getBrowserStorage(),
        Date.now,
        options.accountId
    );
    const fail = (
        phase: StoryProgressSyncFailurePhase,
        error: unknown
    ): StoryProgressSyncResult => ({
        ok: false,
        phase,
        error,
    });
    try {
        if (!store.claimAnonymous(options.locale)) {
            return fail(
                'local-read',
                new Error('Local progress is unavailable')
            );
        }
        const local = store.getAllChecked();
        if (!local) {
            return fail(
                'local-read',
                new Error('Local progress is unavailable')
            );
        }
        const upload = boundStoryProgressMap(local);
        const payload = await postProgress(upload, options);
        const stored = serverProgress(payload);
        if (!stored) {
            return fail('remote', new Error('Invalid progress response'));
        }
        if (!store.update(current => mergeStoryProgressMaps(current, stored))) {
            return fail(
                'local-save',
                new Error('Could not save merged progress')
            );
        }
        return { ok: true };
    } catch (error) {
        return fail('remote', error);
    }
}
