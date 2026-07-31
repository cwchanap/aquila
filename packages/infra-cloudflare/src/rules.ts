import type { R2DeliveryConfig } from './config';

export type CacheRule = {
    description: string;
    expression: string;
    action: 'set_cache_settings';
    action_parameters: {
        cache: true;
        edge_ttl: { mode: 'override_origin'; default: number };
        browser_ttl: { mode: 'respect_origin' };
        respect_strong_etags: true;
    };
};

/**
 * Two rules, not three: objects and release manifests are both immutable and
 * share one edge TTL, so they merge into a single predicate. The pointer cannot
 * join them — a cache rule carries exactly one edge TTL, and the pointer's is 60
 * seconds rather than a year.
 *
 * The predicates are mutually exclusive: a content-addressed object is
 * `<sha256>.webp` or `<sha256>.avif` and can never end in `runtime-manifest.json`
 * or `current.json`. Rule order is therefore not load-bearing.
 */
export function buildCacheRules(config: R2DeliveryConfig): CacheRule[] {
    const host = `http.host eq "${config.hostname}"`;
    const rule = (
        description: string,
        predicate: string,
        edgeTtlSeconds: number
    ): CacheRule => ({
        description,
        expression: `(${host} and ${predicate})`,
        action: 'set_cache_settings',
        action_parameters: {
            cache: true,
            edge_ttl: { mode: 'override_origin', default: edgeTtlSeconds },
            browser_ttl: { mode: 'respect_origin' },
            respect_strong_etags: true,
        },
    });

    return [
        rule(
            'aquila-vn: immutable objects and manifests',
            '(starts_with(http.request.uri.path, "/vn/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json"))',
            config.cache.immutableEdgeTtlSeconds
        ),
        rule(
            'aquila-vn: active release pointer',
            'ends_with(http.request.uri.path, "/current.json")',
            config.cache.pointerEdgeTtlSeconds
        ),
    ];
}
