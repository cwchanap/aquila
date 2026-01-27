import type { ChoiceMap, DialogueMap } from '../../types';
import { trainAdventureEnChoices, trainAdventureEnDialogue } from './en';
import { trainAdventureZhChoices, trainAdventureZhDialogue } from './zh';
export { trainAdventureFlow } from './flow';
export type {
    TrainAdventureFlowConfig,
    TrainAdventureFlowNodeDefinition,
} from './flow';

export type TrainAdventureLocale = 'en' | 'zh';

const dialogueByLocale: Record<TrainAdventureLocale, DialogueMap> = {
    en: trainAdventureEnDialogue,
    zh: trainAdventureZhDialogue,
};

const choicesByLocale: Record<TrainAdventureLocale, ChoiceMap> = {
    en: trainAdventureEnChoices,
    zh: trainAdventureZhChoices,
};

export function getTrainAdventureStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized = locale.startsWith('zh') ? 'zh' : 'en';
    return {
        dialogue: dialogueByLocale[normalized as TrainAdventureLocale],
        choices: choicesByLocale[normalized as TrainAdventureLocale],
    };
}
