# R2 visual asset delivery (HPA-229)

Runbook for `assets.aquila.cwchanap.dev` — the Cloudflare R2 delivery host that
serves visual-novel runtime assets to the web reader.

> **Status: this pipeline is NOT provisioned end to end.** Both buckets exist;
> nothing else does. The custom domain is not connected, CORS is unset, the three
> cache rules do not exist, and no release has been published. Read
> [§8 What has not been verified](#8-what-has-not-been-verified) before you trust
> any claim in here. The verifier's current, expected output is an HTTP 404 on
> the pointer.

**Global rule — never delete.** Nothing in this runbook deletes a bucket,
object, cache rule, DNS record, or custom domain. Every removal is a manual,
deliberate act performed by a human in the dashboard, and each place where one is
required says so explicitly.

**Global rule — no credentials in the repo.** `.env.example` carries blank
placeholders only. R2 publisher keys live in GitHub Actions secrets.

---

## 1. Resource inventory

| Item | Value |
| --- | --- |
| Cloudflare account id | `91ee89a03a31b5354a25c49228e4ab85` |
| Zone | `cwchanap.dev` — `a72a26e71e9b9e4b91d1523aafab7d06` (Free plan) |
| Delivery hostname | `assets.aquila.cwchanap.dev` |
| Source bucket (private) | `aquila-vn-source` |
| Delivery bucket (public via custom domain only) | `aquila-vn-delivery` |
| Immutable `Cache-Control` | `public, max-age=31536000, immutable` |
| Pointer `Cache-Control` | `no-cache, max-age=0, must-revalidate` |
| Pointer edge TTL | 60 s, `override_origin` |
| `respect_strong_etags` | `true` on all three rules |
| Cache Rules budget | Free plan allows 10 per zone; this work uses 3 |
| Publisher token name | `aquila-vn-publisher` |

Source of truth for every value above:
`packages/infra-cloudflare/r2-delivery.config.json`, validated by
`packages/infra-cloudflare/src/config.ts`. The two `Cache-Control` strings come
from `RUNTIME_ASSET_CACHE_POLICY` in
`packages/stories/src/runtime-assets/policy.ts` (the HPA-227 contract); the
verifier reads them from there rather than restating them.

### Publication layout

Paths are computed by `getObjectPath()`, `getReleaseManifestPath()`, and
`getCurrentPointerPath()` in `packages/stories/src/runtime-assets/paths.ts`.
Never hand-build one.

| Class | Key |
| --- | --- |
| Content-addressed object | `vn/objects/<sha256>.webp` / `vn/objects/<sha256>.avif` |
| Release manifest (production) | `vn/stories/<storyId>/releases/<releaseId>/runtime-manifest.json` |
| Active release pointer (production) | `vn/stories/<storyId>/current.json` |
| Preview tree | the same three under `vn/previews/<previewId>/…` |

Objects are shared across production and previews — the `vn/objects/` prefix is
not duplicated per preview.

---

## 2. First-time setup

This is a **manual dashboard procedure**, not a script run. Provisioning happens
once, so the plan's idempotent reconciler was cancelled;
`packages/infra-cloudflare/src/api.ts`, and the `provision`, `provision:dry`, and
`create-publisher-token` npm scripts, do not exist. Do not go looking for them.

The two automation paths that do exist cannot perform these writes:

- **Cloudflare MCP** — GETs succeed on the same session where
  `POST /accounts/{id}/r2/buckets` returns `10000 Authentication error`. Bucket
  creation, DNS edits, and Cache Rules edits are all unavailable.
- **`wrangler` with an OAuth login** — same outcome for the writes needed here.

A purpose-scoped API token would also work if you prefer the API to the
dashboard. Such a token needs exactly:

| Scope | Level |
| --- | --- |
| Account · Workers R2 Storage | Edit |
| Zone · Cache Rules (`cwchanap.dev`) | Edit |
| Zone · DNS (`cwchanap.dev`) | Edit |

### Order matters

Do the steps in the order below. Two orderings are load-bearing:

- **r2.dev off before anything is tested.** `*.r2.dev` traffic never enters the
  zone, so it bypasses every cache rule (and any future WAF policy). Verifying
  through it reports headers that no real client will ever see.
- **Cache rules only after the custom domain is Active.** Cache Rules match on
  `http.host`; until the proxied hostname resolves to the bucket there is nothing
  for them to match, and a "rules don't work" investigation starts from the wrong
  end.

### 2.1 Create the buckets — already done

R2 → Overview → Create bucket, twice:

- `aquila-vn-source` — **private**. No custom domain, no public access, ever.
  This holds authoring originals (PNG sources, and anything carrying prompts or
  provider metadata).
- `aquila-vn-delivery` — public **only** through the custom domain in §2.3.

Already present in the live account (created 2026-07-29; confirmed by
`r2_buckets_list`). Do not recreate them.

### 2.2 Confirm the Public Development URL is Disabled

R2 → `aquila-vn-delivery` → Settings → Public Development URL → must read
**Disabled**. Check `aquila-vn-source` too. See "Order matters" above for why
this comes before any verification.

### 2.3 Connect the custom domain

R2 → `aquila-vn-delivery` → Settings → Custom Domains → Connect Domain:

- Domain: `assets.aquila.cwchanap.dev`
- Proxy: **enabled** (orange cloud). R2 creates the proxied CNAME for you.

Wait for the status to reach **Active** before continuing. Proxying is not
optional — an unproxied record bypasses the zone and therefore the cache rules,
the same failure mode as r2.dev.

Detaching this domain later is a manual, deliberate act.

### 2.4 Set the CORS policy

R2 → `aquila-vn-delivery` → Settings → CORS Policy → Edit, and paste exactly:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match", "if-none-match"],
    "ExposeHeaders": ["etag", "content-length", "cf-cache-status"],
    "MaxAgeSeconds": 86400
  }
]
```

Values from `cors` in `r2-delivery.config.json`. Why a wildcard: every object in
this bucket is world-readable by design, so an origin allowlist buys no
confidentiality — and R2 cannot express `https://*.vercel.app`, so an exact
allowlist would break visual mode on every Vercel preview. A wildcard also
avoids `Vary: Origin` cache fragmentation. `content-type` is absent from
`ExposeHeaders` because it is already CORS-safelisted. The three
`AllowedHeaders` are forward-looking: today's reader issues plain GETs, which are
CORS-simple and never preflight.

### 2.5 Enable Smart Tiered Cache

Zone `cwchanap.dev` → Caching → Tiered Cache → Smart Tiered Cache Topology →
**On**.

This is a zone toggle, not a rule — it does **not** consume any of the 10-rule
Cache Rules budget.

### 2.6 Create the three cache rules

Zone `cwchanap.dev` → Caching → Cache Rules → Create rule, three times. Enter
each row exactly as given; the **rule name is a load-bearing identity** —
`packages/infra-cloudflare/src/rules.ts` emits these exact descriptions, and they
are how a later reader tells an Aquila rule from anything else in the zone.

Every field below is derived from `buildCacheRules()` in
`packages/infra-cloudflare/src/rules.ts` applied to `r2-delivery.config.json`. If
this table and that file ever disagree, the file wins.

In the dashboard, choose **Custom filter expression** and use the expression
editor's **Edit expression** (text) mode so the strings below can be pasted
verbatim.

**Rule 1 of 3**

| Field | Value |
| --- | --- |
| Rule name | `aquila-vn: immutable objects` |
| Expression | `(http.host eq "assets.aquila.cwchanap.dev" and starts_with(http.request.uri.path, "/vn/objects/"))` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Override origin — `31536000` seconds |
| Browser TTL | Respect origin |
| Respect strong ETags | On |

**Rule 2 of 3**

| Field | Value |
| --- | --- |
| Rule name | `aquila-vn: immutable release manifests` |
| Expression | `(http.host eq "assets.aquila.cwchanap.dev" and ends_with(http.request.uri.path, "/runtime-manifest.json"))` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Override origin — `31536000` seconds |
| Browser TTL | Respect origin |
| Respect strong ETags | On |

**Rule 3 of 3**

| Field | Value |
| --- | --- |
| Rule name | `aquila-vn: active release pointer` |
| Expression | `(http.host eq "assets.aquila.cwchanap.dev" and ends_with(http.request.uri.path, "/current.json"))` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Override origin — `60` seconds |
| Browser TTL | Respect origin |
| Respect strong ETags | On |

Notes:

- **Rule order does not matter.** The three predicates are mutually exclusive: a
  content-addressed object is `<sha256>.webp` or `<sha256>.avif` and can never
  end in `runtime-manifest.json` or `current.json`.
- **Why `Override origin` on the pointer.** It bounds *origin* load to one fetch
  per 60 s. Client freshness stays immediate because the reader fetches the
  pointer with `cache: 'no-cache'` and the pointer's own response
  `Cache-Control` carries `no-cache, max-age=0, must-revalidate`. Overriding also
  neutralizes the documented BYPASS that an origin `max-age=0` response would
  otherwise trigger.
- **Why `Respect origin` on browser TTL.** The browser must see the object's own
  `Cache-Control` — the immutable/pointer distinction is carried by the object
  metadata the publisher sets, and the client contract depends on it.
- **Why `Respect strong ETags`.** R2 returns strong ETags; preserving them keeps
  conditional revalidation of `current.json` cheap (a 304 instead of a body).

Deleting or editing one of these rules later is a manual, deliberate act.

### 2.7 Mint the publisher token and store it as secrets

R2 → API → Manage API tokens → Create API token:

- Permission: **Object Read & Write**
- Specify bucket: **`aquila-vn-delivery` only**. Never account-wide, never
  including `aquila-vn-source`.
- Name: `aquila-vn-publisher`

Copy the Access Key ID and Secret Access Key **once** — Cloudflare will not show
the secret again — and store them in GitHub Actions secrets as
`R2_PUBLISHER_ACCESS_KEY_ID` and `R2_PUBLISHER_SECRET_ACCESS_KEY`. Never in the
repo, never in `.env`, never in a Vercel `PUBLIC_*` variable.

R2 API token scoping is per-bucket only — it cannot express a key-prefix
restriction, so this token can write anywhere inside `aquila-vn-delivery`,
previews and production alike. Prefix-scoped temporary credentials are possible
but belong to the publisher (HPA-230), not here.

### 2.8 Set the Vercel environment variables

See [§3](#3-environment-variables). Set them only after the custom domain reads
Active, and set all three per environment **together** — never partially.

### 2.9 Seed a release, then verify

Publish a release (see the caveat immediately below — there is no working
command for this yet), then run the two verifiers:

```bash
bun --filter @aquila/infra-cloudflare verify
R2_LIVE_CHECK=1 bun --filter e2e test:e2e tests/r2-delivery.spec.ts
```

**The `seed` script is declared but not implemented.** It is Task 7 of the
HPA-229 plan and was never written; `packages/infra-cloudflare/src/seed.ts` does
not exist, so the command fails immediately:

```
$ bun --filter @aquila/infra-cloudflare seed
@aquila/infra-cloudflare seed: error: Module not found "src/seed.ts"
@aquila/infra-cloudflare seed: Exited with code 1
```

Until it exists, a release must be published by another route (the HPA-230
publisher, or by hand — see [§7](#7-traps) for the metadata a manual upload must
carry).

**The seeder must emit AVIF, not only WebP.** `verify.ts` hard-fails when a
release has no AVIF variant, even though the HPA-227 schema treats
`variants.avif` as optional. That is deliberate: `image/avif` content-type is an
enumerated acceptance criterion for this issue and the only check that can prove
it is a real AVIF object. Downgrading it to a warning would let the only
evidence for that criterion disappear without anyone noticing.

`verify` makes only unauthenticated public requests — it holds no R2 credential
and no Cloudflare token, because its job is to prove what any browser sees. It
probes the `smoke` preview of `the_seventh_mirror`
(`vn/previews/smoke/stories/the_seventh_mirror/current.json`).

The expected output **before** provisioning, and today's actual output:

```
$ bun --filter @aquila/infra-cloudflare verify
Verifying https://assets.aquila.cwchanap.dev — story the_seventh_mirror, preview smoke

FAIL  pointer fetch — GET https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json returned HTTP 404 (dependent checks skipped)

1 check(s) failed.
```

A single FAIL on `pointer fetch` with dependent checks skipped is the correct
pre-provisioning signal. Anything else means something unexpected is answering on
that hostname.

---

## 3. Environment variables

### Repository `.env.example` block

```dotenv
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

### Vercel project variables

| Environment | `PUBLIC_ASSET_BASE_URL` | `PUBLIC_ASSET_ENVIRONMENT` | `PUBLIC_ASSET_PREVIEW_ID` |
| --- | --- | --- | --- |
| Production | `https://assets.aquila.cwchanap.dev/` | `production` | **must not be set** |
| Preview | `https://assets.aquila.cwchanap.dev/` | `preview` | **do not set** — derived by the build |
| Development | unset | unset | unset |

- **Production**: a preview id is fatal there —
  `resolveAssetSource()` throws "Preview id is meaningless when
  `PUBLIC_ASSET_ENVIRONMENT` is production"
  (`apps/web/src/lib/visual-assets/asset-source-config.ts`).
- **Preview**: the id is derived from the branch ref at build time by
  `apps/web/scripts/asset-preview-id.ts`, which `apps/web/package.json`'s `build`
  script invokes and passes into `astro build`'s own environment (Vite inlines
  `PUBLIC_*` from the build process, so a separate `&&`-chained step cannot work).
- **Development**: leaving all three unset is what makes `bun dev` serve bundled
  fixtures from `/assets/` with no network dependency.

### Set the three together, never partially

A preview with a preview id but **no** base URL is worse than an unconfigured
one. An unconfigured deployment falls into the "nothing set" branch and renders
bundled fixtures; a stray id is truthy, so it suppresses that fallback and then
trips the incomplete-configuration check — leaving the reader with no visuals at
all.

`previewIdForEnv()` in `apps/web/scripts/asset-preview-id.ts` guards this: it
emits nothing unless `VERCEL_ENV=preview` **and** `PUBLIC_ASSET_BASE_URL` is
non-blank **and** `PUBLIC_ASSET_ENVIRONMENT` trims to exactly `preview`. **Do not
"simplify" that guard away** — without it, merging the preview-id wiring before
the Vercel variables are set breaks visuals on every preview deployment.

The script also validates its own output against `isPreviewId()` and exits 1 on
failure, and the build runs it under `set -e`, so a bad derivation fails the
build instead of silently shipping a bundle with no visuals.

### Long branch names

`derivePreviewId()` slugifies the ref, and when the slug exceeds 63 characters it
clamps to 54 and appends `-<6 hex of sha256(NFC(ref))>`. This repo's
`author/ticket-description` branch convention already overflows 63 characters,
and a plain clamp collapsed a branch, its `-followup`, and its `-fix` onto one
preview namespace — publishing from one would overwrite the others' assets. Refs
that already fit are returned unchanged and stay readable.

---

## 4. Rollback

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

Purge exactly that one URL (Caching → Configuration → Purge Everything is never
required, and purging the whole zone throws away a year of immutable objects for
no reason). Immutable objects and manifests are content-addressed, so a rollback
never needs to touch them — the old release's objects are still there under their
digests.

Rolling back does **not** delete the newer release's manifest or objects, and it
should not. Leaving them costs storage only; deleting them is a separate manual
act.

### Recovering lost configuration

If CORS, a cache rule, or the custom domain is lost or mangled, redo the
corresponding step in [§2](#2-first-time-setup) — the config file
(`packages/infra-cloudflare/r2-delivery.config.json`) plus `rules.ts` remain the
authoritative description of the desired state, even though no script applies
them. There is no "re-run the provisioner" recovery: the reconciler was
deliberately not built.

Bucket **contents** are not recoverable this way. Objects and manifests are
immutable and content-addressed, so a re-publish restores them from the source
tree; nothing restores an object whose authoring source is also gone.

---

## 5. Observability

### R2 metrics

R2 → `aquila-vn-delivery` → Metrics: stored bytes, object count, Class A
(writes/lists) and Class B (reads) operations. A publish run should show a burst
of Class A operations and then nothing; steady Class A traffic between releases
means something is re-uploading unchanged objects, which content addressing is
supposed to make impossible.

### Zone cache analytics

Zone `cwchanap.dev` → Analytics & Logs → Caching, filtered to
`Host = assets.aquila.cwchanap.dev`. What to expect once a release is live and
warm:

- Requests to `/vn/objects/` should be almost entirely cached — they are
  immutable and content-addressed, so a low hit ratio there means the rules are
  not matching (check the hostname in the expression and that the domain is
  proxied).
- `current.json` will show a poor hit ratio by design: a 60 s edge TTL on a
  document clients re-check on every navigation.

Read the hit ratio per path class, not zone-wide — the pointer's misses would
otherwise look like a cache problem.

### `cf-cache-status` by path class

| Value | `/vn/objects/*` | `*/runtime-manifest.json` | `*/current.json` |
| --- | --- | --- | --- |
| `HIT` | expected steady state | expected steady state | expected within a 60 s window |
| `MISS` | first request per colo, or after eviction | same | expected every ~60 s |
| `EXPIRED` | should not occur (1-year TTL) | should not occur | normal — the 60 s TTL lapsed and the edge revalidated |
| `REVALIDATED` | rare | rare | normal, and the cheap outcome: strong ETag matched, 304 from origin |
| `DYNAMIC` | **rule not matching** | **rule not matching** | **rule not matching** |
| `BYPASS` | something forced a bypass — check for a `Set-Cookie` or an `Authorization` request header | same | same |
| *(header absent)* | Hotlink Protection, not CORS — see [§6](#6-troubleshooting) | same | same |

`DYNAMIC` on any of the three paths means no Cache Rule matched: Cloudflare
treats the response as uncacheable-by-default. That is exactly what an
unconnected or unproxied hostname produces — an unprovisioned
`https://assets.aquila.cwchanap.dev/` currently answers HTTP 404 with
`cf-cache-status: DYNAMIC`.

`MISS` on a repeat request is not automatically a fault: sequential requests can
land on different colos and cache fill is asynchronous. This is why `verify.ts`
retries the HIT probe 4 times with a 1 s delay and reports it as a **warning**,
never a failure — the binding criteria are the cache *headers*.

### Pointer-activation timing — UNMEASURED

The design's one empirical open question: after publishing a new pointer, how
long until the new `releaseId` is visible at the edge, and what
`cf-cache-status` sequence appears while it propagates. This is the part of the
two-layer cache design that documentation alone cannot settle.

**It has never been measured**, because no release has ever been published. When
a release exists, take the measurement and record it here:

```bash
for i in $(seq 1 12); do
  curl -sI https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json \
    | grep -iE 'cf-cache-status|etag' | tr '\n' ' '
  echo " @ $(date +%s)"
  sleep 10
done
```

Expected, per the design: a new `etag` within roughly 60 s, with `EXPIRED` or
`MISS` at the transition. If the observed behaviour contradicts that, the cache
rule is what changes — not this paragraph.

---

## 6. Troubleshooting

Three failures that look like CORS and are not:

- **A `cf-mitigated` response header means WAF, not CORS.** A security rule
  (managed ruleset, rate limit, bot fight mode) blocked the request before it
  reached R2. No CORS change will fix it; find and adjust the security rule.
- **A missing `cf-cache-status` header means Hotlink Protection, not CORS.**
  Hotlink Protection intercepts image requests by `Referer` and the response
  never goes through the cache pipeline. Disable it for this hostname, or scope it
  to exclude `assets.aquila.cwchanap.dev`.
- **`Cache-Control: no-cache` on a *request* does not bypass Cloudflare's
  cache.** The documented BYPASS triggers are origin *response* directives
  (`no-cache`, `no-store`, `private`, `max-age=0`), a `Set-Cookie` response
  header, and an `Authorization` request header. The reader's
  `fetch(..., { cache: 'no-cache' })` is request-side and is not among them — so
  seeing `HIT` on `current.json` is not a bug, and the reader still gets a fresh
  document because the pointer's own response directives force revalidation.

Other symptoms:

- **HTTP 404 on everything** — the custom domain is not connected, or is
  connected but not yet Active. Confirm §2.3.
- **`content-type: application/octet-stream`** — the object was uploaded without
  an explicit `Content-Type`. See [§7](#7-traps).
- **Verifier passes but the browser shows no visuals** — check the Vercel
  variables (§3) before touching Cloudflare. The verifier proves the host; it
  says nothing about what the bundle was built with.

### The `R2_LIVE_CHECK` footgun

`packages/e2e/tests/r2-delivery.spec.ts` is gated behind `R2_LIVE_CHECK`, and
**any non-empty value enables it**. `R2_LIVE_CHECK=0` and `R2_LIVE_CHECK=false`
both turn the live check **ON**. To disable it, leave the variable **unset**.
The failure direction is safe (you get a run you did not want, not a silent
skip), but do not expect `=0` to mean off.

---

## 7. Traps

- **Manual uploads must set `Content-Type` and `Cache-Control` explicitly. R2
  infers neither.** It defaults to `application/octet-stream`, which fails the
  content-type checks and breaks AVIF/WebP decoding in the reader. Objects and
  manifests get `public, max-age=31536000, immutable`; `current.json` gets
  `no-cache, max-age=0, must-revalidate`. The cache rules are an enforcement
  layer for the *edge*, not a substitute for correct object metadata — browser
  TTL is `respect_origin`, so a wrong object header reaches the client verbatim.
- **Renaming a bucket in `r2-delivery.config.json` is not a safe re-run.**
  Nothing here deletes, so a rename yields a second, empty bucket while the custom
  domain stays bound to the original — the hostname keeps serving the old bucket
  and the new one silently receives the uploads. Detach the domain and delete the
  old bucket **manually and deliberately** first.
- **Preview trees are world-readable and branch-derived ids are guessable.**
  `vn/previews/<previewId>/…` is public, and `previewId` is a slug of the branch
  name. For spoiler-sensitive work, publish under a manually-set, unguessable
  `PUBLIC_ASSET_PREVIEW_ID` instead of the derived one.
- **Never enable the r2.dev public development URL.** It bypasses every cache
  rule and any future WAF policy, and creates a second access path nobody is
  watching.
- **A green `no forbidden keys in public json` check is not proof that no
  credential leaked.** `findForbiddenKeys` in
  `packages/infra-cloudflare/src/assertions.ts` matches an exact key set
  (`prompt`, `prompts`, `sourcepath`, `sourcepaths`, `localpath`, `provider`,
  `credential`, `credentials`, `secret`, `token`). Names like `sourceKey`,
  `apiKey`, or `signedUrl` pass through undetected. It is a smoke check, not a
  leak-proof filter — review what the publisher emits.
- **Never point the custom domain at `aquila-vn-source`.** That bucket exists
  precisely so authoring originals and their prompt/provider metadata are
  unreachable over HTTP. `verify.ts` probes one known source key
  (`the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`) and requires a 403
  or 404.

---

## 8. What has not been verified

Everything below is **unproven**. Nothing in this runbook should be read as
evidence that the pipeline works.

**Confirmed live state, 2026-07-30:**

- Buckets `aquila-vn-source` and `aquila-vn-delivery` exist (created
  2026-07-29).
- `assets.aquila.cwchanap.dev` resolves to Cloudflare IPs but returns
  **HTTP 404** with `cf-cache-status: DYNAMIC` — the custom domain is **not**
  connected.
- CORS is **unset**. The three cache rules **do not exist**. Smart Tiered Cache
  state unconfirmed. No publisher token minted. No Vercel variables set. **No
  release has ever been published.**

**Never executed against a real response** — every one of these is reachable only
past the first HTTP request, and that request has only ever returned 404:

| Unproven | Where |
| --- | --- |
| Pointer JSON parse, `releaseId` extraction, `manifestPath` agreement | `verify.ts` |
| Manifest fetch, parse, and content-type | `verify.ts`, `r2-delivery.spec.ts` |
| All `cache-control` assertions (immutable and pointer) | `assertions.ts` via both verifiers |
| `image/webp` and `image/avif` content-types on real objects | `verify.ts` |
| `cf-cache-status: HIT` corroboration | `verify.ts` |
| Source-bucket-not-public probe | `verify.ts` |
| `findForbiddenKeys` against real published JSON | `verify.ts` |
| Browser image decode via `createImageBitmap` | `r2-delivery.spec.ts` |
| The CORS-`blocked` failure branch, and CORS enforcement by a real browser | `r2-delivery.spec.ts` |
| Pointer-activation timing and propagation delay | §5, unmeasured |

**Commands whose real output is recorded here:** `bun lint` (4 tasks green),
`bun run test` (5 tasks green — web 1582, game 412, stories 198,
infra-cloudflare 53; desktop has no test files),
`bun --filter @aquila/infra-cloudflare verify` (1 FAIL, HTTP
404 on the pointer — the expected pre-provisioning signal),
`bun --filter @aquila/infra-cloudflare seed` (fails: `Module not found
"src/seed.ts"`).

**Commands never run successfully:** `seed` (unimplemented) and
`R2_LIVE_CHECK=1 bun --filter e2e test:e2e tests/r2-delivery.spec.ts` (fails at
the pointer fetch with HTTP 404 in ~700 ms; the spec's own message names the URL
and the prerequisites).

When the infrastructure is provisioned and a release published, re-run all three
verifiers and replace this section with what was actually observed.
