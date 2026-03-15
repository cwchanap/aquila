/**
 * Unit tests for api-utils.ts
 *
 * Tests the core API utility functions including authentication helpers,
 * request parsing, and response formatting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Must use vi.hoisted() for variables used in vi.mock()
const { mockGetSession } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
}));

vi.mock('../auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

import {
    jsonResponse,
    jsonSuccessResponse,
    errorResponse,
    requireAuth,
    parseBody,
    sanitizeUser,
} from '../api-utils';

describe('api-utils', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
    });

    describe('sanitizeUser', () => {
        it('returns only the whitelisted safe fields', () => {
            const fullUser = {
                id: 'user-1',
                email: 'test@example.com',
                username: 'tester',
                name: 'Test User',
                image: 'https://example.com/avatar.png',
                emailVerified: true,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-06-01'),
                // Hypothetical sensitive fields that should be stripped
                passwordHash: 'secret-hash',
                twoFactorSecret: 'totp-secret',
            } as any;

            const result = sanitizeUser(fullUser);

            expect(result).toEqual({
                id: 'user-1',
                email: 'test@example.com',
                username: 'tester',
                name: 'Test User',
                image: 'https://example.com/avatar.png',
                emailVerified: true,
                createdAt: fullUser.createdAt,
                updatedAt: fullUser.updatedAt,
            });

            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('twoFactorSecret');
        });

        it('preserves null optional fields', () => {
            const user = {
                id: 'user-2',
                email: 'other@example.com',
                username: null,
                name: null,
                image: null,
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any;

            const result = sanitizeUser(user);

            expect(result.username).toBeNull();
            expect(result.name).toBeNull();
            expect(result.image).toBeNull();
            expect(result.emailVerified).toBe(false);
        });
    });

    describe('jsonSuccessResponse', () => {
        it('wraps data with success:true and default status 200', async () => {
            const response = jsonSuccessResponse({ message: 'ok' });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            const json = await response.json();
            expect(json).toEqual({ success: true, data: { message: 'ok' } });
        });

        it('accepts a custom status code', async () => {
            const response = jsonSuccessResponse({ id: 'new-1' }, 201);

            expect(response.status).toBe(201);
            const json = await response.json();
            expect(json.success).toBe(true);
            expect(json.data).toEqual({ id: 'new-1' });
        });

        it('works with array data', async () => {
            const response = jsonSuccessResponse([1, 2, 3]);

            const json = await response.json();
            expect(json).toEqual({ success: true, data: [1, 2, 3] });
        });
    });

    describe('jsonResponse', () => {
        it('should create a JSON response with default status 200', async () => {
            const data = { message: 'test' };
            const response = jsonResponse(data);

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            const json = await response.json();
            // jsonResponse returns raw data for backward compatibility
            expect(json).toEqual(data);
        });

        it('should create a JSON response with custom status', async () => {
            const data = { items: [1, 2, 3] };
            const response = jsonResponse(data, 201);

            expect(response.status).toBe(201);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            const json = await response.json();
            // jsonResponse returns raw data for backward compatibility
            expect(json).toEqual(data);
        });
    });

    describe('errorResponse', () => {
        it('should create an error JSON response', async () => {
            const response = errorResponse('test error', 400);

            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            const json = await response.json();
            expect(json.error).toBe('test error');
            expect(json.success).toBe(false);
        });

        it('should include errorId when provided', async () => {
            const response = errorResponse('server error', 500, 'ERR_001');

            expect(response.status).toBe(500);
            const json = await response.json();
            expect(json.error).toBe('server error');
            expect(json.errorId).toBe('ERR_001');
            expect(json.success).toBe(false);
        });
    });

    describe('requireAuth', () => {
        it('should return session when authenticated', async () => {
            const mockSession = {
                user: { id: 'user-1', email: 'test@example.com' },
            };
            mockGetSession.mockResolvedValue(mockSession);
            const request = new Request('http://localhost/api/test');

            const result = await requireAuth(request);

            expect(result.session).toEqual(mockSession);
            expect(result.error).toBeNull();
        });

        it('should return 401 error when not authenticated', async () => {
            mockGetSession.mockResolvedValue(null);
            const request = new Request('http://localhost/api/test');

            const result = await requireAuth(request);

            expect(result.session).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.status).toBe(401);
            const json = await result.error?.json();
            expect(json.error).toBe('Unauthorized');
        });

        it('should return 401 error when session has no user id', async () => {
            mockGetSession.mockResolvedValue({ user: {} });
            const request = new Request('http://localhost/api/test');

            const result = await requireAuth(request);

            expect(result.session).toBeNull();
            expect(result.error?.status).toBe(401);
        });

        it('should return 503 when auth service throws', async () => {
            mockGetSession.mockRejectedValue(new Error('Auth service down'));
            const request = new Request('http://localhost/api/test');

            const result = await requireAuth(request);

            expect(result.session).toBeNull();
            expect(result.error?.status).toBe(503);
            const json = await result.error?.json();
            expect(json.error).toBe('Authentication service unavailable');
        });
    });

    describe('errorResponse with custom headers', () => {
        it('includes custom headers in the response', async () => {
            const response = errorResponse('Rate limited', 429, undefined, {
                'Retry-After': '60',
            });

            expect(response.status).toBe(429);
            expect(response.headers.get('Retry-After')).toBe('60');
            const json = await response.json();
            expect(json.error).toBe('Rate limited');
        });

        it('does not include errorId field when not provided', async () => {
            const response = errorResponse('Not found', 404);
            const json = await response.json();
            expect(json).not.toHaveProperty('errorId');
        });
    });

    describe('parseBody', () => {
        const TestSchema = z.object({
            name: z.string().min(1, 'Name is required'),
            age: z.number().min(0, 'Age must be non-negative'),
        });

        it('should parse valid JSON body', async () => {
            const request = new Request('http://localhost/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test', age: 25 }),
            });

            const result = await parseBody(request, TestSchema);

            expect(result.error).toBeNull();
            expect(result.data).toEqual({ name: 'Test', age: 25 });
        });

        it('should return error for malformed JSON', async () => {
            const request = new Request('http://localhost/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not valid json',
            });

            const result = await parseBody(request, TestSchema);

            expect(result.data).toBeNull();
            expect(result.error?.status).toBe(400);
            const json = await result.error?.json();
            expect(json.error).toBe('Malformed JSON');
        });

        it('should return validation error for invalid data', async () => {
            const request = new Request('http://localhost/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '', age: 25 }),
            });

            const result = await parseBody(request, TestSchema);

            expect(result.data).toBeNull();
            expect(result.error?.status).toBe(400);
            const json = await result.error?.json();
            expect(json.error).toBe('Name is required');
        });

        it('should return validation error for missing fields', async () => {
            const request = new Request('http://localhost/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test' }),
            });

            const result = await parseBody(request, TestSchema);

            expect(result.data).toBeNull();
            expect(result.error?.status).toBe(400);
        });
    });
});
