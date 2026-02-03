import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../lib/drizzle/repositories.js';
import { logger } from '../../../lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '../../../lib/api-utils.js';
import { UserUpdateSchema } from '../../../lib/schemas.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

/**
 * GET /api/users/[id]
 * Retrieves a user by ID.
 * Users can only access their own record.
 */
export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        // Users can only access their own data
        if (trimmedId !== session.user.id) {
            return errorResponse('Forbidden', 403);
        }

        const userRepository = new UserRepositoryClass();
        const user = await userRepository.findById(trimmedId);

        if (!user) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse(user);
    } catch (error) {
        logger.error('Failed to fetch user', error, {
            endpoint: '/api/users/[id]',
            errorId: ERROR_IDS.REPO_USER_FETCH_FAILED,
            userId: params.id,
        });
        return errorResponse('Failed to fetch user', 500);
    }
};

/**
 * PUT /api/users/[id]
 * Updates a user by ID.
 * Users can only update their own record.
 */
export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        // Users can only update their own data
        if (trimmedId !== session.user.id) {
            return errorResponse('Forbidden', 403);
        }

        const { data, error: validationError } = await parseBody(
            request,
            UserUpdateSchema
        );
        if (validationError) return validationError;

        const updates: { email?: string; username?: string; name?: string } =
            {};
        if (data.email) updates.email = data.email;
        if (data.username) updates.username = data.username;
        if (data.name) updates.name = data.name;

        if (Object.keys(updates).length === 0) {
            return errorResponse('No valid fields to update', 422);
        }

        const userRepository = new UserRepositoryClass();
        const user = await userRepository.update(trimmedId, updates);

        if (!user) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse(user);
    } catch (error) {
        logger.error('Failed to update user', error, {
            endpoint: '/api/users/[id]',
            errorId: ERROR_IDS.REPO_USER_UPDATE_FAILED,
            userId: params.id,
        });
        return errorResponse('Failed to update user', 500);
    }
};

/**
 * DELETE /api/users/[id]
 * Deletes a user by ID.
 * Users can only delete their own record.
 */
export const DELETE: APIRoute = async ({ params, request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        // Users can only delete their own account
        if (trimmedId !== session.user.id) {
            return errorResponse('Forbidden', 403);
        }

        const userRepository = new UserRepositoryClass();
        const deletedUser = await userRepository.delete(trimmedId);

        if (!deletedUser) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse({ deleted: true });
    } catch (error) {
        logger.error('Failed to delete user', error, {
            endpoint: '/api/users/[id]',
            errorId: ERROR_IDS.REPO_USER_DELETE_FAILED,
            userId: params.id,
        });
        return errorResponse('Failed to delete user', 500);
    }
};
