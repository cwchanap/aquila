import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { elevatorGameZhDialogue } from '../../generated/elevatorGame/dialogue.zh';
import { elevatorGameEnDialogue } from '../../generated/elevatorGame/dialogue.en';
import {
    elevatorGameFlow,
    type ElevatorGameSceneId,
} from '../../generated/elevatorGame/flow';
import { elevatorGameChoiceText } from './choices.zh';
import { elevatorGameChoiceTextEn } from './choices.en';

export { elevatorGameFlow };
export type { ElevatorGameSceneId };

export type ElevatorGameFlowConfig = FlowConfig<ElevatorGameSceneId>;

type ElevatorGameLocale = 'en' | 'zh';

// Short stories are authored in both languages: the en dialogue is compiled
// from the raw/elevatorGame/en/ mirror tree.
const dialogueByLocale: Record<ElevatorGameLocale, DialogueMap> = {
    zh: elevatorGameZhDialogue,
    en: elevatorGameEnDialogue,
};

const choicesByLocale: Record<ElevatorGameLocale, ChoiceMap> = {
    zh: buildChoiceMap(elevatorGameFlow, elevatorGameChoiceText),
    en: buildChoiceMap(elevatorGameFlow, elevatorGameChoiceTextEn),
};

export function getElevatorGameStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: ElevatorGameLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices: choicesByLocale[normalized],
    };
}
