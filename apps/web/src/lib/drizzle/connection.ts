import { logger } from '../logger.js';
import { ERROR_IDS } from '../../constants/errorIds.js';

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
        // new URL().hostname returns IPv6 addresses bracketed (e.g. "[::1]"),
        // but LOCAL_HOSTS stores the unbracketed form ("::1"). Strip brackets
        // so loopback IPv6 addresses are correctly recognized as local.
        const normalized = host.replace(/^\[|\]$/g, '');
        return !LOCAL_HOSTS.has(normalized);
    } catch {
        return false;
    }
}

/**
 * Decide the `pg` SSL config. SSL is enabled whenever the target requires it:
 * an explicit `sslmode=require`, a remote (non-local) host, or
 * DB_ALLOW_SELF_SIGNED. Local/insecure connections stay SSL-off.
 *
 * `isProduction` is an intentional belt-and-suspenders trigger on top of the
 * spec's `sslmode`/remote-host checks: production must never talk to an
 * unencrypted localhost, so it forces SSL on even for a local-looking host.
 */
export function resolveSsl(
    connectionString: string,
    env: NodeJS.ProcessEnv = process.env
): SslConfig {
    const allowSelfSigned = env.DB_ALLOW_SELF_SIGNED === 'true';
    const isProduction = env.NODE_ENV === 'production';
    if (allowSelfSigned && isProduction) {
        // Defense-in-depth: the flag is documented as non-production only, but
        // surface a loud, structured, alertable error if it is ever enabled in
        // production so a misconfiguration doesn't silently disable TLS
        // verification on the database connection. Routed through the project
        // logger (not raw console) so it lands in log aggregators with an
        // errorId that can be alerted on. Non-blocking: the connection still
        // proceeds with verification disabled, matching prior behavior.
        logger.error(
            'DB_ALLOW_SELF_SIGNED is enabled in production — TLS certificate verification is disabled on the database connection.',
            undefined,
            { errorId: ERROR_IDS.DB_CONNECTION_FAILED }
        );
    }
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
