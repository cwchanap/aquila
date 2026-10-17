import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { onePotBeforeDawnZhDialogue } from '../../generated/onePotBeforeDawn/dialogue.zh';
import { onePotBeforeDawnEnDialogue } from '../../generated/onePotBeforeDawn/dialogue.en';
import {
    onePotBeforeDawnFlow,
    type OnePotBeforeDawnSceneId,
} from '../../generated/onePotBeforeDawn/flow';
import { onePotBeforeDawnChoiceText } from './choices.zh';
import { onePotBeforeDawnChoiceTextEn } from './choices.en';

export { onePotBeforeDawnFlow };
export type { OnePotBeforeDawnSceneId };

export type OnePotBeforeDawnFlowConfig = FlowConfig<OnePotBeforeDawnSceneId>;

type OnePotBeforeDawnLocale = 'en' | 'zh';

// Short stories are authored in both languages: the en dialogue is compiled
// from the raw/onePotBeforeDawn/en/ mirror tree.
const dialogueByLocale: Record<OnePotBeforeDawnLocale, DialogueMap> = {
    zh: onePotBeforeDawnZhDialogue,
    en: onePotBeforeDawnEnDialogue,
};

const choicesByLocale: Record<OnePotBeforeDawnLocale, ChoiceMap> = {
    zh: buildChoiceMap(onePotBeforeDawnFlow, onePotBeforeDawnChoiceText),
    en: buildChoiceMap(onePotBeforeDawnFlow, onePotBeforeDawnChoiceTextEn),
};

export function getOnePotBeforeDawnStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: OnePotBeforeDawnLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices: choicesByLocale[normalized],
    };
}
