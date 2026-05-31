import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { trainAdventureZhDialogue } from '../../generated/trainAdventure/dialogue.zh';
import {
    trainAdventureFlow,
    type TrainAdventureSceneId,
} from '../../generated/trainAdventure/flow';
import { trainAdventureChoiceText } from './choices.zh';

export { trainAdventureFlow };
export type { TrainAdventureSceneId };

// Convenience alias consumed by the story registry (stories/index.ts).
export type TrainAdventureFlowConfig = FlowConfig<TrainAdventureSceneId>;

export type TrainAdventureLocale = 'en' | 'zh';

// English is not yet authored; fall back to the generated zh content as a
// visible placeholder so the default-locale ('en') reader stays functional.
// TODO: author/compile real en source.
const dialogueByLocale: Record<TrainAdventureLocale, DialogueMap> = {
    zh: trainAdventureZhDialogue,
    en: trainAdventureZhDialogue,
};

// Choices are locale-independent: flow transitions merged with hand-maintained
// choice text. Empty text surfaces as visible TODO markers (see buildChoiceMap).
const choices: ChoiceMap = buildChoiceMap(
    trainAdventureFlow,
    trainAdventureChoiceText
);

export function getTrainAdventureStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: TrainAdventureLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return { dialogue: dialogueByLocale[normalized], choices };
}
