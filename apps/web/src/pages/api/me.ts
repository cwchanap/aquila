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
        const correlationId = crypto.randomUUID?.() ?? Date.now().toString();
        const errorName =
            error && typeof error === 'object' && 'name' in error
                ? (error as { name?: string }).name
                : undefined;
        const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
        console.error(
            JSON.stringify({
                msg: 'GET /api/me error',
                correlationId,
                errorName,
                errorMessage,
            })
        );
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
