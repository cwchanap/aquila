import { isLocale } from '@aquila/stories/translations';
import { authStateFromAttr } from './auth-state-attr';
import { BookmarksManager } from './bookmarks-manager';

/** Mounts the bookmarks manager on the container, wiring its server-rendered
 *  data attributes (locale, auth state) into BookmarksManager. */
export function startBookmarks(containerId = 'bookmarks-container'): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Bookmarks container element not found');
        return;
    }
    const attr = container.getAttribute('data-locale');
    const locale = isLocale(attr) ? attr : 'en';
    const authState = authStateFromAttr(
        container.getAttribute('data-auth-state')
    );
    const manager = new BookmarksManager(locale, authState);
    void manager
        .loadBookmarks()
        .catch(error =>
            console.error('Bookmarks initialization failed', error)
        );
}
