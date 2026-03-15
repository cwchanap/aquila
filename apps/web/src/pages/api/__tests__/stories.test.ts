import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must use vi.hoisted() for variables used in vi.mock()
const { mockGetSession } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
}));

// Mock Better Auth
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

vi.mock('@/lib/drizzle/repositories.js', () => ({
    StoryRepository: vi.fn(),
}));

import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { GET as listGET, POST as listPOST } from '../stories/index';
import {
    GET as itemGET,
    PUT as itemPUT,
    DELETE as itemDELETE,
} from '../stories/[id]';

const createMockStoryRepo = () => ({
    findByUserId: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
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

const StoryRepositoryMock = vi.mocked(StoryRepository);
let mockStoryRepo = createMockStoryRepo();

describe('Stories API', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
        StoryRepositoryMock.mockReset();
        mockStoryRepo = createMockStoryRepo();
        StoryRepositoryMock.mockReturnValue(mockStoryRepo as any);
        // Default to unauthenticated
        mockUnauthenticatedSession();
    });

    it('rejects unauthenticated list requests', async () => {
        const response = await listGET({
            request: new Request('http://localhost/api/stories'),
        } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
        expect(data.success).toBe(false);
    });

    it('returns stories for an authenticated user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findByUserId.mockResolvedValue([
            { id: 'story-1', title: 'Story One', userId: 'user-1' },
        ]);

        const response = await listGET({
            request: new Request('http://localhost/api/stories'),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual([
            { id: 'story-1', title: 'Story One', userId: 'user-1' },
        ]);
        expect(mockStoryRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('requires a title when creating a story', async () => {
        mockAuthenticatedSession('user-1');

        const response = await listPOST({
            request: new Request('http://localhost/api/stories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: '   ' }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Title is required');
    });

    it('creates a story for an authenticated user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.create.mockResolvedValue({
            id: 'story-1',
            title: 'My Story',
            userId: 'user-1',
        });

        const response = await listPOST({
            request: new Request('http://localhost/api/stories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '  My Story  ',
                    description: '  A tale  ',
                    status: 'draft',
                }),
            }),
        } as any);

        expect(response.status).toBe(201);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'story-1',
            title: 'My Story',
            userId: 'user-1',
        });
        expect(mockStoryRepo.create).toHaveBeenCalledWith({
            userId: 'user-1',
            title: 'My Story',
            description: 'A tale',
            coverImage: null,
            status: 'draft',
        });
    });

    it("returns 404 when user attempts to access another user's story", async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'someone-else',
        });

        const response = await itemGET({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1'),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Story not found');
    });

    it('returns 404 when story does not exist', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue(null);

        const response = await itemGET({
            params: { id: 'nonexistent-story' },
            request: new Request(
                'http://localhost/api/stories/nonexistent-story'
            ),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Story not found');
    });

    it('returns 400 when GET is called without a story id', async () => {
        mockAuthenticatedSession('user-1');

        const response = await itemGET({
            params: {},
            request: new Request('http://localhost/api/stories/'),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Story ID is required');
    });

    it('returns 200 with story data when found and owned by user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'My Story',
            userId: 'user-1',
        });

        const response = await itemGET({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1'),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toBe('story-1');
    });

    it('returns 500 on unexpected error in GET', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockRejectedValue(new Error('DB crash'));

        const response = await itemGET({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1'),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to fetch story');
    });

    it('updates a story owned by the user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'user-1',
        });
        mockStoryRepo.update.mockResolvedValue({
            id: 'story-1',
            title: 'Updated Story',
            userId: 'user-1',
        });

        const response = await itemPUT({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Updated Story' }),
            }),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'story-1',
            title: 'Updated Story',
            userId: 'user-1',
        });
        expect(mockStoryRepo.update).toHaveBeenCalledWith('story-1', {
            title: 'Updated Story',
        });
    });

    it('returns 400 when PUT is called without a story id', async () => {
        mockAuthenticatedSession('user-1');

        const response = await itemPUT({
            params: {},
            request: new Request('http://localhost/api/stories/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Title' }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Story ID is required');
    });

    it('returns 404 when PUT targets a story owned by another user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'someone-else',
        });

        const response = await itemPUT({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Title' }),
            }),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Story not found');
    });

    it('returns 422 when PUT provides no valid fields to update', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'user-1',
        });

        const response = await itemPUT({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        } as any);

        expect(response.status).toBe(422);
        const data = await response.json();
        expect(data.error).toBe('No valid fields to update');
    });

    it('returns 500 on unexpected error in PUT', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockRejectedValue(new Error('DB crash'));

        const response = await itemPUT({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Title' }),
            }),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to update story');
    });

    it('deletes a story owned by the user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'user-1',
        });
        mockStoryRepo.delete.mockResolvedValue(true);

        const response = await itemDELETE({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'DELETE',
            }),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(mockStoryRepo.delete).toHaveBeenCalledWith('story-1');
    });

    it('returns 400 when DELETE is called without a story id', async () => {
        mockAuthenticatedSession('user-1');

        const response = await itemDELETE({
            params: {},
            request: new Request('http://localhost/api/stories/', {
                method: 'DELETE',
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Story ID is required');
    });

    it('returns 404 when DELETE targets a story owned by another user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'someone-else',
        });

        const response = await itemDELETE({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'DELETE',
            }),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Story not found');
    });

    it('returns 500 on unexpected error in DELETE', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockRejectedValue(new Error('DB crash'));

        const response = await itemDELETE({
            params: { id: 'story-1' },
            request: new Request('http://localhost/api/stories/story-1', {
                method: 'DELETE',
            }),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to delete story');
    });

    it('returns 500 on unexpected error in list GET', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findByUserId.mockRejectedValue(new Error('DB crash'));

        const response = await listGET({
            request: new Request('http://localhost/api/stories'),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to fetch stories');
    });

    it('returns 500 on unexpected error in list POST', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.create.mockRejectedValue(new Error('DB crash'));

        const response = await listPOST({
            request: new Request('http://localhost/api/stories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'My Story' }),
            }),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to create story');
    });
});
