import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module before importing auth-utils
vi.mock('../auth.js', () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

// Mock the logger
vi.mock('../logger.js', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

import { getSessionUser } from '../auth-utils';
import { auth } from '../auth.js';
import { logger } from '../logger.js';

const mockGetSession = vi.mocked(auth.api.getSession);
const mockLoggerError = vi.mocked(logger.error);

function makeRequest(cookie?: string): Request {
    return new Request('http://localhost:5090/', {
        headers: cookie ? { cookie } : {},
    });
}

describe('getSessionUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('authenticated session', () => {
        it('returns the user when a valid session exists', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                image: null,
            };
            mockGetSession.mockResolvedValue({
                user: mockUser,
                session: {
                    id: 'session-abc',
                    userId: 'user-123',
                    expiresAt: new Date(),
                    token: 'tok',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ipAddress: null,
                    userAgent: null,
                },
            } as any);

            const result = await getSessionUser(makeRequest('session=abc'));

            expect(result).toEqual(mockUser);
            expect(mockGetSession).toHaveBeenCalledOnce();
        });

        it('passes request headers to auth.api.getSession', async () => {
            mockGetSession.mockResolvedValue(null as any);
            const request = makeRequest('my-cookie=xyz');

            await getSessionUser(request);

            const callArgs = mockGetSession.mock.calls[0][0];
            expect(callArgs).toHaveProperty('headers');
        });
    });

    describe('unauthenticated / missing session', () => {
        it('returns null when session is null', async () => {
            mockGetSession.mockResolvedValue(null as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toBeNull();
        });

        it('returns null when session has no user (undefined)', async () => {
            mockGetSession.mockResolvedValue({ user: undefined } as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toBeNull();
        });

        it('returns null when session object has no user property', async () => {
            mockGetSession.mockResolvedValue({} as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toBeNull();
        });
    });

    describe('error handling', () => {
        it('returns null when auth.api.getSession throws', async () => {
            mockGetSession.mockRejectedValue(new Error('DB connection failed'));

            const result = await getSessionUser(makeRequest());

            expect(result).toBeNull();
        });

        it('logs the error when auth.api.getSession throws', async () => {
            const error = new Error('Auth service unavailable');
            mockGetSession.mockRejectedValue(error);

            await getSessionUser(makeRequest());

            expect(mockLoggerError).toHaveBeenCalledWith(
                'Failed to retrieve session',
                error
            );
        });

        it('returns null when auth throws a non-Error rejection', async () => {
            mockGetSession.mockRejectedValue('string error');

            const result = await getSessionUser(makeRequest());

            expect(result).toBeNull();
        });
    });
});
