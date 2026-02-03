import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { StoryCreateSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const GET: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireAuth(request);
        if (error) return error;

        const storyRepo = new StoryRepository();
        const stories = await storyRepo.findByUserId(session.user.id);

        return jsonResponse(stories);
    } catch (error) {
        logger.error('Failed to fetch stories', error, {
            endpoint: '/api/stories',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
        });
        return errorResponse('Failed to fetch stories', 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            StoryCreateSchema
        );
        if (validationError) return validationError;

        const storyRepo = new StoryRepository();
        const story = await storyRepo.create({
            userId: session.user.id,
            title: data.title.trim(),
            description: data.description?.trim() || null,
            coverImage: data.coverImage || null,
            status: data.status,
        });

        return jsonResponse(story, 201);
    } catch (error) {
        logger.error('Failed to create story', error, {
            endpoint: '/api/stories',
            errorId: ERROR_IDS.DB_INSERT_FAILED,
        });
        return errorResponse('Failed to create story', 500);
    }
};
