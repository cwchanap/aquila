import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './drizzle/db.js';
import {
    resolveBaseURL,
    resolveTrustedOrigins,
    type AuthConfigEnv,
} from './auth-config.js';

const isProduction = Boolean(
    import.meta.env?.PROD || process.env.NODE_ENV === 'production'
);

// Both the base URL and the trusted origins are deduced from the request
// hostname on Vercel (VERCEL_* system vars), so neither BETTER_AUTH_URL nor
// TRUSTED_ORIGINS needs to be set by hand in production. Explicit values still
// win as overrides for local dev and non-Vercel hosts.
const authConfigEnv: AuthConfigEnv = {
    BETTER_AUTH_URL:
        import.meta.env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL,
    TRUSTED_ORIGINS:
        import.meta.env?.TRUSTED_ORIGINS || process.env.TRUSTED_ORIGINS,
    VERCEL_PROJECT_PRODUCTION_URL:
        import.meta.env?.VERCEL_PROJECT_PRODUCTION_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: import.meta.env?.VERCEL_URL || process.env.VERCEL_URL,
    VERCEL_BRANCH_URL:
        import.meta.env?.VERCEL_BRANCH_URL || process.env.VERCEL_BRANCH_URL,
};

export const auth = betterAuth({
    baseURL: resolveBaseURL(authConfigEnv, isProduction),
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
    trustedOrigins: resolveTrustedOrigins(authConfigEnv, isProduction),
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
