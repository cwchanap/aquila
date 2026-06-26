export type SslConfig = boolean | { rejectUnauthorized: boolean };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Resolve the Postgres connection string, preferring the canonical
 * DATABASE_URL but falling back to the names the Vercel Prisma Postgres
 * integration provisions (which carry a project prefix). Returns the first
 * non-empty value, or undefined.
 */
export function resolveConnectionString(
    env: NodeJS.ProcessEnv = process.env
): string | undefined {
    return (
        env.DATABASE_URL ||
        env.POSTGRES_URL ||
        env.aquila_DATABASE_URL ||
        env.aquila_POSTGRES_URL ||
        undefined
    );
}

function isRemoteHost(connectionString: string): boolean {
    try {
        const host = new URL(connectionString).hostname.toLowerCase();
        if (!host) return false;
        return !LOCAL_HOSTS.has(host);
    } catch {
        return false;
    }
}

/**
 * Decide the `pg` SSL config. SSL is enabled whenever the target requires it:
 * production, an explicit `sslmode=require`, a remote (non-local) host, or
 * DB_ALLOW_SELF_SIGNED. Local/insecure connections stay SSL-off.
 */
export function resolveSsl(
    connectionString: string,
    env: NodeJS.ProcessEnv = process.env
): SslConfig {
    const allowSelfSigned = env.DB_ALLOW_SELF_SIGNED === 'true';
    const isProduction = env.NODE_ENV === 'production';
    const requiresSsl =
        allowSelfSigned ||
        isProduction ||
        /sslmode=require/i.test(connectionString) ||
        isRemoteHost(connectionString);

    if (!requiresSsl) {
        return false;
    }
    return { rejectUnauthorized: !allowSelfSigned };
}
