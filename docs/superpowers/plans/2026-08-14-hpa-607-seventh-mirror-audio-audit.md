# HPA-607 Seventh Mirror Audio Audit Implementation Plan

**Goal:** Complete a read-only-first audit, then author the final SFX/BGM direction across all 28 chapters of The Seventh Mirror using the HPA-606 fenced-block + audio-plan + compiler/report workflow.

**Architecture:** Markdown acts remain placement truth, `docs/audio-plan.json` remains cue identity/generation-intent truth, `audio:report` remains the only derived usage inventory, and Linear HPA-607 stores the human working checkpoint/final summary. No second repo inventory or new audio tooling.

**Tech stack:** Markdown, JSON/Zod story schema, TypeScript story compiler, Bun/Vitest, existing `reviewing-written-stories` Agent B.

**Design:** `docs/superpowers/specs/2026-08-14-hpa-607-seventh-mirror-audio-audit-design.md`

---

## Task 1: Capture the clean HPA-606 baseline

**Read:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- `packages/stories/src/compiler/parse-scene.ts`
- `packages/stories/src/compiler/cli.ts`
- `packages/stories/src/compiler/audio-usage.ts`
- `.agents/skills/writing-story-acts/SKILL.md`
- `.agents/skills/reviewing-written-stories/SKILL.md`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`
- `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts`
- `packages/stories/package.json`
- root `package.json`

### Step 1: Record the exact implementation base commit

```bash
git rev-parse HEAD
```

Keep the SHA for the final HPA-607 Linear summary. Do not create a committed audit file.

### Step 2: Confirm the live bootstrap before editing

The current starting hypotheses on `main` are:

- SFX: `door-open`, `notification-beep`, `impact`
- BGM: `dawn-apartment`, `tension-pulse`

Confirm their current placements and the matching five local placeholder mappings before changing anything.

### Step 3: Verify the repository baseline

```bash
bun --filter @aquila/stories compile
bun --filter @aquila/stories test
bun --filter @aquila/stories audio:report theSeventhMirror
```

Expected:

- compile succeeds;
- story tests pass;
- report contains the live HPA-606 usage and any current `unused` rows;
- no assumption is made that the report contains “unresolved” keys—unknown/type-mismatched cues are compiler failures instead.

---

## Task 2: Perform the full read-only audio-direction audit

**Read only:**

- `packages/stories/raw/theSeventhMirror/canon/*.md`
- `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`
- chapter plan documents under `packages/stories/raw/theSeventhMirror/docs/`
- every act under `chapter_1/` through `chapter_28/`, in story order

### Step 1: Read canon and high-level structure first

Identify story-wide recurring elements that may deserve stable audio identity:

- physical/object motifs;
- distinctive locations/environments;
- supernatural/mirror/glitch motifs;
- repeated investigation, grief, pursuit, revelation, or quiet states;
- BGM transitions and deliberate silence.

Do not edit acts yet.

### Step 2: Read all 28 chapters in story order

For every chapter, note privately:

- candidate SFX moments that add information, rhythm, atmosphere, or motif continuity;
- likely BGM start/change/stop boundaries;
- whether an earlier identity should recur;
- scenes that should remain silent;
- ideas worth deferring rather than forcing into HPA-607.

Do not commit scratch notes or a second palette file.

### Step 3: Reconcile the working palette

Reduce near-duplicate candidates and choose stable kebab-case identities.

Rules:

- reuse a key only when HPA-608 should generate the same asset;
- split when generation intent materially differs;
- avoid routine micro-foley;
- start from the five live HPA-606 keys, not invented bootstrap names;
- rename/merge a bootstrap key only when the full-story read justifies it.

### Step 4: Persist the read-only audit checkpoint on Linear HPA-607

Post one concise comment containing:

- proposed SFX/BGM identities and type;
- deliberately silent sections/states;
- deferred ideas;
- any proposed bootstrap rename/merge and rationale.

This is the restart-safe human checkpoint for later batches. It is not a machine-readable second inventory and does not replace `audio-plan.json`.

---

## Authoring contract used by every batch

### Fenced audio syntax

Attach cues to the **next dialogue entry** using the existing parser contract.

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
tension-pulse
```

**朝倉澪**：兩週前。悠真收到學校轉發的通知。
````

Stop BGM:

````markdown
```bgm
stop
```

**旁白**：房間重新安靜下來。
````

Do not use `[sfx](key)`, `[bgm](key)`, or `[bgm](stop)` Markdown links. The compiler does not treat them as audio commands.

### Plan update rule

When a cue receives its **first real placement**, add its entry to:

`packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

Do not front-load future entries. Reuse the Linear checkpoint and existing plan before minting a new key.

### What each validator owns

**Compiler owns hard contract failures:**

- unknown cue key;
- cue kind mismatch;
- invalid audio fence syntax;
- other story compiler failures.

**`audio:report` owns derived usage facts:**

- cue usage count and locations;
- BGM stop locations;
- unused plan entries.

**Agent B/manual review owns semantic judgments:**

- likely aliases / duplicated meaning;
- over-cueing or micro-foley;
- BGM continuity/leakage;
- reveal/mood spoilers;
- intentional silence;
- muted readability.

Do not claim the report detects aliases or active BGM state.

### Required batch validation loop

Run this after **every** four-chapter batch before moving on:

1. Compile:

```bash
bun --filter @aquila/stories compile
```

2. Report:

```bash
bun --filter @aquila/stories audio:report theSeventhMirror
```

3. Fix any compiler failure immediately.
4. Inspect `report.unused`; remove speculative plan rows unless the same batch is about to consume them.
5. Run chapter-level **Agent B only** from `.agents/skills/reviewing-written-stories/SKILL.md` on the edited chapter group with optional audio continuity enabled. Do not spawn Agents A/C or add Agent D.
6. Re-read the edited chapters with audio conceptually muted; no plot-essential information may depend on sound.
7. Check BGM in/out at each edited chapter boundary using report locations plus the source acts:
   - identify the last authored BGM command/stop before the boundary;
   - identify the next chapter’s first authored BGM command when present;
   - confirm carry, stop, or change is intentional.
8. Consult the Linear palette checkpoint before adding any identity during fixes.

Do not add a BGM-state report, alias detector, or second inventory.

---

## Task 3: Author chapters 1–4 and settle the bootstrap

**Modify:**

- `packages/stories/raw/theSeventhMirror/chapter_1/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_2/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_3/act*.md`
- `packages/stories/raw/theSeventhMirror/chapter_4/act*.md`
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`

**Modify only if a live bootstrap key changes or a representative placeholder must move:**

- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`

### Steps

1. Re-evaluate `door-open`, `notification-beep`, `impact`, `dawn-apartment`, and `tension-pulse` against the full-story audit.
2. Keep, rename, merge, or remove them only based on actual story-wide identity needs.
3. If a bootstrap identity changes, update its placements + plan + tiny local catalog subset together.
4. Author sparse fenced cues through chapters 1–4.
5. Run the required batch validation loop.
6. If local catalogs changed, also run:

```bash
bun --filter web test
```

7. Commit:

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 1-4"
```

Omit the web path when catalogs did not change.

---

## Task 4: Author chapters 5–8

**Modify:** chapters 5–8 acts and `docs/audio-plan.json`.

### Steps

1. Author sparse fenced cues in story order.
2. Reuse established identities where generation intent matches.
3. Do not restart BGM solely because a chapter changed.
4. Run the required batch validation loop.
5. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 5-8"
```

---

## Task 5: Author chapters 9–12

**Modify:** chapters 9–12 acts and `docs/audio-plan.json`.

### Steps

1. Continue the established palette; add only genuinely new identities.
2. Avoid new BGM keys for minor tone variations that an existing sustained state can carry.
3. Run the required batch validation loop.
4. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 9-12"
```

---

## Task 6: Author chapters 13–16

**Modify:** chapters 13–16 acts and `docs/audio-plan.json`.

### Steps

1. Author the midpoint batch, preferring established motif identities.
2. Pay special attention to BGM state around the strongest midpoint transition.
3. Run the required batch validation loop.
4. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 13-16"
```

---

## Task 7: Author chapters 17–20

**Modify:** chapters 17–20 acts and `docs/audio-plan.json`.

### Steps

1. Continue the established palette.
2. Treat a sudden increase in new keys as a prompt to re-check the Linear checkpoint for aliases.
3. Run the required batch validation loop.
4. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 17-20"
```

---

## Task 8: Author chapters 21–24

**Modify:** chapters 21–24 acts and `docs/audio-plan.json`.

### Steps

1. Emphasize motif payoff and continuity rather than novelty.
2. Add new identities only when the generated asset truly needs to differ.
3. Run the required batch validation loop.
4. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 21-24"
```

---

## Task 9: Author chapters 25–28 and close the ending state

**Modify:** chapters 25–28 acts and `docs/audio-plan.json`.

### Steps

1. Resolve recurring motifs with existing identities where appropriate.
2. Check the final acts for an intentional last BGM start/change and explicit stop when the ending should return to silence.
3. Confirm no accidental carry-over survives because an earlier state was merely omitted.
4. Run the required batch validation loop.
5. Commit:

```bash
git add packages/stories/raw/theSeventhMirror
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 25-28"
```

---

## Task 10: Run representative local-reader checks

**Review/modify only when needed:**

- representative early/middle/late acts;
- representative reveal, choice, and quiet/silent beats;
- `apps/web/src/lib/audio/sfx-catalog.ts`;
- `apps/web/src/lib/audio/bgm-catalog.ts`.

### Step 1: Choose the smallest useful representative set

Cover:

- early story;
- middle story;
- late story;
- reveal;
- player choice;
- quiet/silent material.

One scene may cover multiple categories.

### Step 2: Keep the local catalog deliberately tiny

Reuse or minimally swap the placeholder subset needed to exercise representative SFX/BGM start/change/stop behavior.

Do not mirror the whole final palette into the web catalog. `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts` already enforces catalog ⊆ plan with matching type.

### Step 3: Check audio-on and muted behavior

Using the existing SFX/BGM preference controls, verify:

- cue timing feels intentional;
- BGM persists/stops correctly through representative navigation;
- quiet scenes remain quiet;
- muted mode leaves story meaning and choices understandable.

Do not generate production audio for this check.

### Step 4: If catalog mappings changed

```bash
bun --filter web test
```

Commit only useful final representative mappings.

---

## Task 11: Final palette cleanup and repository verification

### Step 1: Final audio report

```bash
bun --filter @aquila/stories audio:report theSeventhMirror
```

Final expectations:

- every used cue already passed compiler membership/type validation;
- `unused` contains no accidental speculative plan rows;
- report locations support the final manual BGM-boundary review.

Do not claim the report proves alias freedom, BGM active state, or muted readability; those were covered by Agent B/manual checks.

### Step 2: Final repository verification

```bash
bun compile:stories
bun --filter @aquila/stories test
bun run compile:check
bun run lint
bun --filter @aquila/stories audio:report theSeventhMirror
```

There is no `.agents/skills/reviewing-written-stories/scripts/audit_novel.py` on `main`; do not add or invoke one for HPA-607.

### Step 3: Final cleanup commit if needed

```bash
git add packages/stories/raw/theSeventhMirror apps/web/src/lib/audio
git commit -m "chore(story): finalize Seventh Mirror audio palette"
```

Skip when Task 9/10 already leaves the repository clean.

---

## Task 12: Post the HPA-607 completion summary

**Update:** Linear HPA-607.  
**Do not create:** another committed audit/report file.

### Step 1: Compute canonical final facts

From the final `audio-plan.json`, report:

- exact base commit from Task 1;
- chapters reviewed: 28/28;
- unique SFX identity count;
- unique BGM identity count;
- sum of `durationMs` once per unique SFX identity;
- sum of `durationMs` once per unique BGM identity;
- total summed intended generated asset duration;
- deliberately silent sections/states;
- deferred ideas.

`durationMs` is intended generated asset duration. Do not multiply looping BGM by playback time.

### Step 2: Bound candidate-generation work

Let:

- `N = unique SFX + unique BGM identities`
- `C = candidates requested per identity` when downstream policy defines it
- `R = retry allowance per identity` when defined

Record at minimum the one-candidate baseline of `N` generation requests. If HPA-608 has defined candidate/retry assumptions by execution time, record the corresponding bound/formula such as `N × C` plus the stated retry allowance.

If provider credit/pricing semantics are still unknown, state the formula and unknown assumptions rather than inventing a price.

### Step 3: Post one concise completion comment

Include the facts above plus confirmation that:

- compile/tests/compile:check/lint passed;
- `audio:report.unused` is clean or any deliberate exception is named;
- seven Agent B batch reviews completed;
- representative local-reader audio-on/muted checks completed;
- no production generation or publishing occurred.

---

## Execution notes

- Keep the work content-focused. If HPA-607 exposes a compiler/report defect, fix only the smallest defect blocking this workflow; do not pull HPA-608/HPA-609 into scope.
- Do not preserve bootstrap names for compatibility alone; there are no external users requiring aliases.
- Do not add provider/model/runtime metadata, generated audio, R2 URLs, manifests, or narration artifacts.
- Do not commit scratch audit notes or derived report snapshots.
- Keep each four-chapter batch independently compile/report/review clean so work can resume without reconstructing hidden state.
- Prefer silence, reuse, and deletion over new machinery or speculative keys.
