import { trainAdventureDialogue as zhTrain } from './zh/trainAdventureDialogue';
import { trainAdventureDialogue as enTrain } from './en/trainAdventureDialogue';

export type DialogueMap = {
    [key: string]: { character: string; dialogue: string }[];
};

export function getTrainAdventureDialogue(locale?: string): DialogueMap {
    const l = (locale || '').toLowerCase();
    if (l.startsWith('zh')) return zhTrain as DialogueMap;
    return enTrain as DialogueMap;
}
