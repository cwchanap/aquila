# HPA-607 Seventh Mirror Audio Audit Implementation Plan

**Goal:** Complete a read-only-first story audit, then author the final SFX/BGM direction across all 28 chapters of The Seventh Mirror using the HPA-606 Markdown + audio-plan + compiler-report workflow.

**Architecture:** Keep Markdown acts as placement truth, `docs/audio-plan.json` as cue identity/intent truth, and `audio:report` as the derived usage validator. Perform one full read-only audit before edits, then author seven sequential four-chapter batches. Do not add a second inventory or audio pipeline code.

**Tech stack:** Markdown, JSON/Zod story schema, TypeScript story compiler, pnpm/Vitest, existing `reviewing-written-stories` skill.

**Design:** `docs/superpowers/specs/2026-08-14-hpa-607-seventh-mirror-audio-audit-design.md`

---

## Task 1: Capture the clean HPA-606 baseline

**Read:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- `packages/stories/src/compiler/audio-plan.ts`
- `packages/stories/src/compiler/cli.ts`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`

### Step 1: Verify the story compiles before HPA-607 edits

Run:

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
```

Expected: compile succeeds with the HPA-606 bootstrap cues.

### Step 2: Capture the baseline audio report

Run:

```bash
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

Expected: the report recognizes the current three SFX and two BGM plan identities, with no unresolved authored key.

Record the counts in temporary working notes only. Do not commit a report snapshot or another inventory.

### Step 3: Run baseline story tests

Run:

```bash
pnpm --filter @hpa/stories test
pnpm --filter @hpa/stories test:canon
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
- repeated moments of revelation, procedural tension, memory, or silence;
- emotional/music states that span multiple dialogue beats;
- points where silence or a BGM stop is narratively meaningful.

Do not add cue keys yet.

### Step 2: Read all 28 chapters in story order

For every chapter, note privately:

- candidate SFX moments that add information or motif continuity;
- likely BGM start/change/stop boundaries;
- whether an earlier candidate identity should recur;
- whether the current bootstrap key is semantically broad/specific enough.

Do not edit Markdown during this pass. Do not commit scratch notes or a palette inventory.

### Step 3: Reconcile the working palette before authoring

Before editing chapter 1, reduce near-duplicate candidates and choose stable kebab-case identities.

Rules:

- reuse the same key only when later generation should create the same asset;
- split identities when generation intent materially differs;
- do not create keys for routine micro-foley;
- treat the five HPA-606 bootstrap keys as editable hypotheses rather than compatibility requirements.

No repository commit is required for this task; the next task turns the decisions into canonical story data.

---

## Task 3: Author chapters 1–4 and settle the bootstrap identities

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_1/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_2/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_3/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_4/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

**Modify only if a bootstrap key is renamed/removed:**

- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`

### Step 1: Re-evaluate the HPA-606 sample placements

Keep `impact`, `glass-click`, `reading-room-breath`, `cold-reflection`, and `threshold-quiet` only where the full-story audit confirms they are useful stable identities.

If a bootstrap key is renamed or merged:

1. update its Markdown placements;
2. update/remove its plan entry;
3. update the corresponding local placeholder mapping so every catalog key remains a subset of the plan.

Do not add placeholders for unrelated new cues.

### Step 2: Author chapters 1–4

Add sparse `[sfx](key)`, `[bgm](key)`, and `[bgm](stop)` fences using the design rules.

Add each new identity to `audio-plan.json` when its first real placement is authored. Do not front-load unused future entries.

### Step 3: Validate the batch

Run:

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

Expected:

- zero unresolved authored keys;
- no accidental unused plan entries from this batch;
- BGM state at the end of chapter 4 is intentional.

If either local web catalog changed, also run:

```bash
pnpm --filter web test
```

### Step 4: Commit

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 1-4"
```

Omit the web path from `git add` when the local catalogs did not change.

---

## Task 4: Author chapters 5–8

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_5/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_6/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_7/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_8/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author the next story-order batch

Reuse identities established in chapters 1–4 where generation intent matches. Add only genuinely new identities to the plan.

Pay special attention to BGM continuation from chapter 4 into chapter 5; do not restart a track solely because the chapter changed.

### Step 2: Validate

Run:

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

Expected: zero unresolved keys; all new plan entries have intentional placements; chapter 8 exits with intentional BGM state.

### Step 3: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 5-8"
```

---

## Task 5: Author chapters 9–12

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_9/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_10/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_11/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_12/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author placements and plan entries

Continue the same identity rules. Avoid creating a new BGM key for minor scene-tone variation that can be carried by an existing state.

### Step 2: Run the first representative audio-continuity review

Use the existing `reviewing-written-stories` workflow with an `audio-continuity` checkpoint on a representative early-to-middle transition from the authored material.

The review should answer only:

- does BGM state start/change/stop at sensible narrative boundaries;
- do recurring SFX motifs keep the same identity when they should;
- are any scenes noticeably over-cued or under-cued relative to the chosen direction?

Do not introduce a new review skill or persist a second inventory.

### Step 3: Validate

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

### Step 4: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 9-12"
```

---

## Task 6: Author chapters 13–16

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_13/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_14/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_15/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_16/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author the midpoint batch

Prefer reuse of established motif keys. Only mint a new key when the generated asset itself should differ.

### Step 2: Review the midpoint music transition

Run a focused `audio-continuity` review around the strongest midpoint transition. Verify that the incoming BGM state does not leak past its narrative role and that any silence/stop is explicit.

### Step 3: Validate

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

### Step 4: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 13-16"
```

---

## Task 7: Author chapters 17–20

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_17/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_18/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_19/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_20/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author placements and reuse the established palette

At this point, the palette should grow more slowly. Treat a sudden increase in new keys as a prompt to re-check whether existing identities can serve the same generated sound.

### Step 2: Validate

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

### Step 3: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 17-20"
```

---

## Task 8: Author chapters 21–24

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_21/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_22/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_23/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_24/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author the late-story batch

Emphasize motif payoff and continuity rather than introducing novelty for its own sake.

### Step 2: Validate

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

### Step 3: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 21-24"
```

---

## Task 9: Author chapters 25–28 and close the final audio state

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_25/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_26/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_27/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_28/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

### Step 1: Author the final batch

Resolve recurring motifs with existing identities where appropriate. Add a new late-story key only when its audible identity is genuinely distinct.

### Step 2: Verify the ending state explicitly

Check the final acts for:

- intentional last BGM start/change;
- intentional final `stop` or deliberate continued state according to reader semantics;
- no accidental carry-over caused by an earlier chapter;
- no one-off duplicate of an established motif key.

### Step 3: Run late-story/ending audio-continuity review

Use the existing reviewer with an `audio-continuity` checkpoint for a late-story convergence and the ending.

### Step 4: Validate

```bash
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

### Step 5: Commit

```bash
git add packages/stories/raw/theSeventhMirror

git commit -m "feat(story): author Seventh Mirror audio cues for chapters 25-28"
```

---

## Task 10: Final palette cleanup and repository verification

**Review/modify if needed:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- all authored `[sfx]` / `[bgm]` placements under `packages/stories/raw/theSeventhMirror/chapter_*/`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`

### Step 1: Run the final report and resolve all drift

```bash
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

Final expectations:

- unresolved keys: zero;
- unused planned cues: zero unless an entry is explicitly justified and immediately needed by downstream HPA-608 work; prefer removing speculative entries from HPA-607;
- every repeated motif uses the intended stable key;
- BGM start/stop counts match intentional state changes rather than chapter count.

### Step 2: Verify the local catalog remains deliberately small

Do not mirror the final story plan into the web catalogs. Confirm only the representative placeholder keys remain and every such key still exists in `audio-plan.json` with matching cue kind.

If the catalogs changed, run:

```bash
pnpm --filter web test
```

### Step 3: Run the story-wide structural audit

```bash
python3 .agents/skills/reviewing-written-stories/scripts/audit_novel.py packages/stories theSeventhMirror
```

Expected: no structural regression introduced by the Markdown edits.

### Step 4: Run the full story verification set

```bash
pnpm --filter @hpa/stories test
pnpm --filter @hpa/stories test:canon
pnpm --filter @hpa/stories compile --story theSeventhMirror
pnpm --filter @hpa/stories audio:report --story theSeventhMirror
```

Expected: all commands pass; final report has no unresolved identity/placement drift.

### Step 5: Final cleanup commit if needed

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio

git commit -m "chore(story): finalize Seventh Mirror audio palette"
```

Skip this commit if Task 9 already leaves the repository clean and all final checks pass.

---

## Execution notes

- Keep changes content-focused. If HPA-607 reveals a compiler/report defect, fix only the smallest defect that prevents the authored workflow; do not fold HPA-608/HPA-609 pipeline work into this ticket.
- Do not preserve bootstrap cue names solely for compatibility. There are no external users; prefer the clearer final identity when the full-story audit proves a rename is worthwhile.
- Do not add provider/model/runtime metadata to `audio-plan.json`.
- Do not add generated audio, R2 URLs, manifests, or narration artifacts.
- Do not commit scratch audit notes or derived report snapshots.
- Keep each four-chapter batch independently compilable and report-clean so review can stop/restart without reconstructing hidden state.
