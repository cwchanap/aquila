import type { APIRoute } from 'astro';
import { randomUUID } from 'crypto';
import { BookmarkRepository } from '@/lib/drizzle/repositories';
import { requireSupabaseUser } from '@/lib/auth/server';

// DELETE /api/bookmarks/:id - Delete a bookmark
export const DELETE: APIRoute = async ({ params, request }) => {
    try {
        const authResult = await requireSupabaseUser(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { appUser } = authResult;

        const { id } = params;

        if (!id) {
            return new Response(
                JSON.stringify({ error: 'Bookmark ID is required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const repository = new BookmarkRepository();

        // Verify bookmark belongs to user
        const bookmark = await repository.findById(id);
        if (!bookmark) {
            return new Response(
                JSON.stringify({ error: 'Bookmark not found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (bookmark.userId !== appUser.id) {
            return new Response(
                JSON.stringify({ error: 'Bookmark not found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const deleted = await repository.delete(id);

        if (!deleted) {
            return new Response(
                JSON.stringify({ error: 'Bookmark not found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const correlationId = randomUUID();
        const safeMessage =
            error instanceof Error ? error.message : 'Unknown error';

        console.error(
            JSON.stringify({
                level: 'error',
                msg: 'Failed to delete bookmark',
                correlationId,
                error: safeMessage,
            })
        );
        return new Response(
            JSON.stringify({
                error: 'Failed to delete bookmark',
                correlationId,
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
