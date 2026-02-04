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
    errorResponse,
    requireAuth,
    parseBody,
} from '../api-utils';

describe('api-utils', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
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
            expect(json.data).toEqual(data);
            expect(json.success).toBe(true);
        });

        it('should create a JSON response with custom status', async () => {
            const data = { items: [1, 2, 3] };
            const response = jsonResponse(data, 201);

            expect(response.status).toBe(201);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            const json = await response.json();
            expect(json.data).toEqual(data);
            expect(json.success).toBe(true);
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
