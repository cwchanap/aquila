import type { APIRoute } from 'astro';
import { logger } from '../../../lib/logger.js';

export const ALL: APIRoute = async context => {
    try {
        // Lazy-load auth to avoid loading before env vars are available
        const { auth } = await import('../../../lib/auth.js');
        const response = await auth.handler(context.request);

        if (response.status >= 500) {
            const contentType = response.headers.get('content-type') || '';
            const isHtml = contentType.includes('text/html');

            if (isHtml) {
                logger.error(
                    'Auth handler returned 5xx HTML response',
                    undefined,
                    {
                        status: response.status,
                        url: context.request.url,
                    }
                );
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
        logger.error('Failed to initialize auth handler', error, {
            url: context.request.url,
        });

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
