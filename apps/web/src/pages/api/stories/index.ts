import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { storyStatusEnum } from '@/lib/drizzle/schema.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

const VALID_STATUSES = storyStatusEnum.enumValues;
type StoryStatus = (typeof storyStatusEnum.enumValues)[number];

export const GET: APIRoute = async ({ request }) => {
    try {
        const { session, error } = await requireSession(request);
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
        const { session, error } = await requireSession(request);
        if (error) return error;

        let body: {
            title?: string;
            description?: string;
            coverImage?: string;
            status?: StoryStatus;
        };
        try {
            body = await request.json();
        } catch (error) {
            logger.error('Failed to parse story JSON', error, {
                endpoint: '/api/stories',
                errorId: ERROR_IDS.API_INVALID_JSON,
            });
            return errorResponse('Malformed JSON', 400);
        }

        const { title, description, coverImage, status } = body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return errorResponse('Title is required', 400);
        }

        const normalizedDescription =
            typeof description === 'string' ? description.trim() : null;
        const normalizedCoverImage =
            typeof coverImage === 'string' ? coverImage : null;
        const normalizedStatus = VALID_STATUSES.includes(status as StoryStatus)
            ? (status as StoryStatus)
            : 'draft';

        if (status && !VALID_STATUSES.includes(status as StoryStatus)) {
            return errorResponse('Invalid status value', 400);
        }

        const storyRepo = new StoryRepository();
        const story = await storyRepo.create({
            userId: session.user.id,
            title: title.trim(),
            description: normalizedDescription,
            coverImage: normalizedCoverImage,
            status: normalizedStatus,
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
