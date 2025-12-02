import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { SimpleAuthService } from '@/lib/simple-auth.js';

async function validateSession(
    request: Request
): Promise<{ userId: string } | Response> {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionId = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='))
        ?.split('=')[1];

    if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const session = await SimpleAuthService.getSession(sessionId);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return { userId: session.user.id };
}

// GET /api/bookmarks - List all bookmarks for current user
export const GET: APIRoute = async ({ request }) => {
    try {
        const sessionValidation = await validateSession(request);
        if (sessionValidation instanceof Response) {
            return sessionValidation;
        }

        const { userId } = sessionValidation;

        const repository = new BookmarkRepository();
        const bookmarks = await repository.findByUser(userId);

        return new Response(JSON.stringify({ bookmarks }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to fetch bookmarks:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to fetch bookmarks' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

// POST /api/bookmarks - Upsert (create or update) a bookmark by scene
export const POST: APIRoute = async ({ request }) => {
    try {
        const sessionValidation = await validateSession(request);
        if (sessionValidation instanceof Response) {
            return sessionValidation;
        }

        const { userId } = sessionValidation;

        const body = await request.json();
        const { storyId, sceneId, bookmarkName, locale } = body;

        if (!storyId || !sceneId || !bookmarkName) {
            return new Response(
                JSON.stringify({
                    error: 'Missing required fields: storyId, sceneId, bookmarkName',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const repository = new BookmarkRepository();
        const bookmark = await repository.upsertByScene(
            userId,
            storyId,
            sceneId,
            bookmarkName,
            locale || 'en'
        );

        return new Response(JSON.stringify({ bookmark }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to create bookmark:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to create bookmark' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
