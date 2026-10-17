import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { threeAmLaundromatZhDialogue } from '../../generated/threeAmLaundromat/dialogue.zh';
import { threeAmLaundromatEnDialogue } from '../../generated/threeAmLaundromat/dialogue.en';
import {
    threeAmLaundromatFlow,
    type ThreeAmLaundromatSceneId,
} from '../../generated/threeAmLaundromat/flow';
import { threeAmLaundromatChoiceText } from './choices.zh';
import { threeAmLaundromatChoiceTextEn } from './choices.en';

export { threeAmLaundromatFlow };
export type { ThreeAmLaundromatSceneId };

export type ThreeAmLaundromatFlowConfig = FlowConfig<ThreeAmLaundromatSceneId>;

type ThreeAmLaundromatLocale = 'en' | 'zh';

// Short stories are authored in both languages: the en dialogue is compiled
// from the raw/threeAmLaundromat/en/ mirror tree.
const dialogueByLocale: Record<ThreeAmLaundromatLocale, DialogueMap> = {
    zh: threeAmLaundromatZhDialogue,
    en: threeAmLaundromatEnDialogue,
};

const choicesByLocale: Record<ThreeAmLaundromatLocale, ChoiceMap> = {
    zh: buildChoiceMap(threeAmLaundromatFlow, threeAmLaundromatChoiceText),
    en: buildChoiceMap(threeAmLaundromatFlow, threeAmLaundromatChoiceTextEn),
};

export function getThreeAmLaundromatStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: ThreeAmLaundromatLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices: choicesByLocale[normalized],
    };
}
