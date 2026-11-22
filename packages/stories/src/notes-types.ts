import type { FlowConfig } from './flow-types';
import type { Locale } from './translations';

/** A note string filled for every reading locale at compile time (zh fallback). */
export type StoryNoteText = Record<Locale, string>;

export type StoryNoteEventKind = 'speech' | 'met' | 'name' | 'fact';

/**
 * A compact, compiled unlock event. Notes never carry source paths; source
 * locations stay in compiler diagnostics.
 */
export interface StoryNoteEvent {
    sceneId: string;
    /** Zero-based index of the dialogue entry the marker applies to. */
    entryIndex: number;
    characterId: string;
    /**
     * `speech`: the first implicit spoken meet for this character in this
     * scene. `met`/`name`/`fact`: an explicit unlock fence.
     */
    kind: StoryNoteEventKind;
    /** `speech`: visible speaker labels from that entry in each locale. */
    labels?: StoryNoteText;
    /** `fact`: the unlocked fact id. */
    factId?: string;
}

export interface StoryNoteFact {
    id: string;
    text: StoryNoteText;
}

export interface StoryNoteCharacter {
    id: string;
    hidden: boolean;
    /** Canonical name. Reveal it only once a `name` event is reached. */
    name: StoryNoteText;
    /**
     * Authored label for a character met by an explicit `.met` marker before
     * speaking. Speech-derived labels live on `speech` events instead; when
     * neither exists the UI shows its generic anonymous label.
     */
    knownAs?: StoryNoteText;
    facts: StoryNoteFact[];
}

export interface StoryNotes {
    storyId: string;
    characters: StoryNoteCharacter[];
    events: StoryNoteEvent[];
}

/** What the lazy notes importer resolves: the small notes payload plus the
 *  locale-independent flow used by the spoiler-safe selector. */
export interface StoryNotesPayload {
    notes: StoryNotes;
    flow: FlowConfig;
}
