/**
 * Tests for auth.ts covering production environment branches.
 * Uses vi.resetModules() + dynamic imports to test module-level IIFE branches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The baseURL / trustedOrigins resolvers deduce from Vercel system vars, so the
// throw-path tests must run with those absent. Clear them before every test;
// tests that exercise the derive path set them explicitly.
beforeEach(() => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
});

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // Restore test defaults
    process.env.NODE_ENV = 'test';
    process.env.BETTER_AUTH_SECRET = 'test-secret';
    delete process.env.TRUSTED_ORIGINS;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
});

describe('auth production environment branches', () => {
    it('throws when TRUSTED_ORIGINS is not set in production', async () => {
        // Clear TRUSTED_ORIGINS and set production mode
        delete process.env.TRUSTED_ORIGINS;
        vi.stubEnv('TRUSTED_ORIGINS', '');
        process.env.NODE_ENV = 'production';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.BETTER_AUTH_URL = 'https://example.com';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(config => {
                // Access trustedOrigins to trigger its IIFE
                void config.trustedOrigins;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));

        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'TRUSTED_ORIGINS must be set in production environment'
        );
    });

    it('throws when BETTER_AUTH_SECRET is not set in production', async () => {
        // Set TRUSTED_ORIGINS so the first check passes
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        // Clear BETTER_AUTH_SECRET and set production mode
        delete process.env.BETTER_AUTH_SECRET;
        process.env.NODE_ENV = 'production';
        process.env.BETTER_AUTH_URL = 'https://example.com';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(config => {
                void config.trustedOrigins;
                void config.secret;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));

        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'BETTER_AUTH_SECRET must be set in production environment'
        );
    });

    it('throws when GOOGLE_CLIENT_ID is not set in production', async () => {
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.BETTER_AUTH_URL = 'https://example.com';
        delete process.env.GOOGLE_CLIENT_ID;
        vi.stubEnv('GOOGLE_CLIENT_ID', '');
        process.env.NODE_ENV = 'production';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(() => ({ $Infer: { Session: { user: {} } } })),
        }));
        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'GOOGLE_CLIENT_ID must be set in production environment'
        );
    });

    it('throws when GOOGLE_CLIENT_SECRET is not set in production', async () => {
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.BETTER_AUTH_URL = 'https://example.com';
        process.env.GOOGLE_CLIENT_ID = 'test-google-id';
        delete process.env.GOOGLE_CLIENT_SECRET;
        vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
        process.env.NODE_ENV = 'production';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(() => ({ $Infer: { Session: { user: {} } } })),
        }));
        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'GOOGLE_CLIENT_SECRET must be set in production environment'
        );
    });

    it('throws when BETTER_AUTH_URL is not set in production', async () => {
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        delete process.env.BETTER_AUTH_URL;
        vi.stubEnv('BETTER_AUTH_URL', '');
        process.env.NODE_ENV = 'production';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(() => ({ $Infer: { Session: { user: {} } } })),
        }));
        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'BETTER_AUTH_URL must be set in production environment'
        );
    });

    it('throws when BETTER_AUTH_URL is localhost in production', async () => {
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.BETTER_AUTH_URL = 'http://localhost:5090';
        process.env.NODE_ENV = 'production';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(() => ({ $Infer: { Session: { user: {} } } })),
        }));
        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'BETTER_AUTH_URL must be a non-local URL in production environment'
        );
    });

    it('throws when BETTER_AUTH_URL is not a valid URL in production', async () => {
        process.env.TRUSTED_ORIGINS = 'https://example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.BETTER_AUTH_URL = 'not-a-url';
        process.env.NODE_ENV = 'production';

        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn(() => ({ $Infer: { Session: { user: {} } } })),
        }));
        vi.resetModules();

        await expect(import('../auth')).rejects.toThrow(
            'BETTER_AUTH_URL must be a valid URL in production environment'
        );
    });

    it('derives baseURL from VERCEL_PROJECT_PRODUCTION_URL when BETTER_AUTH_URL is unset in production', async () => {
        delete process.env.BETTER_AUTH_URL;
        vi.stubEnv('BETTER_AUTH_URL', '');
        process.env.TRUSTED_ORIGINS = 'https://aquila.cwchanap.dev';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.GOOGLE_CLIENT_ID = 'test-google-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquila.cwchanap.dev';
        process.env.NODE_ENV = 'production';

        let captured: { baseURL?: string } = {};
        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn((config: { baseURL?: string }) => {
                captured = config;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));
        vi.resetModules();

        await import('../auth');

        expect(captured.baseURL).toBe('https://aquila.cwchanap.dev');
    });

    it('derives trustedOrigins from Vercel URLs when TRUSTED_ORIGINS is unset in production', async () => {
        process.env.BETTER_AUTH_URL = 'https://aquila.cwchanap.dev';
        delete process.env.TRUSTED_ORIGINS;
        vi.stubEnv('TRUSTED_ORIGINS', '');
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.GOOGLE_CLIENT_ID = 'test-google-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquila.cwchanap.dev';
        process.env.VERCEL_URL = 'aquila-abc123.vercel.app';
        process.env.NODE_ENV = 'production';

        let captured: { trustedOrigins?: string[] } = {};
        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn((config: { trustedOrigins?: string[] }) => {
                captured = config;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));
        vi.resetModules();

        await import('../auth');

        expect(captured.trustedOrigins).toEqual([
            'https://aquila.cwchanap.dev',
            'https://aquila-abc123.vercel.app',
        ]);
    });

    it('prefers import.meta.env.BETTER_AUTH_URL over process.env in production', async () => {
        process.env.BETTER_AUTH_URL = 'https://from-process-env.example.com';
        // Simulate a Vite-injected env var taking priority over process.env.
        const ime = import.meta.env as Record<string, string | undefined>;
        ime.BETTER_AUTH_URL = 'https://from-import-meta.example.com';
        process.env.TRUSTED_ORIGINS = 'https://from-import-meta.example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.GOOGLE_CLIENT_ID = 'test-google-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
        process.env.NODE_ENV = 'production';

        let captured: { baseURL?: string } = {};
        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn((config: { baseURL?: string }) => {
                captured = config;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));
        vi.resetModules();

        try {
            await import('../auth');
            expect(captured.baseURL).toBe(
                'https://from-import-meta.example.com'
            );
        } finally {
            delete ime.BETTER_AUTH_URL;
        }
    });

    it('prefers import.meta.env.TRUSTED_ORIGINS over process.env in production', async () => {
        process.env.BETTER_AUTH_URL = 'https://aquila.cwchanap.dev';
        process.env.TRUSTED_ORIGINS = 'https://from-process-env.example.com';
        const ime = import.meta.env as Record<string, string | undefined>;
        ime.TRUSTED_ORIGINS = 'https://from-import-meta.example.com';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';
        process.env.GOOGLE_CLIENT_ID = 'test-google-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
        process.env.NODE_ENV = 'production';

        let captured: { trustedOrigins?: string[] } = {};
        vi.doMock('better-auth', () => ({
            betterAuth: vi.fn((config: { trustedOrigins?: string[] }) => {
                captured = config;
                return { $Infer: { Session: { user: {} } } };
            }),
        }));
        vi.resetModules();

        try {
            await import('../auth');
            expect(captured.trustedOrigins).toEqual([
                'https://from-import-meta.example.com',
            ]);
        } finally {
            delete ime.TRUSTED_ORIGINS;
        }
    });
});
