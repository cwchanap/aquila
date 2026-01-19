import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRequest } from '@/lib/test-setup';

vi.mock('@/lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession: vi.fn(),
    },
}));

vi.mock('@/lib/drizzle/repositories.js', () => ({
    ChapterRepository: vi.fn(),
}));

import { SimpleAuthService } from '@/lib/simple-auth.js';
import { ChapterRepository } from '@/lib/drizzle/repositories.js';
import { POST } from '../chapters/index';

const createMockRepo = () => ({
    create: vi.fn(),
});

const getSession = vi.mocked(
    SimpleAuthService.getSession
) as unknown as ReturnType<typeof vi.fn>;
const ChapterRepositoryMock = vi.mocked(ChapterRepository);
let mockRepo = createMockRepo();

describe('Chapters API', () => {
    beforeEach(() => {
        getSession.mockReset();
        ChapterRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        ChapterRepositoryMock.mockReturnValue(mockRepo as any);
    });

    it('rejects unauthenticated requests', async () => {
        const response = await POST({ request: makeRequest() } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Unauthorized',
        });
    });

    it('validates required fields', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    storyId: '',
                    title: '',
                    order: undefined,
                })
            ),
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Story ID, title, and order are required',
        });
    });

    it('creates a chapter with trimmed values', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockRepo.create.mockResolvedValue({
            id: 'chapter-1',
            title: 'Chapter One',
            storyId: 'story-1',
        });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    storyId: 'story-1',
                    title: '  Chapter One  ',
                    description: '  A start  ',
                    order: 1,
                })
            ),
        } as any);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
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
