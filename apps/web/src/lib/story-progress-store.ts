/**
 * Per-story reading progress kept in localStorage, so reading one story never
 * overwrites another's place. Each signed-in account owns its own flat key
 * (`aquila:storyProgress:v1:<accountId>`), while signed-out and unavailable
 * states use the plain `aquila:storyProgress:v1` key (identical in name and
 * shape to `main`, keeping rollbacks and anonymous reads safe).
 *
 * Scene ids and dialogue indexes are locale-independent (translations mirror
 * the zh entry layout), so one record per story serves both languages.
 */
import type { Locale } from '@aquila/stories';
import { isRegisteredStoryId } from '@aquila/stories/async';
import { SUPPORTED_LOCALES } from '@aquila/stories/translations';
import {
    migratePersisted,
    readerSessionKey,
    type PersistedSession,
} from './reader-session';
import {
    boundStoryProgressMap,
    mergeStoryProgressMaps,
    normalizeStoryProgressMap,
    type StoryProgress,
    type StoryProgressMap,
} from './story-progress';

export type { StoryProgress, StoryProgressMap } from './story-progress';

export const STORY_PROGRESS_KEY = 'aquila:storyProgress:v1';

/** Key for this owner's progress map. Signed-in accounts get an isolated
 *  key (`aquila:storyProgress:v1:<accountId>`); anonymous/unavailable
 *  visitors use the base `aquila:storyProgress:v1` key. */
export function storyProgressKey(accountId?: string | null): string {
    return typeof accountId === 'string' && accountId.length > 0
        ? `${STORY_PROGRESS_KEY}:${accountId}`
        : STORY_PROGRESS_KEY;
}

export interface ProgressPosition {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    /** The position is the last line of a scene with no next scene. */
    atEnding: boolean;
}

export class StoryProgressStore {
    private readonly key: string;
    private readonly accountId: string | null;

    constructor(
        private readonly storage: Storage | null,
        private readonly now: () => number = Date.now,
        accountId: string | null = null
    ) {
        this.accountId =
            typeof accountId === 'string' && accountId.length > 0
                ? accountId
                : null;
        this.key = storyProgressKey(this.accountId);
    }

    /** All valid records; malformed entries are dropped, never thrown on. */
    getAll(): StoryProgressMap {
        return this.getAllChecked() ?? {};
    }

    /** Like getAll, but null when the saved map cannot be read, so a caller
     *  that writes back (sync) never mistakes a failed read for no progress. */
    getAllChecked(): StoryProgressMap | null {
        return this.readMap(this.key);
    }

    get(storyId: string): StoryProgress | null {
        const all = this.getAll();
        return Object.hasOwn(all, storyId) ? all[storyId] : null;
    }

    private readMap(key: string): StoryProgressMap | null {
        if (!this.storage) return null;
        let raw: string | null;
        try {
            raw = this.storage.getItem(key);
        } catch {
            return null;
        }
        if (raw === null) return {};
        try {
            return normalizeStoryProgressMap(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    /** Serializes a flat progress map under the size budget in one write. */
    private writeMap(key: string, map: StoryProgressMap): boolean {
        if (!this.storage) return false;
        try {
            this.storage.setItem(
                key,
                JSON.stringify(boundStoryProgressMap(map))
            );
        } catch {
            return false;
        }
        return true;
    }

    /** Read-modify-write against the freshest stored copy for this owner. */
    update(merge: (current: StoryProgressMap) => StoryProgressMap): boolean {
        const current = this.readMap(this.key);
        if (!current) return false;
        return this.writeMap(this.key, merge(current));
    }

    /** Adds a record for a story that has none yet, from a place saved
     *  before per-story progress existed. Never replaces an existing
     *  record; the seeded record sorts as older than anything recorded
     *  since. */
    seed(position: {
        storyId: string;
        sceneId: string;
        dialogueIndex: number;
    }): boolean {
        const current = this.readMap(this.key);
        if (!current || Object.hasOwn(current, position.storyId)) return false;
        const next: StoryProgressMap = {
            ...current,
            [position.storyId]: {
                sceneId: position.sceneId,
                dialogueIndex: Math.trunc(position.dialogueIndex),
                updatedAt: 0,
                finished: false,
                endings: [],
            },
        };
        return this.writeMap(this.key, next);
    }

    /** Records the reader's position under this store's owner key. Returns
     *  false when storage is unavailable or the write fails. */
    record(position: ProgressPosition): boolean {
        if (!this.storage) return false;
        const all = this.readMap(this.key) ?? {};
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
        return this.writeMap(this.key, next);
    }

    /** Moves any anonymous local progress (`aquila:storyProgress:v1` and
     *  unscoped `aquila:readerState:<locale>`) into this account's keys on
     *  sign-in. Only deletes the anonymous keys after the account write
     *  succeeds, so a full storage error never drops progress; clearing them
     *  prevents a later account on the same browser from claiming them too. */
    claimAnonymous(preferred: Locale = 'en'): boolean {
        if (this.accountId === null) return true;
        if (!this.storage) return false;

        const anonMap = this.readMap(STORY_PROGRESS_KEY);
        const anonSessions = collectSavedSessions(
            this.storage,
            preferred,
            null
        );
        const hasAnonMap = anonMap !== null && Object.keys(anonMap).length > 0;
        const hasAnonSessions = anonSessions.length > 0;
        if (!hasAnonMap && !hasAnonSessions) {
            return true;
        }

        const accountMap = this.readMap(this.key);
        if (!accountMap) return false;

        let merged: StoryProgressMap = hasAnonMap
            ? mergeStoryProgressMaps(accountMap, anonMap)
            : { ...accountMap };

        for (const session of anonSessions) {
            if (!Object.hasOwn(merged, session.storyId)) {
                merged = {
                    ...merged,
                    [session.storyId]: {
                        sceneId: session.sceneId,
                        dialogueIndex: Math.trunc(session.dialogueIndex),
                        updatedAt: 0,
                        finished: false,
                        endings: [],
                    },
                };
            }
        }

        if (!this.writeMap(this.key, merged)) {
            return false;
        }

        // Migrate anonymous reader sessions to this account's keys if absent,
        // then clear the anonymous keys so another account cannot claim them.
        for (const session of anonSessions) {
            const anonSessionKey = readerSessionKey(session.locale, null);
            const accountSessionKey = readerSessionKey(
                session.locale,
                this.accountId
            );
            try {
                if (this.storage.getItem(accountSessionKey) === null) {
                    this.storage.setItem(
                        accountSessionKey,
                        JSON.stringify(session)
                    );
                }
                this.storage.removeItem(anonSessionKey);
            } catch {
                // Best-effort cleanup of anonymous session keys.
            }
        }

        if (hasAnonMap) {
            try {
                this.storage.removeItem(STORY_PROGRESS_KEY);
            } catch {
                // Best-effort removal after durable write to account key.
            }
        }
        return true;
    }
}

const SESSION_LOCALES: readonly Locale[] = SUPPORTED_LOCALES;

function collectSavedSessions(
    storage: Storage | null,
    preferred: Locale,
    accountId: string | null
): PersistedSession[] {
    if (!storage) return [];
    const locales = [
        preferred,
        ...SESSION_LOCALES.filter(locale => locale !== preferred),
    ];
    const sessions: PersistedSession[] = [];
    for (const locale of locales) {
        let raw: string | null = null;
        try {
            raw = storage.getItem(readerSessionKey(locale, accountId));
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
        sessions.push(session);
    }
    return sessions;
}

/** Carries each locale's last reader session (`aquila:readerState:<locale>`
 *  or per-account `aquila:readerState:<locale>:<accountId>`) into the store
 *  for stories that have no record yet. The `preferred` locale's session wins
 *  when two sessions name the same story. */
export function importSavedSessions(
    store: StoryProgressStore,
    storage: Storage | null,
    preferred: Locale,
    accountId: string | null = null
): void {
    for (const session of collectSavedSessions(storage, preferred, accountId)) {
        store.seed(session);
    }
}
