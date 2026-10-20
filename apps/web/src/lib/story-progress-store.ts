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

export const STORY_PROGRESS_KEY = 'aquila:storyProgress:v1';

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
}

export type StoryProgressMap = Record<string, StoryProgress>;

export interface ProgressPosition {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    /** The position is the last line of a scene with no next scene. */
    atEnding: boolean;
}

function isProgress(value: unknown): value is StoryProgress {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.sceneId === 'string' &&
        typeof v.dialogueIndex === 'number' &&
        Number.isFinite(v.dialogueIndex) &&
        v.dialogueIndex >= 0 &&
        typeof v.updatedAt === 'number' &&
        typeof v.finished === 'boolean' &&
        Array.isArray(v.endings) &&
        v.endings.every(e => typeof e === 'string')
    );
}

export class StoryProgressStore {
    constructor(
        private readonly storage: Storage | null,
        private readonly now: () => number = Date.now
    ) {}

    /** All valid records; malformed entries are dropped, never thrown on. */
    getAll(): StoryProgressMap {
        try {
            const raw = this.storage?.getItem(STORY_PROGRESS_KEY);
            if (!raw) return {};
            const parsed: unknown = JSON.parse(raw);
            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                return {};
            }
            const out: StoryProgressMap = {};
            for (const [id, value] of Object.entries(parsed)) {
                if (isProgress(value)) out[id] = value;
            }
            return out;
        } catch {
            return {};
        }
    }

    get(storyId: string): StoryProgress | null {
        const all = this.getAll();
        return Object.hasOwn(all, storyId) ? all[storyId] : null;
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
        all[position.storyId] = {
            sceneId: position.sceneId,
            dialogueIndex: Math.trunc(position.dialogueIndex),
            updatedAt: 0,
            finished: false,
            endings: [],
        };
        try {
            this.storage.setItem(STORY_PROGRESS_KEY, JSON.stringify(all));
            return true;
        } catch {
            return false;
        }
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
        all[position.storyId] = {
            sceneId: position.sceneId,
            dialogueIndex: Number.isFinite(position.dialogueIndex)
                ? Math.max(0, Math.trunc(position.dialogueIndex))
                : 0,
            updatedAt: this.now(),
            finished: position.atEnding,
            endings,
        };
        try {
            this.storage.setItem(STORY_PROGRESS_KEY, JSON.stringify(all));
            return true;
        } catch {
            return false;
        }
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
