import type { APIRoute } from 'astro';
import { ChapterRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { error } = await requireSession(request);
        if (error) return error;

        const { storyId, title, description, order } = await request.json();

        if (!storyId || !title || order === undefined) {
            return errorResponse(
                'Story ID, title, and order are required',
                400
            );
        }

        const chapterRepo = new ChapterRepository();
        const chapter = await chapterRepo.create({
            storyId,
            title: title.trim(),
            description: description?.trim() || null,
            order: String(order),
        });

        return jsonResponse(chapter, 201);
    } catch (error) {
        logger.error('Failed to create chapter', error, {
            endpoint: '/api/chapters',
            errorId: ERROR_IDS.DB_INSERT_FAILED,
        });
        return errorResponse('Failed to create chapter', 500);
    }
};
