import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { elevatorGameZhDialogue } from '../../generated/elevatorGame/dialogue.zh';
import { elevatorGameEnDialogue } from '../../generated/elevatorGame/dialogue.en';
import { elevatorGameJaDialogue } from '../../generated/elevatorGame/dialogue.ja';
import {
    elevatorGameFlow,
    type ElevatorGameSceneId,
} from '../../generated/elevatorGame/flow';
import { elevatorGameChoiceText } from './choices.zh';
import { elevatorGameChoiceTextEn } from './choices.en';
import { elevatorGameChoiceTextJa } from './choices.ja';
import { pickLocalized, type LocalizedContent } from '../localized';

export { elevatorGameFlow };
export type { ElevatorGameSceneId };

export type ElevatorGameFlowConfig = FlowConfig<ElevatorGameSceneId>;

// Short stories are authored in zh with en and ja mirror trees
// (raw/elevatorGame/en/ and raw/elevatorGame/ja/).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: elevatorGameZhDialogue,
    en: elevatorGameEnDialogue,
    ja: elevatorGameJaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(elevatorGameFlow, elevatorGameChoiceText),
    en: buildChoiceMap(elevatorGameFlow, elevatorGameChoiceTextEn),
    ja: buildChoiceMap(elevatorGameFlow, elevatorGameChoiceTextJa),
};

export function getElevatorGameStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized('elevator_game', dialogueByLocale, locale),
        choices: pickLocalized('elevator_game', choicesByLocale, locale),
    };
}
