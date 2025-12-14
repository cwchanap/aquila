import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';

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
        return null;
    }

    return { url, anonKey };
}

function parseCookieHeader(header: string) {
    const cookies: { name: string; value: string }[] = [];
    if (!header) return cookies;

    const pairs = header.split(';');
    for (const pair of pairs) {
        const [name, ...rest] = pair.trim().split('=');
        if (!name) continue;
        cookies.push({ name, value: decodeURIComponent(rest.join('=')) });
    }

    return cookies;
}

export const onRequest = defineMiddleware(async (context, next) => {
    const { url } = context;
    const { pathname } = url;

    // Skip middleware for API routes
    if (pathname.startsWith('/api/')) {
        return next();
    }

    const supabaseEnv = getSupabaseEnv();
    if (supabaseEnv) {
        const cookieHeader = context.request.headers.get('cookie') ?? '';
        const cookieJar = new Map(
            parseCookieHeader(cookieHeader).map(cookie => [
                cookie.name,
                cookie.value,
            ])
        );

        const supabase = createServerClient(
            supabaseEnv.url,
            supabaseEnv.anonKey,
            {
                cookies: {
                    getAll() {
                        return Array.from(cookieJar.entries()).map(
                            ([name, value]) => ({
                                name,
                                value,
                            })
                        );
                    },
                    setAll(cookiesToSet) {
                        for (const { name, value, options } of cookiesToSet) {
                            cookieJar.set(name, value);
                            if (!value) {
                                context.cookies.delete(name, options);
                            } else {
                                context.cookies.set(name, value, options);
                            }
                        }
                    },
                },
            }
        );

        try {
            await supabase.auth.getSession();
        } catch {
            // Ignore session refresh errors in middleware.
        }
    }

    const pathParts = pathname.split('/').filter(Boolean);
    const locale = pathParts[0];

    if (locale && ['en', 'zh'].includes(locale)) {
        context.locals ??= {};
        (context.locals as { currentLocale?: string }).currentLocale = locale;
    } else {
        // No locale or invalid, redirect to default locale
        return new Response(null, {
            status: 302,
            headers: {
                Location: '/en/',
            },
        });
    }

    const response = await next();

    for (const value of context.cookies.headers()) {
        response.headers.append('Set-Cookie', value);
    }

    if (response.status === 404) {
        // Fallback to default locale
        return new Response(null, {
            status: 302,
            headers: {
                Location: '/en/',
            },
        });
    }

    return response;
});
