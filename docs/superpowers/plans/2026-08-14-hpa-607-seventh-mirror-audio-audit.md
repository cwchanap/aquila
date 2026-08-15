# HPA-607 Seventh Mirror Audio Audit Implementation Plan

**Goal:** Complete a read-only-first story audit, then author the final SFX/BGM direction across all 28 chapters of The Seventh Mirror using the HPA-606 Markdown + audio-plan + compiler-report workflow.

**Architecture:** Keep Markdown acts as placement truth, `docs/audio-plan.json` as cue identity/intent truth, and `audio:report` as the derived usage validator. Perform one full read-only audit before edits, then author seven sequential four-chapter batches. Do not add a second inventory or audio pipeline code.

**Tech stack:** Markdown, JSON/Zod story schema, TypeScript story compiler, Bun/Vitest, existing `reviewing-written-stories` skill.

**Design:** `docs/superpowers/specs/2026-08-14-hpa-607-seventh-mirror-audio-audit-design.md`

---

## Task 1: Capture the clean HPA-606 baseline

**Read:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- `packages/stories/src/compiler/cli.ts`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`
- `packages/stories/package.json`
- root `package.json`

### Step 1: Record the exact implementation base commit

At the start of the implementation branch, run:

```bash
git rev-parse HEAD
```

Keep this SHA in working notes for the final HPA-607 audit summary. Do not create a committed audit file.

### Step 2: Verify the story compiles before HPA-607 edits

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
```

Expected: compile succeeds with the HPA-606 bootstrap cues.

### Step 3: Capture the baseline audio report

```bash
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

Expected: the report recognizes the current three SFX and two BGM plan identities, with no unresolved authored key.

Record the counts in temporary working notes only. Do not commit a report snapshot or second inventory.

### Step 4: Run baseline story tests

```bash
bun --filter @aquila/stories test
```

Expected: green before content editing begins.

---

## Task 2: Perform the full read-only audio-direction audit

**Read only:**

- `packages/stories/raw/theSeventhMirror/canon/*.md`
- `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`
- chapter plan documents under `packages/stories/raw/theSeventhMirror/docs/`
- all Markdown acts under `packages/stories/raw/theSeventhMirror/chapter_1/` through `chapter_28/`

### Step 1: Read canon and high-level structure first

Identify story-wide recurring elements that may warrant stable audio identity:

- recurring physical/object motifs;
- distinctive environments;
- repeated revelation, procedural tension, memory, or silence;
- emotional/music states that span multiple dialogue beats;
- points where silence or a BGM stop is narratively meaningful.

Do not add cue keys yet.

### Step 2: Read all 28 chapters in story order

For every chapter, note privately:

- candidate SFX moments that add information, rhythm, or motif continuity;
- likely BGM start/change/stop boundaries;
- whether an earlier candidate identity should recur;
- whether a current bootstrap key is semantically broad/specific enough;
- scenes that should remain deliberately silent;
- tempting audio ideas that should be deferred instead of forcing them into this ticket.

Do not edit Markdown during this pass. Do not commit scratch notes or a palette inventory.

### Step 3: Reconcile the working palette before authoring

Before editing chapter 1, reduce near-duplicate candidates and choose stable kebab-case identities.

Rules:

- reuse the same key only when later generation should create the same asset;
- split identities when generation intent materially differs;
- remove aliases/near-duplicates rather than preserving bootstrap compatibility;
- do not create keys for routine micro-foley;
- treat the five HPA-606 bootstrap keys as editable hypotheses.

No repository commit is required for this task; the next task turns the decisions into canonical story data.

---

## Task 3: Author chapters 1–4 and settle the bootstrap identities

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_1/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_2/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_3/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_4/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

**Modify only if a bootstrap key changes or a representative spot check needs a different placeholder:**

- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`

### Step 1: Re-evaluate the HPA-606 sample identities

Keep `impact`, `glass-click`, `reading-room-breath`, `cold-reflection`, and `threshold-quiet` only where the full-story audit confirms they are useful stable identities.

If a bootstrap key is renamed or merged:

1. update its Markdown placements;
2. update/remove its plan entry;
3. update the corresponding local placeholder mapping so every catalog key remains a subset of the plan.

Do not add placeholders for the whole palette.

### Step 2: Author chapters 1–4

Add sparse `[sfx](key)`, `[bgm](key)`, and `[bgm](stop)` fences.

Add each new identity to `audio-plan.json` when its first real placement is authored. Do not front-load unused future entries.

### Step 3: Check muted readability and identity reuse

Re-read the edited material with audio conceptually disabled. No cue should carry a fact required to understand the scene.

Search the working palette for aliases before adding a new key.

### Step 4: Validate the batch

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

Expected:

- zero unresolved authored keys;
- no accidental unused plan entries from this batch;
- no duplicate/alias identities;
- BGM state at the end of chapter 4 is intentional.

If either local web catalog changed:

```bash
bun --filter web test
```

### Step 5: Commit

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 1-4"
```

Omit the web path when the local catalogs did not change.

---

## Task 4: Author chapters 5–8

**Modify:** chapters 5–8 acts and `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`.

### Steps

1. Author sparse placements in story order.
2. Reuse identities established in chapters 1–4 where generation intent matches.
3. Do not restart BGM solely because the chapter changed.
4. Re-read representative edited scenes muted.
5. Validate:

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

6. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 5-8"
```

---

## Task 5: Author chapters 9–12 and run the first continuity review

**Modify:** chapters 9–12 acts and `audio-plan.json`.

### Steps

1. Author placements and add only genuinely new identities.
2. Avoid a new BGM key for minor tone variation that an existing sustained state can carry.
3. Use the existing `reviewing-written-stories` workflow with an `audio-continuity` checkpoint on a representative early-to-middle transition.
4. The review should answer only:
   - does BGM start/change/stop at sensible narrative boundaries;
   - do recurring SFX motifs retain one identity where they should;
   - are scenes noticeably over-cued or under-cued;
   - is the prose still understandable muted?
5. Validate:

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

6. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 9-12"
```

Do not introduce a new review skill or persist a second inventory.

---

## Task 6: Author chapters 13–16 and review the midpoint transition

**Modify:** chapters 13–16 acts and `audio-plan.json`.

### Steps

1. Author the midpoint batch, preferring reuse of established motif keys.
2. Run a focused `audio-continuity` review around the strongest midpoint transition.
3. Verify incoming BGM does not leak past its narrative role and meaningful silence uses an explicit stop when required.
4. Re-read representative midpoint material muted.
5. Validate:

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

6. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 13-16"
```

---

## Task 7: Author chapters 17–20

**Modify:** chapters 17–20 acts and `audio-plan.json`.

### Steps

1. Author placements using the established palette.
2. Treat a sudden increase in new keys as a prompt to check for aliases/near-duplicates.
3. Re-read representative edited scenes muted.
4. Validate:

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

5. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 17-20"
```

---

## Task 8: Author chapters 21–24

**Modify:** chapters 21–24 acts and `audio-plan.json`.

### Steps

1. Author the late-story batch.
2. Emphasize motif payoff and continuity rather than novelty for its own sake.
3. Re-read representative late-story scenes muted.
4. Validate:

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

5. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 21-24"
```

---

## Task 9: Author chapters 25–28 and close the final audio state

**Modify:** chapters 25–28 acts and `audio-plan.json`.

### Step 1: Author the final batch

Resolve recurring motifs with existing identities where appropriate. Add a late-story key only when its intended generated asset is genuinely distinct.

### Step 2: Verify the ending state explicitly

Check the final acts for:

- intentional final BGM start/change;
- intentional final `stop` or deliberate continued state according to reader semantics;
- no accidental carry-over caused by an earlier chapter;
- no one-off duplicate of an established motif key.

### Step 3: Run late-story/ending continuity review

Use the existing reviewer with an `audio-continuity` checkpoint for a late-story convergence and the ending. Confirm the ending also works muted.

### Step 4: Validate

```bash
bun --filter @aquila/stories compile --story theSeventhMirror
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

### Step 5: Commit

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 25-28"
```

---

## Task 10: Run representative local-reader spot checks

**Review/modify only when needed:**

- representative acts from early, middle, and late story;
- representative reveal, player-choice, and quiet/silent beats;
- `apps/web/src/lib/audio/sfx-catalog.ts`;
- `apps/web/src/lib/audio/bgm-catalog.ts`.

### Step 1: Select representative scenes

Cover at least:

- one early-story scene;
- one middle-story scene;
- one late-story scene;
- one reveal beat;
- one player-choice beat;
- one quiet/silent beat.

A single scene may satisfy more than one category when appropriate; do not create artificial coverage work.

### Step 2: Keep placeholder playback bounded

Use the existing local placeholder assets for only the small subset needed to exercise representative SFX/BGM start/change/stop behavior.

If the original five bootstrap mappings no longer cover useful representative scenes, swap or minimally adjust the subset. Do not mirror the complete final plan into the web catalogs.

Every local catalog key must still exist in `audio-plan.json` with the matching cue kind.

### Step 3: Check audio-on and muted behavior

For the representative scenes, verify:

- cue timing feels intentional;
- BGM persists/stops correctly across navigation relevant to the scene;
- repeated motifs use the intended identity;
- quiet scenes are not accidentally filled;
- disabling/muting audio leaves story meaning and choices understandable.

Do not generate production audio for this check.

### Step 4: Run web tests if mappings changed

```bash
bun --filter web test
```

Commit catalog adjustments only if they are useful as the final small representative subset.

---

## Task 11: Final palette cleanup and repository verification

**Review/modify if needed:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- all authored `[sfx]` / `[bgm]` placements under `packages/stories/raw/theSeventhMirror/chapter_*/`
- the small web audio catalog subset.

### Step 1: Resolve final report drift

```bash
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

Final expectations:

- unresolved keys: zero;
- accidental unused planned cues: zero;
- duplicate/alias identities: zero;
- every recurring motif uses the intended stable key;
- BGM start/stop counts reflect narrative state changes rather than chapter count.

Prefer deleting speculative entries over carrying them into HPA-608.

### Step 2: Run the structural story audit

```bash
python3 .agents/skills/reviewing-written-stories/scripts/audit_novel.py packages/stories theSeventhMirror
```

Expected: no structural regression introduced by the Markdown edits.

### Step 3: Run the repository verification set required by HPA-607

```bash
bun compile:stories
bun --filter @aquila/stories test
bun run compile:check
bun run lint
bun --filter @aquila/stories audio:report --story theSeventhMirror
```

Expected: all commands pass and the final audio report has no unresolved identity/placement drift.

### Step 4: Final cleanup commit if needed

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio
git commit -m "chore(story): finalize Seventh Mirror audio palette"
```

Skip this commit if the repository is already clean.

---

## Task 12: Post the HPA-607 audit summary and bound downstream generation work

**Update:** Linear issue HPA-607.  
**Do not create:** another committed audit/report file.

### Step 1: Compute final palette facts from canonical data

From the final `audio-plan.json` and `audio:report`, capture:

- exact base commit recorded in Task 1;
- chapters reviewed: 28/28;
- unique SFX identity count;
- unique BGM identity count;
- total intended duration where calculable from plan fields;
- deliberately silent sections;
- deferred audio ideas.

If looping BGM or missing duration hints prevent a meaningful total, state the known duration subtotal and the unknown portion instead of inventing a number.

### Step 2: Bound candidate-generation requests/credits

Use the final unique identity counts to state the minimum one-candidate-per-identity request count. If the downstream generation design already defines candidates-per-cue, retries, or a credit formula, also report that calculated bound.

If provider pricing/credit semantics are still undefined, record the formula and unknown assumptions rather than selecting a provider or guessing a price in HPA-607.

This is a planning guardrail for HPA-608, not generation work.

### Step 3: Post one concise Linear completion comment

Include:

- base commit;
- 28/28 chapters reviewed;
- SFX/BGM counts and duration facts;
- request/credit bound or formula;
- muted/local-reader spot-check result;
- deliberately silent sections;
- deferred ideas;
- final verification result.

Do not duplicate the entire audio plan in the comment.

---

## Execution notes

- Keep changes content-focused. If HPA-607 reveals a compiler/report defect, fix only the smallest defect that blocks the authored workflow; do not fold HPA-608/HPA-609 pipeline work into this ticket.
- Do not preserve bootstrap cue names solely for compatibility. There are no external users; prefer a clearer final identity when the full-story audit proves a rename worthwhile.
- Do not add provider/model/runtime metadata to `audio-plan.json`.
- Do not add generated audio, R2 URLs, manifests, or narration artifacts.
- Do not commit scratch audit notes or derived report snapshots.
- Keep each four-chapter batch independently compile/report clean so review can stop and restart without reconstructing hidden state.
- Prefer silence, reuse, and deletion over adding machinery or speculative keys.
