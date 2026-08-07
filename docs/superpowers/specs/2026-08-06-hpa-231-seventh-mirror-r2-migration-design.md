# HPA-231 The Seventh Mirror R2 Migration Design

## Status

Design for HPA-231: migrate **The Seventh Mirror** from repository/Vercel-hosted visual binaries to the existing Aquila R2 visual-asset delivery path.

This is deliberately a one-story migration and release checklist. It does not redesign the runtime contract, reader, publisher, R2 infrastructure, release gate, or reader session model.

## Goal

Ship one production R2-backed release of `the_seventh_mirror`, prove the existing preview/production/rollback path with real assets, archive the current authoring snapshot privately, and then remove production-sized story binaries from the current Git/Vercel delivery path while preserving small local fixtures.

## Existing Ownership

HPA-231 reuses completed foundations:

- HPA-227 owns runtime manifests, active pointers, type-qualified logical keys, release plans, validation, and cache policy.
- HPA-228 owns the visual reader and local fixture fallback behavior.
- HPA-229 owns the private `aquila-vn-source` bucket, public `aquila-vn-delivery` bucket, custom delivery domain, CORS/cache rules, and the documented Vercel `PUBLIC_ASSET_*` contract.
- HPA-230 owns authoring-catalog reduction, release-plan loading/coverage validation, deterministic encoding, immutable publication, candidate verification, activation, release listing, and rollback.
- HPA-233 owns the manually triggered preview release gate and deployed desktop/mobile browser checks.
- HPA-234 owns canonical reader position and text/visual mode continuity.

If execution exposes a defect in one of those modules, fix only the smallest concrete defect in the owning module. HPA-231 is not an architecture-cleanup ticket.

## Current State

The compiler inventory already exists at:

`packages/stories/src/generated/theSeventhMirror/image-assets.json`

Its source paths point under:

`packages/assets/media/the_seventh_mirror/`

The generated inventory is materially larger than the currently checked-in source-art set. The latest review measured 356 generated identities and 38 source files matching generated paths; Task 1 re-measures the implementation branch before publication rather than treating those review-time counts as permanent constants.

The HPA-231 production plan does not yet exist:

`packages/stories/release-plans/the_seventh_mirror.json`

The HPA-228 local fixture builder currently consumes exactly four PNG source paths and targets these output dimensions:

- `backgrounds/chapter_1/ch1_act2_s0.png` → 960×540
- `backgrounds/chapter_1/ch1_act2_s1.png` → 960×540
- `characters/asakura_mio/base.png` → 450×600
- `characters/asakura_yuma/base.png` → 450×600

The production reader also has a required one-time configuration step: if all `PUBLIC_ASSET_*` variables are absent, it intentionally resolves The Seventh Mirror to the bundled `hpa-228-local` fixture. Production must therefore be wired to the remote R2 source before production pointer activation is meaningful.

## Design Decisions

HPA-231 uses the smallest path that closes the migration:

1. Create one explicit v1 production release plan from the compiler inventory.
2. Reuse HPA-230's authoring-catalog and coverage validators in one focused publisher test; do not duplicate release-plan comparison logic or freeze a literal included count.
3. Review both directions of the source mapping: generated identities missing source files, and source files on disk that no generated identity references.
4. Archive the current source/metadata snapshot once into private R2 and prove it restores to the same release ID/checksum.
5. Publish one immutable primary candidate with `--no-activate`, deep-verify it, and run the existing HPA-233 gate plus a short manual review.
6. Configure production Vercel once for the R2 production source, redeploy once for that build-time configuration, and prove the browser requests the remote production pointer.
7. Activate the primary release and run the existing production public verifier and deployed reader smoke.
8. Because no HPA-231 production plan existed before this migration, use one controlled synthetic one-image release for the rollback exercise instead of maintaining speculative previous-release selection machinery.
9. After rollback proof, restore the intended primary release as the final production pointer.
10. Only then remove production-sized source binaries from repository HEAD, retain four PNG fixtures at the builder's existing target dimensions, regenerate the local fixture release, and extend the existing fixture verifier with narrow footprint checks.
11. Wire that existing verifier into CI.
12. Record the migration facts in plain Markdown and Linear; do not add an evidence schema.

No new runtime service, storage abstraction, publisher command, source-sync service, generic migration framework, or separate footprint-verifier script is introduced.

## V1 Production Inclusion Policy

`image-assets.json` remains the inventory source of truth. The production plan is only an explicit classification of that inventory.

Every generated identity has exactly one entry:

- **included** — its compiler-generated `sourcePath` exists at archive time and the operator does not deliberately exclude it.
- **omitted** — its source does not exist for HPA-231 v1, using the shared reason `Authoring art not produced for HPA-231 v1`, or an existing source is deliberately excluded with a specific reason.

Missing artwork is allowed. Producing it is an HPA-231 non-goal.

The initial plan may be scaffolded by one operator command in the implementation plan. That command is intentionally not promoted to a permanent `sync-release-plan` tool. Production inclusion is a release decision: a newly appearing image must not silently become shippable merely because a synchronization script saw a file. Future art work can amend the committed release plan explicitly in the feature that introduces that art.

### Structural validation

The production-plan test belongs with the existing HPA-230 publisher helpers. It:

- calls `discoverAuthoringCatalog()`;
- loads the default production plan with `resolveReleasePlanPath()` / `loadReleasePlan()`;
- builds `availableSourcePaths` from the plan's own included paths so CI does not require production originals to remain in Git;
- calls `validatePublisherCoverage()` with a production target;
- asserts `included > 0`.

The existing validators then own duplicate identities, unknown plan identities, missing production classifications, story/channel validity, and included `sourcePath` equality. This keeps contract logic in one place and remains valid after cleanup.

### Reverse inventory review

Before publication, the migration also walks `packages/assets/media/the_seventh_mirror/**` and subtracts all compiler-generated source paths. Any remaining image file is recorded as unreferenced source art and reviewed as compiler drift, renamed/unused artwork, or intentionally unreferenced material. It must not be silently lost during cleanup.

Non-art filesystem junk such as `.DS_Store` is removed rather than archived as authoring content.

## Private Source Archive

The private source archive is the **HPA-231 v1 migration snapshot**, not a claim that every generated story key has artwork.

Use one immutable prefix:

`authoring/the_seventh_mirror/<UTC-date>-<12-char-git-sha>/`

containing:

- `media/the_seventh_mirror/**` — current authoring images after removing filesystem junk;
- `metadata/image-assets.json` — generated inventory/generation metadata;
- `metadata/release-plan.json` — the v1 production plan;
- `SHA256SUMS` — checksums for the archive.

The upload remains a manual S3-compatible `aws s3 sync` with an operator-only credential scoped to `aquila-vn-source`. HPA-230's delivery publisher does not gain authoring-source responsibilities.

A restore drill downloads the prefix to an empty directory, verifies `SHA256SUMS`, then runs the existing production `assets plan` with the restored `media/` directory as `--source-root`. The restored plan must produce the same `releaseId` and `manifestSha256` as the original snapshot.

Future newly produced art gets a new immutable archive prefix (or an explicitly documented overlay) plus a deliberate release-plan amendment. No automatic source synchronization is added.

## Execution State Rule

The implementation plan is designed for task/subagent execution. Shell variables are therefore never treated as durable state across steps.

Durable local handoff uses existing files only:

- archive ID → `.tmp/hpa-231-archive-id`;
- primary identifiers → `.tmp/hpa-231-publish.json`;
- synthetic identifiers → `.tmp/hpa-231-synthetic-publish.json`;
- other command results → their retained `.tmp/*.json` reports.

Every command block re-derives the identifiers it needs from those files. A later task must work correctly in a fresh shell.

## Primary Candidate Qualification

Before source cleanup:

1. Run the existing production `assets plan` against the original source tree.
2. Publish with `assets publish --environment production --destination r2 --no-activate --json`.
3. Derive `releaseId` and `manifestSha256` only from the retained publish report.
4. Deep-verify the stored candidate.
5. Run the existing HPA-233 preview gate for that exact candidate.
6. Perform one concise manual review covering included visuals and at least one explicit fallback.

No second release gate is introduced.

## One-Time Production Reader Wiring

Before production pointer activation, configure Vercel **Production** exactly as documented by HPA-229:

- `PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/`
- `PUBLIC_ASSET_ENVIRONMENT=production`
- `PUBLIC_ASSET_PREVIEW_ID` unset

Because Astro/Vite inlines public build configuration, this requires one production redeploy. This is a one-time application-configuration deployment, not a per-asset-release deployment.

Before activation, browser Network inspection must show a request to:

`https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json`

and no request to the same-origin `hpa-228-local` pointer. A 404 from the remote pointer is acceptable before first activation; the checkpoint proves routing.

After this one-time wiring, asset pointer changes require no Vercel rebuild.

## Production Activation and Smoke

Activate the retained primary candidate through the existing production-confirmed publisher command. Activation changes only production `current.json` and does not re-encode or read source files.

Then run:

- the existing public production verifier against the expected manifest checksum;
- the existing deployed release-gate browser spec against the expected release ID/checksum.

This is the full browser qualification of the intended primary production release.

## Rollback Proof

At design time there is no compatible previous HPA-231 production release because the production plan itself is introduced by this migration. Official HPA-230/HPA-233 runbooks explicitly treated that plan as a prerequisite. The plan therefore chooses the controlled synthetic-peer path directly instead of carrying an untested previous-release selector.

Task 5 still runs `assets releases --deep --json` once for operator visibility, but it does not branch on that output.

The rollback proof is:

1. Copy the v1 source snapshot to a temporary source root.
2. Apply a deterministic tiny brightness change to the included `chapter_1/ch1_act2_s1` background without changing dimensions or logical identity.
3. Publish the synthetic candidate with the same production plan and `--no-activate`.
4. Deep-verify it and manually inspect the revised scene.
5. Temporarily activate it and verify the public production pointer/manifest chain.
6. Roll back to the fully qualified primary release and verify the public chain.
7. Activate the synthetic peer again to prove activation-back semantics and verify the public chain.
8. Activate the primary release one final time and verify it so the intended content remains production-active.

The synthetic peer does not receive a second HPA-233 gate or repeated full Playwright suites. The primary already passed the gate and the synthetic release exists only to prove pointer operations. Full browser smoke is rerun on the primary at final verification.

`--reactivate` is not used after rollback; the requested target is inactive at that point, so normal `assets activate` is correct.

## Repository Cleanup and Fixture Dimensions

Cleanup is forbidden until production routing, primary smoke, rollback/activation-back proof, and final primary restoration all pass.

Remove production-sized files from current repository HEAD under:

`packages/assets/media/the_seventh_mirror/`

Retain the same four PNG paths used by `build-visual-fixtures.ts`. To avoid silently degrading local/test fixture resolution, resize them to the builder's existing targets rather than to smaller dimensions:

- backgrounds: at most 960×540;
- portraits: at most 450×600.

Keep PNG to avoid path/manifest/compiler churn. Use explicit footprint caps with headroom over the currently measured resized files:

- each retained source fixture: ≤ 768 KiB;
- all four retained source fixtures combined: ≤ 3 MiB.

This remains dramatically smaller than the production source set while preserving the existing fixture contract.

After downsizing, run the existing fixture builder and verifier and remove every other The Seventh Mirror source file from HEAD.

## Extend the Existing Fixture Verifier

Do not create `assert-visual-asset-footprint.ts`.

Extend `apps/web/scripts/verify-visual-fixtures.ts`, because it already owns the HPA-228 source-plan/pointer/manifest/object integrity check. Add the missing reverse/footprint assertions there:

- exactly the four approved source fixture paths remain under `packages/assets/media/the_seventh_mirror/`;
- each and combined source sizes remain under the caps above;
- under the story-local `vn/previews/hpa-228-local/stories/the_seventh_mirror/` directory, only the active pointer and its referenced manifest remain.

Continue validating referenced shared `vn/objects/**` through the existing hash/length/dimension checks. Do **not** make CI reject every unreferenced shared object globally; those content-addressed objects may later be shared by other local fixtures and a generic object-GC policy is outside HPA-231.

Extend the existing `verify-visual-fixtures` tests rather than creating a second test file, then add one Build & Lint CI step running the already-existing `bun --filter web verify:visual-fixtures` script.

## Git History Boundary

HPA-231 removes production-sized binaries from **current repository HEAD and canonical delivery/build paths**. It does not rewrite Git history.

Historical blobs remain reachable in existing commits, so this task does not claim to reduce full-history clone size. A history rewrite would be disruptive, unrelated to runtime delivery, and is explicitly out of scope for this hobby project migration.

## Failure Handling

- Release-plan mismatch: fix the HPA-231 classification.
- Missing source expected to ship: restore/correct the source or explicitly omit it under the v1 policy.
- Unreferenced on-disk art: record and resolve the compiler/content drift before cleanup; do not invent a release-plan identity.
- Encoder/manifest defect: fix the smallest concrete HPA-230 defect only if the existing publisher is wrong.
- Public CDN defect: fix the smallest concrete HPA-229 defect.
- Reader-source routing defect: fix the smallest concrete HPA-228/HPA-229 defect.
- Preview workflow defect: fix the smallest concrete HPA-233 defect.

Before production activation, failures leave only immutable candidate data and need no rollback. After activation, recovery uses the existing pointer commands. HPA-231 never deletes R2 runtime objects as compensation.

## Expected Checked-In Implementation Scope

- `packages/stories/release-plans/the_seventh_mirror.json`
- one focused HPA-230 publisher coverage test
- `docs/infrastructure/the-seventh-mirror-r2-migration.md`
- four resized existing PNG fixture sources
- deletion of all other The Seventh Mirror source binaries from HEAD
- regenerated HPA-228 local fixture release
- extensions to `apps/web/scripts/verify-visual-fixtures.ts` and its existing test
- one Build & Lint workflow step

No new release-plan sync script, footprint script, reader module, publisher command, schema, storage abstraction, or history rewrite is expected.

## Acceptance Mapping

HPA-231 is complete when:

- every compiler-generated visual identity is explicitly included or omitted;
- HPA-230 coverage validation proves the committed plan matches the generated catalog without requiring production sources in CI;
- branch-measured include/omit counts and unreferenced on-disk art are reviewed and recorded;
- every included asset publishes into a valid prompt-free immutable runtime manifest;
- omitted identities fall back without blocking progression;
- the v1 source/metadata snapshot is privately archived, checksummed, and restorable to the same release identity;
- the exact primary candidate passes HPA-233 and concise manual review;
- production Vercel is explicitly wired to the R2 production source and remote-pointer routing is confirmed;
- after that one-time deployment, pointer activation needs no Vercel rebuild;
- production public and browser smoke report the expected primary release identity;
- one synthetic peer demonstrates pointer-only rollback and activation-back using existing publisher commands;
- the primary release is restored as final production state;
- production-sized The Seventh Mirror binaries are removed from current repository HEAD/canonical delivery paths;
- the four retained fixtures preserve existing builder target dimensions and remain within the small footprint caps;
- the existing visual-fixture verifier enforces source footprint plus fixture integrity in CI;
- Git history retention is documented explicitly;
- archive ID, counts, environment confirmation, release IDs/checksums, and final smoke/rollback results are summarized on HPA-231;
- HPA-231 can move to Done and parent HPA-216 can then be closed.
