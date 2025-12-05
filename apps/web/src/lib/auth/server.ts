import type { User } from '../drizzle/schema';
import { UserRepository } from '../drizzle/repositories';
import { getSupabaseAuthClient } from '../auth';

export interface AuthContext {
    supabaseUserId: string;
    email: string;
    appUser: User;
}

export async function requireSupabaseUser(
    request: Request
): Promise<AuthContext | Response> {
    const authHeader =
        request.headers.get('authorization') ||
        request.headers.get('Authorization');

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.slice('bearer '.length).trim();
    if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabaseUser = data.user;
    const supabaseUserId = supabaseUser.id;
    const email = supabaseUser.email ?? '';

    if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const repository = new UserRepository();
    const appUser = await repository.findOrCreateBySupabaseUserId(
        supabaseUserId,
        {
            email,
            name:
                (
                    supabaseUser.user_metadata as Record<string, unknown> | null
                )?.full_name?.toString() ?? null,
            username: null,
            image:
                (
                    supabaseUser.user_metadata as Record<string, unknown> | null
                )?.avatar_url?.toString() ?? null,
        }
    );

    return {
        supabaseUserId,
        email,
        appUser,
    };
}
