import type { CharacterId } from '../characters';

export interface ResolvedCharacter {
    /** Stable unique-character reference id. */
    id: CharacterId;
    /** Label to render for this line — the as-written speaker label, or a
     *  canonicalized one for misspelled/verbose source labels. */
    displayName: string;
}

export interface StoryCompilerConfig {
    /** Registry id used by getStoryContent/getStoryFlow, e.g. 'train_adventure'. */
    storyId: string;
    /** Resolve a markdown character header (real name OR alias) to a character
     *  reference id plus the display label to render for that line. */
    resolveCharacter: (name: string) => ResolvedCharacter | undefined;
}
