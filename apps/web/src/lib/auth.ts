import { betterAuth } from 'better-auth';

// Astro uses import.meta.env, but fallback to process.env for compatibility
const isTestEnv =
    (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true';

// In CI/test environments, prioritize process.env over import.meta.env
// to allow environment variables from the test runner to override .env files
const databaseUrl = isTestEnv
    ? process.env.DATABASE_URL ||
      import.meta.env?.DATABASE_URL ||
      'postgres://localhost:5432/aquila_test'
    : import.meta.env?.DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error(
        'DATABASE_URL is not set. Configure a PostgreSQL connection string before starting the app.'
    );
}

export const auth = betterAuth({
    baseURL:
        import.meta.env?.BETTER_AUTH_URL ||
        process.env.BETTER_AUTH_URL ||
        'http://localhost:5090',
    database: {
        provider: 'postgres',
        url: databaseUrl,
    },
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
        fields: {
            value: 'token',
            expiresAt: 'expires',
        },
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    trustedOrigins: (() => {
        const raw =
            process.env.TRUSTED_ORIGINS || import.meta.env?.TRUSTED_ORIGINS;
        if (raw) {
            return raw
                .split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
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
