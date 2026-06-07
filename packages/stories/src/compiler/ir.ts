import type { AssetManifest } from './resolve-assets';

export interface DialogueEntryIR {
    // Always concrete: the parser resolves every "**name**：" line to a character id
    // string (narrator included, via 旁白 → 'narrator') and throws on unknowns,
    // so unlike the runtime DialogueEntry this is never speakerless.
    characterId: string;
    // Speaker label to display for this line: the as-written header, or a
    // canonicalized form for misspelled/verbose source labels.
    displayName: string;
    dialogue: string;
    backgroundPrompt?: string;
    expressionKey?: string;
    background?: string;
    portrait?: string;
}

export interface SceneIR {
    id: string;
    title?: string;
    entries: DialogueEntryIR[];
    next: string | null;
    sourcePath: string;
}

export interface ChoiceOptionIR {
    optionId: string;
    nextScene: string;
}

export interface ChoiceIR {
    choiceId: string;
    fromSceneId: string;
    options: ChoiceOptionIR[];
}

export interface StoryIR {
    storyId: string;
    name: string;
    start: string;
    scenes: SceneIR[];
    choices: ChoiceIR[];
    assetManifest?: AssetManifest;
}
