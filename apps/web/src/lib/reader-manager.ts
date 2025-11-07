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
    locale: Locale;
}

export class ReaderManager {
    private currentState: SceneState;
    private readerInstance: { unmount: () => void } | null = null;
    private readonly initialLocale: Locale;

    private static readonly STORAGE_KEY_PREFIX = 'aquila:readerState';
    private static readonly LEGACY_KEYS = [
        'aquila:currentScene',
        'aquila:currentScene:en',
        'aquila:currentScene:zh',
    ];

    constructor(locale: Locale) {
        this.initialLocale = locale;
        this.currentState = {
            storyId: 'trainAdventure',
            sceneId: 'scene_1',
            locale,
        };

        this.purgeLegacyState();
    }

    private get storageKey(): string {
        return `${ReaderManager.STORAGE_KEY_PREFIX}:${this.initialLocale}`;
    }

    private isLocale(value: unknown): value is Locale {
        return value === 'en' || value === 'zh';
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
        return getTranslations(this.currentState.locale);
    }

    private validateSceneState(data: unknown): data is SceneState {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const { storyId, sceneId, locale } = data as Record<string, unknown>;

        return (
            typeof storyId === 'string' &&
            typeof sceneId === 'string' &&
            this.isLocale(locale)
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
                storyId: urlStory || this.currentState.storyId,
                sceneId: urlScene,
                locale: this.currentState.locale,
            };
        }

        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (this.validateSceneState(parsed)) {
                    if (
                        parsed.locale &&
                        this.isLocale(parsed.locale) &&
                        parsed.locale !== this.initialLocale
                    ) {
                        // Saved state belongs to a different locale; ignore it
                        localStorage.removeItem(this.storageKey);
                    } else {
                        const state: SceneState = {
                            storyId: parsed.storyId,
                            sceneId: parsed.sceneId,
                            locale: this.initialLocale,
                        };
                        localStorage.setItem(
                            this.storageKey,
                            JSON.stringify(state)
                        );
                        return state;
                    }
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
        const updatedState: SceneState = {
            storyId: state.storyId,
            sceneId: state.sceneId,
            locale: this.initialLocale,
        };

        this.currentState = updatedState;

        localStorage.setItem(this.storageKey, JSON.stringify(updatedState));

        const url = new URL(window.location.href);
        url.searchParams.set('story', updatedState.storyId);
        url.searchParams.set('scene', updatedState.sceneId);
        window.history.pushState({}, '', url);
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
        const translations = this.t;

        const bookmarkName = prompt(
            translations.reader.bookmarkPrompt,
            translations.reader.defaultBookmarkName +
                ' ' +
                this.currentState.sceneId
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
                alert(translations.reader.bookmarkSaved);
            } else {
                const error = await response.json();
                alert(
                    translations.reader.bookmarkFailed +
                        ' ' +
                        (error.message || 'Unknown error')
                );
            }
        } catch (error) {
            console.error('Failed to save bookmark:', error);
            alert(translations.reader.bookmarkError);
        }
    };

    handleNext = (): void => {
        const translations = this.t;
        const sceneNumber = this.parseSceneNumber(this.currentState.sceneId);
        if (
            sceneNumber !== null &&
            this.hasNextScene(this.currentState.sceneId)
        ) {
            const nextScene = `scene_${sceneNumber + 1}`;
            this.navigateToScene(nextScene);
        } else {
            alert(translations.reader.endOfStory);
        }
    };

    renderReader(): void {
        const container = document.getElementById('reader-container');
        if (!container) return;

        const translations = this.t;

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
            const mountedComponent = mount(NovelReaderComponent, {
                target: container,
                props: {
                    dialogue,
                    choice,
                    onChoice: this.handleChoice,
                    onBookmark: this.handleBookmark,
                    onNext: this.handleNext,
                    canGoNext,
                    showBookmarkButton: true,
                    locale: translations.locale,
                    backUrl: `/${translations.locale}/`,
                },
            });

            this.readerInstance = {
                unmount: () => {
                    const destroy = (
                        mountedComponent as { destroy?: () => void }
                    ).destroy;
                    if (typeof destroy === 'function') {
                        destroy();
                    }
                },
            };
        });
    }

    initialize(): void {
        this.currentState = this.loadInitialState();
        this.saveState(this.currentState);
        this.renderReader();
    }
}
