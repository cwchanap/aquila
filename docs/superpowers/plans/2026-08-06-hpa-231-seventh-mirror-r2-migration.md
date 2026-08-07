# HPA-231 The Seventh Mirror R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish The Seventh Mirror as Aquila's first production R2-backed visual-novel release, prove preview/production/rollback behavior, archive the authoring originals privately, then remove production-sized story binaries from Git/Vercel while preserving tiny local fixtures.

**Architecture:** Reuse the HPA-227 runtime contracts, HPA-230 immutable publisher, HPA-229 R2 buckets/domain, HPA-233 preview release gate, and existing HPA-228 local fixture tooling. HPA-231 adds only story-specific release classification, source archival/restore documentation, a narrow release-plan structural test, repository cleanup, and a story-specific footprint guard. No new runtime, publisher, storage, approval, or migration abstraction is introduced.

**Tech Stack:** Bun 1.3.1, TypeScript, Vitest, Sharp, existing `@aquila/stories/runtime-assets`, existing `@aquila/infra-cloudflare` publisher, GitHub Actions, Cloudflare R2 S3-compatible API, AWS CLI for one-time private-source sync, Playwright release gate.

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
- Use existing `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` only for the delivery publisher. Private-source archive credentials remain operator-only and are never committed.

---

## File Structure

### Create

- `packages/stories/release-plans/the_seventh_mirror.json` — complete production classification of compiler-generated visual keys.
- `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts` — structural coverage test that survives removal of production source binaries.
- `docs/infrastructure/the-seventh-mirror-r2-migration.md` — executable archive/restore/publish/activate/rollback runbook and retained release evidence.
- `apps/web/scripts/assert-visual-asset-footprint.ts` — narrow guard for The Seventh Mirror authoring fixtures and committed local VN runtime fixture graph.
- `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts` — focused guard tests.

### Modify

- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png` — replace production original with tiny fixture-only source after release proof.
- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png` — replace production original with tiny fixture-only source after release proof.
- `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png` — replace production original with tiny fixture-only source after release proof.
- `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png` — replace production original with tiny fixture-only source after release proof.
- `apps/web/package.json` — expose `verify:asset-footprint`.
- `.github/workflows/build-and-lint.yml` — run the footprint guard in credential-free CI.
- Existing generated HPA-228 local fixture pointer/manifest/object files under `apps/web/public/assets/vn/` — regenerate from downsized sources.

### Delete after production proof

- Every other file under `packages/assets/media/the_seventh_mirror/**`.
- Any stale local fixture object under `apps/web/public/assets/vn/` not referenced by the regenerated HPA-228 preview manifest.

---

### Task 1: Add the complete production release plan and structural coverage test

**Files:**
- Create: `packages/stories/release-plans/the_seventh_mirror.json`
- Create: `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`

**Interfaces:**
- Consumes: `packages/stories/src/generated/theSeventhMirror/image-assets.json`, `parseStoryAssetReleasePlan()`, `qualifyAssetIdentity()`.
- Produces: one HPA-227-compatible `StoryAssetReleasePlanV1` with exact compiler-key coverage and stable source paths for later private-source restore/publishing.

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

- [ ] **Step 2: Run the test and confirm it fails because the production plan does not exist**

Run:

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: FAIL with `ENOENT` for `release-plans/the_seventh_mirror.json`.

- [ ] **Step 3: Scaffold the production release plan from the compiler inventory and current source availability**

Run from the repository root while the production source files are still present:

```bash
mkdir -p packages/stories/release-plans
bun -e '
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const catalogPath = "packages/stories/src/generated/theSeventhMirror/image-assets.json";
const outputPath = "packages/stories/release-plans/the_seventh_mirror.json";
const catalog = await Bun.file(catalogPath).json();
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
  outputPath,
  `${JSON.stringify({
    schemaVersion: 1,
    storyId: "the_seventh_mirror",
    channel: "production",
    entries,
  }, null, 2)}\n`
);
'
```

Review every `omitted` entry and any deliberately excluded artwork. Do not commit the scaffold command as a reusable generator.

- [ ] **Step 4: Run the structural test**

Run:

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: PASS.

- [ ] **Step 5: Run the real publisher plan against the original source tree**

Run:

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

Inspect `.tmp/hpa-231-plan.json` and require:

- `status` is `success` or `no-op`;
- `coverage.totals.unclassified === 0`;
- `counts.included + counts.omitted` equals the generated identity count;
- there are no input/source/encoding errors.

- [ ] **Step 6: Commit the production classification**

```bash
git add \
  packages/stories/release-plans/the_seventh_mirror.json \
  packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts
git commit -m "feat: classify Seventh Mirror production assets"
```

---

### Task 2: Archive and restore the current authoring sources once

**Files:**
- Create: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: current `packages/assets/media/the_seventh_mirror/**`, generated `image-assets.json`, production release plan, existing private `aquila-vn-source` bucket.
- Produces: immutable private archive prefix and a documented restore procedure that reconstructs a valid publisher `--source-root`.

- [ ] **Step 1: Start the migration runbook with immutable identifiers and credential rules**

Create `docs/infrastructure/the-seventh-mirror-r2-migration.md` with these fixed values and commands:

```markdown
# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

Private source sync uses an operator-only R2 Access Key ID / Secret Access Key
scoped to `aquila-vn-source`. Never commit or expose those values and never reuse
`R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` for source archival.
```

- [ ] **Step 2: Build the immutable local archive directory**

Run:

```bash
COMMIT_SHA=$(git rev-parse --short=12 HEAD)
UTC_DATE=$(date -u +%Y-%m-%d)
ARCHIVE_ID="${UTC_DATE}-${COMMIT_SHA}"
ARCHIVE_ROOT=".tmp/hpa-231-source-archive"

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

- [ ] **Step 3: Upload the archive to the private R2 source bucket**

Configure the AWS CLI with the source-bucket-scoped R2 S3 credentials in the shell, then run:

```bash
export AWS_DEFAULT_REGION=auto
R2_ENDPOINT="https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com"
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"

aws s3 sync "$ARCHIVE_ROOT/" "$R2_PREFIX" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
```

Do not use `--delete`.

- [ ] **Step 4: Restore into an empty directory and verify checksums**

Run:

```bash
RESTORE_ROOT=".tmp/hpa-231-restored"
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

- [ ] **Step 5: Prove the restored source root produces the same publication identity**

Run:

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
if (original.releaseId !== restored.releaseId) {
  throw new Error(`releaseId mismatch: ${original.releaseId} != ${restored.releaseId}`);
}
if (original.manifestSha256 !== restored.manifestSha256) {
  throw new Error(`manifestSha256 mismatch: ${original.manifestSha256} != ${restored.manifestSha256}`);
}
console.log(`${restored.releaseId} ${restored.manifestSha256}`);
'
```

Expected: exit `0` and matching release ID/checksum.

- [ ] **Step 6: Add the exact archive/restore commands and `ARCHIVE_ID` to the runbook**

The runbook must state that future republishing restores the archive and passes `--source-root <restore>/media`; it must not imply production originals remain in Git.

- [ ] **Step 7: Commit the archival runbook**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: add Seventh Mirror source restore runbook"
```

---

### Task 3: Publish the immutable production candidate and qualify it in preview

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: production release plan, original/restored source root, HPA-230 publisher, HPA-233 Visual Novel Release Gate.
- Produces: retained primary `RELEASE_ID`, `MANIFEST_SHA256`, passing automated preview gate, and a concise manual visual-review result.

- [ ] **Step 1: Publish without activating production**

Run:

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

- [ ] **Step 2: Derive identifiers only from the retained JSON report**

Run:

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

- [ ] **Step 3: Deep-verify the stored production candidate before the preview gate**

Run:

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

- [ ] **Step 4: Configure an isolated preview deployment**

Use one preview id such as `hpa-231-gate` with:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Deploy the preview and retain its HTTPS origin.

- [ ] **Step 5: Run the existing Visual Novel Release Gate workflow**

Trigger `.github/workflows/visual-novel-release-gate.yml` with:

```text
story=the_seventh_mirror
release_id=$RELEASE_ID
manifest_sha256=$MANIFEST_SHA256
preview_id=hpa-231-gate
preview_url=<the deployed preview HTTPS origin>
```

Expected: storage deep verify, mirror-preview, preview activation, public CDN verify, and deployed browser spec all report PASS.

- [ ] **Step 6: Perform the manual visual review**

Review early, middle, and late scenes on desktop and mobile. Check:

```text
[ ] background change
[ ] portrait/expression change
[ ] intentional missing/omitted fallback
[ ] one choice path where available
[ ] desktop presentation
[ ] mobile presentation
[ ] text -> visual -> text preserves the exact active line
```

Record the result as one concise HPA-231 Linear comment. Do not add a review schema or screenshot pipeline.

- [ ] **Step 7: Update the runbook with the primary release ID, manifest checksum, preview id, and release-gate run URL/result**

- [ ] **Step 8: Commit the retained candidate metadata in documentation**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror candidate qualification"
```

---

### Task 4: Activate production and prove the live reader

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: qualified primary `RELEASE_ID` / `MANIFEST_SHA256`.
- Produces: production pointer on the exact candidate and passing public/browser smoke evidence.

- [ ] **Step 1: Activate the qualified production candidate**

Run:

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

Expected: pointer changed to `$RELEASE_ID` or a safe `no-op` if already active.

- [ ] **Step 2: Verify the active production CDN path**

Run:

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json > .tmp/hpa-231-production-public-verify.json
```

Expected: PASS while reading the active production `current.json` pointer.

- [ ] **Step 3: Run the deployed production reader release-gate spec**

Run:

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: Desktop Chromium and Mobile Chromium pass with the exact release identity and preserved reader line across text/visual switches.

- [ ] **Step 4: Update and commit production smoke results**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror production activation"
```

---

### Task 5: Prove pointer-only production rollback and reactivation

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: primary verified production release plus either a previous verified full-story release or a controlled second release.
- Produces: two verified release IDs/checksums and successful production rollback/reactivation without re-encoding during pointer moves.

- [ ] **Step 1: List deep-verified production releases**

Run:

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-production-releases.json
```

If a previous full-story release exists whose manifest identity set matches the checked-in production plan, use it as `ROLLBACK_RELEASE_ID` / `ROLLBACK_MANIFEST_SHA256` and skip Steps 2-6.

- [ ] **Step 2: If no previous valid full-story release exists, create a temporary second source root**

Run:

```bash
REVISION_SOURCE_ROOT=".tmp/hpa-231-revision-source"
rm -rf "$REVISION_SOURCE_ROOT"
cp -R packages/assets/media "$REVISION_SOURCE_ROOT"
```

- [ ] **Step 3: Make one deterministic, visually tiny revision to the selected background while preserving dimensions**

Run:

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";
const path = ".tmp/hpa-231-revision-source/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png";
const temporary = `${path}.hpa-231.tmp.png`;
await sharp(path)
  .modulate({ brightness: 1.01 })
  .png({ compressionLevel: 9 })
  .toFile(temporary);
await rename(temporary, path);
'
```

Open this scene locally and confirm the 1% brightness change is acceptable and dimensions are unchanged.

- [ ] **Step 4: Publish and deep-verify the controlled second candidate without activation**

Run:

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root "$REVISION_SOURCE_ROOT" \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-revision-publish.json

SECOND_RELEASE_ID=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-revision-publish.json").json();
console.log(report.releaseId);
')
SECOND_MANIFEST_SHA256=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-revision-publish.json").json();
console.log(report.manifestSha256);
')

bun --filter @aquila/infra-cloudflare assets -- verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$SECOND_RELEASE_ID" \
  --expect-manifest-sha256 "$SECOND_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-revision-verify.json
```

Require `SECOND_RELEASE_ID != RELEASE_ID`.

- [ ] **Step 5: Archive the controlled source delta privately**

Create a tiny delta archive that records the base archive ID plus only the revised source:

```bash
REVISION_ARCHIVE_ID="${ARCHIVE_ID}-revision-2"
REVISION_ARCHIVE_ROOT=".tmp/hpa-231-revision-archive"
REVISED_RELATIVE="the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png"

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

Document that reproducing release 2 means restoring `$ARCHIVE_ID` first, then overlaying `$REVISION_ARCHIVE_ID` onto the restore root.

- [ ] **Step 6: Qualify the second candidate through the existing preview release gate**

Use preview id `hpa-231-rollback-proof` with the same HPA-233 workflow and the second release ID/checksum. Require all automated gate steps plus a quick visual check of `chapter_1/ch1_act2_s1` to pass.

- [ ] **Step 7: Activate the second release and verify production**

Run:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SECOND_RELEASE_ID" \
  --expect-manifest-sha256 "$SECOND_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-second-activate.json
```

Then run the Task 4 public verifier and deployed browser spec with the second release identifiers.

- [ ] **Step 8: Roll back by changing only the production pointer**

Set the rollback target to the first verified release when using the controlled-revision path:

```bash
ROLLBACK_RELEASE_ID="$RELEASE_ID"
ROLLBACK_MANIFEST_SHA256="$MANIFEST_SHA256"

bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-rollback.json
```

Verify production again with the rollback identifiers using the public verifier and deployed release-gate browser spec.

- [ ] **Step 9: Reactivate the second verified release**

Run:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SECOND_RELEASE_ID" \
  --expect-manifest-sha256 "$SECOND_MANIFEST_SHA256" \
  --reactivate \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-reactivate.json
```

Run the public verifier and deployed release-gate browser spec again with the second release identifiers.

- [ ] **Step 10: Record and commit both verified releases and rollback/reactivation results**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror rollback proof"
```

---

### Task 6: Remove production binaries and regenerate tiny local fixtures

**Files:**
- Modify: four fixture source PNGs listed in File Structure.
- Delete: all other `packages/assets/media/the_seventh_mirror/**` files.
- Modify/Delete/Create as generated: `apps/web/public/assets/vn/**` HPA-228 preview fixture pointer/manifest/objects.

**Interfaces:**
- Consumes: successful Task 5 release proof and existing `apps/web/scripts/build-visual-fixtures.ts`.
- Produces: a clean checkout with only tiny local source fixtures and a consistent local HPA-228 runtime fixture graph.

- [ ] **Step 1: Assert the migration checkpoint before deleting anything**

Do not continue unless the runbook contains:

- active production release ID/checksum;
- successful production public/browser smoke;
- successful rollback target ID/checksum;
- successful reactivation result;
- private source archive ID and verified restore procedure.

- [ ] **Step 2: Downsize the four retained fixture inputs in place**

Run:

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

- [ ] **Step 3: Delete every other The Seventh Mirror authoring binary**

Run:

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
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
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

- [ ] **Step 4: Rebuild the local visual fixture release**

Run:

```bash
bun --filter web build:visual-fixtures
bun --filter web verify:visual-fixtures
```

Expected: both exit `0`.

- [ ] **Step 5: Remove stale local VN object files not referenced by the regenerated pointer/manifest**

Use the footprint script introduced in Task 7 rather than hand-maintaining hashes; if Task 7 is implemented immediately after this task, leave stale object deletion for Task 7 Step 5.

- [ ] **Step 6: Commit only after fixture verification passes**

```bash
git add packages/assets/media/the_seventh_mirror apps/web/public/assets/vn
git commit -m "chore: remove Seventh Mirror production binaries"
```

---

### Task 7: Add the narrow visual-asset footprint guard

**Files:**
- Create: `apps/web/scripts/assert-visual-asset-footprint.ts`
- Create: `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/build-and-lint.yml`

**Interfaces:**
- Consumes: committed four source fixture paths, existing HPA-228 `current.json`, referenced runtime manifest and object paths.
- Produces: credential-free CI failure if production-sized The Seventh Mirror binaries or unreferenced local VN runtime files return.

- [ ] **Step 1: Write focused failing tests**

Create `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts` around an exported function that accepts test roots:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { assertVisualAssetFootprint } from '../assert-visual-asset-footprint';

const created: string[] = [];

async function tempRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-asset-footprint-'));
    created.push(root);
    return root;
}

afterEach(async () => {
    await Promise.all(created.splice(0).map(path => rm(path, { recursive: true })));
});

describe('assertVisualAssetFootprint', () => {
    it('rejects an unexpected Seventh Mirror source file', async () => {
        const root = await tempRoot();
        const mediaRoot = join(root, 'media');
        const publicRoot = join(root, 'public');
        await mkdir(join(mediaRoot, 'the_seventh_mirror/extra'), { recursive: true });
        await writeFile(join(mediaRoot, 'the_seventh_mirror/extra/full.png'), Buffer.alloc(16));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/unexpected Seventh Mirror fixture source/i);
    });

    it('rejects an oversized approved fixture source', async () => {
        const root = await tempRoot();
        const mediaRoot = join(root, 'media');
        const publicRoot = join(root, 'public');
        const path = join(
            mediaRoot,
            'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png'
        );
        await mkdir(join(path, '..'), { recursive: true });
        await writeFile(path, Buffer.alloc(600 * 1024));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/fixture source exceeds/i);
    });

    it('rejects an unreferenced committed VN object', async () => {
        const root = await tempRoot();
        const mediaRoot = join(root, 'media');
        const publicRoot = join(root, 'public');
        await mkdir(join(publicRoot, 'vn/objects'), { recursive: true });
        await writeFile(join(publicRoot, 'vn/objects/orphan.webp'), Buffer.from('orphan'));

        await expect(
            assertVisualAssetFootprint({ mediaRoot, publicRoot })
        ).rejects.toThrow(/unreferenced local VN file/i);
    });
});
```

Adjust helper setup in the final test file so each test creates the minimum valid four fixture sources and valid pointer/manifest graph before injecting the one invalid condition. Do not mock the production filesystem traversal logic.

- [ ] **Step 2: Run the focused test and verify it fails because the guard does not exist**

Run:

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: FAIL with module-not-found for `assert-visual-asset-footprint`.

- [ ] **Step 3: Implement the minimal story-specific guard**

Create `apps/web/scripts/assert-visual-asset-footprint.ts` with these fixed policies:

```ts
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
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

function normalize(root: string, path: string): string {
    return relative(root, path).split('\\').join('/');
}

export async function assertVisualAssetFootprint(options?: {
    mediaRoot?: string;
    publicRoot?: string;
}): Promise<void> {
    const mediaRoot = options?.mediaRoot ?? resolve(process.cwd(), '../../packages/assets/media');
    const publicRoot = options?.publicRoot ?? resolve(process.cwd(), 'public/assets');
    const problems: string[] = [];

    const storyRoot = resolve(mediaRoot, 'the_seventh_mirror');
    const sourceFiles = await walkFiles(storyRoot);
    let fixtureTotal = 0;
    for (const path of sourceFiles) {
        const rel = normalize(mediaRoot, path);
        if (!APPROVED_FIXTURE_SOURCES.has(rel)) {
            problems.push(`unexpected Seventh Mirror fixture source: ${rel}`);
            continue;
        }
        const size = (await stat(path)).size;
        fixtureTotal += size;
        if (size > MAX_FIXTURE_FILE_BYTES) {
            problems.push(`fixture source exceeds ${MAX_FIXTURE_FILE_BYTES} bytes: ${rel}`);
        }
    }
    for (const rel of APPROVED_FIXTURE_SOURCES) {
        if (!sourceFiles.some(path => normalize(mediaRoot, path) === rel)) {
            problems.push(`approved fixture source missing: ${rel}`);
        }
    }
    if (fixtureTotal > MAX_FIXTURE_TOTAL_BYTES) {
        problems.push(`fixture sources exceed ${MAX_FIXTURE_TOTAL_BYTES} bytes combined`);
    }

    const pointerRel = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
    const pointer = parseActiveReleasePointer(
        JSON.parse(await readFile(resolve(publicRoot, pointerRel), 'utf8')),
        PREVIEW_TARGET,
        STORY_ID
    );
    const manifest = parseRuntimeAssetManifest(
        JSON.parse(await readFile(resolve(publicRoot, pointer.manifestPath), 'utf8'))
    );
    const allowedRuntime = new Set<string>([pointerRel, pointer.manifestPath]);
    for (const asset of manifest.assets) {
        allowedRuntime.add(asset.variants.webp.path);
        if (asset.variants.avif) allowedRuntime.add(asset.variants.avif.path);
        if (asset.placeholder) allowedRuntime.add(asset.placeholder.path);
    }

    for (const path of await walkFiles(resolve(publicRoot, 'vn'))) {
        const rel = normalize(publicRoot, path);
        if (!allowedRuntime.has(rel)) {
            problems.push(`unreferenced local VN file: ${rel}`);
        }
    }

    if (problems.length > 0) {
        throw new Error(`Visual asset footprint check failed:\n${problems.join('\n')}`);
    }
}

if (import.meta.main) {
    await assertVisualAssetFootprint();
}
```

- [ ] **Step 4: Run the focused test suite and fix only guard/test defects**

Run:

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the guard against the real repository and delete every reported stale local object**

Run:

```bash
bun --cwd apps/web scripts/assert-visual-asset-footprint.ts
```

If the only failures are stale unreferenced files under `apps/web/public/assets/vn/`, delete those exact files and rerun until PASS. Do not relax the allowlist to keep stale binaries.

- [ ] **Step 6: Add the package script**

Modify `apps/web/package.json` scripts:

```json
"verify:asset-footprint": "bun scripts/assert-visual-asset-footprint.ts"
```

- [ ] **Step 7: Add the credential-free CI step**

Modify `.github/workflows/build-and-lint.yml` after generated-story verification and before unit/build work:

```yaml
      - name: Verify visual asset footprint
        run: bun --filter web verify:asset-footprint
```

- [ ] **Step 8: Run focused verification**

```bash
bun --filter web verify:visual-fixtures
bun --filter web verify:asset-footprint
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: all PASS.

- [ ] **Step 9: Commit the cleanup guard**

```bash
git add \
  apps/web/scripts/assert-visual-asset-footprint.ts \
  apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts \
  apps/web/package.json \
  .github/workflows/build-and-lint.yml \
  apps/web/public/assets/vn
git commit -m "ci: guard Seventh Mirror asset footprint"
```

---

### Task 8: Run final repository verification and close the migration checklist

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`
- No runtime code changes expected.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final clean checkout proof, concise HPA-231 evidence comment, HPA-231 Done, then parent HPA-216 Done/closed.

- [ ] **Step 1: Run the complete credential-free verification set**

Run:

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

- [ ] **Step 2: Prove a clean checkout no longer contains production-sized The Seventh Mirror media**

Run:

```bash
find packages/assets/media/the_seventh_mirror -type f -print | sort
find apps/web/public/assets/vn -type f -print | sort
bun --filter web verify:asset-footprint
```

Expected: exactly four approved source fixture paths plus only the active local fixture pointer/manifest/referenced runtime objects.

- [ ] **Step 3: Prove republishing starts from the private archive, not Git**

From a clean checkout, restore the base archive into `.tmp/hpa-231-final-restore`, verify `SHA256SUMS`, then run:

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

Expected: the base archived release identity matches the retained primary release report. If the controlled revision became the final active release, overlay its revision archive before running the same check against the second release ID/checksum.

- [ ] **Step 4: Add the final results to the migration runbook**

The final section must include concrete values for:

```text
Source archive ID:
Primary release ID:
Primary manifest SHA-256:
Second/rollback-proof release ID:
Second manifest SHA-256:
Preview gate result:
Manual visual review result:
Production smoke result:
Rollback result:
Reactivation result:
Final active production release:
Final credential-free verification result:
```

Do not create another evidence schema; plain Markdown is sufficient.

- [ ] **Step 5: Commit the final runbook state**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: finalize Seventh Mirror R2 migration"
```

- [ ] **Step 6: Add one concise HPA-231 Linear completion comment**

Use this shape with the actual retained values:

```markdown
HPA-231 production migration complete.

- Source archive: `authoring/the_seventh_mirror/<archive-id>/` — restore checksum and publisher-plan reproduction passed.
- Active production release: `<release-id>` / manifest `<sha256>`.
- Preview gate: PASS on desktop + mobile.
- Manual early/middle/late visual review: PASS, including expression change, fallback, and choice path.
- Production public verifier + deployed reader smoke: PASS.
- Pointer-only rollback: `<release-b>` -> `<release-a>` PASS.
- Reactivation: `<release-a>` -> `<release-b>` PASS.
- Git/Vercel cleanup: production-sized The Seventh Mirror binaries removed; four tiny local fixtures retained.
- `verify:asset-footprint`, stories/web/infra tests, lint, compile check, and build: PASS.
```

- [ ] **Step 7: Move HPA-231 to Done, then close parent HPA-216**

Do this only after every acceptance criterion above is evidenced. HPA-216 must not be closed before HPA-231 is complete.

---

## Self-Review Checklist

Before implementation begins, verify this plan against HPA-231:

- [ ] Every compiler authoring key is explicitly included or omitted.
- [ ] Publisher source existence is checked before cleanup; CI structural coverage remains valid after cleanup.
- [ ] Original images plus generation metadata are archived privately with checksums and a restore procedure.
- [ ] Candidate publication uses HPA-230 `--no-activate` and retains exact report identifiers.
- [ ] Preview qualification delegates entirely to HPA-233 plus one manual review.
- [ ] Production activation and smoke use existing commands only.
- [ ] Rollback/reactivation is pointer-only and uses two verified releases; the first-release case has a deterministic controlled revision path.
- [ ] Repository cleanup waits until rollback/reactivation proof passes.
- [ ] Only four tiny existing fixture paths remain in the authoring tree.
- [ ] The footprint guard is narrow and story-specific rather than a generalized binary framework.
- [ ] Clean-checkout tests/local fixtures still work and private-source restore is the documented republish path.
- [ ] No new schema/version/storage/runtime/release framework is introduced.
