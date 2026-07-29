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

Hardening this at the credentials layer was considered and **cannot be done with
long-lived tokens**: an R2 Access Policy scopes by bucket only
(`com.cloudflare.edge.r2.bucket.<account>_<jurisdiction>_<bucket>`), with no
prefix dimension, so a token that may write `vn/previews/*` but not
`vn/stories/*/current.json` is not expressible. R2 *temporary credentials* do
support `prefixes`/`objects` scoping with a TTL derived from a parent token, so
the publisher could mint a preview-scoped credential per run and make the
violation impossible at the IAM layer. That requires credential vending inside
the publisher and therefore belongs to HPA-230; it is recorded here so the option
is not rediscovered from scratch.

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
`ExposeHeaders: ["etag", "content-length", "cf-cache-status"]`,
`MaxAgeSeconds: 86400`.

`content-type` is omitted from `ExposeHeaders` because it is already a
CORS-safelisted response header. The three `AllowedHeaders` are **forward-looking
and unused today**: the resolver issues plain GETs whose only option is `cache`
(`web-asset-resolver.ts:263`), with no conditional or range request headers, so
these requests are CORS-simple and never trigger a preflight. They are listed so
that a future range-request or conditional-fetch optimization does not require a
CORS change.

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
| 1 | `http.host eq "assets.aquila.cwchanap.dev" and starts_with(http.request.uri.path, "/vn/objects/")` | `cache: true`, edge TTL `override_origin` 31536000, browser TTL respect origin, `respect_strong_etags: true` |
| 2 | `http.host eq "…" and ends_with(http.request.uri.path, "/runtime-manifest.json")` | `cache: true`, edge TTL `override_origin` 31536000, browser TTL respect origin, `respect_strong_etags: true` |
| 3 | `http.host eq "…" and ends_with(http.request.uri.path, "/current.json")` | `cache: true`, edge TTL `override_origin` **60**, browser TTL `respect_origin`, `respect_strong_etags: true` |

All three set `respect_strong_etags: true`. It matters most on rule 3: the pointer
is the one path that actually revalidates, and Cloudflare weakens strong ETags on
compressed responses, which would turn browser revalidation of a small JSON
document into full-body responses instead of 304s. On rules 1 and 2 it is
consistency rather than benefit, since immutable objects never revalidate.

Rule 1 is *partly* redundant: `.webp` and `.avif` are already on Cloudflare's
default cached-extension list, so objects would edge-cache without it. It is kept
because it is what applies `respect_strong_etags` and a deterministic TTL to
hand-uploaded objects that carry no `Cache-Control`. Do not "simplify" it away —
the redundancy is only in the happy path.

The three predicates are mutually exclusive — a content-addressed object is
`<sha256>.webp` or `<sha256>.avif` and can never end in `runtime-manifest.json`
or `current.json` — so rule **order is not load-bearing** and reordering them is
safe. A future editor should not read the sequence as a precedence contract.

Rule 3 caches the pointer for 60 seconds rather than bypassing cache. This
absorbs pointer polling while keeping worst-case activation latency inside the
contract's 60-second client revalidation window. `override_origin` is deliberate:
the pointer's own `no-cache` header would otherwise suppress edge caching
entirely, and the browser still revalidates because browser TTL respects origin.

**Consequence, documented in the runbook:** activation is visible within 60s, but
an *instant* rollback requires purging the single `current.json` URL. The runbook
gives that command as a required rollback step.

**Which layer does what — read before changing any of them.** Three independent
mechanisms stack on the pointer, and it is easy to adjust the wrong one:

| Layer | Setting | Effect |
|---|---|---|
| Client fetch | `cache: 'no-cache'` (`web-asset-resolver.ts:497`) | The browser revalidates the pointer on every activation check, regardless of edge or origin headers |
| Edge (rule 3) | `override_origin`, 60s | Collapses many colo-level revalidations into one origin hit per minute |
| Origin object | `no-cache, max-age=0, must-revalidate` | What a non-Cloudflare client or a direct S3 read sees |

The 60s edge TTL therefore governs **origin load**, not client freshness — the
client is already revalidating every time. HPA-230 should not "fix" pointer
staleness by lowering the edge TTL; if activation appears slow, the layer to
inspect is the client fetch mode or the purge step.

**Hand-uploaded objects.** Layer 2 exists partly to cover objects uploaded
outside the publisher, but it only fixes edge behavior. An object uploaded
without a `Cache-Control` header still edge-caches for a year via
`override_origin`, while browser TTL `respect_origin` finds no header to respect
and the browser falls back to heuristic caching. That is acceptable for immutable
content-addressed objects, but it means a hand-uploaded object is not fully
equivalent to a published one. The runbook says to set `Cache-Control` on manual
uploads.

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

**Token creation is not part of reconcile.** `provision.ts` reconciles buckets,
CORS, the custom domain, and cache rules only. Creating the publisher credential
is a separate one-shot `bun r2:create-publisher-token` that prints the secret
once and exits.

This split is forced by R2's credential model: the Secret Access Key is shown
exactly once and can never be re-fetched. A reconciler that "ensures a token
exists" has only bad options — mint a new one on every run, producing secret
sprawl and silent rotation, or no-op when any token exists, in which case it can
never rotate. Neither is what an operator expects from a command they are told is
safe to re-run. The config file may carry token *metadata* (name, bucket scope)
for documentation, but it is never desired state that gets upserted.

### D6 — Credentials

| Secret | Home | Scope |
|---|---|---|
| `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` | GitHub Actions secrets; blank placeholders in `.env.example` for local publishing | R2 Object Read & Write, restricted to `aquila-vn-source` and `aquila-vn-delivery` only |
| `CLOUDFLARE_API_TOKEN` | Operator's shell only, for `provision.ts` | See scopes below. Never in the repo and never in CI. |

The operator token needs a union of scopes that is easy to under-provision, and
a missing scope surfaces as a mid-run 403 that reads like a script bug. It
requires, on account `91ee89a03a31b5354a25c49228e4ab85` and zone `cwchanap.dev`:

| Scope | Needed by | Why |
|---|---|---|
| Account · Workers R2 Storage · Edit | `provision.ts` | Create buckets, set CORS, attach the custom domain |
| Zone · Cache Rules · Edit | `provision.ts` | Create the `http_request_cache_settings` entrypoint and its three rules |
| Zone · DNS · Edit | `provision.ts` | The custom-domain attachment creates the proxied `assets` record |
| User · API Tokens · Write | `create-publisher-token.ts` only | Minting the publisher token is itself a token-creation call |

The two scripts need **different** tokens, and this is deliberate.
`create-publisher-token.ts` requires API-token-write authority, which is
strictly more dangerous than anything `provision.ts` does — a token that can
mint tokens can escalate. Keeping it out of the reconcile path means the
credential an operator exports routinely is not one that can create new
credentials. The publisher token is created as an **Account**-owned token so it
survives any individual user's removal from the account; that requires the
Super Administrator role.

**Preflight probes capabilities, it does not read scopes.**
`/user/tokens/verify` returns only `id`, `status`, and `expires_on` — it does not
report the token's policies, so it cannot tell an operator which scope is
missing. Instead, `provision.ts` preflights with one cheap read per capability it
will exercise (list R2 buckets, GET the zone's rulesets, GET zone DNS records)
and maps a 403 on each to the specific scope to add. That converts a mid-run
failure into an upfront, actionable message.

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

**Env is read at exactly one boundary and injected.** The exact call graph:

```ts
// Pure. No env access. Origin is used only for the all-unset local default.
getAssetResolverSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource | null;

// The only code in the app that touches import.meta.env.
readAssetSourceConfigFromEnv(env: ImportMetaEnv): AssetSourceConfig;

// Signature unchanged. config is a new optional 4th parameter so production
// omits it and tests inject one.
createVisualRuntime(
    storyId: string,
    origin: string,
    getSceneDialogue: GetSceneDialogue,
    config: AssetSourceConfig = readAssetSourceConfigFromEnv(import.meta.env)
): VisualReaderRuntime | null;
```

`ReaderShell.svelte:119` keeps calling
`createVisualRuntime(activeStoryId, runtimeOrigin(), getSceneDialogue)` with no
change, so its existing prop-injection seam and the tests that depend on it stay
signature-compatible. `origin` is retained solely to build the all-unset local
default `new URL('/assets/', origin)`; in every configured mode the base URL
comes from config and `origin` is unused.

This is deliberate rather than incidental. `apps/web/vitest.config.ts` uses the
default `envPrefix` (`VITE_`), so `import.meta.env.PUBLIC_ASSET_BASE_URL` would
be `undefined` under Vitest but defined under Astro — a test reading env directly
would pass against semantics production never exercises. Injection removes the
divergence and makes leaked `PUBLIC_ASSET_*` values in a CI shell structurally
incapable of affecting unit tests.

**Truth table.** Writing `B` = `PUBLIC_ASSET_BASE_URL`, `E` =
`PUBLIC_ASSET_ENVIRONMENT`, `P` = `PUBLIC_ASSET_PREVIEW_ID`. These four rows are
the *only* accepted configurations; every other combination throws at
construction.

| B | E | P | Result |
|---|---|---|---|
| unset | unset | unset | Local default — `baseUrl = new URL('/assets/', origin)`, `target = { kind: 'preview', previewId: 'hpa-228-local' }`. Today's behavior. |
| set | `local` | unset | Local fixtures at an explicit `B`. `http:` or `https:` both allowed, so fixtures can be served from another port. |
| set | `preview` | set, valid | Preview source. `B` must be `https:`; `P` must satisfy `isPreviewId()`. |
| set | `production` | unset | Production source. `B` must be `https:`. |

Throw reasons, each a distinct message:

| Condition | Reason |
|---|---|
| `B` set, `E` unset | Incomplete configuration |
| `E` set, `B` unset | Incomplete configuration |
| `E` not in `local` \| `preview` \| `production` | Unknown environment |
| `E` = `preview`, `P` unset | Preview requires a preview id |
| `E` = `preview`, `P` fails `isPreviewId()` | Invalid preview id |
| `E` = `local` or `production`, `P` set | Preview id is meaningless here |
| `E` = `preview` or `production`, `B` not `https:` | Remote asset base must be HTTPS |

A partially-set environment is treated as an error rather than as a fallback
precisely because half-configuration is the failure this rule exists to prevent:
falling back to local fixtures on a production deploy would render a
working-looking reader with no artwork, and the reader's graceful-fallback path
would mask it.

Notes on individual rules:

- `preview` requires `PUBLIC_ASSET_PREVIEW_ID` to satisfy `isPreviewId()` from
  `@aquila/stories/runtime-assets` — `/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/`.
  A non-empty check is insufficient: a branch slug with uppercase characters, a
  leading or trailing `-`/`_`, or more than 63 characters passes "non-empty" and
  then throws `unsafe-path` deep inside `WebAssetResolver.loadActiveRelease()`
  at read time. Validating with the same predicate the path builder uses moves
  that failure to construction, which is the entire point of this rule.
- The trailing slash on `PUBLIC_ASSET_BASE_URL` is **optional and normalized** —
  `normalizeBaseUrl()` (`web-asset-resolver.ts:104`) appends one via
  `resolveAssetUrl`, which already forces a trailing `/` on the pathname
  (`paths.ts:225`). Documentation and `.env.example` write it with the slash for
  consistency; neither form is an error.

**Vercel environment ownership — production only in this issue.** HPA-229 sets
`PUBLIC_ASSET_BASE_URL` and `PUBLIC_ASSET_ENVIRONMENT=production` on the Vercel
**Production** environment and documents them. Wiring preview deployments is
explicitly **not in this issue**.

The reason is that a valid `PUBLIC_ASSET_PREVIEW_ID` cannot be taken directly
from a Vercel system variable: `isPreviewId()` demands lowercase, ≤63
characters, no leading or trailing `-`/`_`, while real branch names routinely
violate all three (`HPA-229`, `feature/Foo`). Making preview work therefore
requires a slugify step at build time plus a decision about where it runs — a
small design of its own, which belongs with the publisher work that first needs
preview publication (HPA-230). Until then, preview deployments leave the
variables unset and fall through to the local-default row, which is the correct
and safe behavior for a deployment with nothing published for it.

**The story allowlist is preserved.** `getAssetResolverSource()` continues to
return `null` for stories other than `the_seventh_mirror`. Environment variables
change *how* an allowed story resolves, never *which* stories resolve. Only The
Seventh Mirror has visual assets, and HPA-231 migrates exactly that story;
dropping the allowlist would make every other story request a manifest that does
not exist. The existing "returns null for stories without a visual source" test
stays valid unchanged.

Failing loudly matters here: a production deployment that silently fell back to
local fixtures would serve a working-looking reader with no artwork, and the
existing graceful-fallback path would mask it.

## Repository artifacts

```text
infra/cloudflare/r2-delivery.config.json          desired state
infra/cloudflare/provision.ts                     idempotent apply, --dry-run
infra/cloudflare/create-publisher-token.ts        one-shot, prints secret once
infra/cloudflare/seed.ts                          upload smoke fixtures
infra/cloudflare/verify.ts                        smoke tests
infra/cloudflare/fixtures/                        tiny WebP/AVIF + manifest + pointer
docs/infrastructure/r2-visual-asset-delivery.md   runbook
```

Package scripts: `bun r2:provision`, `bun r2:provision:dry`,
`bun r2:create-publisher-token`, `bun r2:seed`, `bun r2:verify`.

**Implementation order** (smallest blast radius last, so the existing test suite
pins the local default until the end): config schema → `provision.ts` dry-run
against the real account → apply → seed → verify → D7 app change.

## Verification

Because the publisher does not exist yet, this issue seeds its own smoke
fixtures: a tiny WebP, a tiny AVIF, a runtime manifest, and a `current.json`,
all conforming to the HPA-227 schemas and uploaded under `vn/previews/smoke/`
(objects in the shared `vn/objects/` pool) by `bun r2:seed`. They are checked
into `infra/cloudflare/fixtures/`, and `seed.ts` sets **both `Content-Type` and
`Cache-Control`** on every uploaded object to the exact values the publisher will
use:

| Object class | `Content-Type` | `Cache-Control` |
|---|---|---|
| `vn/objects/*.webp` | `image/webp` | `public, max-age=31536000, immutable` |
| `vn/objects/*.avif` | `image/avif` | `public, max-age=31536000, immutable` |
| `runtime-manifest.json` | `application/json` | `public, max-age=31536000, immutable` |
| `current.json` | `application/json` | `no-cache, max-age=0, must-revalidate` |

Setting `Content-Type` explicitly is required, not incidental: R2 does not infer
it from the key extension and defaults to `application/octet-stream`, which would
fail verification checks 1–3 and would break AVIF/WebP decoding in the reader. HPA-231 does not depend on
them, and they can be deleted once a real release exists.

`verify.ts` exits non-zero on any failure and asserts the issue's acceptance
criteria mechanically:

1. `current.json` returns 200, `content-type` starting `application/json`, and a
   `cache-control` containing all three of `no-cache`, `max-age=0`, and
   `must-revalidate`. Header-name-and-substring assertions, matching checks 2–3,
   so the check is unambiguous to implement and does not depend on directive
   ordering or on `cf-cache-status`.
2. A runtime manifest returns 200, `content-type` starting `application/json`,
   and a `cache-control` containing `max-age=31536000` and `immutable`.
3. AVIF and WebP objects return `content-type` exactly `image/avif` and
   `image/webp`, with `cache-control` containing `max-age=31536000` and
   `immutable`.
4. A cross-origin `GET` with `Origin: https://aquila.cwchanap.dev` returns
   `access-control-allow-origin`.
5. A repeat request for an object reaches `cf-cache-status: HIT`, retried a few
   times with backoff and reported as a **warning rather than a failure** if it
   does not. Sequential requests can land on different Cloudflare colos, and a
   first response populates cache asynchronously, so a cross-colo `MISS` is a
   known false negative. The binding acceptance criterion is the cache *headers*
   asserted in checks 2 and 3; `HIT` is corroboration, and making it fatal would
   buy a flaky verifier for no additional guarantee.
6. A known source-bucket key returns 404 over the public domain, and the source
   bucket exposes no custom domain and no public development URL.
7. **Real-browser fetch.** A Playwright check loads a page on an Aquila origin
   and, from page context, `fetch`es the seeded `current.json`, runtime manifest,
   AVIF, and WebP — then decodes both images via `createImageBitmap` to prove
   they are real, decodable assets and not merely 200s with the right headers.
   Acceptance criterion 1 says "a browser ... can fetch", and header probes from
   a shell only approximate that: they never exercise the browser's CORS
   enforcement or its image decoders. `packages/e2e` already provides the
   harness.
8. **Live pointer activation.** Publish a second seeded pointer, then poll
   `current.json`, recording `cf-cache-status` and the wall-clock latency until
   the new `releaseId` is visible. This measures the D4 layering rather than
   assuming it: the design's claim is that `override_origin` 60s bounds
   *origin* load while the client's `cache: 'no-cache'` keeps *client* freshness
   immediate. If observed behavior contradicts that, the cache rule is what
   changes — the finding is recorded in the runbook either way, since this is
   the one part of D4 that documentation alone cannot settle.
9. No JSON response under `vn/` contains a forbidden key. The check parses the
   body and walks key paths rather than substring-matching the raw text: a
   logical asset key or a future path segment could legitimately contain the
   string `prompt` and produce a false positive, and the contract already defines
   forbidden runtime metadata names as *keys*. Binary objects are skipped.

Check 6 is the security acceptance criterion; check 9 guards the prompt-exposure
requirement that motivates the private/public bucket split.

**On the client request header.** Cloudflare documents that
`Cache-Control: no-cache` **does not** bypass its cache; the documented BYPASS
triggers are origin *response* directives (`no-cache`, `no-store`, `private`,
`max-age=0`), a `Set-Cookie` response header, and a request `Authorization`
header. The resolver's `cache: 'no-cache'` is a *request*-side directive and is
not among them, and the origin-response case is precisely what rule 3's
`override_origin` neutralizes. The design is therefore consistent with the
documentation — check 8 exists to confirm it empirically, not because a conflict
is expected.

## Observability and troubleshooting

The runbook documents:

- R2 storage/operation metrics and zone cache analytics, including how to read
  cache hit ratio for `assets.aquila.cwchanap.dev`.
- `cf-cache-status` values and what each implies for these three path classes.
- The R2 CORS troubleshooting sequence: a `cf-mitigated` header means WAF, and a
  missing `cf-cache-status` means Hotlink Protection — neither is a CORS fault.
- Rollback: **do not re-upload the old `current.json` bytes verbatim.** The
  HPA-227 client rejects a pointer whose `publishedAt` is older than the one it
  already validated, treating it as `stale-pointer`, so a verbatim restore is
  silently ignored by every client that already saw the newer release. The
  correct sequence is:
  1. Take the prior release's `releaseId`, `manifestPath`, and `manifestSha256`.
  2. Emit a **new** pointer with those fields and a fresh, later `publishedAt`,
     serialized as canonical JSON plus one LF.
  3. Upload it with `Content-Type: application/json` and the pointer
     `Cache-Control`.
  4. Purge the single `current.json` URL so the 60s edge TTL does not delay it.

  This is the one operation where the contract's anti-downgrade rule and the
  cache policy interact, and getting either half wrong produces a rollback that
  appears to succeed while changing nothing.
- Recovery: re-running `bun r2:provision` restores CORS, cache rules, and the
  custom domain from config. Bucket contents are not recoverable this way.
- Manual uploads must carry an explicit `Cache-Control` matching
  `RUNTIME_ASSET_CACHE_POLICY`; see the hand-uploaded-objects note in D4.
- **Renaming a bucket in config is not a safe re-run.** `provision.ts` never
  deletes, so a renamed delivery bucket produces a second empty bucket while the
  custom domain stays attached to the original — one domain binds to exactly one
  bucket. A rename requires manually detaching the domain and deleting the old
  bucket first, in that order.

## Out of scope

Publisher implementation (HPA-230), production asset migration (HPA-231), reader
UI (HPA-228), private/paid story authorization, and removing committed binaries
under `packages/assets/media`.

## Risks

| Risk | Mitigation |
|---|---|
| Preview publish writes a production pointer | Publisher-enforced; HPA-230 must test `assertActivationAllowed()` |
| Preview trees are world-readable; knowing a `previewId` exposes unreleased artwork | Accepted — the delivery bucket is public by design. Preview IDs are capability-like and should be unguessable for spoiler-sensitive work in progress. The `smoke` fixture ID is deliberately guessable because it contains nothing sensitive. Documented in the runbook. |
| Custom domain stuck in "Initializing" | Runbook documents retry; zone is Free with no zone hold |
| 60s pointer cache delays rollback | Runbook makes the targeted purge a required rollback step |
| Free-plan rule limit (10) | 3 used; documented so future rules stay within budget |
