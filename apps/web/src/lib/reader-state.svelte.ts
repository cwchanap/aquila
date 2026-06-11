import type { DialogueEntry, ChoiceDefinition, Locale } from '@aquila/stories';

class ReaderState {
    dialogue: DialogueEntry[] = $state([]);
    choice: ChoiceDefinition | null = $state(null);
    currentSceneId: string = $state('');
    storyId: string = $state('');
    canGoNext: boolean = $state(false);
    locale: Locale = $state('en');

    reset() {
        this.dialogue = [];
        this.choice = null;
        this.currentSceneId = '';
        this.storyId = '';
        this.canGoNext = false;
        this.locale = 'en';
    }
}

export const readerState = new ReaderState();
