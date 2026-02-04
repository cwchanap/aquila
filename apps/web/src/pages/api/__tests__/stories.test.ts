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
        expect(data.success).toBe(true);
        expect(data.data).toEqual([
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
        expect(data.success).toBe(true);
        expect(data.data).toEqual({
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
        expect(data.success).toBe(true);
        expect(data.data).toEqual({
            id: 'story-1',
            title: 'Updated Story',
            userId: 'user-1',
        });
        expect(mockStoryRepo.update).toHaveBeenCalledWith('story-1', {
            title: 'Updated Story',
        });
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
});
