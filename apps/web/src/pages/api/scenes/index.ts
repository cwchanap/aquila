import type { APIRoute } from 'astro';
import {
    SceneRepository,
    StoryRepository,
} from '@/lib/drizzle/repositories.js';
import { requireSupabaseUser } from '@/lib/auth/server';

export const POST: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

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

        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(storyId);

        if (!story) {
            return new Response(JSON.stringify({ error: 'Story not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (story.userId !== appUser.id) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
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
