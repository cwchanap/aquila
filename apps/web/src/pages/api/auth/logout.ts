import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_SIGNOUT_TIMEOUT_MS = 10_000;

function createFetchWithTimeout(timeoutMs: number): typeof fetch {
    return async (input, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(input, {
                ...init,
                signal: init?.signal
                    ? (AbortSignal.any([
                          init.signal,
                          controller.signal,
                      ]) as AbortSignal)
                    : controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }
    };
}

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

        let revoked = false;
        let revokeError: 'timeout' | 'failed' | null = null;

        if (token) {
            // Create a short-lived client to revoke the session associated with the provided access token.
            const supabase = createClient(url, anonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    fetch: createFetchWithTimeout(SUPABASE_SIGNOUT_TIMEOUT_MS),
                },
                auth: {
                    persistSession: false,
                },
            });

            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    revokeError = 'failed';
                } else {
                    revoked = true;
                }
            } catch (error) {
                revokeError =
                    error instanceof DOMException && error.name === 'AbortError'
                        ? 'timeout'
                        : 'failed';
            }
        }

        const cookieFlags = [
            'Path=/',
            'HttpOnly',
            'SameSite=Strict',
            'Max-Age=0',
        ];
        if (process.env.NODE_ENV !== 'development') {
            cookieFlags.push('Secure');
        }

        return new Response(
            JSON.stringify({
                success: true,
                cleared: Boolean(token),
                revoked,
                revokeError,
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    // Defensive cookie clear for any legacy session names
                    'Set-Cookie': `session=; ${cookieFlags.join('; ')}`,
                },
            }
        );
    } catch (error) {
        console.error('Logout handler failed:', error);
        return new Response(JSON.stringify({ error: 'Logout failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
