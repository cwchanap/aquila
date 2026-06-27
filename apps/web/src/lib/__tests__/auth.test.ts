import { describe, it, expect, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { auth } from '../auth';
import type { Session, User } from '../auth';

// Mock better-auth
vi.mock('better-auth', () => ({
    betterAuth: vi.fn(() => ({
        $Infer: {
            Session: {
                user: {
                    id: 'string',
                    email: 'string',
                    name: 'string',
                    username: 'string',
                },
            },
        },
    })),
}));

describe('Auth Configuration', () => {
    describe('auth object', () => {
        it('should be defined', () => {
            expect(auth).toBeDefined();
        });

        it('should have expected properties', () => {
            expect(auth).toHaveProperty('$Infer');
            expect(auth.$Infer).toHaveProperty('Session');
        });
    });

    describe('Session type', () => {
        it('should be properly inferred from auth', () => {
            // Since Session is inferred from auth.$Infer.Session, we test that it's defined
            const sessionType: Session = {
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                    emailVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    image: null,
                },
                session: {
                    id: 'session-123',
                    userId: 'user-123',
                    expiresAt: new Date(),
                    token: 'session-token',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ipAddress: '127.0.0.1',
                    userAgent: 'test-agent',
                },
            };

            expect(sessionType).toBeDefined();
            expect(sessionType.user).toBeDefined();
            expect(sessionType.session).toBeDefined();
        });
    });

    describe('User type', () => {
        it('should be properly inferred from auth', () => {
            const userType: User = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                image: null,
            };

            expect(userType).toBeDefined();
            expect(userType.id).toBe('user-123');
            expect(userType.email).toBe('test@example.com');
        });
    });

    describe('provider configuration', () => {
        it('omits the Google social provider when credentials are not set', () => {
            const config = vi.mocked(betterAuth).mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(config).toBeDefined();
            const social = config?.socialProviders as
                | { google?: unknown }
                | undefined;
            // Without GOOGLE_CLIENT_ID/SECRET (test env), the provider is
            // omitted to avoid registering a broken sign-in path.
            expect(social?.google).toBeUndefined();
            expect(config?.emailAndPassword).toBeUndefined();
        });

        it('configures the Google social provider when credentials are present', async () => {
            vi.resetModules();
            vi.mocked(betterAuth).mockClear();
            vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
            vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');

            await import('../auth');

            const config = vi.mocked(betterAuth).mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(config).toBeDefined();
            const social = config?.socialProviders as
                | { google?: { clientId?: string; clientSecret?: string } }
                | undefined;
            expect(social?.google).toBeDefined();
            expect(social?.google?.clientId).toBe('test-client-id');
            expect(social?.google?.clientSecret).toBe('test-client-secret');

            vi.unstubAllEnvs();
        });
    });
});
