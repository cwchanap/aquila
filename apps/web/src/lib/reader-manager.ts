import {
    getStoryContent,
    getTranslations,
    type Locale,
} from '@aquila/dialogue';
import type NovelReader from '@/components/NovelReader.svelte';

export interface SceneState {
    storyId: string;
    sceneId: string;
    locale: string;
}

export class ReaderManager {
    private currentState: SceneState;
    private readerInstance: NovelReader | null = null;
    private readonly t: ReturnType<typeof getTranslations>;

    constructor(locale: Locale) {
        this.currentState = {
            storyId: 'trainAdventure',
            sceneId: 'scene_1',
            locale: locale,
        };
        this.t = getTranslations(locale);
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
                return JSON.parse(saved);
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

    private getSceneData(storyId: string, sceneId: string, locale: string) {
        const story = getStoryContent(storyId, locale);
        const dialogue = story.dialogue[sceneId] || [];

        const choiceId = Object.keys(story.choices).find(id => {
            return id.includes(sceneId.replace('scene_', ''));
        });

        const choice = choiceId ? story.choices[choiceId] : null;

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
        const match = this.currentState.sceneId.match(/scene_(\d+)([a-z])?/);
        if (match) {
            const num = parseInt(match[1]);
            const nextScene = `scene_${num + 1}`;

            const story = getStoryContent(
                this.currentState.storyId,
                this.currentState.locale
            );
            if (story.dialogue[nextScene]) {
                this.navigateToScene(nextScene);
            } else {
                alert(this.t.reader.endOfStory);
            }
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

        const story = getStoryContent(
            this.currentState.storyId,
            this.currentState.locale
        );
        const match = this.currentState.sceneId.match(/scene_(\d+)([a-z])?/);
        let canGoNext = false;
        if (match) {
            const num = parseInt(match[1]);
            const nextScene = `scene_${num + 1}`;
            canGoNext = !!story.dialogue[nextScene];
        }

        if (this.readerInstance) {
            this.readerInstance.$destroy();
        }

        // Dynamic import to avoid issues with Astro SSR
        import('@/components/NovelReader.svelte').then(module => {
            const NovelReaderComponent = module.default;
            this.readerInstance = new NovelReaderComponent({
                target: container,
                props: {
                    dialogue,
                    choice,
                    onChoice: this.handleChoice,
                    onBookmark: this.handleBookmark,
                    onNext: this.handleNext,
                    canGoNext,
                    showBookmarkButton: true,
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
