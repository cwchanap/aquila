import { describe, it, expect, vi } from 'vitest';
import {
    getSupabaseAuthClient,
    getCurrentSession,
    type SupabaseSession,
} from '../auth';

// Mock internal supabase client helper so tests don't depend on real env vars
const getSession = vi.fn(async () => ({
    data: {
        session: {
            access_token: 'test-token',
            token_type: 'bearer',
            expires_in: 3600,
            user: {
                id: 'user-123',
                email: 'test@example.com',
            },
        },
    },
    error: null,
}));

const mockClient = {
    auth: {
        getSession,
    },
} as unknown as { auth: { getSession: typeof getSession } };

vi.mock('../auth/supabaseClient', () => ({
    getSupabaseClient: vi.fn(() => mockClient),
}));

describe('Supabase auth helpers', () => {
    it('should provide a Supabase client instance', () => {
        const client = getSupabaseAuthClient();
        expect(client).toBeDefined();
    });

    it('should get the current Supabase session', async () => {
        const session: SupabaseSession | null = await getCurrentSession();
        expect(session).not.toBeNull();
        expect(session?.user?.id).toBe('user-123');
        expect(session?.user?.email).toBe('test@example.com');
    });
});
