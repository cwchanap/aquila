import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRequest } from '@/lib/test-setup';

vi.mock('@/lib/drizzle/repositories.js', () => ({
    CharacterSetupRepository: vi.fn(),
}));

vi.mock('@/lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession: vi.fn(),
    },
}));

vi.mock('@/lib/story-types.js', () => ({
    StoryId: { TRAIN_ADVENTURE: 'train_adventure' },
    isValidStoryId: vi.fn(),
}));

import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import { isValidStoryId } from '@/lib/story-types.js';
import { POST, GET } from '../character-setup';

const createMockRepo = () => ({
    findByUserAndStory: vi.fn(),
    findByUser: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
});

const getSession = vi.mocked(
    SimpleAuthService.getSession
) as unknown as ReturnType<typeof vi.fn>;
const isValidStoryIdMock = vi.mocked(isValidStoryId) as unknown as ReturnType<
    typeof vi.fn
>;
const CharacterSetupRepositoryMock = vi.mocked(CharacterSetupRepository);
let mockRepo = createMockRepo();

describe('Character Setup API', () => {
    beforeEach(() => {
        getSession.mockReset();
        isValidStoryIdMock.mockReset();
        CharacterSetupRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        CharacterSetupRepositoryMock.mockReturnValue(mockRepo as any);
    });

    it('rejects unauthenticated POST requests', async () => {
        const response = await POST({ request: makeRequest() } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Unauthorized',
        });
    });

    it('rejects unauthenticated GET requests', async () => {
        const response = await GET({
            request: makeRequest(),
            url: new URL('http://localhost/api/character-setup'),
        } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Unauthorized',
        });
    });

    it('validates required character name', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(true);

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    characterName: '   ',
                    storyId: 'train_adventure',
                })
            ),
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Character name cannot be empty',
        });
    });

    it('validates story id', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(false);

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    characterName: 'Hero',
                    storyId: 'invalid',
                })
            ),
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Valid story ID is required',
        });
    });

    it('updates an existing setup', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue({ id: 'setup-1' });
        mockRepo.update.mockResolvedValue({
            id: 'setup-1',
            characterName: 'New Hero',
        });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    characterName: '  New Hero ',
                    storyId: 'train_adventure',
                })
            ),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            id: 'setup-1',
            characterName: 'New Hero',
        });
        expect(mockRepo.update).toHaveBeenCalledWith('setup-1', {
            characterName: 'New Hero',
        });
    });

    it('creates a new setup when none exists', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue(undefined);
        mockRepo.create.mockResolvedValue({
            id: 'setup-2',
            characterName: 'Hero',
            storyId: 'train_adventure',
        });

        const response = await POST({
            request: makeRequest('session=token', () =>
                Promise.resolve({
                    characterName: 'Hero',
                    storyId: 'train_adventure',
                })
            ),
        } as any);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            id: 'setup-2',
            characterName: 'Hero',
            storyId: 'train_adventure',
        });
        expect(mockRepo.create).toHaveBeenCalledWith({
            userId: 'user-1',
            characterName: 'Hero',
            storyId: 'train_adventure',
        });
    });

    it('returns all setups when no story id is provided', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(false);
        mockRepo.findByUser.mockResolvedValue([
            { id: 'setup-1', characterName: 'Hero' },
        ]);

        const response = await GET({
            request: makeRequest('session=token'),
            url: new URL('http://localhost/api/character-setup'),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([
            { id: 'setup-1', characterName: 'Hero' },
        ]);
        expect(mockRepo.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('returns a setup when a valid story id is provided', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue({
            id: 'setup-2',
            characterName: 'Hero',
        });

        const response = await GET({
            request: makeRequest('session=token'),
            url: new URL(
                'http://localhost/api/character-setup?storyId=train_adventure'
            ),
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            id: 'setup-2',
            characterName: 'Hero',
        });
        expect(mockRepo.findByUserAndStory).toHaveBeenCalledWith(
            'user-1',
            'train_adventure'
        );
    });
});
