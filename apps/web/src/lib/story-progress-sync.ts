import { getBrowserStorage } from './reader-mode';
import {
    mergeStoryProgressMaps,
    normalizeStoryProgressMap,
    type StoryProgressMap,
} from './story-progress';
import { StoryProgressStore } from './story-progress-store';

const PROGRESS_ENDPOINT = '/api/progress';

/** Bounds the reader-start wait for an account refresh. */
export const STORY_PROGRESS_SYNC_TIMEOUT_MS = 1500;

export interface SyncStoryProgressOptions {
    /** Only the reader-start wait sets this; a timeout settles as an error. */
    timeoutMs?: number;
    /** Best-effort request during pagehide. */
    keepalive?: boolean;
}

export type StoryProgressSyncResult =
    { ok: true } | { ok: false; error: unknown };

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
        body: JSON.stringify({ progress: local }),
        keepalive: options.keepalive,
    };
    if (!options.timeoutMs) {
        return readProgressResponse(await fetch(PROGRESS_ENDPOINT, init));
    }

    // Race the timer against the request itself: a fetch that ignores the
    // abort signal must still settle the caller at the deadline.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Progress sync timed out'));
        }, options.timeoutMs);
    });
    try {
        return await Promise.race([
            (async () =>
                readProgressResponse(
                    await fetch(PROGRESS_ENDPOINT, {
                        ...init,
                        signal: controller.signal,
                    })
                ))(),
            timeout,
        ]);
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
 * Pushes the browser's progress to the account and pulls the merged copy.
 * Only a caller that already knows the visitor is signed in should invoke it.
 */
export async function syncStoryProgress(
    options: SyncStoryProgressOptions = {}
): Promise<StoryProgressSyncResult> {
    const store = new StoryProgressStore(getBrowserStorage());
    try {
        const payload = await postProgress(store.getAll(), options);
        const stored = serverProgress(payload);
        if (!stored) throw new Error('Invalid progress response');
        // A line can be read while the request is in flight; merge into the
        // freshest local copy so a late response cannot erase it.
        store.replaceAll(mergeStoryProgressMaps(store.getAll(), stored));
        return { ok: true };
    } catch (error) {
        return { ok: false, error };
    }
}
