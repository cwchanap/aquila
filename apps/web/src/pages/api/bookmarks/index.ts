import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger.js';
import { jsonResponse, errorResponse } from '@/lib/api-utils.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

// GET /api/bookmarks - List all bookmarks for current user
export const GET: APIRoute = async ({ request }) => {
    try {
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            return errorResponse('Unauthorized', 401);
        }

        const repository = new BookmarkRepository();
        const bookmarks = await repository.findByUser(session.user.id);

        return jsonResponse({ bookmarks });
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
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            return errorResponse('Unauthorized', 401);
        }

        let body: {
            storyId?: string;
            sceneId?: string;
            bookmarkName?: string;
            locale?: string;
        };
        try {
            body = await request.json();
        } catch (error) {
            logger.error('Failed to parse bookmark JSON', error, {
                endpoint: '/api/bookmarks',
                errorId: ERROR_IDS.API_INVALID_JSON,
            });
            return errorResponse('Malformed JSON', 400);
        }

        const { storyId, sceneId, bookmarkName, locale } = body;

        if (!storyId || !sceneId || !bookmarkName) {
            return errorResponse(
                'Missing required fields: storyId, sceneId, bookmarkName',
                400
            );
        }

        const repository = new BookmarkRepository();
        const bookmark = await repository.upsertByScene(
            session.user.id,
            storyId,
            sceneId,
            bookmarkName,
            locale || 'en'
        );

        return jsonResponse({ bookmark }, 201);
    } catch (error) {
        logger.error('Failed to create bookmark', error, {
            endpoint: '/api/bookmarks',
            errorId: ERROR_IDS.DB_INSERT_FAILED,
        });
        return errorResponse('Failed to create bookmark', 500);
    }
};
