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
    elevator_game: async locale => {
        const module = await import('../stories/elevatorGame');
        return {
            ...module.getElevatorGameStory(locale),
            flow: module.elevatorGameFlow,
        };
    },
    demon_lord_is_hiring: async locale => {
        const module = await import('../stories/demonLordIsHiring');
        return {
            ...module.getDemonLordIsHiringStory(locale),
            flow: module.demonLordIsHiringFlow,
        };
    },
    three_am_laundromat: async locale => {
        const module = await import('../stories/threeAmLaundromat');
        return {
            ...module.getThreeAmLaundromatStory(locale),
            flow: module.threeAmLaundromatFlow,
        };
    },
    day_4012: async locale => {
        const module = await import('../stories/day4012');
        return {
            ...module.getDay4012Story(locale),
            flow: module.day4012Flow,
        };
    },
    one_pot_before_dawn: async locale => {
        const module = await import('../stories/onePotBeforeDawn');
        return {
            ...module.getOnePotBeforeDawnStory(locale),
            flow: module.onePotBeforeDawnFlow,
        };
    },
} satisfies Record<RegisteredStoryId, StoryPayloadImporter>;

const storyContentLoader = createStoryContentLoader(storyImporters);

export const loadStoryContent = storyContentLoader.load;
export const resetStoryContentCacheForTests = storyContentLoader.reset;
