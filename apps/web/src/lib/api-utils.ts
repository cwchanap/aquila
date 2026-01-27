/**
 * API utility functions for consistent response handling and session validation.
 */
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
    const sessionId = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='))
        ?.split('=')[1];

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
