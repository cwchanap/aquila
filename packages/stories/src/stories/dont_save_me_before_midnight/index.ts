import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { dont_save_me_before_midnightZhDialogue } from '../../generated/dont_save_me_before_midnight/dialogue.zh';
import {
    dont_save_me_before_midnightFlow,
    type Dont_save_me_before_midnightSceneId,
} from '../../generated/dont_save_me_before_midnight/flow';
import { dont_save_me_before_midnightChoiceText } from './choices.zh';

export { dont_save_me_before_midnightFlow };
export type { Dont_save_me_before_midnightSceneId };

export type Dont_save_me_before_midnightFlowConfig =
    FlowConfig<Dont_save_me_before_midnightSceneId>;

export type DontSaveMeBeforeMidnightLocale = 'en' | 'zh';

const dialogueByLocale: Record<DontSaveMeBeforeMidnightLocale, DialogueMap> = {
    zh: dont_save_me_before_midnightZhDialogue,
    en: dont_save_me_before_midnightZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    dont_save_me_before_midnightFlow,
    dont_save_me_before_midnightChoiceText
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
