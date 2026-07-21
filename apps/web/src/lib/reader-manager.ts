import {
    getStoryContent,
    getStoryFlow,
    type Locale,
    type DialogueEntry,
    type ChoiceDefinition,
} from '@aquila/stories';
import { getTranslations } from '@aquila/stories/translations';
import { mount, unmount } from 'svelte';
import { showAlert, showPrompt } from './ui-dialogs';
import { LocalBookmarksStore } from './local-bookmarks-store';
import { readerState } from './reader-state.svelte';
import {
    resolveInitialState,
    migratePersisted,
    serializeSessionParams,
    sceneExists,
    parseDialogueParam,
    clampIndex,
    STORAGE_VERSION,
    DEFAULT_SCENE_ID,
    type ResolveDeps,
    type ReaderSessionState,
    type PersistedSession,
} from './reader-session';

export class ReaderManager {
    private readerInstance: { unmount: () => void } | null = null;
    private readonly initialLocale: Locale;
    private readonly deps: ResolveDeps;
    private readonly localBookmarks: LocalBookmarksStore;

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
    // Guard against double-invocation: a second initialize() would register
    // a duplicate set of popstate/pagehide/visibilitychange listeners and
    // re-run resolveAndApply/syncUrl/persist. renderReader has its own
    // readerInstance guard, but the listeners do not.
    private initialized = false;

    private static readonly STORAGE_KEY_PREFIX = 'aquila:readerState';
    private static readonly LEGACY_KEYS = [
        'aquila:currentScene',
        'aquila:currentScene:en',
        'aquila:currentScene:zh',
    ];

    constructor(locale: Locale, defaultStoryId?: string) {
        this.initialLocale = locale;
        this.deps = {
            flow: sid => getStoryFlow(sid) ?? undefined,
            dialogue: (sid, sceneId, loc) =>
                getStoryContent(sid, loc).dialogue[sceneId] ?? [],
            defaultStoryId: defaultStoryId || 'train_adventure',
        };

        // Seed the canonical store with progression defaults so helper methods
        // (hasNextScene, getLinearNextScene) have a storyId to read before the
        // first resolveAndApply() runs.
        const storyId = this.deps.defaultStoryId;
        readerState.storyId = storyId;
        readerState.currentSceneId =
            getStoryFlow(storyId)?.start ?? DEFAULT_SCENE_ID;
        readerState.locale = locale;
        readerState.dialogueIndex = 0;

        this.purgeLegacyState();
        this.localBookmarks = new LocalBookmarksStore(locale);
    }

    private get storageKey(): string {
        return `${ReaderManager.STORAGE_KEY_PREFIX}:${this.initialLocale}`;
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
        const flow = getStoryFlow(storyId);
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

    /**
     * Resolve the session (URL > localStorage > default) via the pure helpers in
     * reader-session, then apply the result to the canonical readerState.
     */
    private resolveAndApply(): ReaderSessionState {
        const params = new URLSearchParams(window.location.search);
        const raw = localStorage.getItem(this.storageKey);
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
        const state = resolveInitialState(
            params,
            persisted,
            this.initialLocale,
            this.deps
        );
        this.applySession(state);
        return state;
    }

    /** Write a resolved session into readerState and reload the scene payload. */
    private applySession(state: ReaderSessionState): void {
        readerState.storyId = state.storyId;
        readerState.currentSceneId = state.sceneId;
        readerState.locale = state.locale;
        readerState.dialogueIndex = state.dialogueIndex;
        const { dialogue, choice } = this.getSceneData(
            state.storyId,
            state.sceneId,
            state.locale
        );
        readerState.dialogue = dialogue;
        readerState.choice = choice;
        readerState.canGoNext = this.hasNextScene(state.sceneId);

        // Temporary synchronous compatibility bridge. Task 7 replaces this
        // block when ReaderManager applies the asynchronously loaded payload
        // atomically; until then, expose the same ready-store contract to the
        // reactive ReaderShell without introducing async/race behavior here.
        const activeFlow = getStoryFlow(state.storyId);
        readerState.activeFlow = activeFlow ?? null;
        readerState.hasActivePayload = activeFlow !== undefined;
        readerState.loadStatus = activeFlow ? 'ready' : 'idle';
        readerState.loadError = null;
    }

    /** Persist the current progression as the v2 schema. Catches storage
     *  errors (Safari private mode throws QuotaExceededError; quota-exceeded
     *  throws on other browsers) so the pagehide path and normal navigation
     *  do not propagate an uncaught throw out of the event handler. */
    private persist(): void {
        const data = {
            storyId: readerState.storyId,
            sceneId: readerState.currentSceneId,
            dialogueIndex: readerState.dialogueIndex,
            locale: readerState.locale,
            version: STORAGE_VERSION,
        };
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to persist reader state', e);
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

    private getSceneData(
        storyId: string,
        sceneId: string,
        locale: Locale
    ): {
        dialogue: DialogueEntry[];
        choice: ChoiceDefinition | null;
    } {
        const story = getStoryContent(storyId, locale);
        const dialogue = story.dialogue[sceneId] || [];

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
        this.schedulePersist();
    };

    /** Shared scene-navigation method. Flushes any pending line replace so the
     *  Back button lands on an accurate line, then writes the new scene to the
     *  store and pushes a fresh history entry. */
    goToScene = (sceneId: string): void => {
        this.flushPendingReplace(); // preserve accurate line for Back
        readerState.currentSceneId = sceneId;
        readerState.dialogueIndex = 0;
        const { dialogue, choice } = this.getSceneData(
            readerState.storyId,
            sceneId,
            readerState.locale
        );
        readerState.dialogue = dialogue;
        readerState.choice = choice;
        readerState.canGoNext = this.hasNextScene(sceneId);
        this.syncUrl(false); // pushState (new history entry)
        this.persist();
    };

    handleChoice = (nextScene: string): void => {
        this.goToScene(nextScene);
    };

    handleBookmark = async (dialogueNumber?: number): Promise<void> => {
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

    handleNext = async (): Promise<void> => {
        const translations = this.t;
        const next = this.getLinearNextScene(readerState.currentSceneId);
        if (next !== null) {
            this.goToScene(next);
        } else {
            await showAlert(translations.reader.endOfStory);
        }
    };

    renderReader(): void {
        const container = document.getElementById('reader-container');
        if (!container) return;

        if (this.readerInstance) {
            return;
        }

        const translations = this.t;

        // Dynamic import to avoid issues with Astro SSR
        import('@/components/ReaderShell.svelte')
            .then(module => {
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
                        onRetry: () => location.reload(),
                    },
                });

                this.readerInstance = {
                    unmount: () => {
                        unmount(mountedComponent);
                    },
                };
            })
            .catch(error => {
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
                retryBtn.addEventListener('click', () => location.reload());

                wrapper.appendChild(errorMsg);
                wrapper.appendChild(retryBtn);
                container.appendChild(wrapper);
            });
    }

    /** popstate handler: cancel any pending line replace (so the destination
     *  history entry is not mutated), then either soft-reject (invalid URL ->
     *  reconverge canonical URL via replaceState) or restore the validated
     *  URL state into the store. */
    private onPopState = (): void => {
        this.cancelPendingReplace(); // do NOT flush -> avoid mutating destination entry
        const params = new URLSearchParams(window.location.search);
        const urlStory = params.get('story');
        const flowForUrl = urlStory ? this.deps.flow(urlStory) : undefined;
        if (!urlStory || !flowForUrl) {
            // invalid popstate -> soft-reject: keep store, reconverge URL
            this.syncUrl(true);
            return;
        }
        // Stale scene: URL requested a scene that does not exist in the flow
        // (e.g. a removed/renamed scene). Soft-reject rather than silently
        // Tier-1-resolving to the story START, which would clobber the user's
        // current position.
        const urlScene = params.get('scene');
        if (urlScene && !sceneExists(flowForUrl, urlScene)) {
            this.syncUrl(true);
            return;
        }
        // Malformed dialogue: a raw value that is present, non-empty, not
        // zero-equivalent, and unparseable by parseDialogueParam (e.g.
        // "2junk", "1.5"). resolveInitialState treats parseDialogueParam=null
        // as "absent" and silently moves the reader to index 0, leaving the
        // malformed URL in place — soft-reject instead so the canonical URL
        // is reconverged. Zero-equivalent values (absent, empty, or all-zeros
        // like "0", "00", "000") all map to index 0 in initial restore and
        // must be retained as valid restore targets here, so the popstate
        // classification stays aligned with the initial-restore classification.
        const rawDialogue = params.get('dialogue');
        const isZeroEquivalent =
            rawDialogue === null ||
            rawDialogue === '' ||
            /^0+$/.test(rawDialogue);
        if (!isZeroEquivalent && parseDialogueParam(rawDialogue) === null) {
            this.syncUrl(true);
            return;
        }
        const state = resolveInitialState(
            params,
            null, // popstate never falls through to persisted
            readerState.locale,
            this.deps
        );
        if (
            state.sceneId !== readerState.currentSceneId ||
            state.storyId !== readerState.storyId
        ) {
            this.applySession(state);
        } else {
            readerState.dialogueIndex = state.dialogueIndex;
        }
    };

    /** pagehide / visibilitychange->hidden handler: flush any pending line
     *  replace and persist so the URL and storage are coherent if the tab is
     *  restored. persist() runs unconditionally because popstate navigation
     *  mutates readerState without scheduling a debounce timer — storage must
     *  be reconciled here regardless of whether a persistTimer was pending. */
    private onPageHide = (): void => {
        this.flushPendingReplace();
        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
        this.persist();
    };

    /** Named visibilitychange handler so destroy() can remove the exact
     *  listener reference that initialize() registered. */
    private onVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') this.onPageHide();
    };

    initialize(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.resolveAndApply();
        this.syncUrl(true); // first sync collapses the duplicate history entry
        this.persist();
        this.renderReader();

        // Listeners stay registered for the lifetime of the page and react to
        // browser Back/Forward and tab hide. destroy() tears them down for
        // test isolation only (the full-page reader app has no SPA teardown).
        window.addEventListener('popstate', this.onPopState);
        window.addEventListener('pagehide', this.onPageHide);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    /** Remove lifecycle listeners and clear pending timers. Intended for test
     *  isolation only; the full-page reader app does not call this in
     *  production and the reader component is not unmounted here. Uses the
     *  same handler references registered in initialize() so
     *  removeEventListener actually detaches them. */
    destroy(): void {
        window.removeEventListener('popstate', this.onPopState);
        window.removeEventListener('pagehide', this.onPageHide);
        document.removeEventListener(
            'visibilitychange',
            this.onVisibilityChange
        );
        this.cancelPendingReplace();
        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
        // Reset so a future SPA teardown path could re-initialize the same
        // manager. Not used by the full-page reader app today.
        this.initialized = false;
    }
}
