import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { pickLocalized, type LocalizedContent } from '../localized';
import { trainAdventureZhDialogue } from '../../generated/trainAdventure/dialogue.zh';
import {
    trainAdventureFlow,
    type TrainAdventureSceneId,
} from '../../generated/trainAdventure/flow';
import { trainAdventureChoiceText } from './choices.zh';

export { trainAdventureFlow };
export type { TrainAdventureSceneId };

// Convenience alias consumed by the story registry (stories/index.ts).
export type TrainAdventureFlowConfig = FlowConfig<TrainAdventureSceneId>;

// Only the zh source is authored so far; every locale reads it until a
// mirror tree is added (see STORY_TEXT_LOCALES).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: trainAdventureZhDialogue,
};

// Choices are locale-independent: flow transitions merged with hand-maintained
// choice text. Empty text surfaces as visible TODO markers (see buildChoiceMap).
const choices: ChoiceMap = buildChoiceMap(
    trainAdventureFlow,
    trainAdventureChoiceText
);

export function getTrainAdventureStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized('train_adventure', dialogueByLocale, locale),
        choices,
    };
}
