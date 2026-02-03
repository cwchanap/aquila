import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../lib/drizzle/repositories.js';
import { logger } from '../../lib/logger.js';
import {
    requireAuth,
    jsonResponse,
    errorResponse,
} from '../../lib/api-utils.js';
import { ERROR_IDS } from '../../constants/errorIds.js';

/**
 * GET /api/users
 * Returns the authenticated user's own data.
 * Users can only access their own information.
 */
export const GET: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        const userRepository = new UserRepositoryClass();
        const user = await userRepository.findById(session.user.id);

        if (!user) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse(user);
    } catch (error) {
        logger.error('Failed to fetch user', error, {
            endpoint: '/api/users',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
        });
        return errorResponse('Failed to fetch user', 500);
    }
};

// Note: POST (user creation) is handled by Better Auth via /api/auth/[...all]
// Direct user creation through this endpoint is no longer supported.
