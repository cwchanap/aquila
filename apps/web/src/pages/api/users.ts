import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../lib/drizzle/repositories.js';

const userRepository = new UserRepositoryClass();

/**
 * GET /api/users
 * Lists all users with pagination support.
 *
 * Query parameters:
 * - limit: number of users to return (default: 50)
 * - offset: number of users to skip (default: 0)
 */
export const GET: APIRoute = async ({ url }) => {
    try {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const users = await userRepository.list(limit, offset);

        return new Response(JSON.stringify(users), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error listing users:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

/**
 * POST /api/users
 * Creates a new user.
 *
 * Request body:
 * - email: string (required)
 * - username: string (required)
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { email, username } = body;

        if (!email || !username) {
            return new Response(
                JSON.stringify({
                    error: 'Missing required fields: email, username',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const user = await userRepository.create({
            email,
            username,
        });

        return new Response(JSON.stringify(user), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
