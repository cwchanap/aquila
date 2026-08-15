# HPA-607 Seventh Mirror Audio Audit Design

**Issue:** HPA-607 — Audit The Seventh Mirror and author its complete visual-novel audio plan  
**Date:** 2026-08-14  
**Status:** Proposed

## Context

HPA-606 established the audio-authoring contract already present on `main`:

- Markdown acts own cue placement through fenced `sfx` / `bgm` blocks attached to the **next** dialogue entry.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` owns cue identity and generation intent.
- The compiler validates authored cue membership and type after story assembly.
- `audio:report` is the only derived usage inventory: used assets, usage locations, BGM stop locations, and unused planned entries.
- The web SFX/BGM catalogs may contain only a small playable subset of the story plan.

The live HPA-606 bootstrap is:

- SFX: `door-open`, `notification-beep`, `impact`
- BGM: `dawn-apartment`, `tension-pulse`

The local web catalogs map those same five keys to placeholder WAVs, and `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts` enforces catalog ⊆ plan with matching type.

HPA-607 expands that bootstrap into the complete story-wide direction without adding a second inventory, state analyzer, alias detector, generation pipeline, or publisher.

## Runtime constraint that changes the authoring rule

BGM is persistent during genuine forward progression, but a cue-less scene is **not** self-contained.

`activeBgmAt()` only scans the current scene. `nextBgmSelection()` carries the prior selected key across scenes only when navigation is same-story, forward-adjacent, and the previous scene was left from its final dialogue line. Fresh loads, replacement scenes, act-panel jumps, and cross-scene jumps originating mid-scene resolve a cue-less destination to silence.

Therefore HPA-607 adopts a story-specific **scene-opening BGM invariant**:

> Every act declares its intended BGM state before the first dialogue entry: either `bgm <key>` or `bgm stop`.

This is a state declaration, not a requirement to change tracks at every act boundary. Re-declaring the already-playing key is cheap: the existing BGM player returns early when the requested key is already active.

Consequences:

- every act is correct when entered directly, resumed, or reached by non-forward navigation;
- sustained music may use the same key across many acts;
- silent acts explicitly open with `bgm stop`;
- the author never relies on hidden navigation history to know the intended scene-entry state.

## Goals

1. Review all 28 chapters in narrative order before locking the full audio direction.
2. Establish one coherent, reusable SFX/BGM palette.
3. Author sparse, intentional SFX plus explicit scene-entry BGM state using the existing fenced syntax.
4. Keep recurring motifs on stable cue identities suitable for later generation and publishing.
5. Keep `docs/audio-plan.json` complete and schema-valid as the only creative generation plan.
6. Use the compiler/report/reviewer seams only for what each actually proves.
7. Keep the audit restart-safe without committing another inventory.
8. Bound downstream generation work before HPA-608 using final identity counts and summed intended asset duration.
9. Preserve a story that remains understandable and emotionally coherent with audio muted.

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

**Rejected:** early identities are chosen before later motifs are understood, making duplicate/alias keys and mood drift more likely.

### B. Read-only audit in restart-safe four-chapter blocks, reconcile, then author — chosen

Read canon and the high-level plan once. Then audit chapters in the same seven four-chapter groups used for authoring. Read acts in story order and consult the corresponding chapter plans when they add reveal-timing, recurring-location, motif, or emotional-arc context. After each read-only block, post a short Linear checkpoint. After all seven blocks, reconcile those observations into the working palette before any act edit.

**Pros:** preserves the issue’s chapter-plan context without requiring a separate cover-to-cover plan read; survives interruption; no repo machinery; authoring still starts only after the whole story has been audited.  
**Cons:** produces a handful of small Linear checkpoint comments before the final reconciliation.

### C. Build an inventory/sync tool first

Create another palette file or tooling that generates/merges placements and plan entries.

**Rejected:** HPA-606 already provides the required machine-readable sources and validation. Extra synchronization machinery would create more drift risk than it removes.

## Decision

Use two passes.

### Pass 1: read-only direction audit in seven blocks

Read once up front:

1. `packages/stories/raw/theSeventhMirror/canon/`
2. `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`

Then process these read-only blocks in order:

- chapters 1–4
- chapters 5–8
- chapters 9–12
- chapters 13–16
- chapters 17–20
- chapters 21–24
- chapters 25–28

For each block:

1. Read the acts in story order.
2. Keep the corresponding `chapter_N_plan.md` files available and consult the relevant sections for reveal timing, recurring locations, motifs, or emotional-arc intent; do not require a second full prose read when the authored acts are already clear.
3. Identify candidate SFX identities, sustained BGM identities, intended scene-entry states, deliberate silence, likely reuse, and deferred ideas.
4. Post one concise Linear checkpoint for that four-chapter block.

Do not edit acts and do not commit scratch notes during Pass 1.

After all seven blocks, reconcile the checkpoints and post one final pre-authoring Linear comment containing:

- the proposed stable kebab-case identities with SFX/BGM kind;
- deliberately silent states/sections;
- deferred ideas;
- any bootstrap identity proposed for rename/merge and why.

This is the human restart seam. `audio-plan.json` remains the only machine-readable identity registry.

### Pass 2: author the same seven four-chapter batches

For each batch:

1. Consult the reconciled Linear palette before minting a key.
2. Give **every act** an explicit BGM state before its first dialogue entry: a planned BGM key or `stop`.
3. Add sparse SFX only where they improve timing, atmosphere, continuity, or emphasis.
4. Add a plan entry when an identity receives its first real placement.
5. Reuse existing identities instead of creating aliases/near-duplicates.
6. Compile and inspect `audio:report`.
7. Run **Agent B only** from the existing `reviewing-written-stories` workflow with optional audio continuity.
8. Re-read the batch muted.
9. Stage raw + generated outputs, run `compile:check`, then commit the self-consistent batch.

## Authoring syntax

Audio fences apply to the **next** dialogue entry.

SFX:

````markdown
```sfx
door-open
```

**旁白**：澪推開房門。
````

Scene-opening or mid-scene BGM state:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

Silence:

````markdown
```bgm
stop
```

**旁白**：房間重新沉進安靜。
````

Do **not** use Markdown-link forms such as `[sfx](door-open)` or `[bgm](dawn-apartment)`.

An act may have background fences before the BGM fence, but the BGM command must still attach to the **first dialogue entry**. Later BGM fences are used only for real state changes inside the act.

## Ownership and data flow

### Markdown acts: placement and scene-entry state truth

Acts answer **where** SFX fires and **what BGM state is intended when the scene is entered**.

Normal forward playback may already carry the same BGM key from the previous act. Re-stating that key at the next act’s first dialogue entry is intentional and does not imply a musical restart.

### `docs/audio-plan.json`: identity and generation-intent truth

The plan answers **what** a key represents and what HPA-608 should generate.

Keep entries limited to the HPA-606 schema. Do not add local URLs, provider/model fields, output paths, candidate metadata, or runtime volume settings.

Extend the plan only on first real placement. Unused plan rows are speculative drift, not a reason to front-load future identities.

### Compiler: hard contract validation and generated output

A successful compile proves authored cue keys resolve to plan entries of the correct type and satisfy parser/schema contracts. Unknown or kind-mismatched cues are fatal.

Compile also writes tracked generated story output. Therefore every authoring batch must keep raw Markdown and generated output together; raw-only commits are not self-consistent.

### `audio:report`: derived usage inventory

The report provides:

- used SFX/BGM identities and locations;
- usage counts;
- BGM stop locations;
- unused planned identities.

It does **not** prove semantic alias freedom, reveal safety, muted readability, or runtime active state.

With the scene-opening invariant, the report no longer needs to be interpreted as a cross-scene state analyzer. Agent B reviews whether each opener declares the **right** state; the source Markdown makes the declaration explicit.

### Agent B: semantic audio review

For each four-chapter authoring batch, use chapter-level Agent B only. Its optional audio-continuity checklist owns human judgment around:

- repeated identity consistency / likely aliases;
- whether scene-opening BGM states match sustained narrative intent;
- mid-scene BGM changes and intentional silence;
- cue timing and reveal spoilers;
- SFX density / micro-foley;
- plot-essential information remaining available without audio.

Do not spawn Agents A/C for this audio-only audit and do not add Agent D.

### Linear HPA-607: human audit state

Linear owns:

- seven small Pass-1 read checkpoints;
- one reconciled pre-authoring palette/silence/deferred checkpoint;
- one completion summary.

No committed audit or palette shadow file is added.

### Web catalogs: representative local playback only

Keep `LOCAL_SFX_CATALOG` / `LOCAL_BGM_CATALOG` deliberately small. They are for representative local-reader checks, not for pre-building HPA-608 output.

Rename, merge, or remove a bootstrap key only when the full-story audit proves a clearer stable identity. Any such change updates placements, plan entry, and the tiny local catalog subset together. The existing web test enforces catalog ⊆ plan by type.

## Palette rules

### Stable identities

- Use kebab-case keys.
- Name the audible/narrative identity, not a chapter number or implementation detail.
- Reuse a key when downstream generation should create the same asset.
- Split only when generation intent materially differs.
- Consult the Linear checkpoint before minting a new identity.
- Prefer a modest story-level palette over one key per beat.

### SFX direction

Use SFX for narratively meaningful actions, recurring objects, physical shocks, environmental signatures, or transitions whose sound adds useful rhythm/atmosphere.

Avoid sentence-by-sentence Foley for routine movement, clothing, every breath, or every UI-like action. Silence remains the SFX default.

### BGM direction

BGM is a sustained narrative state with an explicit scene-entry declaration.

- Every act declares a BGM key or `stop` before its first dialogue entry.
- Reuse the same key across adjacent acts while the state remains valid.
- Do **not** invent a new key merely because an act/chapter changed.
- Use later BGM fences only when the emotional/structural state genuinely changes within the act.
- Use `stop` where the act should begin or become intentionally silent.
- Treat repeated opener declarations as idempotent state assertions, not track restarts.

## Per-batch verification shape

After each four-chapter authoring batch:

1. compile the story;
2. inspect the Seventh Mirror audio report and remove accidental unused plan rows;
3. confirm every edited act declares its BGM state before the first dialogue entry;
4. run Agent B audio continuity on the four chapters;
5. re-read the edited chapters muted;
6. if a plan key was renamed/removed or a local catalog changed, run the web test suite;
7. stage raw + generated/story outputs;
8. run root `compile:check` against the staged generated output;
9. commit the batch.

No BGM-state report, alias detector, or second inventory is required.

## Local-reader verification

Spot-check representative early, middle, late, reveal, choice, and quiet/silent material.

Preconditions for an audio check:

1. switch the reader to **visual mode**;
2. ensure SFX/BGM preferences are enabled for the audio-on pass;
3. perform one normal reader progression click/key gesture so BGM activation is allowed;
4. then evaluate cue timing and state behavior.

Text mode intentionally suppresses SFX/BGM. A visual asset `fallback` / `unavailable` status is not itself an audio blocker; story load error/loading state is the blocking condition.

Repeat representative checks with audio disabled to confirm muted readability.

## Final verification

Run:

```bash
bun compile:stories
bun --filter @aquila/stories test
bun --filter web test
bun run compile:check
bun run lint
bun --filter @aquila/stories audio:report theSeventhMirror
```

The final web test is required because the catalog-plan contract lives there even when the last plan edit did not touch a catalog source file.

## Final generation-scope arithmetic

Identity counts and intended generated duration come from canonical `audio-plan.json`, not filtered `audio:report` output.

Use the existing Bun runtime rather than adding a script or dependency:

```bash
bun -e '
const p = await Bun.file("packages/stories/raw/theSeventhMirror/docs/audio-plan.json").json();
const sum = xs => xs.reduce((n, a) => n + a.durationMs, 0);
const sfx = p.assets.filter(a => a.type === "sfx");
const bgm = p.assets.filter(a => a.type === "bgm");
console.log(JSON.stringify({
  sfx: sfx.length,
  bgm: bgm.length,
  sfxDurationMs: sum(sfx),
  bgmDurationMs: sum(bgm),
  totalDurationMs: sum(p.assets)
}, null, 2));
'
```

`durationMs` is intended generated asset duration. Do not multiply looping BGM by playback time.

If machine-readable report JSON is ever needed, invoke the compiler CLI directly from `packages/stories` rather than parsing Bun workspace-filter prefixes. HPA-607 does not need that for its final counts/duration.

## Risks and mitigations

### Silent-on-resume / direct-entry BGM gaps

**Risk:** a cue-less act entered directly has no local BGM command and resolves to silence.  
**Mitigation:** every act explicitly declares BGM state at its first dialogue entry.

### Palette explosion / semantic aliases

**Risk:** later batches mint near-duplicates.  
**Mitigation:** block checkpoints + reconciled Linear palette + Agent B review.

### Over-cueing

**Risk:** SFX competes with prose/dialogue.  
**Mitigation:** sparse SFX, Agent B, and muted re-read. Repeated scene-opening BGM declarations are state assertions, not extra audible events.

### Raw/generated drift

**Risk:** raw Markdown changes are committed without regenerated scene output.  
**Mitigation:** stage generated/story output in every batch and run `compile:check` before committing.

### Catalog/plan drift

**Risk:** a plan rename/removal leaves the tiny local catalog pointing at a deleted identity.  
**Mitigation:** run web tests on rename/removal and always in final verification.

### Unbounded downstream generation spend

**Risk:** HPA-608 starts with an unexpectedly large palette or unclear retry assumptions.  
**Mitigation:** compute exact identity/duration facts from `audio-plan.json` and post a provider-neutral request/credit bound/formula to HPA-607.

## Acceptance mapping

HPA-607 is complete when:

- all 28 chapters have been reviewed in story order;
- relevant chapter-plan context was consulted for reveal/motif/emotional continuity without requiring a redundant second full read;
- Pass-1 progress is restart-safe through four-chapter Linear checkpoints;
- the reconciled identity/silence/deferred checkpoint is recorded before authoring;
- every act declares a valid BGM key or `stop` before its first dialogue entry;
- SFX remains sparse and motif/meaning driven;
- repeated motifs use stable identities with no unresolved reviewer-identified aliases;
- `docs/audio-plan.json` contains the final identity/intent set and passes schema validation;
- compile succeeds with no unknown/kind-mismatched authored cues;
- `audio:report.unused` has no accidental entries;
- Agent B audio-continuity review runs after every authoring batch;
- raw and tracked generated outputs are committed together;
- representative visual-reader checks cover early/middle/late, reveal, choice, and quiet material with the required visual-mode/gesture preconditions;
- muted story meaning remains coherent;
- final stories tests, web tests, compile:check, lint, and report pass;
- HPA-607 contains the final audit/generation-scope summary;
- no second inventory, generator, publisher, BGM-state analyzer, alias detector, or full local placeholder catalog has been introduced.
