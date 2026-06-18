import type { DialogueEntry, Translations } from '@aquila/stories';

/**
 * Resolve the display name for a dialogue entry.
 *  1. `entry.character` (author override / alias / role label) wins.
 *  2. else `entry.characterId` → `t.characterNames[id]` (fallback `t.reader.unknown`).
 *  3. else '' (narration).
 */
export function resolveCharacterName(
    entry: DialogueEntry | undefined,
    t: Translations
): string {
    if (!entry) return '';

    if (entry.character) {
        return entry.character;
    }

    if (entry.characterId) {
        const localizedName = t.characterNames?.[entry.characterId];
        if (localizedName) {
            return localizedName;
        }
        return t.reader.unknown;
    }

    return '';
}
