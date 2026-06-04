import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalBookmarksStore } from '../local-bookmarks-store';

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'test-nanoid-id'),
}));

describe('LocalBookmarksStore', () => {
    let store: LocalBookmarksStore;
    let localStorageMock: Storage;

    beforeEach(() => {
        localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn(),
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true,
        });
        store = new LocalBookmarksStore('en');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getAll', () => {
        it('returns empty array when localStorage has no data', () => {
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(null);
            expect(store.getAll()).toEqual([]);
        });

        it('returns parsed bookmarks from localStorage', () => {
            const bookmarks = [
                {
                    id: '1',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Test',
                    locale: 'en',
                    createdAt: 1000,
                    updatedAt: 1000,
                },
            ];
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify(bookmarks));
            expect(store.getAll()).toEqual(bookmarks);
        });

        it('returns empty array when localStorage has invalid JSON', () => {
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue('{bad json');
            expect(store.getAll()).toEqual([]);
        });

        it('returns empty array when parsed value is not an array', () => {
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify({ not: 'array' }));
            expect(store.getAll()).toEqual([]);
        });
    });

    describe('create', () => {
        it('creates a bookmark with correct fields', () => {
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue('[]');

            const bookmark = store.create({
                storyId: 'train_adventure',
                sceneId: 'act1',
                bookmarkName: 'My Bookmark',
            });

            expect(bookmark.id).toBe('test-nanoid-id');
            expect(bookmark.storyId).toBe('train_adventure');
            expect(bookmark.sceneId).toBe('act1');
            expect(bookmark.bookmarkName).toBe('My Bookmark');
            expect(bookmark.locale).toBe('en');
            expect(bookmark.createdAt).toBe(bookmark.updatedAt);
        });

        it('prepends new bookmark to existing list', () => {
            const existing = [
                {
                    id: 'old',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Old',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ];
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify(existing));

            const bookmark = store.create({
                storyId: 's2',
                sceneId: 'sc2',
                bookmarkName: 'New',
            });

            const setItemCall = (
                localStorageMock.setItem as ReturnType<typeof vi.fn>
            ).mock.calls[0];
            const saved = JSON.parse(setItemCall[1]);
            expect(saved[0].id).toBe(bookmark.id);
            expect(saved.length).toBe(2);
        });
    });

    describe('remove', () => {
        it('removes a bookmark by id', () => {
            const bookmarks = [
                {
                    id: 'keep',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Keep',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'remove',
                    storyId: 's2',
                    sceneId: 'sc2',
                    bookmarkName: 'Remove',
                    locale: 'en',
                    createdAt: 2,
                    updatedAt: 2,
                },
            ];
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify(bookmarks));

            store.remove('remove');

            const setItemCall = (
                localStorageMock.setItem as ReturnType<typeof vi.fn>
            ).mock.calls[0];
            const saved = JSON.parse(setItemCall[1]);
            expect(saved.length).toBe(1);
            expect(saved[0].id).toBe('keep');
        });
    });

    describe('clear', () => {
        it('removes the storage key from localStorage', () => {
            store.clear();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(
                'aquila:bookmarks:en'
            );
        });

        it('uses correct key for zh locale', () => {
            const zhStore = new LocalBookmarksStore('zh');
            zhStore.clear();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(
                'aquila:bookmarks:zh'
            );
        });
    });

    describe('persist error handling', () => {
        it('swallows setItem errors gracefully', () => {
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue('[]');
            (
                localStorageMock.setItem as ReturnType<typeof vi.fn>
            ).mockImplementation(() => {
                throw new Error('Quota exceeded');
            });

            expect(() =>
                store.create({
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Test',
                })
            ).not.toThrow();
        });
    });

    describe('getAll validation', () => {
        it('filters out items missing required fields', () => {
            const bookmarks = [
                {
                    id: 'valid',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Good',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                { id: 'invalid', storyId: 's1' },
                null,
                'string',
            ];
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify(bookmarks));
            expect(store.getAll()).toEqual([bookmarks[0]]);
        });

        it('filters out items with wrong types', () => {
            const bookmarks = [
                {
                    id: 'valid',
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Good',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 123,
                    storyId: 's1',
                    sceneId: 'sc1',
                    bookmarkName: 'Bad',
                    locale: 'en',
                    createdAt: 1,
                    updatedAt: 1,
                },
            ];
            (
                localStorageMock.getItem as ReturnType<typeof vi.fn>
            ).mockReturnValue(JSON.stringify(bookmarks));
            expect(store.getAll()).toEqual([bookmarks[0]]);
        });
    });
});
