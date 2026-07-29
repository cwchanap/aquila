import { describe, expect, it } from 'vitest';
import { CloudflareApi, preflight } from '../api';
import { parseR2DeliveryConfig } from '../config';
import config from '../../r2-delivery.config.json';

const parsed = parseR2DeliveryConfig(config);

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

describe('CloudflareApi', () => {
    it('sends the bearer token and returns the result payload', async () => {
        const seen: { url?: string; auth?: string } = {};
        const api = new CloudflareApi('tok', async (input, init) => {
            seen.url = String(input);
            seen.auth = new Headers(init?.headers).get('authorization') ?? '';
            return jsonResponse({ success: true, result: { id: 'abc' } });
        });

        await expect(api.request('GET', '/zones')).resolves.toEqual({
            id: 'abc',
        });
        expect(seen.url).toBe('https://api.cloudflare.com/client/v4/zones');
        expect(seen.auth).toBe('Bearer tok');
    });

    it('throws with the cloudflare error message on failure', async () => {
        const api = new CloudflareApi('tok', async () =>
            jsonResponse(
                { success: false, errors: [{ code: 10000, message: 'nope' }] },
                403
            )
        );

        await expect(api.request('GET', '/zones')).rejects.toThrow(
            /403.*10000.*nope/
        );
    });
});

describe('preflight', () => {
    it('reports ok when every capability probe succeeds', async () => {
        const api = new CloudflareApi('tok', async () =>
            jsonResponse({ success: true, result: [] })
        );
        await expect(preflight(api, parsed)).resolves.toEqual({
            ok: true,
            missing: [],
        });
    });

    it('names the missing scope for each forbidden probe', async () => {
        const api = new CloudflareApi('tok', async input =>
            String(input).includes('/rulesets')
                ? jsonResponse({ success: false, errors: [] }, 403)
                : jsonResponse({ success: true, result: [] })
        );

        const result = await preflight(api, parsed);
        expect(result.ok).toBe(false);
        expect(result.missing).toEqual(['Zone · Cache Rules · Edit']);
    });
});
