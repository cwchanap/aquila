import type { APIRoute } from 'astro';
import { ReadingProgressRepository } from '@/lib/drizzle/repositories';
import { normalizeStoryProgressMap } from '@/lib/story-progress';
import { logger } from '@/lib/logger.js';
import {
    requireAuth,
    parseBody,
    jsonResponse,
    errorResponse,
} from '@/lib/api-utils.js';
import { ProgressSyncSchema } from '@/lib/schemas.js';
import { ERROR_IDS } from '@/constants/errorIds.js';

/** 48 KiB of UTF-8 request bytes, independent of Content-Length. */
const MAX_PROGRESS_BYTES = 48 * 1024;

// POST /api/progress - push local progress and pull the merged account map
export const POST: APIRoute = async ({ request }) => {
    try {
        const { session, error: authError } = await requireAuth(request);
        if (authError) return authError;

        const { data, error: validationError } = await parseBody(
            request,
            ProgressSyncSchema,
            MAX_PROGRESS_BYTES
        );
        if (validationError) return validationError;

        const repository = new ReadingProgressRepository();
        const progress = await repository.mergeForUser(
            session.user.id,
            normalizeStoryProgressMap(data.progress)
        );

        return jsonResponse({ progress });
    } catch (error) {
        logger.error('Failed to sync reading progress', error, {
            endpoint: '/api/progress',
            errorId: ERROR_IDS.DB_QUERY_FAILED,
        });
        return errorResponse('Failed to sync reading progress', 500);
    }
};
