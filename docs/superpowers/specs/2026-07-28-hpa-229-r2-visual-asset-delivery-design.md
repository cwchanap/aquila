# HPA-229: Isolated Aquila R2 Visual Asset Delivery

**Date:** 2026-07-28
**Status:** Approved for implementation
**Linear:** [HPA-229](https://linear.app/cwchanap/issue/HPA-229/provision-isolated-aquila-r2-visual-asset-delivery)
**Parent:** HPA-216 · **Depends on:** HPA-227 (Done)
**Blocks:** HPA-230 (publisher), HPA-231 (Seventh Mirror migration), HPA-233 (release gate)

## Purpose

Provision the Cloudflare R2 infrastructure that delivers Aquila visual-novel
assets independently of the Vercel application, and make the web app select its
asset source from environment configuration rather than hardcoded values.

This issue provisions and documents delivery. It does not implement the
publisher (HPA-230), migrate production artwork (HPA-231), or change reader UI
(HPA-228, done).

## Established context

The HPA-227 contract
(`docs/plans/2026-07-23-visual-novel-runtime-asset-contract.md`) already fixes
the wire formats, the publication layout, and `RUNTIME_ASSET_CACHE_POLICY`.
This design does not reopen those decisions; it provisions infrastructure that
serves them and enforces the cache policy at the edge.

The canonical layout is:

```text
vn/objects/<sha256>.<format>
vn/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/stories/<storyId>/current.json
vn/previews/<previewId>/stories/<storyId>/…
```

## Verified account facts

Gathered from the Cloudflare API on 2026-07-28:

| Fact | Value |
|---|---|
| Account | `91ee89a03a31b5354a25c49228e4ab85` |
| Zone | `cwchanap.dev` — `a72a26e71e9b9e4b91d1523aafab7d06`, active, **Free** |
| App host | `aquila.cwchanap.dev` — CNAME to Vercel, DNS-only (not proxied) |
| Existing R2 buckets | `cygnus`, `dtx-desktop-app`, `perseus`, `perseus-production`, `simfile-dtx`, `simfile-dtx-preprod`, `skin` — no Aquila bucket |
| Cache rulesets on zone | None in `http_request_cache_settings`; the entrypoint ruleset must be created |

Two constraints follow from the Free plan and from R2 semantics:

- Cache Rules are available on Free with a limit of **10 rules**. This design
  uses 3.
- R2 CORS `AllowedOrigins` accepts exact `scheme://host[:port]` origins only.
  Wildcard subdomains such as `https://*.vercel.app` are not supported, so an
  exact allowlist cannot cover ephemeral Vercel preview deployments.

## Decisions

### D1 — Two buckets, path-prefixed environments

| Bucket | Name | Access |
|---|---|---|
| Source | `aquila-vn-source` | Private. No custom domain, no public development URL. |
| Delivery | `aquila-vn-delivery` | Public through the custom domain only; public development URL explicitly disabled. |

Preview and production share the delivery bucket and are separated by the
`vn/previews/<previewId>/` prefix the contract already defines. This preserves
cross-environment reuse of the immutable `vn/objects/` pool and keeps one set of
cache rules.

**Accepted risk:** the preview/production boundary is a policy boundary enforced
by the publisher's `assertActivationAllowed()`, not a physical bucket boundary.
A publisher bug could write a production pointer from a preview release. The
mitigation lives in HPA-230's tests, not in infrastructure. Separate buckets were
considered and rejected because they would duplicate object storage and break
the contract's shared-object reuse.

### D2 — Custom domain `assets.aquila.cwchanap.dev`

Nested under the app hostname so other `cwchanap.dev` projects can take their own
asset hosts later. R2 creates a proxied CNAME on attachment, which is required
for Cache Rules to apply.

The public development URL (`*.r2.dev`) stays disabled on both buckets. Leaving
it enabled would create a second, unproxied access path that bypasses every cache
rule and any future WAF policy.

### D3 — `Access-Control-Allow-Origin: *` on the delivery bucket

CORS config: `AllowedOrigins: ["*"]`, `AllowedMethods: ["GET", "HEAD"]`,
`AllowedHeaders: ["range", "if-match", "if-none-match"]`,
`ExposeHeaders: ["etag", "content-length", "content-type", "cf-cache-status"]`,
`MaxAgeSeconds: 86400`.

Rationale: the delivery bucket is world-readable by design — every object is
retrievable with an unauthenticated GET — so an origin allowlist provides no
confidentiality. What it would cost is real: R2 cannot express
`https://*.vercel.app`, so an exact allowlist breaks visual mode on every Vercel
preview deployment and makes preview smoke-testing impossible. A wildcard is also
cache-safe: one cached response per object, with no `Vary: Origin` fragmentation
and no risk of serving one origin's ACAO header to another.

Hotlink abuse, should it ever matter, belongs to WAF or Hotlink Protection, not
CORS.

The reader needs CORS at all because `DecodedAssetCache` fetches bytes and
decodes to object URLs; plain `<img>` loading would not.

### D4 — Cache policy in two layers

**Layer 1 — object metadata (HPA-230, contract-fixed).** The publisher sets
`Cache-Control` at upload: `public, max-age=31536000, immutable` for
`vn/objects/*` and release manifests, `no-cache, max-age=0, must-revalidate` for
`current.json`.

**Layer 2 — zone cache rules (this issue).** The enforcement layer, so policy
holds even when an object is uploaded by hand or a publisher regresses.

Layer 2 is not redundant. Cloudflare's default cache covers a fixed list of file
**extensions**, and `.json` is not on it — without an explicit rule, release
manifests would never cache at the edge despite carrying `immutable`.

Three rules in the `http_request_cache_settings` phase, evaluated in order
(last match wins, so the pointer rule is last):

| # | Expression | Behavior |
|---|---|---|
| 1 | `http.host eq "assets.aquila.cwchanap.dev" and starts_with(http.request.uri.path, "/vn/objects/")` | `cache: true`, edge TTL `override_origin` 31536000, browser TTL respect origin, respect strong ETags |
| 2 | `http.host eq "…" and ends_with(http.request.uri.path, "/runtime-manifest.json")` | `cache: true`, edge TTL `override_origin` 31536000, browser TTL respect origin |
| 3 | `http.host eq "…" and ends_with(http.request.uri.path, "/current.json")` | `cache: true`, edge TTL `override_origin` **60**, browser TTL `respect_origin` |

Rule 3 caches the pointer for 60 seconds rather than bypassing cache. This
absorbs pointer polling while keeping worst-case activation latency inside the
contract's 60-second client revalidation window. `override_origin` is deliberate:
the pointer's own `no-cache` header would otherwise suppress edge caching
entirely, and the browser still revalidates because browser TTL respects origin.

**Consequence, documented in the runbook:** activation is visible within 60s, but
an *instant* rollback requires purging the single `current.json` URL. The runbook
gives that command as a required rollback step.

### D5 — Declarative config plus idempotent script

`infra/cloudflare/r2-delivery.config.json` holds desired state; `provision.ts`
applies it and is safe to re-run; `--dry-run` prints a diff without writing.
Chosen over Terraform because the monorepo is Bun/TypeScript-only, Terraform is
not installed, and remote state management is disproportionate for two buckets,
a custom domain, a CORS policy, three cache rules, and a token. Chosen over a
docs-only runbook because drift and recovery would then depend on a human
following prose.

The script never deletes. Removing a resource is a deliberate manual act, so a
config typo cannot destroy a bucket.

### D6 — Credentials

| Secret | Home | Scope |
|---|---|---|
| `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` | GitHub Actions secrets; blank placeholders in `.env.example` for local publishing | R2 Object Read & Write, restricted to `aquila-vn-source` and `aquila-vn-delivery` only |
| `CLOUDFLARE_API_TOKEN` | Operator's shell, for `provision.ts` | Not stored in the repo or in CI |

The Vercel project receives only the public `PUBLIC_ASSET_*` variables. The web
app reads assets over public HTTP and must never hold R2 write credentials.

Bucket-scoped R2 tokens satisfy the acceptance criterion that publisher
credentials cannot read or modify unrelated Cloudflare resources — including the
seven pre-existing buckets in this account, which belong to other projects.

### D7 — Environment-selected asset source

`apps/web/src/lib/visual-assets/source-factory.ts` currently hardcodes
`environment: 'local'` and `previewId: 'hpa-228-local'`. It becomes env-driven:

| Variable | Consumers | Example |
|---|---|---|
| `PUBLIC_ASSET_BASE_URL` | Vercel, local | `https://assets.aquila.cwchanap.dev/` |
| `PUBLIC_ASSET_ENVIRONMENT` | Vercel, local | `local` \| `preview` \| `production` |
| `PUBLIC_ASSET_PREVIEW_ID` | preview only | branch slug |

Parsing rules:

- All unset → today's local fixture behavior, unchanged. Local development and
  the existing test suite keep working with no configuration.
- `preview` requires a non-empty `PUBLIC_ASSET_PREVIEW_ID`.
- `production` and `preview` require an `https:` base URL.
- Any invalid combination throws at construction.

Failing loudly matters here: a production deployment that silently fell back to
local fixtures would serve a working-looking reader with no artwork, and the
existing graceful-fallback path would mask it.

## Repository artifacts

```text
infra/cloudflare/r2-delivery.config.json          desired state
infra/cloudflare/provision.ts                     idempotent apply, --dry-run
infra/cloudflare/seed.ts                          upload smoke fixtures
infra/cloudflare/verify.ts                        smoke tests
infra/cloudflare/fixtures/                        tiny WebP/AVIF + manifest + pointer
docs/infrastructure/r2-visual-asset-delivery.md   runbook
```

Package scripts: `bun r2:provision`, `bun r2:provision:dry`, `bun r2:seed`,
`bun r2:verify`.

## Verification

Because the publisher does not exist yet, this issue seeds its own smoke
fixtures: a tiny WebP, a tiny AVIF, a runtime manifest, and a `current.json`,
all conforming to the HPA-227 schemas and uploaded under `vn/previews/smoke/`
(objects in the shared `vn/objects/` pool) by `bun r2:seed`. They are checked
into `infra/cloudflare/fixtures/`, carry the same `Cache-Control` values the
publisher will set, and are what `verify.ts` probes. HPA-231 does not depend on
them, and they can be deleted once a real release exists.

`verify.ts` exits non-zero on any failure and asserts the issue's acceptance
criteria mechanically:

1. `current.json` returns 200, `content-type: application/json`, and
   revalidation headers.
2. A runtime manifest returns 200 and `cache-control: … immutable`.
3. AVIF and WebP objects return `image/avif` and `image/webp` with `immutable`.
4. A cross-origin `GET` with `Origin: https://aquila.cwchanap.dev` returns
   `access-control-allow-origin`.
5. A second request for an object returns `cf-cache-status: HIT`.
6. A known source-bucket key returns 404 over the public domain, and the source
   bucket exposes no custom domain and no public development URL.
7. No response body under `vn/` contains a `prompt` or `sourcePath` field.

Check 6 is the security acceptance criterion; check 7 guards the prompt-exposure
requirement that motivates the private/public bucket split.

## Observability and troubleshooting

The runbook documents:

- R2 storage/operation metrics and zone cache analytics, including how to read
  cache hit ratio for `assets.aquila.cwchanap.dev`.
- `cf-cache-status` values and what each implies for these three path classes.
- The R2 CORS troubleshooting sequence: a `cf-mitigated` header means WAF, and a
  missing `cf-cache-status` means Hotlink Protection — neither is a CORS fault.
- Rollback: republish the prior pointer, then purge the single `current.json`
  URL.
- Recovery: re-running `bun r2:provision` restores CORS, cache rules, and the
  custom domain from config. Bucket contents are not recoverable this way.

## Out of scope

Publisher implementation (HPA-230), production asset migration (HPA-231), reader
UI (HPA-228), private/paid story authorization, and removing committed binaries
under `packages/assets/media`.

## Risks

| Risk | Mitigation |
|---|---|
| Preview publish writes a production pointer | Publisher-enforced; HPA-230 must test `assertActivationAllowed()` |
| Custom domain stuck in "Initializing" | Runbook documents retry; zone is Free with no zone hold |
| 60s pointer cache delays rollback | Runbook makes the targeted purge a required rollback step |
| Free-plan rule limit (10) | 3 used; documented so future rules stay within budget |
