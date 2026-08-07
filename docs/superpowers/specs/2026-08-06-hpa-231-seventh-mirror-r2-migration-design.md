# HPA-231 The Seventh Mirror R2 Migration Design

## Status

Design for HPA-231: migrate **The Seventh Mirror** from repository/Vercel-hosted visual binaries to the existing Aquila R2 visual-asset delivery path.

This is deliberately a one-story migration and release checklist. It does not redesign the runtime contract, reader, publisher, R2 infrastructure, release gate, or reader session model.

## Goal

Ship one production R2-backed release of `the_seventh_mirror`, prove the existing preview/production/rollback path with real assets, archive the authoring originals privately, and then remove production-sized story binaries from the canonical Git/Vercel path while preserving tiny local fixtures for development and tests.

## Existing Ownership

HPA-231 builds on completed foundations rather than extending them:

- HPA-227 owns runtime manifests, active pointers, type-qualified logical keys, release plans, validation, and cache policy.
- HPA-228 owns the visual reader and local fixture fallback behavior.
- HPA-229 owns the private `aquila-vn-source` bucket, public `aquila-vn-delivery` bucket, custom delivery domain, CORS, and cache rules.
- HPA-230 owns deterministic encoding, immutable content-addressed publication, candidate verification, activation, release listing, preview mirroring, and rollback.
- HPA-233 owns the manually triggered preview release gate and deployed desktop/mobile browser checks.
- HPA-234 owns canonical reader position and text/visual mode continuity.

If execution finds a defect in one of those modules, fix only the smallest concrete defect in the owning module. Do not use HPA-231 as an architecture cleanup project.

## Current State

The compiler already emits the authoritative The Seventh Mirror authoring inventory at:

`packages/stories/src/generated/theSeventhMirror/image-assets.json`

Its paths point into:

`packages/assets/media/the_seventh_mirror/`

The publisher already discovers this generated inventory, strips prompt-bearing authoring fields from its internal catalog, validates an HPA-227 release plan, encodes included sources, produces immutable runtime objects and a prompt-free manifest, and can publish a production candidate with `--no-activate`.

The intended HPA-231-owned production plan is currently absent:

`packages/stories/release-plans/the_seventh_mirror.json`

The HPA-228 local fixture builder currently depends on four source paths:

- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `the_seventh_mirror/characters/asakura_mio/base.png`
- `the_seventh_mirror/characters/asakura_yuma/base.png`

Those four paths remain after cleanup, but their binaries become intentionally tiny fixture-only inputs.

## Design Decision

HPA-231 is a thin migration over existing contracts:

1. Add one complete checked-in production release plan for `the_seventh_mirror`.
2. Add one structural test proving every compiler-generated type-qualified key is classified exactly once without requiring production source files to remain in Git.
3. Archive the current authoring source tree and generation metadata once into the private R2 source bucket using a manual S3-compatible procedure.
4. Publish and deeply verify an immutable production candidate without activation.
5. Qualify that exact candidate through the existing HPA-233 preview gate plus a short manual visual review.
6. Activate production using the existing explicit publisher command and run the existing active production public/browser smoke checks.
7. Prove production pointer-only rollback and activation back to the previously-current release using two verified full-story releases. Reuse a previous full-story release when available; otherwise create one controlled one-image revision as the second release.
8. Only after production and rollback proof pass, remove production-sized The Seventh Mirror binaries from Git/Vercel, retain four tiny fixture inputs, regenerate the local fixture release, and add one narrow CI footprint guard.
9. Record archive identity, release IDs/checksums, preview/manual/production results, and rollback results on HPA-231.

No new runtime service, storage abstraction, publisher command, or release evidence framework is introduced.

## Production Release Plan

### Canonical inventory

`packages/stories/src/generated/theSeventhMirror/image-assets.json` remains the inventory source of truth. The production release plan is only a classification of that inventory.

Create `packages/stories/release-plans/the_seventh_mirror.json` with:

- `schemaVersion: 1`
- `storyId: "the_seventh_mirror"`
- `channel: "production"`
- exactly one entry for every generated background and portrait identity

Every entry is one of:

- **included** — source artwork exists and should ship; `sourcePath` exactly matches the compiler-generated path.
- **omitted** — fallback is intentional; the entry carries one concise reason and no `sourcePath`.

A one-off local scaffold may classify current file existence and then be manually reviewed. It is not committed as a generic generator.

### Structural CI coverage after cleanup

After the migration, most included production sources intentionally no longer exist in the checkout. CI therefore must not require every included source file to remain under `packages/assets/media`.

A focused stories-package test instead:

- parses the checked-in release plan through the existing HPA-227 schema;
- reads the compiler-generated `image-assets.json`;
- compares the complete type-qualified identity sets;
- requires every included entry's `sourcePath` to equal the generated path;
- requires the production channel and story ID.

Actual source existence, decoding, dimensions, encoding, and runtime-manifest coverage remain publisher-time checks after a private archive is restored.

## Private Source Archive

### Purpose

After cleanup, the private source bucket becomes the durable authoring source. The archive must reconstruct the publisher source root and preserve the logical-key/source mapping without introducing a database or synchronization service.

### Base archive layout

Use one immutable prefix:

`authoring/the_seventh_mirror/<UTC-date>-<12-char-git-sha>/`

containing:

- `media/the_seventh_mirror/**` — original image source tree
- `metadata/image-assets.json` — generated authoring inventory and generation metadata
- `metadata/release-plan.json` — production classification used for the migration
- `SHA256SUMS` — checksums for archived files

Upload with a manual S3-compatible sync using an operator-only credential scoped to `aquila-vn-source`. Do not expand the HPA-230 delivery publisher to own authoring-source archival.

### Restore contract

Restoring the base archive produces:

`.tmp/hpa-231-restored/media/the_seventh_mirror/**`

The publisher then uses:

`--source-root .tmp/hpa-231-restored/media`

A restore drill verifies `SHA256SUMS` and runs the existing production `assets plan`. The restored base archive must reproduce the same release ID and manifest checksum as the original source tree for the same plan and encoder version.

## Immutable Candidate and Preview Qualification

Before any source cleanup:

1. `assets plan --environment production` proves complete classification and source/encoding validity.
2. `assets publish --environment production --destination r2 --no-activate --json` creates or reuses immutable production objects and manifest while leaving production `current.json` unchanged.
3. The retained JSON report is the only source for `releaseId` and `manifestSha256`.
4. `assets verify --deep` validates the stored production candidate.
5. The existing **Visual Novel Release Gate** deep-verifies the production candidate read-only, mirrors its exact manifest into an isolated preview namespace, activates only the preview pointer, verifies the public CDN, and runs the deployed desktop/mobile reader spec.

HPA-231 does not add a second release gate.

## Manual Visual Review

After the automated preview gate passes, perform one concise manual pass over representative early, middle, and late scenes.

The review covers:

- a background transition;
- a portrait/expression transition;
- an intentionally omitted/missing fallback;
- one choice path where available;
- desktop presentation;
- mobile presentation;
- exact active-line preservation across text/visual switching.

Record the result as a short HPA-231 Linear comment. Screenshots are optional. No review schema is added.

## Production Activation and Smoke

After preview and manual review pass, activate the retained candidate through the existing production-confirmed publisher command.

Activation changes only:

`vn/stories/the_seventh_mirror/current.json`

It does not re-encode and does not depend on source files.

Then run the existing production public verifier and deployed release-gate browser spec against `https://aquila.cwchanap.dev` with no preview ID. Production is considered live only when the active pointer resolves to the expected release ID/checksum and desktop/mobile progression plus text/visual continuity pass.

## Rollback and Activation-Back Proof

HPA-231 finishes with two verified full-story production releases so rollback changes only the production pointer.

### Preferred path: reuse a previous full-story release

If a previous deep-verified production release exists and its runtime manifest corresponds to the checked-in full-story production plan:

1. Keep the newly qualified release active.
2. Roll back to the previous release using `assets rollback`.
3. Verify the active CDN and deployed reader against the rollback target.
4. Activate the previously-current new release again using normal `assets activate`.
5. Verify the active CDN and deployed reader again.

`--reactivate` is intentionally not used here: after rollback the requested release is no longer active, so normal activation is the correct operation.

### First-release path: create one controlled second release

If no previous valid full-story release exists:

1. Copy the same source root to a temporary directory.
2. Make one deterministic, visually tiny revision to `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png` while preserving dimensions and logical identity.
3. Publish the second candidate with the same production plan and `--no-activate`.
4. Deep-verify it and run the existing preview gate plus a quick visual check of the revised scene.
5. Archive the revised source as a small immutable delta prefix that records the base archive ID.
6. Activate the second release and run the production smoke.
7. Roll back to the first verified release and verify it.
8. Activate the second release again with normal `assets activate` and verify it again.

The delta archive contains only the revised source, its checksum, the release plan, and the base archive ID. Reproducing the second release means restoring the base archive and overlaying the delta.

No generic revision manager is introduced.

## Repository Cleanup

Cleanup is forbidden until production smoke and rollback/activation-back proof have succeeded.

### Authoring media

Remove production-sized The Seventh Mirror binaries from:

`packages/assets/media/the_seventh_mirror/`

Retain only the four source paths already consumed by `apps/web/scripts/build-visual-fixtures.ts`, replacing their large originals with small PNG fixture inputs at the same paths.

Keeping the paths avoids a new fixture-source mapping layer.

### Local runtime fixture

Run the existing fixture builder after downsizing the sources. Commit the regenerated HPA-228 preview pointer, runtime manifest, and referenced content-addressed objects. Remove stale unreferenced local VN objects.

The local fixture remains a developer/test artifact, not a production delivery path.

## CI Footprint Guard

Add one narrow script under `apps/web/scripts/` and wire it into the existing Build & Lint workflow.

It inspects only:

- `packages/assets/media/the_seventh_mirror/`
- `apps/web/public/assets/vn/`

It enforces:

1. exactly the four approved source fixture paths exist;
2. each retained fixture and their combined byte size stay below explicit small limits;
3. the committed local VN tree contains only the HPA-228 active pointer, its referenced manifest, and object files referenced by that manifest;
4. stale or extra production-style binaries fail CI.

The guard is intentionally The-Seventh-Mirror-specific. It is not a generalized repository binary policy.

## Failure Handling

- Release-plan coverage/source mismatch: fix HPA-231 classification or archive mapping.
- Encoder/manifest defect: fix the smallest concrete HPA-230 defect only if the existing publisher is wrong.
- Public CDN defect: fix the smallest concrete HPA-229 configuration defect.
- Reader defect: fix the smallest concrete HPA-228/HPA-234 defect.
- Preview workflow defect: fix the smallest concrete HPA-233 defect.

Before production activation, failures leave only immutable candidate data and require no rollback. After activation, recovery uses existing pointer-only operations. HPA-231 never deletes R2 runtime objects as compensation.

## Testing Strategy

### Credential-free PR checks

- production release-plan structural test;
- existing visual fixture verification;
- new asset-footprint guard tests;
- existing stories/web/infra unit tests;
- compile check, lint, and build.

### Live migration checks

- source archive upload, restore, and checksum verification;
- production `assets plan` from original and restored source roots;
- immutable production candidate publish with `--no-activate`;
- deep candidate verification;
- HPA-233 preview gate;
- manual desktop/mobile visual review;
- production activation;
- active public verifier and deployed reader spec;
- pointer-only rollback and activation back with verification after each pointer move.

## Expected Checked-In Implementation Scope

- `packages/stories/release-plans/the_seventh_mirror.json`
- one focused stories release-plan test
- `docs/infrastructure/the-seventh-mirror-r2-migration.md`
- four downsized existing source fixtures
- deletion of all other The Seventh Mirror source binaries
- regenerated existing `apps/web/public/assets/vn/**` fixture release
- `apps/web/scripts/assert-visual-asset-footprint.ts` plus focused test
- `apps/web/package.json` script
- one Build & Lint workflow step

No reader or publisher file should change unless the migration discovers a concrete blocking defect.

## Alternatives Rejected

### Generic source synchronization service

Rejected. One archive plus one restore procedure is sufficient and much cheaper to maintain.

### Extend the publisher to manage private authoring sources

Rejected. It expands the delivery publisher's trust/failure boundary for a one-time migration.

### Keep all originals in Git after switching runtime delivery to R2

Rejected. It leaves the repository/Vercel binary problem unsolved.

### Move fixtures to a new source tree

Rejected. Four small files at existing paths keep current tooling unchanged.

### Repository-wide binary limits

Rejected. Other Aquila content may legitimately contain binaries; HPA-231 only needs to prevent this production asset set from returning.

## Acceptance Mapping

HPA-231 is complete when:

- every compiler-generated visual identity is included or omitted in the checked-in production plan;
- every included asset publishes into a valid prompt-free immutable runtime manifest;
- omitted identities are absent from runtime data and reader progression continues through fallback;
- the exact candidate passes HPA-233 preview CDN/browser qualification;
- representative early/middle/late desktop/mobile manual review passes;
- production activates without a Vercel rebuild and reports the expected release identity;
- text/visual switching preserves the exact active line;
- two verified full-story releases demonstrate pointer-only production rollback and activation back;
- original sources and generation metadata are privately archived and restorable;
- production-sized The Seventh Mirror binaries are removed from canonical Git/Vercel paths;
- tiny local fixtures continue to support tests and local UI work;
- the focused footprint guard prevents accidental reintroduction;
- release IDs/checksums and final smoke/rollback results are recorded on HPA-231;
- HPA-231 can move to Done and parent HPA-216 can then be closed.
