# HPA-607 Seventh Mirror Audio Audit Design

**Issue:** HPA-607 — Audit and author audio cues across The Seventh Mirror  
**Date:** 2026-08-14  
**Status:** Proposed

## Context

HPA-606 established the audio-authoring contract for raw stories:

- Markdown acts own cue placement through `[sfx](key)` and `[bgm](key)` / `[bgm](stop)` fences.
- `docs/audio-plan.json` owns cue identity and generation intent.
- The story compiler validates authored keys after story assembly.
- `audio:report` derives placement counts, unresolved keys, and unused planned cues from compiled story data.
- The web SFX/BGM catalogs may contain only a small playable subset of the story plan.

The Seventh Mirror currently contains 28 chapters and a small HPA-606 bootstrap: three SFX identities, two BGM identities, representative placements, and five local placeholder catalog mappings. HPA-607 turns that bootstrap into the story-wide audio direction without adding a second inventory or generation/publishing machinery.

## Goals

1. Review the full story in narrative order before making story-wide audio decisions.
2. Establish one coherent SFX/BGM palette for all 28 chapters.
3. Author sparse, intentional cue placements into the existing Markdown acts.
4. Keep repeated motifs on stable cue identities suitable for later generation and publishing.
5. Keep `docs/audio-plan.json` complete and schema-valid as the single cue identity/intent registry.
6. Use the existing compiler/report/review seams to detect drift while authoring.

## Non-goals

- Generate audio files or choose provider/runtime metadata.
- Publish assets to Cloudflare R2 or build manifests.
- Build narration stitching.
- Add a second audio inventory, sync utility, generated TypeScript union, or cue database.
- Populate the web catalog for every planned cue.
- Add a new review agent or audio-specific compiler subsystem.

## Approaches considered

### A. Edit chapters in one pass

Read each chapter and immediately add cues.

**Pros:** least up-front work.  
**Cons:** early cue keys and music identities are chosen before later motifs are understood, making palette drift and duplicate identities likely.

### B. Read-only story audit, then author in small batches — chosen

First read canon, plans, and all acts in story order without changing placements. Use that pass to identify recurring emotional states, physical motifs, location signatures, and likely BGM transition boundaries. Then author chapters in small sequential batches while growing the canonical plan only as cues receive real placements.

**Pros:** story-wide coherence without new machinery; changes stay reviewable; compiler/report feedback remains useful after every batch.  
**Cons:** requires one full read before edits begin.

### C. Build an inventory/sync tool first

Create a separate palette file or tooling that generates/merges placements and plan entries.

**Rejected:** HPA-606 already provides the required sources of truth and validation. Extra synchronization machinery would create more drift risk than it removes for a single authored story.

## Decision

Use a two-pass workflow.

### Pass 1: read-only direction audit

Read in this order:

1. `packages/stories/raw/theSeventhMirror/canon/`
2. `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`
3. chapter plan documents under `packages/stories/raw/theSeventhMirror/docs/`
4. every act under `chapter_1/` through `chapter_28/`, in story order

Do not edit acts during this pass. Capture working observations only; do not commit a second inventory file. The output of the pass is a mental/working palette: recurring motifs, music states, likely stops/transitions, and cue identities that should be reused.

### Pass 2: author in seven four-chapter batches

Process chapters 1–4, 5–8, 9–12, 13–16, 17–20, 21–24, and 25–28 in order.

For each batch:

1. Add or adjust `[sfx]` / `[bgm]` placements in the acts.
2. Add a plan entry when a cue identity receives its first real placement.
3. Reuse existing keys for recurring identities instead of minting near-duplicates.
4. Run compile and `audio:report` before moving to the next batch.
5. Check cross-chapter BGM state and recurring motifs at meaningful boundaries.

This keeps the committed `audio-plan.json` close to actual usage rather than front-loading a large speculative palette that appears as unused report noise.

## Ownership and data flow

### Markdown acts: placement truth

Acts answer **where** a sound starts, stops, or fires.

A cue fence should be placed where the reader state changes, not where generation metadata happens to live.

### `docs/audio-plan.json`: identity and intent truth

The plan answers **what** a key represents and what later generation should create.

Keep entries limited to the HPA-606 schema. Do not add local URLs, provider/model fields, output paths, or runtime volume settings.

### Compiler + `audio:report`: derived validation

The report remains the only usage inventory. HPA-607 should react to unresolved keys and unintended unused entries rather than duplicating those facts in another file.

### Web catalogs: representative local playback only

The HPA-606 catalogs currently map five bootstrap keys to placeholder audio. HPA-607 does not expand those catalogs to mirror the final palette.

If an existing bootstrap key remains a valid story identity, keep it. If the audit proves one should be removed or renamed, update the minimal catalog accordingly so every local catalog key remains a member of the story plan. No compatibility layer is needed for bootstrap keys that have no external users.

## Palette rules

### Stable identities

- Use kebab-case keys.
- Name the audible/narrative identity, not a chapter number or one-off implementation detail.
- Reuse a key when the intended generated sound should genuinely be the same asset.
- Split a key when generation intent materially differs, even if both moments belong to the same broad motif.
- Prefer a modest story-level palette over one key per line or scene.

### SFX direction

SFX should emphasize concrete or narratively meaningful beats: recurring objects, physical shocks, environmental signatures, or transitions whose sound carries information.

Avoid micro-foley for ordinary movement, clothing, every door, every breath, or every interface-like beat. Silence is the default.

### BGM direction

BGM is a sustained state, not a per-line decoration.

- Start music when the scene's emotional or structural state meaningfully changes.
- Let a track continue across adjacent beats while its intent remains valid.
- Use `[bgm](stop)` at an explicit narrative endpoint when silence is meaningful or before a new incompatible state.
- Do not restart the same key merely because a new act or dialogue beat begins.
- Review chapter/act boundaries for leaked music state.

## Bootstrap cue treatment

The current bootstrap keys are starting hypotheses, not compatibility commitments:

- `impact`
- `glass-click`
- `reading-room-breath`
- `cold-reflection`
- `threshold-quiet`

Keep them where they remain semantically useful. Rename, merge, or remove them only when the full-story audit demonstrates a clearer stable identity. Any such change must update placements, `audio-plan.json`, and the tiny local catalog subset together.

## Review and validation

After each batch:

- compile The Seventh Mirror;
- run the story audio report;
- fix unresolved keys immediately;
- inspect unused planned keys and remove speculative entries unless intentionally about to be used in the same batch;
- check BGM state at the beginning/end of the batch and any strong internal transition.

During the authoring pass, use the existing `reviewing-written-stories` workflow with an `audio-continuity` checkpoint for representative high-risk transitions rather than reviewing every line through a separate agent. Representative checks should cover at least:

- an early chapter after the bootstrap material;
- a major midpoint transition;
- a late-story transition where recurring motifs converge;
- the ending/final BGM stop state.

Final validation requires the existing story tests and canon checks to remain green.

## Risks and mitigations

### Palette explosion

**Risk:** every memorable beat gets a new key.  
**Mitigation:** require an identity to describe a reusable generated asset or a clearly distinct one-shot intent; prefer reuse.

### Over-cueing

**Risk:** authored audio competes with prose and dialogue.  
**Mitigation:** silence is the default; add only beats whose audio contributes information, rhythm, atmosphere, or motif continuity.

### BGM leakage

**Risk:** a sustained key unintentionally survives a scene/chapter transition.  
**Mitigation:** explicitly inspect state at batch boundaries and use `stop` only at deliberate endpoints.

### Plan/placement drift

**Risk:** a key exists in only one side of the contract.  
**Mitigation:** use the HPA-606 compiler/report after each batch; do not create another inventory.

## Acceptance mapping

HPA-607 is complete when:

- all 28 chapters have been reviewed in story order;
- the acts express one coherent, sparse audio direction;
- repeated motifs use stable identities and BGM uses explicit start/stop semantics;
- `docs/audio-plan.json` contains the complete final identity/intent set and passes schema validation;
- `audio:report` has no unresolved keys and no accidental unused planned cues;
- representative audio-continuity checks find no unresolved state/motif problems;
- story compile, tests, and canon checks pass;
- no second inventory, generator, publisher, or full local placeholder catalog has been introduced.
