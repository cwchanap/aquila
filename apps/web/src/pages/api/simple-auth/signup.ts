import type { APIRoute } from 'astro';
import { getTranslations, type Locale } from '@aquila/dialogue';
import { SimpleAuthService } from '../../../lib/simple-auth.js';
import { db } from '../../../lib/drizzle/db.js';
import { users } from '../../../lib/drizzle/schema.js';
import {
    resolveValidationMessage,
    validateEmail,
    type ValidationTranslations,
} from '../../../lib/validation.js';

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
        const { email, password, name, locale: rawLocale } = body;

        const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
        const translations = getTranslations(locale);
        const validationTranslations: ValidationTranslations = {
            email: translations.email,
            username: translations.username,
            characterName: translations.characterName,
        };

        if (!email || !password || !name) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Validate email format
        const emailError = validateEmail(email);
        if (emailError) {
            return new Response(
                JSON.stringify({
                    error: resolveValidationMessage(
                        validationTranslations,
                        emailError
                    ),
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Development/test DB health check to surface configuration issues
        if (isNonProduction && !dbHealthChecked) {
            try {
                await ensureDbHealthCheck();
            } catch (dbError) {
                console.error(
                    'Simple auth signup DB health check failed:',
                    dbError
                );
                return new Response(
                    JSON.stringify({
                        error: 'Database connection error. Please check server configuration.',
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        }

        const user = await SimpleAuthService.signUp(
            normalizedEmail,
            password,
            name
        );

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

        const normalizedUser = {
            ...user,
            email: normalizedEmail,
        };

        // Create session
        const sessionId = await SimpleAuthService.createSession(normalizedUser);

        // Set session cookie
        cookies.set('session', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return new Response(JSON.stringify({ user: normalizedUser }), {
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
