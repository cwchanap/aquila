/**
 * Additional tests for auth-client.ts covering different environment configurations.
 * Uses vi.resetModules() + dynamic imports to test module-level getBaseURL() branches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
});

describe('auth-client getBaseURL branches', () => {
    it('uses PUBLIC_AUTH_URL when it is set', async () => {
        vi.stubEnv('PUBLIC_AUTH_URL', 'https://auth.example.com');

        // Mock better-auth/client so createAuthClient captures the baseURL arg
        const createAuthClient = vi.fn(() => ({
            signIn: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            useSession: vi.fn(),
        }));
        vi.doMock('better-auth/client', () => ({ createAuthClient }));

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: 'https://auth.example.com',
            })
        );
    });

    it('defaults to localhost:5090 when PUBLIC_AUTH_URL is not set in dev', async () => {
        // Ensure PUBLIC_AUTH_URL is not set
        vi.stubEnv('PUBLIC_AUTH_URL', '');

        const createAuthClient = vi.fn(() => ({
            signIn: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            useSession: vi.fn(),
        }));
        vi.doMock('better-auth/client', () => ({ createAuthClient }));

        vi.resetModules();
        await import('../auth-client');

        expect(createAuthClient).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: 'http://localhost:5090',
            })
        );
    });

    it('throws when PUBLIC_AUTH_URL is not set in production', async () => {
        vi.stubEnv('PUBLIC_AUTH_URL', '');
        vi.stubEnv('PROD', 'true');

        const createAuthClient = vi.fn(() => ({
            signIn: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            useSession: vi.fn(),
        }));
        vi.doMock('better-auth/client', () => ({ createAuthClient }));

        vi.resetModules();

        await expect(import('../auth-client')).rejects.toThrow(
            'PUBLIC_AUTH_URL must be set in production environment'
        );
    });
});
