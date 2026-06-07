export interface ResolvedCharacter {
    /** Stable unique-character reference id (string, matches generated enum value). */
    id: string;
    /** Label to render for this line — the as-written speaker label, or a
     *  canonicalized one for misspelled/verbose source labels. */
    displayName: string;
}

export interface StoryCompilerConfig {
    /** Registry id used by getStoryContent/getStoryFlow, e.g. 'train_adventure'. */
    storyId: string;
    /** Misspelled / verbose / dual-name source labels -> a clean canonical label.
     *  The canonical form is used both for resolution AND as the per-line displayName. */
    canonicalize?: Record<string, string>;
    /** Anonymous / role speakers collapse to ONE reference id each;
     *  the as-written label is preserved per line via displayName. */
    rolePatterns?: { pattern: RegExp; id: string }[];
    /** Default speaker for non-header paragraphs (narration). ID must exist in characters. */
    defaultSpeakerId?: string;
    /** Override path to characters.md (default: 'docs/characters.md'). */
    charactersDocPath?: string;
    /** Override suffix regex for stripping (內心)/聲音/etc. Default: common pattern. */
    suffixRegex?: RegExp;
}
