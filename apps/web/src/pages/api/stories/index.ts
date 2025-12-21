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

        let body: unknown;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Invalid JSON in create story request:', parseError);
            return new Response(
                JSON.stringify({ error: 'Invalid JSON payload' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const parsed = body as Record<string, unknown>;
        const rawTitle = parsed.title;
        const rawDescription = parsed.description;
        const rawCoverImage = parsed.coverImage;
        const rawStatus = parsed.status;

        const title =
            typeof rawTitle === 'string' && rawTitle.trim().length > 0
                ? rawTitle
                : null;
        const description =
            typeof rawDescription === 'string' ? rawDescription : null;
        const coverImage =
            typeof rawCoverImage === 'string' ? rawCoverImage : null;

        const allowedStatuses = ['draft', 'published', 'archived'] as const;
        const status =
            typeof rawStatus === 'string' &&
            allowedStatuses.includes(
                rawStatus as (typeof allowedStatuses)[number]
            )
                ? (rawStatus as (typeof allowedStatuses)[number])
                : undefined;

        if (!title) {
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
            status: status ?? 'draft',
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
