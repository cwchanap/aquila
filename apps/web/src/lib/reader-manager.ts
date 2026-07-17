import {
    getStoryContent,
    getStoryFlow,
    getTranslations,
    type Locale,
    type DialogueEntry,
    type ChoiceDefinition,
} from '@aquila/stories';
import { mount, unmount } from 'svelte';
import { showAlert, showPrompt } from './ui-dialogs';
import { LocalBookmarksStore } from './local-bookmarks-store';
import { readerState } from './reader-state.svelte';
import {
    resolveInitialState,
    migratePersisted,
    serializeSessionParams,
    STORAGE_VERSION,
    type ResolveDeps,
    type ReaderSessionState,
    type PersistedSession,
} from './reader-session';

export class ReaderManager {
    private readerInstance: { unmount: () => void } | null = null;
    private readonly initialLocale: Locale;
    private readonly deps: ResolveDeps;
    private readonly localBookmarks: LocalBookmarksStore;

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
        readerState.currentSceneId = getStoryFlow(storyId)?.start ?? 'act1';
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
    }

    /** Persist the current progression as the v2 schema. */
    private persist(): void {
        const data = {
            storyId: readerState.storyId,
            sceneId: readerState.currentSceneId,
            dialogueIndex: readerState.dialogueIndex,
            locale: readerState.locale,
            version: STORAGE_VERSION,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
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

    private navigateToScene(sceneId: string): void {
        // A fresh scene always starts at dialogue index 0. (The throttled
        // index-write path that keeps an in-scene index live lands in Task 4.)
        const state: ReaderSessionState = {
            storyId: readerState.storyId,
            sceneId,
            dialogueIndex: 0,
            locale: readerState.locale,
        };
        this.applySession(state);
        this.syncUrl(false);
        this.persist();
    }

    handleChoice = (nextScene: string): void => {
        this.navigateToScene(nextScene);
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
            this.navigateToScene(next);
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
                        initialDialogueIndex: readerState.dialogueIndex,
                        onNavigate: (sceneId: string) =>
                            this.navigateToScene(sceneId),
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

    initialize(): void {
        this.resolveAndApply();
        this.syncUrl(true); // first sync collapses the duplicate history entry
        this.persist();
        this.renderReader();
    }
}
