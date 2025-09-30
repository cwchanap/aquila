import type { ChoiceMap, DialogueMap } from '../types';
import { getTrainAdventureStory } from './trainAdventure';

export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};

const storyLoaders: Record<string, (locale: string) => StoryLoaderResult> = {
    train_adventure: getTrainAdventureStory,
};

export function getStoryContent(
    storyId: string | undefined,
    locale: string | undefined
): StoryLoaderResult {
    const normalizedLocale = (locale || 'en').toLowerCase();
    const loader = storyLoaders[storyId ?? 'train_adventure'];
    if (loader) {
        return loader(normalizedLocale);
    }
    return storyLoaders['train_adventure'](normalizedLocale);
}
