/**
 * Tests for auth-client.ts getBaseURL(): in the browser the client calls its
 * own origin (same-origin), so it works on any deployment without a baked-in
 * PUBLIC_AUTH_URL; outside the browser (SSR) it falls back to PUBLIC_AUTH_URL.
 * Uses vi.resetModules() + dynamic imports to re-evaluate module-level getBaseURL().
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

function mockCreateAuthClient() {
    const createAuthClient = vi.fn(() => ({
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        useSession: vi.fn(),
    }));
    vi.doMock('better-auth/client', () => ({ createAuthClient }));
    return createAuthClient;
}

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('auth-client getBaseURL', () => {
    it('uses the current origin in the browser (same-origin)', async () => {
        vi.stubGlobal('window', {
            location: { origin: 'https://aquila.example.com' },
        });
        const createAuthClient = mockCreateAuthClient();

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://aquila.example.com' })
        );
    });

    it('ignores PUBLIC_AUTH_URL in the browser', async () => {
        vi.stubEnv('PUBLIC_AUTH_URL', 'https://pinned.example.com');
        vi.stubGlobal('window', {
            location: { origin: 'https://current-preview.vercel.app' },
        });
        const createAuthClient = mockCreateAuthClient();

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: 'https://current-preview.vercel.app',
            })
        );
    });

    it('falls back to PUBLIC_AUTH_URL when there is no window (SSR)', async () => {
        vi.stubGlobal('window', undefined);
        vi.stubEnv('PUBLIC_AUTH_URL', 'https://auth.example.com');
        const createAuthClient = mockCreateAuthClient();

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://auth.example.com' })
        );
    });

    it('falls back to localhost:5090 when there is no window and PUBLIC_AUTH_URL is unset', async () => {
        vi.stubGlobal('window', undefined);
        vi.stubEnv('PUBLIC_AUTH_URL', '');
        const createAuthClient = mockCreateAuthClient();

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'http://localhost:5090' })
        );
    });

    it('does not throw in production when PUBLIC_AUTH_URL is unset (browser uses origin)', async () => {
        vi.stubEnv('PUBLIC_AUTH_URL', '');
        vi.stubEnv('PROD', true);
        vi.stubGlobal('window', {
            location: { origin: 'https://prod.example.com' },
        });
        const createAuthClient = mockCreateAuthClient();

        vi.resetModules();
        await expect(import('../auth-client')).resolves.toBeDefined();
        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://prod.example.com' })
        );
    });
});
