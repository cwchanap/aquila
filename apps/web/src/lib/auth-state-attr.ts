import type { AuthState } from './auth-utils';

/** Server-rendered auth state arrives as a data attribute; anything else —
 *  including a missing attribute — reads as unavailable so clients keep
 *  writes local and re-check the session. */
export function authStateFromAttr(value: string | null): AuthState {
    return value === 'signed-in' ||
        value === 'signed-out' ||
        value === 'unavailable'
        ? value
        : 'unavailable';
}
