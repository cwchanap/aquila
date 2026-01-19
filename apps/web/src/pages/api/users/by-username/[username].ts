import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../../lib/drizzle/repositories.js';

/**
 * GET /api/users/by-username/[username]
 * Retrieves a single user by username.
 */
export const GET: APIRoute = async ({ params }) => {
    try {
        const userRepository = new UserRepositoryClass();
        const { username } = params;
        const trimmedUsername = username?.trim() ?? '';

        // Validate that username is a non-empty string
        if (!trimmedUsername) {
            return new Response(JSON.stringify({ error: 'Invalid username' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const user = await userRepository.findByUsername(trimmedUsername);

        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(user), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching user by username:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
