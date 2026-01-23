import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { logger } from '../../../lib/logger.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

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

        const trimmedEmail = email.trim();
        let user;
        try {
            user = await SimpleAuthService.signIn(trimmedEmail, password);
        } catch (error) {
            // Database or system error during signin
            logger.error('Signin service failed', error, {
                errorId: ERROR_IDS.AUTH_SIGNIN_FAILED,
                email: trimmedEmail.substring(0, 3) + '***',
            });
            throw error; // Re-throw to outer catch
        }

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
        const correlationId = crypto.randomUUID();
        logger.error('Signin failed', error, {
            errorId: ERROR_IDS.AUTH_SIGNIN_FAILED,
            correlationId,
        });

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                ...(process.env.NODE_ENV !== 'production' && {
                    correlationId,
                }),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
