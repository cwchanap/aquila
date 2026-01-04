import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
    select: vi.fn(),
    update: vi.fn(),
}));

const mockBcrypt = vi.hoisted(() => ({
    compare: vi.fn(),
    hash: vi.fn(),
}));

vi.mock('../../../lib/simple-auth.js', () => ({
    SimpleAuthService: {
        getSession,
    },
}));

vi.mock('../../../lib/drizzle/db.js', () => ({
    db: mockDb,
}));

vi.mock('bcryptjs', () => ({
    default: mockBcrypt,
}));

import { POST } from '../simple-auth/change-password';

const makeFormData = (values: Record<string, string | undefined>) => ({
    get: (key: string) => values[key] ?? null,
});

const setupAccountSelect = (account?: { password: string | null }) => {
    const limit = vi.fn().mockResolvedValue(account ? [account] : []);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });
    return { limit, where, from };
};

const setupUpdate = () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockDb.update.mockReturnValue({ set });
    return { set, where };
};

describe('Change Password API', () => {
    beforeEach(() => {
        getSession.mockReset();
        mockDb.select.mockReset();
        mockDb.update.mockReset();
        mockBcrypt.compare.mockReset();
        mockBcrypt.hash.mockReset();
    });

    it('returns 401 when no session cookie is provided', async () => {
        const response = await POST({
            request: { formData: vi.fn() },
            cookies: { get: vi.fn().mockReturnValue(undefined) },
        } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Not authenticated',
        });
        expect(getSession).not.toHaveBeenCalled();
    });

    it('returns 401 when session is invalid', async () => {
        getSession.mockResolvedValue(null);

        const response = await POST({
            request: { formData: vi.fn() },
            cookies: { get: vi.fn().mockReturnValue({ value: 'bad' }) },
        } as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: 'Invalid session',
        });
    });

    it('returns 400 when fields are missing', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'All fields are required',
        });
    });

    it('returns 400 when new passwords do not match', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: 'password123',
                    newPassword: 'newpassword456',
                    confirmPassword: 'different',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'New passwords do not match',
        });
    });

    it('returns 400 when new password is too short', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: 'password123',
                    newPassword: '123',
                    confirmPassword: '123',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'New password must be at least 6 characters',
        });
    });

    it('returns 404 when account is not found', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        setupAccountSelect();

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: 'password123',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: 'Account not found',
        });
    });

    it('returns 400 when current password is incorrect', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        setupAccountSelect({ password: 'hashed-password' });
        mockBcrypt.compare.mockResolvedValue(false);

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Current password is incorrect',
        });
    });

    it('updates the password when input is valid', async () => {
        getSession.mockResolvedValue({ user: { id: 'user-1' } });
        setupAccountSelect({ password: 'hashed-password' });
        const { set } = setupUpdate();
        mockBcrypt.compare.mockResolvedValue(true);
        mockBcrypt.hash.mockResolvedValue('new-hash');

        const request = {
            formData: vi.fn().mockResolvedValue(
                makeFormData({
                    currentPassword: 'password123',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                })
            ),
        } as any;

        const response = await POST({
            request,
            cookies: { get: vi.fn().mockReturnValue({ value: 'session' }) },
        } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            message: 'Password updated successfully',
        });
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                password: 'new-hash',
                updatedAt: expect.any(Date),
            })
        );
    });
});
