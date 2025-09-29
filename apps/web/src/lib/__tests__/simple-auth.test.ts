import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleAuthService } from '../simple-auth';

type AnyMock = ReturnType<typeof vi.fn>;

type DbMock = {
    selectFrom: AnyMock;
    selectAll: AnyMock;
    where: AnyMock;
    executeTakeFirst: AnyMock;
    insertInto: AnyMock;
    values: AnyMock;
    execute: AnyMock;
    deleteFrom: AnyMock;
    innerJoin: AnyMock;
    select: AnyMock;
};

const createDbMock = (): DbMock => ({
    selectFrom: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(),
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    deleteFrom: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
});

const mockedDb: DbMock = createDbMock();

vi.mock('../db', () => ({
    db: mockedDb,
}));

type BcryptMock = {
    hash: AnyMock;
    compare: AnyMock;
};

const mockedBcrypt: BcryptMock = {
    hash: vi.fn(),
    compare: vi.fn(),
};

vi.mock('bcryptjs', () => ({
    default: mockedBcrypt,
}));

describe('SimpleAuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const chainMocks = [
            mockedDb.selectFrom,
            mockedDb.selectAll,
            mockedDb.where,
            mockedDb.insertInto,
            mockedDb.values,
            mockedDb.deleteFrom,
            mockedDb.innerJoin,
            mockedDb.select,
        ];
        for (const mock of chainMocks) {
            mock.mockReset();
            mock.mockReturnThis();
        }
        mockedDb.executeTakeFirst.mockReset();
        mockedDb.execute.mockReset();
        mockedBcrypt.hash.mockReset();
        mockedBcrypt.compare.mockReset();
    });

    describe('signUp', () => {
        it('should successfully create a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            // Mock user not existing
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(null),
                    }),
                }),
            });

            // Mock bcrypt hash
            mockedBcrypt.hash.mockResolvedValue('hashed-password');

            // Mock user creation
            mockedDb.insertInto.mockReturnValueOnce({
                values: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            // Mock account creation
            mockedDb.insertInto.mockReturnValueOnce({
                values: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toEqual({
                id: expect.any(String),
                email: userData.email,
                name: userData.name,
                username: null,
            });
            expect(mockedBcrypt.hash).toHaveBeenCalledWith(
                userData.password,
                10
            );
        });

        it('should return null if user already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'password123',
                name: 'Test User',
            };

            // Mock existing user
            mockedDb.selectFrom.mockReturnValue({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue({
                            id: 'existing-user',
                            email: userData.email,
                        }),
                    }),
                }),
            });

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toBeNull();
        });

        it('should return null on database error', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            // Mock database error
            mockedDb.selectFrom.mockReturnValue({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi
                            .fn()
                            .mockRejectedValue(new Error('Database error')),
                    }),
                }),
            });

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toBeNull();
        });
    });

    describe('signIn', () => {
        it('should successfully authenticate user', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'password123',
            };

            const mockUser = {
                id: 'user-123',
                email: credentials.email,
                name: 'Test User',
                username: 'testuser',
            };

            const mockAccount = {
                password: 'hashed-password',
            };

            // Mock user lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockAccount),
                        }),
                    }),
                }),
            });

            // Mock password comparison
            mockedBcrypt.compare.mockResolvedValue(true);

            const result = await SimpleAuthService.signIn(
                credentials.email,
                credentials.password
            );

            expect(result).toEqual(mockUser);
            expect(mockedBcrypt.compare).toHaveBeenCalledWith(
                credentials.password,
                mockAccount.password
            );
        });

        it('should return null if user not found', async () => {
            // Mock user not found
            mockedDb.selectFrom.mockReturnValue({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(null),
                    }),
                }),
            });

            const result = await SimpleAuthService.signIn(
                'nonexistent@example.com',
                'password'
            );

            expect(result).toBeNull();
        });

        it('should return null if password is incorrect', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockAccount = { password: 'hashed-password' };

            // Mock user lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockAccount),
                        }),
                    }),
                }),
            });

            // Mock password comparison failure
            mockedBcrypt.compare.mockResolvedValue(false);

            const result = await SimpleAuthService.signIn(
                'test@example.com',
                'wrongpassword'
            );

            expect(result).toBeNull();
        });

        it('should return null if account has no password', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockAccount = { password: null };

            // Mock user lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            mockedDb.selectFrom.mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            executeTakeFirst: vi
                                .fn()
                                .mockResolvedValue(mockAccount),
                        }),
                    }),
                }),
            });

            const result = await SimpleAuthService.signIn(
                'test@example.com',
                'password'
            );

            expect(result).toBeNull();
        });
    });

    describe('createSession', () => {
        it('should create a new session', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
            };

            mockedDb.insertInto.mockReturnValue({
                values: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const result = await SimpleAuthService.createSession(mockUser);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(mockedDb.insertInto).toHaveBeenCalledWith('sessions');
        });
    });

    describe('getSession', () => {
        it('should retrieve valid session', async () => {
            const sessionId = 'session-123';
            const mockSessionData = {
                sessionId,
                expiresAt: '2024-12-31T23:59:59.000Z',
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
            };

            mockedDb.selectFrom.mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(mockSessionData),
                            }),
                        }),
                    }),
                }),
            });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toEqual({
                user: {
                    id: mockSessionData.id,
                    email: mockSessionData.email,
                    name: mockSessionData.name,
                    username: mockSessionData.username,
                },
                sessionId,
            });
        });

        it('should return null for expired session', async () => {
            const sessionId = 'expired-session';

            mockedDb.selectFrom.mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(null),
                            }),
                        }),
                    }),
                }),
            });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toBeNull();
        });

        it('should return null for non-existent session', async () => {
            const sessionId = 'non-existent';

            mockedDb.selectFrom.mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                executeTakeFirst: vi
                                    .fn()
                                    .mockResolvedValue(null),
                            }),
                        }),
                    }),
                }),
            });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toBeNull();
        });
    });

    describe('deleteSession', () => {
        it('should delete session', async () => {
            const sessionId = 'session-123';

            mockedDb.deleteFrom.mockReturnValue({
                where: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).resolves.toBeUndefined();
            expect(mockedDb.deleteFrom).toHaveBeenCalledWith('sessions');
        });

        it('should handle database errors gracefully', async () => {
            const sessionId = 'session-123';

            mockedDb.deleteFrom.mockReturnValue({
                where: vi.fn().mockReturnValue({
                    execute: vi
                        .fn()
                        .mockRejectedValue(new Error('Database error')),
                }),
            });

            // Should not throw
            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).resolves.toBeUndefined();
        });
    });
});
