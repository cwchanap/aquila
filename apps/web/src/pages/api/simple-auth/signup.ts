import type { APIRoute } from 'astro';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { db } from '../../../lib/drizzle/db.js';
import { users } from '../../../lib/drizzle/schema.js';

const isNonProduction = process.env.NODE_ENV !== 'production';
let dbHealthChecked = false;

async function ensureDbHealthCheck() {
    if (dbHealthChecked || !isNonProduction) {
        return;
    }

    await db.select().from(users).limit(1);
    dbHealthChecked = true;
}

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { email, password, name } = body;

        if (!email || !password || !name) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Development/test DB health check to surface configuration issues
        if (isNonProduction && !dbHealthChecked) {
            try {
                await ensureDbHealthCheck();
            } catch (dbError) {
                console.error(
                    'Simple auth signup DB health check failed:',
                    dbError
                );
                const message =
                    dbError instanceof Error
                        ? dbError.message
                        : String(dbError);
                return new Response(
                    JSON.stringify({
                        error: 'Database error during signup',
                        detail: message,
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        }

        const user = await SimpleAuthService.signUp(email, password, name);

        if (!user) {
            return new Response(
                JSON.stringify({
                    error: 'Email already in use',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Create session
        const sessionId = await SimpleAuthService.createSession(user);

        // Set session cookie
        cookies.set('session', sessionId, {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return new Response(JSON.stringify({ user }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Signup error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
