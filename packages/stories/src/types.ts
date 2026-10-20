/** A furigana reading over `dialogue.slice(start, end)`. */
export type RubySpan = { start: number; end: number; reading: string };

export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    /** Furigana for Japanese text, in order and not overlapping. */
    ruby?: RubySpan[];
    sfx?: string;
    bgm?: string | null;
    background?: string;
    portrait?: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

export type ChoiceOptionDefinition = {
    id: string;
    nextScene: string;
    label: string;
    labelRuby?: RubySpan[];
};

export type ChoiceDefinition = {
    prompt: string;
    promptRuby?: RubySpan[];
    options: ChoiceOptionDefinition[];
};

export type ChoiceMap = { [choiceId: string]: ChoiceDefinition };
