import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../lib/drizzle/repositories.js';
import { logger } from '../../../lib/logger.js';
import { jsonResponse, errorResponse } from '../../../lib/api-utils.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

/**
 * GET /api/users/[id]
 * Retrieves a single user by ID.
 */
export const GET: APIRoute = async ({ params }) => {
    try {
        const userRepository = new UserRepositoryClass();
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        const user = await userRepository.findById(trimmedId);

        if (!user) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse(user);
    } catch (error) {
        logger.error('Failed to fetch user', error, {
            endpoint: '/api/users/[id]',
            errorId: ERROR_IDS.REPO_USER_NOT_FOUND,
            userId: params.id,
        });
        return errorResponse('Failed to fetch user', 500);
    }
};

/**
 * PUT /api/users/[id]
 * Updates a user by ID.
 */
export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const userRepository = new UserRepositoryClass();
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        // Parse request body with validation
        let body: { email?: string; username?: string };
        try {
            body = await request.json();
        } catch {
            return errorResponse('Invalid JSON in request body', 400);
        }

        const { email, username } = body;

        // Trim and normalize email and username
        const emailTrimmed = String(email ?? '').trim();
        const usernameTrimmed = String(username ?? '').trim();

        const updates: { email?: string; username?: string } = {};
        if (emailTrimmed) updates.email = emailTrimmed;
        if (usernameTrimmed) updates.username = usernameTrimmed;

        // Reject empty updates to avoid unnecessary database operations
        if (Object.keys(updates).length === 0) {
            return errorResponse('No valid fields to update', 422);
        }

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
 */
export const DELETE: APIRoute = async ({ params }) => {
    try {
        const userRepository = new UserRepositoryClass();
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return errorResponse('Invalid User ID', 400);
        }

        const deletedUser = await userRepository.delete(trimmedId);

        if (!deletedUser) {
            return errorResponse('User not found', 404);
        }

        return jsonResponse({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete user', error, {
            endpoint: '/api/users/[id]',
            errorId: ERROR_IDS.REPO_USER_DELETE_FAILED,
            userId: params.id,
        });
        return errorResponse('Failed to delete user', 500);
    }
};
