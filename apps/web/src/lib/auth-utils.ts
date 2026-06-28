import { logger } from './logger.js';
import { ERROR_IDS } from '../constants/errorIds.js';
import type { User } from './auth.js';

/**
 * Result of resolving the authenticated user from request headers.
 *
 * - `{ status: 'ok', user }` — auth system is healthy; `user` is the
 *   authenticated user or `null` if the visitor is anonymous.
 * - `{ status: 'error', error }` — auth failed to boot or the session
 *   lookup threw (e.g. missing secrets, DB unreachable). Callers should
 *   surface a degraded-state banner rather than silently rendering
 *   logged-out, so a production auth outage is visible to the user.
 */
export type SessionResult =
    | { status: 'ok'; user: User | null }
    | { status: 'error'; error: unknown };

/**
 * Get the authenticated user from the request headers (for Astro page
 * frontmatter). Returns a discriminated union so callers can distinguish
 * "auth system is healthy but no session" from "auth system failed to boot."
 */
export async function getSessionUser(request: Request): Promise<SessionResult> {
    try {
        const { auth } = await import('./auth.js');
        const session = await auth.api.getSession({
            headers: request.headers,
        });
        return { status: 'ok', user: session?.user ?? null };
    } catch (error) {
        logger.error('Failed to retrieve session', error, {
            errorId: ERROR_IDS.AUTH_SESSION_GET_FAILED,
        });
        return { status: 'error', error };
    }
}
