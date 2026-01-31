import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeRequest } from '@/lib/test-setup';

vi.mock('@/lib/auth', () => ({
    auth: {
        api: {
            getSession: vi.fn(),
            listSessions: vi.fn(),
            revokeSession: vi.fn(),
            revokeSessions: vi.fn(),
            signOut: vi.fn(),
        },
    },
}));

vi.mock('@/lib/drizzle/repositories', () => ({
    BookmarkRepository: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { GET, POST } from '../bookmarks/index';
import { DELETE } from '../bookmarks/[id]';

const createMockRepo = () => ({
    findByUser: vi.fn(),
    upsertByScene: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
});

const getSession = auth.api.getSession as any;
const BookmarkRepositoryMock = BookmarkRepository as any;
let mockRepo = createMockRepo();

describe('Bookmarks API', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        getSession.mockReset();
        BookmarkRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        BookmarkRepositoryMock.mockReturnValue(mockRepo as any);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('GET /api/bookmarks', () => {
        it('rejects unauthenticated requests', async () => {
            getSession.mockResolvedValue(null);

            const response = await GET({ request: makeRequest() } as any);

            expect(response.status).toBe(401);
            await expect(response.json()).resolves.toEqual({
                error: 'Unauthorized',
            });
        });

        it('returns bookmarks for the current user', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findByUser.mockResolvedValue([
                { id: 'bookmark-1', storyId: 'story-1' },
            ]);

            const response = await GET({ request: makeRequest() } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                bookmarks: [{ id: 'bookmark-1', storyId: 'story-1' }],
            });
            expect(mockRepo.findByUser).toHaveBeenCalledWith('user-1');
        });
    });

    describe('POST /api/bookmarks', () => {
        it('rejects unauthenticated requests', async () => {
            getSession.mockResolvedValue(null);

            const response = await POST({ request: makeRequest() } as any);

            expect(response.status).toBe(401);
            await expect(response.json()).resolves.toEqual({
                error: 'Unauthorized',
            });
        });

        it('validates required fields', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });

            const response = await POST({
                request: makeRequest(undefined, () =>
                    Promise.resolve({ storyId: 'story-1' })
                ),
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Missing required fields: storyId, sceneId, bookmarkName',
            });
        });

        it('creates a bookmark with default locale', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.upsertByScene.mockResolvedValue({
                id: 'bookmark-1',
                storyId: 'story-1',
            });

            const response = await POST({
                request: makeRequest(undefined, () =>
                    Promise.resolve({
                        storyId: 'story-1',
                        sceneId: 'scene-1',
                        bookmarkName: 'Checkpoint',
                    })
                ),
            } as any);

            expect(response.status).toBe(201);
            await expect(response.json()).resolves.toEqual({
                bookmark: { id: 'bookmark-1', storyId: 'story-1' },
            });
            expect(mockRepo.upsertByScene).toHaveBeenCalledWith(
                'user-1',
                'story-1',
                'scene-1',
                'Checkpoint',
                'en'
            );
        });
    });

    describe('DELETE /api/bookmarks/:id', () => {
        it('rejects unauthenticated requests', async () => {
            getSession.mockResolvedValue(null);

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(401);
            await expect(response.json()).resolves.toEqual({
                error: 'Unauthorized',
            });
        });

        it('validates bookmark id', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });

            const response = await DELETE({
                params: {},
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Bookmark ID is required',
            });
        });

        it('returns not found when bookmark is missing', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findById.mockResolvedValue(null);

            const response = await DELETE({
                params: { id: 'missing' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'Bookmark not found',
            });
        });

        it('returns forbidden when bookmark is owned by another user', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-2',
            });

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(403);
            await expect(response.json()).resolves.toEqual({
                error: 'Forbidden',
            });
        });

        it('returns not found when delete does not remove a record', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-1',
            });
            mockRepo.delete.mockResolvedValue(false);

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'Bookmark not found',
            });
        });

        it('deletes a bookmark', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-1',
            });
            mockRepo.delete.mockResolvedValue(true);

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(mockRepo.delete).toHaveBeenCalledWith('bookmark-1');
        });

        it('returns 500 on internal errors', async () => {
            getSession.mockResolvedValue({ user: { id: 'user-1' } });
            mockRepo.findById.mockRejectedValue(new Error('boom'));

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: makeRequest(),
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Failed to delete bookmark',
            });
        });
    });
});
