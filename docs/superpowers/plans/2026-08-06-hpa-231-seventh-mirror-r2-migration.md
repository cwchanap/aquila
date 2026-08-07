# HPA-231 The Seventh Mirror R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish The Seventh Mirror as Aquila's first production R2-backed visual-novel release, prove preview/production/rollback behavior, archive the authoring originals privately, then remove production-sized story binaries from Git/Vercel while preserving tiny local fixtures.

**Architecture:** Reuse the HPA-227 runtime contracts, HPA-230 immutable publisher, HPA-229 R2 buckets/domain, HPA-233 preview release gate, and HPA-228 local fixture tooling. HPA-231 adds only story-specific release classification, a private archive/restore runbook, one structural release-plan test, repository cleanup, and one story-specific footprint guard. No new runtime, publisher, storage, approval, or migration abstraction is introduced.

**Tech Stack:** Bun 1.3.1, TypeScript, Vitest, Sharp, `@aquila/stories/runtime-assets`, `@aquila/infra-cloudflare`, GitHub Actions, Cloudflare R2 S3-compatible API, AWS CLI for the one-time private-source sync, Playwright release gate.

## Global Constraints

- This is a one-time migration and release checklist; do not redesign the runtime contract, reader, R2 infrastructure, publisher, or release gate.
- Do not add new manifest, pointer, release-plan, report, review-record, or evidence schema versions.
- Do not add backward-compatibility adapters.
- Do not add new publisher command families or storage abstractions.
- Do not add automatic production activation or rollback.
- Do not add formal approval, attestation, or evidence-chain protocols.
- Do not add generic multi-story migration orchestration.
- Do not add a generalized private-source synchronization system.
- Do not add new visual reader caching/revalidation behavior.
- Production cleanup is forbidden until production activation, smoke verification, and rollback/reactivation proof have all passed.
- Public runtime manifests/object metadata must not expose prompts, source paths, provider metadata, private bucket identifiers, or credentials.
- Existing delivery-publisher credentials remain delivery-only. Private-source archive credentials are operator-only and never committed.

---

## File Structure

### Create

- `packages/stories/release-plans/the_seventh_mirror.json` — complete production classification of compiler-generated visual keys.
- `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts` — structural coverage test that still passes after production source binaries leave Git.
- `docs/infrastructure/the-seventh-mirror-r2-migration.md` — archive/restore/publish/activate/rollback commands plus retained release evidence.
- `apps/web/scripts/assert-visual-asset-footprint.ts` — narrow guard for the four source fixtures and committed HPA-228 local runtime fixture graph.
- `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts` — focused guard tests.

### Modify

- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png`
- `apps/web/package.json`
- `.github/workflows/build-and-lint.yml`
- generated HPA-228 local fixture files under `apps/web/public/assets/vn/`

### Delete after release proof

- Every other file under `packages/assets/media/the_seventh_mirror/**`.
- Any stale local VN object under `apps/web/public/assets/vn/` not referenced by the regenerated HPA-228 pointer/manifest.

---

### Task 1: Add the production release plan and structural coverage test

**Files:**
- Create: `packages/stories/release-plans/the_seventh_mirror.json`
- Create: `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`

**Interfaces:**
- Consumes: `packages/stories/src/generated/theSeventhMirror/image-assets.json`, `parseStoryAssetReleasePlan()`, `qualifyAssetIdentity()`.
- Produces: one HPA-227-compatible production release plan with exact compiler-key coverage and stable source paths.

- [ ] **Step 1: Write the failing structural test**

Create `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStoryAssetReleasePlan, qualifyAssetIdentity } from '..';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../../..');

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8'));
}

type GeneratedEntry = { key: string; path: string };
type GeneratedAssets = {
    storyId: string;
    backgrounds: GeneratedEntry[];
    portraits: GeneratedEntry[];
};

describe('The Seventh Mirror production release plan', () => {
    it('classifies every generated visual identity exactly once', async () => {
        const generated = (await readJson(
            resolve(
                packageRoot,
                'src/generated/theSeventhMirror/image-assets.json'
            )
        )) as GeneratedAssets;
        const plan = parseStoryAssetReleasePlan(
            await readJson(
                resolve(packageRoot, 'release-plans/the_seventh_mirror.json')
            )
        );

        expect(plan.storyId).toBe('the_seventh_mirror');
        expect(plan.channel).toBe('production');
        expect(generated.storyId).toBe(plan.storyId);

        const generatedById = new Map<string, string>([
            ...generated.backgrounds.map(entry => [
                qualifyAssetIdentity({
                    type: 'background' as const,
                    key: entry.key,
                }),
                entry.path,
            ] as const),
            ...generated.portraits.map(entry => [
                qualifyAssetIdentity({
                    type: 'portrait' as const,
                    key: entry.key,
                }),
                entry.path,
            ] as const),
        ]);
        const planById = new Map(
            plan.entries.map(entry => [
                qualifyAssetIdentity(entry.identity),
                entry,
            ])
        );

        expect([...planById.keys()].sort()).toEqual(
            [...generatedById.keys()].sort()
        );

        for (const entry of plan.entries) {
            if (entry.disposition !== 'included') continue;
            const id = qualifyAssetIdentity(entry.identity);
            expect(entry.sourcePath).toBe(generatedById.get(id));
        }
    });
});
```

- [ ] **Step 2: Run the test and verify the production plan is the only missing piece**

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: FAIL because `release-plans/the_seventh_mirror.json` does not exist.

- [ ] **Step 3: Scaffold the release plan once from compiler inventory and source availability**

Run from repository root before any source cleanup:

```bash
mkdir -p packages/stories/release-plans
bun -e '
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const catalog = await Bun.file(
  "packages/stories/src/generated/theSeventhMirror/image-assets.json"
).json();
const sourceRoot = resolve("packages/assets/media");

const raw = [
  ...catalog.backgrounds.map((entry) => ({ type: "background", entry })),
  ...catalog.portraits.map((entry) => ({ type: "portrait", entry })),
];

const entries = raw
  .map(({ type, entry }) => {
    const identity = { type, key: entry.key };
    const section = entry.key.startsWith("chapter_")
      ? entry.key.split("/")[0]
      : undefined;
    const exists = existsSync(resolve(sourceRoot, entry.path));
    return exists
      ? {
          identity,
          disposition: "included",
          sourcePath: entry.path,
          ...(section === undefined ? {} : { section }),
        }
      : {
          identity,
          disposition: "omitted",
          reason: "Source artwork unavailable at HPA-231 migration",
          ...(section === undefined ? {} : { section }),
        };
  })
  .sort((a, b) => {
    const left = `${a.identity.type}:${a.identity.key}`;
    const right = `${b.identity.type}:${b.identity.key}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });

await Bun.write(
  "packages/stories/release-plans/the_seventh_mirror.json",
  `${JSON.stringify({
    schemaVersion: 1,
    storyId: "the_seventh_mirror",
    channel: "production",
    entries,
  }, null, 2)}\n`
);
'
```

Review every omitted entry and any existing artwork that should intentionally fall back. The scaffold is a one-off operator command and must not become a committed generator.

- [ ] **Step 4: Run the structural test**

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: PASS.

- [ ] **Step 5: Run the real HPA-230 plan against the original source tree**

```bash
rm -rf .tmp/hpa-231-plan-destination
mkdir -p .tmp
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root packages/assets/media \
  --destination local \
  --destination-root .tmp/hpa-231-plan-destination \
  --json > .tmp/hpa-231-plan.json
```

Require `coverage.totals.unclassified === 0`, no input/source/encoding errors, and a release ID/checksum in the report.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/stories/release-plans/the_seventh_mirror.json \
  packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts
git commit -m "feat: classify Seventh Mirror production assets"
```

---

### Task 2: Archive and restore the authoring sources once

**Files:**
- Create: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: current `packages/assets/media/the_seventh_mirror/**`, generated `image-assets.json`, production release plan, private `aquila-vn-source` bucket.
- Produces: immutable private archive prefix and a documented restore procedure that reconstructs a valid publisher source root.

- [ ] **Step 1: Start the runbook with fixed infrastructure values**

Create `docs/infrastructure/the-seventh-mirror-r2-migration.md`:

```markdown
# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

Private source sync uses an operator-only R2 Access Key ID / Secret Access Key
scoped to `aquila-vn-source`. Never commit or print those values. The delivery
publisher credentials remain scoped to `aquila-vn-delivery`.
```

- [ ] **Step 2: Build the local archive directory and checksums**

```bash
COMMIT_SHA=$(git rev-parse --short=12 HEAD)
UTC_DATE=$(date -u +%Y-%m-%d)
ARCHIVE_ID="${UTC_DATE}-${COMMIT_SHA}"
ARCHIVE_ROOT=.tmp/hpa-231-source-archive

rm -rf "$ARCHIVE_ROOT"
mkdir -p "$ARCHIVE_ROOT/media" "$ARCHIVE_ROOT/metadata"
cp -R packages/assets/media/the_seventh_mirror "$ARCHIVE_ROOT/media/"
cp packages/stories/src/generated/theSeventhMirror/image-assets.json \
  "$ARCHIVE_ROOT/metadata/image-assets.json"
cp packages/stories/release-plans/the_seventh_mirror.json \
  "$ARCHIVE_ROOT/metadata/release-plan.json"

(
  cd "$ARCHIVE_ROOT"
  LC_ALL=C find media metadata -type f | sort | while IFS= read -r file; do
    shasum -a 256 "$file"
  done > SHA256SUMS
)
```

- [ ] **Step 3: Upload the immutable archive to private R2**

With source-bucket-scoped credentials loaded into the AWS CLI environment:

```bash
export AWS_DEFAULT_REGION=auto
R2_ENDPOINT=https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"

aws s3 sync "$ARCHIVE_ROOT/" "$R2_PREFIX" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
```

Never add `--delete`.

- [ ] **Step 4: Restore into an empty directory and verify every checksum**

```bash
RESTORE_ROOT=.tmp/hpa-231-restored
rm -rf "$RESTORE_ROOT"
mkdir -p "$RESTORE_ROOT"

aws s3 sync "$R2_PREFIX" "$RESTORE_ROOT/" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

(
  cd "$RESTORE_ROOT"
  shasum -a 256 -c SHA256SUMS
)
```

Expected: every archived file reports `OK`.

- [ ] **Step 5: Prove the restored source root reproduces the original publication identity**

```bash
rm -rf .tmp/hpa-231-restore-destination
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root "$RESTORE_ROOT/media" \
  --destination local \
  --destination-root .tmp/hpa-231-restore-destination \
  --json > .tmp/hpa-231-restore-plan.json

bun -e '
const original = await Bun.file(".tmp/hpa-231-plan.json").json();
const restored = await Bun.file(".tmp/hpa-231-restore-plan.json").json();
if (original.releaseId !== restored.releaseId) throw new Error("releaseId mismatch");
if (original.manifestSha256 !== restored.manifestSha256) throw new Error("manifestSha256 mismatch");
console.log(restored.releaseId, restored.manifestSha256);
'
```

Expected: exit `0` with identical release ID/checksum.

- [ ] **Step 6: Document `ARCHIVE_ID`, upload, restore, checksum, and `--source-root "$RESTORE_ROOT/media"` procedure in the runbook**

- [ ] **Step 7: Commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: add Seventh Mirror source restore runbook"
```

---

### Task 3: Publish the immutable production candidate and qualify it in preview

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: production release plan, original source root, HPA-230 publisher, HPA-233 release gate.
- Produces: retained primary release ID/checksum plus automated and manual preview approval.

- [ ] **Step 1: Publish without activation**

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root packages/assets/media \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-publish.json
```

- [ ] **Step 2: Derive identifiers only from the retained report**

```bash
RELEASE_ID=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-publish.json").json();
if (typeof report.releaseId !== "string") throw new Error("missing releaseId");
console.log(report.releaseId);
')
MANIFEST_SHA256=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-publish.json").json();
if (typeof report.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(report.manifestSha256);
')
```

- [ ] **Step 3: Deep-verify the stored production candidate**

```bash
bun --filter @aquila/infra-cloudflare assets -- verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-candidate-verify.json
```

Expected: `status: "success"`.

- [ ] **Step 4: Deploy an isolated preview using `PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate`**

Use:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Store the deployed HTTPS origin in `PREVIEW_URL`.

- [ ] **Step 5: Trigger the existing Visual Novel Release Gate**

Use workflow inputs:

```text
story=the_seventh_mirror
release_id=$RELEASE_ID
manifest_sha256=$MANIFEST_SHA256
preview_id=hpa-231-gate
preview_url=$PREVIEW_URL
```

Expected: storage deep verify, mirror-preview, preview activation, public CDN verify, and deployed browser spec all PASS.

- [ ] **Step 6: Perform one manual representative visual review**

Record one HPA-231 Linear checklist covering:

```text
[ ] early-scene background change
[ ] middle/late-scene background
[ ] portrait/expression change
[ ] intentional omitted/missing fallback
[ ] one choice path where available
[ ] desktop presentation
[ ] mobile presentation
[ ] text -> visual -> text preserves the exact active line
```

- [ ] **Step 7: Record the primary release ID/checksum, preview ID, preview deployment, workflow run, and manual review result in the runbook**

- [ ] **Step 8: Commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror candidate qualification"
```

---

### Task 4: Activate production and prove the live reader

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: qualified primary release ID/checksum.
- Produces: production pointer on the exact candidate and passing active CDN/browser smoke.

- [ ] **Step 1: Activate production**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-activate.json
```

- [ ] **Step 2: Verify the active production CDN pointer/manifest/object chain**

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json > .tmp/hpa-231-production-public-verify.json
```

- [ ] **Step 3: Run the deployed production reader release-gate spec**

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: desktop/mobile reader flows pass with the exact production release identity and active line preserved across text/visual switches.

- [ ] **Step 4: Record production activation and smoke results in the runbook and commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror production activation"
```

---

### Task 5: Prove pointer-only production rollback and reactivation

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: primary verified production release plus either a previous verified full-story release or a controlled second verified release.
- Produces: successful rollback to another verified release and activation back to the release that was current before rollback.

- [ ] **Step 1: List deep-verified production releases**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-production-releases.json
```

Inspect candidate manifests against the checked-in production plan. If a previous full-story release is valid, set its identifiers as `ROLLBACK_RELEASE_ID` and `ROLLBACK_MANIFEST_SHA256`, keep the primary `$RELEASE_ID`/`$MANIFEST_SHA256` as the release to reactivate, and continue at Step 7.

- [ ] **Step 2: If no previous full-story release exists, create a temporary second source root**

```bash
REVISION_SOURCE_ROOT=.tmp/hpa-231-revision-source
rm -rf "$REVISION_SOURCE_ROOT"
cp -R packages/assets/media "$REVISION_SOURCE_ROOT"
```

- [ ] **Step 3: Make one deterministic tiny revision while preserving logical identity and dimensions**

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";
const path = ".tmp/hpa-231-revision-source/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png";
const temporary = `${path}.hpa-231.tmp.png`;
const before = await sharp(path).metadata();
await sharp(path)
  .modulate({ brightness: 1.01 })
  .png({ compressionLevel: 9 })
  .toFile(temporary);
const after = await sharp(temporary).metadata();
if (before.width !== after.width || before.height !== after.height) {
  throw new Error("controlled revision changed dimensions");
}
await rename(temporary, path);
'
```

Visually inspect `chapter_1/ch1_act2_s1` and accept the 1% brightness adjustment before publication.

- [ ] **Step 4: Publish and deep-verify the controlled second candidate**

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root "$REVISION_SOURCE_ROOT" \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-second-publish.json

SECOND_RELEASE_ID=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-second-publish.json").json();
if (typeof report.releaseId !== "string") throw new Error("missing releaseId");
console.log(report.releaseId);
')
SECOND_MANIFEST_SHA256=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-second-publish.json").json();
if (typeof report.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(report.manifestSha256);
')

if [ "$SECOND_RELEASE_ID" = "$RELEASE_ID" ]; then
  echo "controlled revision did not create a second release" >&2
  exit 1
fi

bun --filter @aquila/infra-cloudflare assets -- verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$SECOND_RELEASE_ID" \
  --expect-manifest-sha256 "$SECOND_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-second-verify.json
```

- [ ] **Step 5: Archive the controlled source delta privately**

```bash
REVISION_ARCHIVE_ID="${ARCHIVE_ID}-revision-2"
REVISION_ARCHIVE_ROOT=.tmp/hpa-231-revision-archive
REVISED_RELATIVE=the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png

rm -rf "$REVISION_ARCHIVE_ROOT"
mkdir -p \
  "$REVISION_ARCHIVE_ROOT/media/the_seventh_mirror/backgrounds/chapter_1" \
  "$REVISION_ARCHIVE_ROOT/metadata"
cp "$REVISION_SOURCE_ROOT/$REVISED_RELATIVE" \
  "$REVISION_ARCHIVE_ROOT/media/$REVISED_RELATIVE"
printf "%s\n" "$ARCHIVE_ID" > "$REVISION_ARCHIVE_ROOT/metadata/base-archive.txt"
cp packages/stories/release-plans/the_seventh_mirror.json \
  "$REVISION_ARCHIVE_ROOT/metadata/release-plan.json"
(
  cd "$REVISION_ARCHIVE_ROOT"
  LC_ALL=C find media metadata -type f | sort | while IFS= read -r file; do
    shasum -a 256 "$file"
  done > SHA256SUMS
)

aws s3 sync "$REVISION_ARCHIVE_ROOT/" \
  "s3://aquila-vn-source/authoring/the_seventh_mirror/$REVISION_ARCHIVE_ID/" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
```

Document that reproducing the second release means restoring `$ARCHIVE_ID` and then overlaying `$REVISION_ARCHIVE_ID` on the restore root.

- [ ] **Step 6: Qualify and activate the controlled second release**

Run the HPA-233 preview gate with preview id `hpa-231-rollback-proof` and the second identifiers. After it passes, activate the second release normally and rerun the Task 4 production public/browser smoke with the second identifiers.

Then set:

```bash
CURRENT_RELEASE_ID="$SECOND_RELEASE_ID"
CURRENT_MANIFEST_SHA256="$SECOND_MANIFEST_SHA256"
ROLLBACK_RELEASE_ID="$RELEASE_ID"
ROLLBACK_MANIFEST_SHA256="$MANIFEST_SHA256"
```

- [ ] **Step 7: For the previous-release path, set the release that is current before rollback**

If Steps 2-6 were skipped because a valid previous release already existed:

```bash
CURRENT_RELEASE_ID="$RELEASE_ID"
CURRENT_MANIFEST_SHA256="$MANIFEST_SHA256"
```

`ROLLBACK_RELEASE_ID` and `ROLLBACK_MANIFEST_SHA256` remain the verified previous release values selected in Step 1.

- [ ] **Step 8: Roll back by changing only production `current.json`**

```bash
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-rollback.json
```

Run the public verifier and deployed release-gate browser spec using the rollback identifiers. Both must pass.

- [ ] **Step 9: Activate the previously-current verified release again**

Use normal `activate`; `--reactivate` is intentionally not used because after rollback the requested release is no longer active.

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$CURRENT_RELEASE_ID" \
  --expect-manifest-sha256 "$CURRENT_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-reactivate.json
```

Run the production public verifier and deployed release-gate browser spec again using the current identifiers. Both must pass.

- [ ] **Step 10: Record both release identities and rollback/reactivation results, then commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror rollback proof"
```

---

### Task 6: Remove production binaries and regenerate tiny local fixtures

**Files:**
- Modify: the four fixture PNGs listed under File Structure.
- Delete: every other `packages/assets/media/the_seventh_mirror/**` file.
- Regenerate: `apps/web/public/assets/vn/**` HPA-228 local fixture release.

**Interfaces:**
- Consumes: successful Task 5 release proof and existing `apps/web/scripts/build-visual-fixtures.ts`.
- Produces: clean checkout containing only four small source fixtures and a consistent local runtime fixture.

- [ ] **Step 1: Enforce the migration checkpoint manually before deletion**

Do not continue unless the runbook contains concrete values/results for the private archive restore, active production release, production public/browser smoke, rollback, and activation back to the previously-current release.

- [ ] **Step 2: Downsize the four retained source fixtures in place**

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";

const fixtures = [
  ["packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png", 320, 180],
  ["packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png", 320, 180],
  ["packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png", 180, 240],
  ["packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png", 180, 240],
];

for (const [path, width, height] of fixtures) {
  const temporary = `${path}.hpa-231-fixture.tmp.png`;
  await sharp(path)
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(temporary);
  await rename(temporary, path);
}
'
```

- [ ] **Step 3: Delete every other The Seventh Mirror source file**

```bash
bun -e '
import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "packages/assets/media";
const storyRoot = join(root, "the_seventh_mirror");
const keep = new Set([
  "the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png",
  "the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png",
  "the_seventh_mirror/characters/asakura_mio/base.png",
  "the_seventh_mirror/characters/asakura_yuma/base.png",
]);

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    const rel = relative(root, path).split("\\").join("/");
    if (!keep.has(rel)) await rm(path);
  }
}

await walk(storyRoot);
'
find packages/assets/media/the_seventh_mirror -type d -empty -delete
```

- [ ] **Step 4: Regenerate and verify the local HPA-228 fixture**

```bash
bun --filter web build:visual-fixtures
bun --filter web verify:visual-fixtures
```

Expected: PASS.

- [ ] **Step 5: Commit the source cleanup and regenerated fixture graph after the footprint guard in Task 7 also passes**

Do not commit a state that leaves known stale `apps/web/public/assets/vn/objects/**` files.

---

### Task 7: Add the narrow visual-asset footprint guard

**Files:**
- Create: `apps/web/scripts/assert-visual-asset-footprint.ts`
- Create: `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/build-and-lint.yml`

**Interfaces:**
- Consumes: four approved source fixture paths and the committed HPA-228 preview pointer/manifest/object graph.
- Produces: credential-free failure when a production-sized The Seventh Mirror source or stale/unreferenced committed local VN file returns.

- [ ] **Step 1: Write the failing guard tests with a complete valid temporary fixture tree**

Create `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
} from '@aquila/stories/runtime-assets';
import { assertVisualAssetFootprint } from '../assert-visual-asset-footprint';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;
const OBJECT_SHA = 'a'.repeat(64);
const MANIFEST_SHA = 'b'.repeat(64);
const RELEASE_ID = `sha256-${'c'.repeat(64)}`;
const APPROVED = [
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
    'the_seventh_mirror/characters/asakura_mio/base.png',
    'the_seventh_mirror/characters/asakura_yuma/base.png',
] as const;

const created: string[] = [];

afterEach(async () => {
    await Promise.all(
        created.splice(0).map(path => rm(path, { recursive: true }))
    );
});

async function writeText(path: string, value: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
}

async function validTree(): Promise<{
    root: string;
    mediaRoot: string;
    publicRoot: string;
}> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-asset-footprint-'));
    created.push(root);
    const mediaRoot = join(root, 'media');
    const publicRoot = join(root, 'public');

    for (const rel of APPROVED) {
        const path = join(mediaRoot, rel);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.from('fixture'));
    }

    const objectPath = getObjectPath(OBJECT_SHA as never, 'webp');
    const manifestPath = getReleaseManifestPath(STORY_ID, RELEASE_ID, TARGET);
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const assets = [
        { type: 'background', key: 'chapter_1/ch1_act2_s0' },
        { type: 'background', key: 'chapter_1/ch1_act2_s1' },
        { type: 'portrait', key: 'asakura_mio/base' },
        { type: 'portrait', key: 'asakura_yuma/base' },
    ].map(identity => ({
        identity,
        variants: {
            webp: {
                format: 'webp',
                path: objectPath,
                sha256: OBJECT_SHA,
                byteLength: 1,
            },
        },
        width: 1,
        height: 1,
    }));
    assets.sort((left, right) => {
        const a = `${left.identity.type}:${left.identity.key}`;
        const b = `${right.identity.type}:${right.identity.key}`;
        return a < b ? -1 : a > b ? 1 : 0;
    });

    await writeText(
        join(publicRoot, manifestPath),
        JSON.stringify({
            schemaVersion: 1,
            storyId: STORY_ID,
            releaseId: RELEASE_ID,
            assets,
        })
    );
    await writeText(
        join(publicRoot, pointerPath),
        JSON.stringify({
            schemaVersion: 1,
            storyId: STORY_ID,
            releaseId: RELEASE_ID,
            manifestPath,
            manifestSha256: MANIFEST_SHA,
            publishedAt: '2026-08-06T00:00:00.000Z',
        })
    );
    await writeText(join(publicRoot, objectPath), 'x');

    return { root, mediaRoot, publicRoot };
}

describe('assertVisualAssetFootprint', () => {
    it('accepts exactly the approved fixture graph', async () => {
        const { mediaRoot, publicRoot } = await validTree();
        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).resolves.toBeUndefined();
    });

    it('rejects an unexpected Seventh Mirror source file', async () => {
        const { mediaRoot, publicRoot } = await validTree();
        const extra = join(mediaRoot, 'the_seventh_mirror/extra/full.png');
        await mkdir(dirname(extra), { recursive: true });
        await writeFile(extra, Buffer.from('extra'));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/unexpected Seventh Mirror fixture source/i);
    });

    it('rejects an oversized approved fixture source', async () => {
        const { mediaRoot, publicRoot } = await validTree();
        await writeFile(join(mediaRoot, APPROVED[0]), Buffer.alloc(513 * 1024));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/fixture source exceeds/i);
    });

    it('rejects an unreferenced committed VN object', async () => {
        const { mediaRoot, publicRoot } = await validTree();
        const orphan = join(publicRoot, 'vn/objects/orphan.webp');
        await mkdir(dirname(orphan), { recursive: true });
        await writeFile(orphan, Buffer.from('orphan'));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/unreferenced local VN file/i);
    });
});
```

When implementing, use `assertSha256<'object-content'>()` instead of the `as never` shortcut in the final committed test so the fixture stays type-safe.

- [ ] **Step 2: Run the focused test and verify it fails because the guard module does not exist**

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

- [ ] **Step 3: Implement the minimal guard**

Create `apps/web/scripts/assert-visual-asset-footprint.ts`:

```ts
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import {
    getCurrentPointerPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
} from '@aquila/stories/runtime-assets';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;
const MAX_FIXTURE_FILE_BYTES = 512 * 1024;
const MAX_FIXTURE_TOTAL_BYTES = 1536 * 1024;

const APPROVED_FIXTURE_SOURCES = new Set([
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
    'the_seventh_mirror/characters/asakura_mio/base.png',
    'the_seventh_mirror/characters/asakura_yuma/base.png',
]);

async function walkFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    async function walk(dir: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                return;
            }
            throw error;
        }
        for (const entry of entries) {
            const path = resolve(dir, entry.name);
            if (entry.isDirectory()) await walk(path);
            else files.push(path);
        }
    }
    await walk(root);
    return files;
}

function normalizedRelative(root: string, path: string): string {
    return relative(root, path).split('\\').join('/');
}

export async function assertVisualAssetFootprint(options?: {
    mediaRoot?: string;
    publicRoot?: string;
}): Promise<void> {
    const mediaRoot =
        options?.mediaRoot ?? resolve(process.cwd(), '../../packages/assets/media');
    const publicRoot =
        options?.publicRoot ?? resolve(process.cwd(), 'public/assets');
    const problems: string[] = [];

    const sourceFiles = await walkFiles(resolve(mediaRoot, 'the_seventh_mirror'));
    let totalSourceBytes = 0;
    const present = new Set<string>();
    for (const path of sourceFiles) {
        const rel = normalizedRelative(mediaRoot, path);
        present.add(rel);
        if (!APPROVED_FIXTURE_SOURCES.has(rel)) {
            problems.push(`unexpected Seventh Mirror fixture source: ${rel}`);
            continue;
        }
        const size = (await stat(path)).size;
        totalSourceBytes += size;
        if (size > MAX_FIXTURE_FILE_BYTES) {
            problems.push(`fixture source exceeds ${MAX_FIXTURE_FILE_BYTES} bytes: ${rel}`);
        }
    }
    for (const rel of APPROVED_FIXTURE_SOURCES) {
        if (!present.has(rel)) problems.push(`approved fixture source missing: ${rel}`);
    }
    if (totalSourceBytes > MAX_FIXTURE_TOTAL_BYTES) {
        problems.push(
            `fixture sources exceed ${MAX_FIXTURE_TOTAL_BYTES} bytes combined`
        );
    }

    const pointerPath = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
    const pointer = parseActiveReleasePointer(
        JSON.parse(await readFile(resolve(publicRoot, pointerPath), 'utf8')),
        PREVIEW_TARGET,
        STORY_ID
    );
    const manifest = parseRuntimeAssetManifest(
        JSON.parse(
            await readFile(resolve(publicRoot, pointer.manifestPath), 'utf8')
        )
    );
    const allowedRuntime = new Set<string>([
        pointerPath,
        pointer.manifestPath,
    ]);
    for (const asset of manifest.assets) {
        allowedRuntime.add(asset.variants.webp.path);
        if (asset.variants.avif) allowedRuntime.add(asset.variants.avif.path);
        if (asset.placeholder) allowedRuntime.add(asset.placeholder.path);
    }

    for (const path of await walkFiles(resolve(publicRoot, 'vn'))) {
        const rel = normalizedRelative(publicRoot, path);
        if (!allowedRuntime.has(rel)) {
            problems.push(`unreferenced local VN file: ${rel}`);
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `Visual asset footprint check failed:\n${problems.join('\n')}`
        );
    }
}

if (import.meta.main) {
    await assertVisualAssetFootprint();
}
```

- [ ] **Step 4: Make the test fixture type-safe and run it**

Replace the temporary `OBJECT_SHA as never` in Step 1 with:

```ts
import { assertSha256 } from '@aquila/stories/runtime-assets';

const objectSha = assertSha256<'object-content'>(OBJECT_SHA);
const objectPath = getObjectPath(objectSha, 'webp');
```

Then run:

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the guard against the real repository and remove only reported stale local VN files**

```bash
bun --cwd apps/web scripts/assert-visual-asset-footprint.ts
```

If failures are only unreferenced `apps/web/public/assets/vn/**` files left by fixture regeneration, delete those exact stale files and rerun until PASS. Do not expand the allowlist to preserve them.

- [ ] **Step 6: Add the package script**

Add to `apps/web/package.json`:

```json
"verify:asset-footprint": "bun scripts/assert-visual-asset-footprint.ts"
```

- [ ] **Step 7: Add the CI step after `compile:check`**

Add to `.github/workflows/build-and-lint.yml`:

```yaml
      - name: Verify visual asset footprint
        run: bun --filter web verify:asset-footprint
```

- [ ] **Step 8: Run the cleanup verification set**

```bash
bun --filter web verify:visual-fixtures
bun --filter web verify:asset-footprint
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: all PASS.

- [ ] **Step 9: Commit Task 6 and Task 7 together once the repository graph is clean**

```bash
git add \
  packages/assets/media/the_seventh_mirror \
  apps/web/public/assets/vn \
  apps/web/scripts/assert-visual-asset-footprint.ts \
  apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts \
  apps/web/package.json \
  .github/workflows/build-and-lint.yml
git commit -m "chore: remove Seventh Mirror production binaries"
```

---

### Task 8: Final verification and Linear completion

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: clean-checkout proof, final HPA-231 completion comment, HPA-231 Done, then parent HPA-216 closed.

- [ ] **Step 1: Run the complete credential-free verification set**

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web verify:visual-fixtures
bun --filter web verify:asset-footprint
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun run lint
bun run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Prove the checkout contains only approved local visual fixtures**

```bash
find packages/assets/media/the_seventh_mirror -type f -print | sort
find apps/web/public/assets/vn -type f -print | sort
bun --filter web verify:asset-footprint
```

Expected: exactly four approved source fixture paths and only the HPA-228 active local pointer/manifest/referenced objects.

- [ ] **Step 3: Prove republishing starts from the private archive rather than Git**

Restore the base archive into `.tmp/hpa-231-final-restore`, verify `SHA256SUMS`, and run:

```bash
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root .tmp/hpa-231-final-restore/media \
  --destination local \
  --destination-root .tmp/hpa-231-final-plan-destination \
  --json > .tmp/hpa-231-final-restore-plan.json
```

Expected: the restored base archive reproduces the retained base release identity. If the controlled revision is the final active release, overlay its recorded delta archive before running the same plan check for the final release identity.

- [ ] **Step 4: Record concrete final evidence in the runbook**

Add a final Markdown section with actual values for source archive ID, primary release ID/checksum, rollback target ID/checksum, final active release ID/checksum, preview gate result, manual review result, production smoke result, rollback result, activation-back result, and credential-free verification result.

- [ ] **Step 5: Commit the final runbook**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: finalize Seventh Mirror R2 migration"
```

- [ ] **Step 6: Add one concise HPA-231 completion comment**

The comment must state the concrete archive prefix, both release IDs/checksums used for rollback proof, final active release, preview/manual/production results, cleanup result, and final verification commands. Plain Markdown only; do not add an evidence schema.

- [ ] **Step 7: Move HPA-231 to Done, then close HPA-216**

Only after all HPA-231 acceptance criteria are proven. HPA-216 must not be closed first.

---

## Self-Review Checklist

- [ ] Every compiler authoring key is explicitly included or omitted.
- [ ] CI structural coverage remains valid after production sources leave Git.
- [ ] Original images plus generation metadata are privately archived, checksummed, and restorable.
- [ ] Candidate publication uses HPA-230 `--no-activate` and retained exact report identifiers.
- [ ] Preview qualification delegates to HPA-233 plus one concise manual review.
- [ ] Production activation and smoke reuse existing commands only.
- [ ] Rollback/reactivation is pointer-only and uses two verified full-story releases.
- [ ] The first-release path creates only one controlled source revision when necessary.
- [ ] Repository cleanup waits until rollback/reactivation proof passes.
- [ ] Only four tiny existing fixture source paths remain in Git.
- [ ] The footprint guard is narrow and story-specific.
- [ ] Clean-checkout tests/local fixtures still work and private restore is the republish path.
- [ ] No new schema/version/storage/runtime/release framework is introduced.
