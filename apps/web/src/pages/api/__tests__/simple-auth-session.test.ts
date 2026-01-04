import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());
const deleteSession = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession,
        deleteSession,
    },
}));

import { GET, POST } from '../simple-auth/session';

describe('Simple Auth Session API', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        getSession.mockReset();
        deleteSession.mockReset();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('GET /api/simple-auth/session', () => {
        it('returns null user when no session cookie', async () => {
            const response = await GET({
                cookies: { get: vi.fn().mockReturnValue(undefined) },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ user: null });
        });

        it('returns the session user when cookie is present', async () => {
            getSession.mockResolvedValue({
                user: { id: 'user-1', email: 'user@example.com' },
            });

            const response = await GET({
                cookies: { get: vi.fn().mockReturnValue({ value: 'token' }) },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                user: { id: 'user-1', email: 'user@example.com' },
            });
            expect(getSession).toHaveBeenCalledWith('token');
        });

        it('returns null user on errors', async () => {
            getSession.mockRejectedValue(new Error('boom'));

            const response = await GET({
                cookies: { get: vi.fn().mockReturnValue({ value: 'token' }) },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ user: null });
        });
    });

    describe('POST /api/simple-auth/session', () => {
        it('clears session when cookie is present', async () => {
            const cookies = {
                get: vi.fn().mockReturnValue({ value: 'token' }),
                delete: vi.fn(),
            };

            const response = await POST({ cookies } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(deleteSession).toHaveBeenCalledWith('token');
            expect(cookies.delete).toHaveBeenCalledWith('session', {
                path: '/',
            });
        });

        it('clears cookie even when no session id is present', async () => {
            const cookies = {
                get: vi.fn().mockReturnValue(undefined),
                delete: vi.fn(),
            };

            const response = await POST({ cookies } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(deleteSession).not.toHaveBeenCalled();
            expect(cookies.delete).toHaveBeenCalledWith('session', {
                path: '/',
            });
        });

        it('returns 500 on errors', async () => {
            deleteSession.mockRejectedValue(new Error('boom'));

            const cookies = {
                get: vi.fn().mockReturnValue({ value: 'token' }),
                delete: vi.fn(),
            };

            const response = await POST({ cookies } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
        });
    });
});
