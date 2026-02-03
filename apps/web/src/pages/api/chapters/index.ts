import type { APIRoute } from 'astro';
import { ChapterRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { ChapterCreateSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            ChapterCreateSchema
        );
        if (validationError) return validationError;

        const chapterRepo = new ChapterRepository();
        const chapter = await chapterRepo.create({
            storyId: data.storyId,
            title: data.title.trim(),
            description: data.description?.trim() || null,
            order: data.order,
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
