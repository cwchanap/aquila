import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../lib/drizzle/repositories.js';
import { validateEmail, validateUsername } from '../../lib/validation.js';

const userRepository = new UserRepositoryClass();

/**
 * GET /api/users
 * Lists all users with pagination support.
 *
 * Query parameters:
 * - limit: number of users to return (default: 50, min: 1, max: 100)
 * - offset: number of users to skip (default: 0, min: 0)
 */
export const GET: APIRoute = async ({ url }) => {
    try {
        // Parse and validate limit parameter
        const rawLimit = url.searchParams.get('limit');
        let limit = parseInt(rawLimit || '50', 10);
        // Validate and clamp limit to valid range [1, 100]
        if (isNaN(limit)) limit = 50;
        limit = Math.max(1, Math.min(100, limit));

        // Parse and validate offset parameter
        const rawOffset = url.searchParams.get('offset');
        let offset = parseInt(rawOffset || '0', 10);
        // Validate and clamp offset to minimum of 0
        if (isNaN(offset)) offset = 0;
        offset = Math.max(0, offset);

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
 * - email: string (required, valid email format)
 * - username: string (required, 3-50 chars, alphanumeric with _ and -)
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { email, username } = body;

        // Validate inputs
        const emailError = validateEmail(email);
        if (emailError) {
            return new Response(JSON.stringify({ error: emailError }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const usernameError = validateUsername(username);
        if (usernameError) {
            return new Response(JSON.stringify({ error: usernameError }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const user = await userRepository.create({
            email: email,
            username: username,
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
