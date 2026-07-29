import type { R2DeliveryConfig } from './config';

const API_BASE = 'https://api.cloudflare.com/client/v4';

type CloudflareEnvelope<T> = {
    success: boolean;
    result: T;
    errors?: Array<{ code: number; message: string }>;
};

export class CloudflareApi {
    constructor(
        private readonly token: string,
        private readonly fetchImpl: typeof fetch = fetch
    ) {}

    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await this.fetchImpl(`${API_BASE}${path}`, {
            method,
            headers: {
                authorization: `Bearer ${this.token}`,
                ...(body === undefined
                    ? {}
                    : { 'content-type': 'application/json' }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });

        const envelope = (await response.json()) as CloudflareEnvelope<T>;
        if (!response.ok || !envelope.success) {
            const detail = (envelope.errors ?? [])
                .map(error => `${error.code} ${error.message}`)
                .join('; ');
            throw new Error(
                `Cloudflare ${method} ${path} failed: HTTP ${response.status} ${detail}`
            );
        }
        return envelope.result;
    }
}

export type PreflightResult = { ok: boolean; missing: string[] };

/**
 * `/user/tokens/verify` returns only id/status/expires_on — it cannot report
 * which scopes a token carries. So probe one cheap read per capability the
 * provisioner will exercise and map each failure to the scope to add.
 */
export async function preflight(
    api: CloudflareApi,
    config: R2DeliveryConfig
): Promise<PreflightResult> {
    const probes: Array<{ scope: string; path: string }> = [
        {
            scope: 'Account · Workers R2 Storage · Edit',
            path: `/accounts/${config.accountId}/r2/buckets`,
        },
        {
            scope: 'Zone · Cache Rules · Edit',
            path: `/zones/${config.zoneId}/rulesets`,
        },
        {
            scope: 'Zone · DNS · Edit',
            path: `/zones/${config.zoneId}/dns_records?per_page=1`,
        },
    ];

    const missing: string[] = [];
    for (const probe of probes) {
        try {
            await api.request('GET', probe.path);
        } catch {
            missing.push(probe.scope);
        }
    }
    return { ok: missing.length === 0, missing };
}
