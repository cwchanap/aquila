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

/** Companion to STORY_PROGRESS_KEY: the account id the stored map last
 *  synced with. Survives sign-out so a different account signing in on a
 *  shared browser can tell the local map belongs to someone else. */
export const STORY_PROGRESS_OWNER_KEY = 'aquila:storyProgress:v1:owner';

export interface ProgressPosition {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    /** The position is the last line of a scene with no next scene. */
    atEnding: boolean;
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
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(STORY_PROGRESS_KEY);
            if (raw === null) return {};
            return normalizeStoryProgressMap(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    get(storyId: string): StoryProgress | null {
        const all = this.getAll();
        return Object.hasOwn(all, storyId) ? all[storyId] : null;
    }

    /** Serializes the map under its size budget and stores it; write
     *  failures stay nonfatal like the other writes. */
    private writeAll(map: StoryProgressMap): boolean {
        if (!this.storage) return false;
        try {
            this.storage.setItem(
                STORY_PROGRESS_KEY,
                JSON.stringify(boundStoryProgressMap(map))
            );
            return true;
        } catch {
            return false;
        }
    }

    /** The account id the stored map last synced with; null when the map
     *  has never been pushed or the tag cannot be read. */
    getOwner(): string | null {
        if (!this.storage) return null;
        try {
            return this.storage.getItem(STORY_PROGRESS_OWNER_KEY);
        } catch {
            return null;
        }
    }

    /** Tags the stored map with the account that owns it. A lost tag is
     *  harmless: the map then reads as browser-local again. */
    setOwner(userId: string): void {
        try {
            this.storage?.setItem(STORY_PROGRESS_OWNER_KEY, userId);
        } catch {
            // Nonfatal like every other write on this store.
        }
    }

    /** Replaces the stored map outright and records the owning account —
     *  the shared-browser path drops another user's local copy this way
     *  instead of merging it into a different account. */
    replaceAll(map: StoryProgressMap, userId: string): boolean {
        if (!this.writeAll(map)) return false;
        this.setOwner(userId);
        return true;
    }

    /** Read-modify-write in one synchronous operation, the same shape as
     *  record(): the merge runs against the freshest stored map, so a line
     *  read after the caller's last look is merged rather than overwritten.
     *  Returns false when storage or the read fails. Note the read and the
     *  write are still two separate storage calls — localStorage offers no
     *  cross-tab lock, so a concurrent record() in another tab can be lost
     *  between them. */
    update(merge: (current: StoryProgressMap) => StoryProgressMap): boolean {
        if (!this.storage) return false;
        const current = this.getAllChecked();
        if (!current) return false;
        return this.writeAll(merge(current));
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
        const all = this.getAll();
        const next: StoryProgressMap = {
            ...all,
            [position.storyId]: {
                sceneId: position.sceneId,
                dialogueIndex: Math.trunc(position.dialogueIndex),
                updatedAt: 0,
                finished: false,
                endings: [],
            },
        };
        return this.writeAll(next);
    }

    /** Records the reader's position. Returns false when storage is unavailable. */
    record(position: ProgressPosition): boolean {
        if (!this.storage) return false;
        const all = this.getAll();
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
        return this.writeAll(next);
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
