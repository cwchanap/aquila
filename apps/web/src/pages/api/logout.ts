import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
    // Clear the session cookie
    return new Response(null, {
        status: 302,
        headers: {
            Location: '/',
            'Set-Cookie':
                'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
        },
    });
};
