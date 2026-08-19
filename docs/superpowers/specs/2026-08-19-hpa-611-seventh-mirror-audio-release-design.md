# HPA-611 Seventh Mirror Audio Release Design

## Status

Revised design for HPA-611, the final production-content/release task in the current Aquila audio chain.

HPA-607, HPA-608, HPA-609, and HPA-610 are complete on `main`. HPA-611 executes those shipped seams rather than adding another audio subsystem.

## Goal

Generate and curate the approved The Seventh Mirror audio palette, prove the selected sources encode locally, verify the exact runtime candidate in the deployed preview, publish the same frozen candidate to production, activate it, and prove pointer-only rollback/reactivation with auditable evidence.

## Current state on `main`

The repository already provides the required product/runtime seams:

- `packages/stories/src/compiler/cli.ts --report` emits deterministic cue coverage with per-usage `sceneId`, `sourcePath`, and zero-based `entryIndex`, plus explicit `bgmStops`.
- `packages/stories/src/audio-generation/cli.ts` provides resumable `generate` and checksum-linked `select` commands with bounded `--candidate-count` and `--max-requests`.
- `packages/infra-cloudflare/src/publisher/cli.ts` provides audio `plan`, `publish`, `activate`, `verify`, `releases`, and `rollback` through the existing local/R2 stores.
- Audio `publish` calls `assertAudioToolsAvailable()`, normalizes selected sources with `ffmpeg`/`ffprobe`, archives approved inputs, creates/reuses content-addressed MP3s, and writes an immutable manifest without mutating `current.json`.
- R2 audio publish requires both delivery `R2_PUBLISHER_*` and private-source `R2_SOURCE_ARCHIVE_*` credentials.
- `packages/infra-cloudflare/src/verify.ts` verifies public audio candidates/active releases, including MIME/cache/integrity, a real Range 206 check for a non-empty release, and private archive 404 probes. It explicitly accepts all-omitted zero-asset releases.
- `packages/e2e/tests/visual-novel-deployed.spec.ts` pins visual and audio release IDs/checksums against a deployed preview or production reader. The ordinary local Playwright config intentionally excludes this deployed-only spec.
- HPA-610 already owns missing/omitted cue fallback, SFX one-shot semantics, BGM continuation/change/stop, toggles, and Safari-safe first-load behavior.

The checked-in audio plan currently has 41 used entries: 28 SFX and 13 BGM. Those counts are a sanity bound only; HPA-608 dry-run output is authoritative for actual scheduled paid requests because existing current-spec candidates may make the run smaller.

## Design decision

Treat HPA-611 as an **operational release run with no production/runtime feature work**.

One small test-only change is planned before any provider spend: add a regression case to the existing `audio-runtime-release.test.ts` proving preview and production targets produce identical audio `releaseId`, `manifestSha256`, and manifest bytes from the same normalized inputs. HPA-611 relies on this invariant as a hard deployment gate, so pinning it in the existing unit test is cheaper than discovering a contract regression after human review.

Everything else uses existing CLIs and temporary evidence under `.tmp/hpa-611/`. Production audio binaries, provider receipts, selections, and generated candidates remain outside git. A real final `audio-omissions.json` is tracked only when final curation intentionally omits one or more used cues.

If execution exposes a concrete repository defect, fix only the smallest owning module on this same HPA-611 PR. Do not redesign generation, publishing, playback, storage, or the release gate.

## Pre-spend preflight

Paid generation must not be the first time the run discovers that the machine cannot encode or the publisher cannot even be configured.

Before any provider request:

1. prove both executables are runnable using the same arguments the publisher uses: `ffmpeg -hide_banner -version` and `ffprobe -hide_banner -version`;
2. fail closed if any of `R2_PUBLISHER_ACCESS_KEY_ID`, `R2_PUBLISHER_SECRET_ACCESS_KEY`, `R2_SOURCE_ARCHIVE_ACCESS_KEY_ID`, or `R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY` is absent in the environment intended to perform the R2 release;
3. add and run the target-invariance regression test in `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`;
4. only then freeze the commit, audio-plan SHA-256, compiler report, dry-run request cap, and provider terms/account evidence.

Credential **presence** is the pre-spend configuration gate. Actual R2 behavior remains proven later by the preview publish/verify path; HPA-611 does not invent a new credential-probe command.

## Preview strategy: republish frozen inputs, do not add audio `mirror-preview`

The merged HPA-609 CLI deliberately rejects `mirror-preview --media audio`.

That feature is unnecessary. `canonicalAudioReleaseContent()` hashes only schema version, story ID, and audio assets. Runtime MP3 object paths are `vn/objects/<sha256>.mp3`, independent of target. `buildPreparedAudioRelease()` stores the publication target but does not feed it into release or manifest identity.

Therefore the same selected sources, current plan, and omissions produce the same:

- `releaseId`;
- `manifestSha256`; and
- manifest bytes

in preview and production namespaces.

Use that invariant as the exact-candidate proof:

1. freeze final selections/omissions after local encode proof;
2. publish them into the preview namespace already used by the deployed reader;
3. verify and approve the preview candidate;
4. publish the same frozen inputs into production without activation;
5. require production `releaseId` and `manifestSha256` to equal the retained preview values exactly;
6. stop before pointer mutation if either differs.

### Rejected alternatives

**Add `mirror-preview --media audio`.** Adds command-matrix behavior and tests for no product benefit.

**Publish production before preview, then copy keys.** Violates the release failure policy and creates production history before preview approval.

**Trust filenames/candidate IDs.** Those are authoring identities, not runtime release identity.

## Frozen release input and listening worksheet

Before paid generation, retain:

- exact git commit SHA after the target-invariance test commit;
- SHA-256 of `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`;
- compiler `audio:report` JSON;
- unique SFX/BGM counts and intended duration;
- HPA-608 dry-run scheduled request count and exact hard cap;
- provider cost/credit estimate when calculable;
- dated current ElevenLabs account/terms check;
- non-empty `.tmp/audio-generation/theSeventhMirror/music-terms-note.md` required by HPA-608 before BGM generation.

Derive one disposable listening worksheet directly from the frozen compiler report. It is **not** a second source of truth or a new review schema. It simply renders:

- one row per used `type:key`, with every report-provided usage location;
- one row for every `bgmStops` location.

Curation and preview direction review use this same worksheet to navigate story context, recurring cue reuse, and explicit silence. Re-generate it whenever the compiler report is re-frozen.

Any edit to cue placement or `audio-plan.json` invalidates the freeze. Recompute report/hash/dry-run/worksheet rather than carrying stale evidence forward.

## Generation and curation

Use one candidate per unresolved cue for the initial pass:

- run `generate --missing --candidate-count 1 --dry-run`;
- set paid `--max-requests` to exactly the dry-run scheduled request count;
- run the resumable paid pass;
- use the frozen worksheet to understand each key's usage/reuse sites and all explicit BGM stops;
- select exactly one approved candidate per included key;
- request one extra candidate only for a specifically rejected key.

Do not pre-generate multiple candidates for every cue.

Every compiler-used cue ends with exactly one disposition:

- selected and included; or
- explicitly omitted with a short non-empty reason.

When all used cues are selected, omit `audio-omissions.json`; the publisher already treats the absent default file as no omissions. When real omissions exist, commit only the canonical `packages/stories/raw/theSeventhMirror/docs/audio-omissions.json` after the release run.

### Local encode proof before R2

After final selection/omission decisions, run the existing audio **publish** command against a local destination, not merely `plan`.

That local publish uses the real selected files, executes `ffmpeg`/`ffprobe`, normalizes every included source, validates coverage, creates local source/delivery state, and verifies the resulting immutable candidate without touching R2.

No R2 write happens until this local publish succeeds.

## Preview namespace source of truth

Do not choose the preview ID from memory.

The deployed reader's preview namespace comes from effective `PUBLIC_ASSET_PREVIEW_ID` (explicit or derived by `apps/web/scripts/asset-preview-id.ts`), and the deployed gate receives the same value as `RELEASE_GATE_PREVIEW_ID`.

At execution time:

1. copy the effective preview ID from the deployed Vercel preview environment or deployment configuration;
2. cross-check it against the deployed reader's stable `reader-ready` `data-asset-preview-id` attribute when available;
3. use that exact value for visual release lookup, preview audio publication, and `RELEASE_GATE_PREVIEW_ID`.

The subsequent deep-verified active visual release lookup remains a backstop, not the first discovery mechanism.

## Preview release gate

After local encode proof, and while production R2 remains untouched:

1. resolve the deployed preview ID from the source of truth above;
2. retain the active deep-verified visual release identity in that namespace;
3. publish frozen audio inputs into the preview namespace;
4. deep-verify the stored candidate;
5. run the public candidate verifier with a real private archive probe for non-empty audio;
6. activate only the preview audio pointer;
7. run the public active verifier;
8. run `bun --filter e2e test:release-gate` pinned to visual + audio identities;
9. perform the bounded human direction review using the frozen worksheet.

The human pass remains representative rather than replaying the whole story, but it is not ad hoc:

- every explicit `bgmStops` row is checked for the intended silence transition;
- recurring cues use the worksheet to check at least the first placement and one later reuse site where applicable;
- cover early/middle/late, quiet, supernatural, high-tension, BGM continuation/change, desktop/mobile, headphones/speakers, controls, and muted readability.

If a cue fails, regenerate/reselect only that key, rerun local publish, and publish/approve a new preview candidate. Production still remains untouched.

## Production candidate

Only after preview approval, publish the same frozen inputs to the production namespace without pointer mutation.

Before activation require:

- production `releaseId === preview releaseId`;
- production `manifestSha256 === preview manifestSha256`;
- stored production deep verification passes;
- public production candidate verification passes.

This is the first HPA-611 production R2 write in the normal no-existing-baseline case.

## Rollback target, created only when go-live is imminent

The current `rollback` command requires an existing immutable release manifest and cannot delete `current.json`.

Immediately after the real production candidate is published/verified and immediately before activation:

1. list/deep-verify production audio release history;
2. if the existing active audio pointer is invalid, stop;
3. if a valid active prior audio release exists, retain it as the rollback target;
4. otherwise create a temporary all-omitted document from the frozen compiler report, use an empty generation root, and publish a zero-asset silent production candidate without activation;
5. deep/public verify that silent candidate and retain its identity.

This timing preserves pointer-only rollback while avoiding any production HPA-611 object before preview approval.

The all-omitted release needs no provider call, source archive, MP3, or full deployed audio gate. The public verifier already accepts zero assets; `findAudioGateAnchors()` intentionally cannot construct BGM/SFX anchors for such a release. Rollback verification for the silent baseline is therefore public pointer/manifest verification plus a simple deployed-reader usability/silence smoke.

## Activation, rollback, and reactivation

After preview approval, production candidate verification, and rollback-target retention:

1. activate the approved production audio pointer with exact story confirmation;
2. run active public verification and the deployed production audio gate;
3. smoke representative playback/navigation/controls;
4. rollback to the retained prior/silent release;
5. verify the rollback identity and deployed behavior;
6. reactivate the approved HPA-611 release;
7. rerun active verification/deployed audio gate.

All mutations are pointer-only CAS writes. Never delete immutable objects, manifests, archives, or history.

## Failure policy

Stop before the next paid/mutating stage when a gate fails.

- Tool/credential-presence/terms/dry-run problem: do not generate.
- Candidate rejection: regenerate only that key.
- Coverage/spec/local-encode failure: do not write R2.
- Preview publish/verify/gate/manual-review failure: do not write production R2.
- Preview/production identity mismatch: do not activate.
- Production candidate verification failure: do not create baseline or activate.
- Invalid pre-existing production audio pointer: stop rather than treating it as no audio.
- Production smoke failure: rollback immediately to the retained baseline.
- Rollback proof failure: leave the safer verified pointer active and do not close HPA-611.

Do not bypass checks, widen credentials, overwrite immutable keys, add a framework, or delete history to recover from a release failure.

## Verification scope

The deployed audio identity/playback path is proved by the credentialed `test:release-gate` runs during preview, activation, rollback where applicable, and reactivation. The ordinary `bun --filter e2e test:e2e` suite does **not** load `visual-novel-deployed.spec.ts`.

If execution changes only:

- the two HPA-611 planning docs;
- the focused target-invariance unit test; and
- optional `audio-omissions.json`;

then final repository verification stays scoped to compiler drift plus stories/publisher tests. Do not add full web/local-E2E/lint/build ceremony that cannot exercise the release evidence.

If a real blocker fix changes product/runtime code, run the affected focused tests plus the repository lint/build and any workspace/E2E suites relevant to the changed module. Keep that fix on the same HPA-611 PR.

## Evidence and cleanup

Temporary machine reports stay under `.tmp/hpa-611/`; provider work stays under `.tmp/audio-generation/theSeventhMirror/`. Neither is committed.

HPA-611's final Linear summary records:

- frozen commit/audio-plan SHA;
- compiler counts and worksheet provenance;
- initial request cap and actual provider requests/cost/credits where available;
- selected/omitted counts;
- local encode proof;
- effective preview ID source;
- preview + production release IDs/checksums and exact equality;
- private archive/public 404 evidence;
- stored/public/deployed verification;
- manual review result;
- rollback baseline identity;
- activation/rollback/reactivation pointer evidence;
- scoped final repository verification;
- explicitly deferred creative ideas.

Never paste secrets, full private receipts, local private source paths, or generated binaries into Linear.

## Acceptance

HPA-611 is complete when:

- the pre-spend tool/credential/terms gates passed;
- target-independent audio identity is pinned by the existing publisher unit-test suite;
- every compiler-used cue is selected or explicitly omitted;
- the local publish proves every included source encodes;
- preview is approved before any HPA-611 production R2 write;
- preview and production release ID/checksum are identical;
- stored/public/deployed verification and bounded human review pass;
- production activation changes only the audio pointer;
- pointer-only rollback to a valid prior or silent baseline succeeds;
- pointer-only reactivation succeeds;
- scoped repository regression passes;
- production binaries/authoring receipts remain out of git.

## Non-goals

- New generation, publisher, storage, playback, or evidence frameworks
- Audio support for `mirror-preview`
- Pointer deletion
- Automatic candidate ranking/approval
- Voice acting/TTS
- Adaptive/procedural scoring
- New codecs, mastering, loop editing, or a post-production pipeline
- Reauthoring plot/dialogue beyond a minimal concrete audio correction
- Visual asset republishing/redesign
- Deleting historical R2 objects/releases
- Automated legal attestation
