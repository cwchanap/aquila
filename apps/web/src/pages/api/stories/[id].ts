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

const allowedStatuses = ['draft', 'published', 'archived'] as const;
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COVER_IMAGE_LENGTH = 2048;

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

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch (parseError) {
            console.error('Invalid JSON in update story request:', parseError);
            return new Response(
                JSON.stringify({ error: 'Invalid JSON payload' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
            return new Response(
                JSON.stringify({ error: 'Request body must be an object' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const body = rawBody as Record<string, unknown>;
        const allowedKeys = new Set([
            'title',
            'description',
            'coverImage',
            'status',
        ]);
        const unexpectedKey = Object.keys(body).find(
            key => !allowedKeys.has(key)
        );
        if (unexpectedKey) {
            return new Response(
                JSON.stringify({ error: `Unexpected field: ${unexpectedKey}` }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const updates: Record<string, unknown> = {};

        if ('title' in body) {
            const value = body.title;
            if (typeof value !== 'string' || value.trim().length === 0) {
                return new Response(
                    JSON.stringify({
                        error: 'Title must be a non-empty string',
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            if (value.length > MAX_TITLE_LENGTH) {
                return new Response(
                    JSON.stringify({
                        error: `Title must be at most ${MAX_TITLE_LENGTH} characters`,
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            updates.title = value.trim();
        }

        if ('description' in body) {
            const value = body.description;
            if (value !== null && typeof value !== 'string') {
                return new Response(
                    JSON.stringify({
                        error: 'Description must be a string or null',
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            if (
                typeof value === 'string' &&
                value.length > MAX_DESCRIPTION_LENGTH
            ) {
                return new Response(
                    JSON.stringify({
                        error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            updates.description =
                typeof value === 'string' ? value.trim() : null;
        }

        if ('coverImage' in body) {
            const value = body.coverImage;
            if (value !== null && typeof value !== 'string') {
                return new Response(
                    JSON.stringify({
                        error: 'Cover image must be a string or null',
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            if (
                typeof value === 'string' &&
                value.length > MAX_COVER_IMAGE_LENGTH
            ) {
                return new Response(
                    JSON.stringify({
                        error: `Cover image must be at most ${MAX_COVER_IMAGE_LENGTH} characters`,
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            updates.coverImage = typeof value === 'string' ? value : null;
        }

        if ('status' in body) {
            const value = body.status;
            if (typeof value !== 'string') {
                return new Response(
                    JSON.stringify({ error: 'Status must be a string' }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            if (
                !allowedStatuses.includes(
                    value as (typeof allowedStatuses)[number]
                )
            ) {
                return new Response(
                    JSON.stringify({
                        error: `Status must be one of: ${allowedStatuses.join(', ')}`,
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            updates.status = value as (typeof allowedStatuses)[number];
        }

        if (Object.keys(updates).length === 0) {
            return new Response(
                JSON.stringify({
                    error: 'No valid fields provided for update',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

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
