# HPA-231 The Seventh Mirror R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish The Seventh Mirror as Aquila's first production R2-backed visual-novel release, prove production routing and pointer rollback, archive the v1 authoring snapshot privately, then remove production-sized story binaries from current repository HEAD while preserving small local fixtures.

**Architecture:** Reuse HPA-227 runtime contracts, HPA-228 local fixtures, HPA-229 R2/Vercel configuration, HPA-230 catalog/coverage/publisher commands, HPA-233 release gate, and HPA-234 reader state. Add only one production release plan, one focused publisher coverage test, one migration runbook, source cleanup, extensions to the existing visual-fixture verifier, and one CI step. No new release-plan sync tool, footprint script, publisher command, storage abstraction, or evidence framework.

**Tech Stack:** Bun 1.3.1, TypeScript, Vitest, Sharp, existing `@aquila/stories/runtime-assets`, existing `@aquila/infra-cloudflare` publisher, AWS CLI for one-time R2 source archival, Vercel production configuration, existing Playwright release gate.

## Global Constraints

- HPA-231 is a one-time migration; do not redesign the runtime contract, reader, R2 infrastructure, publisher, or release gate.
- Missing v1 artwork is allowed and must be explicitly omitted; creating missing art is out of scope.
- Production cleanup is forbidden until production routing, primary smoke, rollback/activation-back proof, and final primary restoration all pass.
- Public runtime data must remain prompt-free and must not expose source paths, provider metadata, private bucket identifiers, or credentials.
- Delivery-publisher credentials remain delivery-only; private-source archive credentials are operator-only.
- No command block may depend on shell variables exported by a previous block. Re-derive values from retained files/reports every time.
- Removal means removal from current repository HEAD/canonical delivery paths. Do not rewrite Git history.

### Command Conventions

Every `@aquila/infra-cloudflare` publisher/verify command below runs the CLI directly by file path from the repository root — `bun packages/infra-cloudflare/src/publisher/cli.ts …` (the `assets` script) and `bun packages/infra-cloudflare/src/verify.ts …` (the `verify` script) — instead of `bun --filter @aquila/infra-cloudflare …`. On Bun ≥ 1.3.14 the `--filter` runner prefixes every stdout line with `<package> <script>:`, which corrupts the JSON captured to `.tmp/*.json` and breaks every later `Bun.file(".tmp/*.json").json()` parse; the direct invocation keeps stdout as clean JSON (progress logs stay on stderr). Vitest and lint invocations keep `bun --filter`, since their result is read from the exit code and reporter output, not parsed JSON.

---

## File Structure

### Create

- `packages/stories/release-plans/the_seventh_mirror.json`
- `packages/infra-cloudflare/src/publisher/__tests__/the-seventh-mirror-release-plan.test.ts`
- `docs/infrastructure/the-seventh-mirror-r2-migration.md`

### Modify

- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png`
- `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png`
- `apps/web/scripts/verify-visual-fixtures.ts`
- `apps/web/scripts/__tests__/verify-visual-fixtures.test.ts`
- `.github/workflows/build-and-lint.yml`
- regenerated HPA-228 fixture pointer/manifest/objects under `apps/web/public/assets/vn/`

### Delete after live proof

- every other file under `packages/assets/media/the_seventh_mirror/**`;
- stale The Seventh Mirror story-local preview manifests left by fixture regeneration.

Do not add a new release-plan generator or footprint-verifier script.

---

### Task 1: Build and validate the explicit v1 production release plan

**Files:**
- Create: `packages/stories/release-plans/the_seventh_mirror.json`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/the-seventh-mirror-release-plan.test.ts`

**Interfaces:**
- Consumes: `discoverAuthoringCatalog()`, `resolveReleasePlanPath()`, `loadReleasePlan()`, `validatePublisherCoverage()`.
- Produces: a complete production classification that reuses HPA-230's existing coverage rules without requiring production sources to stay in Git.

- [ ] **Step 1: Write the failing publisher coverage test**

Create `packages/infra-cloudflare/src/publisher/__tests__/the-seventh-mirror-release-plan.test.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverAuthoringCatalog } from '../authoring-catalog';
import { validatePublisherCoverage } from '../coverage';
import { loadReleasePlan, resolveReleasePlanPath } from '../release-plan';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'production' } as const;
const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

describe('The Seventh Mirror production release plan', () => {
    it('covers the generated catalog with at least one included asset', async () => {
        const catalog = await discoverAuthoringCatalog(repositoryRoot, STORY_ID);
        const planPath = await resolveReleasePlanPath({
            repositoryRoot,
            storyId: STORY_ID,
            target: TARGET,
        });
        const plan = await loadReleasePlan(planPath);
        const availableSourcePaths = new Set(
            plan.entries
                .filter(entry => entry.disposition === 'included')
                .map(entry => entry.sourcePath)
        );

        const coverage = validatePublisherCoverage({
            catalog,
            plan,
            target: TARGET,
            availableSourcePaths,
        });

        expect(coverage.totals.unclassified).toBe(0);
        expect(coverage.totals.included).toBeGreaterThan(0);
    });
});
```

Passing the plan's included paths as `availableSourcePaths` deliberately skips filesystem-existence enforcement in CI while retaining existing identity completeness, unknown identity, source-path equality, duplicate, story/channel, and production-unclassified checks.

- [ ] **Step 2: Run the test and verify the production plan is missing**

```bash
bun --filter @aquila/infra-cloudflare test -- the-seventh-mirror-release-plan
```

Expected: FAIL because `packages/stories/release-plans/the_seventh_mirror.json` does not exist.

- [ ] **Step 3: Scaffold the initial plan once from generated inventory plus current source existence**

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

This is an operator scaffold, not a permanent generator. Newly appearing artwork remains an explicit future release decision rather than being automatically shipped.

- [ ] **Step 4: Measure include/omit counts and check both mapping directions**

```bash
bun -e '
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const mediaRoot = resolve("packages/assets/media");
const storyRoot = resolve(mediaRoot, "the_seventh_mirror");
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
const generatedPaths = new Set(generatedById.values());
const included = plan.entries.filter((entry) => entry.disposition === "included");
const omitted = plan.entries.filter((entry) => entry.disposition === "omitted");
const omittedExisting = omitted.filter((entry) => {
  const path = generatedById.get(`${entry.identity.type}:${entry.identity.key}`);
  return typeof path === "string" && existsSync(resolve(mediaRoot, path));
});

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const diskFiles = await walk(storyRoot);
const junk = diskFiles.filter((path) => basename(path) === ".DS_Store");
const unreferenced = diskFiles
  .filter((path) => basename(path) !== ".DS_Store")
  .map((path) => relative(mediaRoot, path).split("\\").join("/"))
  .filter((path) => !generatedPaths.has(path));

console.log(`included=${included.length}`);
console.log(`omitted=${omitted.length}`);
console.log(`total=${plan.entries.length}`);
console.log(`omittedExisting=${omittedExisting.length}`);
console.log(`unreferencedSourceFiles=${unreferenced.length}`);
for (const entry of omittedExisting) {
  console.log(`existing-but-omitted ${entry.identity.type}:${entry.identity.key} — ${entry.reason}`);
}
for (const path of unreferenced) console.log(`unreferenced ${path}`);
for (const path of junk) console.log(`filesystem-junk ${path}`);
'
```

Review requirements:

- counts are plausible for the branch actually being archived;
- missing-source omissions use the shared v1 reason;
- `omittedExisting=0` unless a real source is deliberately excluded with a specific reason;
- every unreferenced image is recorded in the runbook as compiler drift/renamed-unused art or handled by the owning content task before migration;
- `.DS_Store` files are removed before archive creation;
- do not invent release-plan identities for files absent from the compiler inventory.

- [ ] **Step 5: Run the focused coverage test**

```bash
bun --filter @aquila/infra-cloudflare test -- the-seventh-mirror-release-plan
```

Expected: PASS.

- [ ] **Step 6: Run the real HPA-230 production plan against original sources**

```bash
rm -rf .tmp/hpa-231-plan-destination
mkdir -p .tmp
bun packages/infra-cloudflare/src/publisher/cli.ts plan \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root packages/assets/media \
  --destination local \
  --destination-root .tmp/hpa-231-plan-destination \
  --json > .tmp/hpa-231-plan.json
```

Require `coverage.totals.unclassified === 0`, no publisher errors, and counts matching the reviewed plan.

- [ ] **Step 7: Commit**

```bash
git add \
  packages/stories/release-plans/the_seventh_mirror.json \
  packages/infra-cloudflare/src/publisher/__tests__/the-seventh-mirror-release-plan.test.ts
git commit -m "feat: classify Seventh Mirror production assets"
```

---

### Task 2: Archive and restore the v1 source snapshot

**Files:**
- Create: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: reviewed v1 source tree, generated metadata, production release plan, private `aquila-vn-source` bucket.
- Produces: immutable migration snapshot and a restore path that reproduces the primary release identity.

- [ ] **Step 1: Start the runbook with snapshot and history boundaries**

Create `docs/infrastructure/the-seventh-mirror-r2-migration.md` with:

```markdown
# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

The base archive is the HPA-231 v1 migration snapshot. It is not a complete-art
claim: generated keys without source art remain explicit production-plan
omissions. Future art requires a new archive prefix/overlay plus a deliberate
release-plan amendment.

HPA-231 removes production binaries from current repository HEAD and canonical
runtime delivery paths. It does not rewrite Git history; historical blobs remain
reachable in older commits.
```

Append the Task 1 included/omitted/total counts and any unreferenced source-art findings. Known unreferenced source images (present on disk but absent from the generated compiler catalog, confirmed during this plan's Task 1 run): `the_seventh_mirror/characters/asakura_yuma/sad.png` and `the_seventh_mirror/characters/asakura_yuma/scared.png`. Record these in the runbook as compiler drift / unused authoring art; do not invent release-plan identities for them, and do not delete them here — Task 6 governs source removal only after the live-proof checkpoint.

- [ ] **Step 2: Remove filesystem junk, create archive ID, and persist it to disk**

```bash
find packages/assets/media/the_seventh_mirror -name .DS_Store -delete
mkdir -p .tmp
ARCHIVE_ID="$(date -u +%Y-%m-%d)-$(git rev-parse --short=12 HEAD)"
printf '%s\n' "$ARCHIVE_ID" > .tmp/hpa-231-archive-id

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

- [ ] **Step 3: Upload the archive in a fresh-shell-safe block**

With source-bucket-scoped AWS/R2 credentials loaded:

```bash
ARCHIVE_ID=$(cat .tmp/hpa-231-archive-id)
ARCHIVE_ROOT=.tmp/hpa-231-source-archive
R2_ENDPOINT=https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"
export AWS_DEFAULT_REGION=auto

aws s3 sync "$ARCHIVE_ROOT/" "$R2_PREFIX" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
```

Never use `--delete`.

- [ ] **Step 4: Restore and verify checksums without relying on prior shell state**

```bash
ARCHIVE_ID=$(cat .tmp/hpa-231-archive-id)
R2_ENDPOINT=https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"
RESTORE_ROOT=.tmp/hpa-231-restored
export AWS_DEFAULT_REGION=auto

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

- [ ] **Step 5: Prove restored sources reproduce the original publication identity**

```bash
RESTORE_ROOT=.tmp/hpa-231-restored
rm -rf .tmp/hpa-231-restore-destination
bun packages/infra-cloudflare/src/publisher/cli.ts plan \
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

- [ ] **Step 6: Record archive ID/prefix and restore result, then commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: add Seventh Mirror source restore runbook"
```

---

### Task 3: Publish and qualify the primary immutable candidate

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: production plan, original/restored source snapshot, HPA-230 publisher, HPA-233 gate.
- Produces: retained primary publish report plus preview/manual approval.

- [ ] **Step 1: Publish without production activation**

```bash
bun packages/infra-cloudflare/src/publisher/cli.ts publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root packages/assets/media \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-publish.json
```

- [ ] **Step 2: Deep-verify using identifiers re-derived in the same block**

```bash
RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); if(typeof r.releaseId!=="string") throw new Error("missing releaseId"); console.log(r.releaseId)')
MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); if(typeof r.manifestSha256!=="string") throw new Error("missing manifestSha256"); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-candidate-verify.json
```

- [ ] **Step 3: Deploy the isolated preview**

Configure the preview deployment:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=hpa-231-gate
```

Use the resulting HTTPS deployment URL directly as the HPA-233 `preview_url`; do not rely on a shell variable surviving into another task.

- [ ] **Step 4: Run the existing HPA-233 workflow**

Before entering workflow inputs, print the retained identifiers in the current shell:

```bash
bun -e '
const r=await Bun.file(".tmp/hpa-231-publish.json").json();
console.log(`release_id=${r.releaseId}`);
console.log(`manifest_sha256=${r.manifestSha256}`);
'
```

Trigger **Visual Novel Release Gate** with:

```text
story=the_seventh_mirror
release_id=<printed release_id>
manifest_sha256=<printed manifest_sha256>
preview_id=hpa-231-gate
preview_url=<the HTTPS preview deployment URL>
```

Expected: all existing HPA-233 storage/CDN/browser steps PASS.

- [ ] **Step 5: Perform one concise manual v1 review**

Record:

```text
[ ] one included background transition
[ ] one included portrait/expression transition when available
[ ] one omitted/missing fallback without blocked progression
[ ] one choice path where available
[ ] desktop presentation
[ ] mobile presentation
[ ] text -> visual -> text preserves the exact active line
[ ] later positions without included art are expected fallback, not migration failure
```

- [ ] **Step 6: Record primary release identity and preview/manual result, then commit**

Read identifiers from `.tmp/hpa-231-publish.json` when updating the runbook.

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror candidate qualification"
```

---

### Task 4: Wire production to R2 once, then activate and smoke the primary release

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: HPA-229 Vercel asset-source contract and primary publish report.
- Produces: production deployment resolving remote R2 assets plus full primary production smoke.

- [ ] **Step 1: Configure Vercel Production**

Set exactly:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=production
```

Ensure `PUBLIC_ASSET_PREVIEW_ID` is unset for Production. Leave Development unset.

- [ ] **Step 2: Redeploy production once for the build-time configuration**

This is a one-time application configuration deploy, not a per-asset-release deploy.

- [ ] **Step 3: Prove remote routing before pointer activation**

Open The Seventh Mirror visual mode in production and inspect Network requests.

Require:

```text
https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json
```

Reject any request to:

```text
/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json
```

A remote 404 is acceptable before first activation. Record the deployment identity and routing result.

- [ ] **Step 4: Activate primary; derive identifiers from the retained report in this block**

```bash
RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-production-activate.json
```

- [ ] **Step 5: Verify the active public chain in a fresh-shell-safe block**

```bash
MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json > .tmp/hpa-231-production-public-verify.json
```

- [ ] **Step 6: Run the full deployed production reader smoke, re-deriving both identifiers**

```bash
RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

- [ ] **Step 7: Record production routing/activation/smoke, then commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror production activation"
```

---

### Task 5: Prove pointer-only rollback with one controlled synthetic peer

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: active primary release and the same production plan/source snapshot.
- Produces: a second immutable release solely for rollback proof, followed by final restoration of the primary.

- [ ] **Step 1: Record current production release history for context only**

```bash
bun packages/infra-cloudflare/src/publisher/cli.ts releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-production-releases.json
```

Do not branch on this list. Pre-HPA-231 releases were created without the new production plan and are not the planned rollback peer.

- [ ] **Step 2: Create a temporary source root and verify the revision target is included**

```bash
bun -e '
const plan=await Bun.file("packages/stories/release-plans/the_seventh_mirror.json").json();
const target=plan.entries.find((entry)=>
  entry.identity.type==="background" && entry.identity.key==="chapter_1/ch1_act2_s1"
);
if (!target || target.disposition !== "included") {
  throw new Error("chapter_1/ch1_act2_s1 must be included for the controlled rollback peer");
}
'

rm -rf .tmp/hpa-231-synthetic-source
cp -R packages/assets/media .tmp/hpa-231-synthetic-source
```

- [ ] **Step 3: Apply one deterministic tiny brightness revision without changing dimensions**

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";
const path = ".tmp/hpa-231-synthetic-source/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png";
const temporary = `${path}.tmp.png`;
const before = await sharp(path).metadata();
await sharp(path)
  .modulate({ brightness: 1.01 })
  .png({ compressionLevel: 9 })
  .toFile(temporary);
const after = await sharp(temporary).metadata();
if (before.width !== after.width || before.height !== after.height) {
  throw new Error("synthetic revision changed dimensions");
}
await rename(temporary, path);
'
```

Manually inspect the revised image once.

- [ ] **Step 4: Publish the synthetic release without activation**

```bash
bun packages/infra-cloudflare/src/publisher/cli.ts publish \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root .tmp/hpa-231-synthetic-source \
  --destination r2 \
  --no-activate \
  --json > .tmp/hpa-231-synthetic-publish.json
```

- [ ] **Step 5: Deep-verify synthetic and require a distinct release ID**

```bash
PRIMARY_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
SYNTHETIC_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.releaseId)')
SYNTHETIC_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.manifestSha256)')

if [ "$PRIMARY_RELEASE_ID" = "$SYNTHETIC_RELEASE_ID" ]; then
  echo 'synthetic revision did not create a distinct release' >&2
  exit 1
fi

bun packages/infra-cloudflare/src/publisher/cli.ts verify \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-231-synthetic-verify.json
```

Do not run a second HPA-233 preview gate.

- [ ] **Step 6: Temporarily activate synthetic and verify the public chain**

```bash
SYNTHETIC_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.releaseId)')
SYNTHETIC_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-synthetic-activate.json

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

- [ ] **Step 7: Roll back to primary and verify**

```bash
PRIMARY_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
PRIMARY_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRIMARY_RELEASE_ID" \
  --expect-manifest-sha256 "$PRIMARY_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-rollback-to-primary.json

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$PRIMARY_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

- [ ] **Step 8: Activate synthetic again to prove activation-back semantics**

```bash
SYNTHETIC_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.releaseId)')
SYNTHETIC_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-synthetic-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$SYNTHETIC_RELEASE_ID" \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-synthetic-activate-back.json

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$SYNTHETIC_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

Use normal `activate`, not `--reactivate`, because synthetic is inactive after rollback.

- [ ] **Step 9: Restore primary as final production state and verify**

```bash
PRIMARY_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
PRIMARY_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/publisher/cli.ts activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRIMARY_RELEASE_ID" \
  --expect-manifest-sha256 "$PRIMARY_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-231-final-primary-activate.json

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$PRIMARY_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json
```

- [ ] **Step 10: Record both immutable release identities and pointer proof, then commit**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: record Seventh Mirror rollback proof"
```

---

### Task 6: Remove production source binaries while preserving fixture resolution

**Files:**
- Modify: four retained PNG fixture sources.
- Delete: every other `packages/assets/media/the_seventh_mirror/**` file.
- Regenerate: existing HPA-228 fixture release.

**Interfaces:**
- Consumes: successful Task 5 proof with primary active.
- Produces: four source fixtures at the builder's existing target dimensions plus the regenerated local fixture graph.

- [ ] **Step 1: Enforce the live-release cleanup checkpoint**

Do not continue unless the runbook records:

- reviewed v1 counts and unreferenced-source review;
- private archive restore proof;
- production R2 routing preflight;
- primary HPA-233 + production smoke;
- synthetic rollback/activation-back proof;
- final primary restoration.

- [ ] **Step 2: Downsize the four retained PNGs to the builder's existing targets**

```bash
bun -e '
import { rename } from "node:fs/promises";
import sharp from "sharp";
const fixtures = [
  ["packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png", 960, 540],
  ["packages/assets/media/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png", 960, 540],
  ["packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png", 450, 600],
  ["packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png", 450, 600],
];
for (const [path, width, height] of fixtures) {
  const temporary = `${path}.fixture.tmp.png`;
  await sharp(path)
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(temporary);
  await rename(temporary, path);
}
'
```

Do not reduce these to 320×180 / 180×240; that would silently lower the HPA-228 fixture resolution because the builder uses `withoutEnlargement: true`.

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
    if (entry.isDirectory()) await walk(path);
    else {
      const rel = relative(root, path).split("\\").join("/");
      if (!keep.has(rel)) await rm(path);
    }
  }
}
await walk(storyRoot);
'
find packages/assets/media/the_seventh_mirror -type d -empty -delete
```

- [ ] **Step 4: Regenerate the existing local fixture release**

```bash
bun --filter web build:visual-fixtures
bun --filter web verify:visual-fixtures
```

The second command may still fail until Task 7 adds the new footprint checks and stale story-local manifests are removed; existing pointer/manifest/object integrity must already pass.

---

### Task 7: Extend the existing fixture verifier with source-footprint checks and wire it to CI

**Files:**
- Modify: `apps/web/scripts/verify-visual-fixtures.ts`
- Modify: `apps/web/scripts/__tests__/verify-visual-fixtures.test.ts`
- Modify: `.github/workflows/build-and-lint.yml`

**Interfaces:**
- Consumes: existing HPA-228 fixture source/plan/pointer/manifest/object graph.
- Produces: one verifier that covers both fixture integrity and the narrow HPA-231 source footprint.

- [ ] **Step 1: Extend the fs mocks and happy path in the existing test file**

The current test mocks `access` and `readFile`. Extend that mock to expose `readdir` and `stat`, and make the default happy path report exactly the four approved source files plus only the active story-local pointer/manifest.

Add stable mocks alongside the existing fs mocks:

```ts
const mockReaddir = vi.fn();
const mockStat = vi.fn();

vi.mock('node:fs/promises', () => ({
    access: mockAccess,
    readFile: mockReadFile,
    readdir: mockReaddir,
    stat: mockStat,
    default: {
        access: mockAccess,
        readFile: mockReadFile,
        readdir: mockReaddir,
        stat: mockStat,
    },
}));
```

Update `wireHappyPath()` so `mockReaddir` returns directory entries representing the four existing fixture paths when walking the media root and returns only `current.json` plus the active release directory/manifest for the story-local preview tree. Make `mockStat` return a small source size such as `1024` bytes by default.

- [ ] **Step 2: Add three focused regression cases**

```ts
it('rejects an unexpected Seventh Mirror source fixture', async () => {
    wireHappyPath({ extraSourcePath: 'the_seventh_mirror/characters/extra/base.png' });
    const { verifyVisualFixtures } = await importVerify();
    await expect(verifyVisualFixtures()).rejects.toThrow(
        /unexpected Seventh Mirror fixture source/i
    );
});

it('rejects an oversized retained source fixture', async () => {
    wireHappyPath({ sourceSizeBytes: 769 * 1024 });
    const { verifyVisualFixtures } = await importVerify();
    await expect(verifyVisualFixtures()).rejects.toThrow(/fixture source exceeds/i);
});

it('rejects a stale story-local preview manifest', async () => {
    wireHappyPath({ includeStaleManifest: true });
    const { verifyVisualFixtures } = await importVerify();
    await expect(verifyVisualFixtures()).rejects.toThrow(
        /stale Seventh Mirror fixture release document/i
    );
});
```

Implement the named `wireHappyPath` options directly in the existing helper rather than creating another fixture-test framework.

- [ ] **Step 3: Run the existing verifier test file and confirm the new cases fail**

```bash
bun --filter web test:run -- scripts/__tests__/verify-visual-fixtures.test.ts
```

- [ ] **Step 4: Add the narrow footprint checks to `verify-visual-fixtures.ts`**

Change imports/options/constants:

```ts
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const MAX_FIXTURE_FILE_BYTES = 768 * 1024;
const MAX_FIXTURE_TOTAL_BYTES = 3 * 1024 * 1024;
const APPROVED_FIXTURE_SOURCES = new Set([
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
    'the_seventh_mirror/characters/asakura_mio/base.png',
    'the_seventh_mirror/characters/asakura_yuma/base.png',
]);

export type VerifyVisualFixturesOptions = {
    publicRoot?: string;
    mediaRoot?: string;
};
```

Add a local recursive helper:

```ts
async function walkFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    async function walk(dir: string): Promise<void> {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = resolve(dir, entry.name);
            if (entry.isDirectory()) await walk(path);
            else files.push(path);
        }
    }
    await walk(root);
    return files;
}
```

At the beginning of `verifyVisualFixtures()`:

```ts
const mediaRoot =
    options.mediaRoot ?? resolve(repositoryRoot, 'packages/assets/media');
```

After existing release coverage validation, add:

```ts
const sourceFiles = await walkFiles(resolve(mediaRoot, STORY_ID));
let totalSourceBytes = 0;
const presentSources = new Set<string>();
for (const path of sourceFiles) {
    const rel = relative(mediaRoot, path).split('\\').join('/');
    presentSources.add(rel);
    if (!APPROVED_FIXTURE_SOURCES.has(rel)) {
        problems.push(`unexpected Seventh Mirror fixture source: ${rel}`);
        continue;
    }
    const bytes = (await stat(path)).size;
    totalSourceBytes += bytes;
    if (bytes > MAX_FIXTURE_FILE_BYTES) {
        problems.push(`fixture source exceeds ${MAX_FIXTURE_FILE_BYTES} bytes: ${rel}`);
    }
}
for (const approved of APPROVED_FIXTURE_SOURCES) {
    if (!presentSources.has(approved)) {
        problems.push(`approved fixture source missing: ${approved}`);
    }
}
if (totalSourceBytes > MAX_FIXTURE_TOTAL_BYTES) {
    problems.push(`fixture sources exceed ${MAX_FIXTURE_TOTAL_BYTES} bytes combined`);
}
```

After `pointer` and `manifest` are available, enforce the reverse story-local release-document set without touching shared `vn/objects/**`:

```ts
const storyRoot = resolve(
    publicRoot,
    'vn/previews/hpa-228-local/stories/the_seventh_mirror'
);
const allowedStoryFiles = new Set([
    resolve(publicRoot, getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)),
    resolve(publicRoot, pointer.manifestPath),
]);
for (const path of await walkFiles(storyRoot)) {
    if (!allowedStoryFiles.has(path)) {
        problems.push(
            `stale Seventh Mirror fixture release document: ${relative(publicRoot, path)}`
        );
    }
}
```

Keep the existing referenced-object hash/byte-length/dimension checks unchanged. Do not add a global unreferenced-object rejection for `vn/objects/**`.

- [ ] **Step 5: Run the verifier tests**

```bash
bun --filter web test:run -- scripts/__tests__/verify-visual-fixtures.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the verifier against the real regenerated fixture tree**

```bash
bun --filter web verify:visual-fixtures
```

If it reports stale story-local preview manifests, delete only those exact stale files and rerun. Do not broaden the allowlist.

- [ ] **Step 7: Add the existing verifier to Build & Lint CI**

Add after `compile:check` in `.github/workflows/build-and-lint.yml`:

```yaml
      - name: Verify visual fixtures and asset footprint
        run: bun --filter web verify:visual-fixtures
```

No new package script is needed; `verify:visual-fixtures` already exists.

- [ ] **Step 8: Commit Tasks 6 and 7 together**

```bash
git add \
  packages/assets/media/the_seventh_mirror \
  apps/web/public/assets/vn \
  apps/web/scripts/verify-visual-fixtures.ts \
  apps/web/scripts/__tests__/verify-visual-fixtures.test.ts \
  .github/workflows/build-and-lint.yml
git commit -m "chore: remove Seventh Mirror production binaries"
```

---

### Task 8: Final verification and Linear completion

**Files:**
- Modify: `docs/infrastructure/the-seventh-mirror-r2-migration.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: clean current checkout, final production proof, and concise HPA-231 completion record.

- [ ] **Step 1: Run the complete credential-free verification set**

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter @aquila/infra-cloudflare test
bun --filter web verify:visual-fixtures
bun --filter web test
bun run lint
bun run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Prove current repository HEAD contains only the four approved source fixtures**

```bash
find packages/assets/media/the_seventh_mirror -type f -print | sort
bun --filter web verify:visual-fixtures
```

Expected: exactly the four approved PNG source paths and a passing verifier.

- [ ] **Step 3: Prove production republishing starts from private R2, not current Git sources**

In a fresh shell:

```bash
ARCHIVE_ID=$(cat .tmp/hpa-231-archive-id)
R2_ENDPOINT=https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com
R2_PREFIX="s3://aquila-vn-source/authoring/the_seventh_mirror/$ARCHIVE_ID/"
RESTORE_ROOT=.tmp/hpa-231-final-restore
export AWS_DEFAULT_REGION=auto

rm -rf "$RESTORE_ROOT"
mkdir -p "$RESTORE_ROOT"
aws s3 sync "$R2_PREFIX" "$RESTORE_ROOT/" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress
(
  cd "$RESTORE_ROOT"
  shasum -a 256 -c SHA256SUMS
)

rm -rf .tmp/hpa-231-final-plan-destination
bun packages/infra-cloudflare/src/publisher/cli.ts plan \
  --story the_seventh_mirror \
  --environment production \
  --plan packages/stories/release-plans/the_seventh_mirror.json \
  --source-root "$RESTORE_ROOT/media" \
  --destination local \
  --destination-root .tmp/hpa-231-final-plan-destination \
  --json > .tmp/hpa-231-final-restore-plan.json
```

Then compare `.tmp/hpa-231-final-restore-plan.json` with `.tmp/hpa-231-publish.json` for exact `releaseId` and `manifestSha256` equality.

- [ ] **Step 4: Run final primary production public + browser verification in a fresh shell**

```bash
PRIMARY_RELEASE_ID=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.releaseId)')
PRIMARY_MANIFEST_SHA256=$(bun -e 'const r=await Bun.file(".tmp/hpa-231-publish.json").json(); console.log(r.manifestSha256)')

bun packages/infra-cloudflare/src/verify.ts \
  --story the_seventh_mirror \
  --environment production \
  --expect-manifest-sha256 "$PRIMARY_MANIFEST_SHA256" \
  --asset-base-url https://assets.aquila.cwchanap.dev \
  --json

BASE_URL=https://aquila.cwchanap.dev \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$PRIMARY_RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$PRIMARY_MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID= \
bun --filter e2e test:release-gate
```

Expected: production still serves the intended primary release after repository cleanup.

- [ ] **Step 5: Finalize the runbook in plain Markdown**

Record:

- included/omitted/total counts;
- unreferenced-source review result;
- archive ID/prefix and restore result;
- primary release ID/checksum;
- HPA-233/manual review result;
- production Vercel asset-source configuration and network preflight;
- primary production smoke;
- synthetic release ID/checksum;
- rollback/activation-back/final-primary results;
- current-HEAD cleanup and fixture sizes;
- final verification commands;
- explicit statement that Git history still retains historical large blobs.

Do not add an evidence schema.

- [ ] **Step 6: Commit the final runbook**

```bash
git add docs/infrastructure/the-seventh-mirror-r2-migration.md
git commit -m "docs: finalize Seventh Mirror R2 migration"
```

- [ ] **Step 7: Add one concise HPA-231 completion comment**

Summarize the concrete values above, including the v1 snapshot boundary and Git-history boundary.

- [ ] **Step 8: Move HPA-231 to Done, then close HPA-216**

Only after all HPA-231 acceptance criteria are proven. HPA-216 must not be closed first.

---

## Self-Review Checklist

- [ ] Existing HPA-230 coverage logic, not a hand-rolled duplicate, validates the production plan.
- [ ] The structural test does not depend on production source existence and only asserts `included > 0` beyond the existing coverage contract.
- [ ] The plan remains an explicit release decision; no permanent auto-sync script can silently ship newly appearing art.
- [ ] Both generated→disk and disk→generated mapping directions are reviewed before archive creation.
- [ ] Every shell block re-derives identifiers from `.tmp` files/reports and works in a fresh shell.
- [ ] The archive is a checksummed/restorable v1 snapshot, not a complete-art claim.
- [ ] The primary candidate gets the existing HPA-233 gate; the synthetic peer does not get a redundant second gate.
- [ ] Production Vercel R2 wiring is deployed once before pointer activation.
- [ ] Synthetic rollback proof uses normal `activate` after rollback, never `--reactivate`.
- [ ] The primary release is restored before cleanup and re-verified after cleanup.
- [ ] Four retained PNG fixtures keep the builder's existing 960×540 / 450×600 targets.
- [ ] Each source fixture is ≤ 768 KiB and all four total ≤ 3 MiB.
- [ ] Footprint checks extend the existing visual-fixture verifier and one CI step; no second guard script exists.
- [ ] Git history rewrite is explicitly out of scope; only current HEAD/canonical delivery paths are cleaned.
- [ ] No new schema/version/storage/runtime/release framework is introduced.
