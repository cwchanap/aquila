/**
 * Size facts the compiler measures for every story, used to label it on the
 * story select page ("8 min", "8 chapters · ~13 h", "2 endings").
 */
export interface StoryStats {
    /** Number of scenes (act files) in the story. */
    scenes: number;
    /** Number of `chapter_*` directories at the story root. */
    chapters: number;
    /** Number of terminal scenes a reader can finish on. */
    endings: number;
    /** Reading characters (zh source, whitespace excluded) on the shortest
     *  path from the first scene to an ending. */
    minPathChars: number;
    /** Same as minPathChars, for the longest path. */
    maxPathChars: number;
}

/** Typical silent-reading pace for Chinese fiction, in characters per minute. */
export const ZH_CHARS_PER_MINUTE = 400;

/** Estimated reading minutes for a number of zh characters (at least 1). */
export function estimateReadingMinutes(chars: number): number {
    return Math.max(1, Math.round(chars / ZH_CHARS_PER_MINUTE));
}
