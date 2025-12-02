import type { APIRoute } from 'astro';
import { getSupabaseAuthClient } from '@/lib/auth';
import { UserRepository } from '@/lib/drizzle/repositories';

export const GET: APIRoute = async ({ request }) => {
    try {
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
            return new Response(
                JSON.stringify({ error: 'Email is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const repository = new UserRepository();
        const appUser = await repository.findOrCreateBySupabaseUserId(
            supabaseUserId,
            {
                email,
                name:
                    (
                        supabaseUser.user_metadata as Record<
                            string,
                            unknown
                        > | null
                    )?.full_name?.toString() ?? null,
                username: null,
                image:
                    (
                        supabaseUser.user_metadata as Record<
                            string,
                            unknown
                        > | null
                    )?.avatar_url?.toString() ?? null,
            }
        );

        return new Response(JSON.stringify({ user: appUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('GET /api/me error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
