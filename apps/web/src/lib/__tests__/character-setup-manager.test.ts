// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterSetupManager } from '../character-setup-manager';

function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length() {
            return data.size;
        },
        clear: () => data.clear(),
        getItem: key => data.get(key) ?? null,
        key: i => [...data.keys()][i] ?? null,
        removeItem: key => void data.delete(key),
        setItem: (key, value) => void data.set(key, String(value)),
    };
}

function setupDom(attrs: Record<string, string> = {}): {
    root: HTMLElement;
    form: HTMLFormElement;
    input: HTMLInputElement;
    button: HTMLButtonElement;
} {
    document.body.innerHTML = `
        <div id="setup-root" ${Object.entries({
            'data-story': 'train_adventure',
            'data-authed': 'false',
            'data-auth-uncertain': 'false',
            'data-locale': 'en',
            ...attrs,
        })
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ')}>
            <form id="setup-form">
                <input id="character-name" />
                <button type="submit">Start Adventure</button>
            </form>
        </div>`;
    return {
        root: document.getElementById('setup-root') as HTMLElement,
        form: document.getElementById('setup-form') as HTMLFormElement,
        input: document.getElementById('character-name') as HTMLInputElement,
        button: document.querySelector(
            'button[type="submit"]'
        ) as HTMLButtonElement,
    };
}

function response(status: number, body: unknown = null): Response {
    // A real Response so json() derives from the body the way fetch
    // does — a missing body must reject instead of resolving null.
    return new Response(JSON.stringify(body), {
        status,
        statusText: `status ${status}`,
    });
}

function denyLocalStorage(): () => void {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
            throw new Error('storage disabled');
        },
    });
    return () => {
        if (original) {
            Object.defineProperty(window, 'localStorage', original);
        }
    };
}

describe('CharacterSetupManager', () => {
    let navigate: ReturnType<typeof vi.fn>;
    let storage: Storage;

    function managerFor(
        attrs: Record<string, string> = {}
    ): ReturnType<typeof setupDom> {
        const dom = setupDom(attrs);
        new CharacterSetupManager(dom.root, { navigate, storage }).initialize();
        return dom;
    }

    async function submit(
        input: HTMLInputElement,
        name: string
    ): Promise<void> {
        input.value = name;
        document
            .getElementById('setup-form')!
            .dispatchEvent(new Event('submit', { cancelable: true }));
        // The handler is async; let its whole fetch/await chain settle.
        for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(0);
    }

    beforeEach(() => {
        vi.useFakeTimers();
        navigate = vi.fn();
        storage = memoryStorage();
        window.history.replaceState(
            {},
            '',
            '/en/story/setup?story=train_adventure'
        );
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        localStorage.clear();
        document.body.innerHTML = '';
    });

    it('prefills the locally saved character name', () => {
        storage.setItem(
            'aquila:character:train_adventure',
            JSON.stringify({ characterName: 'Aria' })
        );
        const { input } = managerFor();
        expect(input.value).toBe('Aria');
    });

    it('ignores a corrupt locally saved character name', () => {
        storage.setItem('aquila:character:train_adventure', '{not json');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { input } = managerFor();
        expect(input.value).toBe('');
        expect(warn).toHaveBeenCalled();
    });

    it('uses the browser storage and location by default', async () => {
        const { input } = setupDom();
        new CharacterSetupManager(
            document.getElementById('setup-root') as HTMLElement
        ).initialize();
        await submit(input, 'Aria');
        expect(localStorage.getItem('aquila:character:train_adventure')).toBe(
            JSON.stringify({ characterName: 'Aria' })
        );
    });

    it('saves locally and navigates for a signed-out visitor', async () => {
        const { input } = managerFor();
        await submit(input, 'Aria');

        expect(storage.getItem('aquila:character:train_adventure')).toBe(
            JSON.stringify({ characterName: 'Aria' })
        );
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('posts to the account endpoint for a signed-in visitor', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(response(200, { ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-authed': 'true' });
        await submit(input, 'Aria');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/character-setup');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            characterName: 'Aria',
            storyId: 'train_adventure',
        });
        expect(storage.getItem('aquila:character:train_adventure')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('falls back to the local save when the uncertain-auth probe is 401', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(response(401, { error: 'unauthorized' }));
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        // The probe confirms signed-out: only one request, then the local
        // save path continues unchanged.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(
            '/api/character-setup?storyId=train_adventure'
        );
        expect(storage.getItem('aquila:character:train_adventure')).toBe(
            JSON.stringify({ characterName: 'Aria' })
        );
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('redirects without overwriting when a setup already exists', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
            if (String(url).startsWith('/api/character-setup?')) {
                return response(200, { characterName: 'Existing' });
            }
            return response(200, { ok: true });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        // The probe found a saved setup — navigating straight to the story
        // instead of POSTing a rename over it.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(storage.getItem('aquila:character:train_adventure')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('posts when the uncertain-auth probe finds no saved setup', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
            if (String(url).startsWith('/api/character-setup?')) {
                return response(200, null);
            }
            return response(200, { ok: true });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe('/api/character-setup');
        expect(fetchMock.mock.calls[1][1].method).toBe('POST');
        expect(storage.getItem('aquila:character:train_adventure')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('posts when the uncertain-auth probe answers an empty body', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
            if (String(url).startsWith('/api/character-setup?')) {
                // A missing setup once serialized to no body at all —
                // an unparseable 200 must still reach the POST.
                return new Response(null, { status: 200 });
            }
            return response(200, { ok: true });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe('/api/character-setup');
        expect(fetchMock.mock.calls[1][1].method).toBe('POST');
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('stops before the POST when the uncertain-auth probe fails', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
            if (String(url).startsWith('/api/character-setup?')) {
                return response(500, { error: 'boom' });
            }
            return response(200, { ok: true });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { input, button } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        // A 500 cannot say whether a setup exists — the POST could rename a
        // saved setup, so nothing is sent and the form re-enables instead.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(button.disabled).toBe(false);
        expect(storage.getItem('aquila:character:train_adventure')).toBeNull();
    });

    it('saves locally when the uncertain-auth POST recheck answers 401', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: unknown) => {
            if (String(url).startsWith('/api/character-setup?')) {
                return response(200, null);
            }
            return response(401, { error: 'unauthorized' });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { input } = managerFor({ 'data-auth-uncertain': 'true' });
        await submit(input, 'Aria');

        expect(storage.getItem('aquila:character:train_adventure')).toBe(
            JSON.stringify({ characterName: 'Aria' })
        );
        expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
    });

    it('re-enables the form and alerts when the account save fails', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(response(500, { error: 'boom' }));
        vi.stubGlobal('fetch', fetchMock);
        const { input, button } = managerFor({ 'data-authed': 'true' });
        await submit(input, 'Aria');

        expect(alert).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe('Start Adventure');
    });

    it('reports a failed save when the error body is not JSON', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'not json',
        } as Response);
        vi.stubGlobal('fetch', fetchMock);
        const { input, button } = managerFor({ 'data-authed': 'true' });
        await submit(input, 'Aria');

        expect(alert).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(button.disabled).toBe(false);
    });

    it('still saves to the account when storage access is denied', async () => {
        const restoreStorage = denyLocalStorage();
        try {
            const fetchMock = vi
                .fn()
                .mockResolvedValue(response(200, { ok: true }));
            vi.stubGlobal('fetch', fetchMock);
            const dom = setupDom({ 'data-authed': 'true' });
            new CharacterSetupManager(dom.root, {
                navigate: url => navigate(url),
            }).initialize();
            await submit(dom.input, 'Aria');

            // Denied storage access must not take the constructor down
            // with it — the account save never needed local storage.
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe('/api/character-setup');
            expect(navigate).toHaveBeenCalledWith('/en/story/train_adventure');
            expect(alert).not.toHaveBeenCalled();
        } finally {
            restoreStorage();
        }
    });

    it('reports the failed save when storage is denied and signed out', async () => {
        const restoreStorage = denyLocalStorage();
        try {
            const dom = setupDom();
            new CharacterSetupManager(dom.root, {
                navigate: url => navigate(url),
            }).initialize();
            await submit(dom.input, 'Aria');

            // No account save exists to fall back on — the failed local
            // save surfaces instead of navigating on unsaved.
            expect(alert).toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
            expect(dom.button.disabled).toBe(false);
        } finally {
            restoreStorage();
        }
    });

    it('blocks an empty name before any request', async () => {
        const { input } = managerFor();
        await submit(input, '   ');

        expect(alert).toHaveBeenCalled();
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });
});
