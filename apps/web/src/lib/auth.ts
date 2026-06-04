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
        fields: {
            emailVerified: 'email_verified',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    session: {
        modelName: 'sessions',
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        fields: {
            userId: 'user_id',
            expiresAt: 'expires_at',
            ipAddress: 'ip_address',
            userAgent: 'user_agent',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    account: {
        modelName: 'accounts',
        fields: {
            userId: 'user_id',
            accountId: 'account_id',
            providerId: 'provider_id',
            accessToken: 'access_token',
            refreshToken: 'refresh_token',
            idToken: 'id_token',
            accessTokenExpiresAt: 'access_token_expires_at',
            refreshTokenExpiresAt: 'refresh_token_expires_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    verification: {
        modelName: 'verificationTokens',
        fields: {
            value: 'token',
            expiresAt: 'expires',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
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
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
