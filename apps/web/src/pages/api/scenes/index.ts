import type { APIRoute } from 'astro';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import { SceneRepository } from '@/lib/drizzle/repositories.js';

export const POST: APIRoute = async ({ request }) => {
    try {
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

        const { storyId, chapterId, title, content, order } =
            await request.json();

        if (!storyId || !title || order === undefined) {
            return new Response(
                JSON.stringify({
                    error: 'Story ID, title, and order are required',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
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

        return new Response(JSON.stringify(scene), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Create scene error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
