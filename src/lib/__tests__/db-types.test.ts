import { describe, it, expect } from 'vitest';
import type {
    Database,
    UserTable,
    SessionTable,
    AccountTable,
    VerificationTokenTable,
    CharacterSetupTable,
} from '../db-types';
import { StoryId } from '../story-types';

describe('Database Types', () => {
    describe('Database interface', () => {
        it('should have all required table properties', () => {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const database: Database = {
                users: {} as any,
                sessions: {} as any,
                accounts: {} as any,
                verificationTokens: {} as any,
                characterSetups: {} as any,
            };
            /* eslint-enable @typescript-eslint/no-explicit-any */

            expect(database).toHaveProperty('users');
            expect(database).toHaveProperty('sessions');
            expect(database).toHaveProperty('accounts');
            expect(database).toHaveProperty('verificationTokens');
            expect(database).toHaveProperty('characterSetups');
        });
    });

    describe('UserTable interface', () => {
        it('should have all required user properties', () => {
            const user: UserTable = {
                id: 'user-123',
                email: 'test@example.com',
                username: 'testuser',
                name: 'Test User',
                image: 'https://example.com/avatar.jpg',
                emailVerified: '2024-01-01T00:00:00.000Z',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(user.id).toBe('user-123');
            expect(user.email).toBe('test@example.com');
            expect(user.username).toBe('testuser');
            expect(user.name).toBe('Test User');
            expect(user.image).toBe('https://example.com/avatar.jpg');
            expect(user.emailVerified).toBe('2024-01-01T00:00:00.000Z');
            expect(user.createdAt).toBe('2024-01-01T00:00:00.000Z');
            expect(user.updatedAt).toBe('2024-01-01T00:00:00.000Z');
        });

        it('should allow null values for optional fields', () => {
            const user: UserTable = {
                id: 'user-123',
                email: 'test@example.com',
                username: null,
                name: null,
                image: null,
                emailVerified: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(user.username).toBeNull();
            expect(user.name).toBeNull();
            expect(user.image).toBeNull();
            expect(user.emailVerified).toBeNull();
        });
    });

    describe('SessionTable interface', () => {
        it('should have all required session properties', () => {
            const session: SessionTable = {
                id: 'session-123',
                userId: 'user-123',
                expiresAt: '2024-01-01T00:00:00.000Z',
                token: 'session-token',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0...',
            };

            expect(session.id).toBe('session-123');
            expect(session.userId).toBe('user-123');
            expect(session.expiresAt).toBe('2024-01-01T00:00:00.000Z');
            expect(session.token).toBe('session-token');
            expect(session.ipAddress).toBe('127.0.0.1');
            expect(session.userAgent).toBe('Mozilla/5.0...');
        });

        it('should allow null values for optional fields', () => {
            const session: SessionTable = {
                id: 'session-123',
                userId: 'user-123',
                expiresAt: '2024-01-01T00:00:00.000Z',
                token: 'session-token',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                ipAddress: null,
                userAgent: null,
            };

            expect(session.ipAddress).toBeNull();
            expect(session.userAgent).toBeNull();
        });
    });

    describe('AccountTable interface', () => {
        it('should have all required account properties', () => {
            const account: AccountTable = {
                id: 'account-123',
                userId: 'user-123',
                accountId: 'account-id',
                providerId: 'google',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                idToken: 'id-token',
                accessTokenExpiresAt: '2024-01-01T00:00:00.000Z',
                refreshTokenExpiresAt: '2024-01-01T00:00:00.000Z',
                scope: 'read write',
                password: 'hashed-password',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(account.id).toBe('account-123');
            expect(account.userId).toBe('user-123');
            expect(account.accountId).toBe('account-id');
            expect(account.providerId).toBe('google');
            expect(account.password).toBe('hashed-password');
        });

        it('should allow null values for optional fields', () => {
            const account: AccountTable = {
                id: 'account-123',
                userId: 'user-123',
                accountId: 'account-id',
                providerId: 'google',
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                scope: null,
                password: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(account.accessToken).toBeNull();
            expect(account.refreshToken).toBeNull();
            expect(account.idToken).toBeNull();
            expect(account.accessTokenExpiresAt).toBeNull();
            expect(account.refreshTokenExpiresAt).toBeNull();
            expect(account.scope).toBeNull();
            expect(account.password).toBeNull();
        });
    });

    describe('VerificationTokenTable interface', () => {
        it('should have all required verification token properties', () => {
            const token: VerificationTokenTable = {
                id: 'token-123',
                identifier: 'user@example.com',
                token: 'verification-token',
                expires: '2024-01-01T00:00:00.000Z',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(token.id).toBe('token-123');
            expect(token.identifier).toBe('user@example.com');
            expect(token.token).toBe('verification-token');
            expect(token.expires).toBe('2024-01-01T00:00:00.000Z');
        });
    });

    describe('CharacterSetupTable interface', () => {
        it('should have all required character setup properties', () => {
            const setup: CharacterSetupTable = {
                id: 'setup-123',
                userId: 'user-123',
                characterName: 'Hero',
                storyId: StoryId.TRAIN_ADVENTURE,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(setup.id).toBe('setup-123');
            expect(setup.userId).toBe('user-123');
            expect(setup.characterName).toBe('Hero');
            expect(setup.storyId).toBe('train_adventure');
        });
    });
});
