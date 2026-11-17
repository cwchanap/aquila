import type { Locale } from '@aquila/stories';
import type { AuthState } from './auth-utils';
import { authClient } from './auth-client';
import { getBrowserStorage } from './reader-mode';
import {
    StoryProgressStore,
    importSavedSessions,
    type StoryProgressMap,
} from './story-progress-store';
import {
    STORY_SELECT_SYNC_TIMEOUT_MS,
    syncStoryProgress,
} from './story-progress-sync';

export type StorySyncState =
    'idle' | 'synced' | 'failed' | 'local-failed' | 'local-save-failed';

export class StoryProgressView {
    private readonly locale: Locale;
    // The server render freezes authState and userId at SSR time; a page
    // restored from the back/forward cache can predate the visitor's last
    // sign-in or sign-out, so a persisted restore revalidates before
    // deciding to sync. The props seed a mutable copy the client re-checks.
    authState: AuthState = $state('unavailable');
    userId: string | null = $state(null);
    // Server render (and the first client frame) shows every story as
    // unread; saved progress lives in this browser only and is applied on
    // mount.
    progress: StoryProgressMap = $state({});
    syncState: StorySyncState = $state('idle');
    localReadFailed = $state(false);
    private syncInFlight: Promise<void> | null = null;
    // A join during an in-flight request sets this so exactly one
    // follow-up pass runs behind it; the running request still carries
    // the pre-restore account and progress.
    private syncRerunQueued = false;
    // Persisted restores can overlap: each one re-reads the session, and
    // only the newest may apply its answer — a slow earlier reply must
    // not reinstate a stale sign-in over a newer sign-out (or the
    // reverse). validatedSeq marks the newest restore that produced a
    // validated answer; a queued follow-up sync compares the two — a
    // restore that began but never validated leaves the retained account
    // unfit to sync on.
    private restoreSeq = 0;
    private validatedSeq = 0;

    constructor({
        locale,
        authState,
        userId,
    }: {
        locale: Locale;
        authState: AuthState;
        userId: string | null;
    }) {
        this.locale = locale;
        this.authState = authState;
        this.userId = userId;
    }

    refresh(): void {
        const storage = getBrowserStorage();
        const accountId = this.authState === 'signed-in' ? this.userId : null;
        const store = new StoryProgressStore(storage, Date.now, accountId);
        // Places saved before per-story progress existed live only in the
        // reader's per-locale session; carry them over once so an existing
        // reader still sees Continue. Signed-in visits also claim
        // anonymous progress into the account's isolated key. Both write
        // across keys, so they wait on a proven identity: a restore's
        // retained account can be stale until its session re-read
        // answers, and claiming under it would move anonymous progress to
        // the wrong owner — deleting the anonymous copies before a
        // sign-out is even discovered.
        if (this.validatedSeq === this.restoreSeq) {
            importSavedSessions(store, storage, this.locale, accountId);
            if (accountId) store.claimAnonymous(this.locale);
        }
        const map = store.getAllChecked();
        this.localReadFailed = map === null;
        this.progress = map ?? {};
    }

    /** Re-reads the session; null keeps the server-rendered state. */
    private async fetchAuthState(): Promise<{
        authState: AuthState;
        userId: string | null;
    } | null> {
        try {
            const { data, error } = await authClient.getSession();
            if (error) return null;
            return data?.user
                ? { authState: 'signed-in', userId: data.user.id }
                : { authState: 'signed-out', userId: null };
        } catch {
            return null;
        }
    }

    /** Applies a revalidated session; any validated answer — signed-in or
     *  signed-out — means auth is back, so the SSR degraded banner comes
     *  down either way. */
    private applyAuthState(refreshed: {
        authState: AuthState;
        userId: string | null;
    }): void {
        this.authState = refreshed.authState;
        this.userId = refreshed.userId;
        document.getElementById('auth-degraded-banner')?.remove();
        // The account answer changes which local map may be shown: cards
        // refresh against the now-known owner before any sync runs.
        this.refresh();
    }

    /** Re-reads the session for a cached or uncertain page and applies
     *  the answer — signed-in or signed-out, a validated result means
     *  auth is back. Only the newest restore may apply: a stale reply or
     *  a failed re-read keeps no state. */
    private async revalidateSession(): Promise<void> {
        const ticket = ++this.restoreSeq;
        const refreshed = await this.fetchAuthState();
        if (ticket !== this.restoreSeq || refreshed === null) return;
        this.validatedSeq = ticket;
        this.applyAuthState(refreshed);
        if (this.authState === 'signed-in') void this.runSync();
    }

    runSync(): Promise<void> {
        // A cached page returning mid-request joins the request already
        // running and queues one more pass behind it — the restore may
        // have observed a different account or newer local progress than
        // the running request carries.
        if (this.syncInFlight) {
            if (!this.syncRerunQueued) {
                this.syncRerunQueued = true;
                void this.syncInFlight.finally(() => {
                    this.syncRerunQueued = false;
                    // The queued pass runs only when the newest restore
                    // produced a validated session — a restore whose
                    // revalidation failed leaves the retained account
                    // unfit to sync on.
                    if (
                        this.validatedSeq === this.restoreSeq &&
                        this.authState === 'signed-in'
                    )
                        void this.runSync();
                });
            }
            return this.syncInFlight;
        }
        // A retry starts from 'idle' so the previous answer is not shown
        // as current while the new request is unanswered.
        this.syncState = 'idle';
        const run = (async () => {
            try {
                if (!this.userId) {
                    this.syncState = 'failed';
                    return;
                }
                const result = await syncStoryProgress({
                    timeoutMs: STORY_SELECT_SYNC_TIMEOUT_MS,
                    accountId: this.userId,
                    locale: this.locale,
                });
                this.syncState = result.ok
                    ? 'synced'
                    : result.phase === 'local-read'
                      ? 'local-failed'
                      : result.phase === 'local-save'
                        ? 'local-save-failed'
                        : 'failed';
            } catch {
                this.syncState = 'failed';
            } finally {
                this.syncInFlight = null;
                this.refresh();
            }
        })();
        this.syncInFlight = run;
        return run;
    }

    mount(): () => void {
        this.refresh();
        if (this.authState === 'signed-in') void this.runSync();
        // An SSR 'unavailable' is often a slow cold start, not an outage
        // — one background session re-read decides whether this visit
        // can sync.
        if (this.authState === 'unavailable') void this.revalidateSession();
        // Returning with the Back button can restore this page from the
        // back/forward cache; re-read so the cards show the latest place.
        const onPageShow = (event: Event) => {
            if (!(event as Event & { persisted?: boolean }).persisted) return;
            // The ticket bump marks the retained account unproven, so
            // the refresh below re-reads cards without seeding or
            // claiming under it — those writes resume once the session
            // answer lands.
            void this.revalidateSession();
            this.refresh();
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }
}
