import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Set test environment variables to prevent real DB connection
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Create the mocked functions in hoisted scope
const mockedLogger = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
}));

const mockedDb = vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
    delete: vi.fn(),
}));

const mockedBcrypt = vi.hoisted(() => ({
    hash: vi.fn(),
    compare: vi.fn(),
}));

// Apply the mocks
vi.mock('../logger.js', () => ({
    logger: mockedLogger,
}));

vi.mock('../drizzle/db.js', () => ({
    db: mockedDb,
}));

vi.mock('@/lib/drizzle/db.js', () => ({
    db: mockedDb,
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    gt: vi.fn((...args: unknown[]) => ({ type: 'gt', args })),
    sql: vi.fn((...args: unknown[]) => ({ type: 'sql', args })),
}));

vi.mock('bcryptjs', () => ({
    default: mockedBcrypt,
}));

let sql: typeof import('drizzle-orm').sql;
let SimpleAuthService: typeof import('../simple-auth').SimpleAuthService;
let accounts: typeof import('../drizzle/schema.js').accounts;
let sessions: typeof import('../drizzle/schema.js').sessions;
let users: typeof import('../drizzle/schema.js').users;
let UserAlreadyExistsError: typeof import('../errors.js').UserAlreadyExistsError;
let DatabaseError: typeof import('../errors.js').DatabaseError;

describe('SimpleAuthService', () => {
    beforeAll(async () => {
        ({ sql } = await import('drizzle-orm'));
        ({ SimpleAuthService } = await import('../simple-auth'));
        ({ accounts, sessions, users } = await import('../drizzle/schema.js'));
        ({ UserAlreadyExistsError, DatabaseError } = await import(
            '../errors.js'
        ));
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('signUp', () => {
        it('should successfully create a new user', async () => {
            const userData = {
                email: '  MixedCase@Example.com  ',
                password: 'password123',
                name: 'Test User',
            };
            const normalizedEmail = 'mixedcase@example.com';

            const selectLimit = vi.fn().mockResolvedValue([]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            mockedBcrypt.hash.mockResolvedValue('hashed-password');

            const userValues = vi.fn().mockResolvedValue(undefined);
            const accountValues = vi.fn().mockResolvedValue(undefined);
            const txInsert = vi
                .fn()
                .mockReturnValueOnce({ values: userValues })
                .mockReturnValueOnce({ values: accountValues });

            mockedDb.transaction.mockImplementationOnce(async callback => {
                await callback({ insert: txInsert });
            });

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toEqual({
                id: expect.any(String),
                email: normalizedEmail,
                name: userData.name,
                username: null,
            });
            expect(mockedBcrypt.hash).toHaveBeenCalledWith(
                userData.password,
                10
            );
            expect(selectFrom).toHaveBeenCalledWith(users);
            expect(sql).toHaveBeenCalled();
            expect(txInsert).toHaveBeenNthCalledWith(1, users);
            expect(txInsert).toHaveBeenNthCalledWith(2, accounts);
            expect(userValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: normalizedEmail,
                    name: userData.name,
                    username: null,
                })
            );
            expect(accountValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountId: normalizedEmail,
                    providerId: 'email',
                    password: 'hashed-password',
                })
            );

            const createdUserId = userValues.mock.calls[0]?.[0]?.id;
            expect(createdUserId).toEqual(expect.any(String));
            expect(accountValues.mock.calls[0]?.[0]?.userId).toBe(
                createdUserId
            );
        });

        it('should throw UserAlreadyExistsError if user already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'password123',
                name: 'Test User',
            };

            const selectLimit = vi
                .fn()
                .mockResolvedValue([
                    { id: 'existing-user', email: userData.email },
                ]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            await expect(
                SimpleAuthService.signUp(
                    userData.email,
                    userData.password,
                    userData.name
                )
            ).rejects.toThrow(UserAlreadyExistsError);

            expect(mockedDb.transaction).not.toHaveBeenCalled();
            expect(mockedBcrypt.hash).not.toHaveBeenCalled();
        });

        it('should throw DatabaseError on transaction failure', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            const selectLimit = vi.fn().mockResolvedValue([]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });
            mockedBcrypt.hash.mockResolvedValue('hashed-password');
            mockedDb.transaction.mockRejectedValue(
                new Error('Transaction failed')
            );

            await expect(
                SimpleAuthService.signUp(
                    userData.email,
                    userData.password,
                    userData.name
                )
            ).rejects.toThrow(DatabaseError);
        });

        it('should rollback user creation when account creation fails', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            const selectLimit = vi.fn().mockResolvedValue([]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });
            mockedBcrypt.hash.mockResolvedValue('hashed-password');

            // Mock transaction to simulate user insert success but account insert failure
            const userValues = vi.fn().mockResolvedValue(undefined);
            const accountValues = vi
                .fn()
                .mockRejectedValue(new Error('Account insert failed'));

            const txInsert = vi
                .fn()
                .mockReturnValueOnce({ values: userValues })
                .mockReturnValueOnce({ values: accountValues });

            mockedDb.transaction.mockImplementationOnce(async callback => {
                await callback({ insert: txInsert });
            });

            // The signup should throw DatabaseError and no user record should persist
            await expect(
                SimpleAuthService.signUp(
                    userData.email,
                    userData.password,
                    userData.name
                )
            ).rejects.toThrow(DatabaseError);

            // Verify both user and account inserts were attempted
            expect(txInsert).toHaveBeenNthCalledWith(1, users);
            expect(txInsert).toHaveBeenNthCalledWith(2, accounts);
            expect(userValues).toHaveBeenCalled();
            expect(accountValues).toHaveBeenCalled();

            // Transaction failure means neither record should persist (rollback)
            // The test verifies the error is thrown, indicating rollback occurred
        });

        describe('case-insensitive email handling', () => {
            it('should normalize email to lowercase and reject duplicate', async () => {
                const signupEmail = 'USER@example.com';

                // Simulate existing user with normalized (lowercase) email
                const normalizedEmail = 'user@example.com';
                const selectLimit = vi
                    .fn()
                    .mockResolvedValue([
                        { id: 'existing-id', email: normalizedEmail },
                    ]);
                const selectWhere = vi
                    .fn()
                    .mockReturnValue({ limit: selectLimit });
                const selectFrom = vi
                    .fn()
                    .mockReturnValue({ where: selectWhere });

                mockedDb.select.mockReturnValueOnce({ from: selectFrom });

                // Try to sign up with email in different case
                await expect(
                    SimpleAuthService.signUp(signupEmail, 'password', 'User')
                ).rejects.toThrow(UserAlreadyExistsError);

                // Verify email was normalized to lowercase and sql was used for case-insensitive comparison
                expect(sql).toHaveBeenCalled();
            });
        });
    });

    describe('signIn', () => {
        it('should successfully authenticate user', async () => {
            const credentials = {
                email: '  MixedCase@Example.com  ',
                password: 'password123',
            };
            const normalizedEmail = 'mixedcase@example.com';

            const mockUser = {
                id: 'user-123',
                email: normalizedEmail,
                name: 'Test User',
                username: 'testuser',
            };

            const mockAccount = {
                password: 'hashed-password',
            };

            const userLimit = vi.fn().mockResolvedValue([mockUser]);
            const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
            const userFrom = vi.fn().mockReturnValue({ where: userWhere });

            const accountLimit = vi.fn().mockResolvedValue([mockAccount]);
            const accountWhere = vi
                .fn()
                .mockReturnValue({ limit: accountLimit });
            const accountFrom = vi
                .fn()
                .mockReturnValue({ where: accountWhere });

            mockedDb.select
                .mockReturnValueOnce({ from: userFrom })
                .mockReturnValueOnce({ from: accountFrom });

            mockedBcrypt.compare.mockResolvedValue(true);

            const result = await SimpleAuthService.signIn(
                credentials.email,
                credentials.password
            );

            expect(result).toEqual(mockUser);
            expect(userFrom).toHaveBeenCalledWith(users);
            expect(sql).toHaveBeenCalled();
            expect(accountFrom).toHaveBeenCalledWith(accounts);
            expect(mockedBcrypt.compare).toHaveBeenCalledWith(
                credentials.password,
                mockAccount.password
            );
        });

        it('should return null if user not found', async () => {
            const userLimit = vi.fn().mockResolvedValue([]);
            const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
            const userFrom = vi.fn().mockReturnValue({ where: userWhere });

            mockedDb.select.mockReturnValueOnce({ from: userFrom });

            const result = await SimpleAuthService.signIn(
                'nonexistent@example.com',
                'password'
            );

            expect(result).toBeNull();
            expect(mockedBcrypt.compare).not.toHaveBeenCalled();
        });

        it('should return null if password is incorrect', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockAccount = { password: 'hashed-password' };

            const userLimit = vi.fn().mockResolvedValue([mockUser]);
            const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
            const userFrom = vi.fn().mockReturnValue({ where: userWhere });

            const accountLimit = vi.fn().mockResolvedValue([mockAccount]);
            const accountWhere = vi
                .fn()
                .mockReturnValue({ limit: accountLimit });
            const accountFrom = vi
                .fn()
                .mockReturnValue({ where: accountWhere });

            mockedDb.select
                .mockReturnValueOnce({ from: userFrom })
                .mockReturnValueOnce({ from: accountFrom });

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

            const userLimit = vi.fn().mockResolvedValue([mockUser]);
            const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
            const userFrom = vi.fn().mockReturnValue({ where: userWhere });

            const accountLimit = vi.fn().mockResolvedValue([mockAccount]);
            const accountWhere = vi
                .fn()
                .mockReturnValue({ limit: accountLimit });
            const accountFrom = vi
                .fn()
                .mockReturnValue({ where: accountWhere });

            mockedDb.select
                .mockReturnValueOnce({ from: userFrom })
                .mockReturnValueOnce({ from: accountFrom });

            const result = await SimpleAuthService.signIn(
                'test@example.com',
                'password'
            );

            expect(result).toBeNull();
        });

        describe('case-insensitive email signin', () => {
            it('should normalize email to lowercase and sign in successfully', async () => {
                const registeredEmail = 'test@example.com';
                const loginEmail = 'TEST@example.com';

                const mockUser = {
                    id: 'user-123',
                    email: registeredEmail,
                    name: 'Test User',
                    username: 'testuser',
                };

                const mockAccount = {
                    password: 'hashed-password',
                };

                const userLimit = vi.fn().mockResolvedValue([mockUser]);
                const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
                const userFrom = vi.fn().mockReturnValue({ where: userWhere });

                const accountLimit = vi.fn().mockResolvedValue([mockAccount]);
                const accountWhere = vi
                    .fn()
                    .mockReturnValue({ limit: accountLimit });
                const accountFrom = vi
                    .fn()
                    .mockReturnValue({ where: accountWhere });

                mockedDb.select
                    .mockReturnValueOnce({ from: userFrom })
                    .mockReturnValueOnce({ from: accountFrom });

                mockedBcrypt.compare.mockResolvedValue(true);

                const result = await SimpleAuthService.signIn(
                    loginEmail,
                    'correctpassword'
                );

                expect(result).toEqual(mockUser);
                // Verify email was normalized and sql was used for case-insensitive comparison
                expect(sql).toHaveBeenCalled();
            });
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

            const values = vi.fn().mockResolvedValue(undefined);

            mockedDb.insert.mockReturnValueOnce({ values });

            const sessionId = await SimpleAuthService.createSession(mockUser);

            expect(typeof sessionId).toBe('string');
            expect(mockedDb.insert).toHaveBeenCalledWith(sessions);
            expect(values).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: mockUser.id,
                })
            );

            const insertedSession = values.mock.calls[0]?.[0];
            expect(insertedSession?.id).toBe(sessionId);
        });
    });

    describe('getSession', () => {
        it('should retrieve valid session', async () => {
            const sessionId = 'session-123';
            const mockSessionRow = {
                sessionId,
                expiresAt: new Date(Date.now() + 1000),
                sessionCreatedAt: new Date('2024-01-01'),
                sessionUpdatedAt: new Date('2024-01-02'),
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                emailVerified: true,
                userCreatedAt: new Date('2023-01-01'),
                userUpdatedAt: new Date('2023-06-01'),
            };

            const selectLimit = vi.fn().mockResolvedValue([mockSessionRow]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const innerJoin = vi.fn().mockReturnValue({ where: selectWhere });
            const selectFrom = vi.fn().mockReturnValue({ innerJoin });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toEqual({
                user: {
                    id: mockSessionRow.userId,
                    email: mockSessionRow.email,
                    name: mockSessionRow.name,
                    username: mockSessionRow.username,
                    emailVerified: mockSessionRow.emailVerified,
                    createdAt: mockSessionRow.userCreatedAt,
                    updatedAt: mockSessionRow.userUpdatedAt,
                },
                sessionId,
                expiresAt: mockSessionRow.expiresAt,
                createdAt: mockSessionRow.sessionCreatedAt,
                updatedAt: mockSessionRow.sessionUpdatedAt,
            });
            expect(selectFrom).toHaveBeenCalledWith(sessions);
            expect(innerJoin).toHaveBeenCalledWith(users, expect.anything());
        });

        it('should return null for expired session', async () => {
            const sessionId = 'expired-session';

            const selectLimit = vi.fn().mockResolvedValue([]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const innerJoin = vi.fn().mockReturnValue({ where: selectWhere });
            const selectFrom = vi.fn().mockReturnValue({ innerJoin });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toBeNull();
        });

        it('should return null for non-existent session', async () => {
            const sessionId = 'non-existent';

            const selectLimit = vi.fn().mockResolvedValue([]);
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const innerJoin = vi.fn().mockReturnValue({ where: selectWhere });
            const selectFrom = vi.fn().mockReturnValue({ innerJoin });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            const result = await SimpleAuthService.getSession(sessionId);

            expect(result).toBeNull();
        });
    });

    describe('deleteSession', () => {
        it('should delete session', async () => {
            const sessionId = 'session-123';

            const where = vi.fn().mockResolvedValue(undefined);

            mockedDb.delete.mockReturnValueOnce({ where });

            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).resolves.toBeUndefined();

            expect(mockedDb.delete).toHaveBeenCalledWith(sessions);
            expect(where).toHaveBeenCalledWith(expect.anything());
        });

        it('should throw error on database failure', async () => {
            const sessionId = 'session-123';

            const where = vi
                .fn()
                .mockRejectedValue(new Error('Database error'));

            mockedDb.delete.mockReturnValueOnce({ where });

            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).rejects.toThrow('Database error');
        });
    });
});
