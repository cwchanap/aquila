import type { APIRoute } from 'astro';
import { SceneRepository } from '@/lib/drizzle/repositories.js';
import { logger } from '@/lib/logger.js';
import {
    requireSession,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { error } = await requireSession(request);
        if (error) return error;

        const { storyId, chapterId, title, content, order } =
            await request.json();

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
        logger.error('Create scene error', error, { endpoint: '/api/scenes' });
        return errorResponse('Internal server error', 500);
    }
};
