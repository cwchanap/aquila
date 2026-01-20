import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib/simple-auth.js', () => ({
    SimpleAuthService: {
        signIn: vi.fn(),
        createSession: vi.fn(),
    },
}));

import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { POST } from '../simple-auth/signin';

const signIn = vi.mocked(SimpleAuthService.signIn) as unknown as ReturnType<
    typeof vi.fn
>;
const createSession = vi.mocked(
    SimpleAuthService.createSession
) as unknown as ReturnType<typeof vi.fn>;

describe('Signin API', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        signIn.mockReset();
        createSession.mockReset();
        originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
            return;
        }
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('returns 400 when email or password is missing', async () => {
        const request = {
            json: vi.fn().mockResolvedValue({ email: 'user@example.com' }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Missing email or password',
        });
        expect(signIn).not.toHaveBeenCalled();
    });

    it('returns 401 when credentials are invalid', async () => {
        signIn.mockResolvedValue(null);

        const request = {
            json: vi.fn().mockResolvedValue({
                email: 'user@example.com',
                password: 'wrongpassword',
            }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Invalid credentials',
        });
        expect(createSession).not.toHaveBeenCalled();
    });

    it('sets a session cookie on success', async () => {
        signIn.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            username: null,
        });
        createSession.mockResolvedValue('session-456');

        const cookies = { set: vi.fn() };
        const request = {
            json: vi.fn().mockResolvedValue({
                email: 'user@example.com',
                password: 'password123',
            }),
        } as any;

        const response = await POST({ request, cookies } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            },
        });
        expect(createSession).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            username: null,
        });
        expect(cookies.set).toHaveBeenCalledWith(
            'session',
            'session-456',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
            })
        );
    });

    it('normalizes mixed-case email during signin', async () => {
        signIn.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            username: null,
        });
        createSession.mockResolvedValue('session-789');

        const cookies = { set: vi.fn() };
        const request = {
            json: vi.fn().mockResolvedValue({
                email: '  USER@Example.COM  ',
                password: 'password123',
            }),
        } as any;

        const response = await POST({ request, cookies } as any);

        expect(response.status).toBe(200);
        expect(signIn).toHaveBeenCalledWith('user@example.com', 'password123');
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            },
        });
        expect(cookies.set).toHaveBeenCalledWith(
            'session',
            'session-789',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
            })
        );
    });

    describe('session cookie secure flag', () => {
        it('sets secure: true in production', async () => {
            process.env.NODE_ENV = 'production';

            signIn.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-456');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-456',
                expect.objectContaining({
                    secure: true,
                })
            );
        });

        it('sets secure: false in development', async () => {
            process.env.NODE_ENV = 'development';

            signIn.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-456');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-456',
                expect.objectContaining({
                    secure: false,
                })
            );
        });
    });
});
