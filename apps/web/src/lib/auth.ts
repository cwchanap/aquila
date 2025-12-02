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

    const response = await fetch('/api/me', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        return null;
    }

    const json = (await response.json()) as { user?: unknown };
    return json.user ?? null;
}
