import { isLocale } from '@aquila/stories/translations';
import { authStateFromAttr } from './auth-state-attr';
import { ReaderManager } from './reader-manager';

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
