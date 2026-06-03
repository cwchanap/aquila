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
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    create(data: {
        storyId: string;
        sceneId: string;
        bookmarkName: string;
    }): LocalBookmark {
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
        this.persist(bookmarks);
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

    private persist(bookmarks: LocalBookmark[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(bookmarks));
        } catch (e) {
            console.error('Failed to persist local bookmarks:', e);
        }
    }
}
