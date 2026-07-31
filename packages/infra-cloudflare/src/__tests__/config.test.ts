import { describe, expect, it } from 'vitest';
import { parseR2DeliveryConfig } from '../config';

const valid = {
    accountId: '91ee89a03a31b5354a25c49228e4ab85',
    zoneId: 'a72a26e71e9b9e4b91d1523aafab7d06',
    zoneName: 'cwchanap.dev',
    hostname: 'assets.aquila.cwchanap.dev',
    buckets: {
        source: 'aquila-vn-source',
        delivery: 'aquila-vn-delivery',
    },
    cors: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'HEAD'],
        allowedHeaders: ['range', 'if-match', 'if-none-match'],
        exposeHeaders: ['etag', 'content-length', 'cf-cache-status'],
        maxAgeSeconds: 86400,
    },
    cache: {
        immutableEdgeTtlSeconds: 31536000,
    },
    publisherToken: { name: 'aquila-vn-publisher' },
};

describe('parseR2DeliveryConfig', () => {
    it('accepts the canonical configuration', () => {
        expect(parseR2DeliveryConfig(valid).hostname).toBe(
            'assets.aquila.cwchanap.dev'
        );
    });

    it('rejects a hostname outside the configured zone', () => {
        expect(() =>
            parseR2DeliveryConfig({ ...valid, hostname: 'assets.example.com' })
        ).toThrow(/must be within zone/);
    });

    it('rejects identical source and delivery bucket names', () => {
        expect(() =>
            parseR2DeliveryConfig({
                ...valid,
                buckets: { source: 'same', delivery: 'same' },
            })
        ).toThrow(/must differ/);
    });

    // The pointer bypasses the edge cache, so there is no pointer TTL to
    // validate against. A stray one is a stale config that must not pass
    // silently — Zod strips unknown keys by default, so this asserts the
    // parsed result rather than a throw.
    it('does not carry a pointer edge TTL', () => {
        const parsed = parseR2DeliveryConfig({
            ...valid,
            cache: { ...valid.cache, pointerEdgeTtlSeconds: 60 },
        });
        expect(parsed.cache).toEqual({ immutableEdgeTtlSeconds: 31536000 });
    });
});
