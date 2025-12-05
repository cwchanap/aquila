import type { APIRoute } from 'astro';
import { requireSupabaseUser } from '@/lib/auth/server';

export const GET: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        return new Response(JSON.stringify({ user: authResult.appUser }), {
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
