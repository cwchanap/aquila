import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { day4012ZhDialogue } from '../../generated/day4012/dialogue.zh';
import { day4012EnDialogue } from '../../generated/day4012/dialogue.en';
import { day4012Flow, type Day4012SceneId } from '../../generated/day4012/flow';
import { day4012ChoiceText } from './choices.zh';
import { day4012ChoiceTextEn } from './choices.en';

export { day4012Flow };
export type { Day4012SceneId };

export type Day4012FlowConfig = FlowConfig<Day4012SceneId>;

type Day4012Locale = 'en' | 'zh';

// Short stories are authored in both languages: the en dialogue is compiled
// from the raw/day4012/en/ mirror tree.
const dialogueByLocale: Record<Day4012Locale, DialogueMap> = {
    zh: day4012ZhDialogue,
    en: day4012EnDialogue,
};

const choicesByLocale: Record<Day4012Locale, ChoiceMap> = {
    zh: buildChoiceMap(day4012Flow, day4012ChoiceText),
    en: buildChoiceMap(day4012Flow, day4012ChoiceTextEn),
};

export function getDay4012Story(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: Day4012Locale = locale.startsWith('zh') ? 'zh' : 'en';
    return {
        dialogue: dialogueByLocale[normalized],
        choices: choicesByLocale[normalized],
    };
}
