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
    ChapterRepository: vi.fn(),
    StoryRepository: vi.fn(),
}));

import {
    ChapterRepository,
    StoryRepository,
} from '@/lib/drizzle/repositories.js';
import { POST } from '../chapters/index';

const createMockRepo = () => ({
    create: vi.fn(),
});

const createMockStoryRepo = () => ({
    findById: vi.fn(),
});

const mockAuthenticatedSession = (userId: string = 'user-1') => {
    mockGetSession.mockResolvedValue({
        user: { id: userId, email: 'test@example.com' },
    });
};

const mockUnauthenticatedSession = () => {
    mockGetSession.mockResolvedValue(null);
};

const ChapterRepositoryMock = vi.mocked(ChapterRepository);
const StoryRepositoryMock = vi.mocked(StoryRepository);
let mockRepo = createMockRepo();
let mockStoryRepo = createMockStoryRepo();

describe('Chapters API', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
        ChapterRepositoryMock.mockReset();
        StoryRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        mockStoryRepo = createMockStoryRepo();
        ChapterRepositoryMock.mockImplementation(function () {
            return mockRepo;
        });
        StoryRepositoryMock.mockImplementation(function () {
            return mockStoryRepo;
        });
        mockUnauthenticatedSession();
    });

    it('rejects unauthenticated requests', async () => {
        const response = await POST({
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
            }),
        } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('validates required fields', async () => {
        mockAuthenticatedSession('user-1');

        const response = await POST({
            request: new Request('http://localhost/api/chapters', {
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

    it('creates a chapter with trimmed values', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
            title: 'Test Story',
        });
        mockRepo.create.mockResolvedValue({
            id: 'chapter-1',
            title: 'Chapter One',
            storyId: 'story-1',
        });

        const response = await POST({
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: '  Chapter One  ',
                    description: '  A start  ',
                    order: 1,
                }),
            }),
        } as any);

        expect(response.status).toBe(201);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'chapter-1',
            title: 'Chapter One',
            storyId: 'story-1',
        });
        expect(mockRepo.create).toHaveBeenCalledWith({
            storyId: 'story-1',
            title: 'Chapter One',
            description: 'A start',
            order: 1,
        });
    });

    it('rejects non-integer order value', async () => {
        mockAuthenticatedSession('user-1');
        mockStoryRepo.findById.mockResolvedValue({
            id: 'story-1',
            userId: 'user-1',
            title: 'Test Story',
        });

        const response = await POST({
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Chapter One',
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
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'nonexistent-story',
                    title: 'Chapter One',
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
            title: 'Other Story',
        });

        const response = await POST({
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Chapter One',
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
            request: new Request('http://localhost/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: 'story-1',
                    title: 'Chapter One',
                    order: 0,
                }),
            }),
        } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to create chapter');
    });
});
