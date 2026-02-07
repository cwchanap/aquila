import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must use vi.hoisted() for variables used in vi.mock()
const { mockGetSession } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
}));

vi.mock('@/lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

vi.mock('../../../lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

vi.mock('@/lib/drizzle/repositories', () => ({
    BookmarkRepository: vi.fn(),
}));

import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { GET, POST } from '../bookmarks/index';
import { DELETE } from '../bookmarks/[id]';

const createMockRepo = () => ({
    findByUser: vi.fn(),
    upsertByScene: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
});

const mockAuthenticatedSession = (userId: string = 'user-1') => {
    mockGetSession.mockResolvedValue({
        user: { id: userId, email: 'test@example.com' },
    });
};

const mockUnauthenticatedSession = () => {
    mockGetSession.mockResolvedValue(null);
};

const BookmarkRepositoryMock = BookmarkRepository as any;
let mockRepo = createMockRepo();

describe('Bookmarks API', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetSession.mockReset();
        BookmarkRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        BookmarkRepositoryMock.mockReturnValue(mockRepo as any);
        mockUnauthenticatedSession();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('GET /api/bookmarks', () => {
        it('rejects unauthenticated requests', async () => {
            const response = await GET({
                request: new Request('http://localhost/api/bookmarks'),
            } as any);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
            expect(data.success).toBe(false);
        });

        it('returns bookmarks for the current user', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findByUser.mockResolvedValue([
                { id: 'bookmark-1', storyId: 'story-1' },
            ]);

            const response = await GET({
                request: new Request('http://localhost/api/bookmarks'),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            // jsonResponse returns raw data for backward compatibility
            expect(data).toEqual([{ id: 'bookmark-1', storyId: 'story-1' }]);
            expect(mockRepo.findByUser).toHaveBeenCalledWith('user-1');
        });
    });

    describe('POST /api/bookmarks', () => {
        it('rejects unauthenticated requests', async () => {
            const response = await POST({
                request: new Request('http://localhost/api/bookmarks', {
                    method: 'POST',
                    body: JSON.stringify({}),
                }),
            } as any);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('validates required fields', async () => {
            mockAuthenticatedSession('user-1');

            const response = await POST({
                request: new Request('http://localhost/api/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storyId: 'story-1' }),
                }),
            } as any);

            expect(response.status).toBe(400);
            const data = await response.json();
            // Zod validation error for missing required string field
            expect(data.success).toBe(false);
            expect(data.error).toBeTruthy(); // Any validation error
        });

        it('creates a bookmark with default locale', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.upsertByScene.mockResolvedValue({
                id: 'bookmark-1',
                storyId: 'story-1',
            });

            const response = await POST({
                request: new Request('http://localhost/api/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        storyId: 'story-1',
                        sceneId: 'scene-1',
                        bookmarkName: 'Checkpoint',
                    }),
                }),
            } as any);

            expect(response.status).toBe(201);
            const data = await response.json();
            // jsonResponse returns raw data for backward compatibility
            expect(data).toEqual({ id: 'bookmark-1', storyId: 'story-1' });
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
            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: new Request(
                    'http://localhost/api/bookmarks/bookmark-1',
                    {
                        method: 'DELETE',
                    }
                ),
            } as any);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('validates bookmark id', async () => {
            mockAuthenticatedSession('user-1');

            const response = await DELETE({
                params: {},
                request: new Request('http://localhost/api/bookmarks/', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Bookmark ID is required');
        });

        it('returns not found when bookmark is missing', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findById.mockResolvedValue(null);

            const response = await DELETE({
                params: { id: 'missing' },
                request: new Request('http://localhost/api/bookmarks/missing', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Bookmark not found');
        });

        it('returns forbidden when bookmark is owned by another user', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-2',
            });

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: new Request(
                    'http://localhost/api/bookmarks/bookmark-1',
                    {
                        method: 'DELETE',
                    }
                ),
            } as any);

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Forbidden');
        });

        it('returns not found when delete does not remove a record', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-1',
            });
            mockRepo.delete.mockResolvedValue(false);

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: new Request(
                    'http://localhost/api/bookmarks/bookmark-1',
                    {
                        method: 'DELETE',
                    }
                ),
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Bookmark not found');
        });

        it('deletes a bookmark', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findById.mockResolvedValue({
                id: 'bookmark-1',
                userId: 'user-1',
            });
            mockRepo.delete.mockResolvedValue(true);

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: new Request(
                    'http://localhost/api/bookmarks/bookmark-1',
                    {
                        method: 'DELETE',
                    }
                ),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            // jsonResponse returns raw data for backward compatibility
            expect(data).toEqual({ deleted: true });
            expect(mockRepo.delete).toHaveBeenCalledWith('bookmark-1');
        });

        it('returns 500 on internal errors', async () => {
            mockAuthenticatedSession('user-1');
            mockRepo.findById.mockRejectedValue(new Error('boom'));

            const response = await DELETE({
                params: { id: 'bookmark-1' },
                request: new Request(
                    'http://localhost/api/bookmarks/bookmark-1',
                    {
                        method: 'DELETE',
                    }
                ),
            } as any);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Failed to delete bookmark');
        });
    });
});
