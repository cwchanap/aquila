import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../../../lib/drizzle/repositories.js';

/**
 * GET /api/users/by-email/[email]
 * Retrieves a single user by email address.
 */
export const GET: APIRoute = async ({ params }) => {
    try {
        const userRepository = new UserRepositoryClass();
        const { email } = params;
        // Decode the URL parameter before trimming and validation
        let decoded: string;
        try {
            decoded = decodeURIComponent(email ?? '');
        } catch {
            // If decoding fails (malformed URI), treat as empty string
            decoded = '';
        }
        const trimmedEmail = decoded.trim() ?? '';

        // Validate that email is a non-empty string
        if (!trimmedEmail) {
            return new Response(
                JSON.stringify({ error: 'Invalid email address' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const user = await userRepository.findByEmail(trimmedEmail);

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
        console.error('Error fetching user by email:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
