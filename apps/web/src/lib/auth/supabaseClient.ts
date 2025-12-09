import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseEnv() {
    const metaEnv: Record<string, string | undefined> | undefined =
        typeof import.meta !== 'undefined'
            ? (
                  import.meta as unknown as {
                      env?: Record<string, string | undefined>;
                  }
              ).env
            : undefined;

    const nodeEnv: Record<string, string | undefined> | undefined =
        typeof process !== 'undefined' ? process.env : undefined;

    // In Astro/Vite, only PUBLIC_* vars are exposed to the browser. Prefer those
    // on the client, but continue to support plain SUPABASE_* on the server.
    const url =
        metaEnv?.PUBLIC_SUPABASE_URL ??
        metaEnv?.SUPABASE_URL ??
        nodeEnv?.SUPABASE_URL;

    const anonKey =
        metaEnv?.PUBLIC_SUPABASE_ANON_KEY ??
        metaEnv?.SUPABASE_ANON_KEY ??
        nodeEnv?.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error(
            'SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment to use Supabase auth.'
        );
    }

    return { url, anonKey };
}

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        const { url, anonKey } = getSupabaseEnv();
        supabaseClient = createClient(url, anonKey, {
            auth: {
                persistSession: true,
            },
        });
    }

    return supabaseClient;
}
