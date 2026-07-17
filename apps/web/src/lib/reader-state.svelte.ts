// Architecture: readerState is the single canonical reactive owner of reader
// PROGRESSION (storyId, currentSceneId, locale, dialogueIndex) — the only state
// that is serialized to URL/localStorage — plus the runtime SCENE PAYLOAD
// (dialogue, choice, canGoNext) which is derived from the loaded scene and
// never persisted. ReaderManager is a plain-TS orchestrator that owns behavior
// (restore, URL/history, persistence, popstate) and reads/writes this store.
// ReaderShell is the reactive store->props bridge; NovelReader/MobileNovelReader
// are pure controlled components with no store import.
import type { DialogueEntry, ChoiceDefinition, Locale } from '@aquila/stories';

class ReaderState {
    dialogue: DialogueEntry[] = $state([]);
    choice: ChoiceDefinition | null = $state(null);
    currentSceneId: string = $state('');
    storyId: string = $state('');
    canGoNext: boolean = $state(false);
    locale: Locale = $state('en');
    dialogueIndex: number = $state(0);

    reset() {
        this.dialogue = [];
        this.choice = null;
        this.currentSceneId = '';
        this.storyId = '';
        this.canGoNext = false;
        this.locale = 'en';
        this.dialogueIndex = 0;
    }
}

/** Global singleton — intentionally shared across the app for single-reader architecture. */
export const readerState = new ReaderState();
