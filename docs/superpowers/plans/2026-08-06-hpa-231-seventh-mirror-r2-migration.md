# HPA-231 The Seventh Mirror R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish The Seventh Mirror as Aquila's first production R2-backed visual-novel release, prove preview/production/rollback behavior, archive the authoring originals privately, then remove production-sized story binaries from Git/Vercel while preserving tiny local fixtures.

**Architecture:** Reuse HPA-227 runtime contracts, HPA-228 local fixtures, HPA-229 R2 delivery plus its documented Vercel asset-source configuration, HPA-230 immutable publisher, HPA-233 preview release gate, and HPA-234 reader state. HPA-231 adds only story-specific release classification, a one-time source archive/restore runbook, one structural release-plan test, repository cleanup, and one story-specific footprint guard. Missing artwork is an explicit v1 omission rather than an implicit migration failure.

**Tech Stack:** Bun 1.3.1, TypeScript, Vitest, Sharp, `@aquila/stories/runtime-assets`, `@aquila/infra-cloudflare`, GitHub Actions, Cloudflare R2 S3-compatible API, AWS CLI for one-time private-source sync, Vercel production configuration, Playwright release gate.

## Global Constraints

- This is a one-time migration and release checklist; do not redesign the runtime contract, reader, R2 infrastructure, publisher, or release gate.
- Do not add schema versions, backward-compatibility adapters, publisher command families, storage abstractions, automatic activation/rollback, evidence frameworks, or generic multi-story migration tooling.
- Do not build a generalized private-source synchronization service.
- Missing v1 artwork is allowed and must be explicitly omitted; producing missing artwork is not part of HPA-231.
- Production cleanup is forbidden until production routing, activation, smoke verification, rollback/activation-back proof, and final restoration of the intended primary release all pass.
- Public runtime data must remain prompt-free and must not expose source paths, provider metadata, private bucket identifiers, or credentials.
- Delivery publisher credentials remain delivery-only. Private-source archive credentials are operator-only and never committed.

---

## File Structure

### Create

- `packages/stories/release-plans/the_seventh_mirror.json`
- `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`
- `docs/infrastructure/the-seventh-mirror-r2-migration.md`
- `apps/web/scripts/assert-visual-asset-footprint.ts`
- `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`

### Modify

- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png`
- `apps/web/package.json`
- `.github/workflows/build-and-lint.yml`
- the generated HPA-228 local fixture release under `apps/web/public/assets/vn/`

### Delete after live proof

- Every other file under `packages/assets/media/the_seventh_mirror/**`.
- Any stale local VN object under `apps/web/public/assets/vn/` not referenced by the regenerated HPA-228 pointer/manifest.

---

### Task 1: Define and freeze the v1 production classification

**Files:**
- Create: `packages/stories/release-plans/the_seventh_mirror.json`
- Create: `packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts`

**Interfaces:**
- Consumes: compiler-generated `image-assets.json`, `parseStoryAssetReleasePlan()`, `qualifyAssetIdentity()`.
- Produces: complete production classification with a reviewed included count and exact source paths for included identities.

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

// Deliberate failing sentinel. Step 5 replaces this with the reviewed count.
const EXPECTED_INCLUDED_COUNT = -1;

type GeneratedEntry = { key: string; path: string };
type GeneratedAssets = {
    storyId: string;
    backgrounds: GeneratedEntry[];
    portraits: GeneratedEntry[];
};

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8'));
}

describe('The Seventh Mirror production release plan', () => {
    it('classifies every generated identity with the reviewed v1 ship set', async () => {
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

        expect(generated.storyId).toBe('the_seventh_mirror');
        expect(plan.storyId).toBe('the_seventh_mirror');
        expect(plan.channel).toBe('production');

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

        expect(
            plan.entries.filter(entry => entry.disposition === 'included')
                .length
        ).toBe(EXPECTED_INCLUDED_COUNT);
    });
});
```

- [ ] **Step 2: Run the test and confirm the production plan is the missing input**

```bash
bun --filter @aquila/stories test -- the-seventh-mirror-release-plan
```

Expected: FAIL because `packages/stories/release-plans/the_seventh_mirror.json` does not exist.

- [ ] **Step 3: Scaffold every generated identity with the explicit v1 rule**

The default classification is:

- generated source path exists at archive time → `included`;
- source path is absent → `omitted` with reason `Authoring art not produced for HPA-231 v1`.

Run from repository root:

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
    if (existsSync(resolve(sourceRoot, entry.path))) {
      return {
        identity,
        disposition: "included",
        sourcePath: entry.path,
        ...(section === undefined ? {} : { section }),
      };
    }
    return {
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

Do not commit this scaffold as a permanent generator.

- [ ] **Step 4: Measure and review the exact include/omit set**

This command maps every plan entry back to the compiler-generated source path, so it detects an omitted identity whose source actually exists even though omitted release-plan entries intentionally contain no `sourcePath`:

```bash
bun -e '
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const sourceRoot = resolve("packages/assets/media");
const catalog = await Bun.file(
  "packages/stories/src/generated/theSeventhMirror/image-assets.json"
).json();
const plan = await Bun.file(
  "packages/stories/release-plans/the_seventh_mirror.json"
).json();

const generatedById = new Map([
  ...catalog.backgrounds.map((entry) => [`background:${entry.key}`, entry.path]),
  ...catalog.portraits.map((entry) => [`portrait:${entry.key}`, entry.path]),
]);
const included = plan.entries.filter((entry) => entry.disposition === "included");
const omitted = plan.entries.filter((entry) => entry.disposition === "omitted");
const omittedExisting = omitted.filter((entry) => {
  const path = generatedById.get(`${entry.identity.type}:${entry.identity.key}`);
  return typeof path === "string" && existsSync(resolve(sourceRoot, path));
});

console.log(`included=${included.length}`);
console.log(`omitted=${omitted.length}`);
console.log(`total=${plan.entries.length}`);
console.log(`omittedExisting=${omittedExisting.length}`);
for (const entry of omittedExisting) {
  console.log(`existing-but-omitted ${entry.identity.type}:${entry.identity.key} — ${entry.reason}`);
}
'
```

Review requirements:

- counts are plausible for the checkout being archived;
- missing-source omissions use `Authoring art not produced for HPA-231 v1`;
- `omittedExisting=0` unless an existing source is intentionally excluded;
- every intentionally excluded existing source has a specific reason rather than the missing-art boilerplate;
- missing art remains out of scope.

Do not use an externally quoted source count as the acceptance value. The migration command above measures the branch that will actually be archived.

- [ ] **Step 5: Freeze the reviewed included count into the test**

After any deliberate edits from Step 4:

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

- [ ] **Step 7: Run the real publisher plan against the original source tree**

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
- no input/source/encoding errors;
- `releaseId` and `manifestSha256` are present.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/stories/release-plans/the_seventh_mirror.json \
  packages/stories/src/runtime-assets/__tests__/the-seventh-mirror-release-plan.test.ts
git commit -m "feat: classify Seventh Mirror production assets"
```

---

### Task 2: Archive and restore the v1 source snapshot

**Files:**
- Create: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: current source tree, generated metadata, production plan, private `aquila-vn-source` bucket.
- Produces: immutable v1 migration snapshot and a reproducible restore path.

- [ ] **Step 1: Create the runbook and state the archive boundary**

Start `docs/infrastructure/the-seventh-mirror-r2-migration.md` with:

```markdown
# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

The base archive is the HPA-231 v1 migration snapshot of source art that exists
at migration time. It is not a claim that every generated story key has artwork.
Missing generated keys remain explicit release-plan omissions. Future newly
produced art uses a new immutable archive prefix (or a deliberately documented
overlay) plus a release-plan amendment; HPA-231 does not provide an automatic
sync service.

Private source sync uses an operator-only R2 Access Key ID / Secret Access Key
scoped to `aquila-vn-source`. Never commit or print those values. Delivery
publisher credentials remain scoped to `aquila-vn-delivery`.
```

Append the reviewed `included`, `omitted`, and `total` counts from Task 1.

- [ ] **Step 2: Build the local archive and checksums**

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

- [ ] **Step 3: Upload to private R2**

With source-bucket-scoped S3 credentials loaded into the shell:

```bash
export AWS_DEFAULT_REGION=auto
R2_ENDPOINT=https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"

aws s3 sync "$ARCHIVE_ROOT/" "$R2_PREFIX" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
```

Never use `--delete`.

- [ ] **Step 4: Restore and verify checksums**

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

Expected: every file reports `OK`.

- [ ] **Step 5: Prove the restored snapshot reproduces the publisher identity**

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

Expected: exact release ID and manifest checksum match.

- [ ] **Step 6: Record the archive identity and restore result, then commit**

Record `ARCHIVE_ID`, private prefix, checksum result, restore command, release ID/checksum, and reviewed counts.

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: add Seventh Mirror source restore runbook"
```

---

### Task 3: Publish and qualify the primary immutable candidate

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: production plan, original/restored sources, HPA-230 publisher, HPA-233 gate.
- Produces: retained primary release ID/checksum plus preview and manual approval.

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

- [ ] **Step 2: Derive exact identifiers from the retained report**

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

- [ ] **Step 3: Deep-verify the stored candidate**

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

- [ ] **Step 4: Deploy the isolated preview**

Configure the preview deployment:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Set shell variable `PREVIEW_URL` to the HTTPS deployment origin produced by Vercel.

- [ ] **Step 5: Run the existing HPA-233 workflow**

Use these workflow inputs:

```text
story=the_seventh_mirror
release_id=$RELEASE_ID
manifest_sha256=$MANIFEST_SHA256
preview_id=hpa-231-gate
preview_url=$PREVIEW_URL
```

Expected: storage deep verify, mirror-preview, preview activation, public CDN verify, and deployed browser spec all PASS.

- [ ] **Step 6: Perform the manual v1 visual review**

Visit representative early, middle, and late story positions. Record:

```text
[ ] an included background transition renders correctly
[ ] an included portrait/expression transition renders correctly when available
[ ] an omitted/missing asset uses fallback without blocking progression
[ ] one choice path works where available
[ ] desktop presentation is acceptable
[ ] mobile presentation is acceptable
[ ] text -> visual -> text preserves the exact active line
[ ] middle/late positions with no included art are recorded as expected fallback
```

Do not fail HPA-231 merely because later generated artwork was never produced; that condition must already be explicit in the release plan.

- [ ] **Step 7: Record candidate evidence and commit**

Record the primary release ID/checksum, reviewed counts, preview deployment, workflow run, and manual result.

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror candidate qualification"
```

---

### Task 4: Wire production to remote R2 once, then activate the primary release

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: HPA-229 Vercel config contract and qualified primary release.
- Produces: production app using the R2 production source plus passing active production smoke.

- [ ] **Step 1: Configure the Vercel Production environment**

Set exactly:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=production
```

Ensure this is unset for Production:

```text
PUBLIC_ASSET_PREVIEW_ID
```

Leave local Development variables unset so local fixture behavior remains unchanged.

- [ ] **Step 2: Redeploy production once for the build-time environment change**

Create one production deployment containing the configuration above. This is a one-time application configuration deployment, not a per-asset-release deployment.

- [ ] **Step 3: Prove remote production routing before pointer activation**

Open The Seventh Mirror visual mode and inspect the browser Network panel.

Require a request beginning with:

```text
https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json
```

Require no request to:

```text
/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json
```

A remote 404 is acceptable before first activation. This checkpoint proves routing, not release availability.

Record the deployment identity and result in the runbook.

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

- [ ] **Step 5: Verify the active public production chain**

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json > .tmp/hpa-231-production-public-verify.json
```

- [ ] **Step 6: Run the deployed production reader spec**

```bash
BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: desktop/mobile flows pass with the exact primary identity and active-line continuity.

- [ ] **Step 7: Record the one-time env preflight and production smoke, then commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror production activation"
```

After this step, future asset pointer changes must not require a Vercel rebuild.

---

### Task 5: Machine-select a compatible rollback peer and prove pointer-only rollback

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: active primary release, current production plan, release history, public immutable manifests.
- Produces: eligible previous peer or one synthetic peer, rollback proof, activation-back proof, final primary restoration.

- [ ] **Step 1: List deep-verified production releases**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-production-releases.json
```

- [ ] **Step 2: Select only a release whose public manifest matches the current plan**

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
  const actualSha256 = createHash("sha256")
    .update(text, "utf8")
    .digest("hex");
  if (actualSha256 !== candidate.manifestSha256) continue;

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

- `PEER_STATUS=0`: use the machine-selected previous peer in Steps 3-6.
- `PEER_STATUS=2`: no previous release matches the current production plan; use the synthetic path in Steps 7-14.
- any other exit: stop and fix the concrete command/network/input failure.

For HPA-231, “full-story release” means “matches this production plan / included set,” not “all generated chapters have artwork.”

- [ ] **Step 3: Load the previous peer identifiers**

Only for `PEER_STATUS=0`:

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

- [ ] **Step 4: Roll back to the previous peer**

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

Run the production public verifier and deployed reader spec with the rollback identifiers. Both must pass.

- [ ] **Step 5: Activate the primary release again**

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

Re-run the primary production public verifier and deployed reader spec. Both must pass.

- [ ] **Step 6: Record the previous-peer proof and skip to Task 6**

Record both release IDs/checksums, machine peer selection, rollback result, and primary activation-back result.

- [ ] **Step 7: If no previous peer exists, create a synthetic source root**

Only for `PEER_STATUS=2`:

```bash
SYNTHETIC_SOURCE_ROOT=.tmp/hpa-231-synthetic-source
rm -rf "$SYNTHETIC_SOURCE_ROOT"
cp -R packages/assets/media "$SYNTHETIC_SOURCE_ROOT"
```

- [ ] **Step 8: Make one deterministic tiny revision**

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

Manually glance at the revised source image. The synthetic source is operational-only and is not added to the v1 authoring archive.

- [ ] **Step 9: Publish and deep-verify the synthetic peer without activation**

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

Do not run a second HPA-233 preview gate. The primary release already passed that gate.

- [ ] **Step 10: Temporarily activate and production-smoke the synthetic peer**

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

Then run:

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

- [ ] **Step 11: Roll back from synthetic to primary**

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

Re-run primary public and browser verification.

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

Re-run synthetic public and browser verification.

- [ ] **Step 13: Restore the intended primary release as final production state**

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

Re-run primary public and browser verification one final time.

- [ ] **Step 14: Record rollback proof and commit**

Record the peer type (previous or synthetic), both release identities/checksums, every pointer move, verification result, and the final primary identity.

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror rollback proof"
```

---

### Task 6: Remove production binaries and regenerate tiny local fixtures

**Files:**
- Modify: the four retained source PNGs.
- Delete: every other `packages/assets/media/the_seventh_mirror/**` file.
- Regenerate: HPA-228 local fixture release under `apps/web/public/assets/vn/`.

**Interfaces:**
- Consumes: successful Task 5 proof with the intended primary release active.
- Produces: clean checkout containing only four small source fixtures and a consistent local runtime fixture.

- [ ] **Step 1: Enforce the cleanup checkpoint**

Do not continue unless the runbook contains concrete results for:

- reviewed include/omit counts;
- private archive restore;
- production remote-source network preflight;
- primary production smoke;
- rollback and activation-back proof;
- final primary restoration.

- [ ] **Step 2: Downsize the four retained fixture sources in place**

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

- [ ] **Step 4: Regenerate and verify HPA-228 local fixtures**

```bash
bun --filter web build:visual-fixtures
bun --filter web verify:visual-fixtures
```

Expected: PASS. Do not commit until Task 7 removes stale local VN objects and adds the footprint guard.

---

### Task 7: Add the narrow visual-asset footprint guard

**Files:**
- Create: `apps/web/scripts/assert-visual-asset-footprint.ts`
- Create: `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/build-and-lint.yml`

**Interfaces:**
- Consumes: the four approved source fixture paths and committed HPA-228 pointer/manifest/object graph.
- Produces: credential-free failure when production-sized story sources or stale local VN objects return.

- [ ] **Step 1: Write the failing guard tests**

Create `apps/web/scripts/__tests__/assert-visual-asset-footprint.test.ts`:

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

async function validTree(): Promise<{ mediaRoot: string; publicRoot: string }> {
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
            manifestSha256: 'b'.repeat(64),
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

function rel(root: string, path: string): string {
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
    const present = new Set<string>();
    let totalBytes = 0;
    for (const path of sourceFiles) {
        const relativePath = rel(mediaRoot, path);
        present.add(relativePath);
        if (!APPROVED_FIXTURE_SOURCES.has(relativePath)) {
            problems.push(`unexpected Seventh Mirror fixture source: ${relativePath}`);
            continue;
        }
        const bytes = (await stat(path)).size;
        totalBytes += bytes;
        if (bytes > MAX_FIXTURE_FILE_BYTES) {
            problems.push(`fixture source exceeds ${MAX_FIXTURE_FILE_BYTES} bytes: ${relativePath}`);
        }
    }
    for (const approved of APPROVED_FIXTURE_SOURCES) {
        if (!present.has(approved)) problems.push(`approved fixture source missing: ${approved}`);
    }
    if (totalBytes > MAX_FIXTURE_TOTAL_BYTES) {
        problems.push(`fixture sources exceed ${MAX_FIXTURE_TOTAL_BYTES} bytes combined`);
    }

    const pointerPath = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
    const pointer = parseActiveReleasePointer(
        JSON.parse(await readFile(resolve(publicRoot, pointerPath), 'utf8')),
        PREVIEW_TARGET,
        STORY_ID
    );
    const manifest = parseRuntimeAssetManifest(
        JSON.parse(await readFile(resolve(publicRoot, pointer.manifestPath), 'utf8'))
    );
    const allowedRuntime = new Set<string>([pointerPath, pointer.manifestPath]);
    for (const asset of manifest.assets) {
        allowedRuntime.add(asset.variants.webp.path);
        if (asset.variants.avif) allowedRuntime.add(asset.variants.avif.path);
        if (asset.placeholder) allowedRuntime.add(asset.placeholder.path);
    }

    for (const path of await walkFiles(resolve(publicRoot, 'vn'))) {
        const relativePath = rel(publicRoot, path);
        if (!allowedRuntime.has(relativePath)) {
            problems.push(`unreferenced local VN file: ${relativePath}`);
        }
    }

    if (problems.length > 0) {
        throw new Error(`Visual asset footprint check failed:\n${problems.join('\n')}`);
    }
}

if (import.meta.main) await assertVisualAssetFootprint();
```

- [ ] **Step 4: Run the focused tests**

```bash
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the guard against the real repository**

```bash
bun --cwd apps/web scripts/assert-visual-asset-footprint.ts
```

If it reports only stale `apps/web/public/assets/vn/**` files left by fixture regeneration, delete those exact files and rerun. Do not broaden the allowlist.

- [ ] **Step 6: Add the package script and CI step**

Add to `apps/web/package.json`:

```json
"verify:asset-footprint": "bun scripts/assert-visual-asset-footprint.ts"
```

Add after `compile:check` in `.github/workflows/build-and-lint.yml`:

```yaml
      - name: Verify visual asset footprint
        run: bun --filter web verify:asset-footprint
```

- [ ] **Step 7: Run the cleanup verification set**

```bash
bun --filter web verify:visual-fixtures
bun --filter web verify:asset-footprint
bun --filter web test:run -- scripts/__tests__/assert-visual-asset-footprint.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit Task 6 and Task 7 together**

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
- Produces: clean-checkout proof, final issue summary, HPA-231 Done, then parent HPA-216 closed.

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

- [ ] **Step 2: Prove only approved local visual fixtures remain**

```bash
find packages/assets/media/the_seventh_mirror -type f -print | sort
find apps/web/public/assets/vn -type f -print | sort
bun --filter web verify:asset-footprint
```

Expected: exactly four approved source fixture paths and only the HPA-228 active pointer/manifest/referenced objects.

- [ ] **Step 3: Prove production republishing starts from the private archive**

Restore the base archive into `.tmp/hpa-231-final-restore`, verify `SHA256SUMS`, then run:

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

Compare the resulting `releaseId` and `manifestSha256` to `$RELEASE_ID` and `$MANIFEST_SHA256` from the primary candidate.

- [ ] **Step 4: Re-run the active production identity check after Git cleanup**

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

Expected: production remains on the primary release; repository cleanup has no runtime effect.

- [ ] **Step 5: Record final evidence in plain Markdown**

Record:

- reviewed included/omitted/total counts;
- source archive ID and restore result;
- primary release ID/checksum;
- preview gate and manual review result;
- production Vercel asset-source config and network preflight;
- production activation/smoke result;
- rollback peer selection result;
- previous or synthetic peer ID/checksum;
- rollback/activation-back result;
- final primary release identity;
- cleanup/footprint result;
- final credential-free verification result.

Explicitly state that the private archive is the v1 migration snapshot, not a complete art set. Do not add an evidence schema.

- [ ] **Step 6: Commit the final runbook**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: finalize Seventh Mirror R2 migration"
```

- [ ] **Step 7: Add one concise HPA-231 completion comment**

Summarize the concrete values from Step 5.

- [ ] **Step 8: Move HPA-231 to Done, then close HPA-216**

Only after all HPA-231 acceptance criteria are proven. HPA-216 must not be closed first.

---

## Self-Review Checklist

- [ ] Every compiler authoring key is explicitly included or omitted.
- [ ] Missing art is an explicit v1 decision rather than a silent mass omission.
- [ ] The branch-measured, reviewed included count is frozen in the structural test and recorded in the runbook.
- [ ] CI structural coverage remains valid after production sources leave Git.
- [ ] The private archive is checksummed, restorable, and explicitly documented as a v1 migration snapshot rather than a complete art set.
- [ ] The primary candidate uses HPA-230 `--no-activate`, deep verify, HPA-233, and a concise manual review.
- [ ] Production Vercel `PUBLIC_ASSET_*` wiring is deployed once before pointer activation, and remote-pointer routing is proven.
- [ ] After that one-time deployment, asset releases do not require a Vercel rebuild.
- [ ] Rollback peer selection is executable and requires deep verification, exact public manifest checksum, and `validateRuntimeManifestCoverage` against the production plan.
- [ ] The synthetic first-release fallback uses one controlled image revision, deep verification, and exact production smoke without a redundant second preview gate.
- [ ] The intended primary release is restored before cleanup.
- [ ] Cleanup retains only the four existing fixture paths and adds a story-specific footprint guard.
- [ ] No new schema/version/storage/runtime/release framework is introduced.
