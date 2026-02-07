import type { APIRoute } from 'astro';
import {
    ChapterRepository,
    StoryRepository,
} from '@/lib/drizzle/repositories.js';
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
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            ChapterCreateSchema
        );
        if (validationError) return validationError;

        // Verify story ownership before creating chapter
        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(data.storyId);
        if (!story) {
            return errorResponse('Story not found', 404);
        }
        if (story.userId !== session.user.id) {
            return errorResponse('Forbidden', 403);
        }

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
