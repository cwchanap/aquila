// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadBookmarks, BookmarksManagerMock } = vi.hoisted(() => {
    const loadBookmarks = vi.fn().mockResolvedValue(undefined);
    const BookmarksManagerMock = vi.fn(
        class {
            loadBookmarks = loadBookmarks;
        }
    );
    return { loadBookmarks, BookmarksManagerMock };
});

vi.mock('../bookmarks-manager', () => ({
    BookmarksManager: BookmarksManagerMock,
}));

import { startBookmarks } from '../bookmarks-bootstrap';

function mountContainer(attrs: Record<string, string>): HTMLElement {
    const container = document.createElement('div');
    container.id = 'bookmarks-container';
    for (const [name, value] of Object.entries(attrs)) {
        container.setAttribute(name, value);
    }
    document.body.appendChild(container);
    return container;
}

afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
});

describe('startBookmarks', () => {
    it('wires the container locale and auth state into BookmarksManager', () => {
        mountContainer({
            'data-locale': 'ja',
            'data-auth-state': 'signed-in',
        });
        startBookmarks();
        expect(BookmarksManagerMock).toHaveBeenCalledWith('ja', 'signed-in');
        expect(loadBookmarks).toHaveBeenCalledOnce();
    });

    it.each([null, 'admin', ''])(
        'reads a %s auth attribute as unavailable',
        value => {
            const container = mountContainer({ 'data-locale': 'en' });
            if (value !== null) {
                container.setAttribute('data-auth-state', value);
            }
            startBookmarks();
            expect(BookmarksManagerMock).toHaveBeenCalledWith(
                'en',
                'unavailable'
            );
        }
    );

    it('falls back to en for a malformed locale attribute', () => {
        mountContainer({ 'data-locale': 'klingon' });
        startBookmarks();
        expect(BookmarksManagerMock).toHaveBeenCalledWith('en', 'unavailable');
    });

    it('warns and does nothing without the container', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        startBookmarks();
        expect(warn).toHaveBeenCalledOnce();
        expect(BookmarksManagerMock).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
