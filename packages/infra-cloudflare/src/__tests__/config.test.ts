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
        pointerEdgeTtlSeconds: 60,
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

    it('rejects a pointer edge TTL that is not shorter than the immutable TTL', () => {
        expect(() =>
            parseR2DeliveryConfig({
                ...valid,
                cache: {
                    immutableEdgeTtlSeconds: 60,
                    pointerEdgeTtlSeconds: 60,
                },
            })
        ).toThrow(/shorter than/);
    });
});
