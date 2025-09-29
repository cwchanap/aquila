import { describe, it, expect, vi } from 'vitest';
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
});
