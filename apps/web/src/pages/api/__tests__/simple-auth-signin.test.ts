import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/simple-auth.js', () => ({
    SimpleAuthService: {
        signIn,
        createSession,
    },
}));

import { POST } from '../simple-auth/signin';

describe('Signin API', () => {
    beforeEach(() => {
        signIn.mockReset();
        createSession.mockReset();
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
});
