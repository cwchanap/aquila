import type { APIRoute } from 'astro';
import {
    SceneRepository,
    StoryRepository,
} from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { SceneCreateSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            SceneCreateSchema
        );
        if (validationError) return validationError;

        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(data.storyId);
        if (!story) {
            return errorResponse('Story not found', 404);
        }
        if (story.userId !== session.user.id) {
            return errorResponse('Forbidden', 403);
        }

        const sceneRepo = new SceneRepository();
        const scene = await sceneRepo.create({
            storyId: data.storyId,
            chapterId: data.chapterId || null,
            title: data.title.trim(),
            content: data.content?.trim() || null,
            order: data.order,
        });

        return jsonResponse(scene, 201);
    } catch (error) {
        logger.error('Failed to create scene', error, {
            endpoint: '/api/scenes',
            errorId: ERROR_IDS.DB_INSERT_FAILED,
        });
        return errorResponse('Failed to create scene', 500);
    }
};
