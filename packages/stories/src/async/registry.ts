import type { RegisteredStoryId } from '../story-metadata';
import { createStoryContentLoader, type StoryPayloadImporter } from './loader';

export const storyImporters = {
    train_adventure: async locale => {
        const module = await import('../stories/trainAdventure');
        return {
            ...module.getTrainAdventureStory(locale),
            flow: module.trainAdventureFlow,
        };
    },
    dont_save_me_before_midnight: async locale => {
        const module = await import('../stories/dontSaveMeBeforeMidnight');
        return {
            ...module.getDontSaveMeBeforeMidnightStory(locale),
            flow: module.dontSaveMeBeforeMidnightFlow,
        };
    },
    the_seventh_mirror: async locale => {
        const module = await import('../stories/theSeventhMirror');
        return {
            ...module.getTheSeventhMirrorStory(locale),
            flow: module.theSeventhMirrorFlow,
        };
    },
} satisfies Record<RegisteredStoryId, StoryPayloadImporter>;

const storyContentLoader = createStoryContentLoader(storyImporters);

export const loadStoryContent = storyContentLoader.load;
export const resetStoryContentCacheForTests = storyContentLoader.reset;
