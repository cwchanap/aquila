import type { APIRoute } from 'astro';

export const ALL: APIRoute = async () => {
    return new Response(
        JSON.stringify({ error: 'Better Auth endpoints have been removed.' }),
        {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }
    );
};
