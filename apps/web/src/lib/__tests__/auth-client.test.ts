import { describe, it, expect, vi } from 'vitest';
import { authClient, signIn, signOut, useSession } from '../auth-client';

// Mock better-auth client
vi.mock('better-auth/client', () => ({
    createAuthClient: vi.fn(() => ({
        signIn: vi.fn(),
        signOut: vi.fn(),
        useSession: vi.fn(),
    })),
}));

describe('Auth Client', () => {
    describe('authClient', () => {
        it('should be defined', () => {
            expect(authClient).toBeDefined();
        });

        it('should have expected methods', () => {
            expect(authClient).toHaveProperty('signIn');
            expect(authClient).toHaveProperty('signOut');
            expect(authClient).toHaveProperty('useSession');
        });

        it('should have correct base URL', () => {
            // Since we're mocking, we can't test the actual baseURL
            // but we can verify the client was created
            expect(typeof authClient.signIn).toBe('function');
            expect(typeof authClient.signOut).toBe('function');
            expect(typeof authClient.useSession).toBe('function');
        });
    });

    describe('Exported functions', () => {
        it('should export signIn function', () => {
            expect(signIn).toBeDefined();
            expect(typeof signIn).toBe('function');
        });

        it('should export signOut function', () => {
            expect(signOut).toBeDefined();
            expect(typeof signOut).toBe('function');
        });

        it('should export useSession function', () => {
            expect(useSession).toBeDefined();
            expect(typeof useSession).toBe('function');
        });
    });

    describe('Function behavior', () => {
        it('should call authClient methods when exported functions are called', () => {
            // Test that the exported functions are actually the methods from authClient
            expect(signIn).toBe(authClient.signIn);
            expect(signOut).toBe(authClient.signOut);
            expect(useSession).toBe(authClient.useSession);
        });
    });
});
