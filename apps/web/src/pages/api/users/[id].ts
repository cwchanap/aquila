import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../lib/drizzle/repositories.js';

const userRepository = new UserRepositoryClass();

export const DELETE: APIRoute = async ({ params }) => {
    try {
        const { id } = params;

        // Validate that id is a non-empty string
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return new Response(JSON.stringify({ error: 'Invalid User ID' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const deletedUser = await userRepository.delete(id);

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
