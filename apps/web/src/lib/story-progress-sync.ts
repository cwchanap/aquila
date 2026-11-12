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
     *  tab that outlived its sign-in). A local map tagged for a different
     *  account is never uploaded — sync downloads that account's map and
     *  replaces the local copy instead, so shared-browser progress cannot
     *  leak between accounts. */
    accountId: string;
}

export type StoryProgressSyncResult =
    | { ok: true }
    | {
          ok: false;
          /** True when the local store failed (unreadable map or
           *  uncommittable merge) — the request may never have left this
           *  browser. False when the request or its response failed. */
          local: boolean;
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

    return readProgressResponse(
        await fetch(PROGRESS_ENDPOINT, {
            ...init,
            signal: AbortSignal.timeout(options.timeoutMs),
        })
    );
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
 * Pushes the browser's progress to the account and pulls the merged copy.
 * Only a caller that already knows the visitor is signed in should invoke
 * it, and it must pass that account's id: a map tagged for a different
 * account is quarantined — replaced by the signed-in account's download
 * rather than uploaded — so one user's progress never enters another's row.
 */
export async function syncStoryProgress(
    options: SyncStoryProgressOptions
): Promise<StoryProgressSyncResult> {
    const store = new StoryProgressStore(getBrowserStorage());
    const fail = (local: boolean, error: unknown): StoryProgressSyncResult => ({
        ok: false,
        local,
        error,
    });
    try {
        const owner = store.getOwner();
        const foreignOwned = owner !== null && owner !== options.accountId;
        let upload: StoryProgressMap = {};
        let preflight: StoryProgressMap | null = null;
        if (foreignOwned) {
            // Snapshot the foreign copy before the request so records that
            // change while it is in flight can be told apart from the
            // previous account's data being discarded.
            preflight = store.getAllChecked();
            if (!preflight)
                return fail(true, new Error('Local progress is unavailable'));
        } else {
            const local = store.getAllChecked();
            if (!local)
                return fail(true, new Error('Local progress is unavailable'));
            // Bounding happens on write too, but a map saved before the
            // bound existed would otherwise 413 every sync.
            upload = boundStoryProgressMap(local);
        }
        const payload = await postProgress(upload, options);
        const stored = serverProgress(payload);
        if (!stored) {
            return fail(false, new Error('Invalid progress response'));
        }
        if (foreignOwned) {
            const current = store.getAllChecked();
            if (!current)
                return fail(true, new Error('Could not save merged progress'));
            // Discard the other account's copy — its data already lives in
            // that account's cloud row — but keep records that changed
            // while the request was in flight: a position recorded behind
            // the pending sync is this account's reading, not the previous
            // owner's, and the replacement must not erase it. Merging the
            // whole pre-request map would re-seed the foreign copy instead.
            const kept: StoryProgressMap = {};
            for (const [id, record] of Object.entries(current)) {
                if (
                    JSON.stringify(preflight?.[id]) !== JSON.stringify(record)
                ) {
                    kept[id] = record;
                }
            }
            if (
                !store.replaceAll(
                    mergeStoryProgressMaps(kept, stored),
                    options.accountId
                )
            ) {
                return fail(true, new Error('Could not save merged progress'));
            }
            return { ok: true };
        }
        // A line can be read while the request is in flight; merge into the
        // freshest local copy so a late response cannot erase it. update()
        // performs the whole read/merge/write in one store operation so a
        // failed read is never mistaken for an empty map and committed —
        // and the owner tag commits in the same write, so a stored map can
        // never be left synced-but-untagged for the next account.
        if (
            !store.update(
                current => mergeStoryProgressMaps(current, stored),
                options.accountId
            )
        ) {
            return fail(true, new Error('Could not save merged progress'));
        }
        return { ok: true };
    } catch (error) {
        return fail(false, error);
    }
}
