import type { APIRoute } from 'astro';

export const ALL: APIRoute = async context => {
    try {
        // Lazy-load auth to avoid loading before env vars are available
        const { auth } = await import('../../../lib/auth.js');
        const response = await auth.handler(context.request);

        if (response.status >= 500) {
            const contentType = response.headers.get('content-type') || '';
            const isHtml = contentType.includes('text/html');

            if (isHtml) {
                return new Response(
                    JSON.stringify({
                        error: 'Authentication service unavailable',
                    }),
                    {
                        status: 503,
                        headers: {
                            'content-type': 'application/json; charset=utf-8',
                        },
                    }
                );
            }
        }

        return response;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(
                'Failed to initialize auth handler:',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }

        return new Response(
            JSON.stringify({
                error: 'Authentication service unavailable',
            }),
            {
                status: 503,
                headers: {
                    'content-type': 'application/json; charset=utf-8',
                },
            }
        );
    }
};
