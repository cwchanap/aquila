import type { ChoiceMap, DialogueMap } from '../types';
import type { RegisteredStoryId } from '../story-metadata';
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
import {
    getTheSeventhMirrorStory,
    theSeventhMirrorFlow,
    type TheSeventhMirrorFlowConfig,
} from './theSeventhMirror';
import {
    getElevatorGameStory,
    elevatorGameFlow,
    type ElevatorGameFlowConfig,
} from './elevatorGame';
import {
    getDemonLordIsHiringStory,
    demonLordIsHiringFlow,
    type DemonLordIsHiringFlowConfig,
} from './demonLordIsHiring';
import {
    getThreeAmLaundromatStory,
    threeAmLaundromatFlow,
    type ThreeAmLaundromatFlowConfig,
} from './threeAmLaundromat';
import {
    getDay4012Story,
    day4012Flow,
    type Day4012FlowConfig,
} from './day4012';
import {
    getOnePotBeforeDawnStory,
    onePotBeforeDawnFlow,
    type OnePotBeforeDawnFlowConfig,
} from './onePotBeforeDawn';

export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};

export type StoryFlowConfig =
    | TrainAdventureFlowConfig
    | DontSaveMeBeforeMidnightFlowConfig
    | TheSeventhMirrorFlowConfig
    | ElevatorGameFlowConfig
    | DemonLordIsHiringFlowConfig
    | ThreeAmLaundromatFlowConfig
    | Day4012FlowConfig
    | OnePotBeforeDawnFlowConfig;

const storyLoaders = {
    train_adventure: getTrainAdventureStory,
    dont_save_me_before_midnight: getDontSaveMeBeforeMidnightStory,
    the_seventh_mirror: getTheSeventhMirrorStory,
    elevator_game: getElevatorGameStory,
    demon_lord_is_hiring: getDemonLordIsHiringStory,
    three_am_laundromat: getThreeAmLaundromatStory,
    day_4012: getDay4012Story,
    one_pot_before_dawn: getOnePotBeforeDawnStory,
} satisfies Record<RegisteredStoryId, (locale: string) => StoryLoaderResult>;

const storyFlows = {
    train_adventure: trainAdventureFlow,
    dont_save_me_before_midnight: dontSaveMeBeforeMidnightFlow,
    the_seventh_mirror: theSeventhMirrorFlow,
    elevator_game: elevatorGameFlow,
    demon_lord_is_hiring: demonLordIsHiringFlow,
    three_am_laundromat: threeAmLaundromatFlow,
    day_4012: day4012Flow,
    one_pot_before_dawn: onePotBeforeDawnFlow,
} satisfies Record<RegisteredStoryId, StoryFlowConfig>;

export function getStoryContent(
    storyId: string | undefined,
    locale: string | undefined
): StoryLoaderResult {
    const normalizedLocale = (locale || 'en').toLowerCase();
    const loader =
        storyLoaders[(storyId ?? 'train_adventure') as RegisteredStoryId];
    if (loader) {
        return loader(normalizedLocale);
    }
    return storyLoaders['train_adventure'](normalizedLocale);
}

/**
 * Get the flow configuration for a story.
 * Flow configs are locale-independent as they define structure, not content.
 *
 * Returns `undefined` for an unrecognized `storyId` (including a typo or an
 * unregistered id) so callers can render an explicit empty/error state instead
 * of silently substituting another story's structure — which would navigate
 * players into foreign scene ids with no signal. Only an absent (`undefined`)
 * id falls back to the canonical default story.
 */
export function getStoryFlow(
    storyId: string | undefined
): StoryFlowConfig | undefined {
    return storyFlows[(storyId ?? 'train_adventure') as RegisteredStoryId];
}
