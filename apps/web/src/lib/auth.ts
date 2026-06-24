import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './drizzle/db.js';

export const auth = betterAuth({
    baseURL:
        import.meta.env?.BETTER_AUTH_URL ||
        process.env.BETTER_AUTH_URL ||
        'http://localhost:5090',
    database: drizzleAdapter(db, {
        provider: 'pg',
    }),
    // Map core models to our pluralized table names
    user: {
        modelName: 'users',
    },
    session: {
        modelName: 'sessions',
        expiresIn: 60 * 60 * 24 * 7, // 7 days
    },
    account: {
        modelName: 'accounts',
    },
    verification: {
        modelName: 'verificationTokens',
    },
    trustedOrigins: (() => {
        const raw =
            import.meta.env?.TRUSTED_ORIGINS || process.env.TRUSTED_ORIGINS;
        if (raw) {
            return raw
                .split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
        }
        if (import.meta.env?.PROD || process.env.NODE_ENV === 'production') {
            throw new Error(
                'TRUSTED_ORIGINS must be set in production environment'
            );
        }
        return ['http://localhost:5090'];
    })(),
    secret: (() => {
        const secret = process.env.BETTER_AUTH_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
            throw new Error(
                'BETTER_AUTH_SECRET must be set in production environment'
            );
        }
        return secret || 'development-only-secret-do-not-use-in-prod';
    })(),
    socialProviders: {
        google: {
            clientId: (() => {
                const id =
                    import.meta.env?.GOOGLE_CLIENT_ID ||
                    process.env.GOOGLE_CLIENT_ID;
                if (
                    !id &&
                    (import.meta.env?.PROD ||
                        process.env.NODE_ENV === 'production')
                ) {
                    throw new Error(
                        'GOOGLE_CLIENT_ID must be set in production environment'
                    );
                }
                return id || '';
            })(),
            clientSecret: (() => {
                const secret =
                    import.meta.env?.GOOGLE_CLIENT_SECRET ||
                    process.env.GOOGLE_CLIENT_SECRET;
                if (
                    !secret &&
                    (import.meta.env?.PROD ||
                        process.env.NODE_ENV === 'production')
                ) {
                    throw new Error(
                        'GOOGLE_CLIENT_SECRET must be set in production environment'
                    );
                }
                return secret || '';
            })(),
        },
    },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
