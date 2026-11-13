import type { Locale, DialogueEntry, ChoiceDefinition } from '@aquila/stories';
import {
    loadStoryContent,
    StoryLoadError,
    type AsyncStoryLoaderResult,
} from '@aquila/stories/async';
import { getTranslations } from '@aquila/stories/translations';
import { mount, unmount } from 'svelte';
import { showAlert, showPrompt } from './ui-dialogs';
import { LocalBookmarksStore } from './local-bookmarks-store';
import {
    StoryProgressStore,
    importSavedSessions,
    type StoryProgress,
} from './story-progress-store';
import { getBrowserStorage } from './reader-mode';
import { readerState } from './reader-state.svelte';
import { isEndingPosition } from './reader-interaction';
import {
    migratePersisted,
    serializeSessionParams,
    clampIndex,
    STORAGE_VERSION,
    READER_SESSION_KEY_PREFIX,
    type ReaderSessionState,
    type PersistedSession,
} from './reader-session';
import {
    selectReaderIntent,
    validateLoadedIntent,
    type IntentSelection,
    type LoadedIntentPhase,
    type ReaderIntent,
} from './reader-intent';
import type { AuthState } from './auth-utils';
import { authClient } from './auth-client';
import {
    STORY_PROGRESS_SYNC_TIMEOUT_MS,
    syncStoryProgress,
} from './story-progress-sync';

/** Minimum gap between ordinary cloud pushes while reading. */
const CLOUD_PUSH_INTERVAL_MS = 60_000;

export interface ReaderManagerDependencies {
    loadStoryContent?: typeof loadStoryContent;
    selectReaderIntent?: typeof selectReaderIntent;
    loadReaderShell?: () => Promise<
        typeof import('@/components/ReaderShell.svelte')
    >;
    /** Server-derived auth state; an unwired caller can never sync. */
    authState?: AuthState;
    /** The signed-in account's id; sync uploads nothing without it. */
    userId?: string | null;
}

export class ReaderManager {
    private readerInstance: { unmount: () => void } | null = null;
    private readonly initialLocale: Locale;
    private readonly deps: {
        loadStoryContent: typeof loadStoryContent;
        selectReaderIntent: typeof selectReaderIntent;
        loadReaderShell: () => Promise<
            typeof import('@/components/ReaderShell.svelte')
        >;
        defaultStoryId: string;
    };
    // Auth state is mutable: an SSR 'unavailable' is re-checked once in the
    // background, and its answer decides whether this visit can sync.
    private authState: AuthState;
    private userId: string | null;
    private readonly localBookmarks: LocalBookmarksStore;
    private readonly storyProgress: StoryProgressStore;
    private activeStory: AsyncStoryLoaderResult | null = null;
    private pendingIntent: ReaderIntent | null = null;
    private loadGeneration = 0;
    private destroyed = false;
    private readerMountPromise: Promise<void> | null = null;

    // Throttled-write state for line-by-line index changes. rAF coalesces
    // rapid onIndexChange reports so each animation frame produces at most one
    // replaceState; persistTimer debounces the localStorage write.
    // rafId holds either a rAF handle (number) or a setTimeout fallback handle
    // (ReturnType<typeof setTimeout>); rafIsTimeout discriminates which so the
    // cancel path uses clearTimeout vs cancelAnimationFrame.
    private rafId: number | ReturnType<typeof setTimeout> | null = null;
    private rafIsTimeout = false;
    // Generation counter for the pending replaceState callback. Bumped on
    // cancel/flush/destroy so a queued fallback (setTimeout) callback cannot
    // later invoke syncUrl after popstate/pagehide has torn down the pending
    // write.
    private replaceGen = 0;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    // Cloud sync state. lastPushAt is the leading edge of the ordinary
    // once-per-minute push (performance.now, so wall-clock moves cannot
    // stall or duplicate pushes); keepaliveSent makes
    // visibilitychange+pagehide produce at most one request per hide.
    // progressDirty tracks whether anything recorded locally is still
    // waiting for its first successful upload — a hide with nothing new to
    // send makes no request. recordSeq stamps each record() so a push
    // settling mid-record cannot mark that new position as uploaded.
    // -Infinity rather than 0: performance.now() counts from navigation
    // start, so a 0 stamp would throttle every push in the first minute of
    // the visit — including the first one on links that never stamp it.
    private lastPushAt = Number.NEGATIVE_INFINITY;
    private keepaliveSent = false;
    private progressDirty = true;
    private recordSeq = 0;
    // Session re-reads can overlap across a persisted pageshow and a
    // visibility change, and replies may arrive out of order. Only the
    // newest request may apply its answer — a stale reply must not put a
    // previous account back over a newer sign-in.
    private authCheckSeq = 0;
    // The last position this tab recorded or restored. A lifecycle flush
    // that finds the position unchanged must not write again: record()
    // stamps a fresh updatedAt, and the keepalive upload would win the
    // server's timestamp merge over a newer position from another device.
    private lastRecordedPosition: {
        storyId: string;
        sceneId: string;
        dialogueIndex: number;
        atEnding: boolean;
    } | null = null;
    // Guard against double-invocation: a second initialize() would register
    // a duplicate set of popstate/pagehide/visibilitychange listeners and
    // start a second initial load. renderReader has its own mount guard, but
    // the listeners do not.
    private initialized = false;

    private static readonly LEGACY_KEYS = [
        'aquila:currentScene',
        'aquila:currentScene:en',
        'aquila:currentScene:zh',
    ];

    constructor(
        locale: Locale,
        defaultStoryId?: string,
        dependencies: ReaderManagerDependencies = {}
    ) {
        this.initialLocale = locale;
        this.deps = {
            loadStoryContent: dependencies.loadStoryContent ?? loadStoryContent,
            selectReaderIntent:
                dependencies.selectReaderIntent ?? selectReaderIntent,
            loadReaderShell:
                dependencies.loadReaderShell ??
                (() => import('@/components/ReaderShell.svelte')),
            defaultStoryId: defaultStoryId || 'the_seventh_mirror',
        };
        this.authState = dependencies.authState ?? 'signed-out';
        this.userId = dependencies.userId ?? null;

        readerState.dialogue = [];
        readerState.choice = null;
        readerState.currentSceneId = '';
        readerState.storyId = '';
        readerState.canGoNext = false;
        readerState.locale = locale;
        readerState.dialogueIndex = 0;
        readerState.loadStatus = 'idle';
        readerState.loadError = null;
        readerState.hasActivePayload = false;
        readerState.activeFlow = null;
        readerState.activeChoices = null;

        this.purgeLegacyState();
        this.localBookmarks = new LocalBookmarksStore(locale);
        this.storyProgress = new StoryProgressStore(getBrowserStorage());
        // The first persist() replaces this locale's session, which may be
        // the only copy of a place saved before per-story progress existed
        // (for example when a direct link opens a different story).
        importSavedSessions(
            this.storyProgress,
            getBrowserStorage(),
            this.initialLocale
        );
    }

    private get storageKey(): string {
        return `${READER_SESSION_KEY_PREFIX}:${this.initialLocale}`;
    }

    private purgeLegacyState(): void {
        if (typeof window === 'undefined') {
            return;
        }

        for (const key of ReaderManager.LEGACY_KEYS) {
            localStorage.removeItem(key);
        }
    }

    private get t() {
        return getTranslations(readerState.locale);
    }

    private getSceneNode(storyId: string, sceneId: string) {
        const flow =
            this.activeStory && storyId === readerState.storyId
                ? this.activeStory.flow
                : null;
        return flow?.nodes.find(
            (n): n is Extract<typeof n, { kind: 'scene' }> =>
                n.kind === 'scene' && n.sceneId === sceneId
        );
    }

    /** The next SCENE id when the scene advances linearly; null at a terminal
     *  scene or a choice point (a choice point is driven by the choice UI). */
    private getLinearNextScene(sceneId: string): string | null {
        const next = this.getSceneNode(readerState.storyId, sceneId)?.next;
        if (!next || next.startsWith('choice:')) return null;
        return next;
    }

    private hasNextScene(sceneId: string): boolean {
        return this.getLinearNextScene(sceneId) !== null;
    }

    private selectInitialIntent(): IntentSelection {
        const params = new URLSearchParams(window.location.search);
        const storyId = params.get('story');
        // A map tagged for another account is not this account's to resume
        // from — the saved session beside it belongs to that account too,
        // so both fallbacks stay unused until a sync or a record clears
        // the foreign tag.
        const foreign = this.storyProgress.isForeignTo(this.userId);
        if (
            storyId &&
            !params.has('scene') &&
            !params.has('dialogue') &&
            params.get('restart') !== '1' &&
            !foreign
        ) {
            const progress = this.storyProgress.get(storyId);
            if (progress) {
                params.set('scene', progress.sceneId);
                params.set('dialogue', String(progress.dialogueIndex + 1));
            }
        }
        const raw = foreign ? null : localStorage.getItem(this.storageKey);
        let persisted: PersistedSession | null = null;
        if (raw) {
            try {
                persisted = migratePersisted(
                    JSON.parse(raw),
                    this.initialLocale
                );
            } catch (e) {
                console.error('Failed to parse saved state', e);
            }
        }
        return this.deps.selectReaderIntent(
            params,
            persisted,
            this.initialLocale,
            { defaultStoryId: this.deps.defaultStoryId }
        );
    }

    private applySession(
        state: ReaderSessionState,
        payload: AsyncStoryLoaderResult
    ): void {
        this.activeStory = payload;
        readerState.activeFlow = payload.flow;
        readerState.activeChoices = payload.choices;
        readerState.storyId = state.storyId;
        readerState.currentSceneId = state.sceneId;
        readerState.locale = state.locale;
        readerState.dialogueIndex = state.dialogueIndex;
        const { dialogue, choice } = this.getSceneData(
            state.storyId,
            state.sceneId
        );
        readerState.dialogue = dialogue;
        readerState.choice = choice;
        readerState.canGoNext = this.hasNextScene(state.sceneId);
        readerState.endingOpen = false;
        readerState.hasActivePayload = true;
        readerState.loadStatus = 'ready';
        readerState.loadError = null;
        // A restored position counts as recorded only when the store already
        // holds it. A back/forward destination that differs from the stored
        // record must still be written by the persist() that follows.
        const atEnding = isEndingPosition(
            payload.flow,
            state.sceneId,
            state.dialogueIndex,
            dialogue.length,
            Boolean(choice)
        );
        this.lastRecordedPosition = this.recordMatchesStore(
            state.storyId,
            state.sceneId,
            state.dialogueIndex,
            atEnding
        )
            ? {
                  storyId: state.storyId,
                  sceneId: state.sceneId,
                  dialogueIndex: state.dialogueIndex,
                  atEnding,
              }
            : null;
    }

    /** True when the stored record already describes this position — the
     *  same ending flag, the ending already collected, and the scene already
     *  visited — so record() would only re-stamp updatedAt. */
    private recordMatchesStore(
        storyId: string,
        sceneId: string,
        dialogueIndex: number,
        atEnding: boolean
    ): boolean {
        if (this.storyProgress.isForeignTo(this.userId)) return false;
        const stored = this.storyProgress.get(storyId);
        return (
            stored !== null &&
            stored.sceneId === sceneId &&
            stored.dialogueIndex === dialogueIndex &&
            stored.finished === atEnding &&
            (!atEnding || stored.endings.includes(sceneId)) &&
            (stored.visited === undefined || stored.visited.includes(sceneId))
        );
    }

    private isCurrent(generation: number): boolean {
        return !this.destroyed && generation === this.loadGeneration;
    }

    private defaultIntent(): IntentSelection {
        return this.deps.selectReaderIntent(
            new URLSearchParams(),
            null,
            this.initialLocale,
            { defaultStoryId: this.deps.defaultStoryId }
        );
    }

    private async loadIntent(
        selection: IntentSelection,
        phase: LoadedIntentPhase,
        generation: number = ++this.loadGeneration
    ): Promise<void> {
        if (!this.isCurrent(generation)) return;

        if (selection.kind === 'unknown-story') {
            this.pendingIntent = null;
            readerState.loadStatus = 'error';
            readerState.loadError = new StoryLoadError(
                'unknown-story',
                `Unknown story: ${selection.storyId}`
            );
            return;
        }

        const { intent } = selection;
        this.pendingIntent = intent;
        readerState.loadStatus = 'loading';
        readerState.loadError = null;

        if (!this.readerInstance) {
            await this.renderReader();
            if (!this.isCurrent(generation)) return;
        }

        let payload: AsyncStoryLoaderResult;
        try {
            payload =
                this.activeStory &&
                readerState.hasActivePayload &&
                intent.storyId === readerState.storyId &&
                intent.locale === readerState.locale
                    ? this.activeStory
                    : await this.deps.loadStoryContent(
                          intent.storyId,
                          intent.locale
                      );
        } catch (error) {
            if (!this.isCurrent(generation)) return;
            if (error instanceof StoryLoadError) {
                readerState.loadStatus = 'error';
                readerState.loadError = error;
                return;
            }
            throw error;
        }

        if (!this.isCurrent(generation)) return;
        const result = validateLoadedIntent(intent, payload, phase);
        if (result.kind === 'fallback-default') {
            await this.loadIntent(this.defaultIntent(), phase, generation);
            return;
        }
        if (result.kind === 'soft-reject') {
            this.pendingIntent = null;
            if (readerState.hasActivePayload) {
                readerState.loadStatus = 'ready';
                readerState.loadError = null;
                this.syncUrl(true);
                return;
            }
            // No active payload to preserve: the popstate destination is
            // invalid but the reader has nothing to fall back to. Re-validate
            // with initial semantics to canonicalize the stale scene / malformed
            // dialogue into a safe loaded state for the requested story (start
            // scene, index 0). If even that cannot produce an applicable state,
            // fall back to the default intent so the reader reaches a working
            // surface instead of stalling on 'loading' with no payload and no
            // URL canonicalization.
            const safeResult = validateLoadedIntent(intent, payload, 'initial');
            if (safeResult.kind === 'apply') {
                this.applySession(safeResult.state, payload);
                this.syncUrl(true);
                this.persist();
                return;
            }
            await this.loadIntent(this.defaultIntent(), phase, generation);
            return;
        }

        this.applySession(result.state, payload);
        this.pendingIntent = null;
        this.syncUrl(true);
        this.persist();
    }

    /** Persist the current progression as the v2 schema. Catches storage
     *  errors (Safari private mode throws QuotaExceededError; quota-exceeded
     *  throws on other browsers) so the pagehide path and normal navigation
     *  do not propagate an uncaught throw out of the event handler. */
    private persist(options: { cloud?: boolean } = {}): void {
        const data = {
            storyId: readerState.storyId,
            sceneId: readerState.currentSceneId,
            dialogueIndex: readerState.dialogueIndex,
            locale: readerState.locale,
            version: STORAGE_VERSION,
        };
        // Record first: quarantining a foreign map drops every reader
        // session, so writing the session first would delete it again.
        this.recordStoryProgress();
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to persist reader state', e);
        }
        // The hide flush persists locally, then sends its own keepalive; it
        // suppresses this ordinary push so one hide never sends twice.
        if (options.cloud !== false) this.maybePushProgress();
    }

    /** Leading-edge ordinary push: at most one request per minute, no timer. */
    private maybePushProgress(): void {
        if (performance.now() - this.lastPushAt < CLOUD_PUSH_INTERVAL_MS) {
            return;
        }
        this.pushProgress();
    }

    /** Fire-and-forget cloud push; failures leave local progress untouched.
     *  A successful reply clears the dirty flag only when no position was
     *  recorded while the request was in flight — that position has not
     *  reached the server yet. */
    private pushProgress(keepalive = false): void {
        if (
            this.authState !== 'signed-in' ||
            this.userId === null ||
            this.destroyed
        ) {
            return;
        }
        this.lastPushAt = performance.now();
        const seq = this.recordSeq;
        void syncStoryProgress({ keepalive, accountId: this.userId })
            .then(result => {
                if (result.ok && this.recordSeq === seq) {
                    this.progressDirty = false;
                }
            })
            .catch(() => {});
    }

    /** One best-effort final push per hide, after the local flush — and none
     *  when the server already holds everything this tab recorded. */
    private flushProgressKeepalive(): void {
        if (this.keepaliveSent || !this.progressDirty) return;
        this.keepaliveSent = true;
        this.pushProgress(true);
    }

    /** True only for a bare `?story=` link: explicit scene/dialogue/restart
     *  links must win over the merged account position. */
    private canResumeFromCloud(): boolean {
        if (this.authState !== 'signed-in' || this.userId === null)
            return false;
        const params = new URLSearchParams(window.location.search);
        return (
            params.has('story') &&
            !params.has('scene') &&
            !params.has('dialogue') &&
            params.get('restart') !== '1'
        );
    }

    /** Bounded startup merge; failure or timeout starts from local progress.
     *  The attempt stamps the throttle either way: a timed-out request may
     *  still hold the server lock, and the persist that follows must not
     *  queue a second POST behind it. */
    private async resumeFromCloud(): Promise<void> {
        const accountId = this.userId;
        if (!this.canResumeFromCloud() || accountId === null) return;
        this.lastPushAt = performance.now();
        const seq = this.recordSeq;
        const result = await syncStoryProgress({
            timeoutMs: STORY_PROGRESS_SYNC_TIMEOUT_MS,
            accountId,
        });
        if (result.ok && this.recordSeq === seq) this.progressDirty = false;
    }

    /** Keep a per-story copy of the position (the session above holds only
     *  the most recent story) and note when the reader has reached an ending:
     *  the last line of a scene with no next scene and no choice. */
    private recordStoryProgress(): void {
        const { storyId, currentSceneId, dialogueIndex, dialogue, choice } =
            readerState;
        if (!storyId || !currentSceneId || !this.activeStory) return;
        const atEnding = isEndingPosition(
            this.activeStory.flow,
            currentSceneId,
            dialogueIndex,
            dialogue.length,
            Boolean(choice)
        );
        const last = this.lastRecordedPosition;
        if (
            last &&
            last.storyId === storyId &&
            last.sceneId === currentSceneId &&
            last.dialogueIndex === dialogueIndex &&
            last.atEnding === atEnding
        ) {
            return;
        }
        if (
            this.storyProgress.record(
                {
                    storyId,
                    sceneId: currentSceneId,
                    dialogueIndex,
                    atEnding,
                },
                // A signed-in reader's first record quarantines a map
                // tagged for a previous account instead of writing into it.
                this.userId
            )
        ) {
            this.lastRecordedPosition = {
                storyId,
                sceneId: currentSceneId,
                dialogueIndex,
                atEnding,
            };
            this.recordSeq++;
            this.progressDirty = true;
        }
    }

    /** Sync the URL query to the current progression. First restore uses
     *  replaceState so the initial entry is not duplicated in history. */
    private syncUrl(useReplace: boolean): void {
        const url = new URL(window.location.href);
        const params = serializeSessionParams({
            storyId: readerState.storyId,
            sceneId: readerState.currentSceneId,
            dialogueIndex: readerState.dialogueIndex,
            locale: readerState.locale,
        });
        url.search = params.toString();
        if (useReplace) window.history.replaceState({}, '', url);
        else window.history.pushState({}, '', url);
    }

    /** Flush a pending throttled replaceState immediately (scene change / pagehide). */
    private flushPendingReplace(): void {
        if (this.rafId !== null) {
            if (this.rafIsTimeout) clearTimeout(this.rafId);
            else cancelAnimationFrame(this.rafId as number);
            this.rafId = null;
            this.replaceGen++; // invalidate any queued fallback callback
            this.syncUrl(true);
        }
    }

    /** Cancel a pending throttled replaceState without writing (popstate). */
    private cancelPendingReplace(): void {
        if (this.rafId !== null) {
            if (this.rafIsTimeout) clearTimeout(this.rafId);
            else cancelAnimationFrame(this.rafId as number);
            this.rafId = null;
        }
        this.replaceGen++; // invalidate any queued fallback callback
    }

    /** Coalesce index changes into one replaceState per animation frame. */
    private scheduleReplace(): void {
        if (this.rafId !== null) return; // already scheduled -> coalesce
        // The setTimeout fallback is practically dead code (rAF is always
        // available in the browser, the only environment this module runs in),
        // but we still track rafIsTimeout so the cancel path uses clearTimeout
        // for fallback handles and cancelAnimationFrame for rAF handles. The
        // replaceGen guard also ensures a queued fallback callback cannot fire
        // syncUrl after popstate/pagehide has cancelled the pending replace.
        const hasRaf =
            typeof window !== 'undefined' && !!window.requestAnimationFrame;
        const gen = ++this.replaceGen;
        this.rafIsTimeout = !hasRaf;
        const schedule = (cb: FrameRequestCallback): void => {
            if (hasRaf) {
                this.rafId = window.requestAnimationFrame(cb);
            } else {
                this.rafId = setTimeout(() => cb(0), 0);
            }
        };
        schedule(() => {
            this.rafId = null;
            if (gen !== this.replaceGen) return; // superseded/cancelled
            this.syncUrl(true);
        });
    }

    /** Debounce the localStorage write so rapid line changes hit storage once. */
    private schedulePersist(): void {
        if (this.persistTimer !== null) clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            this.persist();
        }, 500);
    }

    /** Drop a pending debounced persist. Callers either persist immediately
     *  after (navigation, pagehide, snapshot flush) or discard the write
     *  entirely (destroy). */
    private cancelPersistTimer(): void {
        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
    }

    getSceneDialogue = (
        storyId: string,
        sceneId: string
    ): readonly DialogueEntry[] | null => {
        const story = this.activeStory;
        if (
            !story ||
            storyId !== readerState.storyId ||
            !Object.hasOwn(story.dialogue, sceneId)
        ) {
            return null;
        }
        const entries = story.dialogue[sceneId];
        return entries ? ([...entries] as readonly DialogueEntry[]) : null;
    };

    private getSceneData(
        storyId: string,
        sceneId: string
    ): {
        dialogue: DialogueEntry[];
        choice: ChoiceDefinition | null;
    } {
        const story = this.activeStory;
        if (!story || storyId !== readerState.storyId) {
            return { dialogue: [], choice: null };
        }
        const dialogue = [...(this.getSceneDialogue(storyId, sceneId) ?? [])];

        // Derive the choice from the flow graph: if the scene node's next
        // is a choice ref (e.g. "choice:choice_act3"), look up that choiceId.
        const sceneNode = this.getSceneNode(storyId, sceneId);
        const nextRef = sceneNode?.next;
        let choice: ChoiceDefinition | null = null;
        if (nextRef && nextRef.startsWith('choice:')) {
            const choiceId = nextRef.slice('choice:'.length);
            choice = story.choices[choiceId] ?? null;
        }

        return { dialogue, choice };
    }

    /** The orchestrator write path passed to ReaderShell as the onIndexChange
     *  prop. Writes the canonical store, then schedules a throttled URL
     *  replaceState and a debounced persist. Clamps the incoming index into
     *  `[0, dialogue.length-1]` as defense-in-depth: the controlled readers
     *  bound their own navigation, but the spec's invariant is that
     *  `dialogueIndex` is always in range, so the write path enforces it too
     *  rather than trusting every caller. */
    onIndexChange = (i: number): void => {
        readerState.dialogueIndex = clampIndex(i, readerState.dialogue.length);
        this.scheduleReplace();
        const atEnding = isEndingPosition(
            this.activeStory?.flow ?? null,
            readerState.currentSceneId,
            readerState.dialogueIndex,
            readerState.dialogue.length,
            Boolean(readerState.choice)
        );
        if (atEnding) {
            this.cancelPersistTimer();
            this.persist();
        } else {
            this.schedulePersist();
        }
        if (readerState.endingOpen && !atEnding) {
            readerState.endingOpen = false;
        }
    };

    /** Shared scene-navigation method. Flushes any pending line replace so the
     *  Back button lands on an accurate line, then writes the new scene to the
     *  store and pushes a fresh history entry. */
    goToScene = (sceneId: string, at?: 'start' | 'end'): void => {
        if (!this.activeStory || readerState.loadStatus !== 'ready') return;
        this.flushPendingReplace(); // preserve accurate line for Back
        if (readerState.endingOpen) {
            readerState.endingOpen = false;
        }
        readerState.currentSceneId = sceneId;
        const { dialogue, choice } = this.getSceneData(
            readerState.storyId,
            sceneId
        );
        readerState.dialogue = dialogue;
        readerState.choice = choice;
        readerState.dialogueIndex = clampIndex(
            at === 'end' ? dialogue.length - 1 : 0,
            dialogue.length
        );
        readerState.canGoNext = this.hasNextScene(sceneId);
        this.syncUrl(false); // pushState (new history entry)
        this.cancelPersistTimer();
        this.persist();
    };

    getCurrentStoryProgressSnapshot = (): StoryProgress | null => {
        if (readerState.hasActivePayload) {
            this.flushPendingReplace();
            if (this.persistTimer !== null) {
                this.cancelPersistTimer();
                this.persist();
            }
        }
        return this.storyProgress.isForeignTo(this.userId)
            ? null
            : this.storyProgress.get(readerState.storyId);
    };

    handleChoice = (nextScene: string): void => {
        this.goToScene(nextScene);
    };

    handleBookmark = async (dialogueNumber?: number): Promise<void> => {
        if (!this.activeStory || readerState.loadStatus !== 'ready') return;
        const translations = this.t;

        const bookmarkName = await showPrompt(
            translations.reader.bookmarkPrompt,
            translations.reader.defaultBookmarkName +
                ' ' +
                readerState.currentSceneId
        );
        if (!bookmarkName) return;

        const storedBookmarkName =
            dialogueNumber && dialogueNumber > 0
                ? `[dlg:${dialogueNumber}] ${bookmarkName}`
                : bookmarkName;

        try {
            const response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    storyId: readerState.storyId,
                    sceneId: readerState.currentSceneId,
                    bookmarkName: storedBookmarkName,
                    locale: readerState.locale,
                }),
            });

            if (response.ok) {
                await showAlert(translations.reader.bookmarkSaved);
                return;
            }

            if (response.status === 401) {
                const saved = this.localBookmarks.create({
                    storyId: readerState.storyId,
                    sceneId: readerState.currentSceneId,
                    bookmarkName: storedBookmarkName,
                });
                if (saved) {
                    await showAlert(translations.reader.bookmarkSaved);
                } else {
                    await showAlert(
                        translations.reader.bookmarkFailed +
                            ' Storage unavailable'
                    );
                }
                return;
            }

            const error = await response.json();
            await showAlert(
                translations.reader.bookmarkFailed +
                    ' ' +
                    (error.error || 'Unknown error')
            );
        } catch (error) {
            console.error('Failed to save bookmark:', error);
            await showAlert(translations.reader.bookmarkError);
        }
    };

    handleNext = (): void => {
        if (!this.activeStory || readerState.loadStatus !== 'ready') return;
        const next = this.getLinearNextScene(readerState.currentSceneId);
        if (next !== null) {
            this.goToScene(next);
            return;
        }
        const atEnding = isEndingPosition(
            this.activeStory.flow,
            readerState.currentSceneId,
            readerState.dialogueIndex,
            readerState.dialogue.length,
            Boolean(readerState.choice)
        );
        if (atEnding) {
            readerState.endingOpen = true;
        }
    };

    renderReader(): Promise<void> {
        if (this.readerMountPromise) return this.readerMountPromise;
        const container = document.getElementById('reader-container');
        if (!container) return Promise.resolve();

        if (this.readerInstance) {
            return Promise.resolve();
        }

        const translations = this.t;

        // Dynamic import to avoid issues with Astro SSR
        this.readerMountPromise = this.deps
            .loadReaderShell()
            .then(module => {
                if (this.destroyed) return;
                const ReaderShellComponent = module.default;
                // Clear any stale content (SSR comments, loading placeholders)
                // before mounting so the component replaces rather than appends.
                container.replaceChildren();
                const mountedComponent = mount(ReaderShellComponent, {
                    target: container,
                    props: {
                        onChoice: this.handleChoice,
                        onBookmark: (dialogueNumber: number) =>
                            this.handleBookmark(dialogueNumber),
                        onNext: this.handleNext,
                        showBookmarkButton: true,
                        backUrl: `/${readerState.locale}/`,
                        onNavigate: this.goToScene,
                        onIndexChange: this.onIndexChange,
                        getSceneDialogue: this.getSceneDialogue,
                        getCurrentStoryProgressSnapshot:
                            this.getCurrentStoryProgressSnapshot,
                        onRetry: () => window.location.reload(),
                    },
                });

                this.readerInstance = {
                    unmount: () => {
                        unmount(mountedComponent);
                    },
                };
                if (this.destroyed) this.unmountReader();
            })
            .catch(error => {
                if (this.destroyed) return;
                console.error('Failed to load reader component:', error);

                // Clear container and build DOM safely
                container.replaceChildren();

                const wrapper = document.createElement('div');
                wrapper.className =
                    'flex flex-col items-center justify-center h-full text-center p-8';

                const errorMsg = document.createElement('p');
                errorMsg.className = 'text-red-400 mb-4';
                const loadText =
                    translations?.reader?.loadError ?? 'Failed to load reader';
                errorMsg.textContent = loadText;

                const retryBtn = document.createElement('button');
                retryBtn.className =
                    'px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors';
                const retryText = translations?.reader?.retry ?? 'Retry';
                retryBtn.textContent = retryText;
                retryBtn.addEventListener('click', () =>
                    window.location.reload()
                );

                wrapper.appendChild(errorMsg);
                wrapper.appendChild(retryBtn);
                container.appendChild(wrapper);
            });
        return this.readerMountPromise;
    }

    /** popstate handler: cancel any pending line replace (so the destination
     *  history entry is not mutated), then start one generation-guarded intent
     *  path for active, replacement, and pre-payload destinations. */
    private onPopState = (): void => {
        this.cancelPendingReplace(); // do NOT flush -> avoid mutating destination entry
        const params = new URLSearchParams(window.location.search);
        if (readerState.hasActivePayload && !params.has('story')) {
            this.loadGeneration++;
            this.pendingIntent = null;
            readerState.loadStatus = 'ready';
            readerState.loadError = null;
            this.syncUrl(true);
            return;
        }
        const selection = this.deps.selectReaderIntent(
            params,
            null,
            readerState.locale,
            { defaultStoryId: this.deps.defaultStoryId }
        );
        void this.loadIntent(selection, 'popstate').catch(error =>
            console.error('Reader popstate load failed', error)
        );
    };

    /** pagehide / visibilitychange->hidden handler: flush any pending line
     *  replace and persist so the URL and storage are coherent if the tab is
     *  restored. persist() runs unconditionally because popstate navigation
     *  mutates readerState without scheduling a debounce timer — storage must
     *  be reconciled here regardless of whether a persistTimer was pending. */
    private onPageHide = (): void => {
        if (!readerState.hasActivePayload) return;
        this.flushPendingReplace();
        this.cancelPersistTimer();
        this.persist({ cloud: false });
        this.flushProgressKeepalive();
    };

    /** Named visibilitychange handler so destroy() can remove the exact
     *  listener reference that initialize() registered. */
    private onVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') {
            this.onPageHide();
        } else {
            // Re-arm the one-keepalive-per-hide rule for the next hide.
            this.keepaliveSent = false;
            this.revalidateAuth();
        }
    };

    /** A back/forward-cached reader can predate a sign-out or an account
     *  switch made in another tab — the userId captured at load must not
     *  tag new writes for the account that used to be signed in. */
    private onPageShow = (event: Event): void => {
        if (!(event as Event & { persisted?: boolean }).persisted) return;
        this.revalidateAuth();
    };

    /** Re-reads the session on resume so later records and pushes carry the
     *  account that is actually signed in now — a tab kept open across an
     *  account switch would otherwise keep tagging writes for the previous
     *  one. A failed re-read keeps the current state. */
    private revalidateAuth(): void {
        const ticket = ++this.authCheckSeq;
        void authClient
            .getSession()
            .then(result => {
                if (
                    this.destroyed ||
                    ticket !== this.authCheckSeq ||
                    result?.error
                )
                    return;
                const user = result?.data?.user ?? null;
                this.applySessionUser(user);
                // Any validated answer means auth is back — the SSR
                // degraded banner comes down for signed-out too.
                document.getElementById('auth-degraded-banner')?.remove();
            })
            .catch(() => {});
    }

    private applySessionUser(user: { id: string } | null): void {
        this.authState = user ? 'signed-in' : 'signed-out';
        this.userId = user?.id ?? null;
    }

    private addLifecycleListeners(): void {
        window.addEventListener('popstate', this.onPopState);
        window.addEventListener('pagehide', this.onPageHide);
        window.addEventListener('pageshow', this.onPageShow);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    /** An SSR 'unavailable' is often a slow cold start, not an outage: one
     *  background session re-read decides whether this visit can sync. A
     *  late 'signed-in' only enables pushes — it never repositions an
     *  already-open reader. */
    private recheckUnavailableAuth(): void {
        if (this.authState !== 'unavailable') return;
        const ticket = ++this.authCheckSeq;
        void authClient
            .getSession()
            .then(result => {
                if (
                    this.destroyed ||
                    ticket !== this.authCheckSeq ||
                    result?.error
                )
                    return;
                this.applySessionUser(result?.data?.user ?? null);
                document.getElementById('auth-degraded-banner')?.remove();
            })
            .catch(() => {});
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
        this.destroyed = false;
        this.addLifecycleListeners();
        const generation = ++this.loadGeneration;
        this.recheckUnavailableAuth();
        // Only a bare ?story= link waits on the cloud merge below, and that
        // wait now overlaps the shell mount instead of following it.
        await Promise.all([this.renderReader(), this.resumeFromCloud()]);
        if (!this.isCurrent(generation)) return;
        await this.loadIntent(
            this.selectInitialIntent(),
            'initial',
            generation
        );
    }

    private unmountReader(): void {
        const instance = this.readerInstance;
        if (!instance) return;
        this.readerInstance = null;
        instance.unmount();
    }

    /** Invalidate pending work, remove lifecycle listeners/timers, and unmount
     *  the shell. Uses the same handler references registered in initialize()
     *  so removeEventListener actually detaches them. */
    destroy(): void {
        this.destroyed = true;
        this.loadGeneration++;
        window.removeEventListener('popstate', this.onPopState);
        window.removeEventListener('pagehide', this.onPageHide);
        window.removeEventListener('pageshow', this.onPageShow);
        document.removeEventListener(
            'visibilitychange',
            this.onVisibilityChange
        );
        this.cancelPendingReplace();
        this.cancelPersistTimer();
        this.unmountReader();
        void this.readerMountPromise?.then(() => this.unmountReader());
    }
}
