import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleAuthService } from '../simple-auth';

// Mock the db module
vi.mock('../db', () => ({
    db: {
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
    },
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn(),
    },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '../db';
import bcrypt from 'bcryptjs';

describe('SimpleAuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('signUp', () => {
        it('should successfully create a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            // Mock user not existing
            (db.selectFrom as any).mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(null),
                    }),
                }),
            });

            // Mock bcrypt hash
            (bcrypt.hash as any).mockResolvedValue('hashed-password');

            // Mock user creation
            (db.insertInto as any).mockReturnValueOnce({
                values: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            // Mock account creation
            (db.insertInto as any).mockReturnValueOnce({
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
            expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
        });

        it('should return null if user already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'password123',
                name: 'Test User',
            };

            // Mock existing user
            (db.selectFrom as any).mockReturnValue({
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
            (db.selectFrom as any).mockReturnValue({
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
            (db.selectFrom as any).mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            (db.selectFrom as any).mockReturnValueOnce({
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
            (bcrypt.compare as any).mockResolvedValue(true);

            const result = await SimpleAuthService.signIn(
                credentials.email,
                credentials.password
            );

            expect(result).toEqual(mockUser);
            expect(bcrypt.compare).toHaveBeenCalledWith(
                credentials.password,
                mockAccount.password
            );
        });

        it('should return null if user not found', async () => {
            // Mock user not found
            (db.selectFrom as any).mockReturnValue({
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
            (db.selectFrom as any).mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            (db.selectFrom as any).mockReturnValueOnce({
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
            (bcrypt.compare as any).mockResolvedValue(false);

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
            (db.selectFrom as any).mockReturnValueOnce({
                selectAll: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            // Mock account lookup
            (db.selectFrom as any).mockReturnValueOnce({
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

            (db.insertInto as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const result = await SimpleAuthService.createSession(mockUser);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(db.insertInto).toHaveBeenCalledWith('sessions');
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

            (db.selectFrom as any).mockReturnValue({
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

            (db.selectFrom as any).mockReturnValue({
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

            (db.selectFrom as any).mockReturnValue({
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

            (db.deleteFrom as any).mockReturnValue({
                where: vi.fn().mockReturnValue({
                    execute: vi.fn().mockResolvedValue(undefined),
                }),
            });

            await expect(
                SimpleAuthService.deleteSession(sessionId)
            ).resolves.toBeUndefined();
            expect(db.deleteFrom).toHaveBeenCalledWith('sessions');
        });

        it('should handle database errors gracefully', async () => {
            const sessionId = 'session-123';

            (db.deleteFrom as any).mockReturnValue({
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
