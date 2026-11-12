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
        // A copy sidelined for this account merges back before anything
        // else reads owner or map — it is this account's own data waiting
        // to be claimed, so it belongs to the upload.
        store.restoreSidelined(options.accountId);
        const owner = store.getOwner();
        const foreignOwned = owner !== null && owner !== options.accountId;
        let upload: StoryProgressMap = {};
        if (foreignOwned) {
            // The foreign map is downloaded, not uploaded — but a copy
            // sidelined for this account is still its own data. It rides
            // the request so the restore after the commit does not report
            // success while leaving those records unuploaded.
            upload = boundStoryProgressMap(
                store.getSidelined(options.accountId)
            );
        } else {
            const local = store.getAllChecked();
            if (!local)
                return fail(true, new Error('Local progress is unavailable'));
            // Bounding happens on write too, but a map saved before the
            // bound existed would otherwise 413 every sync.
            upload = boundStoryProgressMap(local);
            // An unowned map is claimed before it can upload: if the
            // request reaches the server but its response or the commit
            // is lost, the copy stays tagged for this account — untagged,
            // it would upload again under the next account to sign in on
            // this browser. The claim only lands while the map is still
            // unowned: a tag that appears meanwhile belongs to someone
            // else and aborts the upload.
            if (owner === null && !store.setOwner(options.accountId, null)) {
                return fail(true, new Error('Local progress is unavailable'));
            }
        }
        const payload = await postProgress(upload, options);
        const stored = serverProgress(payload);
        if (!stored) {
            return fail(false, new Error('Invalid progress response'));
        }
        if (foreignOwned) {
            const current = store.getWithOwnerChecked();
            if (!current)
                return fail(true, new Error('Could not save merged progress'));
            // Whose records survive the download depends on who owns the
            // map now: this account's own record() quarantines and retags
            // the map, so owner === accountId proves the in-flight records
            // are this account's and merges them with the response. The
            // previous owner's tag means everything in flight is still
            // theirs — the download replaces the map (their copy is
            // sidelined, and their reader sessions go with it). Any other
            // tag means a third account claimed the map behind the
            // request; its data is not this sync's to merge or to discard.
            const committed =
                current.owner === options.accountId
                    ? store.update(
                          map => mergeStoryProgressMaps(map, stored),
                          options.accountId,
                          options.accountId
                      )
                    : current.owner === owner
                      ? store.replaceAll(stored, options.accountId)
                      : false;
            if (!committed) {
                return fail(true, new Error('Could not save merged progress'));
            }
            store.dropReaderSessions();
            store.restoreSidelined(options.accountId);
            return { ok: true };
        }
        // A line can be read while the request is in flight; merge into the
        // freshest local copy so a late response cannot erase it. update()
        // performs the whole read/merge/write in one store operation so a
        // failed read is never mistaken for an empty map and committed —
        // the owner tag commits in the same write, and the expected-owner
        // check refuses the merge if the map changed hands behind the
        // request.
        if (
            !store.update(
                current => mergeStoryProgressMaps(current, stored),
                options.accountId,
                options.accountId
            )
        ) {
            return fail(true, new Error('Could not save merged progress'));
        }
        store.restoreSidelined(options.accountId);
        return { ok: true };
    } catch (error) {
        return fail(false, error);
    }
}
