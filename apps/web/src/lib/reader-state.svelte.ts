// Architecture: readerState is the single canonical reactive owner of reader
// PROGRESSION (storyId, currentSceneId, locale, dialogueIndex) — the only state
// that is serialized to URL/localStorage — plus the runtime SCENE PAYLOAD
// (dialogue, choice, canGoNext) which is derived from the loaded scene and
// never persisted. ReaderManager is a plain-TS orchestrator that owns behavior
// (restore, URL/history, persistence, popstate) and reads/writes this store.
// ReaderShell is the reactive store->props bridge; NovelReader/MobileNovelReader
// are pure controlled components with no store import.
import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
    StoryFlowConfig,
} from '@aquila/stories';
import type { StoryLoadError } from '@aquila/stories/async';

export type ReaderLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

class ReaderState {
    dialogue: DialogueEntry[] = $state([]);
    choice: ChoiceDefinition | null = $state(null);
    currentSceneId: string = $state('');
    storyId: string = $state('');
    canGoNext: boolean = $state(false);
    locale: Locale = $state('en');
    dialogueIndex: number = $state(0);
    loadStatus: ReaderLoadStatus = $state('idle');
    loadError: StoryLoadError | null = $state(null);
    hasActivePayload: boolean = $state(false);
    activeFlow: StoryFlowConfig | null = $state(null);

    reset() {
        this.dialogue = [];
        this.choice = null;
        this.currentSceneId = '';
        this.storyId = '';
        this.canGoNext = false;
        // Preserve locale across reset: callers (logout, in-place locale
        // switch, SSR hydration re-init) expect reset() to clear progression
        // and runtime payload, not to silently rewrite the active locale back
        // to 'en'. ReaderManager's constructor re-assigns locale after reset()
        // in the current prod path, but reset() must hold its own contract.
        this.dialogueIndex = 0;
        this.loadStatus = 'idle';
        this.loadError = null;
        this.hasActivePayload = false;
        this.activeFlow = null;
    }
}

/** Global singleton — intentionally shared across the app for single-reader architecture. */
export const readerState = new ReaderState();
