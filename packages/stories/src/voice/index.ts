import { z } from 'zod';

/**
 * Line voice: one audio file per spoken line, in a single voice language per
 * story (a Japanese dub plays whatever language the text is read in).
 *
 * Files live under `<storyId>/` below the voice root, next to an
 * `index.json` that maps each scene's dialogue positions to line ids. All
 * reading locales share those positions, because translations mirror the zh
 * source line for line.
 */
export const VOICE_INDEX_SCHEMA_VERSION = 2 as const;

/** The language each voiced story is spoken in. The reader only looks for
 *  voice files for these, so add a story here when its first scene is voiced. */
export const STORY_VOICE_LANGUAGE: Readonly<Record<string, string>> = {
    the_seventh_mirror: 'ja',
};

export function hasStoryVoice(storyId: string): boolean {
    return storyId in STORY_VOICE_LANGUAGE;
}

const LINE_ID = /^[0-9a-f]{14}$/;

export const VoiceIndexSchema = z
    .object({
        schemaVersion: z.literal(VOICE_INDEX_SCHEMA_VERSION),
        language: z.string().min(2),
        /** Per scene, one entry per dialogue line: its line id, or null when
         *  that line has no audio. */
        scenes: z.record(
            z.string(),
            z.array(z.string().regex(LINE_ID).nullable())
        ),
    })
    .strict();
export type VoiceIndex = z.infer<typeof VoiceIndexSchema>;

export function voiceIndexPath(storyId: string): string {
    return `${storyId}/index.json`;
}

export function voiceLinePath(storyId: string, lineId: string): string {
    return `${storyId}/${lineId}.mp3`;
}
