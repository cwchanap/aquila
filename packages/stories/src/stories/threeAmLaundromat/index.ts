import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { threeAmLaundromatZhDialogue } from '../../generated/threeAmLaundromat/dialogue.zh';
import { threeAmLaundromatEnDialogue } from '../../generated/threeAmLaundromat/dialogue.en';
import { threeAmLaundromatJaDialogue } from '../../generated/threeAmLaundromat/dialogue.ja';
import {
    threeAmLaundromatFlow,
    type ThreeAmLaundromatSceneId,
} from '../../generated/threeAmLaundromat/flow';
import { threeAmLaundromatChoiceText } from './choices.zh';
import { threeAmLaundromatChoiceTextEn } from './choices.en';
import { threeAmLaundromatChoiceTextJa } from './choices.ja';
import { pickLocalized, type LocalizedContent } from '../localized';

export { threeAmLaundromatFlow };
export type { ThreeAmLaundromatSceneId };

export type ThreeAmLaundromatFlowConfig = FlowConfig<ThreeAmLaundromatSceneId>;

// Short stories are authored in zh with en and ja mirror trees
// (raw/threeAmLaundromat/en/ and raw/threeAmLaundromat/ja/).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: threeAmLaundromatZhDialogue,
    en: threeAmLaundromatEnDialogue,
    ja: threeAmLaundromatJaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(threeAmLaundromatFlow, threeAmLaundromatChoiceText),
    en: buildChoiceMap(threeAmLaundromatFlow, threeAmLaundromatChoiceTextEn),
    ja: buildChoiceMap(threeAmLaundromatFlow, threeAmLaundromatChoiceTextJa),
};

export function getThreeAmLaundromatStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized(
            'three_am_laundromat',
            dialogueByLocale,
            locale
        ),
        choices: pickLocalized('three_am_laundromat', choicesByLocale, locale),
    };
}
