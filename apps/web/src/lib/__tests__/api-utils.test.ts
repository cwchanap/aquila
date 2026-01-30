/**
 * Unit tests for api-utils.ts
 *
 * Note: Tests for getSessionFromRequest mock SimpleAuthService to avoid DB access.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../simple-auth.js', () => ({
    SimpleAuthService: {
        getSession: vi.fn(),
    },
}));

import { SimpleAuthService } from '../simple-auth.js';
import {
    getSessionFromRequest,
    jsonResponse,
    errorResponse,
} from '../api-utils';

const getSession = vi.mocked(
    SimpleAuthService.getSession
) as unknown as ReturnType<typeof vi.fn>;

/**
 * Helper to create a mock request with a cookie header.
 * Cookie is a restricted header that cannot be set directly on Request,
 * so we mock the headers.get method to return the cookie value.
 */
function createMockRequest(cookieValue: string | null): Request {
    const request = new Request('http://localhost');
    vi.spyOn(request.headers, 'get').mockImplementation((key: string) => {
        if (key.toLowerCase() === 'cookie') {
            return cookieValue;
        }
        return null;
    });
    return request;
}

describe('api-utils', () => {
    beforeEach(() => {
        getSession.mockReset();
    });
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
            getSession.mockResolvedValue(null);
            const request = createMockRequest(null);

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when session cookie has empty value', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('session=');

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when session cookie has no equals sign', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('session');

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should return null when cookie header is not a session cookie', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('other=value');

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should handle malformed cookie string', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('invalid-cookie-format');

            const result = await getSessionFromRequest(request);

            expect(result).toBeNull();
        });

        it('should handle cookie values containing equals sign', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('session=abc=123=xyz');

            const result = await getSessionFromRequest(request);

            // This test verifies that the full value "abc=123=xyz" is extracted,
            // not just "abc". Note: getSessionFromRequest will return null here
            // because SimpleAuthService.getSession will not find a matching session,
            // but the cookie parsing should not throw an error.
            expect(result).toBeNull();
            expect(getSession).toHaveBeenCalledWith('abc=123=xyz');
        });

        it('should handle URL-encoded cookie values', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest('session=hello%20world%21');

            const result = await getSessionFromRequest(request);

            // This test verifies that URL-encoded values are properly decoded.
            // Note: getSessionFromRequest will return null here because
            // SimpleAuthService.getSession will not find a matching session,
            // but the cookie parsing should not throw an error.
            expect(result).toBeNull();
            expect(getSession).toHaveBeenCalledWith('hello world!');
        });

        it('should handle cookie with multiple spaces', async () => {
            getSession.mockResolvedValue(null);
            const request = createMockRequest(
                'other=foo;  session=test123;  another=bar'
            );

            const result = await getSessionFromRequest(request);

            // This test verifies that spaces are normalized and the session
            // cookie is correctly identified and extracted.
            // Note: getSessionFromRequest will return null here because
            // SimpleAuthService.getSession will not find a matching session,
            // but the cookie parsing should not throw an error.
            expect(result).toBeNull();
            expect(getSession).toHaveBeenCalledWith('test123');
        });
    });
});
