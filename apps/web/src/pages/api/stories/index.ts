import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { requireSupabaseUser } from '@/lib/auth/server';

export const GET: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const storyRepo = new StoryRepository();
        const stories = await storyRepo.findByUserId(appUser.id);

        return new Response(JSON.stringify(stories), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get stories error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const { title, description, coverImage, status } = await request.json();

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Title is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const storyRepo = new StoryRepository();
        const story = await storyRepo.create({
            userId: appUser.id,
            title: title.trim(),
            description: description?.trim() || null,
            coverImage: coverImage || null,
            status: status || 'draft',
        });

        return new Response(JSON.stringify(story), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Create story error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
