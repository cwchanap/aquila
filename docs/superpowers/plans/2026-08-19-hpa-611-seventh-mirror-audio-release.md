# HPA-611 Seventh Mirror Audio Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, curate, locally encode, preview-approve, publish, activate, rollback, and reactivate The Seventh Mirror audio pack using the merged Aquila audio toolchain.

**Architecture:** Keep HPA-611 operational. Preflight the real local/deployment prerequisites before provider spend, freeze one input set, prove selected audio with a local publish, approve that candidate in preview, then republish the frozen inputs to production and compare retained identities. Persist every value needed across task boundaries under `.tmp/hpa-611/`; never depend on a shell variable surviving between agents/tasks.

**Tech Stack:** Bun, TypeScript/Vitest, HPA-608 ElevenLabs generation store, HPA-609 local/R2 publisher + public verifier, HPA-610 reader, Playwright release gate, Linear release evidence.

**Spec:** `docs/superpowers/specs/2026-08-19-hpa-611-seventh-mirror-audio-release-design.md`

## Global Constraints

- One HPA-611 branch/PR. Do not split the invariant test, omissions metadata, or a smallest blocker fix into another PR.
- No planned production/runtime feature code. The only planned source-tree code change before the release is one target-invariance regression test.
- Production binaries, provider receipts, generated candidates, selections, and `.tmp/hpa-611/` reports stay out of git.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` is the creative generation plan.
- Every compiler-used cue ends selected or explicitly omitted with a non-empty reason.
- Generate one current-spec candidate per unresolved cue first; generate one more only for a rejected key.
- Initial paid `--max-requests` equals the retained dry-run scheduled request count exactly. A zero count skips the paid command.
- Before paid work, prove ffmpeg/ffprobe, the credential-free release-gate config, real delivery R2 access, source-archive credential presence, provider/account/terms evidence, and the local Music terms note.
- Before R2 publication, final selections/omissions must pass the existing audio publisher against a local destination.
- Do not add `mirror-preview --media audio`; preview/production equality is release ID + manifest SHA equality for the same frozen inputs.
- Production R2 is untouched until preview approval.
- The rollback target is resolved freshly immediately before activation; Task 1 history is early awareness only.
- All cross-task release IDs, manifest hashes, preview ID, rollback identity, and archive probe keys are retained in `.tmp/hpa-611/*.txt` when produced.
- Rollback/reactivation are pointer-only. Never delete immutable objects/manifests/archives/history.

---

## Task 1: Preflight, pin the identity invariant, and freeze the paid boundary

**Files / state:**
- Modify/Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`
- Create untracked: `.tmp/hpa-611/production-audio-releases-preflight.json`
- Create untracked: `.tmp/hpa-611/base-commit.txt`
- Create untracked: `.tmp/hpa-611/audio-plan.sha256`
- Create untracked: `.tmp/hpa-611/audio-report.json`
- Create untracked: `.tmp/hpa-611/listening-worksheet.md`
- Create untracked: `.tmp/hpa-611/generation-dry-run.json`
- Create untracked: `.tmp/hpa-611/initial-request-cap.txt`
- Create untracked: `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`

**Produces:** a committed target-invariance test, proven local/deployment prerequisites, frozen compiler/generation inputs, and no paid call or R2 write.

- [ ] **Step 1: Create the run directory and prove ffmpeg/ffprobe**

```bash
mkdir -p .tmp/hpa-611
ffmpeg -hide_banner -version >/dev/null
ffprobe -hide_banner -version >/dev/null
```

Expected: both executable checks exit `0`; these match `assertAudioToolsAvailable()`.

- [ ] **Step 2: Run the credential-free release-gate configuration tests**

```bash
bun --filter e2e test:release-gate-config
```

Expected: release-gate automation/config and audio-anchor support tests pass before any paid or credentialed operation.

- [ ] **Step 3: Prove delivery credentials/R2 access and capture early production audio state read-only**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-audio-releases-preflight.json
```

Inspect the report. Any command failure is a pre-spend stop. A `pointer-invalid` warning is also a stop. This command is read-only, proves the delivery credential path and R2 reachability, and records whether an active baseline appears to exist. Do not treat this report as the final rollback decision; Task 5 reruns it immediately before activation.

- [ ] **Step 4: Check only the private source-archive credential pair not exercised by `releases`**

```bash
bun -e '
const names = [
  "R2_SOURCE_ARCHIVE_ACCESS_KEY_ID",
  "R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY",
];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`missing source archive credentials: ${missing.join(", ")}`);
console.log("source archive credential variables are present");
'
```

Do not duplicate the `R2_PUBLISHER_*` presence check; Step 3 already exercised those through the owning CLI.

- [ ] **Step 5: Add the target-invariance regression to the existing publisher test**

Inside `describe('buildPreparedAudioRelease', ...)` add:

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

Do not modify production publisher code unless this test exposes a real regression.

- [ ] **Step 6: Run and commit the focused invariant test**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/audio-runtime-release.test.ts

git add packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts
git commit -m "test(audio): pin release target invariance"
```

- [ ] **Step 7: Freeze the post-test commit and audio plan**

```bash
git status --short
git rev-parse HEAD | tee .tmp/hpa-611/base-commit.txt
shasum -a 256 packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  | tee .tmp/hpa-611/audio-plan.sha256
```

Expected: no unexplained tracked changes.

- [ ] **Step 8: Retain compiler authority and derive the disposable listening worksheet**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/audio-report.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.story !== "theSeventhMirror") throw new Error("wrong story report");
if (!Array.isArray(r.assets) || !Array.isArray(r.bgmStops) || !Array.isArray(r.unused)) throw new Error("malformed report");
if (r.unused.length !== 0) throw new Error(`unused audio plan rows: ${r.unused.length}`);
const rows = [
  "# HPA-611 Listening Worksheet", "",
  "> Derived from the frozen compiler report; not a second source of truth.", "",
  "| Kind | Cue/location | Count | Story locations |",
  "| --- | --- | ---: | --- |",
];
const esc = (v) => String(v).replaceAll("|", "\\|");
for (const asset of r.assets) {
  const loc = asset.usages.map((u) => `${esc(u.sceneId)}#${u.entryIndex} — ${esc(u.sourcePath)}`).join("<br>");
  rows.push(`| cue | \`${asset.type}:${asset.key}\` | ${asset.usageCount} | ${loc} |`);
}
for (const stop of r.bgmStops) rows.push(`| bgm-stop | \`bgm:stop\` | 1 | ${esc(stop.sceneId)}#${stop.entryIndex} — ${esc(stop.sourcePath)} |`);
await Bun.write(process.argv[2], rows.join("\n") + "\n");
console.log(JSON.stringify({
  assets: r.assets.length,
  sfx: r.assets.filter((x) => x.type === "sfx").length,
  bgm: r.assets.filter((x) => x.type === "bgm").length,
  bgmStops: r.bgmStops.length,
}));
' .tmp/hpa-611/audio-report.json .tmp/hpa-611/listening-worksheet.md
```

Current sanity expectation: 41 used cues, 28 SFX, 13 BGM, zero unused rows.

- [ ] **Step 9: Run the no-cost generation dry-run and persist the exact cap**

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
console.log(r.scheduledRequests.length);
' .tmp/hpa-611/generation-dry-run.json \
  | tee .tmp/hpa-611/initial-request-cap.txt
```

Never round the cap upward. Zero is valid evidence and skips Task 2's initial paid command.

- [ ] **Step 10: Record current provider/account/terms evidence and create the HPA-608 Music note**

Record the actual check date/source and distribution conclusion in Linear. Then:

```bash
test -n "${MUSIC_TERMS_NOTE:-}"
mkdir -p .tmp/audio-generation/theSeventhMirror
printf '%s\n' "$MUSIC_TERMS_NOTE" \
  > .tmp/audio-generation/theSeventhMirror/music-terms-note.md
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

**Gate:** no paid generation until all Task 1 steps pass.

---

## Task 2: Generate, curate, and prove final sources locally

**Files / state:**
- Modify untracked: `.tmp/audio-generation/theSeventhMirror/**`
- Conditionally create tracked: `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`
- Create untracked: `.tmp/hpa-611/final-audio-report.json`
- Create untracked: `.tmp/hpa-611/local-audio-publish/**`
- Create untracked: `.tmp/hpa-611/local-audio-publish-report.json`
- Create untracked: `.tmp/hpa-611/frozen-selection.sha256`
- Create untracked: `.tmp/hpa-611/frozen-omissions-state.txt`

**Produces:** final selections/omissions and a deep-verified local immutable candidate; no R2 write.

- [ ] **Step 1: Recheck frozen inputs and Music prerequisite**

```bash
test "$(git rev-parse HEAD)" = "$(cat .tmp/hpa-611/base-commit.txt)"
shasum -a 256 -c .tmp/hpa-611/audio-plan.sha256
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

- [ ] **Step 2: Run the bounded initial paid pass only if the retained cap is positive**

```bash
INITIAL_REQUEST_CAP=$(cat .tmp/hpa-611/initial-request-cap.txt)
if [ "$INITIAL_REQUEST_CAP" -gt 0 ]; then
  bun packages/stories/src/audio-generation/cli.ts generate \
    --story theSeventhMirror \
    --missing \
    --candidate-count 1 \
    --max-requests "$INITIAL_REQUEST_CAP" \
    > .tmp/hpa-611/generation-paid.json
fi
```

Do not expose `ELEVENLABS_API_KEY` in command text, logs, or Linear.

- [ ] **Step 3: Prove one current candidate exists for every unresolved key**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run \
  > .tmp/hpa-611/generation-after-initial.json

bun -e '
const r = await Bun.file(process.argv[1]).json();
if (r.scheduledRequests.length !== 0) throw new Error("candidate target incomplete");
' .tmp/hpa-611/generation-after-initial.json
```

- [ ] **Step 4: Curate using the frozen worksheet; select accepted candidates**

For each actual accepted pair:

```bash
bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key "$AUDIO_KEY" \
  --candidate "$CANDIDATE_ID"
```

For a rejected key only, request one additional candidate by increasing its desired total by one and using `--max-requests 1`. Do not regenerate approved keys.

- [ ] **Step 5: Record real omissions only when needed**

If every compiler-used cue is selected, leave `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` absent. Otherwise create it with HPA-609's exact v1 shape and actual review reasons only; remove any selection for an omitted cue.

- [ ] **Step 6: Re-run compiler coverage and real local audio publish**

```bash
bun packages/stories/src/compiler/cli.ts --report theSeventhMirror \
  > .tmp/hpa-611/final-audio-report.json

rm -rf .tmp/hpa-611/local-audio-publish
bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment preview \
  --preview-id hpa-611-local \
  --generation-root .tmp/audio-generation \
  --destination local \
  --destination-root .tmp/hpa-611/local-audio-publish \
  --json > .tmp/hpa-611/local-audio-publish-report.json
```

Extract the local release ID/checksum from that report and deep-verify the same local candidate with `assets verify --media audio ... --destination local --destination-root .tmp/hpa-611/local-audio-publish --deep`. This is the first real encode proof for every selected source.

- [ ] **Step 7: Freeze final selection/omission state**

```bash
shasum -a 256 .tmp/audio-generation/theSeventhMirror/selection.json \
  > .tmp/hpa-611/frozen-selection.sha256

if [ -f packages/stories/raw/theSeventhMirror/docs/audio-omissions.json ]; then
  shasum -a 256 packages/stories/raw/theSeventhMirror/docs/audio-omissions.json \
    > .tmp/hpa-611/frozen-omissions-state.txt
else
  printf 'absent\n' > .tmp/hpa-611/frozen-omissions-state.txt
fi
```

Any subsequent curation change returns to this task and creates a new preview candidate.

---

## Task 3: Publish and approve the deployed-preview candidate

**Produces persisted files:**
- `.tmp/hpa-611/effective-preview-id.txt`
- `.tmp/hpa-611/preview-visual-release-id.txt`
- `.tmp/hpa-611/preview-visual-manifest-sha256.txt`
- `.tmp/hpa-611/preview-audio-release-id.txt`
- `.tmp/hpa-611/preview-audio-manifest-sha256.txt`
- `.tmp/hpa-611/archive-receipt-probe-key.txt`
- `.tmp/hpa-611/archive-source-probe-key.txt` (supplemental)

- [ ] **Step 1: Copy and persist the effective preview ID from the deployed Vercel preview configuration**

```bash
printf '%s\n' "$EFFECTIVE_PUBLIC_ASSET_PREVIEW_ID" \
  > .tmp/hpa-611/effective-preview-id.txt
test -s .tmp/hpa-611/effective-preview-id.txt
```

Cross-check this value against the deployed reader's stable `data-asset-preview-id`. Do not derive it from operator memory.

- [ ] **Step 2: Deep-list the active preview visual release and persist its identity**

Use `PREVIEW_ID=$(cat .tmp/hpa-611/effective-preview-id.txt)` only within this step, run visual `assets releases --environment preview --preview-id "$PREVIEW_ID" --destination r2 --deep --json`, and write the single valid `active: true` `releaseId` and `manifestSha256` directly to:

```text
.tmp/hpa-611/preview-visual-release-id.txt
.tmp/hpa-611/preview-visual-manifest-sha256.txt
```

Fail if there is not exactly one deep-verified active visual release.

- [ ] **Step 3: Recheck the frozen selection/omission state and publish preview audio**

Verify `frozen-selection.sha256` and `frozen-omissions-state.txt`, then:

```bash
PREVIEW_ID=$(cat .tmp/hpa-611/effective-preview-id.txt)
bun --filter @aquila/infra-cloudflare assets -- publish \
  --media audio \
  --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment preview \
  --preview-id "$PREVIEW_ID" \
  --generation-root .tmp/audio-generation \
  --destination r2 \
  --json > .tmp/hpa-611/preview-audio-publish.json
```

Parse the JSON once and persist its `releaseId` and `manifestSha256` immediately to:

```text
.tmp/hpa-611/preview-audio-release-id.txt
.tmp/hpa-611/preview-audio-manifest-sha256.txt
```

Do not rely on shell variables outside this task.

- [ ] **Step 4: Deep-verify the stored preview candidate**

Read `PREVIEW_ID`, `PREVIEW_AUDIO_RELEASE_ID`, and `PREVIEW_AUDIO_MANIFEST_SHA256` from the retained files, then run `assets verify --media audio --environment preview --preview-id ... --release ... --expect-manifest-sha256 ... --destination r2 --deep` and retain its JSON report.

- [ ] **Step 5: Derive archive probe keys from one compiler-used + selected cue**

Use the frozen compiler report to choose the first asset whose `key` has a final selection. Read that candidate's receipt and verify its `key`, `type`, and `sourceSha256` agree with the chosen report/selection row.

Construct:

```text
audio/approved/the_seventh_mirror/<type>/<key>/<sourceSha256>/receipt.json
```

and write it to `.tmp/hpa-611/archive-receipt-probe-key.txt`.

Also derive the supplemental source path from `receipt.output.filename` using a **lowercased** validated extension, and write:

```text
audio/approved/the_seventh_mirror/<type>/<key>/<sourceSha256>/source.<lowercase-ext>
```

to `.tmp/hpa-611/archive-source-probe-key.txt`.

The fixed `receipt.json` path is the primary proof. Never choose an unused-but-selected cue via arbitrary `Object.entries(selection.selections)[0]`.

- [ ] **Step 6: Run public candidate verification with both retained archive probes**

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$(cat .tmp/hpa-611/effective-preview-id.txt)" \
  --release "$(cat .tmp/hpa-611/preview-audio-release-id.txt)" \
  --expect-manifest-sha256 "$(cat .tmp/hpa-611/preview-audio-manifest-sha256.txt)" \
  --archive-probe-key "$(cat .tmp/hpa-611/archive-receipt-probe-key.txt)" \
  --archive-probe-key "$(cat .tmp/hpa-611/archive-source-probe-key.txt)" \
  --json > .tmp/hpa-611/preview-audio-public-candidate-verify.json
```

Both known-real private archive paths must return exact 404 on the public delivery host.

- [ ] **Step 7: Activate preview audio and run active public verification**

Use only retained files for preview ID/release/checksum. Save activation and active-verifier JSON reports.

- [ ] **Step 8: Run the deployed preview release gate from retained visual/audio identities**

```bash
BASE_URL="$DEPLOYED_PREVIEW_URL" \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$(cat .tmp/hpa-611/preview-visual-release-id.txt)" \
RELEASE_GATE_MANIFEST_SHA256="$(cat .tmp/hpa-611/preview-visual-manifest-sha256.txt)" \
RELEASE_GATE_PREVIEW_ID="$(cat .tmp/hpa-611/effective-preview-id.txt)" \
RELEASE_GATE_AUDIO_RELEASE_ID="$(cat .tmp/hpa-611/preview-audio-release-id.txt)" \
RELEASE_GATE_AUDIO_MANIFEST_SHA256="$(cat .tmp/hpa-611/preview-audio-manifest-sha256.txt)" \
bun --filter e2e test:release-gate
```

Add `VERCEL_AUTOMATION_BYPASS_SECRET` only when the deployed preview requires it.

- [ ] **Step 9: Perform the bounded worksheet-driven direction review**

Check every explicit `bgmStops` row, first + later reuse for recurring cues where applicable, and representative early/mid/late, quiet, supernatural, high-tension, BGM continue/change, desktop/mobile, headphones/speakers, controls, and muted readability.

Any rejected cue returns to Task 2; do not proceed to production with an obsolete retained preview identity.

---

## Task 4: Publish the frozen production candidate and enforce file-to-file equality

**Produces persisted files:**
- `.tmp/hpa-611/production-audio-release-id.txt`
- `.tmp/hpa-611/production-audio-manifest-sha256.txt`
- `.tmp/hpa-611/production-visual-release-id.txt`
- `.tmp/hpa-611/production-visual-manifest-sha256.txt`

- [ ] **Step 1: Recheck final selection/omission hashes and publish production audio without activation**

Use the same frozen generation root and canonical omission-file presence/absence as preview. Save the publisher JSON report and immediately persist its release ID/checksum to the two production-audio files above.

- [ ] **Step 2: Enforce exact equality using retained files**

```bash
cmp -s \
  .tmp/hpa-611/preview-audio-release-id.txt \
  .tmp/hpa-611/production-audio-release-id.txt

cmp -s \
  .tmp/hpa-611/preview-audio-manifest-sha256.txt \
  .tmp/hpa-611/production-audio-manifest-sha256.txt
```

Any mismatch is a hard stop. Do not republish preview merely to reconstruct values.

- [ ] **Step 3: Deep/public verify the production candidate from retained files**

Run stored deep verification and public candidate verification. Reuse the retained archive probe-key files; the same selected source was archived under the same private content-addressed prefix.

- [ ] **Step 4: Deep-list the active production visual release and persist its identity**

Persist exactly one deep-verified active visual release ID/checksum to the production-visual files. Do not republish visual assets.

---

## Task 5: Resolve the fresh rollback target immediately before go-live

**Produces:**
- `.tmp/hpa-611/production-audio-releases-before-activation.json`
- `.tmp/hpa-611/rollback-release-id.txt`
- `.tmp/hpa-611/rollback-manifest-sha256.txt`

- [ ] **Step 1: Rerun fresh deep production audio history**

```bash
bun --filter @aquila/infra-cloudflare assets -- releases \
  --media audio \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --deep \
  --json > .tmp/hpa-611/production-audio-releases-before-activation.json
```

Fresh state wins over Task 1 preflight. Stop on `pointer-invalid`.

- [ ] **Step 2: If a valid active previous audio release exists, persist it as rollback target**

Require `manifestValid`, `releaseIdentityValid`, `shallowVerified`, and `deepVerified`. Persist its ID/checksum directly to the rollback files.

- [ ] **Step 3: Otherwise publish an all-omitted silent candidate now**

Generate `.tmp/hpa-611/no-audio-omissions.json` from every used asset in the frozen compiler report with a bounded HPA-611 baseline reason. Use an empty `.tmp/hpa-611/silent-generation` root and explicit `--omissions` to publish a zero-asset production audio candidate. Persist its ID/checksum to the rollback files.

- [ ] **Step 4: Deep/public verify the silent baseline**

For a zero-asset baseline, run stored and public candidate verification without archive probes. Do **not** run the full deployed audio release gate: it requires included BGM/SFX anchors that intentionally do not exist.

---

## Task 6: Activate, smoke, rollback, and reactivate from retained state

At task start, load/read the production audio, production visual, rollback, and archive-probe files. No identity may be reconstructed by republishing.

- [ ] **Step 1: Activate approved production audio**

Use `activate --media audio --environment production --confirm-production the_seventh_mirror`, the retained production audio ID/checksum, and `--destination r2`. Save the activation JSON.

- [ ] **Step 2: Verify active production and run deployed production gate**

Run active public verification with both retained archive probe keys. Then:

```bash
BASE_URL="$DEPLOYED_PRODUCTION_URL" \
RELEASE_GATE_STORY_ID=the_seventh_mirror \
RELEASE_GATE_RELEASE_ID="$(cat .tmp/hpa-611/production-visual-release-id.txt)" \
RELEASE_GATE_MANIFEST_SHA256="$(cat .tmp/hpa-611/production-visual-manifest-sha256.txt)" \
RELEASE_GATE_AUDIO_RELEASE_ID="$(cat .tmp/hpa-611/production-audio-release-id.txt)" \
RELEASE_GATE_AUDIO_MANIFEST_SHA256="$(cat .tmp/hpa-611/production-audio-manifest-sha256.txt)" \
bun --filter e2e test:release-gate
```

Perform a short production playback/navigation/control smoke.

- [ ] **Step 3: Roll back using the retained rollback files**

Run `rollback --media audio --environment production --confirm-production the_seventh_mirror` with the retained rollback ID/checksum. Save the JSON report.

- [ ] **Step 4: Verify rollback behavior appropriately**

Always run active public verification. If the rollback target is the zero-asset silent baseline, perform only a deployed reader usability/silence smoke. If it is a prior non-empty release, run the full deployed release gate pinned to that retained prior audio identity.

- [ ] **Step 5: Reactivate the approved HPA-611 release and re-run active verification/gate**

Use the retained production audio files; save the reactivation report and rerun Step 2's active public/deployed checks.

---

## Task 7: Scoped repository closeout and Linear evidence

- [ ] **Step 1: Run the scoped repository regression**

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter @aquila/infra-cloudflare test
```

Do not add a standalone `compile:stories`; `compile:check` already runs it. Do not run normal local `test:e2e` merely as release evidence; it excludes `visual-novel-deployed.spec.ts`.

If a real blocker fix changed product/runtime code, additionally run its focused tests plus `bun run lint`, `bun run build`, and only the web/E2E suites relevant to that changed behavior.

- [ ] **Step 2: Inspect tracked scope**

```bash
git status --short
git diff --check
git diff --name-only main...HEAD
```

Expected normal scope: two HPA-611 planning docs + target-invariance test + optional real `audio-omissions.json`. No `.tmp`, generated audio, provider receipts, or selections are tracked.

- [ ] **Step 3: Commit real omissions only if they exist**

If final omissions exist, commit the canonical `audio-omissions.json` on this same PR. Otherwise do not create an empty file.

- [ ] **Step 4: Add the final Linear evidence summary**

Record:

- frozen commit/audio-plan SHA and compiler counts;
- Task 1 ffmpeg/ffprobe, release-gate-config, delivery-R2, source-archive-config, and terms evidence;
- initial cap and actual provider spend/requests where available;
- selected/omitted counts and local encode proof;
- effective preview ID source;
- preview and production audio IDs/checksums plus `cmp` equality result;
- receipt/source archive probe keys and public 404 evidence;
- preview/production stored/public/deployed/manual review results;
- rollback target and activation/rollback/reactivation pointer evidence;
- scoped repository verification;
- explicitly deferred creative ideas.

Never paste credentials, full private receipts, local private paths, or generated audio binaries into Linear.
