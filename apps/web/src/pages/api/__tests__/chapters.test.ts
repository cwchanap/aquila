import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

const mockRepo = vi.hoisted(() => ({
    create: vi.fn(),
}));

const ChapterRepository = vi.hoisted(() => vi.fn(() => mockRepo));

vi.mock('@/lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession,
    },
}));

vi.mock('@/lib/drizzle/repositories.js', () => ({
    ChapterRepository,
}));

import { POST } from '../chapters/index';

const makeRequest = (cookie?: string, json?: () => Promise<any>) =>
    ({
        headers: {
            get: (name: string) =>
                name === 'cookie' ? (cookie ?? null) : null,
        },
        json,
    }) as any;

describe('Chapters API', () => {
    beforeEach(() => {
        getSession.mockReset();
        ChapterRepository.mockClear();
        mockRepo.create.mockReset();
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
