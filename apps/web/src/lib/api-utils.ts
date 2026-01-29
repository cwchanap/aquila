/**
 * API utility functions for consistent response handling and session validation.
 */
import { logger } from './logger.js';
import { SimpleAuthService, type SimpleSession } from './simple-auth.js';

/**
 * Create a JSON response with proper headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Create a JSON error response.
 */
export function errorResponse(error: string, status: number): Response {
    return jsonResponse({ error }, status);
}

/**
 * Extract session from request cookies.
 * Returns null if no session cookie or session is invalid/expired.
 */
export async function getSessionFromRequest(
    request: Request
): Promise<SimpleSession | null> {
    const cookieHeader = request.headers.get('cookie') || '';
    // Normalize cookie string by replacing multiple spaces with single space
    const cookieStr = cookieHeader
        .split(';')
        .map(c => c.trim().replace(/\s+/g, ' '))
        .find(c => c.startsWith('session='));

    if (!cookieStr) return null;

    // Find the first '=' to get the key-value boundary, then extract the full value
    const firstEqIndex = cookieStr.indexOf('=');
    if (firstEqIndex === -1) return null;

    let sessionId: string;
    try {
        sessionId = decodeURIComponent(cookieStr.substring(firstEqIndex + 1));
    } catch (error) {
        if (error instanceof URIError) {
            logger.warn('Malformed session cookie', { cookieName: 'session' });
            return null;
        }
        throw error;
    }

    if (!sessionId) return null;
    return SimpleAuthService.getSession(sessionId);
}

/**
 * Require a valid session, returning an error response if not authenticated.
 * Use this in API routes that require authentication.
 *
 * @example
 * const { session, error } = await requireSession(request);
 * if (error) return error;
 * // session is now guaranteed to be valid
 */
export async function requireSession(
    request: Request
): Promise<
    { session: SimpleSession; error: null } | { session: null; error: Response }
> {
    const session = await getSessionFromRequest(request);
    if (!session) {
        return { session: null, error: errorResponse('Unauthorized', 401) };
    }
    return { session, error: null };
}
