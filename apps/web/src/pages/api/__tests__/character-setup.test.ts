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
    CharacterSetupRepository: vi.fn(),
}));

vi.mock('@/lib/story-types.js', () => ({
    StoryId: { TRAIN_ADVENTURE: 'train_adventure' },
    isValidStoryId: vi.fn(),
}));

import { CharacterSetupRepository } from '@/lib/drizzle/repositories.js';
import { isValidStoryId } from '@/lib/story-types.js';
import { POST, GET } from '../character-setup';

const createMockRepo = () => ({
    findByUserAndStory: vi.fn(),
    findByUser: vi.fn(),
    update: vi.fn(),
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

const isValidStoryIdMock = vi.mocked(isValidStoryId) as unknown as ReturnType<
    typeof vi.fn
>;
const CharacterSetupRepositoryMock = vi.mocked(CharacterSetupRepository);
let mockRepo = createMockRepo();

describe('Character Setup API', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
        isValidStoryIdMock.mockReset();
        CharacterSetupRepositoryMock.mockReset();
        mockRepo = createMockRepo();
        CharacterSetupRepositoryMock.mockReturnValue(mockRepo as any);
        mockUnauthenticatedSession();
    });

    it('rejects unauthenticated POST requests', async () => {
        const response = await POST({
            request: new Request('http://localhost/api/character-setup', {
                method: 'POST',
            }),
        } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('rejects unauthenticated GET requests', async () => {
        const response = await GET({
            request: new Request('http://localhost/api/character-setup'),
            url: new URL('http://localhost/api/character-setup'),
        } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('validates required character name', async () => {
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(true);

        const response = await POST({
            request: new Request('http://localhost/api/character-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterName: '   ',
                    storyId: 'train_adventure',
                }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Character name');
    });

    it('validates story id', async () => {
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(false);

        const response = await POST({
            request: new Request('http://localhost/api/character-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterName: 'Hero',
                    storyId: 'invalid',
                }),
            }),
        } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('story');
    });

    it('updates an existing setup', async () => {
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue({ id: 'setup-1' });
        mockRepo.update.mockResolvedValue({
            id: 'setup-1',
            characterName: 'New Hero',
        });

        const response = await POST({
            request: new Request('http://localhost/api/character-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterName: '  New Hero ',
                    storyId: 'train_adventure',
                }),
            }),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'setup-1',
            characterName: 'New Hero',
        });
        expect(mockRepo.update).toHaveBeenCalledWith('setup-1', {
            characterName: 'New Hero',
        });
    });

    it('creates a new setup when none exists', async () => {
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue(undefined);
        mockRepo.create.mockResolvedValue({
            id: 'setup-2',
            characterName: 'Hero',
            storyId: 'train_adventure',
        });

        const response = await POST({
            request: new Request('http://localhost/api/character-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterName: 'Hero',
                    storyId: 'train_adventure',
                }),
            }),
        } as any);

        expect(response.status).toBe(201);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
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
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(false);
        mockRepo.findByUser.mockResolvedValue([
            { id: 'setup-1', characterName: 'Hero' },
        ]);

        const response = await GET({
            request: new Request('http://localhost/api/character-setup'),
            url: new URL('http://localhost/api/character-setup'),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual([{ id: 'setup-1', characterName: 'Hero' }]);
        expect(mockRepo.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('returns a setup when a valid story id is provided', async () => {
        mockAuthenticatedSession('user-1');
        isValidStoryIdMock.mockReturnValue(true);
        mockRepo.findByUserAndStory.mockResolvedValue({
            id: 'setup-2',
            characterName: 'Hero',
        });

        const response = await GET({
            request: new Request(
                'http://localhost/api/character-setup?storyId=train_adventure'
            ),
            url: new URL(
                'http://localhost/api/character-setup?storyId=train_adventure'
            ),
        } as any);

        expect(response.status).toBe(200);
        const data = await response.json();
        // jsonResponse returns raw data for backward compatibility
        expect(data).toEqual({
            id: 'setup-2',
            characterName: 'Hero',
        });
        expect(mockRepo.findByUserAndStory).toHaveBeenCalledWith(
            'user-1',
            'train_adventure'
        );
    });
});
