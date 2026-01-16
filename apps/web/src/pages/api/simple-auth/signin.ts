import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return new Response(
                JSON.stringify({ error: 'Missing email or password' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const user = await SimpleAuthService.signIn(email, password);

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'Invalid credentials' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Create session
        const sessionId = await SimpleAuthService.createSession(user);

        // Set session cookie
        cookies.set('session', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return new Response(JSON.stringify({ user }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Signin error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
