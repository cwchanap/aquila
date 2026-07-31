# HPA-229 R2 Visual Asset Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision Cloudflare R2 delivery of Aquila visual-novel assets on `assets.aquila.cwchanap.dev`, and make the web reader select its asset source from environment configuration.

**Architecture:** A new `@aquila/infra-cloudflare` workspace holds a declarative config file plus four scripts — an idempotent provisioner, a one-shot publisher-token minter, a smoke-fixture seeder, and a verifier. Pure logic (config parsing, reconcile planning, response assertions, preview-id slugification) lives in unit-tested modules; the scripts are thin CLI wrappers. The web app gains a single env-reading boundary that produces an `AssetSourceConfig`, injected into the existing `getAssetResolverSource()`.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Vitest 4, Zod 3, `sharp` 0.34.5, `wrangler` 4.67 CLI, Cloudflare REST API v4, Playwright 1.55.

**Design spec:** `docs/superpowers/specs/2026-07-28-hpa-229-r2-visual-asset-delivery-design.md`

## Global Constraints

- **Account:** `91ee89a03a31b5354a25c49228e4ab85`. **Zone:** `cwchanap.dev` = `a72a26e71e9b9e4b91d1523aafab7d06` (Free plan).
- **Hostname:** `assets.aquila.cwchanap.dev`. **Buckets:** `aquila-vn-source` (private), `aquila-vn-delivery` (public via custom domain only).
- **Cache Rules budget:** Free plan allows 10 per zone; this work uses 2.
- **Immutable `Cache-Control`:** exactly `public, max-age=31536000, immutable`.
- **Pointer `Cache-Control`:** exactly `no-cache, max-age=0, must-revalidate`.
- **Two cache rules, not three.** The immutable rule covers both objects (`/vn/objects/`) and release manifests (`runtime-manifest.json`) with `edge_ttl: { mode: 'override_origin' }` and `respect_strong_etags: true`. The `/current.json` active-release pointer bypasses the edge cache entirely (`cache: false`) — Cloudflare's Free plan floors Edge TTL at 2 hours, so the 60-second pointer TTL this design originally specified is unrepresentable, and a two-hour-stale pointer defeats the indirection it exists for. The bypass rule carries no Edge TTL, Browser TTL, or ETag fields. See `docs/infrastructure/r2-visual-asset-delivery.md` §2.6 and §5.
- **CORS:** `AllowedOrigins: ["*"]`, `AllowedMethods: ["GET","HEAD"]`, `AllowedHeaders: ["range","if-match","if-none-match"]`, `ExposeHeaders: ["etag","content-length","cf-cache-status"]`, `MaxAgeSeconds: 86400`.
- **Never delete:** no script may delete a bucket, object, rule, or domain. Removal is a manual act.
- **Publication layout** is fixed by HPA-227; always compute paths with `getObjectPath()`, `getReleaseManifestPath()`, `getCurrentPointerPath()` from `@aquila/stories/runtime-assets`. Never hand-build a path string.
- **Indentation:** 4 spaces, single quotes, semicolons (matches existing repo style and Prettier config).
- **Commit style:** Conventional Commits, e.g. `feat(infra): ...`, `test(web): ...`.

## Two deviations from the spec, and why

1. **Location: `packages/infra-cloudflare/`, not `infra/cloudflare/`.** Root `package.json` declares `workspaces: ["apps/*", "packages/*"]`. Code at `infra/` would be outside every workspace, so `bun test`, `bun lint`, and Turbo would silently skip it — unacceptable for the code that provisions production delivery. Placing it under `packages/` makes it a first-class workspace with the same wiring as `@aquila/stories`.

2. **Smoke fixtures are generated, not checked in.** The spec said to check binaries into `infra/cloudflare/fixtures/`. `apps/web/scripts/build-visual-fixtures.ts` already generates a contract-conformant tree from `packages/assets/media` sources, so `seed.ts` reuses that approach instead of committing a second copy of near-identical images. The seeder additionally emits **AVIF**, which the existing local fixtures do not have and which verification check 3 requires.

## File Structure

| File | Responsibility |
|---|---|
| `packages/infra-cloudflare/package.json` | Workspace manifest, scripts, deps |
| `packages/infra-cloudflare/vitest.config.ts` | Test config (mirrors `packages/stories`) |
| `packages/infra-cloudflare/tsconfig.json` | TS config |
| `packages/infra-cloudflare/r2-delivery.config.json` | Declarative desired state |
| `packages/infra-cloudflare/src/config.ts` | Zod schema + loader for the config file |
| `packages/infra-cloudflare/src/api.ts` | Thin Cloudflare REST client + capability preflight |
| `packages/infra-cloudflare/src/plan.ts` | Pure reconcile-plan computation (current vs desired) |
| `packages/infra-cloudflare/src/rules.ts` | Builds the three cache-rule objects from config |
| `packages/infra-cloudflare/src/provision.ts` | CLI: apply the plan, `--dry-run` |
| `packages/infra-cloudflare/src/create-publisher-token.ts` | CLI: one-shot token mint |
| `packages/infra-cloudflare/src/seed.ts` | CLI: build + upload the smoke release |
| `packages/infra-cloudflare/src/assertions.ts` | Pure response-header assertions |
| `packages/infra-cloudflare/src/verify.ts` | CLI: HTTP smoke tests |
| `apps/web/src/lib/visual-assets/asset-source-config.ts` | `AssetSourceConfig` type + env parsing + truth table |
| `apps/web/src/lib/visual-assets/source-factory.ts` | Modified: accept injected config |
| `apps/web/scripts/asset-preview-id.ts` | Derive a valid preview id from the branch |
| `packages/e2e/tests/r2-delivery.spec.ts` | Real-browser fetch + decode check |
| `docs/infrastructure/r2-visual-asset-delivery.md` | Runbook |

---

### Task 1: Workspace scaffold and config schema

**Files:**
- Create: `packages/infra-cloudflare/package.json`
- Create: `packages/infra-cloudflare/tsconfig.json`
- Create: `packages/infra-cloudflare/vitest.config.ts`
- Create: `packages/infra-cloudflare/r2-delivery.config.json`
- Create: `packages/infra-cloudflare/src/config.ts`
- Create: `packages/infra-cloudflare/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `R2DeliveryConfig` type and `parseR2DeliveryConfig(value: unknown): R2DeliveryConfig`, `loadR2DeliveryConfig(path?: string): Promise<R2DeliveryConfig>`. Every later task reads config through these.

- [ ] **Step 1: Create the workspace manifest**

`packages/infra-cloudflare/package.json`:

```json
{
    "name": "@aquila/infra-cloudflare",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
        "lint": "eslint src",
        "test": "vitest run",
        "test:watch": "vitest",
        "provision": "bun src/provision.ts",
        "provision:dry": "bun src/provision.ts --dry-run",
        "create-publisher-token": "bun src/create-publisher-token.ts",
        "seed": "bun src/seed.ts",
        "verify": "bun src/verify.ts"
    },
    "dependencies": {
        "@aquila/stories": "workspace:*",
        "zod": "^3.24.2"
    },
    "devDependencies": {
        "@types/node": "^20.0.0",
        "@vitest/coverage-v8": "^4.0.18",
        "sharp": "0.34.5",
        "typescript": "^5.3.3",
        "vitest": "^4.0.18"
    }
}
```

- [ ] **Step 2: Create tsconfig and vitest config**

`packages/infra-cloudflare/tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "resolveJsonModule": true,
        "strict": true,
        "noEmit": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "types": ["node"]
    },
    "include": ["src/**/*.ts"]
}
```

`packages/infra-cloudflare/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/**/*.test.ts'],
            reporter: ['text', 'lcov'],
        },
    },
});
```

- [ ] **Step 3: Write the failing config test**

`packages/infra-cloudflare/src/__tests__/config.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `bun --filter @aquila/infra-cloudflare test`
Expected: FAIL — cannot resolve `../config`.

- [ ] **Step 5: Implement the config module**

`packages/infra-cloudflare/src/config.ts`:

```ts
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
        cache: z.object({
            immutableEdgeTtlSeconds: z.number().int().positive(),
            pointerEdgeTtlSeconds: z.number().int().positive(),
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
        if (
            config.cache.pointerEdgeTtlSeconds >=
            config.cache.immutableEdgeTtlSeconds
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'pointerEdgeTtlSeconds must be shorter than immutableEdgeTtlSeconds',
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
```

- [ ] **Step 6: Create the config file**

`packages/infra-cloudflare/r2-delivery.config.json`:

```json
{
    "accountId": "91ee89a03a31b5354a25c49228e4ab85",
    "zoneId": "a72a26e71e9b9e4b91d1523aafab7d06",
    "zoneName": "cwchanap.dev",
    "hostname": "assets.aquila.cwchanap.dev",
    "buckets": {
        "source": "aquila-vn-source",
        "delivery": "aquila-vn-delivery"
    },
    "cors": {
        "allowedOrigins": ["*"],
        "allowedMethods": ["GET", "HEAD"],
        "allowedHeaders": ["range", "if-match", "if-none-match"],
        "exposeHeaders": ["etag", "content-length", "cf-cache-status"],
        "maxAgeSeconds": 86400
    },
    "cache": {
        "immutableEdgeTtlSeconds": 31536000,
        "pointerEdgeTtlSeconds": 60
    },
    "publisherToken": { "name": "aquila-vn-publisher" }
}
```

- [ ] **Step 7: Install and run the tests**

Run: `bun install && bun --filter @aquila/infra-cloudflare test`
Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare bun.lock
git commit -m "feat(infra): add cloudflare r2 delivery config schema and workspace"
```

---

### Task 2: Cache-rule construction

**Files:**
- Create: `packages/infra-cloudflare/src/rules.ts`
- Create: `packages/infra-cloudflare/src/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `R2DeliveryConfig` from Task 1.
- Produces: `type CacheRule` and `buildCacheRules(config: R2DeliveryConfig): CacheRule[]`, consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

`packages/infra-cloudflare/src/__tests__/rules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter @aquila/infra-cloudflare test rules`
Expected: FAIL — cannot resolve `../rules`.

- [ ] **Step 3: Implement the rule builder**

`packages/infra-cloudflare/src/rules.ts`:

```ts
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
 * The three predicates are mutually exclusive: a content-addressed object is
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
            'aquila-vn: immutable objects',
            'starts_with(http.request.uri.path, "/vn/objects/")',
            config.cache.immutableEdgeTtlSeconds
        ),
        rule(
            'aquila-vn: immutable release manifests',
            'ends_with(http.request.uri.path, "/runtime-manifest.json")',
            config.cache.immutableEdgeTtlSeconds
        ),
        rule(
            'aquila-vn: active release pointer',
            'ends_with(http.request.uri.path, "/current.json")',
            config.cache.pointerEdgeTtlSeconds
        ),
    ];
}
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter @aquila/infra-cloudflare test`
Expected: PASS, 8 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/infra-cloudflare/src
git commit -m "feat(infra): build aquila cache rules from delivery config"
```

---

### Task 3: Cloudflare API client with capability preflight

**Files:**
- Create: `packages/infra-cloudflare/src/api.ts`
- Create: `packages/infra-cloudflare/src/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `R2DeliveryConfig` from Task 1.
- Produces:
  - `class CloudflareApi` with `constructor(token: string, fetchImpl?: typeof fetch)` and `request<T>(method: string, path: string, body?: unknown): Promise<T>`.
  - `preflight(api: CloudflareApi, config: R2DeliveryConfig): Promise<PreflightResult>` where `type PreflightResult = { ok: boolean; missing: string[] }`.
  Used by Tasks 4, 5, 6.

- [ ] **Step 1: Write the failing test**

`packages/infra-cloudflare/src/__tests__/api.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter @aquila/infra-cloudflare test api`
Expected: FAIL — cannot resolve `../api`.

- [ ] **Step 3: Implement the API client and preflight**

`packages/infra-cloudflare/src/api.ts`:

```ts
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

    async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
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
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter @aquila/infra-cloudflare test`
Expected: PASS, 12 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/infra-cloudflare/src
git commit -m "feat(infra): add cloudflare api client with capability preflight"
```

---

### Task 4: Idempotent provisioner with dry-run

**Files:**
- Create: `packages/infra-cloudflare/src/plan.ts`
- Create: `packages/infra-cloudflare/src/__tests__/plan.test.ts`
- Create: `packages/infra-cloudflare/src/provision.ts`

**Interfaces:**
- Consumes: `R2DeliveryConfig` (Task 1), `buildCacheRules` (Task 2), `CloudflareApi` + `preflight` (Task 3).
- Produces: `type ProvisionAction = { kind: string; description: string }` and `computeProvisionPlan(config, current: CurrentState): ProvisionAction[]`, where `type CurrentState = { buckets: string[]; customDomains: string[]; corsMatches: boolean; cacheRuleDescriptions: string[] }`.

- [ ] **Step 1: Write the failing plan test**

`packages/infra-cloudflare/src/__tests__/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseR2DeliveryConfig } from '../config';
import { computeProvisionPlan, type CurrentState } from '../plan';
import config from '../../r2-delivery.config.json';

const parsed = parseR2DeliveryConfig(config);

const converged: CurrentState = {
    buckets: ['aquila-vn-source', 'aquila-vn-delivery'],
    customDomains: ['assets.aquila.cwchanap.dev'],
    corsMatches: true,
    cacheRuleDescriptions: [
        'aquila-vn: immutable objects',
        'aquila-vn: immutable release manifests',
        'aquila-vn: active release pointer',
    ],
};

describe('computeProvisionPlan', () => {
    it('plans nothing when the account already matches the config', () => {
        expect(computeProvisionPlan(parsed, converged)).toEqual([]);
    });

    it('plans both bucket creations on an empty account', () => {
        const plan = computeProvisionPlan(parsed, {
            buckets: [],
            customDomains: [],
            corsMatches: false,
            cacheRuleDescriptions: [],
        });
        expect(plan.filter(action => action.kind === 'create-bucket')).toEqual([
            {
                kind: 'create-bucket',
                description: 'Create bucket aquila-vn-source',
            },
            {
                kind: 'create-bucket',
                description: 'Create bucket aquila-vn-delivery',
            },
        ]);
    });

    it('never plans a delete when an unrelated bucket exists', () => {
        const plan = computeProvisionPlan(parsed, {
            ...converged,
            buckets: [...converged.buckets, 'someone-elses-bucket'],
        });
        expect(plan).toEqual([]);
    });

    it('replaces the whole cache ruleset when any rule is missing', () => {
        const plan = computeProvisionPlan(parsed, {
            ...converged,
            cacheRuleDescriptions: ['aquila-vn: immutable objects'],
        });
        expect(plan).toContainEqual({
            kind: 'put-cache-rules',
            description: 'Update cache ruleset to 3 aquila-vn rules',
        });
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter @aquila/infra-cloudflare test plan`
Expected: FAIL — cannot resolve `../plan`.

- [ ] **Step 3: Implement the plan computation**

`packages/infra-cloudflare/src/plan.ts`:

```ts
import type { R2DeliveryConfig } from './config';
import { buildCacheRules } from './rules';

export type CurrentState = {
    buckets: string[];
    customDomains: string[];
    corsMatches: boolean;
    cacheRuleDescriptions: string[];
};

export type ProvisionAction = { kind: string; description: string };

/**
 * Additive only. Resources present in the account but absent from config are
 * left untouched — a config typo must never destroy a bucket.
 */
export function computeProvisionPlan(
    config: R2DeliveryConfig,
    current: CurrentState
): ProvisionAction[] {
    const actions: ProvisionAction[] = [];

    for (const bucket of [config.buckets.source, config.buckets.delivery]) {
        if (!current.buckets.includes(bucket)) {
            actions.push({
                kind: 'create-bucket',
                description: `Create bucket ${bucket}`,
            });
        }
    }

    if (!current.corsMatches) {
        actions.push({
            kind: 'put-cors',
            description: `Set CORS policy on ${config.buckets.delivery}`,
        });
    }

    if (!current.customDomains.includes(config.hostname)) {
        actions.push({
            kind: 'attach-domain',
            description: `Attach ${config.hostname} to ${config.buckets.delivery}`,
        });
    }

    const desired = buildCacheRules(config).map(rule => rule.description);
    const hasAll = desired.every(description =>
        current.cacheRuleDescriptions.includes(description)
    );
    if (!hasAll) {
        actions.push({
            kind: 'put-cache-rules',
            description: `Update cache ruleset to ${desired.length} aquila-vn rules`,
        });
    }

    return actions;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter @aquila/infra-cloudflare test`
Expected: PASS, 16 tests total.

- [ ] **Step 5: Implement the provisioner CLI**

`packages/infra-cloudflare/src/provision.ts`:

```ts
import { CloudflareApi, preflight } from './api';
import { loadR2DeliveryConfig, type R2DeliveryConfig } from './config';
import { computeProvisionPlan, type CurrentState } from './plan';
import { buildCacheRules } from './rules';

const CACHE_PHASE = 'http_request_cache_settings';

async function readCurrentState(
    api: CloudflareApi,
    config: R2DeliveryConfig
): Promise<CurrentState> {
    const bucketList = await api.request<{ buckets: Array<{ name: string }> }>(
        'GET',
        `/accounts/${config.accountId}/r2/buckets`
    );
    const buckets = bucketList.buckets.map(bucket => bucket.name);

    let customDomains: string[] = [];
    let corsMatches = false;
    if (buckets.includes(config.buckets.delivery)) {
        const domains = await api.request<{
            domains: Array<{ domain: string; enabled: boolean }>;
        }>(
            'GET',
            `/accounts/${config.accountId}/r2/buckets/${config.buckets.delivery}/domains/custom`
        );
        customDomains = domains.domains
            .filter(domain => domain.enabled)
            .map(domain => domain.domain);

        try {
            const cors = await api.request<{
                rules?: Array<{ allowed?: { origins?: string[] } }>;
            }>(
                'GET',
                `/accounts/${config.accountId}/r2/buckets/${config.buckets.delivery}/cors`
            );
            corsMatches =
                JSON.stringify(cors.rules?.[0]?.allowed?.origins ?? []) ===
                JSON.stringify(config.cors.allowedOrigins);
        } catch {
            corsMatches = false;
        }
    }

    const rulesets = await api.request<
        Array<{ id: string; phase: string; description?: string }>
    >('GET', `/zones/${config.zoneId}/rulesets`);
    const entrypoint = rulesets.find(ruleset => ruleset.phase === CACHE_PHASE);
    let cacheRuleDescriptions: string[] = [];
    if (entrypoint) {
        const detail = await api.request<{
            rules?: Array<{ description?: string }>;
        }>('GET', `/zones/${config.zoneId}/rulesets/${entrypoint.id}`);
        cacheRuleDescriptions = (detail.rules ?? []).flatMap(rule =>
            rule.description ? [rule.description] : []
        );
    }

    return { buckets, customDomains, corsMatches, cacheRuleDescriptions };
}

async function applyAction(
    api: CloudflareApi,
    config: R2DeliveryConfig,
    kind: string
): Promise<void> {
    const account = `/accounts/${config.accountId}`;
    if (kind === 'create-bucket') return; // handled explicitly below
    if (kind === 'put-cors') {
        await api.request(
            'PUT',
            `${account}/r2/buckets/${config.buckets.delivery}/cors`,
            {
                rules: [
                    {
                        allowed: {
                            origins: config.cors.allowedOrigins,
                            methods: config.cors.allowedMethods,
                            headers: config.cors.allowedHeaders,
                        },
                        exposeHeaders: config.cors.exposeHeaders,
                        maxAgeSeconds: config.cors.maxAgeSeconds,
                    },
                ],
            }
        );
        return;
    }
    if (kind === 'attach-domain') {
        await api.request(
            'POST',
            `${account}/r2/buckets/${config.buckets.delivery}/domains/custom`,
            {
                domain: config.hostname,
                zoneId: config.zoneId,
                enabled: true,
            }
        );
        return;
    }
    if (kind === 'put-cache-rules') {
        await api.request('PUT', `/zones/${config.zoneId}/rulesets/phases/${CACHE_PHASE}/entrypoint`, {
            rules: buildCacheRules(config),
        });
    }
}

async function main(): Promise<void> {
    const dryRun = process.argv.includes('--dry-run');
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        console.error('CLOUDFLARE_API_TOKEN is not set.');
        process.exit(1);
    }

    const config = await loadR2DeliveryConfig();
    const api = new CloudflareApi(token);

    const scopes = await preflight(api, config);
    if (!scopes.ok) {
        console.error('Token is missing required scopes:');
        for (const scope of scopes.missing) console.error(`  - ${scope}`);
        process.exit(1);
    }

    const current = await readCurrentState(api, config);
    const plan = computeProvisionPlan(config, current);

    if (plan.length === 0) {
        console.log('Already converged. Nothing to do.');
        return;
    }
    for (const action of plan) console.log(`${dryRun ? 'PLAN' : 'APPLY'}: ${action.description}`);
    if (dryRun) return;

    for (const action of plan) {
        if (action.kind === 'create-bucket') {
            const name = action.description.replace('Create bucket ', '');
            await api.request('POST', `/accounts/${config.accountId}/r2/buckets`, {
                name,
            });
        } else {
            await applyAction(api, config, action.kind);
        }
    }
    console.log('Done.');
}

await main();
```

- [ ] **Step 6: Verify the dry run reports a full plan against the real account**

Run: `CLOUDFLARE_API_TOKEN=<operator token> bun --filter @aquila/infra-cloudflare provision:dry`
Expected: five `PLAN:` lines — two bucket creations, CORS, domain attach, cache rules. **No writes.**

- [ ] **Step 7: Commit**

```bash
git add packages/infra-cloudflare/src
git commit -m "feat(infra): add idempotent r2 delivery provisioner with dry-run"
```

---

### Task 5: Apply provisioning to the account

This task performs real, outward-facing changes. It has no unit tests; its verification is the account state itself.

**Files:** none changed.

**Interfaces:** Consumes Task 4's CLI. Produces the live buckets, domain, CORS, and cache rules that Tasks 6–8 depend on.

- [ ] **Step 1: Re-read the dry run and confirm it plans no deletions**

Run: `CLOUDFLARE_API_TOKEN=<operator token> bun --filter @aquila/infra-cloudflare provision:dry`
Expected: every line begins `PLAN: Create`, `PLAN: Set`, `PLAN: Attach`, or `PLAN: Update`. If any line suggests removal, stop — the provisioner is meant to be additive only.

- [ ] **Step 2: Apply**

Run: `CLOUDFLARE_API_TOKEN=<operator token> bun --filter @aquila/infra-cloudflare provision`
Expected: `APPLY:` lines then `Done.`

- [ ] **Step 3: Confirm the run is idempotent**

Run the same command again.
Expected: `Already converged. Nothing to do.`

- [ ] **Step 4: Confirm the custom domain reaches Active**

Run:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/91ee89a03a31b5354a25c49228e4ab85/r2/buckets/aquila-vn-delivery/domains/custom" \
  | python3 -m json.tool
```

Expected: the `assets.aquila.cwchanap.dev` entry shows `"enabled": true` and status `active`. Status may sit at `initializing` for a few minutes; re-run until it changes.

- [ ] **Step 5: Confirm the source bucket has no public access**

Run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://assets.aquila.cwchanap.dev/probe-nonexistent
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/91ee89a03a31b5354a25c49228e4ab85/r2/buckets/aquila-vn-source/domains/custom" \
  | python3 -m json.tool
```

Expected: a 404 from the delivery host, and an empty `domains` array for the source bucket.

---

### Task 6: One-shot publisher token

**Files:**
- Create: `packages/infra-cloudflare/src/create-publisher-token.ts`

**Interfaces:** Consumes `loadR2DeliveryConfig` (Task 1) and `CloudflareApi` (Task 3). Produces the `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` pair used by Task 7 and by HPA-230.

- [ ] **Step 1: Implement the minter**

This is deliberately **not** part of `provision.ts`: an R2 secret access key is displayed exactly once, so "ensure a token exists" could only ever sprawl secrets or block rotation. It also needs `User · API Tokens · Write`, an authority the routine reconcile token must not carry.

`packages/infra-cloudflare/src/create-publisher-token.ts`:

```ts
import { createHash } from 'node:crypto';
import { CloudflareApi } from './api';
import { loadR2DeliveryConfig } from './config';

const R2_OBJECT_READ_WRITE = '2efd5506f9c8494dacb1fa10a3e7d5b6';

async function main(): Promise<void> {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        console.error('CLOUDFLARE_API_TOKEN is not set.');
        process.exit(1);
    }

    const config = await loadR2DeliveryConfig();
    const api = new CloudflareApi(token);
    const resources: Record<string, string> = {};
    for (const bucket of [config.buckets.source, config.buckets.delivery]) {
        resources[
            `com.cloudflare.edge.r2.bucket.${config.accountId}_default_${bucket}`
        ] = '*';
    }

    const created = await api.request<{ id: string; value: string }>(
        'POST',
        `/accounts/${config.accountId}/tokens`,
        {
            name: config.publisherToken.name,
            policies: [
                {
                    effect: 'allow',
                    resources,
                    permission_groups: [{ id: R2_OBJECT_READ_WRITE }],
                },
            ],
        }
    );

    console.log('Store these now — the secret is never shown again.\n');
    console.log(`R2_PUBLISHER_ACCESS_KEY_ID=${created.id}`);
    console.log(
        `R2_PUBLISHER_SECRET_ACCESS_KEY=${createHash('sha256')
            .update(created.value)
            .digest('hex')}`
    );
    console.log(
        `\nScoped to: ${config.buckets.source}, ${config.buckets.delivery}`
    );
}

await main();
```

- [ ] **Step 2: Mint the token**

Run: `CLOUDFLARE_API_TOKEN=<token with API Tokens Write> bun --filter @aquila/infra-cloudflare create-publisher-token`
Expected: an access key id and secret access key.

- [ ] **Step 3: Store the credentials**

Add both values as GitHub Actions repository secrets named `R2_PUBLISHER_ACCESS_KEY_ID` and `R2_PUBLISHER_SECRET_ACCESS_KEY`. Optionally add them to your local `.env.local` for manual publishing. Do **not** commit them.

- [ ] **Step 4: Confirm the token cannot reach unrelated buckets**

Run:

```bash
AWS_ACCESS_KEY_ID=<id> AWS_SECRET_ACCESS_KEY=<secret> \
  aws s3 ls s3://perseus-production \
  --endpoint-url https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
```

Expected: an access-denied error. This is the acceptance criterion that publisher credentials cannot touch unrelated Cloudflare resources. If the `aws` CLI is unavailable, skip and note it — Task 8's verifier does not cover this.

- [ ] **Step 5: Commit**

```bash
git add packages/infra-cloudflare/src/create-publisher-token.ts
git commit -m "feat(infra): add one-shot scoped r2 publisher token minter"
```

---

### Task 7: Seed the smoke release

**Files:**
- Create: `packages/infra-cloudflare/src/seed.ts`

**Interfaces:** Consumes `loadR2DeliveryConfig` (Task 1). Produces a published smoke release at preview id `smoke` for story `the_seventh_mirror`, which Task 8's verifier probes.

- [ ] **Step 1: Implement the seeder**

Uploads go through `wrangler r2 object put`, which accepts `--content-type` and `--cache-control`, so no SigV4 client or new dependency is needed. Setting `Content-Type` explicitly is mandatory: R2 does not infer it from the key and would store `application/octet-stream`, failing verification and breaking image decoding.

Unlike `apps/web/scripts/build-visual-fixtures.ts`, this emits **AVIF as well as WebP**, because verification asserts an `image/avif` response.

`packages/infra-cloudflare/src/seed.ts`:

```ts
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    releaseIdFromContentSha256,
    RUNTIME_ASSET_CACHE_POLICY,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import { loadR2DeliveryConfig } from './config';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'smoke' } as const;
const SOURCES = [
    {
        type: 'background' as const,
        key: 'chapter_1/ch1_act2_s0',
        file: 'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        resize: { width: 640, height: 360 },
    },
    {
        type: 'portrait' as const,
        key: 'asakura_mio/base',
        file: 'the_seventh_mirror/characters/asakura_mio/base.png',
        resize: { width: 300, height: 400 },
    },
];

const repositoryRoot = resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../..'
);

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

async function put(
    bucket: string,
    key: string,
    file: string,
    contentType: string,
    cacheControl: string
): Promise<void> {
    const proc = Bun.spawn(
        [
            'wrangler',
            'r2',
            'object',
            'put',
            `${bucket}/${key}`,
            '--file',
            file,
            '--content-type',
            contentType,
            '--cache-control',
            cacheControl,
            '--remote',
        ],
        { stdout: 'inherit', stderr: 'inherit' }
    );
    if ((await proc.exited) !== 0) {
        throw new Error(`wrangler failed uploading ${key}`);
    }
}

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const bucket = config.buckets.delivery;
    const immutable =
        RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
    const pointerCacheControl =
        RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
    const scratch = await mkdtemp(join(tmpdir(), 'aquila-seed-'));
    const assets: RuntimeAssetManifestV1['assets'] = [];

    for (const source of SOURCES) {
        const input = resolve(repositoryRoot, 'packages/assets/media', source.file);
        const pipeline = sharp(input).resize({
            ...source.resize,
            fit: 'inside',
            withoutEnlargement: true,
        });

        const webp = await pipeline.clone().webp({ quality: 82 }).toBuffer();
        const avif = await pipeline.clone().avif({ quality: 50 }).toBuffer();
        const meta = await sharp(webp).metadata();
        if (!meta.width || !meta.height) {
            throw new Error(`Unable to read dimensions for ${source.file}`);
        }

        const webpSha = assertSha256<'object-content'>(sha256(webp));
        const avifSha = assertSha256<'object-content'>(sha256(avif));
        const webpPath = getObjectPath(webpSha, 'webp');
        const avifPath = getObjectPath(avifSha, 'avif');

        const webpFile = join(scratch, `${webpSha}.webp`);
        const avifFile = join(scratch, `${avifSha}.avif`);
        await writeFile(webpFile, webp);
        await writeFile(avifFile, avif);
        await put(bucket, webpPath, webpFile, 'image/webp', immutable);
        await put(bucket, avifPath, avifFile, 'image/avif', immutable);

        assets.push({
            identity: { type: source.type, key: source.key },
            variants: {
                webp: {
                    format: 'webp',
                    path: webpPath,
                    sha256: webpSha,
                    byteLength: webp.byteLength,
                },
                avif: {
                    format: 'avif',
                    path: avifPath,
                    sha256: avifSha,
                    byteLength: avif.byteLength,
                },
            },
            width: meta.width,
            height: meta.height,
            section: 'chapter_1',
        });
    }

    const draft: RuntimeAssetManifestV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    };
    const releaseId = releaseIdFromContentSha256(
        assertSha256<'release-content'>(sha256(canonicalReleaseContent(draft)))
    );
    const manifest: RuntimeAssetManifestV1 = { ...draft, releaseId };
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestPath = getReleaseManifestPath(STORY_ID, releaseId, TARGET);
    const manifestFile = join(scratch, 'runtime-manifest.json');
    await writeFile(manifestFile, manifestText);
    await put(
        bucket,
        manifestPath,
        manifestFile,
        'application/json',
        immutable
    );

    const pointerText = `${JSON.stringify(
        {
            schemaVersion: 1,
            storyId: STORY_ID,
            releaseId,
            manifestPath,
            manifestSha256: sha256(manifestText),
            publishedAt: new Date().toISOString(),
        },
        null,
        2
    )}\n`;
    const pointerFile = join(scratch, 'current.json');
    await writeFile(pointerFile, pointerText);
    await put(
        bucket,
        getCurrentPointerPath(STORY_ID, TARGET),
        pointerFile,
        'application/json',
        pointerCacheControl
    );

    console.log(`Seeded release ${releaseId}`);
    console.log(`Pointer: ${getCurrentPointerPath(STORY_ID, TARGET)}`);
}

await main();
```

- [ ] **Step 2: Seed**

Run: `R2_PUBLISHER_ACCESS_KEY_ID=<id> R2_PUBLISHER_SECRET_ACCESS_KEY=<secret> bun --filter @aquila/infra-cloudflare seed`
Expected: `Seeded release sha256-…`.

- [ ] **Step 3: Spot-check one object by hand**

Run:

```bash
curl -sI https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json | grep -Ei 'content-type|cache-control'
```

Expected: `content-type: application/json` and `cache-control: no-cache, max-age=0, must-revalidate`.

- [ ] **Step 4: Commit**

```bash
git add packages/infra-cloudflare/src/seed.ts
git commit -m "feat(infra): seed smoke visual release with webp and avif variants"
```

---

### Task 8: Verifier

**Files:**
- Create: `packages/infra-cloudflare/src/assertions.ts`
- Create: `packages/infra-cloudflare/src/__tests__/assertions.test.ts`
- Create: `packages/infra-cloudflare/src/verify.ts`

**Interfaces:**
- Consumes: config (Task 1), the live delivery host (Task 5), the seeded release (Task 7).
- Produces: `type CheckResult = { name: string; ok: boolean; detail: string; warning?: boolean }`, plus pure helpers `assertImmutable`, `assertPointerRevalidation`, `assertContentType`, `findForbiddenKeys`.

- [ ] **Step 1: Write the failing assertions test**

`packages/infra-cloudflare/src/__tests__/assertions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
    findForbiddenKeys,
} from '../assertions';

describe('assertImmutable', () => {
    it('accepts a year-long immutable directive', () => {
        expect(
            assertImmutable('public, max-age=31536000, immutable').ok
        ).toBe(true);
    });

    it('rejects a directive missing immutable', () => {
        expect(assertImmutable('public, max-age=31536000').ok).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(assertImmutable(null).ok).toBe(false);
    });
});

describe('assertPointerRevalidation', () => {
    it('requires all three revalidation directives regardless of order', () => {
        expect(
            assertPointerRevalidation('must-revalidate, max-age=0, no-cache').ok
        ).toBe(true);
    });

    it('rejects a pointer cached like an immutable object', () => {
        expect(
            assertPointerRevalidation('public, max-age=31536000, immutable').ok
        ).toBe(false);
    });
});

describe('assertContentType', () => {
    it('ignores charset parameters', () => {
        expect(
            assertContentType('application/json; charset=utf-8', 'application/json').ok
        ).toBe(true);
    });

    it('rejects the octet-stream default r2 uses when type is unset', () => {
        expect(
            assertContentType('application/octet-stream', 'image/avif').ok
        ).toBe(false);
    });
});

describe('findForbiddenKeys', () => {
    it('finds a forbidden key nested in an array', () => {
        expect(
            findForbiddenKeys({ assets: [{ prompt: 'a wizard' }] })
        ).toEqual(['assets.0.prompt']);
    });

    it('does not flag a forbidden word appearing only in a value', () => {
        expect(
            findForbiddenKeys({ assets: [{ key: 'chapter_1/prompt_room' }] })
        ).toEqual([]);
    });

    it('returns nothing for a clean manifest', () => {
        expect(findForbiddenKeys({ schemaVersion: 1, assets: [] })).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter @aquila/infra-cloudflare test assertions`
Expected: FAIL — cannot resolve `../assertions`.

- [ ] **Step 3: Implement the assertions**

`packages/infra-cloudflare/src/assertions.ts`:

```ts
export type CheckResult = {
    name: string;
    ok: boolean;
    detail: string;
    warning?: boolean;
};

type Assertion = { ok: boolean; detail: string };

function directives(header: string | null): string[] {
    return (header ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean);
}

export function assertImmutable(header: string | null): Assertion {
    const parts = directives(header);
    const ok =
        parts.includes('immutable') && parts.includes('max-age=31536000');
    return { ok, detail: `cache-control: ${header ?? '<missing>'}` };
}

export function assertPointerRevalidation(header: string | null): Assertion {
    const parts = directives(header);
    const ok = ['no-cache', 'max-age=0', 'must-revalidate'].every(directive =>
        parts.includes(directive)
    );
    return { ok, detail: `cache-control: ${header ?? '<missing>'}` };
}

export function assertContentType(
    header: string | null,
    expected: string
): Assertion {
    const actual = (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    return {
        ok: actual === expected,
        detail: `content-type: ${header ?? '<missing>'}`,
    };
}

/**
 * The contract forbids prompts, source paths, provider metadata, and
 * credentials in public runtime data. Walk key paths rather than substring
 * matching the body: a logical asset key may legitimately contain the word
 * "prompt" in a value.
 */
const FORBIDDEN_KEYS = new Set([
    'prompt',
    'prompts',
    'sourcepath',
    'sourcepaths',
    'localpath',
    'provider',
    'credential',
    'credentials',
    'secret',
    'token',
]);

export function findForbiddenKeys(value: unknown, path = ''): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            findForbiddenKeys(item, path ? `${path}.${index}` : String(index))
        );
    }
    if (value === null || typeof value !== 'object') return [];

    const found: string[] = [];
    for (const [key, nested] of Object.entries(value)) {
        const here = path ? `${path}.${key}` : key;
        if (FORBIDDEN_KEYS.has(key.toLowerCase())) found.push(here);
        found.push(...findForbiddenKeys(nested, here));
    }
    return found;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter @aquila/infra-cloudflare test`
Expected: PASS, 26 tests total (4 config + 4 rules + 4 api + 4 plan + 10 assertions).

- [ ] **Step 5: Implement the verifier CLI**

`packages/infra-cloudflare/src/verify.ts`:

```ts
import { loadR2DeliveryConfig } from './config';
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
    findForbiddenKeys,
    type CheckResult,
} from './assertions';

const STORY_ID = 'the_seventh_mirror';
const POINTER_PATH = `vn/previews/smoke/stories/${STORY_ID}/current.json`;
const ORIGIN = 'https://aquila.cwchanap.dev';

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const base = `https://${config.hostname}`;
    const results: CheckResult[] = [];

    const pointerResponse = await fetch(`${base}/${POINTER_PATH}`, {
        headers: { origin: ORIGIN },
    });
    const pointerBody = await pointerResponse.json();
    results.push({
        name: 'pointer content-type',
        ...assertContentType(
            pointerResponse.headers.get('content-type'),
            'application/json'
        ),
    });
    results.push({
        name: 'pointer revalidation',
        ...assertPointerRevalidation(
            pointerResponse.headers.get('cache-control')
        ),
    });
    results.push({
        name: 'pointer CORS',
        ok: pointerResponse.headers.get('access-control-allow-origin') !== null,
        detail: `access-control-allow-origin: ${pointerResponse.headers.get('access-control-allow-origin') ?? '<missing>'}`,
    });

    const manifestResponse = await fetch(
        `${base}/${(pointerBody as { manifestPath: string }).manifestPath}`,
        { headers: { origin: ORIGIN } }
    );
    const manifestBody = await manifestResponse.json();
    results.push({
        name: 'manifest immutable',
        ...assertImmutable(manifestResponse.headers.get('cache-control')),
    });

    const assets = (
        manifestBody as {
            assets: Array<{
                variants: Record<string, { path: string } | undefined>;
            }>;
        }
    ).assets;

    for (const [format, mime] of [
        ['webp', 'image/webp'],
        ['avif', 'image/avif'],
    ] as const) {
        const variant = assets
            .map(asset => asset.variants[format])
            .find(Boolean);
        if (!variant) {
            results.push({
                name: `${format} object`,
                ok: false,
                detail: 'no variant in manifest',
            });
            continue;
        }
        const response = await fetch(`${base}/${variant.path}`, {
            headers: { origin: ORIGIN },
        });
        results.push({
            name: `${format} content-type`,
            ...assertContentType(response.headers.get('content-type'), mime),
        });
        results.push({
            name: `${format} immutable`,
            ...assertImmutable(response.headers.get('cache-control')),
        });
    }

    // Cache HIT is corroboration, not the binding criterion: sequential
    // requests can land on different colos and cache fill is asynchronous.
    const objectPath = assets[0]?.variants.webp?.path;
    if (objectPath) {
        let status = '';
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const response = await fetch(`${base}/${objectPath}`);
            status = response.headers.get('cf-cache-status') ?? '';
            if (status === 'HIT') break;
            await new Promise(done => setTimeout(done, 1000));
        }
        results.push({
            name: 'object cache hit',
            ok: status === 'HIT',
            detail: `cf-cache-status: ${status || '<missing>'}`,
            warning: true,
        });
    }

    const sourceProbe = await fetch(
        `${base}/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
    );
    results.push({
        name: 'source objects not public',
        ok: sourceProbe.status === 404 || sourceProbe.status === 403,
        detail: `HTTP ${sourceProbe.status}`,
    });

    const forbidden = [
        ...findForbiddenKeys(pointerBody),
        ...findForbiddenKeys(manifestBody),
    ];
    results.push({
        name: 'no forbidden keys in public json',
        ok: forbidden.length === 0,
        detail: forbidden.length ? forbidden.join(', ') : 'clean',
    });

    let failed = 0;
    for (const result of results) {
        const label = result.ok ? 'PASS' : result.warning ? 'WARN' : 'FAIL';
        if (!result.ok && !result.warning) failed += 1;
        console.log(`${label}  ${result.name} — ${result.detail}`);
    }
    if (failed > 0) {
        console.error(`\n${failed} check(s) failed.`);
        process.exit(1);
    }
    console.log('\nAll required checks passed.');
}

await main();
```

- [ ] **Step 6: Run the verifier against the live host**

Run: `bun --filter @aquila/infra-cloudflare verify`
Expected: all `PASS`, with `object cache hit` possibly `WARN`. Exit code 0.

- [ ] **Step 7: Commit**

```bash
git add packages/infra-cloudflare/src
git commit -m "feat(infra): add r2 delivery verifier with header and safety checks"
```

---

### Task 9: Real-browser and pointer-activation checks

**Files:**
- Create: `packages/e2e/tests/r2-delivery.spec.ts`

**Interfaces:** Consumes the live delivery host and the seeded release. Produces no exports.

Acceptance criterion 1 says *a browser* can fetch these assets. Task 8's shell probes never exercise the browser's CORS enforcement or its image decoders, so this closes that gap.

- [ ] **Step 1: Write the test**

`packages/e2e/tests/r2-delivery.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const ASSET_BASE = 'https://assets.aquila.cwchanap.dev';
const POINTER = `${ASSET_BASE}/vn/previews/smoke/stories/the_seventh_mirror/current.json`;

test.describe('R2 visual asset delivery', () => {
    test('a browser can fetch and decode the seeded release cross-origin', async ({
        page,
    }) => {
        await page.goto('/en');

        const result = await page.evaluate(
            async ({ pointerUrl, base }) => {
                const pointer = await (await fetch(pointerUrl)).json();
                const manifest = await (
                    await fetch(`${base}/${pointer.manifestPath}`)
                ).json();

                const decoded: Record<string, { width: number; height: number }> =
                    {};
                for (const format of ['webp', 'avif'] as const) {
                    const variant = manifest.assets
                        .map((asset: any) => asset.variants[format])
                        .find(Boolean);
                    if (!variant) continue;
                    const blob = await (
                        await fetch(`${base}/${variant.path}`)
                    ).blob();
                    const bitmap = await createImageBitmap(blob);
                    decoded[format] = {
                        width: bitmap.width,
                        height: bitmap.height,
                    };
                }
                return { storyId: manifest.storyId, decoded };
            },
            { pointerUrl: POINTER, base: ASSET_BASE }
        );

        expect(result.storyId).toBe('the_seventh_mirror');
        expect(result.decoded.webp.width).toBeGreaterThan(0);
        expect(result.decoded.webp.height).toBeGreaterThan(0);
        expect(result.decoded.avif.width).toBeGreaterThan(0);
    });

    test('the pointer is served with revalidation headers', async ({
        request,
    }) => {
        const response = await request.get(POINTER);
        expect(response.status()).toBe(200);
        const cacheControl = response.headers()['cache-control'] ?? '';
        expect(cacheControl).toContain('no-cache');
        expect(cacheControl).toContain('must-revalidate');
    });
});
```

- [ ] **Step 2: Run the test**

Run: `bun --filter e2e test:e2e tests/r2-delivery.spec.ts`
Expected: 2 passed. If AVIF decoding fails, the browser lacks AVIF support — record it; WebP is the required compatibility path per the contract.

- [ ] **Step 3: Record the live pointer-activation measurement**

Run:

```bash
bun --filter @aquila/infra-cloudflare seed
for i in $(seq 1 12); do
  curl -sI https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json \
    | grep -iE 'cf-cache-status|etag' | tr '\n' ' '
  echo " @ $(date +%s)"
  sleep 10
done
```

Expected: a new `etag` becomes visible. Note the observed `cf-cache-status` values and the delay until the new pointer appears — these go in the runbook in Task 12. This is the one part of the cache design that documentation alone cannot settle.

- [ ] **Step 4: Commit**

```bash
git add packages/e2e/tests/r2-delivery.spec.ts
git commit -m "test(e2e): verify r2 delivery fetch and decode from a real browser"
```

---

### Task 10: Environment-selected asset source

**Files:**
- Create: `apps/web/src/lib/visual-assets/asset-source-config.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/asset-source-config.test.ts`
- Modify: `apps/web/src/lib/visual-assets/source-factory.ts:15-58`
- Modify: `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`

**Interfaces:**
- Consumes: `isPreviewId` from `@aquila/stories/runtime-assets`; `AssetResolverSource` from `@aquila/stories/runtime-assets`.
- Produces:
  - `type AssetSourceConfig = { baseUrl?: string; environment?: string; previewId?: string }`
  - `readAssetSourceConfigFromEnv(env: Record<string, unknown>): AssetSourceConfig`
  - `resolveAssetSource(storyId: string, origin: string, config: AssetSourceConfig): AssetResolverSource` — throws on invalid config. Takes `storyId` because `AssetResolverSource` requires it on every branch of the union.
  - `getAssetResolverSource(storyId: string, origin: string, config: AssetSourceConfig): AssetResolverSource | null`
  - `createVisualRuntime(storyId, origin, getSceneDialogue, config?)` — signature-compatible with today's three-argument call.

- [ ] **Step 1: Write the failing truth-table test**

`apps/web/src/lib/visual-assets/__tests__/asset-source-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    readAssetSourceConfigFromEnv,
    resolveAssetSource,
} from '../asset-source-config';

const ORIGIN = 'http://localhost:5090';
const REMOTE = 'https://assets.aquila.cwchanap.dev/';

describe('readAssetSourceConfigFromEnv', () => {
    it('treats empty and whitespace-only values as unset', () => {
        expect(
            readAssetSourceConfigFromEnv({
                PUBLIC_ASSET_BASE_URL: '',
                PUBLIC_ASSET_ENVIRONMENT: '   ',
                PUBLIC_ASSET_PREVIEW_ID: '',
            })
        ).toEqual({});
    });

    it('trims surrounding whitespace', () => {
        expect(
            readAssetSourceConfigFromEnv({
                PUBLIC_ASSET_BASE_URL: ` ${REMOTE} `,
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toEqual({ baseUrl: REMOTE, environment: 'production' });
    });
});

const STORY = 'the_seventh_mirror';

describe('resolveAssetSource', () => {
    it('falls back to local fixtures when nothing is configured', () => {
        expect(resolveAssetSource(STORY, ORIGIN, {})).toEqual({
            environment: 'local',
            storyId: STORY,
            baseUrl: 'http://localhost:5090/assets/',
            target: { kind: 'preview', previewId: 'hpa-228-local' },
        });
    });

    it('builds a production source', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: REMOTE,
                environment: 'production',
            })
        ).toEqual({
            environment: 'production',
            storyId: STORY,
            baseUrl: REMOTE,
            target: { kind: 'production' },
        });
    });

    it('builds a preview source', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: REMOTE,
                environment: 'preview',
                previewId: 'hpa-229',
            })
        ).toEqual({
            environment: 'preview',
            storyId: STORY,
            baseUrl: REMOTE,
            target: { kind: 'preview', previewId: 'hpa-229' },
        });
    });

    it('allows an explicit local base url over http', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: 'http://127.0.0.1:8788/',
                environment: 'local',
            }).baseUrl
        ).toBe('http://127.0.0.1:8788/');
    });

    it.each([
        [{ baseUrl: REMOTE }, /incomplete/i],
        [{ environment: 'production' }, /incomplete/i],
        [{ baseUrl: REMOTE, environment: 'staging' }, /unknown environment/i],
        [{ baseUrl: REMOTE, environment: 'preview' }, /requires a preview id/i],
        [
            { baseUrl: REMOTE, environment: 'preview', previewId: 'HPA-229' },
            /invalid preview id/i,
        ],
        [
            {
                baseUrl: REMOTE,
                environment: 'production',
                previewId: 'hpa-229',
            },
            /preview id is meaningless/i,
        ],
        [
            { baseUrl: 'http://insecure.example/', environment: 'production' },
            /must be https/i,
        ],
    ])('throws for %j', (config, message) => {
        expect(() => resolveAssetSource(STORY, ORIGIN, config)).toThrow(
            message
        );
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter web test asset-source-config`
Expected: FAIL — cannot resolve `../asset-source-config`.

- [ ] **Step 3: Implement the config module**

`apps/web/src/lib/visual-assets/asset-source-config.ts`:

```ts
import type { AssetResolverSource } from '@aquila/stories/runtime-assets';
import { isPreviewId } from '@aquila/stories/runtime-assets';

export type AssetSourceConfig = {
    baseUrl?: string;
    environment?: string;
    previewId?: string;
};

const LOCAL_PREVIEW_ID = 'hpa-228-local';

function readTrimmed(
    env: Record<string, unknown>,
    key: string
): string | undefined {
    const raw = env[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The only place in the web app that reads asset environment variables.
 * Everything downstream takes an explicit config, so unit tests never depend
 * on ambient env — which also sidesteps Vitest's default VITE_ envPrefix
 * leaving PUBLIC_* undefined in tests but defined under Astro.
 */
export function readAssetSourceConfigFromEnv(
    env: Record<string, unknown>
): AssetSourceConfig {
    const config: AssetSourceConfig = {};
    const baseUrl = readTrimmed(env, 'PUBLIC_ASSET_BASE_URL');
    const environment = readTrimmed(env, 'PUBLIC_ASSET_ENVIRONMENT');
    const previewId = readTrimmed(env, 'PUBLIC_ASSET_PREVIEW_ID');
    if (baseUrl !== undefined) config.baseUrl = baseUrl;
    if (environment !== undefined) config.environment = environment;
    if (previewId !== undefined) config.previewId = previewId;
    return config;
}

function requireHttps(baseUrl: string): void {
    if (!baseUrl.startsWith('https:')) {
        throw new Error(
            `Remote asset base URL must be HTTPS, received: ${baseUrl}`
        );
    }
}

export function resolveAssetSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource {
    const { baseUrl, environment, previewId } = config;

    if (!baseUrl && !environment && !previewId) {
        return {
            environment: 'local',
            storyId,
            baseUrl: new URL('/assets/', origin).href,
            target: { kind: 'preview', previewId: LOCAL_PREVIEW_ID },
        };
    }

    if (!baseUrl || !environment) {
        throw new Error(
            'Incomplete asset configuration: PUBLIC_ASSET_BASE_URL and PUBLIC_ASSET_ENVIRONMENT must be set together.'
        );
    }

    if (environment === 'local') {
        if (previewId) {
            throw new Error(
                'Preview id is meaningless when PUBLIC_ASSET_ENVIRONMENT is local.'
            );
        }
        return {
            environment: 'local',
            storyId,
            baseUrl,
            target: { kind: 'preview', previewId: LOCAL_PREVIEW_ID },
        };
    }

    if (environment === 'preview') {
        requireHttps(baseUrl);
        if (!previewId) {
            throw new Error(
                'PUBLIC_ASSET_ENVIRONMENT=preview requires a preview id.'
            );
        }
        if (!isPreviewId(previewId)) {
            throw new Error(`Invalid preview id: ${previewId}`);
        }
        return {
            environment: 'preview',
            storyId,
            baseUrl,
            target: { kind: 'preview', previewId },
        };
    }

    if (environment === 'production') {
        requireHttps(baseUrl);
        if (previewId) {
            throw new Error(
                'Preview id is meaningless when PUBLIC_ASSET_ENVIRONMENT is production.'
            );
        }
        return {
            environment: 'production',
            storyId,
            baseUrl,
            target: { kind: 'production' },
        };
    }

    throw new Error(`Unknown environment: ${environment}`);
}
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter web test asset-source-config`
Expected: PASS, 13 tests (2 env-reading + 4 valid rows + 7 throw cases).

- [ ] **Step 5: Wire it into the source factory**

Replace `apps/web/src/lib/visual-assets/source-factory.ts` lines 15–36 with:

```ts
export function getAssetResolverSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource | null {
    if (storyId !== 'the_seventh_mirror') return null;
    return resolveAssetSource(storyId, origin, config);
}

export function createVisualRuntime(
    storyId: string,
    origin: string,
    getSceneDialogue: (
        storyId: string,
        sceneId: string
    ) => readonly DialogueEntry[] | null,
    config: AssetSourceConfig = readAssetSourceConfigFromEnv(
        import.meta.env as unknown as Record<string, unknown>
    )
): VisualReaderRuntime | null {
    const source = getAssetResolverSource(storyId, origin, config);
    // …unchanged body from here down
```

Add to the imports at the top of the file:

```ts
import {
    readAssetSourceConfigFromEnv,
    resolveAssetSource,
    type AssetSourceConfig,
} from './asset-source-config';
```

The story allowlist stays: environment variables change *how* an allowed story resolves, never *which* stories resolve. `ReaderShell.svelte:119` keeps its three-argument call unchanged.

- [ ] **Step 6: Update the existing factory tests for the new argument**

In `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`, pass an explicit empty config to both `getAssetResolverSource` calls, and add a preview case:

```ts
it('selects the exact local preview source for The Seventh Mirror', () => {
    expect(
        getAssetResolverSource(
            'the_seventh_mirror',
            'http://localhost:5090/reader',
            {}
        )
    ).toEqual({
        environment: 'local',
        storyId: 'the_seventh_mirror',
        baseUrl: 'http://localhost:5090/assets/',
        target: { kind: 'preview', previewId: 'hpa-228-local' },
    });
});

it('returns null for stories without a visual source', () => {
    expect(
        getAssetResolverSource('train_adventure', 'http://localhost:5090', {})
    ).toBeNull();
});

it('selects a production source when configured', () => {
    expect(
        getAssetResolverSource('the_seventh_mirror', 'http://localhost:5090', {
            baseUrl: 'https://assets.aquila.cwchanap.dev/',
            environment: 'production',
        })
    ).toEqual({
        environment: 'production',
        storyId: 'the_seventh_mirror',
        baseUrl: 'https://assets.aquila.cwchanap.dev/',
        target: { kind: 'production' },
    });
});
```

- [ ] **Step 7: Run the full web suite**

Run: `bun --filter web test`
Expected: PASS with no regressions in `source-factory`, `web-asset-resolver`, or `visual-state-controller`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/visual-assets
git commit -m "feat(web): select the visual asset source from environment config"
```

---

### Task 11: Preview id derivation and build wiring

**Files:**
- Create: `apps/web/scripts/asset-preview-id.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/preview-id.test.ts`
- Modify: `apps/web/package.json` (the `build` script)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `isPreviewId` from `@aquila/stories/runtime-assets`.
- Produces: `derivePreviewId(ref: string): string` exported from `apps/web/scripts/asset-preview-id.ts`, and the `PUBLIC_ASSET_PREVIEW_ID` value the build consumes.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/visual-assets/__tests__/preview-id.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPreviewId } from '@aquila/stories/runtime-assets';
import { derivePreviewId } from '../../../../scripts/asset-preview-id';

describe('derivePreviewId', () => {
    it('lowercases and replaces slashes', () => {
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('strips leading and trailing separators', () => {
        expect(derivePreviewId('-HPA-229-')).toBe('hpa-229');
    });

    it('collapses runs of separators', () => {
        expect(derivePreviewId('a///b')).toBe('a-b');
    });

    it('clamps to 64 characters without a trailing separator', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(64);
        expect(isPreviewId(result)).toBe(true);
    });

    it('falls back to a deterministic hash when nothing survives', () => {
        const first = derivePreviewId('日本語');
        expect(first).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(derivePreviewId('日本語')).toBe(first);
    });

    it('always produces a valid preview id', () => {
        for (const ref of [
            'main',
            'HPA-229',
            'feature/Foo_Bar',
            '日本語',
            '___',
            `${'x'.repeat(200)}`,
        ]) {
            expect(isPreviewId(derivePreviewId(ref))).toBe(true);
        }
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun --filter web test preview-id`
Expected: FAIL — cannot resolve the script module.

- [ ] **Step 3: Implement the derivation script**

`apps/web/scripts/asset-preview-id.ts`:

```ts
import { createHash } from 'node:crypto';

/**
 * Vercel branch names routinely violate isPreviewId(): `HPA-229` has
 * uppercase, `feature/Foo_Bar` has a slash, and branches can exceed 63
 * characters. Derive a valid id deterministically so the same branch always
 * maps to the same preview namespace.
 */
export function derivePreviewId(ref: string): string {
    const slug = ref
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 63)
        .replace(/[-_]+$/g, '');

    if (slug.length > 0) return slug;
    return `preview-${createHash('sha256').update(ref).digest('hex').slice(0, 8)}`;
}

if (import.meta.main) {
    // Production must never receive a preview id — that combination throws.
    if (process.env.VERCEL_ENV !== 'preview') {
        process.stdout.write('');
    } else {
        process.stdout.write(
            derivePreviewId(process.env.VERCEL_GIT_COMMIT_REF ?? '')
        );
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `bun --filter web test preview-id`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify the script prints nothing outside a preview build**

Run:

```bash
cd apps/web && bun scripts/asset-preview-id.ts && echo "[empty]"
VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=feature/Foo_Bar bun scripts/asset-preview-id.ts && echo ""
```

Expected: `[empty]` for the first, `feature-foo_bar` for the second.

- [ ] **Step 6: Wire the build command**

In `apps/web/package.json`, replace the `build` script with:

```json
"build": "bun --cwd . scripts/generate-zh-proxy-pages.ts && PUBLIC_ASSET_PREVIEW_ID=\"$(bun scripts/asset-preview-id.ts)\" astro build && bun scripts/assert-story-chunks.ts"
```

Command substitution is required rather than a `&&`-chained step: Astro inlines `PUBLIC_*` into client code from the environment of the `astro build` process, which a separate process cannot modify.

- [ ] **Step 7: Confirm the build still works locally**

Run: `bun --filter web build`
Expected: build succeeds. Locally `VERCEL_ENV` is unset, so `PUBLIC_ASSET_PREVIEW_ID` is empty and the reader keeps the local-default source.

- [ ] **Step 8: Document the variables**

Append to `.env.example`:

```bash
# ── Visual novel asset delivery (Cloudflare R2) ──────────────────────────────
# Unset locally: the reader serves bundled fixtures from /assets/.
# Production (Vercel): PUBLIC_ASSET_BASE_URL + PUBLIC_ASSET_ENVIRONMENT=production
# Preview (Vercel):    PUBLIC_ASSET_BASE_URL + PUBLIC_ASSET_ENVIRONMENT=preview
#                      PUBLIC_ASSET_PREVIEW_ID is derived at build time.
# PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
# PUBLIC_ASSET_ENVIRONMENT=production

# Scoped R2 publisher credentials (CI and manual publishing only).
# Never expose these to the browser; the web app reads assets over public HTTP.
# R2_PUBLISHER_ACCESS_KEY_ID=
# R2_PUBLISHER_SECRET_ACCESS_KEY=
```

- [ ] **Step 9: Set the Vercel environment variables**

In the Vercel project settings:

| Environment | Variable | Value |
|---|---|---|
| Production | `PUBLIC_ASSET_BASE_URL` | `https://assets.aquila.cwchanap.dev/` |
| Production | `PUBLIC_ASSET_ENVIRONMENT` | `production` |
| Preview | `PUBLIC_ASSET_BASE_URL` | `https://assets.aquila.cwchanap.dev/` |
| Preview | `PUBLIC_ASSET_ENVIRONMENT` | `preview` |

Do not set `PUBLIC_ASSET_PREVIEW_ID` — the build derives it. Do not set either variable for Development.

- [ ] **Step 10: Commit**

```bash
git add apps/web/scripts/asset-preview-id.ts apps/web/src/lib/visual-assets/__tests__/preview-id.test.ts apps/web/package.json .env.example
git commit -m "feat(web): derive preview asset id from branch at build time"
```

---

### Task 12: Runbook

**Files:**
- Create: `docs/infrastructure/r2-visual-asset-delivery.md`

**Interfaces:** Consumes the observed behavior recorded in Task 9 Step 3.

- [ ] **Step 1: Write the runbook**

Create `docs/infrastructure/r2-visual-asset-delivery.md` covering, in this order:

1. **Resource inventory** — the table from the Global Constraints above, plus account and zone ids.
2. **First-time setup** — required operator token scopes (Account · Workers R2 Storage · Edit; Zone · Cache Rules · Edit; Zone · DNS · Edit), then `provision:dry` → `provision` → `create-publisher-token` → `seed` → `verify`.
3. **Environment variables** — the `.env.example` block and the Vercel table from Task 11.
4. **Rollback.** Verbatim:

   > Do **not** re-upload the previous `current.json` bytes. The HPA-227 client
   > rejects a pointer whose `publishedAt` is older than one it already
   > validated, treating it as `stale-pointer`, so a verbatim restore is
   > silently ignored by every client that already saw the newer release.
   >
   > 1. Take the prior release's `releaseId`, `manifestPath`, `manifestSha256`.
   > 2. Emit a **new** pointer with those fields and a fresh, later
   >    `publishedAt`, as canonical JSON plus one LF.
   > 3. Upload with `Content-Type: application/json` and
   >    `Cache-Control: no-cache, max-age=0, must-revalidate`.
   > 4. Purge the single `current.json` URL so the 60s edge TTL does not delay
   >    it.

5. **Observability** — R2 metrics and zone cache analytics; `cf-cache-status` meanings for the three path classes; the measurement recorded in Task 9 Step 3.
6. **Troubleshooting** — a `cf-mitigated` header means WAF, not CORS; a missing `cf-cache-status` means Hotlink Protection, not CORS; `no-cache` on a *request* does not bypass Cloudflare's cache.
7. **Traps**, each with its reason:
   - Manual uploads must set `Content-Type` and `Cache-Control`; R2 infers neither.
   - Renaming a bucket in config is not a safe re-run: the provisioner never deletes, so a rename yields a second empty bucket while the domain stays bound to the original. Detach the domain and delete the old bucket manually first.
   - Preview trees are world-readable and branch-derived ids are guessable. For spoiler-sensitive work, publish under a manually-set unguessable `PUBLIC_ASSET_PREVIEW_ID`.
   - Never enable the r2.dev public development URL: it bypasses every cache rule and any future WAF policy.

- [ ] **Step 2: Verify every command in the runbook actually runs**

Execute each command in the setup and rollback sections against the live account. Fix any that fail. A runbook with an untested command is worse than none.

- [ ] **Step 3: Run the full verification suite one final time**

```bash
bun lint
bun test
bun --filter @aquila/infra-cloudflare verify
bun --filter e2e test:e2e tests/r2-delivery.spec.ts
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/infrastructure/r2-visual-asset-delivery.md
git commit -m "docs(infra): add r2 visual asset delivery runbook"
```

---

## Deliverable checklist

Mapped to the HPA-229 issue:

- [ ] Private source bucket — Task 5
- [ ] Public runtime delivery bucket — Task 5
- [ ] Custom asset domain connected and verified — Task 5 Step 4
- [ ] CORS configuration — Tasks 4–5, verified Task 8
- [ ] Cache rules for objects, manifests, pointers — Tasks 2, 4–5
- [ ] Scoped publisher credentials stored as secrets — Task 6
- [ ] Environment variable documentation — Task 11 Steps 8–9, Task 12
- [ ] Smoke-test script for metadata, CORS, cache headers — Tasks 8–9
- [ ] Infrastructure configuration committed — Task 1
- [ ] Browser can fetch pointer, manifest, AVIF, WebP — Task 9
- [ ] Source objects not publicly accessible — Task 5 Step 5, Task 8
- [ ] Immutable cache headers — Task 8
- [ ] Pointer revalidation policy — Tasks 8–9
- [ ] Correct content types and cross-origin loading — Tasks 7–9
- [ ] Publisher credentials cannot touch unrelated resources — Task 6 Step 4
- [ ] Preview and production selectable without code changes — Tasks 10–11
- [ ] Setup and recovery documented and reproducible — Task 12
