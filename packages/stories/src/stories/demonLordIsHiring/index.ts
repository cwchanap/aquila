import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { demonLordIsHiringZhDialogue } from '../../generated/demonLordIsHiring/dialogue.zh';
import { demonLordIsHiringEnDialogue } from '../../generated/demonLordIsHiring/dialogue.en';
import { demonLordIsHiringJaDialogue } from '../../generated/demonLordIsHiring/dialogue.ja';
import {
    demonLordIsHiringFlow,
    type DemonLordIsHiringSceneId,
} from '../../generated/demonLordIsHiring/flow';
import { demonLordIsHiringChoiceText } from './choices.zh';
import { demonLordIsHiringChoiceTextEn } from './choices.en';
import { demonLordIsHiringChoiceTextJa } from './choices.ja';
import { pickLocalized, type LocalizedContent } from '../localized';

export { demonLordIsHiringFlow };
export type { DemonLordIsHiringSceneId };

export type DemonLordIsHiringFlowConfig = FlowConfig<DemonLordIsHiringSceneId>;

// Short stories are authored in zh with en and ja mirror trees
// (raw/demonLordIsHiring/en/ and raw/demonLordIsHiring/ja/).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: demonLordIsHiringZhDialogue,
    en: demonLordIsHiringEnDialogue,
    ja: demonLordIsHiringJaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(demonLordIsHiringFlow, demonLordIsHiringChoiceText),
    en: buildChoiceMap(demonLordIsHiringFlow, demonLordIsHiringChoiceTextEn),
    ja: buildChoiceMap(demonLordIsHiringFlow, demonLordIsHiringChoiceTextJa),
};

export function getDemonLordIsHiringStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized(
            'demon_lord_is_hiring',
            dialogueByLocale,
            locale
        ),
        choices: pickLocalized('demon_lord_is_hiring', choicesByLocale, locale),
    };
}
