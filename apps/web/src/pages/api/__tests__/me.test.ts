import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../me';
import * as serverAuth from '@/lib/auth/server';

// Mock the dependencies
vi.mock('@/lib/auth/server', () => ({
    requireSupabaseUser: vi.fn(),
}));

describe('GET /api/me', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 and user data when authenticated', async () => {
        const mockUser = { id: 'app-user-1', supabaseUserId: 'sb-user-1' };
        (serverAuth.requireSupabaseUser as any).mockResolvedValue({
            supabaseUserId: 'sb-user-1',
            email: 'test@example.com',
            appUser: mockUser,
        });

        const request = new Request('http://localhost/api/me', {
            headers: { Authorization: 'Bearer valid-token' },
        });

        const response = await GET({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ user: mockUser });
    });

    it('returns the error response from requireSupabaseUser when unauthenticated', async () => {
        const errorResponse = new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
                status: 401,
            }
        );
        (serverAuth.requireSupabaseUser as any).mockResolvedValue(
            errorResponse
        );

        const request = new Request('http://localhost/api/me');
        const response = await GET({ request } as any);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 500 when an unexpected error occurs', async () => {
        (serverAuth.requireSupabaseUser as any).mockRejectedValue(
            new Error('Boom')
        );

        const request = new Request('http://localhost/api/me', {
            headers: { Authorization: 'Bearer valid-token' },
        });

        const response = await GET({ request } as any);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error' });
    });
});
