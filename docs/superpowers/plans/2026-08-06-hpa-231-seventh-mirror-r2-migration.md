# HPA-231 The Seventh Mirror R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish The Seventh Mirror as Aquila's first production R2-backed visual-novel release, prove preview/production/rollback behavior, archive the authoring originals privately, then remove production-sized story binaries from Git/Vercel while preserving tiny local fixtures.

**Architecture:** Reuse HPA-227 runtime contracts, HPA-228 local fixtures, HPA-229 R2 delivery plus documented Vercel source configuration, HPA-230 immutable publisher, HPA-233 preview release gate, and HPA-234 reader state. HPA-231 adds only story-specific release classification, a one-time private archive/restore runbook, one structural release-plan test, repository cleanup, and one story-specific footprint guard. Missing artwork is explicitly omitted for v1 rather than silently treated as a complete illustrated story.

**Tech Stack:** Bun 1.3.1, TypeScript, Vitest, Sharp, existing `@aquila/stories/runtime-assets`, existing `@aquila/infra-cloudflare` publisher, GitHub Actions, Cloudflare R2 S3-compatible API, AWS CLI for one-time private-source sync, Vercel production configuration, Playwright release gate.

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
- Production cleanup is forbidden until production activation, smoke verification, rollback/activation-back proof, and final restoration of the intended primary release all pass.
- Public runtime manifests/object metadata must not expose prompts, source paths, provider metadata, private bucket identifiers, or credentials.
- Existing delivery-publisher credentials remain delivery-only. Private-source archive credentials are operator-only and never committed.
- Missing v1 artwork is allowed and must be explicitly omitted; producing missing artwork is not part of HPA-231.

---

## File Structure

### Create

- `packages/stories/release-plans/the_seventh_mirror.json` — complete production classification of compiler-generated visual keys.
- `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts` — structural coverage test that still passes after production source binaries leave Git.
- `docs/infrastructure/the-seventh-mirror-r2-migration.md` — archive/restore/publish/env/activate/rollback commands plus retained release evidence.
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

### Delete after live proof

- Every other file under `packages/assets/media/the_seventh_mirror/**`.
- Any stale local VN object under `apps/web/public/assets/vn/` not referenced by the regenerated HPA-228 pointer/manifest.

---

### Task 1: Define and freeze the v1 production release classification

**Files:**
- Create: `packages/stories/release-plans/the_seventh_mirror.json`
- Create: `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`

**Interfaces:**
- Consumes: `packages/stories/src/generated/theSeventhMirror/image-assets.json`, `parseStoryAssetReleasePlan()`, `qualifyAssetIdentity()`.
- Produces: one HPA-227-compatible production release plan with exact compiler-key coverage, reviewed include/omit counts, and stable source paths for every included asset.

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

// Deliberate failing sentinel. Task 1 Step 5 replaces it with the reviewed
// migration-time included count before this test is committed.
const EXPECTED_INCLUDED_COUNT = -1;

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
    it('classifies every generated visual identity with reviewed v1 coverage', async () => {
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

        const includedCount = plan.entries.filter(
            entry => entry.disposition === 'included'
        ).length;
        expect(includedCount).toBe(EXPECTED_INCLUDED_COUNT);
    });
});
```

- [ ] **Step 2: Run the test and verify the production plan is missing**

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: FAIL because `release-plans/the_seventh_mirror.json` does not exist.

- [ ] **Step 3: Scaffold the complete production plan using the explicit v1 inclusion rule**

The default v1 rule is:

- source exists at archive time → `included`;
- source missing → `omitted` with reason `Authoring art not produced for HPA-231 v1`.

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
          reason: "Authoring art not produced for HPA-231 v1",
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

Do not commit the scaffold command as a reusable generator.

- [ ] **Step 4: Print and review the exact v1 classification before freezing it**

```bash
bun -e '
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const plan = await Bun.file(
  "packages/stories/release-plans/the_seventh_mirror.json"
).json();
const sourceRoot = resolve("packages/assets/media");
const included = plan.entries.filter((entry) => entry.disposition === "included");
const omitted = plan.entries.filter((entry) => entry.disposition === "omitted");
const omittedDespiteExistingSource = omitted.filter((entry) => {
  const generated = [
    ...(plan.entries ?? []),
  ];
  return typeof entry.sourcePath === "string" && existsSync(resolve(sourceRoot, entry.sourcePath));
});

console.log(`included=${included.length}`);
console.log(`omitted=${omitted.length}`);
console.log(`total=${plan.entries.length}`);
console.log(`omittedDespiteExistingSource=${omittedDespiteExistingSource.length}`);
for (const entry of omitted.slice(0, 20)) {
  console.log(`omit ${entry.identity.type}:${entry.identity.key} — ${entry.reason}`);
}
'
```

Because omitted plan entries correctly have no `sourcePath`, the `omittedDespiteExistingSource` diagnostic above remains zero for the scaffold. If an existing source is intentionally omitted during manual review, verify the corresponding compiler path directly before replacing its reason with a specific explanation.

Review requirements:

- the counts are plausible for the current checkout;
- every missing-source omission uses the shared v1 reason;
- any existing source deliberately changed to `omitted` has a specific reason;
- no missing artwork is created as part of HPA-231.

Record the reviewed included/omitted counts in `docs/infrastructure/the-seventh-mirror-r2-migration.md` when Task 2 creates it.

- [ ] **Step 5: Freeze the reviewed included count into the structural test**

Run this after any intentional plan edits from Step 4:

```bash
bun -e '
const planPath = "packages/stories/release-plans/the_seventh_mirror.json";
const testPath = "packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts";
const plan = await Bun.file(planPath).json();
const included = plan.entries.filter((entry) => entry.disposition === "included").length;
const current = await Bun.file(testPath).text();
const sentinel = "const EXPECTED_INCLUDED_COUNT = -1;";
if (!current.includes(sentinel)) {
  throw new Error("expected included-count sentinel is missing");
}
await Bun.write(
  testPath,
  current.replace(sentinel, `const EXPECTED_INCLUDED_COUNT = ${included};`)
);
console.log(`froze EXPECTED_INCLUDED_COUNT=${included}`);
'
```

- [ ] **Step 6: Run the structural test**

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: PASS.

- [ ] **Step 7: Run the real HPA-230 plan against the original source tree**

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

Require:

- `coverage.totals.unclassified === 0`;
- report included/omitted counts equal the reviewed plan counts;
- there are no input/source/encoding errors;
- the report contains `releaseId` and `manifestSha256`.

- [ ] **Step 8: Commit the production classification**

```bash
git add \
  packages/stories/release-plans/the_seventh_mirror.json \
  packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts
git commit -m "feat: classify Seventh Mirror production assets"
```

---

### Task 2: Archive and restore the v1 authoring snapshot once

**Files:**
- Create: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: current `packages/assets/media/the_seventh_mirror/**`, generated `image-assets.json`, production release plan, private `aquila-vn-source` bucket.
- Produces: immutable private migration snapshot and a documented restore procedure that reconstructs a valid publisher source root.

- [ ] **Step 1: Create the migration runbook and state the snapshot boundary explicitly**

Create `docs/infrastructure/the-seventh-mirror-r2-migration.md`:

```markdown
# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

The base archive is the HPA-231 v1 migration snapshot of the source art that
exists in Git at migration time. It is not a claim that every generated story
key has artwork. Missing generated keys remain explicit release-plan omissions.
Future newly produced art requires a new immutable archive prefix (or a
specifically documented overlay) plus a release-plan amendment; HPA-231 does not
provide an automatic sync service.

Private source sync uses an operator-only R2 Access Key ID / Secret Access Key
scoped to `aquila-vn-source`. Never commit or print those values. The delivery
publisher credentials remain scoped to `aquila-vn-delivery`.
```

Append the reviewed Task 1 `included`, `omitted`, and `total` counts.

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

- [ ] **Step 6: Record the concrete archive identity and restore command in the runbook**

Record:

- `ARCHIVE_ID`;
- full private prefix without credentials;
- checksum verification result;
- restored release ID and manifest checksum;
- `--source-root <restore>/media` as the republishing path.

- [ ] **Step 7: Commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: add Seventh Mirror source restore runbook"
```

---

### Task 3: Publish the primary candidate and qualify it through HPA-233

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: production release plan, original/restored source root, HPA-230 publisher, HPA-233 release gate.
- Produces: retained primary release ID/checksum plus automated and manual preview approval.

- [ ] **Step 1: Publish without production activation**

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

- [ ] **Step 3: Deep-verify the stored primary candidate**

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

- [ ] **Step 4: Deploy an isolated preview that resolves the HPA-231 preview namespace**

Configure the preview deployment:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Use the resulting HTTPS deployment origin as the HPA-233 `preview_url` input.

- [ ] **Step 5: Trigger the existing Visual Novel Release Gate**

Use workflow inputs:

```text
story=the_seventh_mirror
release_id=<RELEASE_ID from .tmp/hpa-231-publish.json>
manifest_sha256=<MANIFEST_SHA256 from .tmp/hpa-231-publish.json>
preview_id=hpa-231-gate
preview_url=<HTTPS preview deployment produced in Step 4>
```

Expected: storage deep verify, mirror-preview, preview activation, public CDN verify, and deployed browser spec all PASS.

- [ ] **Step 6: Perform one manual representative visual review scoped to the v1 ship set**

Visit representative early, middle, and late story positions and record:

```text
[ ] at least one included background transition renders correctly
[ ] at least one included portrait/expression transition renders correctly when available
[ ] at least one omitted/missing asset uses the expected fallback without blocking progression
[ ] one choice path works where available
[ ] desktop presentation is acceptable
[ ] mobile presentation is acceptable
[ ] text -> visual -> text preserves the exact active line
[ ] any middle/late position without included art is recorded as expected fallback, not treated as a migration defect
```

- [ ] **Step 7: Record primary candidate evidence in the runbook**

Record release ID/checksum, include/omit counts, preview ID, workflow run URL/number, preview deployment, and manual review result.

- [ ] **Step 8: Commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror candidate qualification"
```

---

### Task 4: Wire the production reader to R2 once, then activate and smoke-test

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: qualified primary release ID/checksum and HPA-229 production asset-source contract.
- Produces: production deployment that resolves remote production R2 assets plus an active, smoke-tested primary pointer.

- [ ] **Step 1: Configure the Vercel Production environment before pointer activation**

In the Aquila Vercel project, set exactly:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=production
```

Ensure this variable is **not** set for Production:

```text
PUBLIC_ASSET_PREVIEW_ID
```

Do not change Development defaults; local development intentionally uses bundled fixtures.

- [ ] **Step 2: Redeploy production once for the build-time public environment change**

Create one production deployment containing the configuration from Step 1. This is the only Vercel rebuild introduced by HPA-231 and is a prerequisite configuration deployment, not an asset release deployment.

- [ ] **Step 3: Prove the deployed reader is routing to the remote production pointer before activation**

Open The Seventh Mirror visual mode on the production deployment and inspect the browser Network panel.

Require a request whose URL begins:

```text
https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json
```

Require no request to:

```text
/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json
```

A 404 from the remote production pointer is acceptable before first activation; the checkpoint proves source routing.

Record the production deployment identity and network-preflight result in the runbook.

- [ ] **Step 4: Activate the primary release**

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

- [ ] **Step 5: Verify the active production CDN pointer/manifest/object chain**

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json > .tmp/hpa-231-production-public-verify.json
```

- [ ] **Step 6: Run the deployed production reader release-gate spec**

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: desktop/mobile flows pass with the exact production release identity and active line preserved across text/visual switches.

- [ ] **Step 7: Record the one-time env deployment plus production activation/smoke result and commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror production activation"
```

---

### Task 5: Select a compatible rollback peer and prove pointer-only rollback

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: active primary production release, checked-in production plan, existing release history/public immutable manifests.
- Produces: machine-validated rollback peer or one controlled synthetic peer; successful rollback, activation-back proof, and final restoration of the primary release.

- [ ] **Step 1: List production releases with deep verification**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-production-releases.json
```

- [ ] **Step 2: Machine-check previous releases against the exact HPA-231 production plan**

Run from repository root:

```bash
set +e
bun --cwd packages/infra-cloudflare -e '
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  getReleaseManifestPath,
  parseRuntimeAssetManifest,
  parseStoryAssetReleasePlan,
  validateRuntimeManifestCoverage,
} from "@aquila/stories/runtime-assets";

const repositoryRoot = "../..";
const report = JSON.parse(
  await readFile(`${repositoryRoot}/.tmp/hpa-231-production-releases.json`, "utf8")
);
const plan = parseStoryAssetReleasePlan(
  JSON.parse(
    await readFile(
      `${repositoryRoot}/packages/stories/release-plans/the_seventh_mirror.json`,
      "utf8"
    )
  )
);
const baseUrl = "https://assets.aquila.cwchanap.dev/";

for (const candidate of report.releases ?? []) {
  if (candidate.active) continue;
  if (candidate.deepVerified !== true) continue;
  if (typeof candidate.releaseId !== "string") continue;
  if (typeof candidate.manifestSha256 !== "string") continue;

  const manifestPath = getReleaseManifestPath(
    "the_seventh_mirror",
    candidate.releaseId,
    { kind: "production" }
  );
  const response = await fetch(new URL(manifestPath, baseUrl));
  if (!response.ok) continue;
  const text = await response.text();
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  if (sha256 !== candidate.manifestSha256) continue;

  let manifest;
  try {
    manifest = parseRuntimeAssetManifest(JSON.parse(text));
    validateRuntimeManifestCoverage(manifest, plan);
  } catch {
    continue;
  }
  if (manifest.releaseId !== candidate.releaseId) continue;

  await writeFile(
    `${repositoryRoot}/.tmp/hpa-231-rollback-peer.json`,
    `${JSON.stringify({
      releaseId: candidate.releaseId,
      manifestSha256: candidate.manifestSha256,
    })}\n`
  );
  console.log(`eligible rollback peer: ${candidate.releaseId}`);
  process.exit(0);
}

console.error("no eligible previous production release");
process.exit(2);
'
PEER_STATUS=$?
set -e
```

Interpretation:

- `PEER_STATUS=0`: use `.tmp/hpa-231-rollback-peer.json` in Step 3.
- `PEER_STATUS=2`: no previous release matches the current production plan; continue at Step 7 to create a synthetic peer.
- any other exit: stop and fix the concrete command/network/input failure.

This step is the definition of “same full-story release” for HPA-231: the peer must match the same production plan/included set; it does not mean every generated chapter has artwork.

- [ ] **Step 3: Load the machine-validated previous peer identifiers**

Only when `PEER_STATUS=0`:

```bash
ROLLBACK_RELEASE_ID=$(bun -e '
const value = await Bun.file(".tmp/hpa-231-rollback-peer.json").json();
console.log(value.releaseId);
')
ROLLBACK_MANIFEST_SHA256=$(bun -e '
const value = await Bun.file(".tmp/hpa-231-rollback-peer.json").json();
console.log(value.manifestSha256);
')
```

Keep the primary `$RELEASE_ID` and `$MANIFEST_SHA256` as the release to restore after rollback.

- [ ] **Step 4: Roll back to the compatible previous release**

Only when `PEER_STATUS=0`:

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

Run the production public verifier and deployed release-gate browser spec with the rollback identifiers. Both must pass.

- [ ] **Step 5: Activate the primary release again**

Only when `PEER_STATUS=0`:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-activate-back.json
```

Do not use `--reactivate`; the primary is inactive after rollback.

Run the production public verifier and deployed browser spec again with the primary identifiers. Both must pass.

- [ ] **Step 6: Record the previous-peer rollback proof and continue to Task 6**

Record both release IDs/checksums, the machine peer-selection result, rollback verification, and primary activation-back result. Skip Steps 7-14.

- [ ] **Step 7: If no compatible previous peer exists, create a temporary synthetic source root**

Only when `PEER_STATUS=2`:

```bash
SYNTHETIC_SOURCE_ROOT=.tmp/hpa-231-synthetic-source
rm -rf "$SYNTHETIC_SOURCE_ROOT"
cp -R packages/assets/media "$SYNTHETIC_SOURCE_ROOT"
```

- [ ] **Step 8: Make one deterministic tiny revision while preserving dimensions**

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";
const path = ".tmp/hpa-231-synthetic-source/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png";
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

Manually inspect the revised source image and confirm the 1% brightness change is acceptable for a temporary rollback peer.

- [ ] **Step 9: Publish and deep-verify the synthetic candidate without activation**

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root "$SYNTHETIC_SOURCE_ROOT" \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-synthetic-publish.json

SYNTHETIC_RELEASE_ID=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-synthetic-publish.json").json();
if (typeof report.releaseId !== "string") throw new Error("missing releaseId");
console.log(report.releaseId);
')
SYNTHETIC_MANIFEST_SHA256=$(bun -e '
const report = await Bun.file(".tmp/hpa-231-synthetic-publish.json").json();
if (typeof report.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(report.manifestSha256);
')

if [ "$SYNTHETIC_RELEASE_ID" = "$RELEASE_ID" ]; then
  echo "controlled revision did not create a second release" >&2
  exit 1
fi

bun --filter @aquila/infra-cloudflare assets -- verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-synthetic-verify.json
```

Do not run a second HPA-233 preview gate. This release is an operational rollback peer, not the intended final content.

- [ ] **Step 10: Activate the synthetic peer temporarily and production-smoke it**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-synthetic-activate.json
```

Run:

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json

BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$SYNTHETIC_RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$SYNTHETIC_MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Both must pass.

- [ ] **Step 11: Roll back from the synthetic peer to the fully qualified primary release**

```bash
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-synthetic-rollback-to-primary.json
```

Run the primary production public verifier and deployed browser spec. Both must pass.

- [ ] **Step 12: Activate the synthetic peer again to prove activation-back semantics**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-synthetic-activate-back.json
```

Run the synthetic production public verifier and deployed browser spec again. Both must pass.

- [ ] **Step 13: Restore the intended primary release as the final production state**

The synthetic peer exists only for pointer-operation proof. Restore the primary before cleanup:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-final-primary-activate.json
```

Run the primary production public verifier and deployed browser spec one final time. Both must pass.

- [ ] **Step 14: Record the synthetic-peer proof and commit the runbook update**

Record synthetic release ID/checksum, deep verification, temporary activation smoke, rollback to primary, activation-back proof, and final primary restoration. Do not add a synthetic-source archive or evidence schema.

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
- Consumes: successful Task 5 proof with the intended primary release active.
- Produces: clean checkout containing only four small source fixtures and a consistent local runtime fixture.

- [ ] **Step 1: Enforce the cleanup checkpoint before deletion**

Do not continue unless the runbook contains concrete values/results for:

- private archive restore;
- reviewed v1 include/omit counts;
- production R2 env/network preflight;
- primary production activation and public/browser smoke;
- rollback and activation-back proof;
- final confirmation that `$RELEASE_ID` / `$MANIFEST_SHA256` is active again.

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

Do not commit yet; Task 7 removes any stale local VN objects and adds the CI guard in the same cleanup commit.

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

- [ ] **Step 1: Write the failing guard tests**

Create `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts` with four cases:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    assertSha256,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
} from '@aquila/stories/runtime-assets';
import { assertVisualAssetFootprint } from '../assert-visual-asset-footprint';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;
const OBJECT_SHA = assertSha256<'object-content'>('a'.repeat(64));
const MANIFEST_SHA = 'b'.repeat(64);
const RELEASE_ID = `sha256-${'c'.repeat(64)}`;
const APPROVED = [
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
    'the_seventh_mirror/characters/asakura_mio/base.png',
    'the_seventh_mirror/characters/asakura_yuma/base.png',
+] as const;

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

    const objectPath = getObjectPath(OBJECT_SHA, 'webp');
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

    return { mediaRoot, publicRoot };
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

- [ ] **Step 2: Run the focused test and verify it fails because the guard module does not exist**

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

- [ ] **Step 3: Implement the minimal story-specific guard**

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

- [ ] **Step 4: Run the focused guard tests**

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

- [ ] **Step 3: Prove republishing starts from the private v1 archive rather than Git**

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

Expected: restored archive reproduces the retained primary release ID and manifest checksum.

- [ ] **Step 4: Re-run the active production identity check after repository cleanup**

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json

BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: production remains on the primary release; Git cleanup did not affect runtime delivery.

- [ ] **Step 5: Record concrete final evidence in the runbook**

Add actual values/results for:

- reviewed included/omitted/total counts;
- source archive ID and restore result;
- primary release ID/checksum;
- preview gate and manual review result;
- production Vercel asset-source environment and network preflight;
- production activation/smoke result;
- rollback peer selection result;
- rollback target ID/checksum or synthetic peer ID/checksum;
- activation-back result;
- final primary release identity;
- cleanup/footprint result;
- final credential-free verification result.

Plain Markdown only; do not add an evidence schema.

- [ ] **Step 6: Commit the final runbook**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: finalize Seventh Mirror R2 migration"
```

- [ ] **Step 7: Add one concise HPA-231 completion comment**

The comment must summarize the same concrete values from Step 5 and explicitly state that the private archive is a v1 migration snapshot, not a complete art set.

- [ ] **Step 8: Move HPA-231 to Done, then close HPA-216**

Only after all HPA-231 acceptance criteria are proven. HPA-216 must not be closed first.

---

## Self-Review Checklist

- [ ] Every compiler authoring key is explicitly included or omitted.
- [ ] The v1 inclusion rule is explicit; missing art cannot silently masquerade as a fully illustrated release.
- [ ] The reviewed included count is frozen in the structural test and counts are recorded in the runbook.
- [ ] CI structural coverage remains valid after production sources leave Git.
- [ ] Original v1 images plus generation metadata are privately archived, checksummed, and restorable.
- [ ] The archive is documented as a migration snapshot, not a complete story art set.
- [ ] Candidate publication uses HPA-230 `--no-activate` and retained exact report identifiers.
- [ ] The primary candidate delegates preview qualification to HPA-233 plus one concise manual review.
- [ ] Production Vercel `PUBLIC_ASSET_*` wiring is deployed once before pointer activation and remote-pointer routing is proven.
- [ ] After that one-time configuration deploy, asset activation does not require a Vercel rebuild.
- [ ] Rollback peer selection is executable and requires deep verification, exact manifest checksum, and `validateRuntimeManifestCoverage` against the current production plan.
- [ ] The first-release fallback creates only one controlled synthetic peer and does not run a redundant second preview gate.
- [ ] The intended primary release is restored before cleanup.
- [ ] Repository cleanup waits until production smoke and rollback/activation-back proof pass.
- [ ] Only four tiny existing fixture source paths remain in Git.
- [ ] The footprint guard remains narrow and story-specific rather than being merged into fixture-integrity verification.
- [ ] Clean-checkout tests/local fixtures work and private restore is the production republish path.
- [ ] No new schema/version/storage/runtime/release framework is introduced.
