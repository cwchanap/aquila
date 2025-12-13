import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { AstroGlobal } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';

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

/**
 * Create a Supabase client for server-side use in Astro pages/API routes.
 * Reads and writes auth tokens via cookies for SSR support.
 */
export function createSupabaseServerClient(
    request: Request,
    response: { headers: Headers }
): SupabaseClient {
    const { url, anonKey } = getSupabaseEnv();

    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                const cookieHeader = request.headers.get('cookie') ?? '';
                const cookies: { name: string; value: string }[] = [];

                if (cookieHeader) {
                    const pairs = cookieHeader.split(';');
                    for (const pair of pairs) {
                        const [name, ...rest] = pair.trim().split('=');
                        if (name) {
                            cookies.push({
                                name,
                                value: decodeURIComponent(rest.join('=')),
                            });
                        }
                    }
                }

                return cookies;
            },
            setAll(
                cookiesToSet: {
                    name: string;
                    value: string;
                    options: CookieOptions;
                }[]
            ) {
                for (const { name, value, options } of cookiesToSet) {
                    const cookieStr = serializeCookie(name, value, options);
                    response.headers.append('Set-Cookie', cookieStr);
                }
            },
        },
    });
}

function serializeCookie(
    name: string,
    value: string,
    options: CookieOptions
): string {
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (options.maxAge !== undefined) {
        cookie += `; Max-Age=${options.maxAge}`;
    }
    if (options.domain) {
        cookie += `; Domain=${options.domain}`;
    }
    if (options.path) {
        cookie += `; Path=${options.path}`;
    }
    if (options.httpOnly) {
        cookie += '; HttpOnly';
    }
    if (options.secure) {
        cookie += '; Secure';
    }
    if (options.sameSite) {
        cookie += `; SameSite=${options.sameSite}`;
    }

    return cookie;
}

/**
 * Get the authenticated user from cookies in an Astro page/API context.
 * Returns null if not authenticated.
 */
export async function getServerUser(
    request: Request,
    responseHeaders: Headers
): Promise<User | null> {
    const supabase = createSupabaseServerClient(request, {
        headers: responseHeaders,
    });

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }

    return user;
}

/**
 * Require authentication for an Astro page.
 * Returns a redirect Response if not authenticated, or the user if authenticated.
 */
export async function requireAuthPage(
    astro: AstroGlobal,
    loginPath = '/en/login'
): Promise<Response | User> {
    const responseHeaders = new Headers();
    const user = await getServerUser(astro.request, responseHeaders);

    if (!user) {
        // Return redirect response
        return astro.redirect(loginPath);
    }

    return user;
}
