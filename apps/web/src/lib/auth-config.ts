/**
 * Pure resolvers for Better Auth's base URL and trusted origins.
 *
 * The goal is to require as little manual configuration as possible: on Vercel
 * the request hostname is already injected as system env vars, so we can deduce
 * both the canonical base URL and the set of trusted origins without anyone
 * setting BETTER_AUTH_URL or TRUSTED_ORIGINS by hand. Explicit BETTER_AUTH_URL
 * overrides the derived URL; explicit TRUSTED_ORIGINS is merged with the derived
 * origins (so pinning production origins does not break preview deploys).
 *
 * Vercel system env vars used (all bare hostnames, no protocol):
 *   - VERCEL_PROJECT_PRODUCTION_URL: the project's stable production domain
 *     (e.g. aquila.cwchanap.dev). Present on every deployment, so the OAuth
 *     redirect URI stays pinned to production even from preview builds.
 *   - VERCEL_URL: the unique per-deployment URL.
 *   - VERCEL_BRANCH_URL: the branch alias URL.
 */

export interface AuthConfigEnv {
    BETTER_AUTH_URL?: string;
    TRUSTED_ORIGINS?: string;
    VERCEL_PROJECT_PRODUCTION_URL?: string;
    VERCEL_URL?: string;
    VERCEL_BRANCH_URL?: string;
}

const DEV_URL = 'http://localhost:5090';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Prefix a bare Vercel host (no protocol) with https://. Empty input -> undefined.
 * If the value already carries a scheme (defensive against future Vercel API
 * changes), return it untouched rather than double-prefixing.
 */
function vercelOrigin(host: string | undefined): string | undefined {
    const trimmed = host?.trim();
    if (!trimmed) return undefined;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Resolve the Better Auth base URL.
 * Priority: explicit BETTER_AUTH_URL > Vercel production domain > dev fallback.
 * In production the resolved URL must be a valid, non-local URL.
 */
export function resolveBaseURL(
    env: AuthConfigEnv,
    isProduction: boolean
): string {
    const explicit = env.BETTER_AUTH_URL?.trim();
    const derived = vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
    const resolved = explicit || derived;

    if (!isProduction) {
        return resolved || DEV_URL;
    }

    // Production: Better Auth builds OAuth redirect URIs from baseURL, so a
    // missing or local URL silently breaks Google sign-in. Fail loud instead.
    if (!resolved) {
        throw new Error(
            'BETTER_AUTH_URL must be set in production environment ' +
                '(or deploy on Vercel so VERCEL_PROJECT_PRODUCTION_URL is available)'
        );
    }
    let host = '';
    try {
        host = new URL(resolved).hostname.toLowerCase();
    } catch {
        throw new Error(
            'BETTER_AUTH_URL must be a valid URL in production environment'
        );
    }
    if (LOCAL_HOSTS.has(host)) {
        throw new Error(
            'BETTER_AUTH_URL must be a non-local URL in production environment'
        );
    }
    return resolved;
}

/**
 * Resolve the list of trusted origins.
 *
 * Explicit TRUSTED_ORIGINS (comma-separated) are merged with the Vercel-derived
 * origins (production domain + per-deploy URL + branch URL) and deduped, so that
 * pinning origins for production does not silently 403 preview deploys whose
 * per-deploy/branch URLs differ. In production with no source available, throws.
 */
export function resolveTrustedOrigins(
    env: AuthConfigEnv,
    isProduction: boolean
): string[] {
    const explicit = env.TRUSTED_ORIGINS?.trim();
    const explicitList = explicit
        ? explicit
              .split(',')
              .map(o => o.trim())
              .filter(Boolean)
        : [];

    const derived = [
        vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL),
        vercelOrigin(env.VERCEL_URL),
        vercelOrigin(env.VERCEL_BRANCH_URL),
    ].filter((o): o is string => Boolean(o));

    const unique = [...new Set([...explicitList, ...derived])];

    if (unique.length > 0) {
        return unique;
    }

    if (isProduction) {
        throw new Error(
            'TRUSTED_ORIGINS must be set in production environment ' +
                '(or deploy on Vercel so VERCEL_* URLs are available)'
        );
    }
    return [DEV_URL];
}
