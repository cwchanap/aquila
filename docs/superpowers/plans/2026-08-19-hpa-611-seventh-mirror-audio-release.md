# HPA-611 Seventh Mirror Audio Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, curate, preview-verify, publish, activate, rollback, and reactivate The Seventh Mirror's approved SFX/BGM pack using the already-merged Aquila audio toolchain.

**Architecture:** Treat HPA-611 as an operational release run, not a new subsystem. Freeze one generation/selection input set, publish it to the existing deployed preview namespace first, then republish the same frozen inputs to production and require identical audio release ID + manifest checksum before pointer activation. If production has no prior audio release, create one immutable all-omitted silent release as the explicit pointer-only rollback baseline.

**Tech Stack:** Bun, TypeScript CLIs, HPA-608 ElevenLabs generation store, HPA-609 Cloudflare R2 publisher/verifier, HPA-610 web reader, Playwright deployed release gate, Linear release evidence.

**Spec:** `docs/superpowers/specs/2026-08-19-hpa-611-seventh-mirror-audio-release-design.md`

## Global Constraints

- One HPA-611 branch/PR. Do not split implementation or omission metadata into another PR.
- No planned runtime/product code changes; use the merged HPA-607/608/609/610 seams.
- Production binaries, provider receipts, generated candidates, selections, and run reports stay out of git.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` remains the only creative generation plan.
- Every compiler-used cue must end selected or explicitly omitted with a non-empty reason.
- Initial generation uses one candidate per unresolved cue; additional candidates are generated only for rejected keys.
- Paid generation must use the dry-run scheduled request count as the hard initial request cap.
- Re-check the current ElevenLabs account plan and applicable Music/model terms before paid generation; record the dated source/result in Linear rather than automating legal interpretation.
- After that check, create the non-empty untracked `.tmp/audio-generation/theSeventhMirror/music-terms-note.md` required by HPA-608 before any BGM provider call.
- Audio `publish` never activates production. Production pointer mutation is an explicit `activate --media audio` command with exact story confirmation.
- Preview and production publication of the frozen inputs must produce identical `releaseId` and `manifestSha256`; mismatch is a hard stop.
- Reuse the deployed preview's existing asset preview namespace. Do not invent a new preview ID unless the visual release is deliberately seeded there with the existing visual publisher.
- If no verified production audio baseline exists, use an immutable all-omitted silent audio release; do not add pointer deletion support.
- Rollback/reactivation are pointer-only; never delete immutable objects, manifests, archives, or historical releases.
- If a real repository defect blocks the release, fix only the smallest owning module on this same HPA-611 branch/PR.

---

## File / state map

### Read-only repository inputs

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` — frozen creative generation plan.
- `packages/stories/src/compiler/cli.ts` — deterministic cue-usage report.
- `packages/stories/src/audio-generation/cli.ts` — dry-run, paid generation, and selection.
- `packages/infra-cloudflare/src/publisher/cli.ts` — audio publication/lifecycle commands.
- `packages/infra-cloudflare/src/verify.ts` — credential-free public candidate/active verification.
- `packages/e2e/tests/visual-novel-deployed.spec.ts` — deployed visual + audio identity/playback gate.

### Optional tracked execution output

- `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` — create only if final human curation intentionally omits one or more compiler-used cues.

### Uncommitted run state

- `.tmp/audio-generation/theSeventhMirror/**` — provider candidates, receipts, `music-terms-note.md`, and `selection.json`.
- `.tmp/hpa-611/**` — frozen hashes, reports, silent-baseline inputs, publisher/verifier evidence.
- R2 `aquila-vn-source` — approved selected originals + receipts.
- R2 `aquila-vn-delivery` — immutable MP3 objects/manifests and mutable audio pointers.

---

## Task 1: Freeze inputs and establish the paid-generation boundary

**Files / state:**
- Read: `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- Read: current story source/compiler config
- Create untracked: `.tmp/hpa-611/base-commit.txt`
- Create untracked: `.tmp/hpa-611/audio-plan.sha256`
- Create untracked: `.tmp/hpa-611/audio-report.json`
- Create untracked: `.tmp/hpa-611/generation-dry-run.json`
- Create untracked: `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`
- Update: Linear HPA-611 evidence comment

**Produces:** one immutable release-input evidence block and `INITIAL_REQUEST_CAP` for Task 3.

- [ ] **Step 1: Start from current `main`-equivalent branch state and create the run directory**

```bash
mkdir -p .tmp/hpa-611

git status --short
git rev-parse HEAD | tee .tmp/hpa-611/base-commit.txt
shasum -a 256 packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  | tee .tmp/hpa-611/audio-plan.sha256
```

Expected: no unexplained tracked changes. The plan SHA is a real SHA-256, not a Git blob SHA.

- [ ] **Step 2: Compile and retain deterministic cue coverage**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/audio-report.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.story !== "theSeventhMirror") throw new Error("wrong story report");
if (!Array.isArray(r.assets) || !Array.isArray(r.unused)) throw new Error("malformed report");
if (r.unused.length !== 0) throw new Error(`unused audio-plan rows: ${r.unused.join(", ")}`);
const sfx = r.assets.filter((x) => x.type === "sfx").length;
const bgm = r.assets.filter((x) => x.type === "bgm").length;
console.log(JSON.stringify({ assets: r.assets.length, sfx, bgm, unused: r.unused.length }));
' .tmp/hpa-611/audio-report.json
```

Expected on the current plan: 41 compiler-used assets, 28 SFX, 13 BGM, zero unused plan rows.

- [ ] **Step 3: Run the HPA-608 no-cost generation plan**

Use the direct CLI so stdout is exactly one JSON document.

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
console.log(JSON.stringify({
  assetCount: r.assetCount,
  sfx: r.sfx,
  bgm: r.bgm,
  scheduledRequests: r.scheduledRequests.length,
  providerIssues: r.providerIssues?.length ?? 0,
  estimate: r.estimate,
}));
' .tmp/hpa-611/generation-dry-run.json
```

Expected: zero provider issues. The scheduled request count may be lower than 41 if valid current-spec candidates already exist locally. Treat the CLI's dated `estimate` as advisory and re-check current provider pricing/account state separately.

- [ ] **Step 4: Derive and retain the exact initial request cap**

```bash
INITIAL_REQUEST_CAP=$(bun -e '
const r = await Bun.file(process.argv[1]).json();
if (!Array.isArray(r.scheduledRequests)) throw new Error("missing scheduledRequests");
console.log(r.scheduledRequests.length);
' .tmp/hpa-611/generation-dry-run.json)

printf '%s\n' "$INITIAL_REQUEST_CAP" | tee .tmp/hpa-611/initial-request-cap.txt
```

Do not round this upward to 100. A zero value means there is no initial paid generation work to run.

- [ ] **Step 5: Complete the human provider-plan/terms check and create the HPA-608 note before any paid call**

Confirm against the current ElevenLabs account/provider documentation or UI:

- the account can run the required SFX and Music models;
- the intended generated duration/request scope fits the account;
- the applicable Music/model terms permit the intended game distribution;
- the current provider estimate/credits are recorded when calculable.

Set `MUSIC_TERMS_NOTE` to a short actual note containing the check date, source, and operator acknowledgement, then persist it in the HPA-608 store:

```bash
test -n "${MUSIC_TERMS_NOTE:-}"
mkdir -p .tmp/audio-generation/theSeventhMirror
printf '%s\n' "$MUSIC_TERMS_NOTE" \
  > .tmp/audio-generation/theSeventhMirror/music-terms-note.md
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

Write the same check date/source/result, base commit, audio-plan SHA-256, compiler counts, dry-run counts, intended durations, and `INITIAL_REQUEST_CAP` into one Linear HPA-611 comment. Do not paste credentials or provider receipts.

**Gate:** no paid `generate` command before both the Linear evidence and the non-empty local music terms note exist.

---

## Task 2: Retain a rollback baseline before the real release

**Files / state:**
- Create untracked: `.tmp/hpa-611/production-audio-releases-before.json`
- Conditionally create untracked: `.tmp/hpa-611/no-audio-omissions.json`
- Conditionally create untracked: `.tmp/hpa-611/silent-generation/`
- Conditionally create R2 production audio manifest for the silent release; no pointer write

**Produces:** `ROLLBACK_RELEASE_ID` + `ROLLBACK_MANIFEST_SHA256` for Task 7.

- [ ] **Step 1: List and deep-verify current production audio history**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-audio-releases-before.json
```

Inspect `warnings` and `releases`.

- If an active release exists, it must be `manifestValid`, `releaseIdentityValid`, `shallowVerified`, and `deepVerified`. Retain its release ID/checksum as the rollback baseline.
- If the pointer is invalid, stop. Do not treat an invalid pointer as "no audio".
- If no active audio release exists and there is no invalid-pointer warning, create the silent baseline in the next steps.

- [ ] **Step 2: For first release only, generate an all-omitted baseline document from compiler authority**

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

Use the dedicated empty generation root so the all-omitted baseline cannot conflict with final selections under `.tmp/audio-generation/theSeventhMirror`.

- [ ] **Step 3: Publish the silent production candidate without activation**

Run only when Step 1 found no valid active baseline.

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

Expected: zero included MP3 assets, all compiler-used cues omitted, no pointer write.

- [ ] **Step 4: Verify the silent baseline as stored and public immutable state**

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

The public verifier intentionally accepts an all-omitted manifest without an archive probe because there are no source archives or MP3 objects for this release.

- [ ] **Step 5: Persist the baseline identity locally and in Linear evidence**

```bash
printf '%s\n' "$ROLLBACK_RELEASE_ID" > .tmp/hpa-611/rollback-release-id.txt
printf '%s\n' "$ROLLBACK_MANIFEST_SHA256" > .tmp/hpa-611/rollback-manifest-sha256.txt
```

For an existing active baseline, populate the same two files from the deep-verified release history instead of publishing a silent release.

---

## Task 3: Generate the bounded initial candidate set

**Files / state:**
- Modify untracked: `.tmp/audio-generation/theSeventhMirror/**`
- Create untracked: `.tmp/hpa-611/generation-paid.json`

**Produces:** at least one current-spec valid candidate for every cue not intentionally deferred before curation.

- [ ] **Step 1: Confirm the frozen inputs and BGM prerequisite have not moved**

```bash
test "$(git rev-parse HEAD)" = "$(cat .tmp/hpa-611/base-commit.txt)"
shasum -a 256 -c .tmp/hpa-611/audio-plan.sha256
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

If the commit or audio-plan check fails, return to Task 1 and re-freeze. Do not reuse stale request/cost evidence.

- [ ] **Step 2: Run the paid pass only when the retained cap is non-zero**

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

Expected: exit 0. The provider key is read from `ELEVENLABS_API_KEY`; never put it in the command, shell trace, report, or Linear.

The HPA-608 runner is sequential and resumable. One capped `--missing` pass is the lean default; do not add a new batching script. If an operator deliberately wants a listening checkpoint mid-run, stop between calls and resume the same command rather than clearing the store.

- [ ] **Step 3: Re-run the dry plan to prove the initial target is satisfied**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run \
  > .tmp/hpa-611/generation-after-initial.json
```

Expected: `scheduledRequests.length === 0` unless a provider failure left a cue unresolved. If unresolved, inspect the failure marker and retry only after understanding the failure; do not raise the global cap speculatively.

---

## Task 4: Human-curate candidates and lock final coverage

**Files / state:**
- Modify untracked: `.tmp/audio-generation/theSeventhMirror/selection.json`
- Conditionally create tracked: `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`
- Create untracked: `.tmp/hpa-611/final-audio-plan-report.json`
- Create untracked: `.tmp/hpa-611/local-audio-publication-plan.json`

**Produces:** frozen final selection/omission inputs for preview and production publication.

- [ ] **Step 1: Review every generated candidate in context**

For each key, inspect the current receipt and listen to its candidate file under:

```text
.tmp/audio-generation/theSeventhMirror/<key>/candidate-NNN.*
.tmp/audio-generation/theSeventhMirror/<key>/candidate-NNN.receipt.json
```

Review SFX for transient clarity/tail/level/style continuity and BGM for loop continuity/mood/repetition/length. Use representative story scenes while making the decision; do not rank candidates automatically.

- [ ] **Step 2: Select each accepted candidate through the HPA-608 CLI**

For each accepted key/candidate pair, set `AUDIO_KEY` and `CANDIDATE_ID` to the actual reviewed values and run:

```bash
bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key "$AUDIO_KEY" \
  --candidate "$CANDIDATE_ID"
```

The command validates the current generation spec and source checksum before updating `selection.json`. Do not select a cue that the final release will omit.

- [ ] **Step 3: Generate extra candidates only for rejected keys**

For a key with one rejected current-spec candidate, set `AUDIO_KEY` to that actual key and request exactly one additional candidate by raising the desired total from 1 to 2:

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key "$AUDIO_KEY" \
  --candidate-count 2 \
  --max-requests 1 \
  > ".tmp/hpa-611/regenerate-${AUDIO_KEY}.json"
```

If two candidates are rejected, repeat with `--candidate-count 3 --max-requests 1`. Never regenerate already-approved keys.

- [ ] **Step 4: Record intentional final omissions only when they really exist**

If every used cue has an approved selection, do not create `audio-omissions.json`.

If one or more used cues are deliberately omitted, create `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` with HPA-609's exact v1 shape: `schemaVersion: 1`, `storyId: "the_seventh_mirror"`, and an `omissions` object mapping only the actual omitted cue keys to their actual short non-empty review reasons. Do not copy the Task 2 all-omitted baseline into the repository and do not leave a selected entry for a cue that is omitted.

- [ ] **Step 5: Reconfirm compiler and publisher coverage before any R2 release write**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/final-audio-plan-report.json

bun --filter @aquila/infra-cloudflare assets -- plan \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment production \
  --generation-root .tmp/audio-generation \
  --destination local \
  --destination-root .tmp/hpa-611/local-audio-plan \
  --json > .tmp/hpa-611/local-audio-publication-plan.json
```

Expected: no coverage error. Every compiler-used cue is selected or explicitly omitted; selected-but-unused/plan-unused warnings are zero on the current corpus.

- [ ] **Step 6: Freeze curation**

Do not edit cue placement, `audio-plan.json`, `selection.json`, or final omission decisions after this point. A needed change sends the run back through Task 1/3/4 as appropriate.

---

## Task 5: Publish and approve the exact deployed-preview candidate

**Files / state:**
- Read existing deployed preview namespace and active visual release
- Create R2 preview audio manifest + shared MP3/archive immutables
- Mutate preview audio pointer only after candidate verification
- Create `.tmp/hpa-611/preview-*.json` reports

**Produces:** retained `PREVIEW_AUDIO_RELEASE_ID` + `PREVIEW_AUDIO_MANIFEST_SHA256`, deployed preview approval, and one archive 404 probe key.

- [ ] **Step 1: Resolve the existing preview namespace used by the deployed reader**

Set `PREVIEW_ID` to the exact preview namespace already configured for the deployed release-gate preview. It must be the same value the deployed reader uses and the same value passed as `RELEASE_GATE_PREVIEW_ID`.

Do not make up an HPA-611-specific ID unless the visual release is intentionally seeded into that same namespace with the existing visual publisher.

- [ ] **Step 2: Retain the active visual identity in that preview namespace**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/preview-visual-releases.json
```

Extract the one `active: true` release. It must deep-verify. Retain its `releaseId` and `manifestSha256` as `PREVIEW_VISUAL_RELEASE_ID` and `PREVIEW_VISUAL_MANIFEST_SHA256` for the deployed gate.

- [ ] **Step 3: Publish the frozen audio inputs into the preview namespace**

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

If a canonical final `audio-omissions.json` exists in the story docs, the publisher discovers it automatically. Do not pass the run-scoped silent-baseline omissions file here.

- [ ] **Step 4: Deep-verify the stored preview candidate**

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

- [ ] **Step 5: Derive one real private-source probe from the frozen selection**

Run only for a non-empty final audio release:

```bash
ARCHIVE_PROBE_KEY=$(bun -e '
const root = ".tmp/audio-generation/theSeventhMirror";
const selection = await Bun.file(`${root}/selection.json`).json();
const first = Object.entries(selection.selections)[0];
if (!first) throw new Error("no selected audio source available for archive probe");
const [key, picked] = first;
const receipt = await Bun.file(`${root}/${key}/${picked.candidateId}.receipt.json`).json();
const dot = receipt.output.filename.lastIndexOf(".");
if (dot < 0) throw new Error("candidate filename has no extension");
const ext = receipt.output.filename.slice(dot + 1);
console.log(`audio/approved/the_seventh_mirror/${receipt.type}/${key}/${picked.sourceSha256}/source.${ext}`);
')
```

This path is safe to probe publicly; the expected result is exact 404. Do not fetch the private source bucket itself during the public check.

- [ ] **Step 6: Run the public candidate verifier**

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

Expected: manifest and every unique MP3 pass integrity/MIME/cache checks, one real MP3 returns correct Range 206, and the private source probe returns exact 404.

- [ ] **Step 7: Activate only the preview audio pointer and verify active public state**

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

- [ ] **Step 8: Run the deployed preview release gate pinned to both identities**

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

Set `DEPLOYED_PREVIEW_URL` to the actual preview deployment URL. If the preview is not protected, omit `VERCEL_AUTOMATION_BYPASS_SECRET`; do not invent a value.

- [ ] **Step 9: Perform the bounded manual direction review**

Check the representative states from the spec: early/mid/late, quiet, recurring physical and supernatural motifs, high tension, BGM continue/change/stop, one available branch/choice, desktop/mobile, headphones/speakers, SFX/BGM controls, and muted readability.

If one cue fails direction review, return to Task 4 Step 3 for only that key, reselect, and republish a new preview candidate. The old immutable preview release remains history.

---

## Task 6: Publish the same frozen candidate to production and activate it

**Files / state:**
- Create production audio immutable manifest (MP3/archive bodies should mostly reuse)
- Mutate production audio pointer after all identity/verification gates
- Create `.tmp/hpa-611/production-*.json` reports

**Produces:** approved active production audio release.

- [ ] **Step 1: Publish candidate-only to production from the same frozen inputs**

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

Audio publish does not accept/need `--no-activate` or `--confirm-production`; it never writes the pointer.

- [ ] **Step 2: Enforce exact preview/production identity parity**

```bash
test "$PRODUCTION_AUDIO_RELEASE_ID" = "$PREVIEW_AUDIO_RELEASE_ID"
test "$PRODUCTION_AUDIO_MANIFEST_SHA256" = "$PREVIEW_AUDIO_MANIFEST_SHA256"
```

Any mismatch is a hard stop. Do not "approve equivalent audio" by listening; investigate which frozen input changed.

- [ ] **Step 3: Deep-verify and publicly verify the production candidate before pointer mutation**

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

- [ ] **Step 4: Retain the currently active production visual identity**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-visual-releases.json
```

Extract the deep-verified `active: true` visual release ID/checksum as `PRODUCTION_VISUAL_RELEASE_ID` and `PRODUCTION_VISUAL_MANIFEST_SHA256`. Do not republish visuals.

- [ ] **Step 5: Activate the production audio pointer**

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

Expected: exactly one pointer write; no immutable object/manifests created by this command.

- [ ] **Step 6: Verify active CDN state and deployed production reader**

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

Set `DEPLOYED_PRODUCTION_URL` to the actual production reader URL. Also perform a short production reader smoke for one SFX cue, BGM start/continue/stop, missing/omitted silence, navigation, and audio controls.

---

## Task 7: Prove pointer-only rollback and reactivation

**Files / state:**
- Mutate production audio pointer twice
- Create `.tmp/hpa-611/production-rollback.json`
- Create `.tmp/hpa-611/production-reactivate.json`

**Produces:** proof that production can recover without republishing or deleting immutable audio.

- [ ] **Step 1: Load the retained rollback baseline identity**

```bash
ROLLBACK_RELEASE_ID=$(cat .tmp/hpa-611/rollback-release-id.txt)
ROLLBACK_MANIFEST_SHA256=$(cat .tmp/hpa-611/rollback-manifest-sha256.txt)
```

If Task 2 used an existing active release, ensure these files contain that retained identity.

- [ ] **Step 2: Roll back the production audio pointer**

```bash
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

Expected: one pointer write. No object/manifest/archive deletion or copy.

- [ ] **Step 3: Verify rollback state**

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --json > .tmp/hpa-611/production-rollback-public-verify.json
```

Smoke the deployed reader. For the all-omitted silent baseline, confirm normal dialogue/navigation remain usable and audio is silent; the full non-empty audio release gate is not required for an intentionally empty baseline. For a previous non-empty baseline, verify its retained identity and representative playback.

- [ ] **Step 4: Reactivate the approved HPA-611 release**

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

- [ ] **Step 5: Re-run active public verification and the deployed production audio gate**

Repeat Task 6 Step 6. The production reader must again report the exact HPA-611 audio release ID/checksum and pass representative playback.

---

## Task 8: Run repository regression, commit only real tracked release metadata, and close out Linear evidence

**Files / state:**
- Conditionally tracked: `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`
- Update: Linear HPA-611 final evidence
- Existing branch/PR only; no second PR

**Produces:** final HPA-611 verification/evidence package.

- [ ] **Step 1: Run the full requested regression set**

```bash
bun compile:stories
bun run compile:check
bun --filter @aquila/stories test
bun --filter @aquila/infra-cloudflare test
bun --filter web test
bun --filter e2e test:e2e
bun run lint
bun run build
```

Expected: all commands pass. The credentialed deployed gate evidence is separate from the normal local E2E suite and was already run in Tasks 5-7.

- [ ] **Step 2: Inspect tracked changes and branch scope**

```bash
git status --short
git diff --check
git diff --name-only main...HEAD
```

Expected: no generated audio, receipt, selection, `.tmp` report, or provider metadata is tracked. The branch diff contains the HPA-611 design/plan docs and, only when real final omissions exist, `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` plus any smallest blocker fix explicitly required by this release.

- [ ] **Step 3: If final omissions exist, commit them on this same HPA-611 branch**

```bash
git add packages/stories/raw/theSeventhMirror/docs/audio-omissions.json
git commit -m "chore(audio): record Seventh Mirror release omissions"
```

Skip this step when the final omission count is zero. Do not create an empty omissions file just to have a commit.

- [ ] **Step 4: Add the final concise Linear evidence summary**

Record:

- base commit + audio-plan SHA-256;
- 28 SFX / 13 BGM plan sanity counts and final compiler coverage;
- initial scheduled request cap, actual provider requests, and cost/credits where calculable;
- terms/account check date/source and confirmation that the local music note existed before BGM generation;
- selected vs omitted counts;
- preview audio release ID/checksum;
- production audio release ID/checksum and exact equality result;
- private archive confirmation and public archive 404 result;
- stored/public/deployed preview verification;
- manual direction review result;
- production activation result;
- rollback baseline release ID/checksum;
- rollback and reactivation pointer results;
- final regression results;
- deferred creative ideas that are explicitly outside HPA-611.

Do not include secrets or full private provider receipts.

- [ ] **Step 5: Final scope check**

HPA-611 should close without new frameworks. If execution required a small blocker fix, confirm it is in the smallest owning module, covered by focused regression, and on this same PR. Any unrelated improvement becomes a later Linear issue rather than scope added here.
