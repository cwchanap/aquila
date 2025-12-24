import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient, type CookieOptions } from '@supabase/ssr';

let browserClient: SupabaseClient | null = null;

export interface SupabaseCookieContext {
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string, options?: CookieOptions) => void;
    delete?: (name: string, options?: CookieOptions) => void;
    remove?: (name: string, options?: CookieOptions) => void;
}

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
    return getSupabaseClientWithContext();
}

export function getSupabaseClientWithContext(
    cookieContext?: SupabaseCookieContext
): SupabaseClient {
    const { url, anonKey } = getSupabaseEnv();

    // SSR/framework context: use provided cookie APIs (never singleton)
    if (cookieContext) {
        const remove = cookieContext.remove ?? cookieContext.delete;
        if (!remove) {
            throw new Error(
                'SupabaseCookieContext must provide either remove() or delete()'
            );
        }

        return createBrowserClient(url, anonKey, {
            isSingleton: false,
            cookies: {
                getAll() {
                    return cookieContext.getAll();
                },
                setAll(cookiesToSet) {
                    for (const { name, value, options } of cookiesToSet) {
                        if (value === null || value === undefined) {
                            remove(name, options);
                        } else {
                            cookieContext.set(name, value, options);
                        }
                    }
                },
            },
        });
    }

    // Default behavior
    if (typeof window !== 'undefined') {
        if (!browserClient) {
            // Browser: store session in cookies so SSR can authenticate requests.
            browserClient = createBrowserClient(url, anonKey);
        }
        return browserClient;
    }

    return createClient(url, anonKey, {
        auth: {
            persistSession: false,
        },
    });
}
