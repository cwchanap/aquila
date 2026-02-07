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
        ChapterRepositoryMock.mockReturnValue(mockRepo as any);
        StoryRepositoryMock.mockReturnValue(mockStoryRepo as any);
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
            order: '1',
        });
    });
});
