import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

const mockStoryRepo = vi.hoisted(() => ({
    findByUserId: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));

const StoryRepository = vi.hoisted(() => vi.fn(() => mockStoryRepo));

vi.mock('@/lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession,
    },
}));

vi.mock('@/lib/drizzle/repositories.js', () => ({
    StoryRepository,
}));

import { GET as listGET, POST as listPOST } from '../stories/index';
import {
    GET as itemGET,
    PUT as itemPUT,
    DELETE as itemDELETE,
} from '../stories/[id]';
import { makeRequest } from './utils/requestUtils';

describe('Stories API', () => {
    beforeEach(() => {
        getSession.mockReset();
        StoryRepository.mockClear();
        mockStoryRepo.findByUserId.mockReset();
        mockStoryRepo.create.mockReset();
        mockStoryRepo.findById.mockReset();
        mockStoryRepo.update.mockReset();
        mockStoryRepo.delete.mockReset();
    });

    it('rejects unauthenticated list requests', async () => {
        const response = await listGET({ request: makeRequest() } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Unauthorized',
        });
    });

    it('returns stories for an authenticated user', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockStoryRepo.findByUserId.mockResolvedValue([
            { id: 'story-1', title: 'Story One', userId: 'user-1' },
        ]);

        const response = await listGET({
            request: makeRequest('session=session-123'),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([
            { id: 'story-1', title: 'Story One', userId: 'user-1' },
        ]);
        expect(mockStoryRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('requires a title when creating a story', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });

        const response = await listPOST({
            request: makeRequest('session=session-123', () =>
                Promise.resolve({ title: '   ' })
            ),
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Title is required',
        });
    });

    it('creates a story for an authenticated user', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockStoryRepo.create.mockResolvedValue({
            id: 'story-1',
            title: 'My Story',
            userId: 'user-1',
        });

        const response = await listPOST({
            request: makeRequest('session=session-123', () =>
                Promise.resolve({
                    title: '  My Story  ',
                    description: '  A tale  ',
                    status: 'draft',
                })
            ),
        } as any);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
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
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'someone-else',
        });

        const response = await itemGET({
            params: { id: 'story-1' },
            request: makeRequest('session=session-123'),
        } as any);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: 'Story not found',
        });
    });

    it('returns 404 when story does not exist', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockStoryRepo.findById.mockResolvedValue(null);

        const response = await itemGET({
            params: { id: 'nonexistent-story' },
            request: makeRequest('session=session-123'),
        } as any);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: 'Story not found',
        });
    });

    it('updates a story owned by the user', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
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
            request: makeRequest('session=session-123', () =>
                Promise.resolve({ title: 'Updated Story' })
            ),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            id: 'story-1',
            title: 'Updated Story',
            userId: 'user-1',
        });
        expect(mockStoryRepo.update).toHaveBeenCalledWith('story-1', {
            title: 'Updated Story',
        });
    });

    it('deletes a story owned by the user', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            title: 'Story One',
            userId: 'user-1',
        });
        mockStoryRepo.delete.mockResolvedValue(undefined);

        const response = await itemDELETE({
            params: { id: 'story-1' },
            request: makeRequest('session=session-123'),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true });
        expect(mockStoryRepo.delete).toHaveBeenCalledWith('story-1');
    });
});
