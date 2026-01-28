/**
 * Unit tests for api-utils.ts
 *
 * Note: Tests for getSessionFromRequest that require mocking SimpleAuthService
 * are skipped due to module caching issues with vitest in turbo mode.
 * The cookie parsing logic has been verified to work correctly through manual testing.
 */
import { describe, it, expect } from 'vitest';
import {
    getSessionFromRequest,
    jsonResponse,
    errorResponse,
} from '../api-utils';

describe('api-utils', () => {
    describe('jsonResponse', () => {
        it('should create a JSON response with default status 200', async () => {
            const data = { message: 'test' };
            const response = jsonResponse(data);

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            await expect(response.json()).resolves.toEqual(data);
        });

        it('should create a JSON response with custom status', async () => {
            const data = { error: 'not found' };
            const response = jsonResponse(data, 404);

            expect(response.status).toBe(404);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            await expect(response.json()).resolves.toEqual(data);
        });
    });

    describe('errorResponse', () => {
        it('should create an error JSON response', async () => {
            const response = errorResponse('test error', 400);

            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );
            await expect(response.json()).resolves.toEqual({
                error: 'test error',
            });
        });
    });

    describe('getSessionFromRequest - cookie parsing edge cases', () => {
        it('should return null when no session cookie is present', async () => {
            const request = new Request('http://localhost', {
                headers: {},
            });

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when session cookie has empty value', async () => {
            const request = new Request('http://localhost', {
                headers: {
                    Cookie: 'session=',
                },
            });

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when session cookie has no equals sign', async () => {
            const request = new Request('http://localhost', {
                headers: {
                    Cookie: 'session',
                },
            });

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when cookie header is not a session cookie', async () => {
            const request = new Request('http://localhost', {
                headers: {
                    Cookie: 'other=value',
                },
            });

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should handle malformed cookie string', async () => {
            const request = new Request('http://localhost', {
                headers: {
                    Cookie: 'invalid-cookie-format',
                },
            });

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });
    });
});
