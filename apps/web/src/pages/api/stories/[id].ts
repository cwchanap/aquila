import type { APIRoute } from 'astro';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import { StoryRepository } from '@/lib/drizzle/repositories.js';

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

        // Get session from cookie
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

        const storyRepo = new StoryRepository();
        const story = await storyRepo.findById(id);

        if (!story || story.userId !== session.user.id) {
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

        const updates = await request.json();

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
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

        const storyRepo = new StoryRepository();
        const existingStory = await storyRepo.findById(id);

        if (!existingStory || existingStory.userId !== session.user.id) {
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
