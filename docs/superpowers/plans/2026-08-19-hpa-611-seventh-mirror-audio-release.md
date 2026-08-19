# HPA-611 Seventh Mirror Audio Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, curate, locally encode, preview-verify, publish, activate, rollback, and reactivate The Seventh Mirror's approved SFX/BGM pack using the already-merged Aquila audio toolchain.

**Architecture:** Keep HPA-611 as an operational release run. Prove local encoder/publisher prerequisites before provider spend, freeze one input set, derive one listening worksheet from the compiler report, prove final selections with a local publish, then approve the exact candidate in the deployed preview before any HPA-611 production R2 write. Republish the same frozen inputs to production and require identical audio `releaseId` + `manifestSha256`; only then retain/create the rollback target and mutate the production pointer.

**Tech Stack:** Bun, TypeScript/Vitest, HPA-608 ElevenLabs generation store, HPA-609 local/R2 publisher and public verifier, HPA-610 reader, deployed Playwright release gate, Linear release evidence.

**Spec:** `docs/superpowers/specs/2026-08-19-hpa-611-seventh-mirror-audio-release-design.md`

## Global Constraints

- One HPA-611 branch/PR. Do not split the invariant test, omissions metadata, or a smallest blocker fix into another PR.
- No planned production/runtime feature code. The only planned source-tree code change is one focused regression test for target-independent audio identity.
- Production binaries, provider receipts, generated candidates, selections, and run reports stay out of git.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` remains the only creative generation plan.
- Every compiler-used cue must end selected or explicitly omitted with a non-empty reason.
- Initial generation uses one candidate per unresolved cue; additional candidates are generated only for rejected keys.
- Paid generation uses the exact dry-run scheduled request count as the initial hard request cap.
- Before any paid request, prove `ffmpeg`/`ffprobe` are runnable, required R2 credential variables are present, current provider/account/terms evidence is recorded, and the HPA-608 music terms note exists.
- Before any R2 write, the final selected sources must pass the existing audio publisher against a local destination.
- Audio `publish` never activates production. Production pointer mutation is an explicit `activate --media audio` with exact story confirmation.
- Preview and production publication of frozen inputs must produce identical `releaseId` and `manifestSha256`; mismatch is a hard stop.
- Resolve the preview ID from the deployed preview/Vercel environment, never operator memory.
- If no valid active production audio baseline exists, publish an immutable all-omitted silent candidate only after preview approval and after the real production candidate is published/verified.
- Rollback/reactivation are pointer-only. Never delete immutable objects, manifests, archives, or historical releases.
- If a real blocker requires product/runtime code, fix only the smallest owning module on this same HPA-611 PR and expand verification only for that changed code.

---

## File / state map

### Planned tracked change before provider spend

- Modify/Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts` — pin preview/production target-invariant `releaseId`, manifest SHA, and manifest bytes.

### Read-only repository inputs

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` — frozen creative generation plan.
- `packages/stories/src/compiler/cli.ts` — deterministic cue usage with all placements and BGM stops.
- `packages/stories/src/audio-generation/cli.ts` — dry-run, paid generation, selection.
- `packages/infra-cloudflare/src/publisher/cli.ts` — local/R2 publication and release lifecycle.
- `packages/infra-cloudflare/src/verify.ts` — credential-free public candidate/active verification.
- `packages/e2e/tests/visual-novel-deployed.spec.ts` — deployed visual + audio release gate.
- `apps/web/scripts/asset-preview-id.ts` — effective preview-ID build contract.

### Optional tracked execution output

- `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` — create only for real final omissions.

### Uncommitted run state

- `.tmp/audio-generation/theSeventhMirror/**` — provider candidates, receipts, `music-terms-note.md`, selection.
- `.tmp/hpa-611/**` — hashes, compiler report, derived listening worksheet, local publish, preview/production reports, run-scoped silent baseline inputs.
- R2 `aquila-vn-source` — selected source/receipt archives.
- R2 `aquila-vn-delivery` — immutable MP3/manifests and mutable pointers.

---

## Task 1: Preflight the machine, pin the identity invariant, and freeze the paid boundary

**Files / state:**
- Modify/Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`
- Create untracked: `.tmp/hpa-611/base-commit.txt`
- Create untracked: `.tmp/hpa-611/audio-plan.sha256`
- Create untracked: `.tmp/hpa-611/audio-report.json`
- Create untracked: `.tmp/hpa-611/listening-worksheet.md`
- Create untracked: `.tmp/hpa-611/generation-dry-run.json`
- Create untracked: `.tmp/hpa-611/initial-request-cap.txt`
- Create untracked: `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`
- Update: Linear HPA-611 freeze evidence

**Produces:** a clean frozen commit, target-invariance regression, disposable story-location worksheet, and `INITIAL_REQUEST_CAP`. Performs no paid provider call and no R2 write.

- [ ] **Step 1: Prove the exact encoder executables the publisher needs are runnable**

```bash
ffmpeg -hide_banner -version >/dev/null
ffprobe -hide_banner -version >/dev/null
```

Expected: both exit `0`. These are the same executable/argument pairs used by `assertAudioToolsAvailable()`.

- [ ] **Step 2: Fail closed when required R2 credential configuration is absent**

```bash
bun -e '
const names = [
  "R2_PUBLISHER_ACCESS_KEY_ID",
  "R2_PUBLISHER_SECRET_ACCESS_KEY",
  "R2_SOURCE_ARCHIVE_ACCESS_KEY_ID",
  "R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY",
];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`missing required release credentials: ${missing.join(", ")}`);
console.log("required R2 credential variables are present");
'
```

This proves configuration presence without printing values. Actual R2 access is proved later by preview publication/verification; do not add a new credential-probe command.

- [ ] **Step 3: Add the target-invariance regression to the existing publisher unit test**

Add this case inside the existing `describe('buildPreparedAudioRelease', ...)` in `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`:

```ts
it('keeps runtime release identity independent of publication target', () => {
    const production = buildPreparedAudioRelease({
        storyId,
        target: { kind: 'production' },
        assets: [sfx, bgm],
        coverage,
    });
    const preview = buildPreparedAudioRelease({
        storyId,
        target: { kind: 'preview', previewId: 'hpa-611-test' },
        assets: [sfx, bgm],
        coverage,
    });

    expect(preview.releaseId).toBe(production.releaseId);
    expect(preview.manifestSha256).toBe(production.manifestSha256);
    expect(preview.manifestBytes).toEqual(production.manifestBytes);
    expect(preview.target).not.toEqual(production.target);
});
```

Do not change `buildPreparedAudioRelease()` unless the test exposes a real regression; current `main` should already satisfy it by construction.

- [ ] **Step 4: Run the focused invariant test and commit it on this HPA-611 branch**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/audio-runtime-release.test.ts

git add packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts
git commit -m "test(audio): pin release target invariance"
```

Expected: focused test file passes. This is a test-only contract pin, not a publisher feature.

- [ ] **Step 5: Freeze the post-test commit and audio plan**

```bash
mkdir -p .tmp/hpa-611

git status --short
git rev-parse HEAD | tee .tmp/hpa-611/base-commit.txt
shasum -a 256 packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  | tee .tmp/hpa-611/audio-plan.sha256
```

Expected: no unexplained tracked change. Freeze occurs **after** the target-invariance test commit so later HEAD checks stay meaningful.

- [ ] **Step 6: Retain deterministic compiler coverage**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/audio-report.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.story !== "theSeventhMirror") throw new Error("wrong story report");
if (!Array.isArray(r.assets) || !Array.isArray(r.bgmStops) || !Array.isArray(r.unused)) {
  throw new Error("malformed audio report");
}
if (r.unused.length !== 0) throw new Error(`unused audio-plan rows: ${r.unused.length}`);
const sfx = r.assets.filter((x) => x.type === "sfx").length;
const bgm = r.assets.filter((x) => x.type === "bgm").length;
console.log(JSON.stringify({ assets: r.assets.length, sfx, bgm, bgmStops: r.bgmStops.length }));
' .tmp/hpa-611/audio-report.json
```

Current sanity expectation: 41 used cues, 28 SFX, 13 BGM, zero unused plan rows. `bgmStops` count comes from the frozen report; do not hand-maintain it.

- [ ] **Step 7: Derive one disposable listening worksheet from that report**

```bash
bun -e '
const report = await Bun.file(process.argv[1]).json();
const esc = (value) => String(value).replaceAll("|", "\\|");
const rows = [
  "# HPA-611 Listening Worksheet",
  "",
  "> Derived from the frozen compiler audio report. Disposable navigation view; not a second source of truth.",
  "",
  "| Kind | Cue/location | Count | Story locations |",
  "| --- | --- | ---: | --- |",
];
for (const asset of report.assets) {
  const locations = asset.usages
    .map((u) => `${esc(u.sceneId)}#${u.entryIndex} — ${esc(u.sourcePath)}`)
    .join("<br>");
  rows.push(`| cue | \`${asset.type}:${asset.key}\` | ${asset.usageCount} | ${locations} |`);
}
for (const stop of report.bgmStops) {
  rows.push(`| bgm-stop | \`bgm:stop\` | 1 | ${esc(stop.sceneId)}#${stop.entryIndex} — ${esc(stop.sourcePath)} |`);
}
await Bun.write(process.argv[2], rows.join("\n") + "\n");
' .tmp/hpa-611/audio-report.json .tmp/hpa-611/listening-worksheet.md
```

Curation and preview review must use this file for cue reuse sites and explicit BGM stops. Recreate it whenever the report is re-frozen.

- [ ] **Step 8: Run the no-cost HPA-608 generation plan**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run \
  > .tmp/hpa-611/generation-dry-run.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.error) throw new Error(JSON.stringify(r.error));
if (!Array.isArray(r.scheduledRequests)) throw new Error("missing scheduledRequests");
if ((r.providerIssues?.length ?? 0) !== 0) throw new Error("provider issues remain");
console.log(JSON.stringify({
  assetCount: r.assetCount,
  scheduledRequests: r.scheduledRequests.length,
  estimate: r.estimate,
}));
' .tmp/hpa-611/generation-dry-run.json
```

- [ ] **Step 9: Retain the exact initial paid request cap**

```bash
bun -e '
const r = await Bun.file(process.argv[1]).json();
console.log(r.scheduledRequests.length);
' .tmp/hpa-611/generation-dry-run.json \
  | tee .tmp/hpa-611/initial-request-cap.txt
```

Never round the cap upward. Zero means the initial paid generation step is already satisfied by resumable current-spec candidates.

- [ ] **Step 10: Complete the dated human terms/account check and HPA-608 note**

Record the current ElevenLabs account/model availability, applicable Music/model terms source/date, distribution conclusion, and current estimate/credits where calculable in Linear.

Set `MUSIC_TERMS_NOTE` to the actual short note and write the HPA-608-required local file:

```bash
test -n "${MUSIC_TERMS_NOTE:-}"
mkdir -p .tmp/audio-generation/theSeventhMirror
printf '%s\n' "$MUSIC_TERMS_NOTE" \
  > .tmp/audio-generation/theSeventhMirror/music-terms-note.md
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

Add one HPA-611 Linear freeze comment containing base commit, audio-plan SHA-256, compiler counts, worksheet provenance, dry-run count/cap, and terms/account check. Do not paste secrets or receipts.

**Gate:** Task 2 cannot run a paid provider request until every Task 1 check is complete. No production R2 object has been written.

---

## Task 2: Generate, curate, omit if needed, and prove every final source through local publish

**Files / state:**
- Modify untracked: `.tmp/audio-generation/theSeventhMirror/**`
- Create untracked: `.tmp/hpa-611/generation-paid.json`
- Conditionally create tracked: `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`
- Create untracked: `.tmp/hpa-611/final-audio-report.json`
- Create untracked: `.tmp/hpa-611/local-audio-publish/**`
- Create untracked: `.tmp/hpa-611/local-audio-publish-report.json`
- Create untracked: `.tmp/hpa-611/frozen-selection.sha256`
- Create untracked: `.tmp/hpa-611/frozen-omissions.sha256`

**Produces:** final selection/omission decisions plus a locally encoded and verified immutable release candidate. Performs no R2 write.

- [ ] **Step 1: Recheck the frozen commit/plan and music prerequisite**

```bash
test "$(git rev-parse HEAD)" = "$(cat .tmp/hpa-611/base-commit.txt)"
shasum -a 256 -c .tmp/hpa-611/audio-plan.sha256
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

- [ ] **Step 2: Run the bounded paid pass only when the retained cap is non-zero**

```bash
INITIAL_REQUEST_CAP=$(cat .tmp/hpa-611/initial-request-cap.txt)

if [ "$INITIAL_REQUEST_CAP" -gt 0 ]; then
  bun packages/stories/src/audio-generation/cli.ts generate \
    --story theSeventhMirror \
    --missing \
    --candidate-count 1 \
    --max-requests "$INITIAL_REQUEST_CAP" \
    > .tmp/hpa-611/generation-paid.json
else
  cp .tmp/hpa-611/generation-dry-run.json .tmp/hpa-611/generation-paid.json
fi
```

Never put `ELEVENLABS_API_KEY` on the command line or in retained output.

- [ ] **Step 3: Prove the one-candidate target is satisfied**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run \
  > .tmp/hpa-611/generation-after-initial.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.scheduledRequests.length !== 0) throw new Error("initial candidate target is incomplete");
' .tmp/hpa-611/generation-after-initial.json
```

If provider failure left work unresolved, investigate that key and resume; do not increase the global cap speculatively.

- [ ] **Step 4: Curate candidates using the frozen worksheet, not isolated filenames alone**

Open `.tmp/hpa-611/listening-worksheet.md` beside the candidate files/receipts under:

```text
.tmp/audio-generation/theSeventhMirror/<key>/candidate-NNN.*
.tmp/audio-generation/theSeventhMirror/<key>/candidate-NNN.receipt.json
```

For every used key, inspect the worksheet-provided story locations while reviewing the candidate. For recurring cues, inspect the first placement and at least one later reuse site. Explicit `bgm:stop` rows are reviewed as part of the intended surrounding BGM/silence transitions.

Review SFX for onset/tail/recognizability/continuity/artifacts and BGM for mood/loop/continuity/spoilers/vocals/artifacts/relative level. Candidate selection remains human; do not add ranking automation.

- [ ] **Step 5: Select accepted candidates through HPA-608**

For each actual reviewed pair:

```bash
bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key "$AUDIO_KEY" \
  --candidate "$CANDIDATE_ID"
```

The CLI verifies current spec/source hashes before updating `selection.json`.

- [ ] **Step 6: Generate one additional candidate only for a rejected key**

For an actual rejected key:

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key "$AUDIO_KEY" \
  --candidate-count 2 \
  --max-requests 1 \
  > ".tmp/hpa-611/regenerate-${AUDIO_KEY}.json"
```

If a second candidate is rejected, repeat with `--candidate-count 3 --max-requests 1`. Do not touch approved keys.

- [ ] **Step 7: Record only real final omissions**

If every used cue is selected, keep `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` absent.

If real omissions exist, create that file with HPA-609's existing v1 schema:

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "omissions": {
    "actual-used-cue-key": "actual short human review reason"
  }
}
```

Replace the example with only actual omitted used keys/reasons before continuing. An omitted key must not remain selected.

- [ ] **Step 8: Re-run compiler authority and require it to match the freeze**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/final-audio-report.json
cmp .tmp/hpa-611/audio-report.json .tmp/hpa-611/final-audio-report.json
```

Any difference means cue placement/plan authority moved and requires Task 1 re-freeze before publication.

- [ ] **Step 9: Local-publish the final selected sources so encoding fails before R2**

```bash
rm -rf .tmp/hpa-611/local-audio-publish

bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment preview \
  --preview-id hpa-611-local-encode \
  --generation-root .tmp/audio-generation \
  --destination local \
  --destination-root .tmp/hpa-611/local-audio-publish \
  --json > .tmp/hpa-611/local-audio-publish-report.json
```

This is deliberately `publish`, not `plan`: it runs the actual encoder/prober for every selected source and writes only `.tmp/hpa-611/local-audio-publish/{source,delivery}`.

- [ ] **Step 10: Deep-verify the local immutable candidate**

```bash
LOCAL_RELEASE_ID=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.releaseId !== "string") throw new Error("missing releaseId");
console.log(r.releaseId);
' .tmp/hpa-611/local-audio-publish-report.json)

LOCAL_MANIFEST_SHA256=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(r.manifestSha256);
' .tmp/hpa-611/local-audio-publish-report.json)

bun --filter @aquila/infra-cloudflare assets -- verify \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id hpa-611-local-encode \
  --release "$LOCAL_RELEASE_ID" \
  --expect-manifest-sha256 "$LOCAL_MANIFEST_SHA256" \
  --destination local \
  --destination-root .tmp/hpa-611/local-audio-publish \
  --deep \
  --json > .tmp/hpa-611/local-audio-deep-verify.json
```

**Gate:** no R2 write until local publish and deep verify pass.

- [ ] **Step 11: Freeze selection/omission inputs for preview/production equality**

```bash
shasum -a 256 .tmp/audio-generation/theSeventhMirror/selection.json \
  | tee .tmp/hpa-611/frozen-selection.sha256

if [ -f packages/stories/raw/theSeventhMirror/docs/audio-omissions.json ]; then
  shasum -a 256 packages/stories/raw/theSeventhMirror/docs/audio-omissions.json \
    | tee .tmp/hpa-611/frozen-omissions.sha256
else
  printf '%s\n' absent > .tmp/hpa-611/frozen-omissions.sha256
fi
```

Do not edit cue placement, audio plan, selection, or omissions after this point. A curation change returns to the relevant Task 1/2 step and repeats local publish before preview.

---

## Task 3: Publish and approve the exact deployed-preview candidate

**Files / state:**
- Read effective deployed preview ID and active visual release
- Create preview audio immutable state in R2
- Mutate preview audio pointer only after candidate verification
- Create `.tmp/hpa-611/preview-*.json`

**Produces:** retained preview audio identity and human/deployed approval. This is the first R2 write in HPA-611; production R2 remains untouched.

- [ ] **Step 1: Copy the effective preview ID from the deployed preview, not memory**

Open the actual deployed preview reader and read the stable `reader-ready` host's `data-asset-preview-id` value. If the Vercel preview has an explicit `PUBLIC_ASSET_PREVIEW_ID`, cross-check that it matches.

Record the exact effective value:

```bash
printf '%s\n' "$PREVIEW_ID" > .tmp/hpa-611/effective-preview-id.txt

bun -e '
const value = (await Bun.file(process.argv[1]).text()).trim();
if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) throw new Error("invalid preview id");
console.log(value);
' .tmp/hpa-611/effective-preview-id.txt
```

`PREVIEW_ID` must be the copied deployed value used by both visual/audio preview pointers and later `RELEASE_GATE_PREVIEW_ID`. Do not derive or invent a different HPA-611 ID at the terminal.

- [ ] **Step 2: Retain the active visual identity in that exact namespace**

```bash
PREVIEW_ID=$(cat .tmp/hpa-611/effective-preview-id.txt)

bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/preview-visual-releases.json
```

Require exactly one intended active visual release and require it to be deep-verified. Retain its `releaseId` and `manifestSha256` as `PREVIEW_VISUAL_RELEASE_ID` / `PREVIEW_VISUAL_MANIFEST_SHA256`. This is a backstop after the preview ID was copied from deployed configuration.

- [ ] **Step 3: Recheck frozen selection/omissions before the first R2 write**

```bash
shasum -a 256 -c .tmp/hpa-611/frozen-selection.sha256

if ! grep -qx absent .tmp/hpa-611/frozen-omissions.sha256; then
  shasum -a 256 -c .tmp/hpa-611/frozen-omissions.sha256
else
  test ! -f packages/stories/raw/theSeventhMirror/docs/audio-omissions.json
fi
```

- [ ] **Step 4: Publish frozen audio inputs into preview**

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --generation-root .tmp/audio-generation \
  --destination r2 \
  --json > .tmp/hpa-611/preview-audio-publish.json

PREVIEW_AUDIO_RELEASE_ID=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.releaseId !== "string") throw new Error("missing releaseId");
console.log(r.releaseId);
' .tmp/hpa-611/preview-audio-publish.json)

PREVIEW_AUDIO_MANIFEST_SHA256=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(r.manifestSha256);
' .tmp/hpa-611/preview-audio-publish.json)
```

- [ ] **Step 5: Deep-verify the stored preview candidate**

```bash
bun --filter @aquila/infra-cloudflare assets -- verify \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$PREVIEW_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PREVIEW_AUDIO_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/preview-audio-stored-verify.json
```

- [ ] **Step 6: Derive one real private archive probe for a non-empty release**

```bash
ARCHIVE_PROBE_KEY=$(bun -e '
const root = ".tmp/audio-generation/theSeventhMirror";
const selection = await Bun.file(`${root}/selection.json`).json();
const first = Object.entries(selection.selections)[0];
if (!first) throw new Error("no selected source for archive probe");
const [key, picked] = first;
const receipt = await Bun.file(`${root}/${key}/${picked.candidateId}.receipt.json`).json();
const dot = receipt.output.filename.lastIndexOf(".");
if (dot < 0) throw new Error("candidate filename has no extension");
const ext = receipt.output.filename.slice(dot + 1);
console.log(`audio/approved/the_seventh_mirror/${receipt.type}/${key}/${picked.sourceSha256}/source.${ext}`);
')
```

The path is probed only through the public delivery hostname and must return exact 404.

- [ ] **Step 7: Run the public preview candidate verifier**

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$PREVIEW_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PREVIEW_AUDIO_MANIFEST_SHA256" \
  --archive-probe-key "$ARCHIVE_PROBE_KEY" \
  --json > .tmp/hpa-611/preview-audio-public-candidate-verify.json
```

Expected: manifest/object integrity, MIME/cache, one Range 206, and archive 404 all pass.

- [ ] **Step 8: Activate only the preview audio pointer and verify active public state**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --release "$PREVIEW_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PREVIEW_AUDIO_MANIFEST_SHA256" \
  --destination r2 \
  --json > .tmp/hpa-611/preview-audio-activate.json

bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --archive-probe-key "$ARCHIVE_PROBE_KEY" \
  --json > .tmp/hpa-611/preview-audio-public-active-verify.json
```

- [ ] **Step 9: Run the deployed preview release gate pinned to visual + audio identities**

```bash
BASE_URL="$DEPLOYED_PREVIEW_URL" \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$PREVIEW_VISUAL_RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$PREVIEW_VISUAL_MANIFEST_SHA256" \
RELEASE_GATE_PREVIEW_ID="$PREVIEW_ID" \
RELEASE_GATE_AUDIO_RELEASE_ID="$PREVIEW_AUDIO_RELEASE_ID" \
RELEASE_GATE_AUDIO_MANIFEST_SHA256="$PREVIEW_AUDIO_MANIFEST_SHA256" \
VERCEL_AUTOMATION_BYPASS_SECRET="$VERCEL_AUTOMATION_BYPASS_SECRET" \
bun --filter e2e test:release-gate
```

If the preview is not protected, omit the bypass variable rather than inventing one.

- [ ] **Step 10: Perform the bounded in-story direction review using the same worksheet**

Use `.tmp/hpa-611/listening-worksheet.md` to navigate, not an ad-hoc stroll:

- check every explicit `bgm:stop` row for intended silence transition;
- for recurring cues, check the first placement and at least one later reuse site;
- cover early/middle/late, quiet, supernatural/reveal, high-tension, BGM continuation/change, available branch/choice, desktop/mobile, headphones/speakers, controls, and muted readability.

If one cue fails, return to Task 2 for only that key, reselect, rerun local publish/deep verify, then republish/approve a new preview candidate. **Do not write production R2 while preview is unapproved.**

---

## Task 4: Publish the same frozen candidate to production and enforce identity equality

**Files / state:**
- Create production audio immutable candidate in R2; no pointer mutation
- Create `.tmp/hpa-611/production-audio-*.json`

**Produces:** verified production candidate whose identity is exactly equal to preview.

- [ ] **Step 1: Recheck frozen selection/omission inputs after preview approval**

Repeat Task 3 Step 3. A changed hash sends the run back through local publish + preview approval.

- [ ] **Step 2: Publish candidate-only to production from the same frozen inputs**

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment production \
  --generation-root .tmp/audio-generation \
  --destination r2 \
  --json > .tmp/hpa-611/production-audio-publish.json

PRODUCTION_AUDIO_RELEASE_ID=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.releaseId !== "string") throw new Error("missing releaseId");
console.log(r.releaseId);
' .tmp/hpa-611/production-audio-publish.json)

PRODUCTION_AUDIO_MANIFEST_SHA256=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(r.manifestSha256);
' .tmp/hpa-611/production-audio-publish.json)
```

Audio publish never writes `current.json`.

- [ ] **Step 3: Enforce exact preview/production identity parity**

```bash
test "$PRODUCTION_AUDIO_RELEASE_ID" = "$PREVIEW_AUDIO_RELEASE_ID"
test "$PRODUCTION_AUDIO_MANIFEST_SHA256" = "$PREVIEW_AUDIO_MANIFEST_SHA256"
```

Mismatch is a hard stop; do not approve by ear.

- [ ] **Step 4: Deep-verify and publicly verify the production candidate**

```bash
bun --filter @aquila/infra-cloudflare assets -- verify \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRODUCTION_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PRODUCTION_AUDIO_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-audio-stored-candidate-verify.json

bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRODUCTION_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PRODUCTION_AUDIO_MANIFEST_SHA256" \
  --archive-probe-key "$ARCHIVE_PROBE_KEY" \
  --json > .tmp/hpa-611/production-audio-public-candidate-verify.json
```

**Gate:** do not activate yet. Task 5 must retain a verified rollback target first.

---

## Task 5: Retain or create the rollback target immediately before activation

**Files / state:**
- Create untracked: `.tmp/hpa-611/production-audio-releases-before-activation.json`
- Conditionally create untracked: `.tmp/hpa-611/no-audio-omissions.json`
- Conditionally create untracked: `.tmp/hpa-611/silent-generation/`
- Conditionally create one zero-asset production audio manifest; still no pointer mutation
- Create untracked: rollback identity files

**Produces:** `ROLLBACK_RELEASE_ID` + `ROLLBACK_MANIFEST_SHA256` without altering the active production pointer.

- [ ] **Step 1: List/deep-verify production audio history and inspect pointer state now**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-audio-releases-before-activation.json
```

Inspect `warnings` and `releases`.

- If there is a pointer-invalid warning, stop; do not treat it as no audio.
- If a valid prior `active: true` release exists, require `manifestValid`, `releaseIdentityValid`, `shallowVerified`, and `deepVerified`, then retain its ID/checksum.
- If no active audio pointer exists, create the explicit silent baseline below.
- The newly published HPA-611 production candidate must still be inactive.

- [ ] **Step 2: First production audio release only — derive all-omitted coverage from compiler authority**

```bash
rm -rf .tmp/hpa-611/silent-generation
mkdir -p .tmp/hpa-611/silent-generation

bun -e '
const report = await Bun.file(process.argv[1]).json();
const omissions = Object.fromEntries(
  report.assets.map((asset) => [asset.key, "HPA-611 explicit no-audio rollback baseline"])
);
await Bun.write(
  process.argv[2],
  JSON.stringify({ schemaVersion: 1, storyId: "the_seventh_mirror", omissions }, null, 2) + "\n"
);
' .tmp/hpa-611/audio-report.json .tmp/hpa-611/no-audio-omissions.json
```

Use the dedicated empty generation root so final selections cannot conflict with all-omitted coverage.

- [ ] **Step 3: Publish the silent production candidate without activation**

Run only when Task 5 Step 1 found no valid active baseline:

```bash
bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment production \
  --generation-root .tmp/hpa-611/silent-generation \
  --omissions .tmp/hpa-611/no-audio-omissions.json \
  --destination r2 \
  --json > .tmp/hpa-611/silent-baseline-publish.json

ROLLBACK_RELEASE_ID=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.releaseId !== "string") throw new Error("missing releaseId");
console.log(r.releaseId);
' .tmp/hpa-611/silent-baseline-publish.json)

ROLLBACK_MANIFEST_SHA256=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (typeof r.manifestSha256 !== "string") throw new Error("missing manifestSha256");
console.log(r.manifestSha256);
' .tmp/hpa-611/silent-baseline-publish.json)
```

Expected: zero included MP3s, all compiler-used cues omitted, no pointer write.

- [ ] **Step 4: Verify the silent baseline without the non-empty deployed audio gate**

```bash
bun --filter @aquila/infra-cloudflare assets -- verify \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/silent-baseline-stored-verify.json

bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --json > .tmp/hpa-611/silent-baseline-public-verify.json
```

Do **not** run `test:release-gate` against this zero-asset baseline: `findAudioGateAnchors()` correctly has no included BGM/SFX anchors. Stored/public manifest verification plus the rollback reader silence/usability smoke in Task 6 is the correct proof.

- [ ] **Step 5: Persist the rollback identity**

For an existing active release, assign its retained deep-verified ID/checksum. For the silent case, use the values above. Then:

```bash
printf '%s\n' "$ROLLBACK_RELEASE_ID" > .tmp/hpa-611/rollback-release-id.txt
printf '%s\n' "$ROLLBACK_MANIFEST_SHA256" > .tmp/hpa-611/rollback-manifest-sha256.txt
```

---

## Task 6: Activate, smoke, rollback, and reactivate

**Files / state:**
- Mutate production audio pointer three times at most: activate, rollback, reactivate
- Create `.tmp/hpa-611/production-*.json`

**Produces:** go-live plus pointer-only recovery proof.

- [ ] **Step 1: Retain the currently active production visual identity**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-visual-releases.json
```

Require the intended active visual release to deep-verify; retain its ID/checksum as `PRODUCTION_VISUAL_RELEASE_ID` / `PRODUCTION_VISUAL_MANIFEST_SHA256`. Do not republish visuals.

- [ ] **Step 2: Activate the approved HPA-611 production audio pointer**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRODUCTION_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PRODUCTION_AUDIO_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-611/production-audio-activate.json
```

Expected: pointer-only write.

- [ ] **Step 3: Verify active public state and the deployed production gate**

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --archive-probe-key "$ARCHIVE_PROBE_KEY" \
  --json > .tmp/hpa-611/production-audio-public-active-verify.json

BASE_URL="$DEPLOYED_PRODUCTION_URL" \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$PRODUCTION_VISUAL_RELEASE_ID" \
RELEASE_GATE_MANIFEST_SHA256="$PRODUCTION_VISUAL_MANIFEST_SHA256" \
RELEASE_GATE_AUDIO_RELEASE_ID="$PRODUCTION_AUDIO_RELEASE_ID" \
RELEASE_GATE_AUDIO_MANIFEST_SHA256="$PRODUCTION_AUDIO_MANIFEST_SHA256" \
bun --filter e2e test:release-gate
```

Perform the short production reader smoke from the approved preview worksheet: one SFX, BGM start/continue/stop, navigation, controls, muted/Text mode.

- [ ] **Step 4: Roll back to the retained prior/silent immutable release**

```bash
ROLLBACK_RELEASE_ID=$(cat .tmp/hpa-611/rollback-release-id.txt)
ROLLBACK_MANIFEST_SHA256=$(cat .tmp/hpa-611/rollback-manifest-sha256.txt)

bun --filter @aquila/infra-cloudflare assets -- rollback \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$ROLLBACK_RELEASE_ID" \
  --expect-manifest-sha256 "$ROLLBACK_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-611/production-rollback.json
```

- [ ] **Step 5: Verify rollback behavior**

Always run active public audio verification:

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --json > .tmp/hpa-611/production-rollback-public-verify.json
```

If the rollback target is the all-omitted silent baseline, do a simple deployed reader smoke proving dialogue/navigation remain usable and audio is silent. Skip the full audio release gate because the empty manifest has no BGM/SFX anchors.

If the rollback target is a previous non-empty release, run the deployed audio release gate pinned to that retained release ID/checksum and a representative playback smoke.

- [ ] **Step 6: Reactivate the approved HPA-611 release**

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --release "$PRODUCTION_AUDIO_RELEASE_ID" \
  --expect-manifest-sha256 "$PRODUCTION_AUDIO_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > .tmp/hpa-611/production-reactivate.json
```

Repeat Task 6 Step 3. Production must again report the exact approved HPA-611 audio identity.

---

## Task 7: Run scoped repository checks, commit only real release metadata, and close Linear

**Files / state:**
- Already tracked by this PR: design/plan docs and target-invariance unit test
- Conditionally tracked: `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`
- Update: Linear HPA-611 final evidence

**Produces:** final single-PR release/evidence closeout without redundant local suites.

- [ ] **Step 1: Run the default scoped verification for an operational/test-only release branch**

When the branch contains only the planning docs, target-invariance test, and optional omissions metadata:

```bash
bun compile:stories
bun run compile:check
bun --filter @aquila/stories test
bun --filter @aquila/infra-cloudflare test
git diff --check
```

These checks cover compiler drift, audio plan/omission contracts, and the publisher invariant. The credentialed deployed audio path was already exercised by `bun --filter e2e test:release-gate` in Tasks 3 and 6.

Do **not** run `bun --filter e2e test:e2e` merely for release ceremony: `playwright.config.ts` explicitly ignores `visual-novel-deployed.spec.ts`, so that local suite does not prove the release gate.

- [ ] **Step 2: Expand verification only when a real blocker fix changed product/runtime code**

If HPA-611 had to change implementation code beyond the planned unit test/omission metadata:

1. run the affected workspace's focused/unit tests;
2. run `bun run lint` and `bun run build`;
3. run web/local E2E suites only when the blocker changed web/e2e behavior those suites actually exercise.

Do not add unrelated repo-wide suites to a docs/test/metadata-only release branch.

- [ ] **Step 3: Inspect tracked scope**

```bash
git status --short
git diff --name-only main...HEAD
```

Expected default tracked scope:

```text
docs/superpowers/plans/2026-08-19-hpa-611-seventh-mirror-audio-release.md
docs/superpowers/specs/2026-08-19-hpa-611-seventh-mirror-audio-release-design.md
packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts
```

`packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` appears only when real final omissions exist. Any other source file must be the smallest explicitly justified blocker fix.

No `.tmp`, generated audio, provider receipt, selection, local absolute path, or binary is tracked.

- [ ] **Step 4: Commit real final omissions only when present**

```bash
if [ -f packages/stories/raw/theSeventhMirror/docs/audio-omissions.json ]; then
  git add packages/stories/raw/theSeventhMirror/docs/audio-omissions.json
  git commit -m "chore(audio): record Seventh Mirror release omissions"
fi
```

Do not create an empty omissions file for ceremony.

- [ ] **Step 5: Add the final concise HPA-611 Linear evidence**

Record:

- frozen commit + audio-plan SHA-256;
- compiler 28 SFX / 13 BGM sanity count, BGM-stop count, and worksheet provenance;
- tool/credential-presence preflight result;
- initial request cap, actual provider requests, current cost/credits where calculable;
- terms/account check date/source and music note gate;
- selected/omitted counts;
- local encode/deep-verify result;
- effective preview ID and how it was obtained;
- preview audio release ID/checksum and stored/public/deployed/manual review results;
- production release ID/checksum and exact preview equality result;
- private archive/public 404 proof;
- retained prior/silent rollback baseline ID/checksum;
- activation, rollback, reactivation results;
- scoped final repository checks;
- deferred creative ideas outside HPA-611.

Do not include secrets or full private provider receipts.

- [ ] **Step 6: Final scope check**

HPA-611 closes with no new CLIs, no audio mirror-preview, no pointer deletion, no second inventory/review schema, and no second PR. If a blocker fix was necessary, verify it remains the smallest owning-module change and is covered by the conditional verification from Step 2.
