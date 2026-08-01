# HPA-230: Aquila Immutable Visual Asset Publisher

**Date:** 2026-08-01  
**Status:** Approved for implementation  
**Linear:** [HPA-230](https://linear.app/cwchanap/issue/HPA-230/build-aquila-immutable-visual-asset-publisher)  
**Parent:** HPA-216  
**Depends on:** HPA-227, HPA-229 — complete  
**Blocks:** HPA-231, HPA-233  
**Delivery rule:** One Linear ticket maps to one implementation pull request.

## Purpose

Build the repeatable publisher that converts Aquila's compiler-generated visual
asset catalog and checked-in release classification into optimized,
content-addressed runtime objects. The publisher validates a complete immutable
candidate before it changes the active release pointer, and it can later roll
back by changing only that pointer.

This design implements the contracts established by HPA-227 and the R2
destination established by HPA-229. It does not introduce another manifest
shape, release identity algorithm, path layout, cache policy, or Cloudflare
configuration model.

The completed HPA-230 pull request must provide:

- deterministic local planning and image encoding;
- local/mock and Cloudflare R2 delivery adapters;
- immutable object and release-manifest publication;
- candidate verification before activation;
- conditional pointer activation with concurrency protection;
- release discovery, verification, and rollback;
- human-readable and machine-readable command output;
- fixture-based ordinary CI and gated preview R2 integration;
- publishing, troubleshooting, and recovery documentation.

## Established context and inherited contracts

The following existing modules are authoritative:

```text
packages/stories/src/runtime-assets/schemas.ts
packages/stories/src/runtime-assets/canonical.ts
packages/stories/src/runtime-assets/paths.ts
packages/stories/src/runtime-assets/validation.ts
packages/stories/src/runtime-assets/policy.ts
```

The publisher imports their public API through
`@aquila/stories/runtime-assets`. It must reuse:

- `StoryAssetReleasePlanV1` and `parseStoryAssetReleasePlan()`;
- `RuntimeAssetManifestV1` and `parseRuntimeAssetManifest()`;
- `ActiveReleasePointerV1` and `parseActiveReleasePointer()`;
- `validateReleaseCoverage()` and `validateRuntimeManifestCoverage()`;
- `assertActivationAllowed()`;
- `canonicalJson()` and `canonicalReleaseContent()`;
- `releaseIdFromContentSha256()`;
- `getObjectPath()`, `getReleaseManifestPath()`, and
  `getCurrentPointerPath()`;
- `RUNTIME_ASSET_CACHE_POLICY` and `RUNTIME_ASSET_DIMENSION_POLICY`.

The only runtime publication layout remains:

```text
vn/objects/<sha256>.<format>
vn/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/stories/<storyId>/current.json
vn/previews/<previewId>/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/stories/<storyId>/current.json
```

Preview and production releases share the global `vn/objects/` object pool.
Their release manifests and active pointers remain isolated by the HPA-227 path
helpers.

The production release plan remains at the HPA-227-defined location:

```text
packages/stories/release-plans/<storyId>.json
```

An optional draft preview plan may live beside it as:

```text
packages/stories/release-plans/<storyId>.preview.json
```

A command may override the plan path explicitly. The preview companion does not
change the production-plan convention.

## Scope boundaries

### In scope

- Publisher code inside `@aquila/infra-cloudflare`.
- Generated authoring-catalog discovery and conversion.
- Release-plan parsing and coverage enforcement.
- Local source-directory input.
- Deterministic WebP and AVIF encoding under one V1 policy.
- Content hashing, object reuse, and immutable create-only writes.
- Canonical runtime-manifest generation.
- Local filesystem and R2-compatible delivery stores.
- Candidate verification through the selected delivery-store adapter.
- Atomic pointer activation with compare-and-swap semantics.
- Release listing and rollback.
- CLI reports and exit codes.
- Unit, fixture integration, mocked R2, and gated live preview tests.
- Publisher and recovery documentation.

### Out of scope

- Visual reader UI or browser-side resolver behavior.
- Cloudflare bucket, custom-domain, CORS, or cache-rule provisioning.
- Source-image generation or editing.
- Direct publication from an AI provider.
- Migrating The Seventh Mirror or deciding which of its assets are acceptable.
- Public-CDN browser/CORS release-gate coverage owned by HPA-233.
- Deleting unreferenced content-addressed objects.
- Tauri or PWA offline asset packs.
- Private-source R2 synchronization or source archival.
- Persisting a second public publisher metadata schema.

Source archival may be automated later as a separate command or adapter with
separate private-source credentials. Runtime publication in HPA-230 uses a
local synchronized source root and delivery-only R2 credentials.

## Design decisions

### D1 — Extend `@aquila/infra-cloudflare` with an isolated publisher core

The publisher belongs in the existing `packages/infra-cloudflare` workspace.
That package already owns:

- the committed R2 delivery configuration;
- delivery-only publisher credential handling;
- the AWS S3 client dependency;
- Sharp;
- the HPA-229 seeder and delivery verifier;
- R2-specific operational documentation.

A new package would duplicate configuration and storage plumbing without
creating a meaningful independent deployment boundary.

Publisher modules are isolated under `src/publisher/` so the image/release
domain remains independently testable and does not become embedded in the
existing smoke verifier.

Proposed structure:

```text
packages/infra-cloudflare/src/publisher/
  authoring-catalog.ts
  source-files.ts
  encoder-policy.ts
  image-encoder.ts
  publication-plan.ts
  runtime-release.ts
  candidate-verifier.ts
  activation.ts
  release-history.ts
  errors.ts
  report.ts
  cli.ts

  stores/
    delivery-store.ts
    local-delivery-store.ts
    r2-delivery-store.ts

packages/infra-cloudflare/src/publisher/__tests__/
packages/infra-cloudflare/src/publisher/__fixtures__/
```

The exact file split may be adjusted during implementation when a module is
too small or responsibilities are clearer together. The boundaries in this
document remain normative.

### D2 — HPA-230 ships as one complete pull request

The ticket branch is:

```text
jack65786656/hpa-230-build-aquila-immutable-visual-asset-publisher
```

The pull request may contain multiple reviewable commits, but it is not divided
into separate pull requests. If implementation reveals independently shippable
scope that cannot reasonably be reviewed in one pull request, the Linear ticket
must be split before opening another pull request.

The HPA-230 pull request is not complete until its local publisher, R2 adapter,
verification, activation, rollback, CLI, tests, and documentation satisfy the
ticket together.

### D3 — Input discovery is explicit and fails on ambiguity

Each planning or publishing run resolves three inputs:

1. compiler-generated `image-assets.json`;
2. one `StoryAssetReleasePlanV1`;
3. one local source root.

Generated catalog discovery searches:

```text
packages/stories/src/generated/*/image-assets.json
```

It parses candidates and selects the single file whose embedded `storyId`
matches `--story`. Directory-name casing is not derived from the runtime story
ID. Zero matches and multiple matches are errors.

The plan-path precedence is:

1. `--release-plan <path>`;
2. for preview, `<storyId>.preview.json` when it exists;
3. the production `<storyId>.json`.

A production target requires a plan whose `channel` is `production`. A preview
target accepts either a production plan or a preview plan. The existing
`assertActivationAllowed()` remains the final guard preventing a preview plan
from activating production.

The source-root precedence is:

1. `--source-root <path>`;
2. `AQUILA_ASSET_SOURCE_ROOT`;
3. `packages/assets/media` for the repository migration period.

`AQUILA_ASSET_SOURCE_ROOT` is part of the HPA-230 command contract and must be
documented in `.env.example`. No runtime command receives private-source R2
credentials.

### D4 — Authoring data is reduced at the first boundary

The generated authoring catalog contains `key`, `path`, and `prompt` values in
separate background and portrait arrays. The publisher converts it immediately
to the HPA-227 `AuthoringAssetCatalog` shape:

```ts
type AuthoringAssetCatalog = {
  storyId: string;
  assets: readonly {
    identity: { type: 'background' | 'portrait'; key: string };
    sourcePath: string;
    section?: string;
  }[];
};
```

Prompt text is not copied into publisher domain objects, publication plans,
encoded-asset records, runtime manifests, storage metadata, or reports. The raw
authoring document remains available only inside the input loader long enough
to parse and reduce it.

Section metadata is derived conservatively from the first logical-key segment
when that segment is a non-empty safe value. An explicit release-plan section
continues to take precedence inside `validateReleaseCoverage()`.

### D5 — Source paths are validated against the real filesystem

Schema-safe relative paths are necessary but not sufficient. For every included
entry, the source loader:

1. resolves the configured source root with `realpath`;
2. joins the release-plan `sourcePath` using platform path utilities;
3. resolves the final source with `realpath`;
4. verifies that the final path remains inside the real source root;
5. verifies that it is a readable regular file;
6. rejects a symlink or parent-directory traversal that escapes the root.

Errors and reports use the safe plan-relative source path, not an absolute local
filesystem path. Absolute source paths, credentials, and environment values are
never written into runtime objects.

The V1 supported source formats are single-frame PNG, JPEG, and WebP. Animated
or multipage images, SVG, GIF, TIFF, AVIF source files, and unknown formats fail
as unsupported inputs. The format decision is based on decoded metadata, not
only the filename extension.

### D6 — One explicit deterministic encoder policy

The publisher exports one immutable `ENCODER_POLICY_V1`. It does not accept
per-run quality, effort, resize, chroma, or metadata flags. A policy change is a
reviewed code change and may produce a new release because final bytes change.

Processing shared by every output variant:

1. decode with warnings treated as failures;
2. reject animated or multipage input;
3. normalize EXIF orientation before reading output dimensions;
4. convert pixels to sRGB;
5. strip EXIF, ICC, XMP, comments, and other source metadata;
6. preserve the source aspect ratio;
7. resize down with Lanczos 3 and `fit: inside`;
8. never crop, pad, stretch, or enlarge;
9. encode every variant from the same normalized pixel pipeline;
10. read dimensions from the final encoded bytes.

Maximum runtime dimensions come from
`RUNTIME_ASSET_DIMENSION_POLICY.preferredRuntime`:

| Type | Maximum box | Outputs |
|---|---:|---|
| Background | 1600×900 | WebP and AVIF |
| Portrait | 900×1200 | alpha-preserving WebP |

V1 encoder settings are:

| Encoder | Settings |
|---|---|
| WebP | quality 82, alpha quality 100, effort 6, lossy, smart subsampling enabled, picture preset |
| AVIF | quality 50, effort 6, lossy, 4:4:4 chroma subsampling |

Background and portrait WebP use the same encoding settings. Portraits do not
produce AVIF in V1. Background AVIF and WebP variants must have identical
intrinsic dimensions. When a portrait source contains alpha, its WebP output
must retain an alpha channel and transparent pixels.

Low-resolution placeholders are omitted in the MVP. The HPA-227 field remains
optional, and adding placeholders later requires an explicit encoder-policy
revision rather than an implicit default.

The generic publisher reports deviations from the HPA-227 preferred source
aspect ratio and minimum source dimensions as warnings. It does not crop,
invent pixels, or reject an otherwise decodable source solely for those
presentation deviations. HPA-231 owns source correction and release approval.

Determinism is scoped to the same source bytes and the same encoder toolchain:
policy version, Sharp version, libvips version, operating system, and
architecture. The report records that fingerprint. Production publication uses
the repository-pinned Sharp version in the canonical CI environment. The design
does not claim byte identity across different native encoder builds.

### D7 — `plan` performs the complete read and encode path without writes

A publication plan is not a shallow inventory. It performs all deterministic
work required to know the candidate release:

```text
load inputs
→ validate coverage and source containment
→ decode and encode included sources
→ hash exact encoded bytes
→ inspect destination objects
→ construct and validate runtime manifest
→ compute release identity and manifest checksum
→ inspect current pointer
→ calculate write and activation actions
```

The encoded bytes live in a unique temporary workspace that is removed on
success or failure. HPA-230 does not add a persistent local transcode cache.

Plan classifications include:

- included;
- omitted, with reason;
- unclassified;
- missing source;
- encoded candidate variant;
- reusable existing object;
- new object;
- immutable conflict;
- existing identical release manifest;
- new release manifest;
- active release unchanged;
- pointer change required;
- pointer concurrency snapshot.

“Newly encoded” means the run produced candidate bytes whose content-addressed
object is absent from the selected destination. Every included source is still
encoded during a plan so its exact final hash is known.

A production plan fails when coverage or sources are invalid. A preview plan may
report unclassified keys, but only explicitly included entries are encoded and
placed in the runtime manifest.

### D8 — Storage behavior is expressed by a narrow `DeliveryStore`

The publisher core depends on an interface equivalent to:

```ts
interface DeliveryStore {
  stat(key: string): Promise<StoredObjectMetadata | null>;
  read(key: string): Promise<StoredObject>;
  createImmutable(request: ImmutableCreateRequest): Promise<CreateResult>;
  readPointer(key: string): Promise<PointerSnapshot>;
  compareAndSwapPointer(request: PointerWriteRequest): Promise<PointerWriteResult>;
  list(prefix: string): AsyncIterable<StoredObjectMetadata>;
}
```

`createImmutable()` means “create only if absent.” Its result distinguishes:

- created;
- already exists;
- precondition conflict;
- transport failure.

`compareAndSwapPointer()` requires either:

- absence, for a pointer observed as missing; or
- the exact ETag observed during the initial pointer read.

Both immutable-create and pointer-write requests carry required `Content-Type`
and `Cache-Control` metadata. The publisher core never has a generic
unconditional put operation.

#### Local filesystem adapter

The local adapter stores objects beneath a configured destination root using the
same relative keys as R2.

- Immutable creation uses exclusive file creation.
- Pointer changes are serialized by a sibling lock file.
- Pointer bytes are written to a temporary file, flushed, and atomically renamed
  only after the locked compare-and-swap check succeeds.
- Local ETags are SHA-256 digests of exact stored bytes, exposed through the same
  snapshot model as R2.
- Store-neutral HTTP metadata is retained alongside test objects so local
  verification exercises the same media-type and cache-policy rules as R2.

The adapter provides deterministic ordinary-CI and recovery tests without
Cloudflare access.

#### R2 adapter

The R2 adapter reuses `r2-delivery.config.json`, the delivery bucket, and:

```text
R2_PUBLISHER_ACCESS_KEY_ID
R2_PUBLISHER_SECRET_ACCESS_KEY
```

It does not receive the source-bucket name as an operational capability.

Cloudflare R2 implements conditional `PutObject` operations. The adapter sends
`If-None-Match: *` for immutable creation and `If-Match: <observed ETag>` or
`If-None-Match: *` for pointer compare-and-swap. Because the current AWS SDK
command input does not expose every R2 conditional header uniformly, the
adapter adds the header through command-scoped AWS SDK middleware, following
Cloudflare's documented JS v3 pattern.

HTTP 412 / `PreconditionFailed` is mapped to a typed concurrency or immutable
conflict, not retried as a transport error.

References:

- <https://developers.cloudflare.com/r2/api/s3/api/>
- <https://developers.cloudflare.com/r2/examples/aws/custom-header/>
- <https://developers.cloudflare.com/r2/api/error-codes/>

### D9 — Publication metadata is explicit for every public object class

The publisher sets the following metadata on every write; it never relies on R2
filename inference or Cloudflare edge rules to repair missing origin metadata:

| Object class | `Content-Type` | `Cache-Control` |
|---|---|---|
| WebP object | `image/webp` | `RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl` |
| AVIF object | `image/avif` | `RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl` |
| `runtime-manifest.json` | `application/json` | `RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl` |
| `current.json` | `application/json` | `RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl` |

The inherited values are currently:

```text
immutable release: public, max-age=31536000, immutable
current pointer:   no-cache, max-age=0, must-revalidate
```

HPA-229 deliberately bypasses edge caching for `current.json`; the pointer's
origin metadata is still mandatory for browser and non-edge behavior. Release
manifests remain immutable and edge-cache eligible.

The candidate verifier checks binary-object and release-manifest metadata before
activation. Pointer metadata is attached to the compare-and-swap write request;
R2 adapter tests inspect the serialized request, while HPA-229's public-host
verifier checks the served pointer headers after activation. A post-write pointer
metadata check cannot be made part of pre-activation validation because the
pointer write itself is the activation boundary.

### D10 — Content-addressed objects are create-only and verified

For each final variant:

1. SHA-256 is computed over exact encoded bytes.
2. `getObjectPath()` creates `vn/objects/<sha256>.<format>`.
3. `stat()` checks whether the object exists.
4. An existing object is verified before reuse.
5. A missing object is uploaded with `If-None-Match: *`.
6. If another publisher wins the create race, the resulting existing object is
   verified and reused.
7. A mismatching object at a content-addressed path is a fatal invariant
   violation and is never overwritten.

New objects additionally may set safe custom metadata for encoded SHA-256, byte
length, and encoder policy version. Custom metadata is an optimization for
future `HEAD` checks, not a trust boundary. Candidate verification remains able
to download and hash the body.

No prompt, source path, absolute path, provider name, credential, or private
bucket identifier is stored.

Existing objects with correct bytes and required HTTP metadata may be reused
even when optional custom metadata is absent. Existing objects with incorrect
content type, cache control, byte length, digest, decode result, or dimensions
fail publication.

### D11 — Manifest identity and bytes reuse the HPA-227 canonical functions

Runtime entries are sorted by `compareQualifiedAssetIds()` and contain only
included assets.

The release ID is calculated exactly as HPA-227 specifies:

1. construct a draft manifest whose temporary `releaseId` is syntactically
   valid;
2. call `canonicalReleaseContent()`;
3. hash its UTF-8 bytes;
4. brand the digest as `release-content`;
5. call `releaseIdFromContentSha256()`;
6. replace the temporary ID with the final release ID;
7. parse the final value with `parseRuntimeAssetManifest()`;
8. check it against the plan with `validateRuntimeManifestCoverage()`.

The exact immutable manifest bytes are:

```ts
canonicalJson(manifest) + '\n'
```

The pointer's `manifestSha256` is the SHA-256 of those exact UTF-8 bytes. Pretty
printed JSON is never uploaded.

The release manifest is uploaded with immutable create-only semantics and the
JSON/immutable metadata in D9. If its path already exists, exact stored bytes
and required metadata must match the candidate. A different byte sequence at
the same release path is a fatal integrity failure.

### D12 — Candidate verification completes before pointer activation

The candidate verifier reads from the selected `DeliveryStore`; it does not
trust in-memory upload results.

It verifies:

- the release manifest exists at the HPA-227 path;
- the release manifest has `application/json` and the immutable cache policy;
- exact manifest bytes hash to the candidate manifest checksum;
- `parseRuntimeAssetManifest()` accepts the raw document;
- the canonical release-content digest matches `releaseId`;
- manifest coverage matches the selected release plan during publication;
- every referenced object exists;
- object path, format, byte length, body SHA-256, content type, and cache control
  match;
- Sharp can decode each stored object;
- decoded dimensions match the manifest;
- backgrounds contain WebP and AVIF at identical dimensions;
- portraits contain WebP and no AVIF under V1;
- during publication, the output-alpha facts recorded by the encoder agree
  with the source-alpha requirement observed before encoding;
- the candidate pointer's story, release, path, and manifest checksum agree.

The inherited runtime parser provides defense in depth through three distinct
mechanisms, which the publisher relies on without overstating any one of them:

1. forbidden key-name stems reject prompt fields; source/local path or file
   fields; provider fields; and credential, secret, token, or API-key fields;
2. environment-specific absolute URL and absolute filesystem-path string values
   are rejected in unknown additive metadata and in known free-form fields such
   as `section`;
3. known runtime path fields are validated structurally as safe relative paths.

A bare additive key named `source` or `url` is not claimed to be rejected merely
because of its name; unsafe values beneath unknown fields are still scanned, and
publisher-produced manifests contain no additive authoring metadata at all.

A standalone `verify --release` command has no source-file dependency, so it
verifies the stored portrait decode and dimensions but does not attempt to
reconstruct historical source-alpha facts.

Publication stops before activation when any check fails.

This verifier intentionally operates through the object-store API. HPA-229's
public-host smoke verifier remains responsible for infrastructure behavior, and
HPA-233 owns complete preview-domain CORS, CDN, browser decode, and cross-system
release-gate verification. HPA-230's gated R2 integration proves that the real
R2 adapter can publish and verify an immutable candidate and safely activate a
preview pointer.

### D13 — Pointer activation is a conditional final write

At the beginning of planning, the publisher reads `current.json` and retains:

```ts
type PointerSnapshot =
  | { exists: false }
  | {
      exists: true;
      etag: string;
      bytes: Uint8Array;
      pointer: ActiveReleasePointerV1;
    };
```

After candidate verification, it constructs a pointer with a fresh
`publishedAt` and the JSON/revalidation metadata in D9, then performs exactly
one compare-and-swap write:

- initially absent pointer → `If-None-Match: *`;
- existing pointer → `If-Match: <initial ETag>`.

A failed precondition means another publisher changed the pointer after this run
began. The candidate objects and immutable manifest may remain safely stored,
but the active release remains unchanged.

There is no generic `--force`.

Two explicit exceptional controls exist:

- `--reactivate` updates `publishedAt` when the same verified release is already
  active; without it, unchanged publication is a no-op.
- `--override-concurrent-pointer` allows one deliberate refresh after a
  concurrency conflict. For `publish`, the publisher re-reads and displays the
  new active release, revalidates the immutable candidate, and performs another
  conditional write against the refreshed ETag. It never performs an
  unconditional write.

Production activation additionally requires:

```text
--confirm-production <storyId>
```

The exact confirmation value must match `--story`. This is required for both
production publication and production rollback.

### D14 — Idempotency is defined by externally visible writes

For unchanged:

- authoring catalog;
- release classification;
- source bytes;
- encoder policy and toolchain;
- canonical manifest contract;
- target environment;

a repeated run produces the same encoded bytes, object paths, manifest,
release ID, and manifest checksum.

When that release is already active:

- no binary object is created;
- no release manifest is created;
- `current.json` is not updated;
- the command returns successful `no-op`.

When the immutable release exists but another release is active, normal
`publish` verifies and activates the existing candidate without re-encoding
uploads beyond the planning work.

Changing one source asset creates only its changed variant objects, one new
immutable manifest, and one pointer update. Unchanged object hashes are reused
across assets, releases, stories, preview, and production.

### D15 — Candidate-only publication is a first-class workflow

`publish` activates by default after successful verification. The option:

```text
--no-activate
```

publishes and verifies the immutable candidate but does not write
`current.json`.

This workflow is required by HPA-233: a release gate must be able to approve a
candidate before a production activation. Candidate-only publication returns
the release ID and exact manifest checksum needed by later activation and audit
steps.

No separate “staging path” is introduced. The immutable release path is already
the candidate location; activation is exclusively the pointer write.

### D16 — Rollback does not depend on current source files or plans

Release discovery lists only the canonical release directory for the selected
target:

```text
production: vn/stories/<storyId>/releases/
preview:    vn/previews/<previewId>/stories/<storyId>/releases/
```

Returned entries are accepted only when their complete path matches the HPA-227
release-manifest layout. The precise prefix avoids scanning `current.json` or
unrelated story keys.

`releases` reports each discovered release as:

- manifest valid or invalid;
- release identity valid or invalid;
- shallow verified or not verified;
- active or inactive.

Verified status is recomputed from the immutable stored bytes rather than read
from a mutable “verified” marker. A shallow verification validates exact
manifest bytes, canonical release identity, manifest structure, content type,
and immutable cache metadata. `releases --deep` verifies every referenced
object.

`rollback` always performs deep verification of the selected target release
before changing the pointer. It then:

1. reads the active pointer and ETag;
2. computes the stored target manifest's exact checksum;
3. constructs a new pointer with a fresh `publishedAt` and D9 pointer metadata;
4. changes only `current.json` through compare-and-swap.

If rollback encounters a pointer conflict and
`--override-concurrent-pointer` is present, it re-reads and displays the new
active pointer, deep-verifies the selected rollback release again, recomputes
the exact target manifest checksum, and performs one refreshed compare-and-swap
against the new ETag. Rollback has no in-memory publication candidate to
revalidate, and it never falls back to an unconditional write.

Rollback never loads the current authoring catalog, current release plan, or
source root. Historical sources or classifications may legitimately have
changed since the release was created. It never re-encodes or uploads binary
objects or a release manifest.

Immutable manifests, active-pointer history in CI output, and retained JSON
publisher reports provide the audit and recovery record. HPA-233 may retain
additional release-gate evidence without changing the HPA-227 runtime schema.

### D17 — CLI commands and safety model

The package exposes one CLI entry point. The command surface is:

```text
plan
  --story <storyId>
  --environment preview|production
  [--preview-id <id>]
  [--release-plan <path>]
  [--source-root <path>]
  [--destination local|r2]
  [--destination-root <path>]
  [--json]

publish
  --story <storyId>
  --environment preview|production
  [--preview-id <id>]
  [--release-plan <path>]
  [--source-root <path>]
  [--destination local|r2]
  [--destination-root <path>]
  [--no-activate]
  [--reactivate]
  [--override-concurrent-pointer]
  [--confirm-production <storyId>]
  [--json]

verify
  --story <storyId>
  --environment preview|production
  --release <releaseId>
  [--preview-id <id>]
  [--destination local|r2]
  [--destination-root <path>]
  [--json]

releases
  --story <storyId>
  --environment preview|production
  [--preview-id <id>]
  [--destination local|r2]
  [--destination-root <path>]
  [--deep]
  [--json]

rollback
  --story <storyId>
  --environment preview|production
  --release <releaseId>
  [--preview-id <id>]
  [--destination local|r2]
  [--destination-root <path>]
  [--override-concurrent-pointer]
  [--confirm-production <storyId>]
  [--json]
```

Rules:

- Preview requires an explicit `--preview-id` or
  `PUBLIC_ASSET_PREVIEW_ID`.
- Production ignores preview IDs and requires exact confirmation for mutations.
- `plan` never mutates either destination.
- `verify` and `releases` never mutate either destination.
- `rollback` has no source or release-plan flags.
- `--no-activate` and `--reactivate` are mutually exclusive.
- `--json` writes one JSON document to stdout; human diagnostics go to stderr.
- Secrets and absolute paths are redacted from all outputs.

The package script is named to avoid confusion with application deployment:

```json
{
  "scripts": {
    "assets": "bun src/publisher/cli.ts"
  }
}
```

Example:

```text
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id hpa-230
```

### D18 — Reports are versioned and stable for CI

Machine-readable output has a public publisher-report version independent of
the runtime manifest version:

```ts
interface PublisherReportV1 {
  schemaVersion: 1;
  command: 'plan' | 'publish' | 'verify' | 'releases' | 'rollback';
  status: 'success' | 'no-op' | 'failed' | 'conflict';
  storyId: string;
  target: PublicationTarget;
  releaseId?: string;
  manifestSha256?: string;
  encoderFingerprint?: EncoderFingerprintV1;
  coverage?: StoryAssetCoverageReport;
  counts: PublisherCountsV1;
  actions: PublisherActionV1[];
  warnings: PublisherDiagnosticV1[];
  errors: PublisherDiagnosticV1[];
  pointer?: {
    beforeReleaseId?: string;
    afterReleaseId?: string;
    changed: boolean;
  };
}
```

Actions carry a stable stage and safe identity:

```ts
type PublisherStage =
  | 'input'
  | 'coverage'
  | 'source'
  | 'decode'
  | 'encode'
  | 'hash'
  | 'object-inspection'
  | 'object-upload'
  | 'manifest'
  | 'manifest-upload'
  | 'verification'
  | 'activation'
  | 'rollback';
```

A diagnostic includes story, target, stage, type-qualified logical identity when
applicable, safe relative source/object path when applicable, error code, and
message. It does not include raw credentials, SDK request objects, absolute
local paths, prompts, or entire response bodies.

Recommended exit codes:

| Code | Meaning |
|---:|---|
| 0 | success or no-op |
| 1 | invalid CLI/configuration |
| 2 | input, coverage, source, encoding, or candidate validation failure |
| 3 | storage/network failure |
| 4 | conditional-write concurrency conflict |
| 5 | rollback target invalid or unavailable |

Exit code `0` deliberately does not distinguish a mutation from a no-op. CI or
scripts that need change detection must parse `--json` and inspect `status`,
`actions`, or `pointer.changed`; they must not infer change from the process exit
code.

Human output is derived from the same report object so human and CI summaries
cannot disagree.

### D19 — Error handling preserves the activation boundary

Publisher errors wrap causes and carry structured context. A failure may leave
new immutable objects or a new immutable release manifest in storage; those
objects are safe because nothing references them through the active pointer.

The publisher never attempts compensating deletion. Cleanup would introduce a
race with another release that reused the same object and would violate the
separate-garbage-collection boundary.

Temporary local encoding workspaces are removed in `finally`. Storage clients
are destroyed in `finally`.

Transient R2 operations use bounded retries with exponential backoff and jitter
only for retryable transport or service errors. Validation failures, HTTP 412,
authentication failures, immutable conflicts, and malformed responses are not
retried blindly.

### D20 — Verification ownership remains non-duplicative

HPA-230 owns:

- release-plan classification;
- source safety;
- encoder determinism and output policy;
- encoded-byte hashing;
- object and manifest immutability;
- object-store readback verification;
- origin metadata for binaries, manifests, and pointers;
- failed-candidate atomicity;
- pointer compare-and-swap;
- no-op behavior;
- rollback behavior.

The existing HPA-229 verifier continues to own the deployed asset host's cache
rules, CORS, source isolation, and representative public responses, including
post-activation pointer-header checks.

HPA-233 owns the consolidated pre-production gate, complete candidate release
verification through the public preview domain, browser decode, representative
reader flows, and production authorization evidence.

Shared HPA-227 fixtures and validators are reused. HPA-230 does not create a
second runtime-contract test framework.

### D21 — The HPA-229 seeder becomes a publisher fixture client

`src/seed.ts` currently contains a hard-coded miniature publication pipeline.
It must not remain a second implementation after HPA-230.

The HPA-230 pull request either:

- rewrites `seed.ts` as a thin invocation of the publisher against the existing
  smoke fixture; or
- removes the command and updates the HPA-229 runbook to use the publisher CLI.

The chosen result preserves HPA-229's ability to seed a representative preview
release without duplicating encoding, hashing, manifest, upload, or pointer
logic.

## Component responsibilities

### Authoring catalog loader

- Discover and parse the generated authoring manifest.
- Validate story identity and array shapes.
- Convert backgrounds and portraits to type-qualified entries.
- Reject duplicate identities.
- Discard prompts immediately.
- Derive conservative section metadata.

### Source-file resolver

- Resolve the configured source root.
- Enforce real-path containment.
- Read exact source bytes once.
- Validate file type and single-frame support.
- Return safe relative path, bytes, and decoded source metadata.

### Image encoder

- Apply `ENCODER_POLICY_V1`.
- Produce one normalized pixel pipeline per source.
- Produce required variants by asset type.
- Return exact bytes, media type, hash, dimensions, and alpha facts.
- Expose the encoder fingerprint.

### Publication planner

- Parse inputs and validate release coverage.
- Encode included assets.
- Inspect the selected destination.
- Build ordered candidate actions and counts.
- Construct the prepared release and initial pointer snapshot.
- Perform no writes.

### Runtime-release builder

- Build sorted runtime entries.
- Validate policy-specific variant presence.
- Calculate canonical release ID.
- Serialize canonical manifest bytes.
- Calculate exact manifest checksum.
- Attach immutable JSON metadata.
- Validate manifest and coverage through HPA-227.

### Delivery stores

- Provide create-only immutable object semantics.
- Provide exact object readback and metadata.
- Provide pointer snapshots and compare-and-swap.
- Carry explicit media type and cache policy on every write.
- Provide precise release-directory listing.
- Normalize local and R2 errors into publisher errors.

### Candidate verifier

- Re-read manifest and objects from the store.
- Validate hashes, metadata, decode, dimensions, policy, and coverage.
- Apply the inherited raw-document safety parser.
- Build a verified pointer candidate.
- Return no partially trusted result.

### Activation service

- Detect unchanged active release.
- Enforce target/plan and production confirmation.
- Attach pointer JSON/revalidation metadata.
- Perform conditional final pointer write.
- Surface concurrency without deleting immutable candidates.

### Release-history service

- List only the exact target release prefix.
- Discover canonical immutable manifests.
- Shallow or deeply verify them.
- Identify the active release.
- Prepare and conditionally apply rollback pointers.
- On explicit override, re-read and deep-verify before refreshed CAS.

### Report renderer

- Construct `PublisherReportV1`.
- Render human summaries and stable JSON.
- Redact unsafe data.
- Map final status to process exit code.

## End-to-end data flow

```text
generated image-assets.json ─┐
release plan ────────────────┼─> input reduction and coverage validation
local source root ───────────┘
                                      │
                                      v
                         normalize and encode included assets
                                      │
                                      v
                         hash exact WebP / AVIF bytes
                                      │
                                      v
                    inspect object store and calculate actions
                                      │
                                      v
                   build canonical prompt-free runtime manifest
                                      │
                         plan stops here with no writes
                                      │
                                      v
              create missing immutable objects with preconditions
                                      │
                                      v
                         read back and verify every object
                                      │
                                      v
          create/reuse immutable JSON manifest with required metadata
                                      │
                                      v
                       read back and verify full candidate
                                      │
                         --no-activate stops here
                                      │
                                      v
       compare-and-swap JSON/revalidation current.json as the final write
```

## Testing strategy

### Unit tests

Unit coverage includes:

- generated-manifest discovery by embedded story ID;
- background/portrait type qualification;
- prompt stripping;
- duplicate authoring identities;
- production and preview coverage behavior;
- source-root CLI/environment/default precedence;
- safe source path, traversal, symlink escape, unreadable path, and directory
  rejection;
- supported and unsupported source formats;
- orientation normalization;
- WebP and AVIF policy selection;
- portrait alpha preservation;
- no crop, no enlargement, and maximum dimension behavior;
- encoded-byte hashing and object-path derivation;
- canonical release ID and exact manifest-byte checksum;
- manifest sorting and runtime-parser rejection paths;
- metadata selection for all four public object classes;
- report redaction and deterministic ordering;
- no-op versus changed JSON semantics;
- CLI validation, production confirmation, and exit codes.

### Local adapter integration tests

A temporary filesystem destination proves:

- first publication creates objects, manifest, and pointer in order;
- binary, manifest, and pointer metadata match D9;
- candidate-only publication never creates a pointer;
- unchanged second publication performs no writes;
- changing one background creates only two variants, one manifest, and one
  pointer update;
- changing one portrait creates only one variant, one manifest, and one pointer
  update;
- duplicate encoded bytes are reused across logical identities;
- existing correct objects are reused;
- existing corrupt objects fail and are not overwritten;
- manifest byte or metadata conflict fails and is not overwritten;
- decode, dimension, media-type, or cache metadata failure leaves the pointer
  unchanged;
- pointer compare-and-swap detects a concurrent change;
- publish override revalidates the candidate before refreshed CAS;
- rollback override deep-verifies the target again before refreshed CAS;
- rollback writes only the pointer;
- rollback to a missing or invalid release fails without changing the pointer.

Tests record filesystem state before and after commands rather than asserting
only returned status.

### R2 adapter tests

Ordinary CI uses a scripted fake S3 client or command transport to prove:

- conditional headers are attached to the correct `PutObject` operations;
- binary, manifest, and pointer `Content-Type`/`Cache-Control` are serialized
  exactly;
- returned ETags are preserved exactly;
- 412 maps to immutable or pointer conflict;
- R2 listing uses the exact production or preview `releases/` prefix;
- R2 pagination is consumed for release listing;
- body streams are fully consumed and hashed;
- metadata maps to the store-neutral representation;
- retryable and non-retryable errors are distinguished;
- credentials and request internals are redacted.

These tests do not require a local S3 server.

### Gated preview integration

A manually triggered or secret-enabled job runs against the real HPA-229 preview
destination:

1. publish a small fixture with `--no-activate`;
2. verify the immutable candidate and manifest metadata through the R2 adapter;
3. activate its preview pointer with required pointer metadata;
4. run the HPA-229 public verifier to confirm served pointer behavior;
5. rerun unchanged and observe a no-op;
6. publish a controlled revision;
7. detect a synthetic stale pointer snapshot;
8. roll back to the first release;
9. verify that only the preview pointer changed during rollback.

The test uses a dedicated preview ID and never writes the production pointer.
Normal CI remains credential-free.

### Required verification commands

At minimum, the pull request records successful results for:

```text
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare lint
bun --filter @aquila/stories test
bun run compile:check
```

The full repository suite is run when shared package exports or root task
configuration changes.

## Documentation deliverables

The HPA-230 pull request adds:

```text
docs/superpowers/specs/2026-08-01-hpa-230-immutable-visual-asset-publisher-design.md
docs/infrastructure/visual-asset-publisher.md
```

The runbook documents:

- local fixture planning and publication;
- release-plan and source-root conventions;
- `AQUILA_ASSET_SOURCE_ROOT` precedence;
- preview candidate publication;
- production confirmation;
- encoder determinism scope;
- binary, manifest, and pointer metadata;
- JSON output and CI change detection;
- immutable conflict diagnosis;
- pointer concurrency diagnosis;
- exact release-listing prefixes;
- rollback, rollback override, and reactivation;
- safe interruption and recovery;
- the boundary with HPA-229 and HPA-233.

`.env.example` is updated to document `AQUILA_ASSET_SOURCE_ROOT`. The HPA-229
delivery runbook is updated only where its seeding or publisher command changes.

## Acceptance mapping

| HPA-230 acceptance criterion | Design mechanism |
|---|---|
| Production fails on unclassified or missing included assets | HPA-227 coverage validation plus real source containment |
| Omitted keys are reported and absent | Planner report plus manifest coverage validation |
| Unchanged publication creates no writes | Deterministic bytes, immutable reuse, active-release no-op |
| One changed source uploads only changed variants | Encoded-byte addressing and destination inspection |
| Background/portrait format policy and alpha | `ENCODER_POLICY_V1` and candidate decode tests |
| Public output contains no prompts or local paths | Early authoring reduction plus the inherited raw-document parser |
| Binary, manifest, and pointer metadata are correct | D9 write contract plus adapter/public verification |
| Failed verification leaves pointer unchanged | Candidate verification before activation |
| Concurrent pointer change is detected | ETag compare-and-swap |
| Objects are never overwritten | Conditional create-only writes |
| Objects decode and match dimensions/media type | Store readback candidate verifier |
| Rollback changes only pointer | Release-history service with source-independent rollback |
| Rollback override remains conditional | Re-read, deep reverify, refreshed ETag CAS |
| Preview and production remain isolated | HPA-227 publication target paths |
| Dry-run reports coverage, reuse, uploads, activation | Full publication planner and `PublisherReportV1` |
| Production readiness requires preview R2 integration | Gated real-preview workflow |

## Risks and mitigations

### Native encoder drift

Sharp/libvips output may differ across native builds even with the same settings.

**Mitigation:** pin Sharp, record the complete fingerprint, use canonical CI for
production, and define determinism within that toolchain rather than claiming
cross-platform equivalence.

### Large dry-run cost

A complete plan must encode every included source to know final content hashes.

**Mitigation:** accept the deterministic cost in V1, show per-stage progress in
human mode, clean temporary bytes promptly, and defer persistent transcode
caching until real measurements justify it.

### R2 conditional-header integration

AWS SDK JS v3 may require middleware for R2-specific request headers.

**Mitigation:** isolate the header injection in the R2 adapter, test serialized
conditional and metadata headers, and map 412 explicitly. The publisher core
never depends on SDK details.

### Origin metadata drift

Cloudflare edge rules may hide a missing origin header during one delivery path,
while direct R2 or browser behavior still differs.

**Mitigation:** set metadata explicitly for every object class, verify immutable
object and manifest metadata before activation, test pointer request metadata,
and retain HPA-229's post-activation public-header checks.

### Orphan immutable candidates

A failure after immutable uploads can leave unreferenced objects or manifests.

**Mitigation:** treat them as safe deduplicated candidates, never delete during
publication, and leave garbage collection as a separate task.

### Pointer override misuse

An operator can intentionally replace a concurrently activated release.

**Mitigation:** no unconditional force flag, one explicit refresh-and-CAS
override, exact production confirmation, command-specific revalidation, and a
report containing the newly observed and final pointer release IDs.

### Historical plan drift during rollback

The current checked-in plan may no longer describe an older valid release.

**Mitigation:** rollback verifies the stored immutable manifest and objects
directly and does not apply the current authoring plan.

## Rejected alternatives

### Separate publisher workspace

Rejected because it duplicates R2 config, AWS SDK, Sharp, credential handling,
and operational ownership already present in `@aquila/infra-cloudflare`.

### CI-only publisher

Rejected because local planning, fixture testing, recovery, and rollback must be
reproducible without a specific CI provider.

### Check-then-unconditional-write activation

Rejected because a second publisher can change `current.json` between the final
read and write. R2 conditional `PutObject` supports a real compare-and-swap
boundary.

### Mutable release manifests

Rejected because a release ID identifies canonical content and must remain
cacheable and auditable.

### Relying only on Cloudflare cache rules

Rejected because edge configuration does not replace correct `Content-Type` and
`Cache-Control` on R2 objects, and direct or browser behavior must remain
well-defined.

### Uploading source assets and runtime assets in one command

Rejected because runtime publication should not hold broad credentials to both
private source and public delivery storage.

### Persisting prompts in an internal publication record

Rejected because prompts are unnecessary after authoring-catalog reduction and
increase the chance of accidental public exposure.

### Automatic cleanup on failure

Rejected because an “orphan” object may already be reused by another concurrent
candidate, and normal publication must never delete content-addressed objects.

## Completion gate

The design is implemented when one HPA-230 pull request:

1. adds the complete publisher and both delivery adapters;
2. reuses the exact HPA-227 runtime contracts;
3. sets and verifies the required metadata for binaries, release manifests, and
   active pointers;
4. replaces the hard-coded seeding publication logic;
5. passes fixture, unit, local integration, and R2 adapter tests;
6. records a successful preview R2 integration run with current HPA-229 checks;
7. documents candidate publication, production activation, release listing, and
   rollback;
8. leaves HPA-231 and HPA-233 with no unresolved publisher architecture
   decision.
