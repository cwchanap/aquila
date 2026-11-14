// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const { initialize, ReaderManagerMock } = vi.hoisted(() => {
    const initialize = vi.fn().mockResolvedValue(undefined);
    const ReaderManagerMock = vi.fn(
        class {
            initialize = initialize;
        }
    );
    return { initialize, ReaderManagerMock };
});

vi.mock('../reader-manager', () => ({
    ReaderManager: ReaderManagerMock,
}));

import { startReader } from '../reader-bootstrap';

function mountContainer(attrs: Record<string, string>): HTMLElement {
    const container = document.createElement('div');
    container.id = 'reader-container';
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

describe('startReader', () => {
    it('wires the container locale, auth state, and user id into ReaderManager', () => {
        mountContainer({
            'data-locale': 'zh',
            'data-auth-state': 'signed-in',
            'data-user-id': 'user-1',
        });
        startReader();
        expect(ReaderManagerMock).toHaveBeenCalledWith('zh', undefined, {
            authState: 'signed-in',
            userId: 'user-1',
        });
        expect(initialize).toHaveBeenCalledOnce();
    });

    it.each([null, 'admin', ''])(
        'reads a %s auth attribute as unavailable',
        value => {
            const container = mountContainer({ 'data-locale': 'en' });
            if (value !== null) {
                container.setAttribute('data-auth-state', value);
            }
            startReader();
            expect(ReaderManagerMock).toHaveBeenCalledWith('en', undefined, {
                authState: 'unavailable',
                userId: null,
            });
        }
    );

    it('falls back to en for a malformed locale attribute', () => {
        mountContainer({ 'data-locale': 'klingon' });
        startReader();
        expect(ReaderManagerMock).toHaveBeenCalledWith('en', undefined, {
            authState: 'unavailable',
            userId: null,
        });
    });

    it('warns and does nothing without the container', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        startReader();
        expect(warn).toHaveBeenCalledOnce();
        expect(ReaderManagerMock).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
