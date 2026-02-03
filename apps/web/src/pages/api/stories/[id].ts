import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { StoryUpdateSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return errorResponse('Story ID is required', 400);
        }

        const { session, error } = await requireAuth(request);
        if (error) return error;

        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(id);

        if (!story || story.userId !== session.user.id) {
            return errorResponse('Story not found', 404);
        }

        return jsonResponse(story);
    } catch (error) {
        logger.error('Failed to fetch story', error, {
            endpoint: '/api/stories/[id]',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
            storyId: params.id,
        });
        return errorResponse('Failed to fetch story', 500);
    }
};

export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return errorResponse('Story ID is required', 400);
        }

        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            StoryUpdateSchema
        );
        if (validationError) return validationError;

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
            return errorResponse('Story not found', 404);
        }

        // Build update object with only provided fields
        const updates: Record<string, unknown> = {};
        if (data.title !== undefined) updates.title = data.title.trim();
        if (data.description !== undefined)
            updates.description = data.description?.trim() || null;
        if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
        if (data.status !== undefined) updates.status = data.status;

        if (Object.keys(updates).length === 0) {
            return errorResponse('No valid fields to update', 422);
        }

        const story = await storyRepo.update(id, updates);

        return jsonResponse(story);
    } catch (error) {
        logger.error('Failed to update story', error, {
            endpoint: '/api/stories/[id]',
            errorId: ERROR_IDS.DB_UPDATE_FAILED,
            storyId: params.id,
        });
        return errorResponse('Failed to update story', 500);
    }
};

export const DELETE: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return errorResponse('Story ID is required', 400);
        }

        const { session, error } = await requireAuth(request);
        if (error) return error;

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
            return errorResponse('Story not found', 404);
        }

        await storyRepo.delete(id);

        return jsonResponse({ deleted: true });
    } catch (error) {
        logger.error('Failed to delete story', error, {
            endpoint: '/api/stories/[id]',
            errorId: ERROR_IDS.DB_DELETE_FAILED,
            storyId: params.id,
        });
        return errorResponse('Failed to delete story', 500);
    }
};
