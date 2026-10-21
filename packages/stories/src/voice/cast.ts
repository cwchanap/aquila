import { z } from 'zod';
import type { DialogueEntry } from '../types';
import { voiceLineId } from './index';

export const VOICE_CAST_SCHEMA_VERSION = 1 as const;

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

const VoiceLocaleCastSchema = z
    .object({
        /** ISO 639-1 code sent to ElevenLabs as `language_code`. */
        languageCode: z.string().min(2),
        /** Keyed by compiled characterId; uncast characters stay silent. */
        roles: z.record(z.string(), VoiceRoleSchema),
    })
    .strict();
export type VoiceLocaleCast = z.infer<typeof VoiceLocaleCastSchema>;

export const VoiceCastSchema = z
    .object({
        schemaVersion: z.literal(VOICE_CAST_SCHEMA_VERSION),
        modelId: z.string().min(1),
        locales: z.record(z.string(), VoiceLocaleCastSchema),
    })
    .strict();
export type VoiceCast = z.infer<typeof VoiceCastSchema>;

export function parseVoiceCast(value: unknown): VoiceCast {
    return VoiceCastSchema.parse(value);
}

const INNER_MARKER = /^\s*[（(]\s*[內内]心\s*[）)]\s*/;
const SPEAKABLE = /[\p{L}\p{N}]/u;

/** The text sent to the TTS model for one line, or null if nothing to say. */
export function spokenText(
    entry: Pick<DialogueEntry, 'dialogue'>,
    role: VoiceRole
): string | null {
    const inner = INNER_MARKER.test(entry.dialogue);
    const text = entry.dialogue
        .replace(INNER_MARKER, '')
        .replace(/⋯/g, '…')
        .trim();
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
    jobs: VoiceLineJob[];
    /** characterIds that speak in the scene but have no role in the cast. */
    uncast: string[];
};

/** One job per distinct spoken line; repeated lines share one file. */
export function planVoiceLines(
    entries: readonly DialogueEntry[],
    cast: VoiceLocaleCast
): VoiceScenePlan {
    const jobs = new Map<string, VoiceLineJob>();
    const uncast = new Set<string>();
    for (const entry of entries) {
        const characterId = entry.characterId;
        if (!characterId) continue;
        const role = cast.roles[characterId];
        if (!role) {
            uncast.add(characterId);
            continue;
        }
        const text = spokenText(entry, role);
        if (text === null) continue;
        const lineId = voiceLineId(entry);
        if (!jobs.has(lineId)) {
            jobs.set(lineId, {
                lineId,
                characterId,
                voiceId: role.voiceId,
                text,
            });
        }
    }
    return { jobs: [...jobs.values()], uncast: [...uncast].sort() };
}
