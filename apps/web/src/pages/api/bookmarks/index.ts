import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger.js';
import { jsonResponse, errorResponse } from '@/lib/api-utils.js';

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

        const body = await request.json();
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
        });
        return errorResponse('Failed to create bookmark', 500);
    }
};
