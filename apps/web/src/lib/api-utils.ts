/**
 * API utility functions for consistent response handling and session validation.
 */
import type { ZodSchema } from 'zod';
import { auth, type Session } from './auth.js';
import { SimpleAuthService } from './simple-auth.js';
import type { User } from './drizzle/schema.js';

/**
 * Sanitized user type for API responses (excludes sensitive fields).
 */
export interface SanitizedUser {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Sanitize user object for API responses.
 * Removes sensitive fields that should not be exposed.
 */
export function sanitizeUser(user: User): SanitizedUser {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
interface ApiSuccessResponse<T> {
    data: T;
    success: true;
}

/**
 * Create a standardized success JSON response with { success: true, data } wrapper.
 * Use this for new API endpoints that expect the wrapped format.
 */
export function jsonSuccessResponse<T>(data: T, status = 200): Response {
    const body: ApiSuccessResponse<T> = { data, success: true };
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Standard API error response format.
 */
interface ApiErrorResponse {
    error: string;
    errorId?: string;
    success: false;
}

/**
 * Create a JSON response with proper headers.
 * Returns raw data for backward compatibility.
 */
export function jsonResponse<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Create a JSON error response with standardized format.
 */
export function errorResponse(
    error: string,
    status: number,
    errorId?: string
): Response {
    const body: ApiErrorResponse = {
        error,
        success: false,
        ...(errorId && { errorId }),
    };
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Require a valid session, checking both Better Auth and Simple Auth (fallback).
 * Returns an error response if not authenticated.
 * Use this in API routes that require authentication.
 *
 * @example
 * const { session, error } = await requireAuth(request);
 * if (error) return error;
 * // session.user is now guaranteed to be valid
 */
export async function requireAuth(
    request: Request
): Promise<
    { session: Session; error: null } | { session: null; error: Response }
> {
    // First try Better Auth session
    const betterAuthSession = await auth.api.getSession({
        headers: request.headers,
    });
    if (betterAuthSession?.user?.id) {
        return { session: betterAuthSession, error: null };
    }

    // Fallback: Check Simple Auth session cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
        const sessionMatch = cookieHeader.match(/session=([^;]+)/);
        const sessionId = sessionMatch?.[1];
        if (sessionId) {
            const simpleSession = await SimpleAuthService.getSession(sessionId);
            if (simpleSession?.user?.id) {
                // Convert SimpleSession to Better Auth Session shape for compatibility
                const compatSession: Session = {
                    user: {
                        id: simpleSession.user.id,
                        email: simpleSession.user.email,
                        name: simpleSession.user.name,
                        username: simpleSession.user.username,
                        image: null,
                        emailVerified: false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    session: {
                        id: simpleSession.sessionId,
                        userId: simpleSession.user.id,
                        token: simpleSession.sessionId,
                        expiresAt: new Date(
                            Date.now() + 7 * 24 * 60 * 60 * 1000
                        ),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                } as Session;
                return { session: compatSession, error: null };
            }
        }
    }

    return { session: null, error: errorResponse('Unauthorized', 401) };
}

/**
 * Parse and validate request body against a Zod schema.
 * Returns validated data or an error response.
 *
 * @example
 * const { data, error } = await parseBody(request, StoryCreateSchema);
 * if (error) return error;
 * // data is now typed and validated
 */
export async function parseBody<T>(
    request: Request,
    schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return { data: null, error: errorResponse('Malformed JSON', 400) };
    }

    const result = schema.safeParse(body);
    if (!result.success) {
        const message = result.error.issues[0]?.message || 'Validation failed';
        return { data: null, error: errorResponse(message, 400) };
    }
    return { data: result.data, error: null };
}
