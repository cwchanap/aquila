import type { APIRoute } from 'astro';

export const ALL: APIRoute = async context => {
    // Lazy-load auth to avoid loading before env vars are available
    const { auth } = await import('../../../lib/auth.js');
    return auth.handler(context.request);
};
