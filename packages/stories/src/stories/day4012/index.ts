import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { day4012ZhDialogue } from '../../generated/day4012/dialogue.zh';
import { day4012EnDialogue } from '../../generated/day4012/dialogue.en';
import { day4012JaDialogue } from '../../generated/day4012/dialogue.ja';
import { day4012Flow, type Day4012SceneId } from '../../generated/day4012/flow';
import { day4012ChoiceText } from './choices.zh';
import { day4012ChoiceTextEn } from './choices.en';
import { day4012ChoiceTextJa } from './choices.ja';
import { pickLocalized, type LocalizedContent } from '../localized';

export { day4012Flow };
export type { Day4012SceneId };

export type Day4012FlowConfig = FlowConfig<Day4012SceneId>;

// Short stories are authored in zh with en and ja mirror trees
// (raw/day4012/en/ and raw/day4012/ja/).
const dialogueByLocale: LocalizedContent<DialogueMap> = {
    zh: day4012ZhDialogue,
    en: day4012EnDialogue,
    ja: day4012JaDialogue,
};

const choicesByLocale: LocalizedContent<ChoiceMap> = {
    zh: buildChoiceMap(day4012Flow, day4012ChoiceText),
    en: buildChoiceMap(day4012Flow, day4012ChoiceTextEn),
    ja: buildChoiceMap(day4012Flow, day4012ChoiceTextJa),
};

export function getDay4012Story(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    return {
        dialogue: pickLocalized('day_4012', dialogueByLocale, locale),
        choices: pickLocalized('day_4012', choicesByLocale, locale),
    };
}
