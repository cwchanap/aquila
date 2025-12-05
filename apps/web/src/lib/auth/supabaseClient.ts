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

    const url = metaEnv?.SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = metaEnv?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

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
