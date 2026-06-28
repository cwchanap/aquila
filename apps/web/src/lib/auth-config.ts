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
 * Normalize a host string for the LOCAL_HOSTS loopback check.
 *
 * `new URL('http://[::1]:5090').hostname` returns `[::1]` (WHATWG keeps IPv6
 * brackets), and wildcard labels can carry a port suffix (`localhost:3000`),
 * neither of which would match `LOCAL_HOSTS` directly. Strip surrounding IPv6
 * brackets and a trailing `:port` so the production loopback hardening actually
 * rejects all loopback origins. Bare IPv6 addresses (multiple colons, no
 * brackets) are left alone since they don't carry ports in this form.
 */
function normalizeHostForLoopbackCheck(host: string): string {
    const h = host.toLowerCase();
    if (h.startsWith('[') && h.endsWith(']')) {
        return h.slice(1, -1);
    }
    const colonIndex = h.lastIndexOf(':');
    if (colonIndex > 0 && h.indexOf(':') === colonIndex) {
        const candidate = h.slice(colonIndex + 1);
        if (/^\d+$/.test(candidate)) {
            return h.slice(0, colonIndex);
        }
    }
    return h;
}

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
        host = normalizeHostForLoopbackCheck(new URL(resolved).hostname);
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
              .flatMap(o => normalizeExplicitOrigin(o, isProduction))
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

/**
 * Normalize a single explicit TRUSTED_ORIGINS entry into a safe origin.
 *
 * Two forms are supported, matching Better Auth's `matchesPattern`:
 *   - Plain origins (`https://example.com`): parsed with `new URL()` so
 *     malformed values are dropped instead of leaking into the allowlist.
 *     Kept only http/https (rejects javascript:, data:, file:, etc.),
 *     normalized to `.origin` so trailing paths/queries don't bypass deduping,
 *     and rejected if localhost / loopback in production.
 *   - Wildcard patterns (`*.example.com` or `https://*.example.com`): Better
 *     Auth matches these via `wildcardMatch` against the host (no scheme) or
 *     the origin (with scheme). `new URL()` rejects bare wildcards, so they
 *     are preserved verbatim after light validation instead of being silently
 *     dropped — otherwise a wildcard-only `TRUSTED_ORIGINS` would throw at
 *     startup (no origins resolved) or silently lose legitimate subdomains.
 *
 * Returns an empty array (drop the entry) if the value is invalid or local in
 * production; otherwise a single-element array with the normalized origin.
 */
function normalizeExplicitOrigin(raw: string, isProduction: boolean): string[] {
    if (raw.includes('*')) {
        return normalizeWildcardOrigin(raw, isProduction);
    }
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        return [];
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return [];
    }
    const origin = parsed.origin;
    if (isProduction) {
        let host = '';
        try {
            host = normalizeHostForLoopbackCheck(new URL(origin).hostname);
        } catch {
            return [];
        }
        if (LOCAL_HOSTS.has(host)) {
            return [];
        }
    }
    return [origin];
}

/**
 * Validate and preserve a wildcard trusted-origin pattern.
 *
 * Accepted forms (matched by Better Auth's `matchesPattern`):
 *   - `*.example.com`        → matched against the request host
 *   - `https://*.example.com`→ matched against the request origin
 *
 * Validation:
 *   - Must contain exactly one `*` and at least one literal label beside it
 *     (rejects `*`, `*.*`, `*.`, etc. which would over-match or match nothing
 *     useful).
 *   - If a scheme is present it must be http/https (rejects `file://*` etc.).
 *   - In production, reject patterns that can only match loopback hosts
 *     (`*.localhost`, `*.127.0.0.1`, `*.::1`).
 *
 * The pattern is returned verbatim (trimmed) — Better Auth does its own
 * wildcard matching, so re-serializing via `new URL()` would corrupt it.
 */
function normalizeWildcardOrigin(raw: string, isProduction: boolean): string[] {
    const pattern = raw.trim();
    if (!pattern) return [];

    const starCount = (pattern.match(/\*/g) || []).length;
    if (starCount !== 1) return [];

    // Split off an optional scheme.
    let scheme: string | undefined;
    let body = pattern;
    const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(pattern);
    if (schemeMatch) {
        scheme = schemeMatch[1].toLowerCase();
        body = pattern.slice(schemeMatch[0].length);
    }
    if (scheme !== undefined && scheme !== 'http' && scheme !== 'https') {
        return [];
    }

    // Body must be a non-empty host-like string with one `*` and at least one
    // literal label. Reject `*`, `*.`, `*.*`, `*example` (no separator).
    if (!body || body.startsWith('.') || body.endsWith('.')) return [];
    const labels = body.split('.');
    if (labels.length < 2) return [];
    // `*` must occupy its own DNS label. A glued form like `*example.com`
    // would be serialized by Better Auth as `.*?example\.com`, matching any
    // host ending in `example.com` (e.g. `evil-example.com`), so a typo would
    // silently trust attacker hosts. Reject any label that contains `*` but
    // is not exactly `*`.
    if (labels.some(l => l.includes('*') && l !== '*')) return [];
    const literalLabels = labels.filter(l => l && l !== '*');
    if (literalLabels.length === 0) return [];

    if (isProduction) {
        // Reject patterns that can only resolve to loopback hosts. Reconstruct
        // the full non-wildcard suffix (e.g. `127.0.0.1` from `*.127.0.0.1`)
        // and strip any `:port` carried on the final label before comparing.
        // Checking only the last dot label would miss IPv4 loopback wildcards
        // like `https://*.127.0.0.1:3000`, whose last label is `1`/`1:3000`
        // and is not in LOCAL_HOSTS on its own.
        const suffix = normalizeHostForLoopbackCheck(literalLabels.join('.'));
        if (LOCAL_HOSTS.has(suffix)) return [];
    }

    return [pattern];
}
