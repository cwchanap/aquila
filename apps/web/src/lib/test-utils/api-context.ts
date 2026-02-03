/**
 * Typed test utilities for API route testing.
 * Provides proper typing to reduce `as any` usage in tests.
 */
import type { APIContext, AstroCookies } from 'astro';
import { vi } from 'vitest';

/**
 * Create a mock AstroCookies object.
 */
export function createMockCookies(): AstroCookies {
    const store = new Map<string, { value: string; options?: object }>();
    return {
        get: vi.fn((key: string) => {
            const entry = store.get(key);
            return entry ? { value: entry.value } : undefined;
        }),
        set: vi.fn((key: string, value: string, options?: object) => {
            store.set(key, { value, options });
        }),
        delete: vi.fn((key: string) => {
            store.delete(key);
        }),
        has: vi.fn((key: string) => store.has(key)),
        headers: vi.fn(() => new Headers()),
    } as unknown as AstroCookies;
}

/**
 * Create a mock APIContext with proper types.
 */
export function createMockAPIContext(
    overrides: Partial<APIContext> = {}
): APIContext {
    const url = new URL('http://localhost:5090');
    return {
        params: {},
        request: new Request(url),
        cookies: createMockCookies(),
        url,
        site: url,
        locals: {},
        redirect: (path: string) => Response.redirect(new URL(path, url)),
        ...overrides,
    } as APIContext;
}

/**
 * Create a mock authenticated APIContext.
 */
export function createAuthenticatedContext(
    userId: string,
    overrides: Partial<APIContext> = {}
): APIContext {
    return createMockAPIContext({
        ...overrides,
        locals: {
            session: {
                user: {
                    id: userId,
                    name: 'Test User',
                    email: 'test@example.com',
                },
            },
            ...overrides.locals,
        },
    });
}

/**
 * Create a request with JSON body.
 */
export function createJsonRequest(
    body: unknown,
    options: RequestInit = {}
): Request {
    return new Request('http://localhost:5090', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        },
        body: JSON.stringify(body),
        ...options,
    });
}

/**
 * Create a request with specific method.
 */
export function createRequest(
    method: string = 'GET',
    url: string = 'http://localhost:5090',
    options: RequestInit = {}
): Request {
    return new Request(url, {
        method,
        ...options,
    });
}

/**
 * Parse response JSON with proper success/error typing.
 */
export async function parseApiResponse<T = unknown>(
    response: Response
): Promise<{ data: T; success: true } | { error: string; success: false }> {
    return response.json();
}
