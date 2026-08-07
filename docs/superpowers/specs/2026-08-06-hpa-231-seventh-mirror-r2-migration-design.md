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
- HPA-229 owns the private `aquila-vn-source` bucket, public `aquila-vn-delivery` bucket, custom delivery domain, CORS, cache rules, and the documented Vercel `PUBLIC_ASSET_*` contract.
- HPA-230 owns deterministic encoding, immutable content-addressed publication, candidate verification, activation, release listing, preview mirroring, and rollback.
- HPA-233 owns the manually triggered preview release gate and deployed desktop/mobile browser checks.
- HPA-234 owns canonical reader position and text/visual mode continuity.

If execution finds a defect in one of those modules, fix only the smallest concrete defect in the owning module. Do not use HPA-231 as an architecture cleanup project.

## Current State

The compiler already emits the authoritative authoring inventory at:

`packages/stories/src/generated/theSeventhMirror/image-assets.json`

Its logical source paths point under:

`packages/assets/media/the_seventh_mirror/`

The generated inventory is larger than the currently checked-in source-art set. HPA-231 therefore must treat missing source artwork as an explicit release decision rather than silently interpreting a successful scaffold as a fully illustrated story.

The intended HPA-231-owned production plan is currently absent:

`packages/stories/release-plans/the_seventh_mirror.json`

The HPA-228 local fixture builder currently depends on exactly four source paths:

- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
- `the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png`
- `the_seventh_mirror/characters/asakura_mio/base.png`
- `the_seventh_mirror/characters/asakura_yuma/base.png`

Those four paths remain after cleanup, but their binaries become intentionally tiny fixture-only inputs.

The web reader has another important precondition: with all `PUBLIC_ASSET_*` variables absent it intentionally resolves The Seventh Mirror to the bundled `hpa-228-local` fixture. Production must therefore be wired to the remote R2 source before production pointer activation is meaningful.

## Design Decision

HPA-231 is a thin migration over existing contracts:

1. Define the v1 production ship set explicitly from the source files that exist at archive time, minus any deliberately omitted existing artwork.
2. Add one complete checked-in production release plan for every compiler-generated identity.
3. Add one structural test proving identity completeness, exact included source paths, and the reviewed included-count floor without requiring production source files to remain in Git.
4. Archive the current authoring source tree and generation metadata once into the private R2 source bucket using a manual S3-compatible procedure.
5. Publish and deeply verify an immutable production candidate without activation.
6. Qualify that exact primary candidate through the existing HPA-233 preview gate plus a short manual visual review.
7. Configure the production Vercel reader once to use `assets.aquila.cwchanap.dev` with `PUBLIC_ASSET_ENVIRONMENT=production`, redeploy once for that configuration change, and prove the browser is requesting the remote production pointer rather than the bundled local fixture.
8. Activate production using the existing explicit publisher command and run the existing active production public/browser smoke checks.
9. Prove production pointer-only rollback and activation back to the previously-current release using a machine-validated previous full-plan release when one exists; otherwise create one controlled synthetic peer release for the rollback exercise.
10. Only after production and rollback proof pass, remove production-sized The Seventh Mirror binaries from Git/Vercel, retain four tiny fixture inputs, regenerate the local fixture release, and add one narrow CI footprint guard.
11. Record archive identity, include/omit counts, production environment confirmation, release IDs/checksums, preview/manual/production results, and rollback results on HPA-231.

No new runtime service, storage abstraction, publisher command, source synchronization system, or release evidence framework is introduced.

## V1 Production Inclusion Policy

### Canonical inventory

`packages/stories/src/generated/theSeventhMirror/image-assets.json` remains the inventory source of truth. The production release plan is only a classification of that inventory.

Create `packages/stories/release-plans/the_seventh_mirror.json` with:

- `schemaVersion: 1`
- `storyId: "the_seventh_mirror"`
- `channel: "production"`
- exactly one entry for every generated background and portrait identity

### Inclusion rule

The migration has one explicit default:

- **included** — the compiler-generated `sourcePath` exists under `packages/assets/media` at archive time and the operator has not deliberately excluded it.
- **omitted** — the source does not exist for the v1 migration, using the reviewed reason `Authoring art not produced for HPA-231 v1`, or an existing source is deliberately excluded with a specific reason.

This policy intentionally allows a production release with fallbacks. HPA-231 does not block on producing missing artwork, because completing missing art is a ticket non-goal.

The scaffold may use file existence to create the initial entries, but the operator must review the resulting included/omitted counts and every exceptional omission of an existing file before commit. The reviewed included count is then frozen as a literal assertion in the structural test so an accidental all-omitted or heavily reduced plan cannot pass silently later.

No exact included count is encoded in this design document; Task 1 measures it from the branch at migration time and freezes that measured, reviewed value in code and the runbook.

### Structural CI coverage after cleanup

After the migration, most included production sources intentionally no longer exist in the checkout. CI therefore must not call source-existence coverage validation for the production plan.

A focused stories-package test instead:

- parses the checked-in release plan through the existing HPA-227 schema;
- reads the compiler-generated `image-assets.json`;
- compares the complete type-qualified identity sets;
- requires every included entry's `sourcePath` to equal the generated path;
- requires the production channel and story ID;
- asserts the reviewed literal included count captured during migration.

Actual source existence, decoding, dimensions, encoding, and runtime-manifest coverage remain publisher-time checks after a private archive is restored.

## Private Source Archive

### Purpose

After cleanup, the private source bucket becomes the durable source for the **migration snapshot**. It preserves exactly the authoring material that existed for HPA-231 v1; it is not a claim that every generated story key already has artwork.

The archive must reconstruct the publisher source root and preserve the logical-key/source mapping without introducing a database or synchronization service.

### Base archive layout

Use one immutable prefix:

`authoring/the_seventh_mirror/<UTC-date>-<12-char-git-sha>/`

containing:

- `media/the_seventh_mirror/**` — original image source tree present at migration time
- `metadata/image-assets.json` — generated authoring inventory and generation metadata
- `metadata/release-plan.json` — production classification used for the migration
- `SHA256SUMS` — checksums for archived files

Upload with a manual S3-compatible sync using an operator-only credential scoped to `aquila-vn-source`. Do not expand the HPA-230 delivery publisher to own authoring-source archival.

### Restore contract

Restoring the base archive produces:

`.tmp/hpa-231-restored/media/the_seventh_mirror/**`

The publisher then uses:

`--source-root .tmp/hpa-231-restored/media`

A restore drill verifies `SHA256SUMS` and runs the existing production `assets plan`. The restored archive must reproduce the same release ID and manifest checksum as the original source tree for the same plan and encoder version.

Future artwork that did not exist in the v1 snapshot is handled by a new immutable archive prefix (or a deliberately documented overlay) plus a release-plan amendment. HPA-231 does not build automatic synchronization for future art.

## Immutable Candidate and Preview Qualification

Before any source cleanup:

1. `assets plan --environment production` proves complete classification and source/encoding validity for every included entry.
2. `assets publish --environment production --destination r2 --no-activate --json` creates or reuses immutable production objects and manifest while leaving production `current.json` unchanged.
3. The retained JSON report is the only source for `releaseId` and `manifestSha256`.
4. `assets verify --deep` validates the stored production candidate.
5. The existing **Visual Novel Release Gate** deep-verifies the production candidate read-only, mirrors its exact manifest into an isolated preview namespace, activates only the preview pointer, verifies the public CDN, and runs the deployed desktop/mobile reader spec.

HPA-231 does not add a second release gate.

## Manual Visual Review

After the automated primary preview gate passes, perform one concise manual pass through representative early, middle, and late story positions.

The review covers:

- at least one included background transition;
- at least one included portrait/expression transition when such assets exist in the v1 ship set;
- at least one intentional omitted/missing fallback;
- one choice path where available;
- desktop presentation;
- mobile presentation;
- exact active-line preservation across text/visual switching.

The review is scoped to the v1 included set plus explicit fallback behavior. If a middle or late story position has no included background, the reviewer records the expected fallback there rather than treating absent artwork as a migration failure.

Record the result as a short HPA-231 Linear comment. Screenshots are optional. No review schema is added.

## One-Time Production Reader Wiring

Before production pointer activation, configure the Vercel **Production** environment exactly as already documented by HPA-229:

- `PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/`
- `PUBLIC_ASSET_ENVIRONMENT=production`
- `PUBLIC_ASSET_PREVIEW_ID` unset

Because Astro/Vite inlines the public configuration into the deployment, changing these variables requires one production redeploy. This is a one-time migration prerequisite, not a per-release step.

Before activation, open The Seventh Mirror visual mode on that redeploy and confirm in browser network inspection that the reader requests:

`https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json`

and does **not** request the same-origin local fixture path under:

`/assets/vn/previews/hpa-228-local/`

A missing production pointer may still return 404 before first activation; the preflight is proving routing, not release availability.

The HPA-231 acceptance phrase “activate without a Vercel rebuild” means that, once this one-time production source wiring is deployed, subsequent asset pointer activation does not require rebuilding the app.

## Production Activation and Smoke

After preview, manual review, and production-source preflight pass, activate the retained primary candidate through the existing production-confirmed publisher command.

Activation changes only:

`vn/stories/the_seventh_mirror/current.json`

It does not re-encode and does not depend on source files.

Then run the existing production public verifier and deployed release-gate browser spec against `https://aquila.cwchanap.dev` with no preview ID. Production is considered live only when the active pointer resolves to the expected release ID/checksum and desktop/mobile progression plus text/visual continuity pass.

## Rollback Peer Selection

A release is eligible as a rollback peer only when all of these are true:

- it appears in `assets releases --environment production --deep --json` with `deepVerified: true`;
- its public immutable manifest bytes match the listed `manifestSha256`;
- its manifest parses through HPA-227;
- `validateRuntimeManifestCoverage(manifest, productionPlan)` passes against the checked-in HPA-231 plan;
- it is not the currently active primary release.

Task 5 implements this as a one-off Bun command over the existing release-list JSON and public immutable manifests. No publisher command or release manager is added.

This definition resolves “full-story release” for HPA-231: it means **the same production release plan / included set**, not “all generated chapters have artwork.”

## Rollback and Activation-Back Proof

### Preferred path: reuse a previous eligible release

If the machine check finds an eligible previous release:

1. Keep the fully qualified primary release active.
2. Roll back to the eligible previous release using `assets rollback`.
3. Verify the active CDN and deployed reader against the rollback target.
4. Activate the primary release again using normal `assets activate`.
5. Verify the active CDN and deployed reader again.

`--reactivate` is intentionally not used here: after rollback the primary release is no longer active, so normal activation is the correct operation.

### First-release path: create one controlled synthetic peer

If no eligible previous release exists:

1. Copy the archived/original source root to a temporary directory.
2. Make one deterministic, visually tiny revision to one included image while preserving dimensions and logical identity.
3. Publish the synthetic candidate with the same production plan and `--no-activate`.
4. Deep-verify it and manually glance at the revised scene.
5. Activate the synthetic peer temporarily and run the existing production public verifier plus deployed reader release-gate spec against its exact release ID/checksum.
6. Roll back to the fully qualified primary release and verify it.
7. Activate the synthetic peer again to prove activation-back semantics and verify it.
8. Because the synthetic revision exists only for rollback proof, activate the primary release one final time and rerun production smoke so the intended primary release remains the final production pointer.

The synthetic peer does **not** run a second HPA-233 preview gate. The primary release already passed the full preview gate; the peer differs by one controlled image, is deep-verified before activation, and is pinned by public/browser production smoke after each pointer move.

No generic revision manager or synthetic-source archive is introduced. The immutable peer remains in the delivery bucket as rollback-test evidence; future authoring work continues from the archived v1 snapshot, not from the synthetic revision.

## Repository Cleanup

Cleanup is forbidden until production smoke and rollback/activation-back proof have succeeded and the intended primary release is active again.

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

The guard is intentionally The-Seventh-Mirror-specific. It is not a generalized repository binary policy and should not be merged into `verify-visual-fixtures.ts`, which checks a different failure mode: fixture contract/integrity rather than repository footprint.

## Failure Handling

- Release-plan classification mismatch: fix HPA-231 classification.
- Missing source that was expected to ship: either restore/correct the archive path or explicitly omit it under the v1 policy.
- Encoder/manifest defect: fix the smallest concrete HPA-230 defect only if the existing publisher is wrong.
- Public CDN defect: fix the smallest concrete HPA-229 configuration defect.
- Reader-source routing defect: fix the smallest concrete HPA-228/HPA-229 defect.
- Preview workflow defect: fix the smallest concrete HPA-233 defect.

Before production activation, failures leave only immutable candidate data and require no rollback. After activation, recovery uses existing pointer-only operations. HPA-231 never deletes R2 runtime objects as compensation.

## Testing Strategy

### Credential-free PR checks

- production release-plan structural test, including reviewed included count;
- existing visual fixture verification;
- new asset-footprint guard tests;
- existing stories/web/infra unit tests;
- compile check, lint, and build.

### Live migration checks

- branch-measured include/omit counts and explicit omission review;
- source archive upload, restore, and checksum verification;
- production `assets plan` from original and restored source roots;
- immutable production candidate publish with `--no-activate`;
- deep candidate verification;
- HPA-233 primary preview gate;
- manual desktop/mobile visual review across included assets and fallbacks;
- one-time production reader env deployment and remote-pointer network preflight;
- production activation;
- active public verifier and deployed reader spec;
- machine-validated rollback peer selection;
- pointer-only rollback and activation back with verification after each pointer move;
- final confirmation that the intended primary release is active before repository cleanup.

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

### Require missing artwork before migration

Rejected. Missing artwork is an explicit fallback decision for HPA-231 v1; creating missing art is a non-goal.

### Add a second preview gate for a synthetic rollback peer

Rejected. Deep verification plus exact production public/browser smoke is sufficient for a one-image operational peer that is not the intended final release.

## Acceptance Mapping

HPA-231 is complete when:

- every compiler-generated visual identity is included or omitted in the checked-in production plan;
- the v1 inclusion policy and branch-measured, reviewed include/omit counts are recorded;
- every included asset publishes into a valid prompt-free immutable runtime manifest;
- omitted identities are absent from runtime data and reader progression continues through fallback;
- the exact primary candidate passes HPA-233 preview CDN/browser qualification;
- representative early/middle/late desktop/mobile review covers included visuals and explicit fallback behavior;
- the production Vercel reader is explicitly configured for the R2 production source and remote-pointer routing is confirmed;
- after that one-time wiring, production pointer activation needs no Vercel rebuild and reports the expected release identity;
- text/visual switching preserves the exact active line;
- a machine-validated peer (or one controlled synthetic peer) demonstrates pointer-only production rollback and activation back;
- the intended primary release is restored as final production state before cleanup;
- original v1 sources and generation metadata are privately archived and restorable, with the archive explicitly documented as a migration snapshot rather than a complete art set;
- production-sized The Seventh Mirror binaries are removed from canonical Git/Vercel paths;
- tiny local fixtures continue to support tests and local UI work;
- the focused footprint guard prevents accidental reintroduction;
- archive ID, include/omit counts, environment confirmation, release IDs/checksums, and final smoke/rollback results are recorded on HPA-231;
- HPA-231 can move to Done and parent HPA-216 can then be closed.
