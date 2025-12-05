import type { APIRoute } from 'astro';
import { StoryRepository } from '@/lib/drizzle/repositories.js';
import { requireSupabaseUser } from '@/lib/auth/server';

export const GET: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return new Response(
                JSON.stringify({ error: 'Story ID is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(id);

        if (!story || story.userId !== appUser.id) {
            return new Response(JSON.stringify({ error: 'Story not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(story), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get story error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return new Response(
                JSON.stringify({ error: 'Story ID is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const updates = await request.json();

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== appUser.id) {
            return new Response(JSON.stringify({ error: 'Story not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const story = await storyRepo.update(id, updates);

        return new Response(JSON.stringify(story), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Update story error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export const DELETE: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        if (!id) {
            return new Response(
                JSON.stringify({ error: 'Story ID is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== appUser.id) {
            return new Response(JSON.stringify({ error: 'Story not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await storyRepo.delete(id);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Delete story error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
