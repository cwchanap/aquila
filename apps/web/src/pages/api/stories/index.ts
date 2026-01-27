import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';

const VALID_STATUSES = ['draft', 'published', 'archived'] as const;
type StoryStatus = (typeof VALID_STATUSES)[number];

export const GET: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireSession(request);
        if (error) return error;

        const storyRepo = new StoryRepository();
        const stories = await storyRepo.findByUserId(session.user.id);

        return jsonResponse(stories);
    } catch (error) {
        logger.error('Get stories error', error, { endpoint: '/api/stories' });
        return errorResponse('Internal server error', 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireSession(request);
        if (error) return error;

        const { title, description, coverImage, status } = await request.json();

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return errorResponse('Title is required', 400);
        }

        if (status && !VALID_STATUSES.includes(status as StoryStatus)) {
            return errorResponse('Invalid status value', 400);
        }

        const storyRepo = new StoryRepository();
        const story = await storyRepo.create({
            userId: session.user.id,
            title: title.trim(),
            description: description?.trim() || null,
            coverImage: coverImage || null,
            status: (status as StoryStatus) || 'draft',
        });

        return jsonResponse(story, 201);
    } catch (error) {
        logger.error('Create story error', error, { endpoint: '/api/stories' });
        return errorResponse('Internal server error', 500);
    }
};
