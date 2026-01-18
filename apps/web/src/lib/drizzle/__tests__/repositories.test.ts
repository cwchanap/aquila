import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks to ensure they're available before imports
function createChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};

    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.into = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.andWhere = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.transaction = vi.fn(async (callback: (tx: typeof chain) => unknown) =>
        callback(chain)
    );

    return chain;
}

const mockDb = vi.hoisted(() => createChain());

vi.mock('../db.js', () => ({
    db: mockDb,
}));

// Mock nanoid for consistent IDs
vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'test-id-123'),
}));

import {
    UserRepository,
    CharacterSetupRepository,
    StoryRepository,
    ChapterRepository,
    SceneRepository,
    BookmarkRepository,
} from '../repositories';

describe('Repositories', () => {
    beforeEach(() => {
        // Reset all mock functions and re-establish chain pattern
        const chainMethods = [
            'select',
            'insert',
            'update',
            'delete',
            'from',
            'into',
            'values',
            'set',
            'where',
            'andWhere',
            'innerJoin',
            'limit',
            'offset',
            'orderBy',
            'returning',
            'transaction',
        ];

        chainMethods.forEach(key => {
            mockDb[key].mockReset();
            if (key === 'transaction') {
                mockDb[key].mockImplementation(
                    async (callback: (tx: typeof mockDb) => unknown) =>
                        callback(mockDb)
                );
                return;
            }
            mockDb[key].mockReturnValue(mockDb);
        });
    });

    describe('UserRepository', () => {
        let repo: UserRepository;

        beforeEach(() => {
            repo = new UserRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when user is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'user-123' }]);

                const result = await repo.delete('user-123');

                expect(result).toBe(true);
                expect(mockDb.delete).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
            });

            it('returns false when user does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });

        describe('create()', () => {
            it('creates a user with generated id', async () => {
                const newUser = {
                    id: 'test-id-123',
                    email: 'test@example.com',
                    username: 'testuser',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                };
                mockDb.returning.mockResolvedValue([newUser]);

                const result = await repo.create({
                    email: 'test@example.com',
                    username: 'testuser',
                });

                expect(result).toEqual(newUser);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalled();
            });
        });

        describe('findById()', () => {
            it('returns user when found', async () => {
                const user = { id: 'user-123', email: 'test@example.com' };
                mockDb.limit.mockResolvedValue([user]);

                const result = await repo.findById('user-123');

                expect(result).toEqual(user);
            });

            it('returns undefined when not found', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await repo.findById('nonexistent');

                expect(result).toBeUndefined();
            });
        });

        describe('list()', () => {
            it('returns users with pagination', async () => {
                const users = [{ id: '1' }, { id: '2' }];
                mockDb.offset.mockResolvedValue(users);

                const result = await repo.list(10, 20);

                expect(result).toEqual(users);
                expect(mockDb.limit).toHaveBeenCalled();
                expect(mockDb.offset).toHaveBeenCalled();
            });
        });
    });

    describe('CharacterSetupRepository', () => {
        let repo: CharacterSetupRepository;

        beforeEach(() => {
            repo = new CharacterSetupRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when character setup is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'setup-123' }]);

                const result = await repo.delete('setup-123');

                expect(result).toBe(true);
            });

            it('returns false when character setup does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });
    });

    describe('StoryRepository', () => {
        let repo: StoryRepository;

        beforeEach(() => {
            repo = new StoryRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when story is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'story-123' }]);

                const result = await repo.delete('story-123');

                expect(result).toBe(true);
            });

            it('returns false when story does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });
    });

    describe('ChapterRepository', () => {
        let repo: ChapterRepository;

        beforeEach(() => {
            repo = new ChapterRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when chapter is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'chapter-123' }]);

                const result = await repo.delete('chapter-123');

                expect(result).toBe(true);
            });

            it('returns false when chapter does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });

        describe('reorder()', () => {
            it('updates all chapters in parallel', async () => {
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['ch-1', 'ch-2', 'ch-3']);

                // Should have called update for each chapter
                expect(mockDb.update).toHaveBeenCalledTimes(3);
                expect(mockDb.set).toHaveBeenCalledTimes(3);
            });

            it('sets correct order for each chapter', async () => {
                const setCalls: Array<{ order: string }> = [];
                mockDb.set.mockImplementation((data: { order: string }) => {
                    setCalls.push(data);
                    return mockDb;
                });
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['ch-a', 'ch-b']);

                expect(setCalls[0].order).toBe('0');
                expect(setCalls[1].order).toBe('1');
            });

            it('handles empty chapter list', async () => {
                await repo.reorder('story-1', []);

                expect(mockDb.update).not.toHaveBeenCalled();
            });
        });
    });

    describe('SceneRepository', () => {
        let repo: SceneRepository;

        beforeEach(() => {
            repo = new SceneRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when scene is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'scene-123' }]);

                const result = await repo.delete('scene-123');

                expect(result).toBe(true);
            });

            it('returns false when scene does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });

        describe('reorder()', () => {
            it('updates all scenes in parallel', async () => {
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['sc-1', 'sc-2'], 'chapter-1');

                expect(mockDb.update).toHaveBeenCalledTimes(2);
            });

            it('handles scenes without chapter (direct story scenes)', async () => {
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['sc-1', 'sc-2'], null);

                expect(mockDb.update).toHaveBeenCalledTimes(2);
            });

            it('sets correct order for each scene', async () => {
                const setCalls: Array<{ order: string }> = [];
                mockDb.set.mockImplementation((data: { order: string }) => {
                    setCalls.push(data);
                    return mockDb;
                });
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['sc-a', 'sc-b', 'sc-c']);

                expect(setCalls[0].order).toBe('0');
                expect(setCalls[1].order).toBe('1');
                expect(setCalls[2].order).toBe('2');
            });
        });
    });

    describe('BookmarkRepository', () => {
        let repo: BookmarkRepository;

        beforeEach(() => {
            repo = new BookmarkRepository(mockDb as any);
        });

        describe('delete()', () => {
            it('returns true when bookmark is deleted', async () => {
                mockDb.returning.mockResolvedValue([{ id: 'bookmark-123' }]);

                const result = await repo.delete('bookmark-123');

                expect(result).toBe(true);
            });

            it('returns false when bookmark does not exist', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.delete('nonexistent');

                expect(result).toBe(false);
            });
        });

        describe('create()', () => {
            it('creates a bookmark with generated id', async () => {
                const newBookmark = {
                    id: 'test-id-123',
                    userId: 'user-1',
                    storyId: 'story-1',
                    sceneId: 'scene-1',
                    bookmarkName: 'Save 1',
                    locale: 'en',
                };
                mockDb.returning.mockResolvedValue([newBookmark]);

                const result = await repo.create({
                    userId: 'user-1',
                    storyId: 'story-1',
                    sceneId: 'scene-1',
                    bookmarkName: 'Save 1',
                    locale: 'en',
                });

                expect(result).toEqual(newBookmark);
            });
        });

        describe('findByUser()', () => {
            it('returns bookmarks ordered by updatedAt', async () => {
                const bookmarks = [
                    { id: 'b1', bookmarkName: 'Save 1' },
                    { id: 'b2', bookmarkName: 'Save 2' },
                ];
                mockDb.orderBy.mockResolvedValue(bookmarks);

                const result = await repo.findByUser('user-1');

                expect(result).toEqual(bookmarks);
                expect(mockDb.orderBy).toHaveBeenCalled();
            });
        });
    });
});
