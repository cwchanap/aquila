import type { APIRoute } from 'astro';
import { ChapterRepository } from '@/lib/drizzle/repositories.js';
import { requireSupabaseUser } from '@/lib/auth/server';

export const POST: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
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
