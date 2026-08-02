# Immutable visual asset publisher (HPA-230)

This runbook operates the visual-novel publisher in
`@aquila/infra-cloudflare`. It plans and encodes local authoring assets, creates
content-addressed runtime objects and immutable manifests, verifies stored
candidates, and changes only a target's `current.json` pointer during activation
or rollback.

## Safety boundary

- Omitted `--destination` means `local`, never R2. Local commands require
  `--destination-root`; R2 commands reject it.
- `plan`, `verify`, and `releases` never write. `mirror-preview` creates or
  reuses one immutable preview manifest and never writes a pointer.
- Objects and release manifests are create-only. Existing paths are reused only
  after exact body and required metadata verification. The publisher never
  performs compensating deletion.
- `current.json` is the only mutable runtime object. Every mutation uses a fresh
  opaque ETag snapshot, a strictly monotonic `publishedAt`, and conditional CAS.
- Production confirmation protects pointer mutation. Production candidate
  creation with `--no-activate`, mirroring, verification, and listing do not
  require confirmation.
- Production is encoded exactly once. Preview receives the exact production
  manifest bytes; there is no preview-to-production copy command.

## HPA-231 prerequisite

HPA-230 ships the publisher and test fixtures, not The Seventh Mirror's
production classification. HPA-231 owns
`packages/stories/release-plans/the_seventh_mirror.json`, the complete generated
asset inventory, every inclusion/omission decision, and exact source-path
maintenance. The production examples below cannot run for The Seventh Mirror
until HPA-231 lands. A missing production plan is an expected prerequisite, not
a publisher defect. Do not generate or auto-classify one during an incident.

## Credentials and configuration

Run from the repository root with the locked dependencies installed. Source
root precedence is `--source-root`, then `AQUILA_ASSET_SOURCE_ROOT`, then
`packages/assets/media`.

R2 uses the committed delivery configuration in
`packages/infra-cloudflare/r2-delivery.config.json` and both scoped,
delivery-bucket-only credentials:

```text
R2_PUBLISHER_ACCESS_KEY_ID
R2_PUBLISHER_SECRET_ACCESS_KEY
```

Missing either value is configuration exit `1`; the command does not fall back
to local storage. Never expose these values in `PUBLIC_*` variables, shell
tracing, reports, artifacts, or workflow summaries.

## Local no-write plan

The checked-in smoke fixture is preview-only and is suitable for local command
validation before HPA-231. `plan` reads, decodes, and encodes every included
source and inspects the destination, but it performs no destination writes.

```bash
mkdir -p .tmp
REPOSITORY_ROOT=$(pwd)
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id local-check \
  --plan "$REPOSITORY_ROOT/packages/infra-cloudflare/src/publisher/__fixtures__/smoke-release-plan.v1.json" \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination local \
  --destination-root .tmp/aquila-assets \
  --json > .tmp/plan-report.json
```

An explicit production plan is required for production candidate creation:

```bash
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment production \
  --plan "$REPOSITORY_ROOT/packages/stories/release-plans/the_seventh_mirror.json" \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination local \
  --destination-root .tmp/aquila-assets \
  --json > .tmp/production-plan-report.json
```

## Production candidate and exact preview mirror

Create and verify the immutable production candidate without touching the
production pointer. Save the one JSON document from stdout exactly as shown:

```bash
mkdir -p .tmp
REPOSITORY_ROOT=$(pwd)
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan "$REPOSITORY_ROOT/packages/stories/release-plans/the_seventh_mirror.json" \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination r2 \
  --no-activate \
  --json > .tmp/publish-report.json
```

Derive all subsequent identifiers from that retained report. Do not copy them
from progress text or reconstruct the manifest checksum:

```bash
RELEASE_ID=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); if (typeof value.releaseId !== "string") throw new Error("missing releaseId"); console.log(value.releaseId)' .tmp/publish-report.json)
MANIFEST_SHA256=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); if (typeof value.manifestSha256 !== "string") throw new Error("missing manifestSha256"); console.log(value.manifestSha256)' .tmp/publish-report.json)
```

Mirror the exact production manifest bytes into the isolated preview namespace:

```bash
PREVIEW_ID=hpa-230-gate
bun --filter @aquila/infra-cloudflare assets -- mirror-preview \
  --story the_seventh_mirror \
  --release "$RELEASE_ID" \
  --preview-id "$PREVIEW_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2 \
  --json > .tmp/mirror-report.json
```

The mirror command deep-verifies production before its create-only preview
manifest write, reuses only byte-identical existing bytes and metadata, and
deep-verifies the preview result. Shared `vn/objects/` bodies are not copied.

## Activate and verify preview

Activation is source-independent: it does not read the catalog, plan, source
root, or encoder.

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2 \
  --json > .tmp/preview-activate-report.json

bun --filter @aquila/infra-cloudflare assets -- verify \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/preview-verify-report.json
```

The publisher `verify` command proves stored bytes, metadata, canonical identity,
dimensions, and policy through R2. HPA-229's credential-free public verifier
still owns the deployed host's CORS, cache rules, pointer headers, public object
responses, and source-key isolation:

```bash
bun --filter @aquila/infra-cloudflare verify
```

That verifier intentionally targets the pre-existing HPA-229 `smoke` preview.
The HPA-230 gate does not seed that fixture and does not treat this public check
as proof of its run-scoped candidate. HPA-233 owns complete public
preview-domain and browser verification for the retained run-scoped candidate.

## Activate production after approval

Only after HPA-233 approves the retained release ID and manifest checksum:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/production-activate-report.json
```

This command deep-verifies the retained production candidate and changes only
`vn/stories/the_seventh_mirror/current.json`. It never re-encodes.

## Unchanged rerun and no-op

An unchanged candidate-only publish may re-encode locally to prove current
inputs, but creates no externally visible writes when all immutable bytes
already exist:

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan "$REPOSITORY_ROOT/packages/stories/release-plans/the_seventh_mirror.json" \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination r2 \
  --no-activate \
  --json > .tmp/unchanged-report.json

bun -e 'const value = await Bun.file(process.argv[1]).json(); if (value.status !== "no-op") throw new Error(`expected no-op, got ${value.status}`)' .tmp/unchanged-report.json
```

Exit `0` covers both `success` and `no-op`; automation must inspect `status`,
`actions`, and `pointer.changed` rather than infer a write from the exit code.

## List, rollback, reactivation, and concurrency

List canonical release manifests using exact key grammar, optionally deep
verifying every object:

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --destination r2 \
  --deep \
  --json > .tmp/releases-report.json
```

Rollback is also source-independent and writes a new monotonic pointer; it never
copies old `current.json` bytes:

```bash
# Replace both values with the digests from the retained JSON report.
ROLLBACK_RELEASE_ID="sha256-RETAINED_RELEASE_DIGEST"
ROLLBACK_MANIFEST_SHA256="RETAINED_MANIFEST_BYTE_DIGEST"
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --destination r2 \
  --json > .tmp/rollback-report.json
```

Use `--reactivate` only when intentionally writing a new monotonic pointer for
the already-active release. A stale pointer snapshot returns exit `4` and status
`conflict`; the immutable candidate remains safe. Re-run normally after
reviewing the newly active release. For an exceptional deliberate replacement,
add `--override-concurrent-pointer`: the publisher rereads the pointer,
reverifies the selected candidate, and attempts one refreshed CAS. It never
writes unconditionally. Production reactivation or override still requires the
exact `--confirm-production` value.

## Reports, exits, and privacy

With `--json`, stdout contains exactly one `PublisherReportV1` document. Human
progress and diagnostics use stderr. Retain JSON reports as release evidence,
but review any new report fields before artifact upload.

| Exit | Meaning |
|---:|---|
| 0 | success or no-op |
| 1 | CLI or configuration error |
| 2 | input, coverage, source, encoding, or integrity failure |
| 3 | storage or network failure |
| 4 | conditional pointer concurrency conflict |
| 5 | activation/rollback target, clock-skew, or pointer-time failure |

Publisher reports, runtime manifests, pointer documents, object metadata, and
workflow evidence must not contain prompts, provider data, credentials, private
bucket identifiers, absolute source paths, or raw SDK requests.

## Interruption, retention, and cleanup

Failure before pointer CAS can leave verified immutable objects or manifests.
They are safe retained candidates and may already be shared by another release;
do not delete them as compensation. Retry after fixing the cause. Pointer-only
rollback preserves both the newer and older immutable releases. Garbage
collection is a separate, explicitly reviewed operation.

Temporary `.tmp` reports and local destination data contain no credentials, but
may contain public release identities and paths. Remove them locally when their
evidence-retention window ends. Never use a broad recursive cleanup target; do
not delete R2 objects as part of publisher recovery.
