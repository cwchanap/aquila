import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const R2DeliveryConfigSchema = z
    .object({
        accountId: z.string().regex(/^[0-9a-f]{32}$/),
        zoneId: z.string().regex(/^[0-9a-f]{32}$/),
        zoneName: z.string().min(1),
        hostname: z.string().min(1),
        buckets: z.object({
            source: z.string().min(3).max(63),
            delivery: z.string().min(3).max(63),
        }),
        cors: z.object({
            allowedOrigins: z.array(z.string().min(1)).nonempty(),
            allowedMethods: z.array(z.enum(['GET', 'HEAD'])).nonempty(),
            allowedHeaders: z.array(z.string().min(1)),
            exposeHeaders: z.array(z.string().min(1)),
            maxAgeSeconds: z.number().int().positive(),
        }),
        // The pointer has no edge TTL to configure: it bypasses the edge cache
        // outright. Cloudflare's Free plan floors Edge TTL at 2 hours, so the
        // 60 seconds this design originally specified is unrepresentable, and
        // a two-hour-stale release pointer defeats the indirection it exists
        // for. See docs/infrastructure/r2-visual-asset-delivery.md §5.
        cache: z.object({
            immutableEdgeTtlSeconds: z.number().int().positive(),
        }),
        publisherToken: z.object({ name: z.string().min(1) }),
    })
    .superRefine((config, ctx) => {
        if (
            config.hostname !== config.zoneName &&
            !config.hostname.endsWith(`.${config.zoneName}`)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `hostname ${config.hostname} must be within zone ${config.zoneName}`,
            });
        }
        if (config.buckets.source === config.buckets.delivery) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'source and delivery bucket names must differ',
            });
        }
    });

export type R2DeliveryConfig = z.infer<typeof R2DeliveryConfigSchema>;

export function parseR2DeliveryConfig(value: unknown): R2DeliveryConfig {
    return R2DeliveryConfigSchema.parse(value);
}

const DEFAULT_CONFIG_PATH = fileURLToPath(
    new URL('../r2-delivery.config.json', import.meta.url)
);

export async function loadR2DeliveryConfig(
    path: string = DEFAULT_CONFIG_PATH
): Promise<R2DeliveryConfig> {
    return parseR2DeliveryConfig(JSON.parse(await readFile(path, 'utf8')));
}
