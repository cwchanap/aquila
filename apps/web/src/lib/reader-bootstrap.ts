import { isLocale } from '@aquila/stories/translations';
import type { AuthState } from './auth-utils';
import { ReaderManager } from './reader-manager';

/** Server-rendered auth state arrives as a data attribute; anything else —
 *  including a missing attribute — reads as unavailable so the reader keeps
 *  writes local to the anonymous store and re-checks the session. */
function authStateFromAttr(value: string | null): AuthState {
    return value === 'signed-in' ||
        value === 'signed-out' ||
        value === 'unavailable'
        ? value
        : 'unavailable';
}

/** Mounts the reader on the container, wiring its server-rendered data
 *  attributes (locale, auth state) into ReaderManager. */
export function startReader(containerId = 'reader-container'): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Reader container element not found');
        return;
    }
    const attr = container.getAttribute('data-locale');
    const locale = isLocale(attr) ? attr : 'en';
    const authState = authStateFromAttr(
        container.getAttribute('data-auth-state')
    );
    const userId = container.getAttribute('data-user-id');
    const manager = new ReaderManager(locale, undefined, {
        authState,
        userId,
    });
    void manager
        .initialize()
        .catch(error => console.error('Reader initialization failed', error));
}
