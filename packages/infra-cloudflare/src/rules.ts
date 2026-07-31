import type { R2DeliveryConfig } from './config';

type RuleBase = {
    description: string;
    expression: string;
    action: 'set_cache_settings';
};

export type CachedRule = RuleBase & {
    action_parameters: {
        cache: true;
        edge_ttl: { mode: 'override_origin'; default: number };
        browser_ttl: { mode: 'respect_origin' };
        respect_strong_etags: true;
    };
};

export type BypassRule = RuleBase & {
    action_parameters: { cache: false };
};

export type CacheRule = CachedRule | BypassRule;

/**
 * Two rules, not three: objects and release manifests are both immutable and
 * share one edge TTL, so they merge into a single predicate.
 *
 * The predicates are mutually exclusive: a content-addressed object is
 * `<sha256>.webp` or `<sha256>.avif` and can never end in `runtime-manifest.json`
 * or `current.json`. Rule order is therefore not load-bearing.
 */
export function buildCacheRules(config: R2DeliveryConfig): CacheRule[] {
    const host = `http.host eq "${config.hostname}"`;
    const scoped = (predicate: string): string => `(${host} and ${predicate})`;

    return [
        {
            description: 'aquila-vn: immutable objects and manifests',
            expression: scoped(
                '(starts_with(http.request.uri.path, "/vn/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json"))'
            ),
            action: 'set_cache_settings',
            action_parameters: {
                cache: true,
                edge_ttl: {
                    mode: 'override_origin',
                    default: config.cache.immutableEdgeTtlSeconds,
                },
                browser_ttl: { mode: 'respect_origin' },
                respect_strong_etags: true,
            },
        },
        // The pointer bypasses the edge cache rather than carrying a short TTL.
        // Cloudflare's Free plan floors Edge TTL at 2 hours (the dashboard will
        // not accept less), and a pointer that can be two hours stale defeats
        // the indirection it exists for — a published release would not reach
        // clients until the TTL lapsed, per PoP.
        //
        // Purging on publish is not the alternative it appears to be: R2 sends
        // `Vary: Origin` on cross-origin responses, so the edge keeps one entry
        // per Origin header, and purge-by-URL clears only the no-Origin variant.
        // Clearing the rest needs Purge Everything, which no publisher should
        // call per release. Measured 2026-07-31; see the runbook §5.
        //
        // The cost is one R2 read per page load of a ~300-byte JSON. The
        // immutable rule above is untouched, so images and manifests still
        // cache for a year and the pointer is the only uncached path.
        {
            description: 'aquila-vn: active release pointer',
            expression: scoped(
                'ends_with(http.request.uri.path, "/current.json")'
            ),
            action: 'set_cache_settings',
            action_parameters: { cache: false },
        },
    ];
}
