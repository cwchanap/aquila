import { z } from 'zod';
import type { DialogueEntry } from '../types';

/**
 * Line voice: one audio file per spoken line, named by a hash of who speaks
 * and what they say. Editing a line changes its id, so the reader goes silent
 * for that line instead of playing a stale take.
 *
 * Files live under `<storyId>/<locale>/` below the voice root, next to an
 * `index.json` listing the ids that have audio.
 */
export const VOICE_INDEX_SCHEMA_VERSION = 1 as const;

/** Languages each story has line voice in. The reader only looks for voice
 *  files for these, so add a story here when its first scene is voiced. */
export const STORY_VOICE_LOCALES: Readonly<Record<string, readonly string[]>> =
    {
        the_seventh_mirror: ['zh'],
    };

export function hasStoryVoice(storyId: string, locale: string): boolean {
    return STORY_VOICE_LOCALES[storyId]?.includes(locale) ?? false;
}

export const VoiceIndexSchema = z
    .object({
        schemaVersion: z.literal(VOICE_INDEX_SCHEMA_VERSION),
        lines: z.array(z.string().regex(/^[0-9a-f]{14}$/)),
    })
    .strict();
export type VoiceIndex = z.infer<typeof VoiceIndexSchema>;

// cyrb53: a small, fast 53-bit string hash. Plenty for the few thousand
// lines of a story and cheap enough to run in the browser on every line.
function cyrb53(text: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function voiceLineId(
    entry: Pick<DialogueEntry, 'characterId' | 'dialogue'>
): string {
    return cyrb53(`${entry.characterId ?? ''}\u0000${entry.dialogue}`)
        .toString(16)
        .padStart(14, '0');
}

export function voiceIndexPath(storyId: string, locale: string): string {
    return `${storyId}/${locale}/index.json`;
}

export function voiceLinePath(
    storyId: string,
    locale: string,
    lineId: string
): string {
    return `${storyId}/${locale}/${lineId}.mp3`;
}
