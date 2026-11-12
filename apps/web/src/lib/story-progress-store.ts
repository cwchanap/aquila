/**
 * Per-story reading progress kept in localStorage, so reading one story never
 * overwrites another's place. The reader records every persisted position;
 * the story select page reads it to offer Continue and to count endings.
 *
 * Scene ids and dialogue indexes are locale-independent (translations mirror
 * the zh entry layout), so one record per story serves both languages.
 */
import type { Locale } from '@aquila/stories';
import { isRegisteredStoryId } from '@aquila/stories/async';
import { SUPPORTED_LOCALES } from '@aquila/stories/translations';
import { migratePersisted, READER_SESSION_KEY_PREFIX } from './reader-session';
import {
    boundStoryProgressMap,
    normalizeStoryProgressMap,
    type StoryProgress,
    type StoryProgressMap,
} from './story-progress';

export type { StoryProgress, StoryProgressMap } from './story-progress';

export const STORY_PROGRESS_KEY = 'aquila:storyProgress:v1';

/** Pre-wrapper sidecar: the account id a stored map last synced with, kept
 *  as a second key. Only read when the stored blob predates the wrapped
 *  layout — current writes carry the owner inside the blob so tag and data
 *  always commit in one storage call and can never drift apart. */
const LEGACY_OWNER_KEY = 'aquila:storyProgress:v1:owner';

export interface ProgressPosition {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    /** The position is the last line of a scene with no next scene. */
    atEnding: boolean;
}

/** What the storage key holds today: the progress map plus the account it
 *  last synced with. `owner` is null for a map that has never synced —
 *  anonymous progress uploads to the first account that signs in, while a
 *  map tagged for another account is quarantined instead of merged. */
interface StoredProgress {
    map: StoryProgressMap;
    owner: string | null;
}

export class StoryProgressStore {
    constructor(
        private readonly storage: Storage | null,
        private readonly now: () => number = Date.now
    ) {}

    /** All valid records; malformed entries are dropped, never thrown on. */
    getAll(): StoryProgressMap {
        return this.getAllChecked() ?? {};
    }

    /** Like getAll, but null when the saved map cannot be read, so a caller
     *  that writes back (sync) never mistakes a failed read for no progress. */
    getAllChecked(): StoryProgressMap | null {
        return this.readStored()?.map ?? null;
    }

    get(storyId: string): StoryProgress | null {
        const all = this.getAll();
        return Object.hasOwn(all, storyId) ? all[storyId] : null;
    }

    /** Reads map and owner together. A wrapped (`v: 2`) blob carries its
     *  owner inline; anything else is the pre-wrapper layout, whose owner
     *  tag — if any — still sits under the legacy sidecar key. Null only
     *  when storage is unavailable or the blob cannot be parsed. */
    private readStored(): StoredProgress | null {
        if (!this.storage) return null;
        let raw: string | null;
        try {
            raw = this.storage.getItem(STORY_PROGRESS_KEY);
        } catch {
            return null;
        }
        if (raw === null) return { map: {}, owner: this.legacyOwner() };
        try {
            const parsed: unknown = JSON.parse(raw);
            if (
                parsed !== null &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed) &&
                (parsed as { v?: unknown }).v === 2
            ) {
                const blob = parsed as {
                    owner?: unknown;
                    progress?: unknown;
                };
                return {
                    map: normalizeStoryProgressMap(blob.progress),
                    owner: typeof blob.owner === 'string' ? blob.owner : null,
                };
            }
            return {
                map: normalizeStoryProgressMap(parsed),
                owner: this.legacyOwner(),
            };
        } catch {
            return null;
        }
    }

    /** The pre-wrapper owner tag; kept readable so a map written before the
     *  wrapped layout still reports the account it synced with. */
    private legacyOwner(): string | null {
        try {
            return this.storage?.getItem(LEGACY_OWNER_KEY) ?? null;
        } catch {
            return null;
        }
    }

    /** Serializes map and owner under the size budget and commits them in a
     *  single storage call — the only write path, so a stored map can never
     *  sit untagged beside a stale owner. Write failures stay nonfatal. */
    private writeStored(map: StoryProgressMap, owner: string | null): boolean {
        if (!this.storage) return false;
        try {
            this.storage.setItem(
                STORY_PROGRESS_KEY,
                JSON.stringify({
                    v: 2,
                    owner,
                    progress: boundStoryProgressMap(map),
                })
            );
        } catch {
            return false;
        }
        try {
            this.storage.removeItem(LEGACY_OWNER_KEY);
        } catch {
            // A stale sidecar is harmless: reads prefer the wrapped owner.
        }
        return true;
    }

    /** The account id the stored map last synced with; null when the map
     *  has never been pushed or the tag cannot be read. Falls back to the
     *  legacy sidecar when the blob itself is unreadable, so a corrupt map
     *  still answers "whose copy was this". */
    getOwner(): string | null {
        const stored = this.readStored();
        // The wrapped blob is authoritative — including an explicit null
        // owner; only an unreadable/absent blob consults the sidecar.
        return stored ? stored.owner : this.legacyOwner();
    }

    /** Tags the stored map with the account that owns it, committed with
     *  the map itself. False when the map cannot be re-read or the write
     *  fails — a caller that reports sync success must not ignore this. */
    setOwner(userId: string): boolean {
        const stored = this.readStored();
        if (!stored) return false;
        return this.writeStored(stored.map, userId);
    }

    /** Replaces the stored map outright and records the owning account in
     *  the same write — the shared-browser path drops another user's local
     *  copy this way instead of merging it into a different account. */
    replaceAll(map: StoryProgressMap, userId: string): boolean {
        return this.writeStored(map, userId);
    }

    /** Read-modify-write in one synchronous operation, the same shape as
     *  record(): the merge runs against the freshest stored map, so a line
     *  read after the caller's last look is merged rather than overwritten.
     *  Passing `owner` retags the commit atomically — a successful merge
     *  and its owner tag land or fail together. Returns false when storage
     *  or the read fails. Note the read and the write are still two
     *  separate storage calls — localStorage offers no cross-tab lock, so
     *  a concurrent record() in another tab can be lost between them. */
    update(
        merge: (current: StoryProgressMap) => StoryProgressMap,
        owner?: string
    ): boolean {
        const stored = this.readStored();
        if (!stored) return false;
        return this.writeStored(merge(stored.map), owner ?? stored.owner);
    }

    /** Adds a record for a story that has none yet, from a place saved before
     *  per-story progress existed. Never replaces an existing record; the
     *  seeded record sorts as older than anything recorded since. */
    seed(position: {
        storyId: string;
        sceneId: string;
        dialogueIndex: number;
    }): boolean {
        if (!this.storage || this.get(position.storyId)) return false;
        const stored = this.readStored();
        const next: StoryProgressMap = {
            ...(stored?.map ?? {}),
            [position.storyId]: {
                sceneId: position.sceneId,
                dialogueIndex: Math.trunc(position.dialogueIndex),
                updatedAt: 0,
                finished: false,
                endings: [],
            },
        };
        return this.writeStored(
            next,
            stored ? stored.owner : this.legacyOwner()
        );
    }

    /** Records the reader's position. Returns false when storage is
     *  unavailable. A signed-in reader (accountId) claims the map: an
     *  anonymous copy is tagged so its first-signer upload is bound to
     *  this account, and a copy tagged for another account is quarantined
     *  outright, so a later sync's replacement cannot discard this
     *  account's reading. */
    record(
        position: ProgressPosition,
        accountId: string | null = null
    ): boolean {
        if (!this.storage) return false;
        const stored = this.readStored();
        let all = stored?.map ?? {};
        let owner = stored ? stored.owner : this.legacyOwner();
        if (accountId !== null) {
            if (owner !== null && owner !== accountId) all = {};
            owner = accountId;
        }
        const previous = Object.hasOwn(all, position.storyId)
            ? all[position.storyId]
            : null;
        const endings = previous ? [...previous.endings] : [];
        if (position.atEnding && !endings.includes(position.sceneId)) {
            endings.push(position.sceneId);
        }
        const visited = previous?.visited ? [...previous.visited] : [];
        if (!visited.includes(position.sceneId)) {
            visited.push(position.sceneId);
        }
        const next: StoryProgressMap = {
            ...all,
            [position.storyId]: {
                sceneId: position.sceneId,
                dialogueIndex: Number.isFinite(position.dialogueIndex)
                    ? Math.max(0, Math.trunc(position.dialogueIndex))
                    : 0,
                updatedAt: this.now(),
                finished: position.atEnding,
                endings,
                visited,
            },
        };
        return this.writeStored(next, owner);
    }
}

const SESSION_LOCALES: readonly Locale[] = SUPPORTED_LOCALES;

/** Carries each locale's last reader session (`aquila:readerState:<locale>`,
 *  the only place saved before this store existed) into the store, for
 *  stories that have no record yet. The `preferred` locale's session wins
 *  when two sessions name the same story. */
export function importSavedSessions(
    store: StoryProgressStore,
    storage: Storage | null,
    preferred: Locale
): void {
    const locales = [
        preferred,
        ...SESSION_LOCALES.filter(locale => locale !== preferred),
    ];
    for (const locale of locales) {
        let raw: string | null = null;
        try {
            raw =
                storage?.getItem(`${READER_SESSION_KEY_PREFIX}:${locale}`) ??
                null;
        } catch {
            continue;
        }
        if (!raw) continue;
        let session: ReturnType<typeof migratePersisted> = null;
        try {
            session = migratePersisted(JSON.parse(raw), locale);
        } catch {
            continue;
        }
        if (
            !session ||
            !isRegisteredStoryId(session.storyId) ||
            !Number.isFinite(session.dialogueIndex) ||
            session.dialogueIndex < 0
        ) {
            continue;
        }
        store.seed(session);
    }
}
