import { describe, expect, it } from 'vitest';
import { parseR2DeliveryConfig } from '../config';
import { buildCacheRules } from '../rules';
import config from '../../r2-delivery.config.json';

const parsed = parseR2DeliveryConfig(config);

describe('buildCacheRules', () => {
    it('builds exactly two rules within the free-plan budget', () => {
        expect(buildCacheRules(parsed)).toHaveLength(2);
    });

    it('caches objects and manifests for a year and respects strong etags', () => {
        const [immutable] = buildCacheRules(parsed);
        expect(immutable.expression).toBe(
            '(http.host eq "assets.aquila.cwchanap.dev" and (starts_with(http.request.uri.path, "/vn/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json")))'
        );
        expect(immutable.action_parameters).toEqual({
            cache: true,
            edge_ttl: { mode: 'override_origin', default: 31536000 },
            browser_ttl: { mode: 'respect_origin' },
            respect_strong_etags: true,
        });
    });

    it('parenthesises the or-group so it binds tighter than the host check', () => {
        // `and` binds tighter than `or` in Cloudflare's expression language, so
        // without the inner parentheses the manifest branch would match on every
        // host — including any other bucket later attached to this zone.
        const [immutable] = buildCacheRules(parsed);
        expect(immutable.expression).toContain(
            'and (starts_with(http.request.uri.path, "/vn/objects/") or '
        );
    });

    it('bypasses the edge cache for the pointer rather than giving it a TTL', () => {
        // Cloudflare's Free plan floors Edge TTL at 2 hours, so the 60 seconds
        // this design asked for cannot be expressed. Bypass is what actually
        // delivers the property the short TTL was for: a published release
        // reaches clients immediately.
        const pointer = buildCacheRules(parsed)[1];
        expect(pointer.expression).toBe(
            '(http.host eq "assets.aquila.cwchanap.dev" and ends_with(http.request.uri.path, "/current.json"))'
        );
        expect(pointer.action_parameters).toEqual({ cache: false });
    });

    it('never gives the pointer an edge ttl, whatever the config says', () => {
        // Guards the regression this replaced: a pointer that is cacheable at
        // all is a pointer that can serve a superseded release.
        const pointer = buildCacheRules(parsed)[1];
        expect(pointer.action_parameters).not.toHaveProperty('edge_ttl');
    });

    it('scopes every rule to the delivery hostname', () => {
        for (const rule of buildCacheRules(parsed)) {
            expect(rule.expression).toContain(
                'http.host eq "assets.aquila.cwchanap.dev"'
            );
        }
    });

    it('gives every rule a stable description for idempotent matching', () => {
        const descriptions = buildCacheRules(parsed).map(
            rule => rule.description
        );
        expect(descriptions).toEqual([
            'aquila-vn: immutable objects and manifests',
            'aquila-vn: active release pointer',
        ]);
    });
});
