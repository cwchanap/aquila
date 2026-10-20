import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { pickLocalized, type LocalizedContent } from '../localized';
import { theSeventhMirrorZhDialogue } from '../../generated/theSeventhMirror/dialogue.zh';
import {
    theSeventhMirrorFlow,
    type TheSeventhMirrorSceneId,
} from '../../generated/theSeventhMirror/flow';
import { theSeventhMirrorChoiceText } from './choices.zh';

export { theSeventhMirrorFlow };
export type { TheSeventhMirrorSceneId };

export type TheSeventhMirrorFlowConfig = FlowConfig<TheSeventhMirrorSceneId>;

// Only the zh source is authored so far; every locale reads it until a
// mirror tree is added (see STORY_TEXT_LOCALES).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: theSeventhMirrorZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    theSeventhMirrorFlow,
    theSeventhMirrorChoiceText
);

export function getTheSeventhMirrorStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized('the_seventh_mirror', dialogueByLocale, locale),
        choices,
    };
}
