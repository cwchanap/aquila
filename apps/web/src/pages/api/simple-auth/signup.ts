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
import { UserAlreadyExistsError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import { ERROR_IDS } from '../../../constants/errorIds.js';

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
    let translations = getTranslations('en');
    try {
        const body = await request.json();
        const { email, password, name, locale: rawLocale } = body;

        const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
        translations = getTranslations(locale);
        const validationTranslations: ValidationTranslations = {
            email: translations.email,
            username: translations.username,
            characterName: translations.characterName,
        };

        if (!email || !password || !name) {
            return new Response(
                JSON.stringify({
                    error: translations.login.missingRequiredFields,
                }),
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

        const trimmedEmail = email.trim();

        // Perform one-time DB health check in non-production environments to surface
        // connection issues early during signup flow, rather than failing silently
        if (isNonProduction && !dbHealthChecked) {
            try {
                await ensureDbHealthCheck();
            } catch (dbError) {
                logger.error(
                    'Simple auth signup DB health check failed',
                    dbError,
                    {
                        errorId: ERROR_IDS.DB_CONNECTION_FAILED,
                    }
                );
                return new Response(
                    JSON.stringify({
                        error: translations.login.dbConnectionError,
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        }

        let user;
        try {
            user = await SimpleAuthService.signUp(trimmedEmail, password, name);
        } catch (error) {
            if (error instanceof UserAlreadyExistsError) {
                return new Response(
                    JSON.stringify({
                        error: translations.login.emailAlreadyInUse,
                    }),
                    {
                        status: 409,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
            // Re-throw other errors to be caught by outer catch block
            throw error;
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
        logger.error('Signup failed', error, {
            errorId: ERROR_IDS.AUTH_SIGNUP_FAILED,
            correlationId,
        });

        return new Response(
            JSON.stringify({
                error: translations.login.internalServerError,
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
