import {
    getStoryContent,
    getTranslations,
    type Locale,
    type DialogueEntry,
    type ChoiceDefinition,
} from '@aquila/dialogue';
import { mount } from 'svelte';

export interface SceneState {
    storyId: string;
    sceneId: string;
    locale: string;
}

export class ReaderManager {
    private currentState: SceneState;
    private readerInstance: { unmount: () => void } | null = null;
    private readonly t: ReturnType<typeof getTranslations>;

    constructor(locale: Locale) {
        this.currentState = {
            storyId: 'trainAdventure',
            sceneId: 'scene_1',
            locale: locale,
        };
        this.t = getTranslations(locale);
    }

    private validateSceneState(data: unknown): data is SceneState {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.storyId === 'string' &&
            typeof data.sceneId === 'string' &&
            typeof data.locale === 'string'
        );
    }

    private parseSceneNumber(sceneId: string): number | null {
        const match = sceneId.match(/scene_(\d+)([a-z])?/);
        return match ? parseInt(match[1]) : null;
    }

    private hasNextScene(sceneId: string): boolean {
        const sceneNumber = this.parseSceneNumber(sceneId);
        if (sceneNumber === null) return false;

        const nextScene = `scene_${sceneNumber + 1}`;
        const story = getStoryContent(
            this.currentState.storyId,
            this.currentState.locale
        );
        return !!story.dialogue[nextScene];
    }

    loadInitialState(): SceneState {
        const params = new URLSearchParams(window.location.search);
        const urlScene = params.get('scene');
        const urlStory = params.get('story');

        if (urlScene) {
            return {
                storyId: urlStory || 'trainAdventure',
                sceneId: urlScene,
                locale: this.currentState.locale,
            };
        }

        const saved = localStorage.getItem('aquila:currentScene');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (this.validateSceneState(parsed)) {
                    return parsed;
                } else {
                    console.warn('Saved state has invalid structure, ignoring');
                }
            } catch (e) {
                console.error('Failed to parse saved state', e);
            }
        }

        return this.currentState;
    }

    saveState(state: SceneState): void {
        localStorage.setItem('aquila:currentScene', JSON.stringify(state));

        const url = new URL(window.location.href);
        url.searchParams.set('story', state.storyId);
        url.searchParams.set('scene', state.sceneId);
        window.history.pushState({}, '', url);
    }

    private getSceneData(
        storyId: string,
        sceneId: string,
        locale: string
    ): {
        dialogue: DialogueEntry[];
        choice: ChoiceDefinition | null;
    } {
        const story = getStoryContent(storyId, locale);
        const dialogue = story.dialogue[sceneId] || [];

        // Use deterministic mapping: choice_{sceneNumber}
        // e.g., scene_3 -> choice_3, scene_4a -> choice_4
        const sceneNumber = this.parseSceneNumber(sceneId);
        const choiceKey = sceneNumber !== null ? `choice_${sceneNumber}` : null;
        const choice = choiceKey ? story.choices[choiceKey] || null : null;

        return { dialogue, choice };
    }

    private navigateToScene(sceneId: string): void {
        this.currentState.sceneId = sceneId;
        this.saveState(this.currentState);
        this.renderReader();
    }

    handleChoice = (nextScene: string): void => {
        this.navigateToScene(nextScene);
    };

    handleBookmark = async (): Promise<void> => {
        const bookmarkName = prompt(
            this.t.reader.bookmarkPrompt,
            this.t.reader.defaultBookmarkName + ' ' + this.currentState.sceneId
        );
        if (!bookmarkName) return;

        try {
            const response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    storyId: this.currentState.storyId,
                    sceneId: this.currentState.sceneId,
                    bookmarkName,
                    locale: this.currentState.locale,
                }),
            });

            if (response.ok) {
                alert(this.t.reader.bookmarkSaved);
            } else {
                const error = await response.json();
                alert(
                    this.t.reader.bookmarkFailed +
                        ' ' +
                        (error.message || 'Unknown error')
                );
            }
        } catch (error) {
            console.error('Failed to save bookmark:', error);
            alert(this.t.reader.bookmarkError);
        }
    };

    handleNext = (): void => {
        const sceneNumber = this.parseSceneNumber(this.currentState.sceneId);
        if (
            sceneNumber !== null &&
            this.hasNextScene(this.currentState.sceneId)
        ) {
            const nextScene = `scene_${sceneNumber + 1}`;
            this.navigateToScene(nextScene);
        } else {
            alert(this.t.reader.endOfStory);
        }
    };

    renderReader(): void {
        const container = document.getElementById('reader-container');
        if (!container) return;

        const { dialogue, choice } = this.getSceneData(
            this.currentState.storyId,
            this.currentState.sceneId,
            this.currentState.locale
        );

        const canGoNext = this.hasNextScene(this.currentState.sceneId);

        if (this.readerInstance) {
            this.readerInstance.unmount();
        }

        // Clear container
        container.innerHTML = '';

        // Dynamic import to avoid issues with Astro SSR
        import('@/components/NovelReader.svelte').then(module => {
            const NovelReaderComponent = module.default;
            this.readerInstance = mount(NovelReaderComponent, {
                target: container,
                props: {
                    dialogue,
                    choice,
                    onChoice: this.handleChoice,
                    onBookmark: this.handleBookmark,
                    onNext: this.handleNext,
                    canGoNext,
                    showBookmarkButton: true,
                    locale: this.t.locale,
                    backUrl: `/${this.t.locale}/`,
                },
            });
        });
    }

    initialize(): void {
        this.currentState = this.loadInitialState();
        this.saveState(this.currentState);
        this.renderReader();
    }
}
