import type { APIRoute } from 'astro';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import { ChapterRepository } from '@/lib/drizzle/repositories.js';

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

        const { storyId, title, description, order } = await request.json();

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

        const chapterRepo = new ChapterRepository();
        const chapter = await chapterRepo.create({
            storyId,
            title: title.trim(),
            description: description?.trim() || null,
            order: String(order),
        });

        return new Response(JSON.stringify(chapter), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Create chapter error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
