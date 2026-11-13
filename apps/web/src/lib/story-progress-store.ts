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
    mergeStoryProgressMaps,
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

/** Sidelined copies live one-per-owner under `${SIDELINED_PREFIX}<ownerId>`:
 *  a quarantined map is evicted here instead of deleted so its unsynced
 *  records survive until their owner signs back in and claims them. */
const SIDELINED_PREFIX = 'aquila:storyProgress:v1:sidelined:';

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
export interface StoredProgress {
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
     *  when storage is unavailable or the blob cannot be parsed. The legacy
     *  fallback applies to the main key only — sidelined copies are always
     *  wrapped writes. */
    private readBlob(key: string, legacy = false): StoredProgress | null {
        if (!this.storage) return null;
        let raw: string | null;
        try {
            raw = this.storage.getItem(key);
        } catch {
            return null;
        }
        const fallbackOwner = () => (legacy ? this.legacyOwner() : null);
        if (raw === null) return { map: {}, owner: fallbackOwner() };
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
                owner: fallbackOwner(),
            };
        } catch {
            return null;
        }
    }

    private readStored(): StoredProgress | null {
        return this.readBlob(STORY_PROGRESS_KEY, true);
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
     *  single storage call. Write failures stay nonfatal. */
    private writeBlob(
        key: string,
        map: StoryProgressMap,
        owner: string | null
    ): boolean {
        if (!this.storage) return false;
        try {
            this.storage.setItem(
                key,
                JSON.stringify({
                    v: 2,
                    owner,
                    progress: boundStoryProgressMap(map),
                })
            );
        } catch {
            return false;
        }
        return true;
    }

    /** The only main-key write path, so a stored map can never sit untagged
     *  beside a stale owner. */
    private writeStored(map: StoryProgressMap, owner: string | null): boolean {
        if (!this.writeBlob(STORY_PROGRESS_KEY, map, owner)) return false;
        try {
            this.storage?.removeItem(LEGACY_OWNER_KEY);
        } catch {
            // A stale sidecar is harmless: reads prefer the wrapped owner.
        }
        return true;
    }

    /** Moves an evicted owner's map aside (best effort) instead of dropping
     *  it — its records may never have synced, and deleting them would break
     *  the local-first contract for that account's next sign-in. */
    private sideline(owner: string, map: StoryProgressMap): void {
        if (Object.keys(map).length === 0) return;
        void this.writeBlob(SIDELINED_PREFIX + owner, map, owner);
    }

    private readSidelined(accountId: string): StoredProgress | null {
        return this.readBlob(SIDELINED_PREFIX + accountId);
    }

    private dropSidelined(accountId: string): void {
        try {
            this.storage?.removeItem(SIDELINED_PREFIX + accountId);
        } catch {
            // A stuck copy is inert: it only merges for its own account.
        }
    }

    /** The copy sidelined for this account, if any. Its records are this
     *  account's own even while the stored map belongs to someone else, so
     *  a foreign-owned sync still owes them an upload. */
    getSidelined(accountId: string): StoryProgressMap {
        return this.readSidelined(accountId)?.map ?? {};
    }

    /** Merges this account's sidelined copy back into the stored map when the
     *  map is the account's own (or unowned), then drops the copy. A map
     *  owned by someone else leaves the sidelined copy waiting — it is not
     *  this call's to merge or to discard. */
    restoreSidelined(accountId: string): void {
        const sidelined = this.readSidelined(accountId);
        if (!sidelined || Object.keys(sidelined.map).length === 0) return;
        const stored = this.readStored();
        if (!stored || (stored.owner !== null && stored.owner !== accountId)) {
            return;
        }
        if (
            this.writeStored(
                mergeStoryProgressMaps(stored.map, sidelined.map),
                accountId
            )
        ) {
            this.dropSidelined(accountId);
        }
    }

    /** Removes every locale's saved reader session. Called when a
     *  foreign-owned map is quarantined: the sessions are the previous
     *  account's local state and must not seed the new owner's map. */
    dropReaderSessions(): void {
        if (!this.storage) return;
        for (const locale of SESSION_LOCALES) {
            try {
                this.storage.removeItem(
                    `${READER_SESSION_KEY_PREFIX}:${locale}`
                );
            } catch {
                // A stuck session can seed at most one stale record.
            }
        }
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
     *  the map itself. `expectedOwner` claims the tag only while the stored
     *  owner still matches — a tag that appears meanwhile belongs to a
     *  different account and must not be overwritten. False when the map
     *  cannot be re-read, the write fails, or the owner check fails — a
     *  caller that reports sync success must not ignore this. */
    setOwner(userId: string, expectedOwner?: string | null): boolean {
        const stored = this.readStored();
        if (!stored) return false;
        if (expectedOwner !== undefined && stored.owner !== expectedOwner) {
            return false;
        }
        return this.writeStored(stored.map, userId);
    }

    /** Map and owner in one read — the same failure contract as
     *  getAllChecked. Sync needs the pair atomically: whose records the map
     *  holds decides what a late response may commit. */
    getWithOwnerChecked(): StoredProgress | null {
        return this.readStored();
    }

    /** True when the stored map is tagged for a different account: a
     *  signed-in caller must not read it as its own progress (card state,
     *  resume position, session fallbacks). Sync uses getWithOwnerChecked
     *  instead — it needs the foreign map to replace it. */
    isForeignTo(accountId: string | null): boolean {
        if (accountId === null) return false;
        const owner = this.getOwner();
        return owner !== null && owner !== accountId;
    }

    /** Replaces the stored map outright and records the owning account in
     *  the same write — the shared-browser path evicts another user's local
     *  copy this way instead of merging it into a different account. The
     *  evicted copy is sidelined for its owner first: its unsynced records
     *  must survive until that account returns. */
    replaceAll(map: StoryProgressMap, userId: string): boolean {
        const stored = this.readStored();
        if (
            stored &&
            stored.owner !== null &&
            stored.owner !== userId &&
            Object.keys(stored.map).length > 0
        ) {
            this.sideline(stored.owner, stored.map);
        }
        return this.writeStored(map, userId);
    }

    /** Read-modify-write in one synchronous operation, the same shape as
     *  record(): the merge runs against the freshest stored map, so a line
     *  read after the caller's last look is merged rather than overwritten.
     *  Passing `owner` retags the commit atomically — a successful merge
     *  and its owner tag land or fail together. `expectedOwner` rejects the
     *  commit outright when the stored tag no longer matches: a map
     *  retagged behind the caller's request belongs to a different account
     *  and is left untouched. Returns false when storage, the read, or the
     *  owner check fails. Note the read and the write are still two
     *  separate storage calls — localStorage offers no cross-tab lock, so
     *  a concurrent record() in another tab can be lost between them. */
    update(
        merge: (current: StoryProgressMap) => StoryProgressMap,
        owner?: string,
        expectedOwner?: string | null
    ): boolean {
        const stored = this.readStored();
        if (!stored) return false;
        if (expectedOwner !== undefined && stored.owner !== expectedOwner) {
            return false;
        }
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
     *  this account, and a copy tagged for another account is quarantined —
     *  sidelined for that owner rather than deleted, so its unsynced
     *  records can still be claimed the next time it signs in. The same
     *  claim restores this account's own sidelined copy and clears the
     *  evicted owner's reader sessions. A signed-out record never appends
     *  to a tagged map either: the write carries no account attribution,
     *  so the previous owner's copy is sidelined intact and the record
     *  starts a fresh unowned map — claimable by the next signed-in
     *  account like any anonymous progress. */
    record(
        position: ProgressPosition,
        accountId: string | null = null
    ): boolean {
        if (!this.storage) return false;
        const stored = this.readStored();
        let all = stored?.map ?? {};
        let owner = stored ? stored.owner : this.legacyOwner();
        let quarantined = false;
        let restoredSidelined = false;
        if (accountId !== null) {
            if (owner !== null && owner !== accountId) {
                this.sideline(owner, all);
                all = {};
                quarantined = true;
            }
            const sidelined = this.readSidelined(accountId);
            if (sidelined && Object.keys(sidelined.map).length > 0) {
                all = mergeStoryProgressMaps(all, sidelined.map);
                restoredSidelined = true;
            }
            owner = accountId;
        } else if (owner !== null) {
            this.sideline(owner, all);
            all = {};
            owner = null;
            quarantined = true;
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
        const committed = this.writeStored(next, owner);
        if (committed) {
            if (restoredSidelined) this.dropSidelined(accountId as string);
            // The evicted owner's sessions go with its map — they cannot be
            // allowed to seed this account's copy through a later import.
            if (quarantined) this.dropReaderSessions();
        }
        return committed;
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
