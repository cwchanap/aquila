import { describe, it, expect } from 'vitest';
import {
    createMockCookies,
    createMockAPIContext,
    createAuthenticatedContext,
    createJsonRequest,
    createRequest,
    parseApiResponse,
} from '../api-context';

describe('api-context test utilities', () => {
    describe('createMockCookies', () => {
        it('returns an object with get, set, delete, has, headers methods', () => {
            const cookies = createMockCookies();
            expect(typeof cookies.get).toBe('function');
            expect(typeof cookies.set).toBe('function');
            expect(typeof cookies.delete).toBe('function');
            expect(typeof cookies.has).toBe('function');
            expect(typeof cookies.headers).toBe('function');
        });

        it('returns undefined for a key that has not been set', () => {
            const cookies = createMockCookies();
            expect(cookies.get('missing')).toBeUndefined();
        });

        it('stores and retrieves a cookie value', () => {
            const cookies = createMockCookies();
            cookies.set('token', 'abc123');
            const result = cookies.get('token');
            expect(result).toEqual({ value: 'abc123' });
        });

        it('deletes a cookie', () => {
            const cookies = createMockCookies();
            cookies.set('session', 'xyz');
            cookies.delete('session');
            expect(cookies.get('session')).toBeUndefined();
        });

        it('has returns true for a set cookie', () => {
            const cookies = createMockCookies();
            cookies.set('present', 'value');
            expect(cookies.has('present')).toBe(true);
        });

        it('has returns false for a missing cookie', () => {
            const cookies = createMockCookies();
            expect(cookies.has('missing')).toBe(false);
        });

        it('headers returns a Headers instance', () => {
            const cookies = createMockCookies();
            const result = cookies.headers();
            expect(result).toBeInstanceOf(Headers);
        });
    });

    describe('createMockAPIContext', () => {
        it('creates a context with default properties', () => {
            const ctx = createMockAPIContext();
            expect(ctx.params).toEqual({});
            expect(ctx.request).toBeInstanceOf(Request);
            expect(ctx.url).toBeInstanceOf(URL);
            expect(ctx.locals).toEqual({});
        });

        it('merges overrides into the context', () => {
            const ctx = createMockAPIContext({ params: { id: '42' } });
            expect(ctx.params).toEqual({ id: '42' });
        });

        it('redirect returns a redirect response with status and location', () => {
            const ctx = createMockAPIContext();
            const response = ctx.redirect('/login');
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(302);
            expect(
                response.headers.get('location') ??
                    response.headers.get('Location')
            ).toContain('/login');
        });
    });

    describe('createAuthenticatedContext', () => {
        it('creates a context with session.user containing the given userId', () => {
            const ctx = createAuthenticatedContext('user-123');
            expect(ctx.locals.session.user.id).toBe('user-123');
            expect(ctx.locals.session.user.email).toBe('test@example.com');
            expect(ctx.locals.session.user.name).toBe('Test User');
        });

        it('merges locals overrides', () => {
            const ctx = createAuthenticatedContext('user-456', {
                locals: { extra: 'data' },
            });
            expect(ctx.locals.session.user.id).toBe('user-456');
            expect(ctx.locals.extra).toBe('data');
        });
    });

    describe('createJsonRequest', () => {
        it('creates a POST request with JSON content-type', () => {
            const req = createJsonRequest({ name: 'Alice' });
            expect(req.method).toBe('POST');
            expect(req.headers.get('content-type')).toBe('application/json');
        });

        it('serializes the body as JSON', async () => {
            const payload = { key: 'value', num: 42 };
            const req = createJsonRequest(payload);
            const body = await req.json();
            expect(body).toEqual(payload);
        });

        it('allows additional headers to be merged', () => {
            const req = createJsonRequest(
                {},
                { headers: { Authorization: 'Bearer token' } }
            );
            expect(req.headers.get('authorization')).toBe('Bearer token');
        });
    });

    describe('createRequest', () => {
        it('defaults to GET method', () => {
            const req = createRequest();
            expect(req.method).toBe('GET');
        });

        it('uses the specified method', () => {
            const req = createRequest('DELETE');
            expect(req.method).toBe('DELETE');
        });

        it('uses the specified URL', () => {
            const req = createRequest('GET', 'http://example.com/api/test');
            expect(req.url).toBe('http://example.com/api/test');
        });
    });

    describe('parseApiResponse', () => {
        it('parses a success response with raw data', async () => {
            const response = new Response(
                JSON.stringify({ id: 1, name: 'Test' }),
                {
                    status: 200,
                }
            );
            const result = await parseApiResponse(response);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ id: 1, name: 'Test' });
            }
        });

        it('parses a wrapped success response { success: true, data }', async () => {
            const response = new Response(
                JSON.stringify({ success: true, data: { id: 2 } }),
                { status: 200 }
            );
            const result = await parseApiResponse(response);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ id: 2 });
            }
        });

        it('parses an error response { success: false, error }', async () => {
            const response = new Response(
                JSON.stringify({ success: false, error: 'Not found' }),
                { status: 404 }
            );
            const result = await parseApiResponse(response);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe('Not found');
            }
        });

        it('throws on non-object JSON', async () => {
            const response = new Response(JSON.stringify('just a string'), {
                status: 200,
            });
            await expect(parseApiResponse(response)).rejects.toThrow(
                'Invalid API response: expected object'
            );
        });

        it('throws on null JSON', async () => {
            const response = new Response(JSON.stringify(null), {
                status: 200,
            });
            await expect(parseApiResponse(response)).rejects.toThrow(
                'Invalid API response: expected object'
            );
        });

        it('throws when success=false but error field is missing', async () => {
            const response = new Response(JSON.stringify({ success: false }), {
                status: 400,
            });
            await expect(parseApiResponse(response)).rejects.toThrow(
                'Invalid API response: success=false requires "error" string property'
            );
        });

        it('throws when data fails validation', async () => {
            const response = new Response(
                JSON.stringify({ id: 'not-a-number' }),
                { status: 200 }
            );
            const isNumber = (d: unknown): d is number => typeof d === 'number';
            await expect(parseApiResponse(response, isNumber)).rejects.toThrow(
                'Invalid API response: data failed validation'
            );
        });

        it('passes validation when data is valid', async () => {
            const validResponse = new Response(
                JSON.stringify({ success: true, data: 42 }),
                { status: 200 }
            );
            const isNumber = (d: unknown): d is number => typeof d === 'number';
            const result = await parseApiResponse(validResponse, isNumber);
            expect(result.success).toBe(true);
        });
    });
});
