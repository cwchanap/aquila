import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { onePotBeforeDawnZhDialogue } from '../../generated/onePotBeforeDawn/dialogue.zh';
import { onePotBeforeDawnEnDialogue } from '../../generated/onePotBeforeDawn/dialogue.en';
import { onePotBeforeDawnJaDialogue } from '../../generated/onePotBeforeDawn/dialogue.ja';
import {
    onePotBeforeDawnFlow,
    type OnePotBeforeDawnSceneId,
} from '../../generated/onePotBeforeDawn/flow';
import { onePotBeforeDawnChoiceText } from './choices.zh';
import { onePotBeforeDawnChoiceTextEn } from './choices.en';
import { onePotBeforeDawnChoiceTextJa } from './choices.ja';
import { pickLocalized, type LocalizedContent } from '../localized';

export { onePotBeforeDawnFlow };
export type { OnePotBeforeDawnSceneId };

export type OnePotBeforeDawnFlowConfig = FlowConfig<OnePotBeforeDawnSceneId>;

// Short stories are authored in zh with en and ja mirror trees
// (raw/onePotBeforeDawn/en/ and raw/onePotBeforeDawn/ja/).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: onePotBeforeDawnZhDialogue,
    en: onePotBeforeDawnEnDialogue,
    ja: onePotBeforeDawnJaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(onePotBeforeDawnFlow, onePotBeforeDawnChoiceText),
    en: buildChoiceMap(onePotBeforeDawnFlow, onePotBeforeDawnChoiceTextEn),
    ja: buildChoiceMap(onePotBeforeDawnFlow, onePotBeforeDawnChoiceTextJa),
};

export function getOnePotBeforeDawnStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized(
            'one_pot_before_dawn',
            dialogueByLocale,
            locale
        ),
        choices: pickLocalized('one_pot_before_dawn', choicesByLocale, locale),
    };
}
