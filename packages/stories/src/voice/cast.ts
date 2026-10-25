import { z } from 'zod';
import type { DialogueEntry } from '../types';

export const VOICE_CAST_SCHEMA_VERSION = 2 as const;

const VoiceRoleSchema = z
    .object({
        /** ElevenLabs voice id. */
        voiceId: z.string().min(1),
        /** Display name of the voice, for humans reading the cast file. */
        voiceName: z.string().min(1),
        /** Audio tags put before every line, e.g. "[whispers]". */
        direction: z.string().trim().min(1).optional(),
        /** Audio tags for inner monologue lines, e.g. "[softly]". */
        innerDirection: z.string().trim().min(1).optional(),
        notes: z.string().trim().min(1).optional(),
    })
    .strict();
export type VoiceRole = z.infer<typeof VoiceRoleSchema>;

export const VoiceCastSchema = z
    .object({
        schemaVersion: z.literal(VOICE_CAST_SCHEMA_VERSION),
        modelId: z.string().min(1),
        /** ISO 639-1 code of the spoken language, sent as `language_code`. */
        language: z.string().min(2),
        /** Keyed by compiled characterId; uncast characters stay silent. */
        roles: z.record(z.string(), VoiceRoleSchema),
    })
    .strict();
export type VoiceCast = z.infer<typeof VoiceCastSchema>;

export function parseVoiceCast(value: unknown): VoiceCast {
    return VoiceCastSchema.parse(value);
}

/**
 * Spoken text for stories with no reader text in the voice language:
 * `docs/voice-script.<language>.json`, one `{ zh, <language> }` pair per zh line
 * of each voiced scene. The zh half pins each translation to its source line.
 */
export const VoiceScriptSchema = z
    .object({
        schemaVersion: z.literal(1),
        scenes: z.record(
            z.string(),
            z.array(z.object({ zh: z.string() }).catchall(z.string()))
        ),
    })
    .strict();
export type VoiceScript = z.infer<typeof VoiceScriptSchema>;

// cyrb53: a small, fast 53-bit string hash; plenty for a story's lines.
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

/** A take is named by the voice and the exact prompt it was made from, so a
 *  recast, a retranslation or a new direction tag all ask for a new take. */
export function voiceLineId(voiceId: string, text: string): string {
    return cyrb53(`${voiceId}\u0000${text}`).toString(16).padStart(14, '0');
}

const INNER_MARKER = /^\s*[（(]\s*[內内]心\s*[）)]\s*/;
// The ja reader text marks inner monologue as （心の声）; never speak either marker.
const SPOKEN_MARKER = /^\s*[（(]\s*(?:[內内]心|心の声)\s*[）)]\s*/;
const SPEAKABLE = /[\p{L}\p{N}]/u;

/** The prompt sent to the TTS model for one line, or null if nothing to say.
 *  Inner monologue is marked on the zh source line. */
export function spokenText(
    source: Pick<DialogueEntry, 'dialogue'>,
    spoken: string,
    role: VoiceRole
): string | null {
    const inner = INNER_MARKER.test(source.dialogue);
    const text = spoken.replace(SPOKEN_MARKER, '').replace(/⋯/g, '…').trim();
    if (!SPEAKABLE.test(text)) return null;
    const direction = inner
        ? (role.innerDirection ?? role.direction)
        : role.direction;
    return direction ? `${direction} ${text}` : text;
}

export type VoiceLineJob = {
    lineId: string;
    characterId: string;
    voiceId: string;
    text: string;
};

export type VoiceScenePlan = {
    /** One per dialogue line, aligned with the scene; null means silent. */
    slots: (VoiceLineJob | null)[];
    /** characterIds that speak in the scene but have no role in the cast. */
    uncast: string[];
};

export function planVoiceScene(
    source: readonly DialogueEntry[],
    spoken: readonly string[],
    cast: VoiceCast
): VoiceScenePlan {
    const uncast = new Set<string>();
    const slots = source.map((entry, index) => {
        const characterId = entry.characterId;
        if (!characterId) return null;
        const role = cast.roles[characterId];
        if (!role) {
            uncast.add(characterId);
            return null;
        }
        const text = spokenText(entry, spoken[index], role);
        if (text === null) return null;
        return {
            lineId: voiceLineId(role.voiceId, text),
            characterId,
            voiceId: role.voiceId,
            text,
        };
    });
    return { slots, uncast: [...uncast].sort() };
}
