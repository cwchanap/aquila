import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger.js';
import { jsonResponse, errorResponse } from '@/lib/api-utils.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

// DELETE /api/bookmarks/:id - Delete a bookmark
export const DELETE: APIRoute = async ({ params, request }) => {
    let userId: string | undefined;
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        userId = session?.user?.id;
    } catch (error) {
        logger.error('Failed to get session', error, {
            endpoint: '/api/bookmarks/[id]',
            errorId: ERROR_IDS.AUTH_SESSION_GET_FAILED,
        });
        return errorResponse('Failed to authenticate', 500);
    }

    try {
        if (!userId) {
            return errorResponse('Unauthorized', 401);
        }

        const { id } = params;

        if (!id) {
            return errorResponse('Bookmark ID is required', 400);
        }

        const repository = new BookmarkRepository();

        // Verify bookmark belongs to user
        const bookmark = await repository.findById(id);
        if (!bookmark) {
            return errorResponse('Bookmark not found', 404);
        }

        if (bookmark.userId !== userId) {
            return errorResponse('Forbidden', 403);
        }

        const deleted = await repository.delete(id);

        if (!deleted) {
            return errorResponse('Bookmark not found', 404);
        }

        return jsonResponse({ success: true });
    } catch (error) {
        logger.error('Failed to delete bookmark', error, {
            endpoint: '/api/bookmarks/[id]',
            errorId: ERROR_IDS.DB_DELETE_FAILED,
            bookmarkId: params.id,
            userId,
        });
        return errorResponse('Failed to delete bookmark', 500);
    }
};
