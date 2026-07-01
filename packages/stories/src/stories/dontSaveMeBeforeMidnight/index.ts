import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { dontSaveMeBeforeMidnightZhDialogue } from '../../generated/dontSaveMeBeforeMidnight/dialogue.zh';
import {
    dontSaveMeBeforeMidnightFlow,
    type DontSaveMeBeforeMidnightSceneId,
} from '../../generated/dontSaveMeBeforeMidnight/flow';
import { dontSaveMeBeforeMidnightChoiceText } from './choices.zh';

export { dontSaveMeBeforeMidnightFlow };
export type { DontSaveMeBeforeMidnightSceneId };

export type DontSaveMeBeforeMidnightFlowConfig =
    FlowConfig<DontSaveMeBeforeMidnightSceneId>;

type DontSaveMeBeforeMidnightLocale = 'en' | 'zh';

const dialogueByLocale: Record<DontSaveMeBeforeMidnightLocale, DialogueMap> = {
    zh: dontSaveMeBeforeMidnightZhDialogue,
    en: dontSaveMeBeforeMidnightZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    dontSaveMeBeforeMidnightFlow,
    dontSaveMeBeforeMidnightChoiceText
);

export function getDontSaveMeBeforeMidnightStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: DontSaveMeBeforeMidnightLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return { dialogue: dialogueByLocale[normalized], choices };
}
