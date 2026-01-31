import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { logger } from '../../../lib/logger.js';
import { jsonResponse, errorResponse } from '../../../lib/api-utils.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const sessionId = cookies.get('session')?.value;

        if (!sessionId) {
            return jsonResponse({ user: null });
        }

        const session = await SimpleAuthService.getSession(sessionId);

        return jsonResponse({ user: session?.user || null });
    } catch (error) {
        logger.error('Failed to retrieve session', error, {
            endpoint: '/api/simple-auth/session',
            errorId: ERROR_IDS.AUTH_SESSION_GET_FAILED,
        });
        return errorResponse('Failed to retrieve session', 500);
    }
};

export const POST: APIRoute = async ({ cookies }) => {
    try {
        const sessionId = cookies.get('session')?.value;

        if (sessionId) {
            await SimpleAuthService.deleteSession(sessionId);
        }

        // Clear session cookie
        cookies.delete('session', { path: '/' });

        return jsonResponse({ success: true });
    } catch (error) {
        logger.error('Failed to delete session', error, {
            endpoint: '/api/simple-auth/session',
            errorId: ERROR_IDS.AUTH_SESSION_DELETE_FAILED,
        });
        return errorResponse('Failed to delete session', 500);
    }
};
