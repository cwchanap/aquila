import type { CharacterId } from './characters';

export type DialogueEntry = {
    character?: string;
    characterId?: CharacterId;
    dialogue: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

export type ChoiceOptionDefinition = {
    id: string;
    nextScene: string;
    label: string;
};

export type ChoiceDefinition = {
    prompt: string;
    options: ChoiceOptionDefinition[];
};

export type ChoiceMap = { [choiceId: string]: ChoiceDefinition };
