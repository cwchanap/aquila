import type { R2DeliveryConfig } from './config';

const API_BASE = 'https://api.cloudflare.com/client/v4';

type CloudflareEnvelope<T> = {
    success: boolean;
    result: T;
    errors?: Array<{ code: number; message: string }>;
};

export class CloudflareApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'CloudflareApiError';
    }
}

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

        let envelope: CloudflareEnvelope<T>;
        try {
            envelope = (await response.json()) as CloudflareEnvelope<T>;
        } catch {
            throw new CloudflareApiError(
                `Cloudflare ${method} ${path} failed: HTTP ${response.status} (non-JSON response body)`,
                response.status
            );
        }

        if (!response.ok || !envelope.success) {
            const detail = (envelope.errors ?? [])
                .map(error => `${error.code} ${error.message}`)
                .join('; ');
            throw new CloudflareApiError(
                `Cloudflare ${method} ${path} failed: HTTP ${response.status} ${detail}`,
                response.status
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
 *
 * Only a 401/403 from a probe is treated as "scope missing" — that's the
 * signature of the token lacking authorization for that call. Any other
 * failure (a different HTTP status, a non-JSON body, a network rejection)
 * is a genuine API/connectivity problem, not a scope gap, and is rethrown
 * so the operator sees the real failure instead of a fabricated diagnosis.
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
        } catch (error) {
            if (
                error instanceof CloudflareApiError &&
                (error.status === 401 || error.status === 403)
            ) {
                missing.push(probe.scope);
            } else {
                throw error;
            }
        }
    }
    return { ok: missing.length === 0, missing };
}
