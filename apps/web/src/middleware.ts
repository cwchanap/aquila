import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url } = context;
    const { pathname } = url;

    // Skip middleware for API routes and static assets
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_astro') ||
        pathname.startsWith('/favicon')
    ) {
        return next();
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

    if (response.status === 404) {
        // For zh routes, try routing to en pages
        if (locale === 'zh') {
            const enPathname = pathname.replace(/^\/zh\//, '/en/');
            return new Response(null, {
                status: 302,
                headers: {
                    Location: enPathname || '/en/',
                },
            });
        }

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
