import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository, CharacterSetupRepository } from '../repositories';
import { StoryId } from '../story-types';

// Mock the db module
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
        destroy: vi.fn(),
    },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '../db';

describe('Repositories', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('UserRepository', () => {
        describe('create', () => {
            it('should create a new user', async () => {
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

                const mockResult = {
                    ...userData,
                    image: null,
                    emailVerified: null,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.insertInto as any).mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirstOrThrow: vi
                                .fn()
                                .mockResolvedValue(mockResult),
                        }),
                    }),
                });

                const result = await UserRepository.create(userData);

                expect(result).toEqual(mockResult);
                expect(db.insertInto).toHaveBeenCalledWith('users');
            });
        });

        describe('findById', () => {
            it('should find user by id', async () => {
                const mockUser = {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                    username: 'testuser',
                    image: null,
                    emailVerified: null,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockUser),
                        }),
                    }),
                });

                const result = await UserRepository.findById('user-123');

                expect(result).toEqual(mockUser);
                expect(db.selectFrom).toHaveBeenCalledWith('users');
            });

            it('should return null if user not found', async () => {
                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi.fn().mockResolvedValue(null),
                        }),
                    }),
                });

                const result = await UserRepository.findById('non-existent');

                expect(result).toBeNull();
            });
        });

        describe('findByEmail', () => {
            it('should find user by email', async () => {
                const mockUser = {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                    username: 'testuser',
                };

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockUser),
                        }),
                    }),
                });

                const result =
                    await UserRepository.findByEmail('test@example.com');

                expect(result).toEqual(mockUser);
            });
        });

        describe('update', () => {
            it('should update user', async () => {
                const updates = { name: 'Updated Name' };
                const mockResult = {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Updated Name',
                    username: 'testuser',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.updateTable as any).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returningAll: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(mockResult),
                            }),
                        }),
                    }),
                });

                const result = await UserRepository.update('user-123', updates);

                expect(result).toEqual(mockResult);
                expect(db.updateTable).toHaveBeenCalledWith('users');
            });
        });

        describe('delete', () => {
            it('should delete user', async () => {
                const mockResult = {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                };

                (db.deleteFrom as any).mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockResult),
                        }),
                    }),
                });

                const result = await UserRepository.delete('user-123');

                expect(result).toEqual(mockResult);
                expect(db.deleteFrom).toHaveBeenCalledWith('users');
            });
        });

        describe('list', () => {
            it('should list users with default parameters', async () => {
                const mockUsers = [
                    { id: 'user-1', email: 'user1@example.com' },
                    { id: 'user-2', email: 'user2@example.com' },
                ];

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockReturnValue({
                                    execute: vi
                                        .fn()
                                        .mockResolvedValue(mockUsers),
                                }),
                            }),
                        }),
                    }),
                });

                const result = await UserRepository.list();

                expect(result).toEqual(mockUsers);
                expect(db.selectFrom).toHaveBeenCalledWith('users');
            });

            it('should list users with custom parameters', async () => {
                const mockUsers = [
                    { id: 'user-1', email: 'user1@example.com' },
                ];

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockReturnValue({
                                    execute: vi
                                        .fn()
                                        .mockResolvedValue(mockUsers),
                                }),
                            }),
                        }),
                    }),
                });

                const result = await UserRepository.list(10, 5);

                expect(result).toEqual(mockUsers);
            });
        });
    });

    describe('CharacterSetupRepository', () => {
        describe('create', () => {
            it('should create a new character setup', async () => {
                const setupData = {
                    userId: 'user-123',
                    characterName: 'Hero',
                    storyId: StoryId.TRAIN_ADVENTURE,
                };

                const mockResult = {
                    id: 'setup-123',
                    ...setupData,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.insertInto as any).mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirstOrThrow: vi
                                .fn()
                                .mockResolvedValue(mockResult),
                        }),
                    }),
                });

                const result = await CharacterSetupRepository.create(setupData);

                expect(result).toEqual(mockResult);
                expect(db.insertInto).toHaveBeenCalledWith('characterSetups');
            });
        });

        describe('findByUserAndStory', () => {
            it('should find character setup by user and story', async () => {
                const mockSetup = {
                    id: 'setup-123',
                    userId: 'user-123',
                    characterName: 'Hero',
                    storyId: StoryId.TRAIN_ADVENTURE,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(mockSetup),
                            }),
                        }),
                    }),
                });

                const result =
                    await CharacterSetupRepository.findByUserAndStory(
                        'user-123',
                        StoryId.TRAIN_ADVENTURE
                    );

                expect(result).toEqual(mockSetup);
            });
        });

        describe('findByUser', () => {
            it('should find character setups by user', async () => {
                const mockSetups = [
                    {
                        id: 'setup-1',
                        userId: 'user-123',
                        characterName: 'Hero',
                        storyId: StoryId.TRAIN_ADVENTURE,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z',
                    },
                ];

                (db.selectFrom as any).mockReturnValue({
                    selectAll: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                execute: vi.fn().mockResolvedValue(mockSetups),
                            }),
                        }),
                    }),
                });

                const result =
                    await CharacterSetupRepository.findByUser('user-123');

                expect(result).toEqual(mockSetups);
            });
        });

        describe('update', () => {
            it('should update character setup', async () => {
                const updates = { characterName: 'Updated Hero' };
                const mockResult = {
                    id: 'setup-123',
                    userId: 'user-123',
                    characterName: 'Updated Hero',
                    storyId: StoryId.TRAIN_ADVENTURE,
                    updatedAt: '2024-01-01T00:00:00.000Z',
                };

                (db.updateTable as any).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returningAll: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(mockResult),
                            }),
                        }),
                    }),
                });

                const result = await CharacterSetupRepository.update(
                    'setup-123',
                    updates
                );

                expect(result).toEqual(mockResult);
                expect(db.updateTable).toHaveBeenCalledWith('characterSetups');
            });
        });

        describe('delete', () => {
            it('should delete character setup', async () => {
                const mockResult = {
                    id: 'setup-123',
                    userId: 'user-123',
                    characterName: 'Hero',
                    storyId: StoryId.TRAIN_ADVENTURE,
                };

                (db.deleteFrom as any).mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returningAll: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockResult),
                        }),
                    }),
                });

                const result =
                    await CharacterSetupRepository.delete('setup-123');

                expect(result).toEqual(mockResult);
                expect(db.deleteFrom).toHaveBeenCalledWith('characterSetups');
            });
        });
    });
});
