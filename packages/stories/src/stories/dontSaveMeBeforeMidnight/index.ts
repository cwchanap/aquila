import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { pickLocalized, type LocalizedContent } from '../localized';
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

// Only the zh source is authored so far; every locale reads it until a
// mirror tree is added (see STORY_TEXT_LOCALES).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: dontSaveMeBeforeMidnightZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    dontSaveMeBeforeMidnightFlow,
    dontSaveMeBeforeMidnightChoiceText
);

export function getDontSaveMeBeforeMidnightStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized(
            'dont_save_me_before_midnight',
            dialogueByLocale,
            locale
        ),
        choices,
    };
}
