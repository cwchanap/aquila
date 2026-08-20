# Visual novel release gate (HPA-233)

One manually-triggered workflow that qualifies one immutable release candidate
end-to-end **in a preview namespace** before production is touched. Run it via
Actions → **Visual Novel Release Gate** → *Run workflow*.

The workflow never moves the production pointer: it deep-verifies the candidate
in the production namespace (where `--no-activate` published it) through a
**read-only** `assets verify`, mirrors and activates it into an isolated preview
namespace, verifies the public CDN serves exactly that release, and drives the
deployed preview reader in a real browser. Production activation and rollback
are separate **manual** commands guarded by `--confirm-production`.

The production-safety invariant is about pointer-**moving** commands, not about
the word "production": `assets verify --environment production` is read-only
(`candidate-verifier.ts` only reads the delivery store and moves no pointer),
so the workflow's only production-targeting command does not touch the
production pointer. The only pointer move in the entire workflow is the preview
`activate`; `publish`/`activate`/`rollback` against production — the commands
that can move the production pointer — never run in it.

Prerequisites: the shared R2 release secrets
(`R2_RELEASE_ACCESS_KEY_ID`, `R2_RELEASE_SECRET_ACCESS_KEY`) configured on the
repository, and a production candidate published with `--no-activate` (the
HPA-231 production release plan for the story must exist). The publisher
runbook — `docs/infrastructure/visual-asset-publisher.md` — owns candidate
creation details.

## 1. Publish a candidate and get its release ID and manifest checksum

Create the immutable production candidate **without** touching the production
pointer and retain the one JSON document on stdout:

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

Derive both identifiers from that retained report — never from progress text:

```bash
RELEASE_ID=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); if (typeof value.releaseId !== "string") throw new Error("missing releaseId"); console.log(value.releaseId)' .tmp/publish-report.json)
MANIFEST_SHA256=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); if (typeof value.manifestSha256 !== "string") throw new Error("missing manifestSha256"); console.log(value.manifestSha256)' .tmp/publish-report.json)
echo "RELEASE_ID=$RELEASE_ID"
echo "MANIFEST_SHA256=$MANIFEST_SHA256"
```

## 2. Point a preview deploy at the candidate and run the workflow

Pick a preview id (e.g. `hpa-231-gate`) and set these on the **preview**
deployment so the deployed reader resolves the preview pointer:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Then trigger the workflow with:

| Input | Value |
|---|---|
| `story` | `the_seventh_mirror` |
| `release_id` | `$RELEASE_ID` from step 1 |
| `manifest_sha256` | `$MANIFEST_SHA256` from step 1 |
| `preview_id` | `hpa-231-gate` (same as `PUBLIC_ASSET_PREVIEW_ID`) |
| `preview_url` | HTTPS origin of the preview deploy, e.g. `https://aquila-preview-xxxx.vercel.app` |

The workflow: verifies the release in deep storage against the **production**
namespace it was published into (read-only `assets verify
--environment production` — the preview manifest does not exist until
`mirror-preview` runs, so step 1 must look where the candidate actually is),
mirrors it into the preview namespace, activates the preview pointer, verifies
the public CDN serves the exact release, then runs the deployed reader spec
(`playwright.release-gate.config.ts`, Desktop + Mobile Chromium) against
`preview_url`.

## 3. Read the result

The final *Print release gate summary* step lists story, release, manifest
checksum, preview URL, and the result of each gate step. On failure the
Playwright report is uploaded as an artifact
(`release-gate-playwright-report-<run-id>-<attempt>`).

- **Go:** every step reports `PASS`. Retain `$RELEASE_ID` and `$MANIFEST_SHA256`
  for the production activation.
- **No-go:** the run stops at the failing step; fix the cause (a failed
  candidate, a stale preview deploy, or a changed manifest) and re-run. A
  stale or wrong release cannot pass: the storage verify, the CDN verifier's
  checksum, and the deployed spec all pin the exact release and checksum.

## 4. Activate production (manual)

Only after the gate approves the retained release ID and manifest checksum:

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

This changes only `vn/stories/the_seventh_mirror/current.json`; it never
re-encodes.

## 5. Verify production

Rerun the public verifier and the deployed spec against the **production**
URLs, with **no preview id**. Omit `--release` so the verifier runs in active
mode and reads the production `current.json` pointer that activation just
moved — checking its CORS, revalidation policy, manifestPath pairing, and
pointer/manifest pair. `--expect-manifest-sha256` still pins the exact manifest
bytes:

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

`RELEASE_GATE_PREVIEW_ID=` is set to empty explicitly: the inline
`VAR=value command` prefix only *adds* to the command's environment, it does
not clear inherited variables, so omitting it would let a stale exported
`RELEASE_GATE_PREVIEW_ID` (e.g. left over from a preview run in the same
shell) leak through and make the spec expect a preview target instead of
production.

Both must pass before the release is considered live.

## 6. Roll back

Rollback is source-independent and writes a new monotonic production pointer.
Use the retained release ID and manifest checksum of the release to return to:

```bash
ROLLBACK_RELEASE_ID="sha256-RETAINED_RELEASE_DIGEST"
ROLLBACK_MANIFEST_SHA256="RETAINED_MANIFEST_BYTE_DIGEST"
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/production-rollback-report.json
```

Then verify the rolled-back release is served. Do **not** re-run step 5
verbatim: step 5 pins `$RELEASE_ID` / `$MANIFEST_SHA256` (the release you
just rolled back *from*), so it would expect the wrong release and report
the successful rollback as a failure. Use the rollback-scoped identifiers
with `--release` omitted so the verifier reads the production `current.json`
pointer that rollback just moved:

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$ROLLBACK_RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$ROLLBACK_MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Both must pass before the rollback is considered complete. Pointer
rollback preserves both the newer and older immutable releases; garbage
collection is a separate, explicitly reviewed operation.
