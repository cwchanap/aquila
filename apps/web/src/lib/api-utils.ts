/**
 * API utility functions for consistent response handling and session validation.
 */
import type { ZodSchema } from 'zod';
import { auth, type Session } from './auth.js';

/**
 * Standard API success response format.
 */
interface ApiSuccessResponse<T> {
    data: T;
    success: true;
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
 * Create a JSON response with proper headers and standardized format.
 */
export function jsonResponse<T>(data: T, status = 200): Response {
    const body: ApiSuccessResponse<T> = { data, success: true };
    return new Response(JSON.stringify(body), {
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
 * Require a valid Better Auth session, returning an error response if not authenticated.
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
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
        return { session: null, error: errorResponse('Unauthorized', 401) };
    }
    return { session, error: null };
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
