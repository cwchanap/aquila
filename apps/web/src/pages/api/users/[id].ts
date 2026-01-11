import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../lib/drizzle/repositories.js';

const userRepository = new UserRepositoryClass();

/**
 * GET /api/users/[id]
 * Retrieves a single user by ID.
 */
export const GET: APIRoute = async ({ params }) => {
    try {
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return new Response(JSON.stringify({ error: 'Invalid User ID' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const user = await userRepository.findById(trimmedId);

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
        console.error('Error fetching user:', error);
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
 * PUT /api/users/[id]
 * Updates a user by ID.
 */
export const PUT: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return new Response(JSON.stringify({ error: 'Invalid User ID' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { email, username } = body;

        const updates: { email?: string; username?: string } = {};
        if (email) updates.email = email;
        if (username) updates.username = username;

        const user = await userRepository.update(trimmedId, updates);

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
        console.error('Error updating user:', error);
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
 * DELETE /api/users/[id]
 * Deletes a user by ID.
 */
export const DELETE: APIRoute = async ({ params }) => {
    try {
        const { id } = params;
        const trimmedId = id?.trim() ?? '';

        // Validate that id is a non-empty string
        if (!trimmedId) {
            return new Response(JSON.stringify({ error: 'Invalid User ID' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const deletedUser = await userRepository.delete(trimmedId);

        if (!deletedUser) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(
            JSON.stringify({ message: 'User deleted successfully' }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Error deleting user:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
