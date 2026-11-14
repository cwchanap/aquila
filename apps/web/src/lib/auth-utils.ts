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
    { status: 'ok'; user: User | null } | { status: 'error'; error: unknown };

/** Server-known auth state for pages that render differently when auth is down. */
export type AuthState = 'signed-in' | 'signed-out' | 'unavailable';

export function authStateFromSession(result: SessionResult): AuthState {
    if (result.status === 'error') return 'unavailable';
    return result.user ? 'signed-in' : 'signed-out';
}

/** Bounds a page's wait for the session lookup when it has client-side
 *  recheck recovery (reader and stories) before rendering degraded. */
export const SESSION_LOOKUP_TIMEOUT_MS = 1500;

export interface SessionLookupOptions {
    /** When set, a lookup still pending after this many milliseconds
     *  resolves as `{ status: 'error' }` so the page cannot hang on a
     *  stalled pool connection or database response. */
    timeoutMs?: number;
}

/**
 * Get the authenticated user from the request headers (for Astro page
 * frontmatter). Returns a discriminated union so callers can distinguish
 * "auth system is healthy but no session" from "auth system failed to boot."
 */
export async function getSessionUser(
    request: Request,
    options: SessionLookupOptions = {}
): Promise<SessionResult> {
    const lookup = resolveSession(request);
    if (!options.timeoutMs) return lookup;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<SessionResult>(resolve => {
        timer = setTimeout(
            () =>
                resolve({
                    status: 'error',
                    error: new Error('Session lookup timed out'),
                }),
            options.timeoutMs
        );
    });
    return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}

async function resolveSession(request: Request): Promise<SessionResult> {
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
