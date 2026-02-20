import { logger } from './logger.js';

/**
 * Get the authenticated user from the request headers (for Astro page frontmatter).
 * Returns the user object or null if not authenticated.
 */
export async function getSessionUser(request: Request) {
    try {
        const { auth } = await import('./auth.js');
        const session = await auth.api.getSession({
            headers: request.headers,
        });
        return session?.user ?? null;
    } catch (error) {
        logger.error('Failed to retrieve session', error);
        return null;
    }
}
