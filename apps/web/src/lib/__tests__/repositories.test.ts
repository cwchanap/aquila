import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository, CharacterSetupRepository } from '../repositories';
import { StoryId } from '../story-types';
import { db } from '../db';

vi.mock('../db', () => ({
    db: {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn(),
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn(),
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    },
}));

type AnyMock = ReturnType<typeof vi.fn>;
type DbMock = {
    insertInto: AnyMock;
    values: AnyMock;
    returningAll: AnyMock;
    executeTakeFirstOrThrow: AnyMock;
    selectFrom: AnyMock;
    selectAll: AnyMock;
    where: AnyMock;
    executeTakeFirst: AnyMock;
    updateTable: AnyMock;
    set: AnyMock;
    returning: AnyMock;
    deleteFrom: AnyMock;
    orderBy: AnyMock;
    limit: AnyMock;
    offset: AnyMock;
    execute: AnyMock;
};

const mockedDb = db as unknown as DbMock;

describe('Repositories', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('UserRepository', () => {
        it('creates a user', async () => {
            const userData = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                image: null,
                emailVerified: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };
            const createdUser = { ...userData };

            mockedDb.insertInto.mockReturnValueOnce({
                values: vi.fn().mockReturnValue({
                    returningAll: vi.fn().mockReturnValue({
                        executeTakeFirstOrThrow: vi
                            .fn()
                            .mockResolvedValue(createdUser),
                    }),
                }),
            });

            const result = await UserRepository.create(userData);

            expect(result).toEqual(createdUser);
            expect(mockedDb.insertInto).toHaveBeenCalledWith('users');
        });

        it('finds a user by id', async () => {
            const user = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                image: null,
                emailVerified: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(user),
                    }),
                }),
            });

            const result = await UserRepository.findById('user-123');
            expect(result).toEqual(user);
        });

        it('returns null when user id missing', async () => {
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(null),
                    }),
                }),
            });

            const result = await UserRepository.findById('missing');
            expect(result).toBeNull();
        });

        it('updates a user', async () => {
            const updated = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Updated',
                username: 'testuser',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            mockedDb.updateTable.mockReturnValueOnce({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(updated),
                        }),
                    }),
                }),
            });

            const result = await UserRepository.update('user-123', {
                name: 'Updated',
            });
            expect(result).toEqual(updated);
        });

        it('deletes a user', async () => {
            const deleted = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            };

            mockedDb.deleteFrom.mockReturnValueOnce({
                where: vi.fn().mockReturnValue({
                    returningAll: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(deleted),
                    }),
                }),
            });

            const result = await UserRepository.delete('user-123');
            expect(result).toEqual(deleted);
        });

        it('lists users with pagination', async () => {
            const rows = [{ id: 'user-1', email: 'user1@example.com' }];

            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                            offset: vi.fn().mockReturnValue({
                                execute: vi.fn().mockResolvedValue(rows),
                            }),
                        }),
                    }),
                }),
            });

            const result = await UserRepository.list(10, 0);
            expect(result).toEqual(rows);
        });
    });

    describe('CharacterSetupRepository', () => {
        const setup = {
            id: 'setup-123',
            userId: 'user-123',
            characterName: 'Hero',
            storyId: StoryId.TRAIN_ADVENTURE,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        };

        it('creates a character setup', async () => {
            mockedDb.insertInto.mockReturnValueOnce({
                values: vi.fn().mockReturnValue({
                    returningAll: vi.fn().mockReturnValue({
                        executeTakeFirstOrThrow: vi
                            .fn()
                            .mockResolvedValue(setup),
                    }),
                }),
            });

            const result = await CharacterSetupRepository.create({
                userId: setup.userId,
                characterName: setup.characterName,
                storyId: setup.storyId,
            });

            expect(result).toEqual(setup);
        });

        it('finds setup by user and story', async () => {
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi.fn().mockResolvedValue(setup),
                        }),
                    }),
                }),
            });

            const result = await CharacterSetupRepository.findByUserAndStory(
                setup.userId,
                setup.storyId
            );
            expect(result).toEqual(setup);
        });

        it('lists setups for user', async () => {
            const rows = [setup];

            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            execute: vi.fn().mockResolvedValue(rows),
                        }),
                    }),
                }),
            });

            const result = await CharacterSetupRepository.findByUser(
                setup.userId
            );
            expect(result).toEqual(rows);
        });

        it('updates a character setup', async () => {
            const updated = { ...setup, characterName: 'Updated Hero' };

            mockedDb.updateTable.mockReturnValueOnce({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(updated),
                        }),
                    }),
                }),
            });

            const result = await CharacterSetupRepository.update(setup.id, {
                characterName: 'Updated Hero',
            });
            expect(result).toEqual(updated);
        });

        it('deletes a character setup', async () => {
            mockedDb.deleteFrom.mockReturnValueOnce({
                where: vi.fn().mockReturnValue({
                    returningAll: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(setup),
                    }),
                }),
            });

            const result = await CharacterSetupRepository.delete(setup.id);
            expect(result).toEqual(setup);
        });
    });
});
