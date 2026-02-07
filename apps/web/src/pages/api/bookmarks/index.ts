import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { BookmarkCreateSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

// GET /api/bookmarks - List all bookmarks for current user
export const GET: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        const repository = new BookmarkRepository();
        const bookmarks = await repository.findByUser(session.user.id);

        return jsonResponse(bookmarks);
    } catch (error) {
        logger.error('Failed to fetch bookmarks', error, {
            endpoint: '/api/bookmarks',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
        });
        return errorResponse('Failed to fetch bookmarks', 500);
    }
};

// POST /api/bookmarks - Upsert (create or update) a bookmark by scene
export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            BookmarkCreateSchema
        );
        if (validationError) return validationError;

        const repository = new BookmarkRepository();
        const bookmark = await repository.upsertByScene(
            session.user.id,
            data.storyId,
            data.sceneId,
            data.bookmarkName,
            data.locale
        );

        return jsonResponse(bookmark, 201);
    } catch (error) {
        logger.error('Failed to create bookmark', error, {
            endpoint: '/api/bookmarks',
            errorId: ERROR_IDS.DB_INSERT_FAILED,
        });
        return errorResponse('Failed to create bookmark', 500);
    }
};
