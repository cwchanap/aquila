import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error(
            'SUPABASE_URL and SUPABASE_ANON_KEY must be set for logout.'
        );
    }
    return { url, anonKey };
}

export const POST: APIRoute = async ({ request }) => {
    const authHeader =
        request.headers.get('authorization') ||
        request.headers.get('Authorization');

    const token = authHeader?.toLowerCase().startsWith('bearer ')
        ? authHeader.slice('bearer '.length).trim()
        : null;

    try {
        const { url, anonKey } = getEnv();

        if (token) {
            // Create a short-lived client to revoke the session associated with the provided access token.
            const supabase = createClient(url, anonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
                auth: {
                    persistSession: false,
                },
            });

            await supabase.auth.signOut();
        }

        return new Response(
            JSON.stringify({ success: true, cleared: Boolean(token) }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    // Defensive cookie clear for any legacy session names
                    'Set-Cookie':
                        'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
                },
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: (error as Error).message ?? 'Logout failed',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
