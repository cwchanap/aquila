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

vi.mock('../../constants/errorIds.js', () => ({
    ERROR_IDS: { AUTH_SESSION_GET_FAILED: 'AUTH_005' },
}));

import { getSessionUser } from '../auth-utils';
import { auth } from '../auth.js';
import { logger } from '../logger.js';
import { ERROR_IDS } from '../../constants/errorIds.js';

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

            expect(result).toEqual({ status: 'ok', user: mockUser });
            expect(mockGetSession).toHaveBeenCalledOnce();
        });

        it('forwards request.headers as-is to auth.api.getSession', async () => {
            mockGetSession.mockResolvedValue(null as any);
            const request = makeRequest('my-cookie=xyz');

            await getSessionUser(request);

            // auth-utils passes request.headers directly; verify the same
            // Headers object reference is forwarded without modification
            const { headers } = mockGetSession.mock.calls[0][0];
            expect(headers).toBe(request.headers);
        });
    });

    describe('unauthenticated / missing session', () => {
        it('returns { status: "ok", user: null } when session is null', async () => {
            mockGetSession.mockResolvedValue(null as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toEqual({ status: 'ok', user: null });
        });

        it('returns { status: "ok", user: null } when session has no user (undefined)', async () => {
            mockGetSession.mockResolvedValue({ user: undefined } as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toEqual({ status: 'ok', user: null });
        });

        it('returns { status: "ok", user: null } when session object has no user property', async () => {
            mockGetSession.mockResolvedValue({} as any);

            const result = await getSessionUser(makeRequest());

            expect(result).toEqual({ status: 'ok', user: null });
        });
    });

    describe('error handling', () => {
        it('returns { status: "error" } when auth.api.getSession throws', async () => {
            const error = new Error('DB connection failed');
            mockGetSession.mockRejectedValue(error);

            const result = await getSessionUser(makeRequest());

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe(error);
            }
        });

        it('logs the error with AUTH_SESSION_GET_FAILED errorId when auth.api.getSession throws', async () => {
            const error = new Error('Auth service unavailable');
            mockGetSession.mockRejectedValue(error);

            await getSessionUser(makeRequest());

            expect(mockLoggerError).toHaveBeenCalledWith(
                'Failed to retrieve session',
                error,
                { errorId: ERROR_IDS.AUTH_SESSION_GET_FAILED }
            );
        });

        it('returns { status: "error" } when auth throws a non-Error rejection', async () => {
            mockGetSession.mockRejectedValue('string error');

            const result = await getSessionUser(makeRequest());

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('string error');
            }
        });
    });
});
