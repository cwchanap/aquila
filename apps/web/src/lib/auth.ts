import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './drizzle/db.js';

export const auth = betterAuth({
    baseURL: (() => {
        const baseURL =
            import.meta.env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL;
        const isProduction =
            import.meta.env?.PROD || process.env.NODE_ENV === 'production';
        // In production, Better Auth builds OAuth redirect URIs from baseURL.
        // Without BETTER_AUTH_URL the localhost fallback produces a redirect
        // URI mismatch at the provider (e.g. Google). Email/password login was
        // removed, so Google is the only sign-in path — require an explicit,
        // non-local baseURL in production.
        if (isProduction) {
            if (!baseURL) {
                throw new Error(
                    'BETTER_AUTH_URL must be set in production environment'
                );
            }
            let host = '';
            try {
                host = new URL(baseURL).hostname.toLowerCase();
            } catch {
                throw new Error(
                    'BETTER_AUTH_URL must be a valid URL in production environment'
                );
            }
            if (
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host === '::1'
            ) {
                throw new Error(
                    'BETTER_AUTH_URL must be a non-local URL in production environment'
                );
            }
        }
        return baseURL || 'http://localhost:5090';
    })(),
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
    socialProviders: (() => {
        const clientId =
            import.meta.env?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret =
            import.meta.env?.GOOGLE_CLIENT_SECRET ||
            process.env.GOOGLE_CLIENT_SECRET;
        const isProduction =
            import.meta.env?.PROD || process.env.NODE_ENV === 'production';

        if (isProduction && !clientId) {
            throw new Error(
                'GOOGLE_CLIENT_ID must be set in production environment'
            );
        }
        if (isProduction && !clientSecret) {
            throw new Error(
                'GOOGLE_CLIENT_SECRET must be set in production environment'
            );
        }

        // Only register the google provider when both credentials are
        // present. In dev/preview without credentials, omitting the provider
        // prevents a broken sign-in path (better-auth returns a clear
        // "provider not configured" error instead of redirecting to Google
        // with empty values).
        if (!clientId || !clientSecret) {
            return {};
        }

        return {
            google: {
                clientId,
                clientSecret,
            },
        };
    })(),
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
