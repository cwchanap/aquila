# HPA-231 The Seventh Mirror R2 Migration Design

## Status

Design for HPA-231: migrate **The Seventh Mirror** from repository/Vercel-hosted visual binaries to the existing Aquila R2 visual-asset delivery path.

This is deliberately a one-story migration and release checklist. It does not redesign the runtime contract, reader, publisher, R2 infrastructure, release gate, or reader session model.

## Goal

Ship one production R2-backed release of `the_seventh_mirror`, prove the existing preview/production/rollback flow with real assets, archive the authoring originals privately, and then remove production-sized story binaries from the canonical Git/Vercel delivery path while preserving tiny local fixtures for development and tests.

## Constraints

HPA-231 inherits the architecture already completed by HPA-227 through HPA-234:

- HPA-227 owns runtime manifests, active pointers, type-qualified logical keys, release plans, validation, and cache policy.
- HPA-228 owns the visual reader and local fixture fallback behavior.
- HPA-229 owns the private `aquila-vn-source` bucket, public `aquila-vn-delivery` bucket, custom delivery domain, CORS, and cache rules.
- HPA-230 owns deterministic encoding, immutable content-addressed publication, candidate verification, activation, release listing, preview mirroring, and rollback.
- HPA-233 owns the manually triggered preview release gate and deployed desktop/mobile browser checks.
- HPA-234 owns canonical reader position and text/visual mode continuity.

The migration must not add new schema versions, compatibility layers, publisher command families, storage abstractions, automatic production mutation, approval/evidence platforms, generalized source synchronization, or multi-story migration orchestration.

## Current State

The compiler already emits the authoritative The Seventh Mirror authoring inventory at:

`packages/stories/src/generated/theSeventhMirror/image-assets.json`

Each generated entry has a type-qualified logical identity and a source path under:

`packages/assets/media/the_seventh_mirror/`

The publisher already discovers this generated manifest, strips authoring-only prompt fields, validates the checked-in release plan, encodes included sources, produces immutable runtime objects and a prompt-free manifest, and can publish a production candidate with `--no-activate`.

The publisher runbook intentionally leaves one HPA-231 prerequisite absent:

`packages/stories/release-plans/the_seventh_mirror.json`

The web package also contains a tiny HPA-228 preview fixture release. Its fixture builder currently consumes four source images:

- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `the_seventh_mirror/characters/asakura_mio/base.png`
- `the_seventh_mirror/characters/asakura_yuma/base.png`

Those four logical fixture inputs should remain available after production cleanup, but only as intentionally downsized fixture binaries.

## Design Decision

HPA-231 will be implemented as a thin migration layer over the existing system:

1. Add one complete checked-in production release plan for `the_seventh_mirror`.
2. Add one structural test that proves every compiler-generated type-qualified key is classified exactly once without requiring production source files to remain in Git.
3. Archive the current authoring source tree and generation metadata once into the existing private R2 source bucket using a manual S3-compatible synchronization procedure.
4. Publish and deeply verify an immutable production candidate without activation.
5. Qualify that exact candidate through the existing HPA-233 preview gate plus a brief manual visual review.
6. Activate production using the existing explicit publisher command and run the existing production public/browser smoke checks.
7. Prove production pointer-only rollback and reactivation using two verified releases. Reuse an existing valid full-story production release if one exists; otherwise create one controlled one-image revision as the second release.
8. Only after production and rollback/reactivation are proven, remove production-sized The Seventh Mirror binaries from Git/Vercel, retain tiny fixture inputs, regenerate local fixture outputs, and add one narrow CI footprint guard.
9. Record release IDs, checksums, archive location, smoke results, and rollback/reactivation results in the HPA-231 issue.

No new runtime or infrastructure service is introduced.

## Production Release Plan

### Canonical inventory

The generated `image-assets.json` remains the inventory source of truth. The production release plan is not a second inventory system; it is only a classification of that generated inventory.

Create:

`packages/stories/release-plans/the_seventh_mirror.json`

with:

- `schemaVersion: 1`
- `storyId: "the_seventh_mirror"`
- `channel: "production"`
- one entry for every generated background and portrait

Every entry is exactly one of:

- `included`: source artwork exists and should ship; `sourcePath` must exactly match the compiler-generated path.
- `omitted`: the reader should intentionally use fallback behavior; include one concise reason and no `sourcePath`.

A one-off local scaffold command may classify existing source paths as included and absent paths as omitted, after which the developer reviews the generated diff. The scaffold command is not committed as a generalized migration/generation tool.

### Structural CI coverage

After repository cleanup, most production source files intentionally no longer exist in the checkout. Therefore CI must not validate the release plan by requiring `packages/assets/media/the_seventh_mirror` to contain every included source.

Instead, a focused stories-package test will:

- parse the production release plan through the existing HPA-227 schema;
- read the compiler-generated `image-assets.json`;
- build the same type-qualified identity set used by the publisher;
- require exact one-to-one coverage between generated identities and plan identities;
- require every included entry's `sourcePath` to equal the generated authoring path;
- require production channel/story identity to remain correct.

Actual source existence and image validity remain publisher-time concerns when a source archive is restored for republishing.

## Private Source Archive

### Purpose

The private source bucket becomes the durable authoring source after cleanup. It must preserve enough information to restore an exact publisher source root and understand the logical-key/source mapping without creating a new database or source-management service.

### Archive layout

Use one immutable prefix:

`authoring/the_seventh_mirror/<archive-id>/`

with:

- `media/the_seventh_mirror/**` — original image source tree
- `metadata/image-assets.json` — compiler-generated authoring inventory, including generation metadata
- `metadata/release-plan.json` — the checked-in production classification used for this migration
- `SHA256SUMS` — checksums for every archived file

The `<archive-id>` is `<UTC-date>-<12-char-git-sha>` from the commit used to prepare the release.

The archive is uploaded with a manual S3-compatible sync against the existing R2 endpoint and a credential scoped to `aquila-vn-source`. This procedure remains operator documentation, not production application code.

### Restore contract

Restoring the archive must produce a directory where:

`.tmp/hpa-231-restored/media/the_seventh_mirror/...`

matches the release-plan `sourcePath` values when the publisher is run with:

`--source-root .tmp/hpa-231-restored/media`

The restore check verifies `SHA256SUMS` and runs the existing publisher `plan` command. A successful restore must produce the same candidate release ID and manifest checksum as the original source tree for the same release plan and encoder version.

## Immutable Candidate and Preview Qualification

The first production candidate is created from the checked-in production plan and the original source tree while all source files still exist locally:

- `assets plan --environment production` confirms complete coverage and encoding policy.
- `assets publish --environment production --destination r2 --no-activate --json` creates/reuses immutable objects and the production manifest but leaves production `current.json` unchanged.
- The retained JSON report is the source of truth for `releaseId` and `manifestSha256`.

The existing **Visual Novel Release Gate** workflow then:

1. deep-verifies the production candidate read-only;
2. mirrors the exact manifest bytes into an isolated preview namespace;
3. activates only the preview pointer;
4. verifies public CDN delivery;
5. runs the deployed release-gate browser spec on Desktop Chromium and Mobile Chromium.

HPA-231 adds no second gate or evidence schema.

## Manual Visual Review

After the automated preview gate passes, perform one concise manual review of representative early, middle, and late story scenes.

The review must cover:

- at least one background transition;
- at least one portrait/expression transition;
- at least one intentionally omitted/missing asset fallback;
- one choice path where available;
- desktop presentation;
- mobile presentation;
- no visible regression when switching between text and visual mode.

Record the result as a short HPA-231 Linear comment/checklist. Screenshots are optional; no versioned review record is added.

## Production Activation and Smoke Test

After preview and manual review pass, activate the retained candidate with the existing production-confirmed publisher command.

Activation must not re-encode or read the source archive. It changes only:

`vn/stories/the_seventh_mirror/current.json`

Then run the existing production public verifier and deployed release-gate browser spec against `https://aquila.cwchanap.dev` with no preview ID.

The production smoke must prove:

- the public pointer resolves to the expected release ID and manifest checksum;
- the runtime manifest and objects are publicly readable and valid;
- desktop and mobile reader flows open and progress;
- text/visual mode switching preserves the exact active dialogue line.

## Rollback and Reactivation Proof

HPA-231 must finish with two verified production releases so rollback changes only the pointer.

### Preferred case

If a previous full-story release exists and passes deep verification under the production release plan, use it as the rollback target.

### First-release case

If no previous valid full-story release exists, create one controlled second release after the primary production release is verified:

- restore/copy the same source root into a temporary working source root;
- make one deliberately tiny, visually reviewed revision to `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png` that changes encoded bytes without changing logical identity or dimensions;
- publish the second candidate with the same production release plan and `--no-activate`;
- deep-verify and run the existing preview release gate for the second candidate;
- activate the second release and run the production smoke;
- roll back to the first verified release using `assets rollback`;
- run production public/browser verification against the first release;
- reactivate the second verified release using `assets activate --reactivate`;
- run production public/browser verification against the second release again.

The one revised source file is added to the private source archive as a second immutable revision prefix only if this first-release path is required. No generic revision manager is introduced.

The final HPA-231 comment records both release IDs and manifest checksums plus rollback/reactivation success.

## Repository Cleanup

Cleanup happens only after production smoke and rollback/reactivation have succeeded.

### Authoring media

Remove production-sized The Seventh Mirror source binaries from:

`packages/assets/media/the_seventh_mirror/`

Retain only the four HPA-228 fixture source paths already consumed by `apps/web/scripts/build-visual-fixtures.ts`, replacing their large originals with deliberately small fixture-only images at the same paths.

Keeping the same relative paths avoids a new fixture-source mapping layer and keeps existing local fixture tooling simple.

### Generated local runtime fixture

Run the existing fixture builder after downsizing the four inputs. Commit the new tiny preview fixture pointer, runtime manifest, and content-addressed objects. Remove stale unreferenced local fixture objects from `apps/web/public/assets/vn/`.

The local fixture remains a developer/test artifact; it is not a production delivery path.

## CI Footprint Guard

Add one narrow script under `apps/web/scripts/` and wire it into the existing Build & Lint workflow.

The guard inspects only:

- `packages/assets/media/the_seventh_mirror/`
- `apps/web/public/assets/vn/`

It enforces:

1. exactly the four approved fixture source paths are present under the The Seventh Mirror authoring-media tree;
2. each retained fixture source and their combined size stay below small explicit byte thresholds based on the downsized fixture files;
3. the committed local `vn/` tree contains only the approved fixture pointer, its referenced manifest, and objects referenced by that manifest;
4. no extra production-sized raster binary is reintroduced.

The guard is intentionally story-specific. It does not become a repository-wide binary policy or generalized asset linter.

## Failure Handling

Failures are handled in the module that already owns the failed behavior:

- release-plan coverage or source mismatch: fix the HPA-231 release plan/source mapping;
- encoding or manifest defect: fix the smallest concrete HPA-230 publisher defect only if the existing publisher is wrong;
- public CDN failure: fix HPA-229 configuration only if live infrastructure is wrong;
- deployed reader failure: fix the smallest concrete HPA-228/HPA-234 reader defect;
- preview workflow defect: fix the smallest concrete HPA-233 gate defect.

Before production activation, a failure leaves only immutable candidate data and requires no rollback.

After activation, rollback uses the existing pointer-only command. HPA-231 never deletes R2 runtime objects as compensation.

Repository cleanup is not allowed to begin until production activation, smoke verification, and rollback/reactivation proof are complete.

## Testing Strategy

### Credential-free PR checks

The implementation PR must keep normal CI independent from live R2 credentials:

- stories release-plan structural test;
- web fixture verification;
- new asset-footprint guard test;
- existing stories/web/infra unit tests;
- lint/build/compile checks.

### Operator/live checks

The migration run itself performs:

- private archive upload and restore checksum verification;
- local production `assets plan`;
- R2 candidate publish with `--no-activate`;
- deep stored-candidate verification;
- HPA-233 preview release gate;
- manual desktop/mobile visual review;
- production activation;
- production public verifier;
- production deployed release-gate browser spec;
- pointer-only rollback and reactivation with verification after each pointer move.

## File-Level Scope

Expected checked-in changes for the implementation PR are intentionally small:

- Create `packages/stories/release-plans/the_seventh_mirror.json`.
- Create one focused stories test for release-plan structural coverage.
- Create `docs/infrastructure/the-seventh-mirror-r2-migration.md` with archive/restore/release commands and final evidence fields.
- Modify the four existing fixture source files with downsized fixture-only versions.
- Remove all other `packages/assets/media/the_seventh_mirror/**` binaries.
- Regenerate the existing `apps/web/public/assets/vn/**` local fixture outputs.
- Create `apps/web/scripts/assert-visual-asset-footprint.ts` and its focused test.
- Modify `apps/web/package.json` to expose the footprint check.
- Modify `.github/workflows/build-and-lint.yml` to run the footprint check.

No runtime reader or publisher file should change unless execution uncovers a concrete blocking defect.

## Alternatives Rejected

### Build a generic source-asset synchronization service

Rejected. HPA-231 needs one archive and one documented restore path. A service adds credentials, lifecycle, APIs, and maintenance without improving this migration.

### Extend the publisher to own the private source bucket

Rejected. The publisher intentionally operates on delivery artifacts and scoped delivery credentials. Mixing authoring-source archival into it expands its trust and failure boundary for a one-time task.

### Keep all production originals in Git and only switch runtime delivery to R2

Rejected. This would leave the major Vercel/Git repository-weight problem unsolved and fail the explicit HPA-231 cleanup goal.

### Move all fixtures into a new fixture-source tree

Rejected. Keeping four small files at the existing source paths preserves the current fixture builder and avoids another mapping/configuration layer.

### Add generalized repository binary limits

Rejected. Other Aquila content may legitimately carry binaries. HPA-231 only needs to stop production-sized The Seventh Mirror visual assets from returning to the canonical delivery path.

## Acceptance Mapping

HPA-231 is complete when:

- every generated background/portrait identity is included or omitted in the checked-in production plan;
- every included asset publishes into a valid prompt-free immutable runtime manifest;
- omitted identities are absent from the runtime manifest and reader progression continues through fallback;
- the exact candidate passes HPA-233 preview CDN/browser qualification;
- manual early/middle/late desktop/mobile visual review passes;
- production activates without a Vercel rebuild and reports the expected release identity;
- text/visual switching preserves the exact active line;
- two verified releases demonstrate pointer-only production rollback and reactivation;
- original sources and generation metadata are privately archived and restorable;
- production-sized The Seventh Mirror binaries are removed from canonical Git/Vercel paths;
- tiny local fixtures continue to support tests and local UI work;
- the focused CI footprint guard prevents accidental reintroduction;
- release IDs/checksums and final smoke/rollback results are recorded on HPA-231;
- HPA-231 can move to Done and parent HPA-216 can then be closed.
