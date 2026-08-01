# R2 visual asset delivery (HPA-229)

Runbook for `assets.aquila.cwchanap.dev` — the Cloudflare R2 delivery host that
serves visual-novel runtime assets to the web reader.

> **Status: provisioned and proven end to end, with one known defect.** As of
> 2026-07-31 both buckets exist, the custom domain is connected, CORS is applied,
> both cache rules match, and the `smoke` release of `the_seventh_mirror` is
> published. `verify` passes all its checks and the live e2e passes 2/2 —
> cache-control headers, content types, real-browser image decode, and the full
> pointer/manifest/object integrity chain (contract parsing, manifest-byte and
> canonical-content digests, object byte-length and SHA-256) are all confirmed
> against live `200` responses.
>
> **One design value changed after measurement.** The pointer's 60-second edge
> TTL proved unrepresentable — Cloudflare's Free plan floors Edge TTL at 2 hours
> — so the pointer rule now **bypasses** the edge cache instead. Releases
> activate immediately; the cost is one R2 read per page load of a ~300-byte
> JSON. See [§5](#pointer-activation-timing--measured-then-redesigned).
>
> [§8](#8-what-has-not-been-verified) lists what remains unproven.

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
| Pointer edge caching | **Bypassed** — Free plan floors Edge TTL at 2 h |
| `respect_strong_etags` | `true` on both rules |
| Cache Rules budget | Free plan allows 10 per zone; this work uses 2 |
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
| Preview manifest / pointer | the same two under `vn/previews/<previewId>/stories/…` |

Objects are **not** namespaced per preview: `getObjectPath()` always returns
`vn/objects/…`, and the `vn/previews/<previewId>/` prefix applies only to the
manifest and the pointer. Objects are content-addressed, so production and every
preview share one copy of identical bytes.

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
allowlist would break visual mode on every Vercel preview. `content-type` is absent from
`ExposeHeaders` because it is already CORS-safelisted. The three
`AllowedHeaders` are forward-looking: today's reader issues plain GETs, which are
CORS-simple and never preflight.

**A wildcard does not avoid `Vary: Origin`.** This was assumed during design and
is false: R2 returns `Vary: Origin` on cross-origin responses regardless of the
policy being `*`, so the edge still keeps one cache entry per `Origin` request
header. The consequence is not performance but purging — see the trap in
[§2.9](#29-seed-a-release-then-verify). Measured 2026-07-31.

### 2.5 Enable Smart Tiered Cache

Zone `cwchanap.dev` → Caching → Tiered Cache → Smart Tiered Cache Topology →
**On**.

This is a zone toggle, not a rule — it does **not** consume any of the 10-rule
Cache Rules budget. It is also zone-wide, so it affects every hostname on
`cwchanap.dev`, not just this one. **Its current state has never been
observed** — check what it is set to before toggling it.

### 2.6 Create the two cache rules

Zone `cwchanap.dev` → Caching → Cache Rules → Create rule, twice. Enter
each row exactly as given; the **rule name is a load-bearing identity** —
`packages/infra-cloudflare/src/rules.ts` emits these exact descriptions, and they
are how a later reader tells an Aquila rule from anything else in the zone.

Every field below is derived from `buildCacheRules()` in
`packages/infra-cloudflare/src/rules.ts` applied to `r2-delivery.config.json`. If
this table and that file ever disagree, the file wins.

**Two rules, not three.** Objects and release manifests are both immutable and
share one edge TTL, so they merge into a single predicate. The pointer cannot
join them: it is not cached at the edge at all.

In the dashboard, choose **Custom filter expression** and use the expression
editor's **Edit expression** (text) mode so the strings below can be pasted
verbatim. **Switch to text mode before typing anything.** If you paste an
expression into the visual builder's *value* box instead, the dashboard quotes it
as data — the saved rule comes back as
`(http.request.full_uri wildcard r#"…"#)`, which compares the URL against your
expression *as a literal pattern* and therefore matches nothing. The symptom is
`cf-cache-status: DYNAMIC` on paths that should be cacheable. A correct rule's
preview starts with `(http.host eq …` and contains no `full_uri`, `wildcard`, or
`r#`. Some dashboard versions will not convert a builder rule to a raw expression
after the fact; if editing keeps re-wrapping it, delete the rule and start over in
text mode.

**Rule 1 of 2**

| Field | Value |
| --- | --- |
| Rule name | `aquila-vn: immutable objects and manifests` |
| Expression | `(http.host eq "assets.aquila.cwchanap.dev" and (starts_with(http.request.uri.path, "/vn/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json")))` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Ignore cache-control header and use this TTL — `31536000` seconds |
| Browser TTL | Respect origin |
| Respect strong ETags | On |

**Rule 2 of 2**

| Field | Value |
| --- | --- |
| Rule name | `aquila-vn: active release pointer` |
| Expression | `(http.host eq "assets.aquila.cwchanap.dev" and ends_with(http.request.uri.path, "/current.json"))` |
| Cache eligibility | **Bypass cache** |

That is the whole rule — choosing *Bypass cache* removes the Edge TTL, Browser
TTL, and ETag fields, because none of them apply to a response that is never
cached.

Notes:

- **The inner parentheses in rule 1 are load-bearing.** `and` binds tighter than
  `or` in Cloudflare's expression language, so without them the manifest branch
  would match on *every* host, including any other bucket later attached to this
  zone.
- **"Ignore cache-control header" applies to the edge only.** It does not strip or
  rewrite the header: the origin's `Cache-Control` still reaches the browser
  untouched, which is why Browser TTL stays on *Respect origin*.
- **Rule order does not matter.** The predicates are mutually exclusive: a
  content-addressed object is `<sha256>.webp` or `<sha256>.avif` and can never
  end in `runtime-manifest.json` or `current.json`.
- **Why the pointer bypasses the cache instead of taking a short TTL.** The
  design asked for a 60-second edge TTL. **Cloudflare's Free plan will not accept
  one** — the minimum selectable Edge TTL is 2 hours, and a pointer that can be
  two hours stale defeats the indirection it exists for: a published release
  would not reach clients until the TTL lapsed, independently per PoP.

  Purging on publish is not the escape hatch it looks like. R2 sends
  `Vary: Origin` on cross-origin responses, so the edge keeps a separate entry
  per `Origin` request header, and purge-by-URL clears only the no-`Origin`
  variant — the one no browser ever reads. Clearing the rest needs Purge
  Everything, which no publisher should call per release.

  The cost of bypassing is one R2 read per page load of a ~300-byte JSON,
  against a 10M-request/month free tier. `cf-cache-status` on the pointer is
  therefore `BYPASS`, always. The immutable rule is untouched, so images and
  manifests still cache for a year — the pointer is the only uncached path, and
  it is the smallest object served.
- **Why `Respect origin` on browser TTL.** The browser must see the object's own
  `Cache-Control` — the immutable/pointer distinction is carried by the object
  metadata the publisher sets, and the client contract depends on it.
- **Why `Respect strong ETags`.** R2 returns strong ETags; preserving them keeps
  conditional revalidation of `current.json` cheap (a 304 instead of a body).

Deleting or editing one of these rules later is a manual, deliberate act.

### 2.7 Mint the publisher token and store it as secrets

R2 → API → Manage API tokens → Create API token:

- Permission: **Object Read & Write**
- Specify bucket: **`aquila-vn-delivery` only**. Not account-wide, and not
  including `aquila-vn-source`.
- Name: `aquila-vn-publisher`

**Deliberate divergence from the design.** D6 of
`docs/superpowers/specs/2026-07-28-hpa-229-r2-visual-asset-delivery-design.md`
scopes this token to *both* buckets, and the cancelled minter built its resource
map from `[config.buckets.source, config.buckets.delivery]`. Delivery-only was
chosen instead, as least privilege: a leaked publisher key must not be able to
touch the private authoring originals. An R2 API token carries a **single
permission level across all the buckets it selects**, so "read-write on delivery,
read-only on source" is not expressible in one token — which is why the design's
version would have granted write access to `aquila-vn-source`.

If HPA-230's publisher turns out to need to read authoring originals from
`aquila-vn-source`, the correct response is to **mint a second, read-only token
scoped to `aquila-vn-source`** — not to widen this one.

Copy the Access Key ID and Secret Access Key **once** — Cloudflare will not show
the secret again — and store them in GitHub Actions **secrets** as
`R2_PUBLISHER_ACCESS_KEY_ID` and `R2_PUBLISHER_SECRET_ACCESS_KEY`. Never in the
repo, never in `.env`, never in a Vercel `PUBLIC_*` variable.

The account id is stored as a GitHub Actions **variable**, not a secret:
`R2_PUBLISHER_ACCOUNT_ID`. It is not sensitive — the same value is already
committed in `packages/infra-cloudflare/r2-delivery.config.json` as `accountId`,
so classifying it as a secret would only obscure it in logs while changing
nothing about who can read it. The practical consequence is that a workflow must
reference it as `${{ vars.R2_PUBLISHER_ACCOUNT_ID }}`; `${{ secrets.… }}` silently
resolves to an empty string, which surfaces later as an opaque S3 endpoint error
rather than a missing-variable error.

R2 API token scoping is per-bucket only — it cannot express a key-prefix
restriction, so this token can write anywhere inside `aquila-vn-delivery`,
previews and production alike. Prefix-scoped temporary credentials are possible
but belong to the publisher (HPA-230), not here.

### 2.8 Set the Vercel environment variables

Vercel → the `aquila` project → Settings → Environment Variables. Add each
variable and tick the environments it applies to, per the table in
[§3](#3-environment-variables). Set them only after the custom domain reads
Active, and set all three per environment **together** — never partially.

Vercel environment variables are read at **build** time (`PUBLIC_*` values are
inlined into the client bundle by Vite), so existing deployments do not pick them
up. **Redeploy** — Deployments → the latest deployment → Redeploy — for each
environment whose variables you changed.

### 2.9 Seed a release, then verify

Publish the smoke release, then run the two verifiers:

```bash
R2_PUBLISHER_ACCESS_KEY_ID=<access key id> \
R2_PUBLISHER_SECRET_ACCESS_KEY=<secret access key> \
  bun --filter @aquila/infra-cloudflare seed
bun --filter @aquila/infra-cloudflare verify
R2_LIVE_CHECK=1 bun --filter e2e test:e2e tests/r2-delivery.spec.ts
```

`seed` publishes through the R2 S3-compatible API
(`https://<accountId>.r2.cloudflarestorage.com`) using the scoped publisher
credentials minted in [§2.7](#27-mint-the-publisher-token-and-store-it-as-secrets)
— never the account-wide `CLOUDFLARE_API_TOKEN`, which the seeder deliberately
does not accept. It uploads four content-addressed objects — one background
and one portrait, each as WebP **and** AVIF — then the release manifest, then the
pointer, in that order, so nothing is ever advertised before it is readable.

The release id is content-addressed over the manifest, which means it is derived
from the encoded bytes. `sharp`'s WebP/AVIF encoders are not byte-identical
across libvips builds, so **the release id differs from machine to machine**. Do
not pin it anywhere; read it from the seeder's final line.

The second command needs more than Cloudflare: Playwright starts `apps/web`'s
dev server on **port 5090** and injects a `DATABASE_URL`, defaulting to
`postgresql://postgres:postgres@localhost:5432/aquila_e2e`
(`packages/e2e/playwright.config.ts`). Without a reachable database the run fails
at web-server startup, which reads like a delivery-infrastructure problem when it
is a local-environment one. Export your own `DATABASE_URL` to override the
default.

> **Historical — recorded before the pointer bypass rule (§5).** The trap below
> was observed when the pointer (`current.json`) was edge-cached with a 60-second
> TTL. The pointer rule now **bypasses** the edge cache (confirmed 2026-07-31:
> `cf-cache-status: DYNAMIC` with no `age` header across 8 consecutive requests,
> see §5), so a pre-publication 404 of `current.json` is no longer held at the
> edge — it reaches R2 on every request, and the 404 disappears as soon as the
> object exists. The `Vary: Origin` / Purge-Everything behaviour it describes
> still applies to *cacheable* paths (the manifest and objects), but those are
> content-addressed and "never 404 then start existing at the same URL", so the
> trap does not arise for them either. Re-test the pointer case under the
> deployed bypass before relying on any of this; it is kept here as the record of
> why the bypass rule exists.
>
> **Trap: a 404 probed before publication outlives the pointer's 60-second TTL.**
> If you `curl` the pointer URL before seeding — which is exactly what §2.9 tells
> you to do, and what `verify` does — Cloudflare caches the resulting 404 error
> page at the PoP that served it. That cached 404 is **not** governed by the
> pointer cache rule's 60-second Edge TTL. Observed on this zone: 404 still
> served with `cf-cache-status: HIT` and `age: 5874` (98 minutes) long after the
> object existed in R2, while the same URL with a `?cb=<random>` query returned
> `HTTP 200`, `content-type: application/json`,
> `cache-control: no-cache, max-age=0, must-revalidate`.
>
> Diagnose it by comparing the bare URL against a cache-busted one:
>
> ```bash
> P=https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json
> curl -sI "$P"           | grep -Ei '^(HTTP|age|cf-cache-status)'
> curl -sI "$P?cb=$RANDOM" | grep -Ei '^(HTTP|age|cf-cache-status)'
> ```
>
> A 404 on the first and a 200 on the second means the object is published and
> the edge is holding a stale error. Purging by URL only clears the PoPs, not
> R2 — it cannot lose data.
>
> **Purge by URL is not enough.** R2 answers cross-origin requests with
> `Vary: Origin`, so the edge keeps a **separate cache entry per `Origin`
> request header**, and a URL purge clears only the no-`Origin` variant. This is
> not a corner case: `verify.ts` sends `Origin: https://aquila.cwchanap.dev` on
> every request (it is also checking CORS), so the one variant a URL purge leaves
> behind is precisely the one the verifier reads. Observed after a successful URL
> purge — same URL, same second:
>
> ```text
> (no Origin header)                HTTP/2 200  cf-cache-status: HIT   age: 30
> Origin: https://aquila.cwchanap.dev  HTTP/2 404  cf-cache-status: HIT   age: 6302
> Origin: https://example.invalid      HTTP/2 200  cf-cache-status: MISS
> ```
>
> Only the origin that was probed pre-publication is poisoned. Check for it with:
>
> ```bash
> curl -sI -H 'Origin: https://aquila.cwchanap.dev' "$P" | grep -Ei '^(HTTP|age|cf-cache-status)'
> ```
>
> Clearing it needs **Purge Everything** (Caching → Configuration → Purge Cache),
> which drops every variant. Purging a single URL *with* a header is an
> Enterprise-only capability and is not available on this zone's plan. Purge
> Everything costs the whole `cwchanap.dev` zone a brief cache-miss period;
> nothing is lost, and the immutable asset paths refill on first request.
>
> This matters beyond first-time setup: it is a live hazard for anyone debugging
> a pointer that has not yet been published. The immutable paths are immune —
> a content-addressed object never 404s and then starts existing at the same URL.

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

Output **before** anything is published:

```text
$ bun --filter @aquila/infra-cloudflare verify
Verifying https://assets.aquila.cwchanap.dev — story the_seventh_mirror, preview smoke

FAIL  pointer fetch — GET https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json returned HTTP 404 (dependent checks skipped)

1 check(s) failed.
```

A single FAIL on `pointer fetch` with dependent checks skipped is the correct
pre-publication signal. Anything else means something unexpected is answering on
that hostname.

**This is also exactly what a stale cached 404 looks like after a successful
seed** — the verifier cannot tell the two apart, because from the outside they
are the same response. If `seed` reported `Seeded release sha256-…` and `verify`
then reports this, run the cache-busted comparison in the trap above before
suspecting the upload.

---

## 3. Environment variables

### Repository `.env.example` block

```dotenv
# ── Visual novel asset delivery (Cloudflare R2) ──────────────────────────────
# Unset locally: the reader serves bundled fixtures from /assets/.
# Production (Vercel): PUBLIC_ASSET_BASE_URL + PUBLIC_ASSET_ENVIRONMENT=production
# Preview (Vercel):    PUBLIC_ASSET_BASE_URL + PUBLIC_ASSET_ENVIRONMENT=preview
#                      PUBLIC_ASSET_PREVIEW_ID is derived at build time, or
#                      set explicitly for an unguessable spoiler-sensitive id.
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
| Preview | `https://assets.aquila.cwchanap.dev/` | `preview` | optional — derived from the branch if unset |
| Development | unset | unset | unset |

- **Production**: a preview id is fatal there —
  `resolveAssetSource()` throws "Preview id is meaningless when
  `PUBLIC_ASSET_ENVIRONMENT` is production"
  (`apps/web/src/lib/visual-assets/asset-source-config.ts`).
- **Preview**: if `PUBLIC_ASSET_PREVIEW_ID` is unset, the build derives one from
  the branch ref via `apps/web/scripts/asset-preview-id.ts`, which
  `apps/web/package.json`'s `build` script invokes and passes into
  `astro build`'s own environment (Vite inlines `PUBLIC_*` from the build
  process, so a separate `&&`-chained step cannot work). If it **is** set, the
  build honours the explicit value instead of deriving one — set an unguessable
  id here for spoiler-sensitive previews (see the trap in [§7](#7-traps)). An
  explicit value that fails `isPreviewId()` fails the build.
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

### Branch-derived preview ids

`derivePreviewId()` slugifies the NFC-normalized ref (lowercase, disallowed runs
to `-`, separator runs collapsed, leading/trailing separators stripped). If the
slug is empty the id is `preview-<8 hex of sha256(NFC(ref))>`. Otherwise the
slug is clamped to 51 characters, any trailing `-` or `_` left by that cut is
stripped — so the head can be shorter than 51 — and
`-<12 hex of sha256(NFC(ref))>` is appended, for a maximum of 64 characters.

The digest is appended to **every** non-empty slug, not only to long ones,
because slugification is lossy: `feature/foo`, `feature-foo`, and `Feature/Foo`
all collapse to `feature-foo`, and `a__b` and `a--b` both collapse to `a-b`. A
bare slug would merge unrelated branches into one preview namespace, and
publishing from one would silently overwrite the others' assets. The digest is
taken over the NFC-normalized ref *before* lowercasing, so refs that differ
only in case get distinct ids even when their slugs match. An absent
`VERCEL_GIT_COMMIT_REF` is **rejected** by `previewIdForEnv()` — hashing the
empty string is deterministic, so every ref-less build would otherwise collapse
onto one shared `preview-<8 hex>` namespace and publishing from one would
silently overwrite the others' assets. The build fails instead, forcing the
operator to set the ref (or an explicit `PUBLIC_ASSET_PREVIEW_ID`). The
`preview-<8 hex>` branch is still reachable for refs that slugify to nothing
(e.g. `'日本語'`), but never for a missing ref.

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
>
> No purge step. The pointer bypasses the edge cache entirely
> ([§2.6](#26-create-the-two-cache-rules)), so a rollback pointer is live the
> moment it is uploaded.

Immutable objects and manifests are content-addressed, so a rollback never needs
to touch them — the old release's objects are still there under their digests.

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
- `current.json` will show a **zero** hit ratio by design: the pointer rule
  bypasses the cache, so every request reaches R2.

Read the hit ratio per path class, not zone-wide — the pointer's bypasses would
otherwise look like a cache problem.

### `cf-cache-status` by path class

| Value | `/vn/objects/*` | `*/runtime-manifest.json` | `*/current.json` |
| --- | --- | --- | --- |
| `DYNAMIC` / `BYPASS` | **rule not matching** | **rule not matching** | **correct** — the pointer is not edge-cached. Observed: `DYNAMIC` |
| `HIT` | expected steady state | expected steady state | **wrong** — the pointer is being cached, so a published release can go unseen |
| `MISS` | first request per colo, or after eviction | same | **wrong** — implies the pointer is cache-eligible |
| `EXPIRED` | should not occur (1-year TTL) | should not occur | **wrong**, same reason |
| `REVALIDATED` | rare | rare | **wrong**, same reason |

> **The pointer column is a live assertion, not trivia.** `HIT`, `MISS`,
> `EXPIRED`, or `REVALIDATED` on `current.json` means the rule was changed back
> to a cacheable action and releases have silently stopped propagating. Check it
> after any edit to the cache rules.
>
> The binding signal is the **absence of caching**, not the exact label. A
> Bypass-cache rule and no-rule-at-all both report `DYNAMIC` on this zone — they
> are indistinguishable from outside, so `cf-cache-status` alone cannot tell you
> the rule still exists. Confirm the rule is present in the dashboard, not by
> probing.

Measured after the change (2026-07-31): 8 consecutive requests to the pointer,
sent with `Origin: https://aquila.cwchanap.dev`, all returned
`cf-cache-status: DYNAMIC` with **no `age` header at all** — the definitive
evidence, since a cached response always carries `age`. The manifest and objects
sampled at the same moment read `HIT` with `age: 1921`, confirming the immutable
rule was not disturbed.
| *(header absent)* | Hotlink Protection, not CORS — see [§6](#6-troubleshooting) | same | same |

`DYNAMIC` on the two **immutable** path classes means no Cache Rule matched:
Cloudflare treats the response as uncacheable-by-default. That is also what an
unconnected or unproxied hostname produces. On the pointer, `DYNAMIC` is the
expected value and not a fault.

`MISS` on a repeat request is not automatically a fault: sequential requests can
land on different colos and cache fill is asynchronous. This is why `verify.ts`
retries the HIT probe 4 times with a 1 s delay and reports it as a **warning**,
never a failure — the binding criteria are the cache *headers*.

### Pointer-activation timing — MEASURED, THEN REDESIGNED

The design's one empirical open question: after publishing a new pointer, how
long until the new `releaseId` is visible at the edge. The design bounded this
with a **60-second** Edge TTL. Measuring it showed that bound was never in
force, and could not be.

**Measured 2026-07-31.** 40 samples at 5-second intervals against the live
pointer, sent with `Origin: https://aquila.cwchanap.dev`:

```text
07:03:31  age: 4    cf-cache-status: HIT
07:04:29  age: 62   cf-cache-status: HIT     <- should have expired here
07:05:30  age: 123  cf-cache-status: HIT
07:06:30  age: 184  cf-cache-status: HIT
07:07:26  age: 239  cf-cache-status: HIT
```

`age` climbs monotonically to 239 s and never resets. `etag` never changes.
`EXPIRED` and `REVALIDATED` never appear. For comparison, an immutable object
sampled at the same moment read `age: 252` — the pointer is being cached
*indistinguishably from a one-year immutable object*.

Reproduce it with:

```bash
P=https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json
for i in $(seq 1 20); do
  curl -sI -H 'Origin: https://aquila.cwchanap.dev' "$P" \
    | tr -d '\r' | grep -iE 'cf-cache-status|age|etag' | tr '\n' ' '
  echo " @ $(date -u +%H:%M:%S)"
  sleep 10
done
```

**Cause: a plan floor, not a misconfiguration.** The rule's Edge TTL was set to
the lowest value the dashboard offers — **120 minutes**. Cloudflare's Free plan
will not accept anything shorter. The 60 seconds this design specified was never
representable on this zone, and no amount of correcting the rule would have made
it so.

Serve-stale and revalidation were both ruled out along the way, and the
reasoning is worth keeping: serve-stale reports `cf-cache-status: STALE`, and
revalidation reports `REVALIDATED` and resets `age`. Seeing plain `HIT` with
monotonically climbing `age` means the entry was simply still fresh.

**Resolution: the pointer bypasses the edge cache.** A two-hour-stale pointer
defeats the indirection it exists for, and purging per publish does not work
here (`Vary: Origin`, see [§2.9](#29-seed-a-release-then-verify)). So the rule's
action changed from *Eligible for cache* to *Bypass cache*, and
`pointerEdgeTtlSeconds` was removed from `r2-delivery.config.json` — a knob that
cannot be honoured is worse than no knob. Activation latency is now bounded by
R2 write visibility rather than by any edge TTL.

**Why this was invisible until measured.** `verify` passes all its checks and
the live e2e passes with the pointer cached for two hours, because a first
release has nothing to supersede. The failure would have first appeared on the
**second** publish — i.e. the first time HPA-230's publisher ran for real,
against a story
someone was already reading.

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
  `fetch(..., { cache: 'no-cache' })` is request-side and is not among them.
  This is why the pointer relies on a Cache Rule that **bypasses the edge
  cache** ([§2.6](#26-create-the-two-cache-rules)) rather than on response
  directives alone: on this zone's Free plan a cacheable pointer was measured
  staying fresh for two hours with `age` climbing monotonically and never
  revalidating ([§5](#pointer-activation-timing--measured-then-redesigned)), so
  a `HIT`/`MISS`/`EXPIRED`/`REVALIDATED` on `current.json` is **not** harmless —
  it means the bypass rule is missing or no longer matching, and a published
  release can go unseen until the entry expires. The expected state is
  uncached (`DYNAMIC`/`BYPASS`) with **no `age` header at all**; see the
  `cf-cache-status` table in [§5](#cf-cache-status-by-path-class).

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

**Confirmed live state, 2026-07-31:**

- Buckets `aquila-vn-source` and `aquila-vn-delivery` exist (created
  2026-07-29).
- **The custom domain is connected and bound to R2.** Evidence: a CORS preflight
  (`OPTIONS` with an `Origin` header) returns `204` with
  `access-control-allow-origin: *`, `access-control-allow-methods: GET, HEAD`,
  and `access-control-max-age: 86400`. A Cloudflare error page would not answer a
  preflight, so this also confirms the CORS policy is applied with the configured
  values.
- **Both cache rules match.** Probed with `cf-cache-status`:

  | Path | Status | Meaning |
  | --- | --- | --- |
  | `/vn/objects/<x>.webp`, `.avif` | `EXPIRED` | rule 1 matched |
  | `…/releases/…/runtime-manifest.json` | `MISS` | rule 1 matched |
  | `/vn/stories/…/current.json` | `MISS` | rule 2 matched |
  | `/vn/previews/…/current.json` | `MISS` | rule 2 matched |
  | `/vn/stories/x/other.json` | `DYNAMIC` | correctly not matched |
  | `/not-matched.txt` | `DYNAMIC` | control |

  The fifth row matters: an unrelated `.json` under `/vn/stories/` stays uncached,
  so the `ends_with` predicates are precise rather than over-broad.
- Smart Tiered Cache state still unconfirmed — it is in no config file, so nothing
  detects drift.
- **No release has ever been published**, so every check below remains unproven.

A caveat on the two rows above that report a cached status: those responses were
all **404s**, and Cloudflare applies its own short TTL to error responses
regardless of a rule's Edge TTL. So these probes prove the rules *match and make
the path cacheable*; they do **not** prove the `31536000` and `60` second TTLs are
in effect. Only real `200` responses can show that, via `age` and
`cache-control` — which is what `verify.ts` checks.

### Published by `seed`, confirmed by hand

The smoke release **is** published. `seed` uploaded four objects, a manifest and
a pointer, and each was fetched over the custom domain with `curl -sI`:

| Path class | Status | `content-type` | `cache-control` |
| --- | --- | --- | --- |
| `vn/objects/…webp` | 200 | `image/webp` | `public, max-age=31536000, immutable` |
| `vn/objects/…avif` | 200 | `image/avif` | `public, max-age=31536000, immutable` |
| `…/releases/sha256-…/runtime-manifest.json` | 200 | `application/json` | `public, max-age=31536000, immutable` |
| `…/current.json` (cache-busted) | 200 | `application/json` | `no-cache, max-age=0, must-revalidate` |

This closes most of the "unproven" list below: real `200` responses now carry the
`cache-control` values the design specifies, on both image formats, so the
`31536000` and `60` second policies are no longer inferred from 404s alone.

Release id on the seeding machine:
`sha256-b632cb09dc33a093b9739391b74755089663fb475f373b8904812d1d5669f587`.
Recorded for traceability only — see §2.9 on why it is machine-dependent.

### Still unproven

Both verifiers now pass end to end, after a zone-wide **Purge Everything**
cleared the poisoned `Vary: Origin` variant (§2.9).

- `bun --filter @aquila/infra-cloudflare verify` — **all checks PASS**,
  including pointer content-type, revalidation directives, CORS, `manifestPath`
  agreement with the publication layout, the reader's contract parsers
  (`parseActiveReleasePointer`, `parseRuntimeAssetManifest`), the manifest-byte
  digest vs `pointer.manifestSha256`, the pointer/manifest pair validation, the
  canonical release-content digest vs `releaseId`, manifest and object
  content-types and immutability, **object byte-length and SHA-256 vs the
  manifest variant** (the same two checks the reader performs before decoding),
  `MISS -> HIT` cache corroboration, source-objects-not-public (404), and
  `findForbiddenKeys` clean against the real published JSON.
- `R2_LIVE_CHECK=1 bun --filter e2e test:e2e tests/r2-delivery.spec.ts` —
  **2 passed (5.6 s)**: a real browser fetching and decoding the seeded release
  cross-origin via `createImageBitmap`, and page script reading the pointer
  revalidation directives.

Still unproven:

| Unproven | Where |
| --- | --- |
| The CORS-`blocked` failure branch (no origin is actually refused — the policy is `*`) | `r2-delivery.spec.ts` |
| Smart Tiered Cache state | §2.5, never confirmed |

**One design value changed as a result of measurement**: the pointer's 60-second
Edge TTL was unrepresentable on the Free plan, so the pointer now bypasses the
edge cache — see [§5](#pointer-activation-timing--measured-then-redesigned).
None of the checks above detect this either way, because a first release has
nothing to supersede; it would have surfaced on the *second* publish.

**The bypass change is deployed and confirmed** (2026-07-31): the pointer
returns `cf-cache-status: DYNAMIC` with no `age` header across 8 consecutive
requests, while the manifest and objects still return `HIT`. Re-confirm after
any cache-rule edit with:

```bash
curl -sI -H 'Origin: https://aquila.cwchanap.dev' \
  https://assets.aquila.cwchanap.dev/vn/previews/smoke/stories/the_seventh_mirror/current.json \
  | grep -iE 'cf-cache-status|age'
```

**Commands whose real output is recorded here:** `bun lint` (4 tasks green),
`bun run test` (5 tasks green — web 1582, game 412, stories 198,
infra-cloudflare 53; desktop has no test files),
`bun --filter @aquila/infra-cloudflare seed` (success: 6 uploads, `Seeded release
sha256-b632cb09…`), `bun --filter @aquila/infra-cloudflare verify` (15 PASS),
`R2_LIVE_CHECK=1 bun --filter e2e test:e2e tests/r2-delivery.spec.ts` (2 passed).

**Use `bun run test`, not `bun test`.** `test` is a Bun builtin, so a bare
`bun test` at the repo root shadows the npm script and runs Bun's own test runner
over the whole repo — producing `794 pass / 632 fail / 40 errors`, mostly
`vi.hoisted is not a function`, because these are Vitest suites. That is an
invocation error, not a broken repo.

**Commands never run successfully:** none remaining.
