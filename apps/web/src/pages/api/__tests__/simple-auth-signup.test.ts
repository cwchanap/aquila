import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib/simple-auth.js', () => ({
    SimpleAuthService: {
        signUp: vi.fn(),
        createSession: vi.fn(),
    },
}));

vi.mock('../../../lib/drizzle/db.js', () => ({
    db: {
        select: vi.fn(),
    },
}));

import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { db } from '../../../lib/drizzle/db.js';
import { POST } from '../simple-auth/signup';

const signUp = vi.mocked(SimpleAuthService.signUp) as unknown as ReturnType<
    typeof vi.fn
>;
const createSession = vi.mocked(
    SimpleAuthService.createSession
) as unknown as ReturnType<typeof vi.fn>;
const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> };

describe('Signup API', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        signUp.mockReset();
        createSession.mockReset();
        mockDb.select.mockReset();
        originalNodeEnv = process.env.NODE_ENV;

        const limit = vi.fn().mockResolvedValue([]);
        const from = vi.fn().mockReturnValue({ limit });
        mockDb.select.mockReturnValue({ from });
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('returns 400 when required fields are missing', async () => {
        const request = {
            json: vi.fn().mockResolvedValue({
                email: '',
                password: '',
                name: '',
            }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Missing required fields',
        });
        expect(signUp).not.toHaveBeenCalled();
    });

    it('returns 400 when email is already in use', async () => {
        signUp.mockResolvedValue(null);

        const request = {
            json: vi.fn().mockResolvedValue({
                email: 'duplicate@example.com',
                password: 'password123',
                name: 'Duplicate User',
            }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Email already in use',
        });
        expect(createSession).not.toHaveBeenCalled();
    });

    it('creates a session cookie on successful signup', async () => {
        signUp.mockResolvedValue({
            id: 'user-1',
            email: 'USER@Example.COM',
            name: 'User',
            username: null,
        });
        createSession.mockResolvedValue('session-123');

        const cookies = { set: vi.fn() };
        const request = {
            json: vi.fn().mockResolvedValue({
                email: '  USER@Example.COM  ',
                password: 'password123',
                name: 'User',
            }),
        } as any;

        const response = await POST({ request, cookies } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'user-1',
                email: 'USER@Example.COM',
                name: 'User',
                username: null,
            },
        });
        expect(signUp).toHaveBeenCalledWith(
            'USER@Example.COM',
            'password123',
            'User'
        );
        expect(createSession).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'USER@Example.COM',
            name: 'User',
            username: null,
        });
        expect(cookies.set).toHaveBeenCalledWith(
            'session',
            'session-123',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
                path: '/',
            })
        );
    });

    describe('session cookie secure flag', () => {
        it('sets secure: true in production', async () => {
            process.env.NODE_ENV = 'production';

            signUp.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-123');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                    name: 'User',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-123',
                expect.objectContaining({
                    secure: true,
                })
            );
        });

        it('sets secure: false in development', async () => {
            process.env.NODE_ENV = 'development';

            signUp.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-123');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                    name: 'User',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-123',
                expect.objectContaining({
                    secure: false,
                })
            );
        });
    });
});
