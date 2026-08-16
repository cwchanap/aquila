# HPA-607 Seventh Mirror Audio Audit Implementation Plan

**Goal:** Audit all 28 chapters read-only first, then author the final SFX/BGM direction using the existing fenced-block + `audio-plan.json` + compiler/report workflow, with every act self-contained for BGM when entered directly.

**Architecture:** Markdown acts own SFX placement and scene-entry BGM state. `docs/audio-plan.json` owns cue identity/generation intent. Compiler failures own hard cue validation. `audio:report` owns derived usage/unused facts. Agent B owns semantic audio review. Linear owns restart-safe human checkpoints. No second repo inventory or new audio tooling.

**Tech stack:** Markdown, JSON/Zod, TypeScript story compiler, Bun/Vitest, existing `reviewing-written-stories` Agent B.

**Design:** `docs/superpowers/specs/2026-08-14-hpa-607-seventh-mirror-audio-audit-design.md`

---

## Task 1: Capture a clean HPA-606 baseline

**Read:**

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- `packages/stories/src/compiler/parse-scene.ts`
- `packages/stories/src/compiler/cli.ts`
- `packages/stories/src/compiler/audio-usage.ts`
- `apps/web/src/lib/audio/bgm-transition.ts`
- `apps/web/src/lib/audio/bgm-player.ts`
- `.agents/skills/writing-story-acts/SKILL.md`
- `.agents/skills/reviewing-written-stories/SKILL.md`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`
- `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts`
- root `package.json`

### Step 1: Record the implementation base

```bash
git rev-parse HEAD
```

Keep the SHA for the final Linear summary. Do not create a committed audit file.

### Step 2: Confirm the live bootstrap

Starting hypotheses on `main`:

- SFX: `door-open`, `notification-beep`, `impact`
- BGM: `dawn-apartment`, `tension-pulse`

Confirm their existing placements and the matching five local placeholder mappings.

### Step 3: Verify clean generated output before content edits

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter @aquila/stories audio:report theSeventhMirror
```

Expected:

- compile-generated output already matches tracked files;
- story tests pass;
- report contains current usage plus any current `unused` rows;
- unknown/type-mismatched cues remain compiler failures, not successful report rows.

Stop and resolve baseline drift before beginning HPA-607 content work.

---

## Task 2: Perform Pass 1 as seven restart-safe read-only blocks

### Step 1: Read story-wide context once

Read:

- `packages/stories/raw/theSeventhMirror/canon/`
- `packages/stories/raw/theSeventhMirror/docs/00_high_level_plan_final.md`

Identify story-wide motifs, sustained emotional/music states, recurring locations/objects, major reveal bands, and likely intentional-silence states.

Do not edit acts.

### Step 2: Audit chapters 1–4 read-only

Read the acts in story order. Keep `chapter_1_plan.md` through `chapter_4_plan.md` available and consult relevant sections when they clarify reveal timing, recurring locations, motifs, or emotional intent. Do not require a second cover-to-cover plan read when the authored acts already make the point clear.

Track privately:

- candidate reusable SFX identities;
- intended BGM state at each act entry;
- genuine mid-act BGM changes;
- deliberate silence;
- reuse of prior identities;
- deferred ideas.

Post one short HPA-607 Linear checkpoint for chapters 1–4.

### Step 3: Repeat the same read-only checkpoint for the remaining blocks

In order:

1. chapters 5–8
2. chapters 9–12
3. chapters 13–16
4. chapters 17–20
5. chapters 21–24
6. chapters 25–28

For each block:

- read acts in order;
- consult only the relevant corresponding chapter-plan sections for context required by HPA-607;
- do not edit Markdown;
- post one concise Linear checkpoint before moving on.

These comments are the restart seam. Do not commit scratch notes or a second palette file.

### Step 4: Reconcile the complete working direction

After all seven blocks, reconcile near-duplicates and post one pre-authoring HPA-607 comment containing:

- proposed stable SFX/BGM identities and kind;
- deliberately silent states/sections;
- deferred ideas;
- proposed bootstrap rename/merge decisions with rationale.

Rules:

- reuse one key only when HPA-608 should generate the same asset;
- split only when generation intent materially differs;
- avoid routine micro-foley;
- start from the five live HPA-606 keys;
- no compatibility layer for bootstrap names with no external users.

Do not add all proposed identities to `audio-plan.json` yet. The plan grows only on first real placement.

---

## Authoring contract used by Tasks 3–9

### Fenced syntax only

SFX:

````markdown
```sfx
door-open
```

**旁白**：澪推開房門。
````

BGM key:

````markdown
```bgm
tension-pulse
```

**旁白**：時間軸上的線收緊了。
````

BGM silence:

````markdown
```bgm
stop
```

**旁白**：房間裡只剩呼吸聲。
````

Do not use `[sfx](key)` / `[bgm](key)` Markdown links.

### Scene-opening BGM invariant

Every act must declare its intended BGM state **before the first dialogue entry**:

- `bgm <planned-key>` when the act should open under music; or
- `bgm stop` when it should open silent.

Background fences may appear first, but the BGM fence must still attach to the first dialogue entry.

Re-state the same BGM key across adjacent acts when the sustained state continues. Do not mint a new key merely because an act/chapter changed. The player no-ops when the same key is already active, while the explicit opener also makes fresh loads, bookmarks, replacements, and act-panel jumps correct.

Later BGM fences within an act are only for genuine state changes.

### Plan update rule

Add an `audio-plan.json` row only when its identity receives its first real placement.

Before minting a key:

1. check the reconciled Linear palette;
2. check current `audio-plan.json`;
3. reuse an existing identity when generation intent matches.

### Validator responsibilities

**Compiler:** hard failures for unknown key, type mismatch, invalid fence/schema, or other compiler errors.

**`audio:report`:** usage counts/locations, BGM stop locations, and unused plan rows.

**Agent B/manual review:** likely aliases, scene-entry BGM intent, mid-scene continuity, over-cueing, reveal spoilers, intentional silence, and muted readability.

Do not claim `audio:report` computes active BGM state or semantic aliases.

---

## Required validation/commit loop for every four-chapter authoring batch

Run this loop in Tasks 3–9.

### 1. Compile the authored changes

```bash
bun --filter @aquila/stories compile
```

This writes tracked generated output under `packages/stories/src/generated` and may touch story scaffolding under `packages/stories/src/stories`.

### 2. Inspect the Seventh Mirror usage report

```bash
bun --filter @aquila/stories audio:report theSeventhMirror
```

- fix compiler failures before proceeding;
- remove accidental/speculative `unused` plan rows;
- use report locations for placement review, not for active-state inference.

### 3. Check the scene-opening invariant

For every act in the edited four chapters, confirm a `bgm` key or `bgm stop` attaches to the first dialogue entry.

This replaces the old cross-boundary “infer the carried state from history” exercise. The state is now explicit in each act. Agent B still judges whether the declared state is narratively correct.

### 4. Run Agent B only

Use chapter-level `reviewing-written-stories` Agent B with optional audio continuity over the edited chapter group.

Review:

- stable object/location/motif identities;
- scene-opening BGM intent;
- genuine mid-scene BGM changes;
- reveal/mood spoilers;
- selective SFX density;
- deliberate silence;
- muted readability.

Do not spawn Agents A/C and do not add Agent D.

### 5. Re-read the batch muted

No plot-essential fact, choice meaning, or required emotional logic may exist only in audio.

### 6. Run web tests when plan/catalog membership may have changed

Run when **either**:

- a plan key is renamed or removed; or
- `LOCAL_SFX_CATALOG` / `LOCAL_BGM_CATALOG` changes.

```bash
bun --filter web test
```

Adding a new plan-only key does not require this per-batch web run because catalog ⊆ plan cannot be broken by addition.

### 7. Stage canonical and generated output together

Stage the chapter directories edited in this batch (all four: substitute your chapter range), `docs/audio-plan.json` (it grows whenever a new identity is first placed), this plan file, and generated output scoped to theSeventhMirror. Do **not** stage the entire `raw/theSeventhMirror`, `src/generated`, or `src/stories` trees — that would sweep in other stories' output and chapters outside this batch.

```bash
git add \
  packages/stories/raw/theSeventhMirror/chapter_<N> \
  packages/stories/raw/theSeventhMirror/chapter_<N+1> \
  packages/stories/raw/theSeventhMirror/chapter_<N+2> \
  packages/stories/raw/theSeventhMirror/chapter_<N+3> \
  packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  docs/superpowers/plans/2026-08-14-hpa-607-seventh-mirror-audio-audit.md \
  packages/stories/src/generated/theSeventhMirror \
  packages/stories/src/stories/theSeventhMirror
```

`git add` on a directory only stages files with changes inside it, so the two theSeventhMirror-scoped paths pick up just what `bun compile:stories` produced this batch. `audio-plan.json` is staged unconditionally because any batch may mint a new identity on first placement; if it did not change, `git add` is a no-op.

If local catalogs changed, also stage the two catalog files only — not the entire `apps/web/src/lib/audio` directory, which would sweep in players, transitions, and preferences unrelated to this batch:

```bash
git add apps/web/src/lib/audio/sfx-catalog.ts apps/web/src/lib/audio/bgm-catalog.ts
```

If a catalog file has mixed changes (some belonging to this batch, some not), use `git add -p apps/web/src/lib/audio/sfx-catalog.ts` (or `bgm-catalog.ts`) to stage only the relevant hunks. As with `audio-plan.json` above, `git add` on an unchanged catalog file is a no-op, so staging both unconditionally is safe.

Before committing, verify the staged file list contains only this batch's four chapters, `audio-plan.json`, the plan file, theSeventhMirror generated output, and (if applicable) the two catalog files `sfx-catalog.ts` / `bgm-catalog.ts` — nothing from other stories, chapters outside this batch, or other files in `apps/web/src/lib/audio`:

```bash
git diff --cached --name-only
```

Confirm that `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` appears in the output whenever a new cue identity was placed in this batch.

### 8. Verify the staged generated output is reproducible

Run **after staging** the expected generated changes:

```bash
bun run compile:check
```

`compile:check` recompiles and uses `git diff` against the index. If compilation produces anything different from the staged generated/story output, it fails. Running this before staging legitimate generated changes would produce a false failure.

### 9. Commit the self-consistent batch

Use the task-specific commit message below.

---

## Task 3: Author chapters 1–4 and settle the bootstrap

**Modify:** chapter 1–4 acts and `docs/audio-plan.json`.

**Modify only if required:** local SFX/BGM catalogs.

Steps:

1. Re-evaluate `door-open`, `notification-beep`, `impact`, `dawn-apartment`, and `tension-pulse` against the complete Pass-1 audit.
2. If a bootstrap identity changes, update its placements + plan + tiny local catalog subset together.
3. Add the explicit scene-entry BGM declaration to every act in chapters 1–4.
4. Add sparse SFX and genuine mid-act BGM changes.
5. Run the required validation/commit loop.
6. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 1-4"
```

---

## Task 4: Author chapters 5–8

1. Add explicit scene-entry BGM state to every act.
2. Reuse established identities where generation intent matches.
3. Add sparse SFX / genuine mid-act BGM changes only.
4. Run the required validation/commit loop.
5. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 5-8"
```

---

## Task 5: Author chapters 9–12

1. Continue the established palette; avoid new BGM identities for minor tone variants.
2. Add explicit scene-entry BGM state to every act.
3. Run the required validation/commit loop.
4. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 9-12"
```

---

## Task 6: Author chapters 13–16

1. Prefer established motif identities through the midpoint.
2. Make each act’s opening state explicit; use later fences only for genuine changes.
3. Run the required validation/commit loop.
4. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 13-16"
```

---

## Task 7: Author chapters 17–20

1. Continue the established palette.
2. Treat a sudden increase in new keys as a prompt to re-check the Linear palette for aliases.
3. Add explicit scene-entry BGM state to every act.
4. Run the required validation/commit loop.
5. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 17-20"
```

---

## Task 8: Author chapters 21–24

1. Favor motif payoff/reuse over novelty.
2. Add a new identity only when the generated asset truly needs to differ.
3. Add explicit scene-entry BGM state to every act.
4. Run the required validation/commit loop.
5. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 21-24"
```

---

## Task 9: Author chapters 25–28 and close the ending state

1. Resolve recurring motifs with existing identities where appropriate.
2. Give every final act an explicit opening key or `stop`.
3. Use explicit `stop` at the ending only when the intended final state is silence.
4. Run the required validation/commit loop.
5. Commit:

```bash
git commit -m "feat(story): author Seventh Mirror audio cues for chapters 25-28"
```

---

## Task 10: Run representative local-reader checks

Cover at minimum:

- early story;
- middle story;
- late story;
- reveal;
- player choice;
- quiet/silent material.

One scene may cover multiple categories.

### Step 1: Keep placeholder playback bounded

Reuse or minimally swap the existing tiny local placeholder subset. Do not mirror the final plan into the web catalogs.

Every local catalog key must remain in `audio-plan.json` with the matching type.

### Step 2: Establish the runtime preconditions before judging audio

For the audio-on pass:

1. switch the reader to **visual mode**;
2. enable SFX and BGM preferences;
3. perform one normal reader progression click/keypress to satisfy BGM activation;
4. then navigate/evaluate the representative scenes.

Text mode suppresses audio by design. A visual asset `fallback` / `unavailable` status is not itself an audio blocker, so missing production visual assets do not invalidate this HPA-607 audio check.

### Step 3: Verify behavior

Check:

- scene-entry BGM is correct when entering directly and through normal progression;
- re-stating the same sustained key does not audibly restart it;
- genuine changes/stops occur at intended lines;
- SFX timing is selective and meaningful;
- quiet scenes remain quiet.

Then disable audio and confirm story meaning/choices remain understandable.

### Step 4: If representative catalog mappings changed

```bash
bun --filter web test
```

Stage/commit only useful final placeholder changes.

---

## Task 11: Final repository verification

Start from the committed Task 9/10 state with a clean working tree.

### Step 1: Final report

```bash
bun --filter @aquila/stories audio:report theSeventhMirror
```

Expect:

- every used cue already passed compiler membership/type validation;
- no accidental `unused` plan rows;
- report locations agree with final authored placements.

Do not claim the report proves alias freedom, scene-entry intent, or muted readability; those are Agent B/manual results.

### Step 2: Final repository verification

```bash
bun compile:stories
bun --filter @aquila/stories test
bun --filter web test
bun run compile:check
bun run lint
bun --filter @aquila/stories audio:report theSeventhMirror
```

The final web test is unconditional because `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts` is the guard for local catalog ⊆ final plan.

### Step 3: Confirm no generated drift was left behind

```bash
git status --short
```

Expected: clean working tree. If compilation generated legitimate drift, fix/stage/commit it before calling HPA-607 complete.

---

## Task 12: Compute canonical generation scope and post the completion summary

**Update:** Linear HPA-607.  
**Do not create:** a committed report/palette file.

### Step 1: Compute counts and intended generated duration from `audio-plan.json`

Do not scrape the Bun workspace-filtered `audio:report` output for these numbers. `audio-plan.json` is the canonical identity/duration source and every asset has required `durationMs`.

Use the already-required Bun runtime:

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

If machine-readable usage-report JSON is needed for a separate reason, invoke the compiler CLI directly from `packages/stories` rather than scraping prefixed workspace output. HPA-607 does not need report JSON for identity/duration arithmetic.

### Step 2: Bound generation requests/credits

Let:

- `N = unique SFX + unique BGM identities`
- `C = candidates requested per identity` if HPA-608 has defined it
- `R = retry allowance` if defined

Record at minimum the one-candidate baseline of `N` requests. If downstream candidate/retry assumptions exist by execution time, report the corresponding formula/bound. If provider credit/pricing semantics remain unknown, state the unknowns instead of inventing a price.

### Step 3: Post one completion comment to HPA-607

Include:

- base commit;
- chapters reviewed: 28/28;
- unique SFX count;
- unique BGM count;
- SFX/BGM/total intended duration;
- deliberately silent states/sections;
- deferred ideas;
- generation request/credit bound or formula;
- confirmation that all seven authoring batches received Agent B audio review;
- confirmation that every act has an explicit scene-entry BGM state;
- final verification results.

Do not call ElevenLabs.

---

## Execution discipline

- Do not edit acts during Pass 1.
- Do not commit scratch audit notes or derived report snapshots.
- Keep chapter-plan documents as targeted context, not a mandatory redundant second prose pass.
- Grow `audio-plan.json` only on first real placement.
- Every act explicitly declares its BGM state at entry; sustained state is expressed by repeating the same key, not by relying on navigation history.
- Keep SFX sparse and motif/meaning driven.
- Keep local catalogs tiny.
- Stage tracked generated/story output with every raw authoring batch before `compile:check`.
- Run web tests on plan key rename/removal or catalog edits, and always in final verification.
- Prefer reuse, silence, and deletion over new machinery or speculative keys.
