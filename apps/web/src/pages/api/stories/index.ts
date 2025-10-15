import type { APIRoute } from 'astro';
import { SimpleAuthService } from '@/lib/simple-auth.js';
import { StoryRepository } from '@/lib/drizzle/repositories.js';

export const GET: APIRoute = async ({ request }) => {
    try {
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
        const stories = await storyRepo.findByUserId(session.user.id);

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
            userId: session.user.id,
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
