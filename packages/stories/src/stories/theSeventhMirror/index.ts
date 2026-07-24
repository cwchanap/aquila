import type {
    ChoiceMap,
    DialogueMap,
    StoryPresentationMetadata,
} from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { theSeventhMirrorZhDialogue } from '../../generated/theSeventhMirror/dialogue.zh';
import {
    theSeventhMirrorFlow,
    type TheSeventhMirrorSceneId,
} from '../../generated/theSeventhMirror/flow';
import { theSeventhMirrorChoiceText } from './choices.zh';
import { storyPresentation } from '../../generated/theSeventhMirror/presentation';

export { theSeventhMirrorFlow };
export type { TheSeventhMirrorSceneId };

export type TheSeventhMirrorFlowConfig = FlowConfig<TheSeventhMirrorSceneId>;

type TheSeventhMirrorLocale = 'en' | 'zh';

// English is not yet authored; fall back to the generated zh content as a
// visible placeholder so the default-locale ('en') reader stays functional.
// TODO: author/compile real en source.
const dialogueByLocale: Record<TheSeventhMirrorLocale, DialogueMap> = {
    zh: theSeventhMirrorZhDialogue,
    en: theSeventhMirrorZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    theSeventhMirrorFlow,
    theSeventhMirrorChoiceText
);

export function getTheSeventhMirrorStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
    presentation: StoryPresentationMetadata;
} {
    const normalized: TheSeventhMirrorLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices,
        presentation: storyPresentation,
    };
}
