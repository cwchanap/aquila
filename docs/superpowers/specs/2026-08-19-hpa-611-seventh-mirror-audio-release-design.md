# HPA-611 Seventh Mirror Audio Release Design

## Status

Revised design for HPA-611, the final production-content/release task in the current Aquila audio chain.

HPA-607, HPA-608, HPA-609, and HPA-610 are complete on `main`. HPA-611 executes those shipped seams rather than adding another audio subsystem.

## Goal

Generate and curate the approved The Seventh Mirror audio palette, prove final sources encode locally, approve the exact runtime candidate in the deployed preview, publish the same frozen candidate to production, activate it, and prove pointer-only rollback/reactivation with durable release evidence.

## Design decision

Treat HPA-611 as an **operational release run with no production/runtime feature work**.

The only planned source-tree code change before provider spend is one regression case in the existing `audio-runtime-release.test.ts`: the whole release procedure relies on the fact that preview and production targets produce the same audio `releaseId`, `manifestSha256`, and manifest bytes for identical normalized inputs. Pin that invariant; do not add `mirror-preview --media audio`.

Everything else uses existing CLIs and temporary evidence under `.tmp/hpa-611/`. Production binaries, provider receipts, generated candidates, and selections remain outside git. A real final `audio-omissions.json` is tracked only when curation intentionally omits one or more compiler-used cues. Any concrete implementation blocker is fixed only in the smallest owning module on this same HPA-611 PR.

## Existing seams and invariants

The current code already supplies the required workflow:

- `packages/stories/src/compiler/cli.ts --report` emits each used cue with `sceneId`, `sourcePath`, zero-based `entryIndex`, and every explicit `bgmStops` location.
- HPA-608 generation is resumable, checksum-linked, and bounded by `--candidate-count` and `--max-requests`.
- Real BGM generation requires the non-empty local `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`.
- HPA-609 audio `publish` calls the existing `ffmpeg`/`ffprobe` preflight, normalizes sources, archives approved originals/receipts privately, creates/reuses immutable MP3 objects/manifests, and never activates an audio pointer.
- R2 delivery and audio publication commands use one shared `R2_RELEASE_ACCESS_KEY_ID` / `R2_RELEASE_SECRET_ACCESS_KEY` pair for both buckets; delivery remains public and the source archive remains private.
- `assets releases --media audio ... --destination r2 --deep` is read-only and exercises the delivery credential path and R2 reachability while also reporting current release/pointer state.
- Public audio verification supports candidate and active modes, Range 206 for a non-empty release, repeatable `--archive-probe-key`, and all-omitted zero-asset releases.
- The ordinary local Playwright config excludes `visual-novel-deployed.spec.ts`; `test:release-gate-config` is the credential-free config/anchor gate, and `test:release-gate` is the real deployed gate.
- `compile:check` already runs `compile:stories` before its generated-output diff check.

The checked-in audio plan currently has 41 used entries: 28 SFX and 13 BGM. Those counts are a sanity bound only; the HPA-608 dry-run is authoritative for the actual paid request count because resumable current-spec candidates may already exist.

## Target-independent audio identity

Do not add `mirror-preview --media audio`.

`canonicalAudioReleaseContent()` hashes schema version, story ID, and sorted runtime audio assets. Runtime MP3 paths are content-addressed under `vn/objects/<sha256>.mp3`. `buildPreparedAudioRelease()` stores the publication target only on the returned prepared-release object; target does not participate in release-content or manifest identity.

Therefore identical normalized inputs must produce identical:

- `releaseId`;
- `manifestSha256`; and
- manifest bytes

for preview and production targets.

Execution adds one focused test to `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts` proving that invariant with the existing fixtures. Production then enforces the same invariant operationally by comparing the retained preview identity files against separately retained production identity files. Re-running preview publication merely to reconstruct lost shell variables is not an acceptable recovery path.

## Pre-spend preflight

Before any paid provider call:

1. prove `ffmpeg -hide_banner -version` and `ffprobe -hide_banner -version` succeed;
2. run `bun --filter e2e test:release-gate-config` so gate/anchor assumptions fail before credentials, generation, or deployment are involved;
3. run read-only deep production audio release listing through the real R2 delivery store. This proves the delivery credential pair is usable and R2 is reachable, while also giving early visibility into whether a previous active audio baseline exists;
4. retain the single `R2_RELEASE_*` credential contract used by both delivery and source stores; there is no separate source-archive credential pair;
5. add and run the target-invariance unit test;
6. freeze the post-test commit, audio-plan SHA-256, compiler report, dry-run request cap, provider account/terms evidence, and required local Music terms note.

The Task 1 production release listing is **early knowledge only**. Immediately before go-live the workflow lists production audio history again and the fresh report wins, so concurrent pointer/release changes cannot be hidden by stale preflight evidence.

## Frozen report and listening worksheet

Retain the compiler `audio:report` JSON and derive exactly one disposable listening worksheet from it. This is not a second review contract: it is only a readable projection of the compiler-owned report.

The worksheet contains:

- one row per used `type:key`, including every report-provided usage location;
- one row for every `bgmStops` location.

Curation and preview direction review use the same worksheet to navigate reuse sites and explicit silence. Any edit to cue placement or `audio-plan.json` invalidates the freeze; regenerate the report, worksheet, plan hash, and dry-run rather than carrying stale evidence forward.

## Generation, curation, and local encode proof

Use one candidate per unresolved key for the initial pass. The exact HPA-608 dry-run scheduled request count becomes the paid `--max-requests` cap; a zero count skips the paid command because `maxRequests` accepts only 1–100.

Generate extra candidates only for specifically rejected keys. Every compiler-used key ends in exactly one disposition:

- one explicitly selected current-spec candidate; or
- one explicit omission reason.

If all used cues are selected, do not create `audio-omissions.json`. The publisher already discovers the canonical story omissions file when present and treats absence as no omissions.

After curation, run the existing audio **publish** command against a local destination and deep-verify the local candidate. This exercises real source loading and `ffmpeg`/`ffprobe` normalization for every included source before any R2 write. `plan` alone is not enough.

Freeze the final selection/omission state after local publish succeeds.

## Durable run state across tasks

The execution plan explicitly supports subagent-driven/task-by-task execution. No value needed by a later task may exist only as a shell variable.

Persist cross-task values under `.tmp/hpa-611/` immediately when produced, including:

- `effective-preview-id.txt`;
- `preview-visual-release-id.txt`;
- `preview-visual-manifest-sha256.txt`;
- `preview-audio-release-id.txt`;
- `preview-audio-manifest-sha256.txt`;
- `archive-receipt-probe-key.txt`;
- optional `archive-source-probe-key.txt`;
- `production-visual-release-id.txt`;
- `production-visual-manifest-sha256.txt`;
- `production-audio-release-id.txt`;
- `production-audio-manifest-sha256.txt`;
- `rollback-release-id.txt`;
- `rollback-manifest-sha256.txt`.

Later tasks read these files. Preview/production equality uses `cmp` on the retained files, not values re-derived in one shell session.

## Preview namespace source of truth

Do not choose the preview ID from memory. Copy the effective `PUBLIC_ASSET_PREVIEW_ID` from the deployed Vercel preview/deployment configuration and persist it. Cross-check the deployed reader's stable `data-asset-preview-id` when available. That same retained ID is used for visual history lookup, preview audio publication, and `RELEASE_GATE_PREVIEW_ID`.

## Private archive probes

Do not hand-build an arbitrary private-source URL and treat a 404 as isolation proof.

Select the probe identity from a cue that is both:

1. present in the frozen compiler report (therefore actually used); and
2. present in the final selection file.

Read the selected candidate receipt and use its verified `sourceSha256`. Build the publisher-owned archive prefix:

`audio/approved/the_seventh_mirror/<type>/<key>/<sourceSha256>`

Persist and probe the fixed `receipt.json` path. This is the primary isolation proof because it avoids extension derivation entirely. The source object may be probed as a supplemental second key; if so, derive the extension exactly as the publisher does by lowercasing it. The public verifier accepts repeatable `--archive-probe-key`, so pass both retained paths when both exist.

## Preview approval

After local encode proof, while production remains untouched:

1. resolve and persist the deployed preview ID;
2. deep-list the active preview visual release and persist its release ID/checksum;
3. publish the frozen audio inputs into that preview namespace and immediately persist the audio release ID/checksum;
4. deep-verify the stored candidate;
5. derive/persist the private archive probe key(s) from one compiler-used selected cue;
6. run public candidate verification;
7. activate only the preview audio pointer and run public active verification;
8. run the deployed `test:release-gate` pinned to retained visual + audio identities;
9. perform the bounded worksheet-driven human review.

If a cue is rejected, regenerate/reselect only that key, rerun local publish, freeze again, and approve a new preview candidate. Production remains untouched.

## Production candidate and equality gate

Only after preview approval, publish the same frozen inputs to the production namespace without activation. Persist the production release ID/checksum immediately.

The hard equality gate is file-to-file:

- production audio release ID file must byte-match the retained preview release ID file;
- production manifest SHA file must byte-match the retained preview manifest SHA file.

Then deep-verify and publicly verify the production candidate. Persist the active production visual identity separately for deployed production gates; do not republish visuals.

## Rollback target, resolved late

The Task 1 release listing gives early baseline awareness, but it is not authoritative at go-live. After the real production candidate has been published and verified, immediately before activation:

1. rerun deep production audio release listing;
2. stop on an invalid current pointer;
3. if a valid active previous audio release exists, persist it as the rollback target;
4. otherwise publish a temporary all-omitted zero-asset production candidate using a separate empty generation root, deep/public verify it, and persist its identity.

The silent baseline is never activated before the real release. It needs no provider call or source archive, and it cannot run the full audio release gate because there are no BGM/SFX anchors. Its rollback proof is public pointer/manifest verification plus a simple deployed-reader usability/silence smoke.

## Activation, rollback, and reactivation

Task 6 starts by loading every required identity from the retained files.

Then:

1. activate the approved production audio pointer;
2. run active public verification, the deployed production audio gate, and a short smoke;
3. rollback to the retained previous/silent target;
4. verify the rollback identity and behavior;
5. reactivate the approved HPA-611 release;
6. rerun active verification and the deployed audio gate.

All mutations are pointer-only CAS writes. Never delete immutable objects, manifests, archives, or history.

## Verification scope

Run the credential-free `test:release-gate-config` before spend. Run the real deployed `test:release-gate` at preview, production activation, and reactivation; use the appropriate simpler smoke for an intentionally empty rollback baseline.

If the branch changes only the two planning docs, the focused target-invariance test, and optional `audio-omissions.json`, final repository verification is:

- `bun run compile:check` (already includes `compile:stories`);
- `bun --filter @aquila/stories test`;
- `bun --filter @aquila/infra-cloudflare test`.

Do not separately run `compile:stories`, and do not add local `test:e2e`, web tests, lint, or build merely as ceremony: local `test:e2e` excludes the deployed gate that matters here.

If a real blocker fix changes product/runtime code, run focused tests for that module plus lint/build and only the workspace/E2E suites relevant to the changed behavior.

## Failure policy

Stop before the next paid or mutating stage:

- tool/config/gate-config/delivery-R2/source-archive/terms problem → do not generate;
- coverage/spec/local encode problem → do not write R2;
- preview failure → do not write production R2;
- preview/production identity mismatch → do not activate;
- production candidate failure → do not create/retain a new baseline or activate;
- invalid fresh production pointer → stop;
- production smoke failure → rollback to the retained target;
- rollback proof failure → leave the safer verified pointer active and do not close HPA-611.

Do not widen credentials, bypass checks, manually overwrite immutable keys, add a release framework, or delete history to recover.

## Evidence and cleanup

Temporary reports and retained identity files remain under `.tmp/hpa-611/`; provider work stays under `.tmp/audio-generation/theSeventhMirror/`. Neither is committed.

The final Linear summary records the freeze, preflight results, request cap/actual spend, selected/omitted counts, local encode proof, preview-ID source, preview/production identities and equality result, archive-isolation probes, deployed/manual review evidence, rollback identity, activation/rollback/reactivation evidence, and scoped repository verification. Never include secrets, full receipts, local private source paths, or generated binaries.

## Acceptance

HPA-611 is complete when:

- pre-spend executable, gate-config, delivery-R2, source-archive-config, terms, and target-invariance gates pass;
- every compiler-used cue is selected or explicitly omitted;
- local publish proves every included source encodes;
- preview is approved before any HPA-611 production write;
- retained preview and production release ID/checksum files match exactly;
- private archive probes are derived from a real used+selected cue and return exact 404 on the public delivery host;
- stored/public/deployed verification and bounded human review pass;
- production activation changes only the audio pointer;
- pointer-only rollback and reactivation succeed;
- scoped repository regression passes;
- production binaries/authoring receipts remain out of git.

## Non-goals

- New generation, publisher, storage, playback, or evidence frameworks
- Audio support for `mirror-preview`
- Pointer deletion
- Automatic candidate approval
- Voice acting/TTS or adaptive scoring
- New codecs, mastering, loop editing, or post-production pipeline
- Reauthoring plot/dialogue beyond a minimal concrete audio correction
- Visual asset republishing/redesign
- Deleting historical R2 state
- Automated legal attestation
