import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireSupabaseUser } from '../server';
import { UserRepository } from '../../drizzle/repositories';
import { getSupabaseAuthClient } from '../../auth';

vi.mock('../../drizzle/repositories');
vi.mock('../../auth');

describe('requireSupabaseUser', () => {
    let mockGetUser: any;
    let mockFindOrCreate: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGetUser = vi.fn();
        (getSupabaseAuthClient as any).mockReturnValue({
            auth: {
                getUser: mockGetUser,
            },
        });

        mockFindOrCreate = vi.fn();
        (UserRepository as any).mockImplementation(() => ({
            findOrCreateBySupabaseUserId: mockFindOrCreate,
        }));
    });

    it('returns 401 if no Authorization header', async () => {
        const req = new Request('http://localhost');
        const result = await requireSupabaseUser(req);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });

    it('returns 401 if Supabase returns error', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Bad token' },
        });

        const req = new Request('http://localhost', {
            headers: { Authorization: 'Bearer bad-token' },
        });
        const result = await requireSupabaseUser(req);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });

    it('returns 400 if user has no email', async () => {
        mockGetUser.mockResolvedValue({
            data: {
                user: { id: 'sb-user-1', email: '' }, // Empty email
            },
            error: null,
        });

        const req = new Request('http://localhost', {
            headers: { Authorization: 'Bearer valid-token' },
        });
        const result = await requireSupabaseUser(req);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(400);
    });

    it('returns AuthContext with correct user mapping when valid', async () => {
        const sbUser = {
            id: 'sb-user-123',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
        };
        const appUser = { id: 'app-user-1', supabaseUserId: 'sb-user-123' };

        mockGetUser.mockResolvedValue({ data: { user: sbUser }, error: null });
        mockFindOrCreate.mockResolvedValue(appUser);

        const req = new Request('http://localhost', {
            headers: { Authorization: 'Bearer valid-token' },
        });

        const result = await requireSupabaseUser(req);

        // Not a response, but the context object
        expect(result).not.toBeInstanceOf(Response);

        const context = result as any;
        expect(context.supabaseUserId).toBe('sb-user-123');
        expect(context.appUser).toBe(appUser);

        // CRITICAL: Verify that the repository was called with the ID from the token
        expect(mockFindOrCreate).toHaveBeenCalledWith(
            'sb-user-123',
            expect.objectContaining({
                email: 'test@example.com',
            })
        );
    });
});
