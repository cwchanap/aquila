import { describe, expect, it } from 'vitest';
import { parseR2DeliveryConfig } from '../config';
import { buildCacheRules } from '../rules';
import config from '../../r2-delivery.config.json';

const parsed = parseR2DeliveryConfig(config);

describe('buildCacheRules', () => {
    it('builds exactly three rules within the free-plan budget', () => {
        expect(buildCacheRules(parsed)).toHaveLength(3);
    });

    it('caches objects for a year and respects strong etags', () => {
        const [objects] = buildCacheRules(parsed);
        expect(objects.expression).toBe(
            '(http.host eq "assets.aquila.cwchanap.dev" and starts_with(http.request.uri.path, "/vn/objects/"))'
        );
        expect(objects.action_parameters.cache).toBe(true);
        expect(objects.action_parameters.edge_ttl).toEqual({
            mode: 'override_origin',
            default: 31536000,
        });
        expect(objects.action_parameters.respect_strong_etags).toBe(true);
    });

    it('gives the pointer a short edge ttl but leaves browser ttl to the origin', () => {
        const pointer = buildCacheRules(parsed)[2];
        expect(pointer.expression).toContain('"/current.json"');
        expect(pointer.action_parameters.edge_ttl).toEqual({
            mode: 'override_origin',
            default: 60,
        });
        expect(pointer.action_parameters.browser_ttl).toEqual({
            mode: 'respect_origin',
        });
    });

    it('gives every rule a stable description for idempotent matching', () => {
        const descriptions = buildCacheRules(parsed).map(
            rule => rule.description
        );
        expect(descriptions).toEqual([
            'aquila-vn: immutable objects',
            'aquila-vn: immutable release manifests',
            'aquila-vn: active release pointer',
        ]);
    });
});
