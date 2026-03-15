import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/drizzle/repositories.js', () => ({
    SceneRepository: vi.fn(),
    StoryRepository: vi.fn(),
}));

import {
    SceneRepository,
    StoryRepository,
} from '@/lib/drizzle/repositories.js';
import { POST } from '../scenes/index';

const createMockRepo = () => ({
    create: vi.fn(),
});

const mockAuthenticatedSession = (userId: string = 'user-1') => {
    mockGetSession.mockResolvedValue({
        user: { id: userId, email: 'test@example.com' },
    });
};

const mockUnauthenticatedSession = () => {
    mockGetSession.mockResolvedValue(null);
};

const SceneRepositoryMock = vi.mocked(SceneRepository);
const StoryRepositoryMock = vi.mocked(StoryRepository);
let mockRepo = createMockRepo();
let mockStoryRepo = { findById: vi.fn() };

describe('Scenes API', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
        SceneRepositoryMock.mockReset();
        StoryRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        SceneRepositoryMock.mockReturnValue(mockRepo as any);
        mockStoryRepo = { findById: vi.fn() };
        StoryRepositoryMock.mockReturnValue(mockStoryRepo as any);
        mockUnauthenticatedSession();
    });

    it('rejects unauthenticated requests', async () => {
        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
            }),
        } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('validates required fields', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
        });

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: '',
                    title: '',
                    order: undefined,
                }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Story ID is required');
    });

    it('creates a scene without a chapter', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
        });
        mockRepo.create.mockResolvedValue({
            id: 'scene-1',
            title: 'Scene One',
            storyId: 'story-1',
        });

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: '  Scene One  ',
                    content: '  Opening  ',
                    order: 1,
                }),
            }),
        } as any);

        expect(response.status).toBe(201);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'scene-1',
            title: 'Scene One',
            storyId: 'story-1',
        });
        expect(mockRepo.create).toHaveBeenCalledWith({
            storyId: 'story-1',
            chapterId: null,
            title: 'Scene One',
            content: 'Opening',
            order: 1,
        });
    });

    it('creates a scene within a chapter', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
        });
        mockRepo.create.mockResolvedValue({
            id: 'scene-2',
            title: 'Scene Two',
            storyId: 'story-1',
            chapterId: 'chapter-1',
        });

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    chapterId: 'chapter-1',
                    title: 'Scene Two',
                    content: 'Body',
                    order: 2,
                }),
            }),
        } as any);

        expect(response.status).toBe(201);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'scene-2',
            title: 'Scene Two',
            storyId: 'story-1',
            chapterId: 'chapter-1',
        });
        expect(mockRepo.create).toHaveBeenCalledWith({
            storyId: 'story-1',
            chapterId: 'chapter-1',
            title: 'Scene Two',
            content: 'Body',
            order: 2,
        });
    });

    it('rejects non-integer order value', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
        });

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Scene One',
                    order: 'first',
                }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('integer');
    });

    it('returns 404 when story does not exist', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue(null);

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'nonexistent-story',
                    title: 'Scene One',
                    order: 0,
                }),
            }),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Story not found');
    });

    it('returns 403 when story belongs to a different user', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'other-user',
        });

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Scene One',
                    order: 0,
                }),
            }),
        } as any);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toBe('Forbidden');
    });

    it('returns 500 on unexpected server error', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockRejectedValue(new Error('DB crash'));

        const response = await POST({
            request: new Request('http://localhost/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Scene One',
                    order: 0,
                }),
            }),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to create scene');
    });
});
