import type { APIRoute } from 'astro';
import { SceneRepository } from '@/lib/drizzle/repositories.js';
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

        let body: {
            storyId?: string;
            chapterId?: string;
            title?: string;
            content?: string;
            order?: string | number;
        };
        try {
            body = await request.json();
        } catch (error) {
            logger.error('Failed to parse scene JSON', error, {
                endpoint: '/api/scenes',
                errorId: ERROR_IDS.API_INVALID_JSON,
            });
            return errorResponse('Malformed JSON', 400);
        }

        const { storyId, chapterId, title, content, order } = body;

        if (!storyId || !title || order === undefined) {
            return errorResponse(
                'Story ID, title, and order are required',
                400
            );
        }

        const sceneRepo = new SceneRepository();
        const scene = await sceneRepo.create({
            storyId,
            chapterId: chapterId || null,
            title: title.trim(),
            content: content?.trim() || null,
            order: String(order),
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
