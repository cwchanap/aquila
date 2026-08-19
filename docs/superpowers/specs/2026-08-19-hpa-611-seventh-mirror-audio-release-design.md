# HPA-611 Seventh Mirror Audio Release Design

## Status

Proposed design for HPA-611, the final production-content/release task in the current Aquila audio chain.

HPA-607, HPA-608, HPA-609, and HPA-610 are complete on `main`. HPA-611 should therefore execute the shipped seams rather than add another audio subsystem.

## Goal

Generate and curate the approved The Seventh Mirror audio palette, publish one immutable runtime audio release, verify the exact candidate in preview, activate it in production, and prove pointer-only rollback/reactivation with auditable evidence.

## Current state on `main`

The repository already provides every required product/runtime seam:

- `packages/stories/src/compiler/cli.ts --report` produces deterministic cue coverage for `theSeventhMirror`; the regression test requires `unused: []`.
- `packages/stories/src/audio-generation/cli.ts` provides resumable `generate` and checksum-linked `select` commands with a hard `--max-requests` gate for paid work.
- `packages/infra-cloudflare/src/publisher/cli.ts` provides audio `plan`, `publish`, `activate`, `verify`, `releases`, and `rollback` through the existing R2 source/delivery stores.
- Audio `publish` writes immutable source archives, MP3 objects, and a release manifest but does not mutate `current.json`.
- `packages/infra-cloudflare/src/verify.ts` verifies public audio candidates or active releases, including MIME/cache/integrity, Range 206 for a real MP3, and private archive 404 probes.
- `packages/e2e/tests/visual-novel-deployed.spec.ts` can pin both visual and audio release IDs/checksums against a deployed preview or production reader.
- HPA-610 already owns the reader behavior for missing/omitted cues, SFX one-shot semantics, BGM continuation/change/stop, audio toggles, and Safari-safe first-load behavior.

The checked-in audio plan currently contains 41 entries: 28 SFX and 13 BGM. The BGM rows total 1,170,000 ms (19.5 minutes) of intended generated duration; SFX rows total 148,900 ms. These numbers are useful as a sanity bound only. The HPA-608 dry-run output is authoritative for actual scheduled provider requests because resumable local candidates may reduce the work.

## Design decision

Treat HPA-611 as an **operational release run with no planned runtime/product code changes**.

The implementation should use the existing CLIs and retain machine-readable JSON reports under `.tmp/hpa-611/` during the run. Production audio binaries, provider receipts, selections, and generated candidates remain outside git. Linear HPA-611 is the durable audit summary.

If execution exposes a concrete repository defect, fix only the smallest owning module required to unblock the release. Do not use HPA-611 to redesign generation, publishing, runtime playback, or the release gate.

## Preview strategy: republish frozen inputs, do not add audio `mirror-preview`

HPA-611's original checklist says to mirror the exact production candidate into preview. The merged HPA-609 CLI deliberately rejects `mirror-preview --media audio`, so copying the visual workflow literally would require new publisher code.

That code is unnecessary.

`buildPreparedAudioRelease()` derives the audio release ID from canonical story/audio content and derives the manifest checksum from the resulting manifest bytes. The `PublicationTarget` controls where the manifest is stored but is not part of the canonical audio release content or manifest. Therefore the same selected sources, current audio plan, and omission decisions produce the same:

- `releaseId`; and
- `manifestSha256`

when published into preview and production namespaces.

Use that invariant as the exact-candidate proof:

1. freeze generation selections and omissions;
2. publish them into the preview namespace already used by the deployed release-gate reader;
3. verify and approve that preview candidate;
4. publish the same frozen inputs into the production namespace without activation;
5. require production `releaseId` and `manifestSha256` to equal the retained preview values exactly;
6. stop before production activation if either value differs.

This is smaller than adding audio mirroring, stays on the supported audio path, and still proves byte/content identity before production pointer mutation.

### Rejected alternatives

**Add `mirror-preview --media audio`.** This matches the old checklist wording but adds command-matrix behavior and tests for no product benefit. The target-independent audio identity already gives a stronger equality gate.

**Publish production first, then hand-copy R2 keys into preview.** This bypasses publisher verification and creates an ad-hoc release path. Reject it.

**Trust matching source filenames or candidate IDs.** Those are authoring identities, not runtime release identity. The gate is the release ID plus manifest-byte checksum.

## Frozen release input

Before any paid generation, record one release-input evidence block in HPA-611 containing:

- exact git commit SHA;
- SHA-256 of `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`;
- retained compiler `audio:report` JSON and counts;
- unique SFX/BGM count and intended duration;
- HPA-608 dry-run scheduled request count;
- the hard request cap for the initial paid pass;
- an estimate of provider credits/cost when the current provider UI/API makes that calculable;
- date and source used to confirm that the current ElevenLabs plan and applicable Music/model terms permit the intended generation/distribution workflow.

After the dated account/terms check, write a small non-empty `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`. HPA-608 intentionally requires this local note before the first BGM provider request. Keep the note short: date, source, and the operator's acknowledgement are enough; it is not a legal attestation or a second policy document.

The legal/plan check is a human release prerequisite, not a new automated policy engine. If the current terms or account plan are ambiguous, stop the paid run and resolve that separately.

After this freeze, any edit to cue placement or `audio-plan.json` invalidates the run. Recompute the hashes/report/dry-run rather than carrying forward selections generated against stale specs.

## Generation and curation

Use one candidate per unresolved cue for the initial pass:

- first run `audio:generate --missing --candidate-count 1 --dry-run`;
- retain the JSON result;
- set the paid `--max-requests` to the dry-run's scheduled request count, not an arbitrary larger ceiling;
- run the resumable paid pass;
- manually listen to each candidate in story context;
- select exactly one approved candidate per included key with `audio:select`;
- generate additional candidates only for keys explicitly rejected in review.

Do not pre-generate two to four candidates for every cue. The review burden and provider spend are both larger, while HPA-608 already makes targeted retry cheap.

A failed/interrupted paid run resumes from its persisted receipts and candidate files. Do not delete `.tmp/audio-generation/theSeventhMirror` to "start clean" unless the operator intentionally wants to discard valid provider work.

### Omissions

Every compiler-used cue must end with exactly one disposition:

- selected and included; or
- explicitly omitted with a short non-empty reason.

If final curation has no omissions, do not create a permanent omissions file just for ceremony. If one or more cues are intentionally omitted, store the canonical reasons in:

`packages/stories/raw/theSeventhMirror/docs/audio-omissions.json`

using HPA-609's existing schema. That is the only expected git-tracked content change during execution, and only when real omissions exist.

## First-release rollback baseline

The current `rollback` command points to an existing immutable release; it cannot delete an audio `current.json` pointer. Therefore a repository with no previous production audio release cannot prove "rollback to no audio" by pointer deletion.

Use a verified **silent audio release** as the explicit first-release baseline.

Before publishing the real production candidate:

1. list production audio releases with deep verification;
2. if a valid prior production audio release exists, retain its release ID/checksum as the rollback target;
3. otherwise generate a temporary all-omitted omissions document from the retained compiler report;
4. use a distinct empty generation root so final selections cannot conflict with the all-omitted coverage;
5. publish the all-omitted release to the production namespace without activation;
6. deep-verify the stored candidate and public candidate;
7. retain its release ID/checksum as `ROLLBACK_*` evidence.

HPA-609 explicitly supports all-omitted audio manifests with zero runtime assets, and the public verifier skips MP3/archive probes for that valid empty release. The silent baseline is immutable and never needs provider calls or source archives.

Do not commit the all-omitted baseline file. It is run-scoped evidence under `.tmp/hpa-611/` and exists only to represent the pre-audio product state with existing pointer semantics.

## Preview release gate

Reuse the **existing deployed preview's asset preview namespace**. The reader resolves visual and audio pointers from one preview ID, and the deployed gate also receives that value as `RELEASE_GATE_PREVIEW_ID`.

Do not invent a separate audio-only preview ID. If a new isolated preview namespace is deliberately required, seed its visual release first with the existing visual publisher; that is additional release setup, not a reason to add an audio mirror command. HPA-611 should normally reuse the already-working release-gate preview namespace and leave its visual release untouched.

The preview sequence is:

1. retain the active deep-verified visual release identity already present in that namespace;
2. publish the frozen selected audio inputs into the same preview namespace;
3. retain `releaseId` and `manifestSha256` from publisher JSON stdout;
4. deep-verify the stored candidate;
5. run the public candidate verifier against `assets.aquila.cwchanap.dev`;
6. activate only the preview audio pointer;
7. run the public active verifier;
8. run the deployed Playwright release gate with the retained visual identity plus the retained audio identity;
9. perform the representative human listening pass.

For a non-empty release, the public verifier must receive at least one real private source/archive key as `--archive-probe-key`; both the selected source and receipt paths are valid probes. They must return exact 404 from the public delivery host.

The Playwright release gate must prove the audio identity on the stable reader-ready host and exercise representative SFX/BGM behavior without republishing visuals. If the deployed preview is protected, use the existing Vercel automation bypass secret; do not weaken preview protection.

### Human direction review

Keep this bounded to the checklist's representative states rather than replaying every line manually:

- early, middle, late story;
- quiet section;
- recurring physical motif;
- supernatural motif;
- action/high-tension section;
- BGM continuation;
- BGM change;
- explicit BGM stop/silence;
- at least one available branch/choice path;
- desktop and mobile viewport;
- headphones and speakers;
- SFX/BGM sliders/toggles and muted readability.

Record only actionable findings. Regenerate/reselect the affected key; do not rewrite unrelated story content.

## Production publication and activation

After preview approval, rerun audio `publish` against the production namespace using the same frozen generation root and final omission file/absence.

Production publication must be candidate-only and leave the production pointer untouched.

Before activation, assert:

- production `releaseId === preview releaseId`;
- production `manifestSha256 === preview manifestSha256`;
- stored production deep verification passes;
- public production candidate verification passes.

Only then run `activate --media audio --environment production` with exact story confirmation and the retained manifest checksum.

Activation changes only `vn/audio/stories/the_seventh_mirror/current.json`. It does not require a Vercel rebuild, visual release, story compilation output commit, or regeneration of MP3 objects.

Immediately run the public active verifier and deployed production smoke pinned to the same audio release identity.

## Rollback and reactivation proof

After the production smoke passes:

1. run `rollback --media audio` to the retained previous release or silent baseline;
2. verify the production active pointer resolves to the rollback identity;
3. smoke the deployed reader and prove the previous/no-audio state is usable;
4. reactivate the approved HPA-611 release with `activate --media audio`;
5. verify and smoke again;
6. retain all three pointer mutation reports.

No rollback step deletes MP3 objects, manifests, archives, or pointers. Rollback and reactivation are pointer-only CAS writes.

## Failure policy

Stop before the next irreversible/paid/mutating stage when any gate fails.

- Dry-run/provider-plan/terms problem: do not generate.
- Candidate review rejection: regenerate only that key.
- Selection/coverage/spec mismatch: do not publish; fix the selection or re-freeze changed plan inputs.
- Preview publish/verify/gate failure: do not create/activate production candidate.
- Preview/production identity mismatch: do not activate production; investigate changed inputs.
- Production candidate verification failure: do not activate.
- Production smoke failure: rollback immediately to the retained baseline, then investigate.
- Rollback proof failure: leave the safer verified pointer active and do not claim HPA-611 complete.

Do not respond to a release failure by adding a framework, bypassing checks, widening credentials, manually overwriting immutable keys, or deleting history.

## Evidence and cleanup

The run keeps temporary machine reports under `.tmp/hpa-611/` and generated/provider work under `.tmp/audio-generation/theSeventhMirror/`. Neither directory is committed.

HPA-611 receives a concise final Linear summary containing:

- frozen commit and audio-plan SHA-256;
- compiler coverage counts;
- dry-run request cap and actual provider requests/cost/credits where available;
- selected and omitted cue counts;
- preview release ID/manifest checksum;
- production release ID/manifest checksum and equality result;
- private archive confirmation;
- stored/public/deployed verification results;
- manual direction-review result;
- rollback baseline identity;
- production activation, rollback, and reactivation pointer evidence;
- deliberately deferred creative ideas.

Do not paste credentials, API keys, full provider receipts, private source paths from the local filesystem, or generated audio binaries into Linear.

## Acceptance

HPA-611 is complete when:

- every compiler-used cue is selected or explicitly omitted;
- the paid generation boundary was recorded before generation;
- the required local music terms note exists before any BGM provider call;
- approved originals/specs/receipts are archived privately;
- preview and production runtime release ID/checksum are identical;
- stored and public verification pass;
- the deployed reader passes the audio release gate and representative manual review;
- production activation changes only the audio pointer;
- pointer-only rollback to a prior release or silent baseline succeeds;
- pointer-only reactivation succeeds;
- final repository regressions pass;
- production audio binaries and authoring receipts remain out of git.

## Non-goals

- New generation, publisher, media, storage, or playback frameworks
- Audio support for visual `mirror-preview`
- Automatic candidate ranking or approval
- Voice acting/TTS/dialogue dubbing
- Adaptive/procedural score systems
- New codecs, loudness mastering, loop editing, or audio post-production pipeline
- Reauthoring The Seventh Mirror plot/dialogue beyond a minimal correction required by a concrete audio defect
- Republish or redesign of visual assets
- Deleting historical R2 objects/releases
- Automated legal attestation
