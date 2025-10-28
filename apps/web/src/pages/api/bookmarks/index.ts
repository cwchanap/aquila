import type { APIRoute } from 'astro';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { auth } from '@/lib/auth';

// GET /api/bookmarks - List all bookmarks for current user
export const GET: APIRoute = async ({ request }) => {
    try {
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const repository = new BookmarkRepository();
        const bookmarks = await repository.findByUser(session.user.id);

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
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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
            session.user.id,
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
