export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    background?: string;
    portrait?: string;
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
