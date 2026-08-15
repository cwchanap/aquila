# HPA-607 Seventh Mirror Audio Audit Design

**Issue:** HPA-607 — Audit The Seventh Mirror and author its complete visual-novel audio plan  
**Date:** 2026-08-14  
**Status:** Proposed

## Context

HPA-606 established the audio-authoring contract already present on `main`:

- Markdown acts own cue placement through fenced `sfx` / `bgm` blocks attached to the **next** dialogue entry.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` owns cue identity and generation intent.
- The compiler validates authored cue membership and type after story assembly.
- `audio:report` is the only derived usage inventory: it reports used assets, usage locations, BGM stop locations, and unused planned entries.
- The web SFX/BGM catalogs may contain only a small playable subset of the story plan.

The Seventh Mirror contains 28 chapters and a live HPA-606 bootstrap already used by chapter 1:

- SFX: `door-open`, `notification-beep`, `impact`
- BGM: `dawn-apartment`, `tension-pulse`

The local web catalogs map those same five keys to placeholder WAVs, and `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts` enforces that every local catalog entry remains present in the story plan with the matching type.

HPA-607 expands that bootstrap into the complete story-wide audio direction without adding a second inventory, state analyzer, alias detector, generation pipeline, or publisher.

## Goals

1. Review all 28 chapters in narrative order before locking the full audio direction.
2. Establish one coherent, reusable SFX/BGM palette.
3. Author sparse, intentional cue placements using the existing fenced-block syntax.
4. Keep recurring motifs on stable cue identities suitable for later generation and publishing.
5. Keep `docs/audio-plan.json` complete and schema-valid as the only creative generation plan.
6. Use the existing compiler/report/reviewer seams according to what each one actually validates.
7. Bound downstream generation work before HPA-608 by reporting final identity counts, summed intended duration, and a request/credit formula where calculable.
8. Preserve a story that remains understandable and emotionally coherent with audio muted.

## Non-goals

- Generate audio files or choose provider/model/runtime metadata.
- Publish assets to Cloudflare R2 or build manifests.
- Build narration stitching.
- Add a second palette/inventory file, sync utility, generated TypeScript union, or cue database.
- Add a BGM-state analyzer or alias detector.
- Populate the web catalog for every planned cue.
- Add a new review agent or audio-specific severity model.
- Price a provider contract that HPA-607 does not own.

## Approaches considered

### A. Edit chapters in one pass

Read each chapter and immediately add cues.

**Pros:** least up-front work.  
**Cons:** early identities are chosen before later motifs are understood, so duplicate/alias keys and mood drift are more likely.

### B. Read-only story audit, persist the reconciled direction in Linear, then author in small batches — chosen

First read canon, plans, and all acts in story order without editing. Reconcile a stable working palette plus intentionally silent/deferred areas. Persist that human-readable checkpoint as a comment on HPA-607, not as another repository inventory. Then author seven sequential four-chapter batches while extending `audio-plan.json` only when a cue receives a real placement.

**Pros:** story-wide coherence, restart-safe decisions, no new repo machinery, small reviewable batches.  
**Cons:** requires one full read before edits begin.

### C. Build an inventory/sync tool first

Create another palette file or tooling that generates/merges placements and plan entries.

**Rejected:** HPA-606 already provides the required sources of truth and validation. Extra synchronization machinery would create more drift risk than it removes for one authored story.

## Decision

Use a two-pass workflow with one durable Linear checkpoint between the passes.

### Pass 1: read-only direction audit

Read in this order:

1. `packages/stories/raw/theSeventhMirror/canon/`
2. `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`
3. chapter plan documents under `packages/stories/raw/theSeventhMirror/docs/`
4. every act under `chapter_1/` through `chapter_28/`, in story order

Do not edit acts during this pass. Identify:

- recurring physical/object/location/supernatural motifs;
- candidate reusable SFX identities;
- sustained BGM states and likely transitions;
- intentional silence;
- ideas that should be deferred rather than forced into HPA-607.

After the read, reconcile near-duplicates and post one HPA-607 comment containing:

- the proposed kebab-case identity list with SFX/BGM kind;
- deliberately silent sections or states;
- deferred ideas;
- any bootstrap identity that is likely to be renamed/merged and why.

This comment is a restart-safe working checkpoint. It is **not** a second machine-readable inventory and does not replace `audio-plan.json`.

### Pass 2: author in seven four-chapter batches

Process chapters 1–4, 5–8, 9–12, 13–16, 17–20, 21–24, and 25–28 in order.

For each batch:

1. Consult the HPA-607 palette checkpoint before minting a key.
2. Add or adjust fenced `sfx` / `bgm` blocks in the acts.
3. Add a plan entry when a cue identity receives its first real placement.
4. Reuse existing keys for recurring identities instead of minting aliases or near-duplicates.
5. Run compile and `audio:report`.
6. Run **Agent B only** from the existing `reviewing-written-stories` workflow over the edited chapter group with its optional audio-continuity checklist.
7. Re-read the edited material muted.
8. Check BGM in/out state across every chapter boundary in the batch and the boundary into the next chapter when available.

This keeps the canonical plan close to real usage while catching continuity errors in the batch that introduced them.

## Authoring syntax

Audio placement uses the existing Markdown fence contract. The fence applies to the **next** dialogue entry.

SFX:

````markdown
```sfx
door-open
```

**旁白**：澪推開房門。
````

Start/change BGM:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

Stop BGM:

````markdown
```bgm
stop
```

**旁白**：房間重新沉進安靜。
````

Do **not** use Markdown-link forms such as `[sfx](door-open)` or `[bgm](dawn-apartment)`. They are not audio commands.

## Ownership and data flow

### Markdown acts: placement truth

Acts answer **where** a sound starts, changes, stops, or fires.

A cue block belongs immediately before the dialogue entry where that state change should take effect. Omitted BGM means “preserve the current BGM state”; it does not mean stop.

### `docs/audio-plan.json`: identity and intent truth

The plan answers **what** a key represents and what later generation should create.

Keep entries limited to the HPA-606 schema. Do not add local URLs, provider/model fields, output paths, candidate metadata, or runtime volume settings.

Extend the plan only on first real placement. Unused plan rows are warnings/speculative drift, not a reason to front-load future identities.

### Compiler: hard contract validation

A successful compile proves that authored cue keys:

- have a plan when audio is used;
- resolve to a planned key;
- match the planned SFX/BGM type;
- satisfy the existing Markdown parser contract.

Unknown or kind-mismatched authored keys are fatal. They do not appear as a successful report result.

### `audio:report`: derived usage inventory

The report provides:

- used SFX/BGM identities and their locations;
- usage counts;
- BGM stop locations;
- unused planned identities.

It does **not** prove semantic alias freedom, over/under-cueing, reveal safety, muted readability, or active BGM state at each chapter boundary.

Use report locations plus the edited source acts to inspect the last BGM command/stop before a chapter boundary and the first command after it. Do not add a state analyzer for HPA-607.

### Agent B: semantic audio-continuity review

For each four-chapter batch, use the existing chapter-level Agent B only. Its optional audio-continuity checklist owns the human judgment around:

- repeated identity consistency / likely aliases;
- sustained BGM state versus arbitrary act changes;
- cue timing and reveal spoilers;
- SFX density / micro-foley;
- intentional silence;
- plot-essential information remaining available without audio.

Do not spawn Agents A/C for this audio-only audit and do not add Agent D.

### Linear HPA-607: working checkpoint and final audit summary

Linear owns two human-readable comments, not committed report files:

1. **After Pass 1:** reconciled identity + silence + deferred list used to keep later batches consistent.
2. **At completion:** exact base commit, 28/28 chapters reviewed, final unique SFX/BGM counts, summed intended duration from unique plan identities, deliberately silent/deferred areas, and candidate-generation request/credit bound or formula with unknown assumptions stated.

For duration, sum each unique plan asset’s `durationMs` once as intended generated asset duration. Do not treat looping playback time as generation duration.

### Web catalogs: representative local playback only

Keep `LOCAL_SFX_CATALOG` / `LOCAL_BGM_CATALOG` deliberately small. They are for representative local-reader checks, not for pre-building HPA-608 output.

The live five-key bootstrap is the starting hypothesis:

- SFX: `door-open`, `notification-beep`, `impact`
- BGM: `dawn-apartment`, `tension-pulse`

Rename, merge, or remove a bootstrap key only when the full-story audit proves a clearer stable identity. Update placements, plan entry, and the tiny local catalog subset together. The existing catalog-plan test already enforces catalog ⊆ plan by type.

## Palette rules

### Stable identities

- Use kebab-case keys.
- Name the audible/narrative identity, not a chapter number or implementation detail.
- Reuse a key when downstream generation should create the same asset.
- Split a key when generation intent materially differs.
- Consult the Linear palette checkpoint before minting a new identity.
- Prefer a modest story-level palette over one key per line or scene.

### SFX direction

SFX should emphasize concrete or narratively meaningful beats: recurring objects, physical shocks, environmental signatures, or transitions whose sound carries useful rhythm/atmosphere.

Avoid sentence-by-sentence Foley for ordinary movement, clothing, every door, every breath, or every interface-like action. Silence is the default.

### BGM direction

BGM is sustained state, not per-line decoration.

- Start/change music when the scene’s emotional or structural state meaningfully changes.
- Let a track continue across adjacent entries/acts/chapters while its intent remains valid.
- Use an explicit `bgm` `stop` fence when silence is intentional or before an incompatible state.
- Do not restart the same key merely because a new act or chapter begins.
- Inspect every batch’s chapter boundaries because omitted BGM preserves the current track during normal forward-adjacent progression.

## Per-batch validation

After **every** four-chapter batch:

1. `bun --filter @aquila/stories compile`
2. `bun --filter @aquila/stories audio:report theSeventhMirror`
3. Fix compile failures for unknown/type-mismatched authored cues.
4. Inspect `unused` and remove speculative plan entries unless intentionally about to be used in the same batch.
5. Run chapter-level Agent B on the edited chapters with optional audio continuity.
6. Re-read the edited material muted.
7. Using report locations plus source acts, inspect each chapter boundary for the outgoing last BGM command/stop and incoming first BGM command; confirm carry/stop/change is intentional.

No new analyzer, alias detector, or report format is required.

## Final local-reader checks

Spot-check representative:

- early-story material;
- middle-story material;
- late-story material;
- reveal beat;
- player-choice beat;
- quiet/silent beat.

Use the existing SFX/BGM preference controls to verify both audio-on behavior and muted readability. A single scene may satisfy multiple categories. Keep placeholder mappings bounded to the smallest useful subset.

## Final verification

Run only commands that exist on `main`:

```bash
bun compile:stories
bun --filter @aquila/stories test
bun run compile:check
bun run lint
bun --filter @aquila/stories audio:report theSeventhMirror
```

There is no separate `audit_novel.py` structural script in the current reviewing skill; `compile:check`, story tests, compile, lint, Agent B review, and the report are the intended verification seams.

## Risks and mitigations

### Palette explosion / semantic aliases

**Risk:** every memorable beat gets a new key or later batches mint near-duplicates.  
**Mitigation:** persist the reconciled Pass-1 palette in Linear, consult it before every new key, and have Agent B review every batch.

### Over-cueing

**Risk:** authored audio competes with prose/dialogue.  
**Mitigation:** silence is the default; Agent B plus muted re-read runs after each batch.

### BGM leakage

**Risk:** a sustained key unintentionally crosses an act/chapter boundary.  
**Mitigation:** inspect BGM in/out at every batch boundary using report locations plus source acts; add explicit stop/change only where narrative intent requires it.

### Plan/placement drift

**Risk:** a key exists on only one side of the contract.  
**Mitigation:** compile catches missing/type-mismatched authored keys; `audio:report.unused` exposes planned-but-unused identities.

### Unbounded downstream generation spend

**Risk:** HPA-608 starts with an unexpectedly large palette or unclear retry assumptions.  
**Mitigation:** finish HPA-607 with exact identity counts, summed unique `durationMs`, and a provider-neutral request/credit formula/bound where calculable.

## Acceptance mapping

HPA-607 is complete when:

- all 28 chapters have been reviewed in story order;
- the Pass-1 identity/silence/deferred checkpoint is recorded on HPA-607;
- acts use only the existing fenced `sfx` / `bgm` / `bgm stop` contract;
- the acts express one coherent, sparse audio direction and remain understandable muted;
- repeated motifs use stable identities with no reviewer-identified unresolved aliases;
- BGM uses intentional sustained start/change/stop semantics across chapter boundaries;
- `docs/audio-plan.json` contains the final identity/intent set and passes schema validation;
- compile succeeds with no unknown/kind-mismatched authored cues;
- `audio:report.unused` has no accidental entries;
- Agent B audio-continuity review runs after every four-chapter batch;
- representative local-reader checks cover early/middle/late, reveal, choice, and quiet material;
- the local placeholder catalog remains a deliberately small subset of the story plan;
- final Bun verification passes;
- HPA-607 contains the final audit/generation-scope summary;
- no second inventory, generator, publisher, BGM-state analyzer, alias detector, or full local placeholder catalog has been introduced.
