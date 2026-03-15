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
    chain.onConflictDoUpdate = vi.fn(() => chain);
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
    AccountRepository,
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
            'onConflictDoUpdate',
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
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
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

        describe('findByEmail()', () => {
            it('returns user when email matches', async () => {
                const user = { id: 'user-1', email: 'test@example.com' };
                mockDb.limit.mockResolvedValue([user]);

                const result = await repo.findByEmail('test@example.com');

                expect(result).toEqual(user);
                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.limit).toHaveBeenCalled();
            });

            it('returns undefined when email is not found', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await repo.findByEmail('missing@example.com');

                expect(result).toBeUndefined();
            });
        });

        describe('findByUsername()', () => {
            it('returns user when username matches', async () => {
                const user = { id: 'user-1', username: 'alice' };
                mockDb.limit.mockResolvedValue([user]);

                const result = await repo.findByUsername('alice');

                expect(result).toEqual(user);
                expect(mockDb.where).toHaveBeenCalled();
            });

            it('returns undefined when username is not found', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await repo.findByUsername('nobody');

                expect(result).toBeUndefined();
            });
        });

        describe('update()', () => {
            it('returns updated user', async () => {
                const updated = { id: 'user-1', email: 'new@example.com' };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('user-1', {
                    email: 'new@example.com',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
            });

            it('returns undefined when user not found', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.update('nonexistent', {
                    name: 'Ghost',
                });

                expect(result).toBeUndefined();
            });

            it('includes updatedAt in the set data', async () => {
                const setCalls: Array<Record<string, unknown>> = [];
                mockDb.set.mockImplementation(
                    (data: Record<string, unknown>) => {
                        setCalls.push(data);
                        return mockDb;
                    }
                );
                mockDb.returning.mockResolvedValue([{ id: 'user-1' }]);

                await repo.update('user-1', { name: 'Alice' });

                expect(setCalls[0]).toHaveProperty('updatedAt');
                expect(setCalls[0].updatedAt).toBeInstanceOf(Date);
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

        describe('create()', () => {
            it('creates a character setup with generated id', async () => {
                const newSetup = {
                    id: 'test-id-123',
                    userId: 'user-1',
                    storyId: 'story-1',
                    characterName: 'Alice',
                };
                mockDb.returning.mockResolvedValue([newSetup]);

                const result = await repo.create({
                    userId: 'user-1',
                    storyId: 'story-1',
                    characterName: 'Alice',
                });

                expect(result).toEqual(newSetup);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
            });
        });

        describe('findByUserAndStory()', () => {
            it('returns setup when found', async () => {
                const setup = {
                    id: 'setup-1',
                    userId: 'user-1',
                    storyId: 'story-1',
                };
                mockDb.limit.mockResolvedValue([setup]);

                const result = await repo.findByUserAndStory(
                    'user-1',
                    'story-1'
                );

                expect(result).toEqual(setup);
                expect(mockDb.where).toHaveBeenCalled();
            });

            it('returns undefined when not found', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await repo.findByUserAndStory(
                    'user-x',
                    'story-x'
                );

                expect(result).toBeUndefined();
            });
        });

        describe('findByUser()', () => {
            it('returns all setups for a user', async () => {
                const setups = [
                    { id: 'setup-1', userId: 'user-1' },
                    { id: 'setup-2', userId: 'user-1' },
                ];
                mockDb.orderBy.mockResolvedValue(setups);

                const result = await repo.findByUser('user-1');

                expect(result).toEqual(setups);
                expect(mockDb.orderBy).toHaveBeenCalled();
            });
        });

        describe('update()', () => {
            it('returns updated character setup and includes updatedAt', async () => {
                const updated = {
                    id: 'setup-1',
                    characterName: 'Bob',
                };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('setup-1', {
                    characterName: 'Bob',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
                const setArg = mockDb.set.mock.calls[0][0];
                expect(setArg).toHaveProperty('updatedAt');
                expect(setArg.updatedAt).toBeInstanceOf(Date);
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

        describe('create()', () => {
            it('creates a story with generated id', async () => {
                const newStory = {
                    id: 'test-id-123',
                    userId: 'user-1',
                    title: 'My Story',
                    status: 'draft',
                };
                mockDb.returning.mockResolvedValue([newStory]);

                const result = await repo.create({
                    userId: 'user-1',
                    title: 'My Story',
                    status: 'draft',
                });

                expect(result).toEqual(newStory);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
            });
        });

        describe('findByUserId()', () => {
            it('returns stories for a user ordered by updatedAt desc', async () => {
                const stories = [
                    { id: 'story-2', userId: 'user-1' },
                    { id: 'story-1', userId: 'user-1' },
                ];
                mockDb.orderBy.mockResolvedValue(stories);

                const result = await repo.findByUserId('user-1');

                expect(result).toEqual(stories);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });

            it('returns empty array when user has no stories', async () => {
                mockDb.orderBy.mockResolvedValue([]);

                const result = await repo.findByUserId('user-no-stories');

                expect(result).toEqual([]);
            });
        });

        describe('update()', () => {
            it('returns updated story and includes updatedAt', async () => {
                const updated = {
                    id: 'story-1',
                    title: 'Renamed Story',
                    status: 'published',
                };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('story-1', {
                    title: 'Renamed Story',
                    status: 'published',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
                const setArg = mockDb.set.mock.calls[0][0];
                expect(setArg).toHaveProperty('updatedAt');
                expect(setArg.updatedAt).toBeInstanceOf(Date);
            });

            it('returns undefined when story not found', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.update('nonexistent', {
                    title: 'Ghost',
                });

                expect(result).toBeUndefined();
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
                const setCalls: Array<{ order: number }> = [];
                mockDb.set.mockImplementation((data: { order: number }) => {
                    setCalls.push(data);
                    return mockDb;
                });
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['ch-a', 'ch-b']);

                expect(setCalls[0].order).toBe(0);
                expect(setCalls[1].order).toBe(1);
            });

            it('handles empty chapter list', async () => {
                await repo.reorder('story-1', []);

                expect(mockDb.update).not.toHaveBeenCalled();
            });
        });

        describe('create()', () => {
            it('creates a chapter with generated id', async () => {
                const newChapter = {
                    id: 'test-id-123',
                    storyId: 'story-1',
                    title: 'Chapter One',
                    order: 0,
                };
                mockDb.returning.mockResolvedValue([newChapter]);

                const result = await repo.create({
                    storyId: 'story-1',
                    title: 'Chapter One',
                    order: 0,
                });

                expect(result).toEqual(newChapter);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
            });
        });

        describe('findByStoryId()', () => {
            it('returns chapters ordered by asc order', async () => {
                const chapters = [
                    { id: 'ch-1', storyId: 'story-1', order: 0 },
                    { id: 'ch-2', storyId: 'story-1', order: 1 },
                ];
                mockDb.orderBy.mockResolvedValue(chapters);

                const result = await repo.findByStoryId('story-1');

                expect(result).toEqual(chapters);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });

            it('returns empty array when story has no chapters', async () => {
                mockDb.orderBy.mockResolvedValue([]);

                const result = await repo.findByStoryId('empty-story');

                expect(result).toEqual([]);
            });
        });

        describe('update()', () => {
            it('returns updated chapter and includes updatedAt', async () => {
                const updated = {
                    id: 'ch-1',
                    title: 'Renamed Chapter',
                };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('ch-1', {
                    title: 'Renamed Chapter',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
                const setArg = mockDb.set.mock.calls[0][0];
                expect(setArg).toHaveProperty('updatedAt');
                expect(setArg.updatedAt).toBeInstanceOf(Date);
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
                const setCalls: Array<{ order: number }> = [];
                mockDb.set.mockImplementation((data: { order: number }) => {
                    setCalls.push(data);
                    return mockDb;
                });
                mockDb.where.mockResolvedValue(undefined);

                await repo.reorder('story-1', ['sc-a', 'sc-b', 'sc-c']);

                expect(setCalls[0].order).toBe(0);
                expect(setCalls[1].order).toBe(1);
                expect(setCalls[2].order).toBe(2);
            });
        });

        describe('create()', () => {
            it('creates a scene with generated id', async () => {
                const newScene = {
                    id: 'test-id-123',
                    storyId: 'story-1',
                    title: 'Scene One',
                    order: 0,
                };
                mockDb.returning.mockResolvedValue([newScene]);

                const result = await repo.create({
                    storyId: 'story-1',
                    title: 'Scene One',
                    order: 0,
                });

                expect(result).toEqual(newScene);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
            });
        });

        describe('findByStoryId()', () => {
            it('returns scenes ordered by asc order', async () => {
                const scenes = [
                    { id: 'sc-1', storyId: 'story-1', order: 0 },
                    { id: 'sc-2', storyId: 'story-1', order: 1 },
                ];
                mockDb.orderBy.mockResolvedValue(scenes);

                const result = await repo.findByStoryId('story-1');

                expect(result).toEqual(scenes);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });
        });

        describe('findByChapterId()', () => {
            it('returns scenes for a chapter', async () => {
                const scenes = [
                    { id: 'sc-1', chapterId: 'ch-1', order: 0 },
                    { id: 'sc-2', chapterId: 'ch-1', order: 1 },
                ];
                mockDb.orderBy.mockResolvedValue(scenes);

                const result = await repo.findByChapterId('ch-1');

                expect(result).toEqual(scenes);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });

            it('returns empty array when chapter has no scenes', async () => {
                mockDb.orderBy.mockResolvedValue([]);

                const result = await repo.findByChapterId('empty-ch');

                expect(result).toEqual([]);
            });
        });

        describe('findDirectScenes()', () => {
            it('returns scenes with no chapter (direct story scenes)', async () => {
                const scenes = [
                    { id: 'sc-1', storyId: 'story-1', chapterId: null },
                ];
                mockDb.orderBy.mockResolvedValue(scenes);

                const result = await repo.findDirectScenes('story-1');

                expect(result).toEqual(scenes);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });

            it('passes an IS NULL predicate for chapterId to where', async () => {
                mockDb.orderBy.mockResolvedValue([]);

                await repo.findDirectScenes('story-1');

                // The expression passed to where() is a real drizzle SQL expression
                // (eq + isNull wrapped in and()). We traverse queryChunks recursively
                // to confirm the IS NULL leaf is present.
                const whereArg = mockDb.where.mock.calls[0][0];
                expect(whereArg).toBeDefined();

                function containsIsNull(node: unknown): boolean {
                    if (!node || typeof node !== 'object') return false;
                    const obj = node as Record<string, unknown>;
                    if (obj.value !== undefined) {
                        // drizzle SQL value chunks are string arrays
                        const v = Array.isArray(obj.value)
                            ? obj.value.join('').toLowerCase()
                            : String(obj.value).toLowerCase();
                        if (v.includes('is null')) return true;
                    }
                    if (Array.isArray(obj.queryChunks)) {
                        return obj.queryChunks.some(containsIsNull);
                    }
                    return false;
                }

                expect(containsIsNull(whereArg)).toBe(true);
            });
        });

        describe('update()', () => {
            it('returns updated scene and includes updatedAt', async () => {
                const updated = { id: 'sc-1', title: 'Renamed Scene' };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('sc-1', {
                    title: 'Renamed Scene',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
                const setArg = mockDb.set.mock.calls[0][0];
                expect(setArg).toHaveProperty('updatedAt');
                expect(setArg.updatedAt).toBeInstanceOf(Date);
            });

            it('returns undefined when scene not found', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.update('nonexistent', {
                    title: 'Ghost',
                });

                expect(result).toBeUndefined();
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
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({ id: expect.any(String) })
                );
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

        describe('findByUserAndStory()', () => {
            it('returns bookmarks for a user and story', async () => {
                const bookmarks = [
                    { id: 'bm-1', userId: 'user-1', storyId: 'story-1' },
                    { id: 'bm-2', userId: 'user-1', storyId: 'story-1' },
                ];
                mockDb.orderBy.mockResolvedValue(bookmarks);

                const result = await repo.findByUserAndStory(
                    'user-1',
                    'story-1'
                );

                expect(result).toEqual(bookmarks);
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
            });

            it('returns empty array when no bookmarks match', async () => {
                mockDb.orderBy.mockResolvedValue([]);

                const result = await repo.findByUserAndStory(
                    'user-x',
                    'story-x'
                );

                expect(result).toEqual([]);
            });
        });

        describe('update()', () => {
            it('returns updated bookmark and includes updatedAt', async () => {
                const updated = { id: 'bm-1', bookmarkName: 'New Save' };
                mockDb.returning.mockResolvedValue([updated]);

                const result = await repo.update('bm-1', {
                    bookmarkName: 'New Save',
                });

                expect(result).toEqual(updated);
                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
                const setArg = mockDb.set.mock.calls[0][0];
                expect(setArg).toHaveProperty('updatedAt');
                expect(setArg.updatedAt).toBeInstanceOf(Date);
            });

            it('returns undefined when bookmark not found', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await repo.update('nonexistent', {
                    bookmarkName: 'Ghost',
                });

                expect(result).toBeUndefined();
            });
        });

        describe('upsertByScene()', () => {
            it('inserts a new bookmark when none exists', async () => {
                const bookmark = {
                    id: 'test-id-123',
                    userId: 'user-1',
                    storyId: 'story-1',
                    sceneId: 'scene-1',
                    bookmarkName: 'Auto Save',
                    locale: 'en',
                };
                mockDb.returning.mockResolvedValue([bookmark]);

                const result = await repo.upsertByScene(
                    'user-1',
                    'story-1',
                    'scene-1',
                    'Auto Save',
                    'en'
                );

                expect(result).toEqual(bookmark);
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.returning).toHaveBeenCalled();
            });

            it('uses default locale "en" when not provided', async () => {
                const valuesCalls: Array<Record<string, unknown>> = [];
                mockDb.values.mockImplementation(
                    (data: Record<string, unknown>) => {
                        valuesCalls.push(data);
                        return mockDb;
                    }
                );
                mockDb.returning.mockResolvedValue([{ id: 'bm-1' }]);

                await repo.upsertByScene(
                    'user-1',
                    'story-1',
                    'scene-1',
                    'Save'
                );

                expect(valuesCalls[0]).toHaveProperty('locale', 'en');
            });

            it('calls onConflictDoUpdate with correct target and set payload', async () => {
                const conflictCalls: Array<Record<string, unknown>> = [];
                mockDb.onConflictDoUpdate.mockImplementation(
                    (opts: Record<string, unknown>) => {
                        conflictCalls.push(opts);
                        return mockDb;
                    }
                );
                mockDb.returning.mockResolvedValue([{ id: 'bm-1' }]);

                await repo.upsertByScene(
                    'user-1',
                    'story-1',
                    'scene-1',
                    'Auto Save',
                    'zh'
                );

                expect(conflictCalls).toHaveLength(1);
                // target must include the three conflict-resolution columns
                const { target, set } = conflictCalls[0] as {
                    target: unknown[];
                    set: Record<string, unknown>;
                };
                expect(Array.isArray(target)).toBe(true);
                expect(target).toHaveLength(3);
                // set payload must include sceneId, locale, and updatedAt
                expect(set).toHaveProperty('sceneId', 'scene-1');
                expect(set).toHaveProperty('locale', 'zh');
                expect(set).toHaveProperty('updatedAt');
                expect(set.updatedAt).toBeInstanceOf(Date);
            });
        });
    });

    describe('AccountRepository', () => {
        let repo: AccountRepository;

        beforeEach(() => {
            repo = new AccountRepository(mockDb as any);
        });

        describe('findCredentialAccount()', () => {
            it('returns credential account when found', async () => {
                const account = {
                    id: 'acct-1',
                    userId: 'user-1',
                    providerId: 'credential',
                };
                mockDb.limit.mockResolvedValue([account]);

                const result = await repo.findCredentialAccount('user-1');

                expect(result).toEqual(account);
                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
            });

            it('returns null when no credential account exists', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await repo.findCredentialAccount('user-1');

                expect(result).toBeNull();
            });
        });

        describe('updatePassword()', () => {
            it('updates the password for the account', async () => {
                mockDb.where.mockResolvedValue(undefined);

                await repo.updatePassword('user-1', 'hashed-password');

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
            });

            it('includes updatedAt in the set data', async () => {
                const setCalls: Array<Record<string, unknown>> = [];
                mockDb.set.mockImplementation(
                    (data: Record<string, unknown>) => {
                        setCalls.push(data);
                        return mockDb;
                    }
                );
                mockDb.where.mockResolvedValue(undefined);

                await repo.updatePassword('user-1', 'new-hash');

                expect(setCalls[0]).toHaveProperty('password', 'new-hash');
                expect(setCalls[0]).toHaveProperty('updatedAt');
                expect(setCalls[0].updatedAt).toBeInstanceOf(Date);
            });
        });
    });
});
