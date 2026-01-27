import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { logger } from '../../../lib/logger.js';
import { jsonResponse, errorResponse } from '../../../lib/api-utils.js';

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const sessionId = cookies.get('session')?.value;

        if (!sessionId) {
            return jsonResponse({ user: null });
        }

        const session = await SimpleAuthService.getSession(sessionId);

        return jsonResponse({ user: session?.user || null });
    } catch (error) {
        logger.error('Session error', error, {
            endpoint: '/api/simple-auth/session',
        });
        return jsonResponse({ user: null });
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
        logger.error('Logout error', error, {
            endpoint: '/api/simple-auth/session',
        });
        return errorResponse('Internal server error', 500);
    }
};
