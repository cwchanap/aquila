import type { AssetManifest } from './resolve-assets';
import type { StoryStats } from '../story-stats';
import type { MirrorLocale } from './localize';
import type { StoryNotes } from '../notes-types';

/** A source-only unlock fence target; never emitted into a dialogue entry. */
export interface NoteUnlockTargetIR {
    characterId: string;
    kind: 'met' | 'name' | 'fact';
    factId?: string;
}

export interface DialogueEntryIR {
    // Always concrete: the parser resolves every "**name**：" line to a character id
    // string (narrator included, via 旁白 → 'narrator') and throws on unknowns,
    // so unlike the runtime DialogueEntry this is never speakerless.
    characterId: string;
    // Speaker label to display for this line: the as-written header, or a
    // canonicalized form for misspelled/verbose source labels.
    displayName: string;
    dialogue: string;
    /** Unlock fences immediately preceding this entry. Compiler-only: the
     *  scene emitter ignores them and they become notes events instead. */
    unlocks?: NoteUnlockTargetIR[];
    sfx?: string;
    bgm?: string | null;
    /** Prompt of a ```bg block that starts a new background here. */
    backgroundPrompt?: string;
    /** Name given on that block's fence (```bg <name>); keys the background
     *  `<dir>/<scene>_<name>` instead of the next `_s<N>`. */
    backgroundName?: string;
    /** Key of an existing background shown again from here (a ```bg block
     *  whose body is `reuse <key>`). */
    backgroundReuse?: string;
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
    /** Translated scenes from each `<locale>/` mirror tree, in `scenes`
     *  order; scenes without a translated file are left out and read the zh
     *  text. A locale with no mirror tree is absent. */
    mirrors?: Partial<Record<MirrorLocale, SceneIR[]>>;
    /** Compiled character notes, absent when the story has no notes/zh.md. */
    notes?: StoryNotes;
    stats?: StoryStats;
}
