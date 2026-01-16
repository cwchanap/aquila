import type { APIRoute } from 'astro';
import { UserRepository as UserRepositoryClass } from '../../lib/drizzle/repositories.js';

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

// Input validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;

function validateEmail(email: unknown): string | null {
    if (typeof email !== 'string') return 'Email must be a string';
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required';
    if (!EMAIL_REGEX.test(trimmed)) return 'Invalid email format';
    if (trimmed.length > 255) return 'Email must be at most 255 characters';
    return null;
}

function validateUsername(username: unknown): string | null {
    if (typeof username !== 'string') return 'Username must be a string';
    const trimmed = username.trim();
    if (!trimmed) return 'Username is required';
    if (trimmed.length < USERNAME_MIN_LENGTH)
        return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
    if (trimmed.length > USERNAME_MAX_LENGTH)
        return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed))
        return 'Username can only contain letters, numbers, underscores, and hyphens';
    return null;
}

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
            email: email.trim(),
            username: username.trim(),
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
