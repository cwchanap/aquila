import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { pickLocalized, type LocalizedContent } from '../localized';
import { trainAdventureZhDialogue } from '../../generated/trainAdventure/dialogue.zh';
import { trainAdventureEnDialogue } from '../../generated/trainAdventure/dialogue.en';
import { trainAdventureJaDialogue } from '../../generated/trainAdventure/dialogue.ja';
import {
    trainAdventureFlow,
    type TrainAdventureSceneId,
} from '../../generated/trainAdventure/flow';
import { trainAdventureChoiceText } from './choices.zh';
import { trainAdventureChoiceTextEn } from './choices.en';
import { trainAdventureChoiceTextJa } from './choices.ja';

export { trainAdventureFlow };
export type { TrainAdventureSceneId };

// Convenience alias consumed by the story registry (stories/index.ts).
export type TrainAdventureFlowConfig = FlowConfig<TrainAdventureSceneId>;

// The en and ja mirror trees (raw/trainAdventure/en/, ja/) are being filled
// route by route; scenes not translated yet read the zh text.
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: trainAdventureZhDialogue,
    en: trainAdventureEnDialogue,
    ja: trainAdventureJaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(trainAdventureFlow, trainAdventureChoiceText),
    en: buildChoiceMap(trainAdventureFlow, trainAdventureChoiceTextEn),
    ja: buildChoiceMap(trainAdventureFlow, trainAdventureChoiceTextJa),
};

export function getTrainAdventureStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized('train_adventure', dialogueByLocale, locale),
        choices: pickLocalized('train_adventure', choicesByLocale, locale),
    };
}
