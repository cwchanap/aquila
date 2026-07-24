export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    background?: string;
    portrait?: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

export type PortraitSlot = 'left' | 'center' | 'right';

export type StoryPresentationMetadata = {
    portrait: {
        /** The MVP reader renders at most one portrait for the active line. */
        activeLimit: 1;
        /** Used whenever a character has no explicit slot assignment. */
        defaultSlot: PortraitSlot;
        slotsByCharacterId: Readonly<Record<string, PortraitSlot>>;
    };
};

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
