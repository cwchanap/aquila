import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url } = context;
    const { pathname } = url;

    // Skip middleware for API routes
    if (pathname.startsWith('/api/')) {
        return next();
    }

    const pathParts = pathname.split('/').filter(Boolean);
    const locale = pathParts[0];

    if (locale && ['en', 'zh'].includes(locale)) {
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
