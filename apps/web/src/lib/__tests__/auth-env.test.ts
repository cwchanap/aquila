/**
 * Tests for auth.ts covering production environment branches.
 * Uses vi.resetModules() + dynamic imports to test module-level IIFE branches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // Restore test defaults
    process.env.NODE_ENV = 'test';
    process.env.BETTER_AUTH_SECRET = 'test-secret';
    delete process.env.TRUSTED_ORIGINS;
});

describe('auth production environment branches', () => {
    it('throws when TRUSTED_ORIGINS is not set in production', async () => {
        // Clear TRUSTED_ORIGINS and set production mode
        delete process.env.TRUSTED_ORIGINS;
        process.env.NODE_ENV = 'production';
        process.env.BETTER_AUTH_SECRET = 'prod-secret';

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
        process.env.TRUSTED_ORIGINS = 'http://localhost:5090';
        // Clear BETTER_AUTH_SECRET and set production mode
        delete process.env.BETTER_AUTH_SECRET;
        process.env.NODE_ENV = 'production';

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
});
