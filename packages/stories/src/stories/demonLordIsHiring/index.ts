import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { demonLordIsHiringZhDialogue } from '../../generated/demonLordIsHiring/dialogue.zh';
import { demonLordIsHiringEnDialogue } from '../../generated/demonLordIsHiring/dialogue.en';
import {
    demonLordIsHiringFlow,
    type DemonLordIsHiringSceneId,
} from '../../generated/demonLordIsHiring/flow';
import { demonLordIsHiringChoiceText } from './choices.zh';
import { demonLordIsHiringChoiceTextEn } from './choices.en';

export { demonLordIsHiringFlow };
export type { DemonLordIsHiringSceneId };

export type DemonLordIsHiringFlowConfig = FlowConfig<DemonLordIsHiringSceneId>;

type DemonLordIsHiringLocale = 'en' | 'zh';

// Short stories are authored in both languages: the en dialogue is compiled
// from the raw/demonLordIsHiring/en/ mirror tree.
const dialogueByLocale: Record<DemonLordIsHiringLocale, DialogueMap> = {
    zh: demonLordIsHiringZhDialogue,
    en: demonLordIsHiringEnDialogue,
};

const choicesByLocale: Record<DemonLordIsHiringLocale, ChoiceMap> = {
    zh: buildChoiceMap(demonLordIsHiringFlow, demonLordIsHiringChoiceText),
    en: buildChoiceMap(demonLordIsHiringFlow, demonLordIsHiringChoiceTextEn),
};

export function getDemonLordIsHiringStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: DemonLordIsHiringLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices: choicesByLocale[normalized],
    };
}
