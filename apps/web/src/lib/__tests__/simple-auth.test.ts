import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleAuthService } from '../simple-auth';
import { accounts, sessions, users } from '../drizzle/schema.js';

type AnyMock = ReturnType<typeof vi.fn>;

type DbMock = {
    select: AnyMock;
    insert: AnyMock;
    transaction: AnyMock;
    delete: AnyMock;
};

const mockedDb = vi.hoisted(() => {
    return {
        select: vi.fn(),
        insert: vi.fn(),
        transaction: vi.fn(),
        delete: vi.fn(),
    } satisfies DbMock;
}) as DbMock;

vi.mock('../drizzle/db.js', () => ({
    db: mockedDb,
}));

type BcryptMock = {
    hash: AnyMock;
    compare: AnyMock;
};

const mockedBcrypt = vi.hoisted(
    () =>
        ({
            hash: vi.fn(),
            compare: vi.fn(),
        }) as BcryptMock
);

vi.mock('bcryptjs', () => ({
    default: mockedBcrypt,
}));

describe('SimpleAuthService', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockedDb.select.mockReset();
        mockedDb.insert.mockReset();
        mockedDb.transaction.mockReset();
        mockedDb.delete.mockReset();
        mockedBcrypt.hash.mockReset();
        mockedBcrypt.compare.mockReset();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('signUp', () => {
        it('should successfully create a new user', async () => {
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
                email: userData.email,
                name: userData.name,
                username: null,
            });
            expect(mockedBcrypt.hash).toHaveBeenCalledWith(
                userData.password,
                10
            );
            expect(selectFrom).toHaveBeenCalledWith(users);
            expect(txInsert).toHaveBeenNthCalledWith(1, users);
            expect(txInsert).toHaveBeenNthCalledWith(2, accounts);
            expect(userValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: userData.email,
                    name: userData.name,
                    username: null,
                })
            );
            expect(accountValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountId: userData.email,
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

        it('should return null if user already exists', async () => {
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

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toBeNull();
            expect(mockedDb.transaction).not.toHaveBeenCalled();
            expect(mockedBcrypt.hash).not.toHaveBeenCalled();
        });

        it('should return null on database error', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            const selectLimit = vi
                .fn()
                .mockRejectedValue(new Error('Database error'));
            const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

            mockedDb.select.mockReturnValueOnce({ from: selectFrom });

            const result = await SimpleAuthService.signUp(
                userData.email,
                userData.password,
                userData.name
            );

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
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
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
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
                },
                sessionId,
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

        it('should handle database errors gracefully', async () => {
            const sessionId = 'session-123';

            const where = vi
                .fn()
                .mockRejectedValue(new Error('Database error'));

            mockedDb.delete.mockReturnValueOnce({ where });

            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).resolves.toBeUndefined();

            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });
});
