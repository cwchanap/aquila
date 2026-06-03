import type { ChoiceMap, DialogueMap } from '../types';
import {
    getTrainAdventureStory,
    trainAdventureFlow,
    type TrainAdventureFlowConfig,
} from './trainAdventure';
import {
    getDontSaveMeBeforeMidnightStory,
    dontSaveMeBeforeMidnightFlow,
    type DontSaveMeBeforeMidnightFlowConfig,
} from './dontSaveMeBeforeMidnight';

export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};

export type StoryFlowConfig =
    | TrainAdventureFlowConfig
    | DontSaveMeBeforeMidnightFlowConfig;

const storyLoaders: Record<string, (locale: string) => StoryLoaderResult> = {
    train_adventure: getTrainAdventureStory,
    dont_save_me_before_midnight: getDontSaveMeBeforeMidnightStory,
};

const storyFlows: Record<string, StoryFlowConfig> = {
    train_adventure: trainAdventureFlow,
    dont_save_me_before_midnight: dontSaveMeBeforeMidnightFlow,
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

/**
 * Get the flow configuration for a story.
 * Flow configs are locale-independent as they define structure, not content.
 */
export function getStoryFlow(
    storyId: string | undefined
): StoryFlowConfig | undefined {
    return (
        storyFlows[storyId ?? 'train_adventure'] ??
        storyFlows['train_adventure']
    );
}
