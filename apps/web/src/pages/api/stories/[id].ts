import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return errorResponse('Story ID is required', 400);
        }

        const { session, error } = await requireSession(request);
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
            errorId: ERROR_IDS.REPO_STORY_NOT_FOUND,
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

        const { session, error } = await requireSession(request);
        if (error) return error;

        const updates = await request.json();

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
            return errorResponse('Story not found', 404);
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

        const { session, error } = await requireSession(request);
        if (error) return error;

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
            return errorResponse('Story not found', 404);
        }

        await storyRepo.delete(id);

        return jsonResponse({ success: true });
    } catch (error) {
        logger.error('Failed to delete story', error, {
            endpoint: '/api/stories/[id]',
            errorId: ERROR_IDS.DB_DELETE_FAILED,
            storyId: params.id,
        });
        return errorResponse('Failed to delete story', 500);
    }
};
