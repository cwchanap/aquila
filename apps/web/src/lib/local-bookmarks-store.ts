import { nanoid } from 'nanoid';
import type { Locale } from '@aquila/stories';

export interface LocalBookmark {
    id: string;
    storyId: string;
    sceneId: string;
    bookmarkName: string;
    locale: string;
    createdAt: number;
    updatedAt: number;
}

export class LocalBookmarksStore {
    private static readonly KEY_PREFIX = 'aquila:bookmarks';

    private readonly storageKey: string;

    constructor(private readonly locale: Locale) {
        this.storageKey = `${LocalBookmarksStore.KEY_PREFIX}:${locale}`;
    }

    getAll(): LocalBookmark[] {
        if (typeof window === 'undefined') return [];
        let parsed: unknown;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            parsed = JSON.parse(raw);
        } catch {
            return [];
        }
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(this.isValidBookmark);
    }

    private isValidBookmark(item: unknown): item is LocalBookmark {
        if (typeof item !== 'object' || item === null) return false;
        const b = item as Record<string, unknown>;
        return (
            typeof b.id === 'string' &&
            typeof b.storyId === 'string' &&
            typeof b.sceneId === 'string' &&
            typeof b.bookmarkName === 'string' &&
            typeof b.locale === 'string' &&
            (typeof b.createdAt === 'number' ||
                typeof b.createdAt === 'string') &&
            (typeof b.updatedAt === 'number' || typeof b.updatedAt === 'string')
        );
    }

    create(data: {
        storyId: string;
        sceneId: string;
        bookmarkName: string;
    }): LocalBookmark | null {
        const now = Date.now();
        const bookmark: LocalBookmark = {
            id: nanoid(),
            storyId: data.storyId,
            sceneId: data.sceneId,
            bookmarkName: data.bookmarkName,
            locale: this.locale,
            createdAt: now,
            updatedAt: now,
        };
        const bookmarks = this.getAll();
        bookmarks.unshift(bookmark);
        if (!this.persist(bookmarks)) return null;
        return bookmark;
    }

    remove(id: string): void {
        const bookmarks = this.getAll().filter(b => b.id !== id);
        this.persist(bookmarks);
    }

    clear(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(this.storageKey);
        } catch {
            // ignore
        }
    }

    private persist(bookmarks: LocalBookmark[]): boolean {
        if (typeof window === 'undefined') return false;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(bookmarks));
            return true;
        } catch {
            return false;
        }
    }
}
