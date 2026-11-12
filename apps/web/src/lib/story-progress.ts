export interface StoryProgress {
    sceneId: string;
    /** 0-based index of the current line within the scene. */
    dialogueIndex: number;
    /** Epoch milliseconds of the last recorded position. */
    updatedAt: number;
    /** True once the reader has reached an ending and not moved since. */
    finished: boolean;
    /** Ending scene ids reached at least once, in the order first reached. */
    endings: string[];
    visited?: string[];
}

export type StoryProgressMap = Record<string, StoryProgress>;

/**
 * Largest stored map, in serialized bytes. POST /api/progress rejects
 * bodies over 48 KiB and sync uploads the whole map, so writes keep the
 * map under this budget with margin for the request envelope.
 */
export const STORY_PROGRESS_MAX_BYTES = 44 * 1024;

/**
 * Trims `map` until its serialized form fits `maxBytes`, so a stored map —
 * and therefore every sync upload — can never outgrow the endpoint's body
 * limit. Records are handled oldest `updatedAt` first: for each, `visited`
 * (story-map decoration) goes before `endings` (completion badges), and the
 * record itself — the position Continue depends on — is dropped last.
 * Returns `map` unchanged when it already fits.
 */
export function boundStoryProgressMap(
    map: StoryProgressMap,
    maxBytes: number = STORY_PROGRESS_MAX_BYTES
): StoryProgressMap {
    const fits = (candidate: StoryProgressMap): boolean =>
        new TextEncoder().encode(JSON.stringify(candidate)).byteLength <=
        maxBytes;
    if (fits(map)) return map;
    const byAge = Object.keys(map).sort(
        (a, b) => map[a].updatedAt - map[b].updatedAt
    );
    const bounded: StoryProgressMap = { ...map };
    for (const id of byAge) {
        const record = { ...bounded[id] };
        if (record.visited === undefined) continue;
        delete record.visited;
        bounded[id] = record;
        if (fits(bounded)) return bounded;
    }
    for (const id of byAge) {
        if (bounded[id].endings.length === 0) continue;
        bounded[id] = { ...bounded[id], endings: [] };
        if (fits(bounded)) return bounded;
    }
    for (const id of byAge) {
        delete bounded[id];
        if (fits(bounded)) return bounded;
    }
    return bounded;
}

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(e => typeof e === 'string');
}

/** Turns one untrusted entry into a progress record, or null when invalid.
 *  A malformed `visited` forfeits only itself: the saved position and
 *  reached endings still apply. */
export function normalizeStoryProgress(value: unknown): StoryProgress | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (
        typeof v.sceneId !== 'string' ||
        typeof v.dialogueIndex !== 'number' ||
        !Number.isFinite(v.dialogueIndex) ||
        v.dialogueIndex < 0 ||
        typeof v.updatedAt !== 'number' ||
        typeof v.finished !== 'boolean' ||
        !isStringList(v.endings)
    ) {
        return null;
    }
    const { visited, ...rest } = v;
    const record = {
        ...rest,
        endings: [...(v.endings as string[])],
    } as StoryProgress;
    if (isStringList(visited)) record.visited = [...visited];
    return record;
}

/** All valid records of an untrusted map; malformed entries are dropped. */
export function normalizeStoryProgressMap(value: unknown): StoryProgressMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const entries: [string, StoryProgress][] = [];
    for (const [id, record] of Object.entries(value)) {
        const normalized = normalizeStoryProgress(record);
        if (normalized) entries.push([id, normalized]);
    }
    // fromEntries defines own keys, so an untrusted "__proto__" key stays
    // data instead of replacing the result's prototype.
    return Object.fromEntries(entries);
}

/** Stable de-duplicated union: the selected side's order first, then the
 *  other side's unseen entries. Undefined when neither side has the list. */
function unionStrings(
    selected: readonly string[] | undefined,
    other: readonly string[] | undefined
): string[] | undefined {
    if (!selected && !other) return undefined;
    return [...new Set([...(selected ?? []), ...(other ?? [])])];
}

export function mergeStoryProgressMaps(
    local: StoryProgressMap,
    stored: StoryProgressMap
): StoryProgressMap {
    const entries: [string, StoryProgress][] = [];
    const ids = new Set([...Object.keys(local), ...Object.keys(stored)]);
    for (const id of ids) {
        const localRecord = Object.hasOwn(local, id) ? local[id] : undefined;
        const storedRecord = Object.hasOwn(stored, id) ? stored[id] : undefined;
        if (!localRecord || !storedRecord) {
            const record = (localRecord ?? storedRecord) as StoryProgress;
            const visited = unionStrings(record.visited, undefined);
            entries.push([
                id,
                {
                    ...record,
                    endings: unionStrings(record.endings, undefined) ?? [],
                    ...(visited && { visited }),
                },
            ]);
            continue;
        }
        // updatedAt picks the position; the stored side wins ties.
        const [selected, other] =
            storedRecord.updatedAt >= localRecord.updatedAt
                ? [storedRecord, localRecord]
                : [localRecord, storedRecord];
        const visited = unionStrings(selected.visited, other.visited);
        entries.push([
            id,
            {
                ...selected,
                endings: unionStrings(selected.endings, other.endings) ?? [],
                ...(visited && { visited }),
            },
        ]);
    }
    return Object.fromEntries(entries);
}
