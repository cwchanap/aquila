import type {
    SupabaseClient,
    Session as SupabaseSession,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './auth/supabaseClient';

export type { SupabaseSession };

export function getSupabaseAuthClient(): SupabaseClient {
    return getSupabaseClient();
}

export async function getCurrentSession(): Promise<SupabaseSession | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) {
        throw error;
    }
    return data.session ?? null;
}

export async function getCurrentUser(): Promise<unknown | null> {
    const session = await getCurrentSession();
    if (!session) {
        return null;
    }

    const token = session.access_token;
    if (!token) {
        return null;
    }

    const startTime = performance.now();
    const response = await fetch('/api/me', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    const endTime = performance.now();

    if (!response.ok) {
        // If server error, throw so the UI can handle it (show error message instead of redirecting to login loop)
        if (response.status >= 500) {
            console.error(
                `[AuthLatency] /api/me failed: ${Math.round(endTime - startTime)}ms (Status: ${response.status})`
            );
            throw new Error(
                `Auth server error: ${response.status} ${response.statusText}`
            );
        }
        // For 401/403, return null (not authenticated)
        return null;
    }

    console.log(
        `[AuthLatency] /api/me success: ${Math.round(endTime - startTime)}ms`
    );
    const responseClone = response.clone();
    try {
        const json = (await response.json()) as { user?: unknown };
        return json.user ?? null;
    } catch (err) {
        let rawBody = '[unavailable]';
        try {
            rawBody = await responseClone.text();
        } catch (bodyErr) {
            console.error(
                'Failed to read /api/me response body after JSON parse error:',
                bodyErr
            );
        }
        console.error(
            'Failed to parse /api/me JSON:',
            err,
            '\nRaw body:',
            rawBody
        );
        return null;
    }
}

export class AuthenticationError extends Error {
    constructor(message = 'Not authenticated') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export async function authorizedFetch(
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<Response> {
    const session = await getCurrentSession();
    if (!session?.access_token) {
        throw new AuthenticationError();
    }

    const headers = new Headers(init.headers ?? {});
    if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    return fetch(input, {
        ...init,
        headers,
    });
}
