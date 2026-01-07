import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

const mockRepo = vi.hoisted(() => ({
    create: vi.fn(),
}));

const SceneRepository = vi.hoisted(() => vi.fn(() => mockRepo));

vi.mock('@/lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession,
    },
}));

vi.mock('@/lib/drizzle/repositories.js', () => ({
    SceneRepository,
}));

import { POST } from '../scenes/index';
import { makeRequest } from './utils/requestUtils';

describe('Scenes API', () => {
    beforeEach(() => {
        getSession.mockReset();
        SceneRepository.mockClear();
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

    it('creates a scene without a chapter', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockRepo.create.mockResolvedValue({
            id: 'scene-1',
            title: 'Scene One',
            storyId: 'story-1',
        });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    storyId: 'story-1',
                    title: '  Scene One  ',
                    content: '  Opening  ',
                    order: 1,
                })
            ),
        } as any);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            id: 'scene-1',
            title: 'Scene One',
            storyId: 'story-1',
        });
        expect(mockRepo.create).toHaveBeenCalledWith({
            storyId: 'story-1',
            chapterId: null,
            title: 'Scene One',
            content: 'Opening',
            order: '1',
        });
    });

    it('creates a scene within a chapter', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        mockRepo.create.mockResolvedValue({
            id: 'scene-2',
            title: 'Scene Two',
            storyId: 'story-1',
            chapterId: 'chapter-1',
        });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    storyId: 'story-1',
                    chapterId: 'chapter-1',
                    title: 'Scene Two',
                    content: 'Body',
                    order: 2,
                })
            ),
        } as any);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
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
            order: '2',
        });
    });
});
