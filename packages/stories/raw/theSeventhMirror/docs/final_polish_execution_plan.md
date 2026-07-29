# 《神鏡七日》Final Polish — Execution Plan

> **Spec:** `docs/final_polish.md` (the "what" and "why")
> **This document:** the "how, where, order, who" — adapted to the **actual** repo state
> **Authority rule:** when a chapter plan doc and its prose disagree, **the plan doc wins**; prose is edited to match. When prose contains a good detail the plan lacks, the plan is updated first (Phase 0.5), then prose follows.
> **Execution model:** subagent dispatch (orchestrating-stories workflow). Each task names its subagent type, required skill, and inputs.

---

## 0. Goal & Architecture

**Goal:** Lock canon for all 28 chapters, retrofit foreshadowing, resolve P0 contradictions, and bring the **already-written prose** (215 acts, ~30k lines) into full consistency — producing a Final Lock manifest that gates prose-draft readiness (retroactively, since prose exists).

**Architecture:** Plan-doc-first editing. Every fix lands in `docs/chapter_N_plan.md` (canon source) before any prose act is touched. The 7 Canonical Bibles are extracted from the locked plan corpus. Prose edits are batched (A–G) and run only after the Canon Lock gate. All raw markdown edits flow through `bun compile:stories` to regenerate `src/generated/theSeventhMirror/`.

**Stack:** Bun runtime, `@aquila/stories` compiler (`bun compile:stories`, `bun run compile:check`), Chinese markdown act files, git-tracked generated output.

---

## 1. Global Constraints (apply to every task)

- **Story ID:** `the_seventh_mirror` (from `compiler.config.ts`)
- **Raw root:** `packages/stories/raw/theSeventhMirror/`
- **Generated root:** `packages/stories/src/generated/theSeventhMirror/`
- **No new chapters.** 28 is fixed. No Chapter 29.
- **No new major lore** (no new mastermind, patient group, science root, facility, time-loop, or ending key) — per final_polish.md §1.6 and Bible 7 "不能再增加".
- **Final sentence is locked** (final_polish.md §1.1):
  > 收音機裡沒有倒數。
  > 只有一個必須用七十年走到的座標。
  > **未來第一次留在前面。**
- **Chinese only in act/plan files.** Traditional Chinese (繁體) is the house standard (matches existing prose).
- **Every prose edit → recompile.** Run `bun compile:stories` after any `act*.md` change; `bun run compile:check` must pass before commit.
- **Changelog discipline.** Every cross-chapter edit gets an entry in `final-polish/CHANGELOG_FINAL_POLISH.md` (reason, affected chapters, canon-changed? Y/N, re-audit needed? Y/N).
- **Plan-doc edits do NOT trigger recompile** (plan docs aren't compiled); only `act*.md` and `docs/characters.md` do.

---

## 2. Current State Snapshot (audit performed <today>)

| Artifact | State | Notes |
|---|---|---|
| Prose acts ch1–28 | ✅ Written (215 files, ~30,774 lines) | Pre-polish; sequential commits, ch28 latest |
| `docs/chapter_N_plan.md` ×28 | ✅ Exist | Source-of-truth for canon; need P0 patches |
| `docs/characters.md` | ✅ Exists (66.9K) | Verify 白石琴音/藤川美空 naming after Task 5 |
| `docs/high-level-plan.md` | ⚠️ OLD | Contradicts polish doc (see Phase 3); rewrite → `00_high_level_plan_final.md` |
| `docs/final_polish.md` | ✅ Exists (untracked) | The spec; commit it in Phase 0 |
| `final-polish/` (manifest, changelog) | ❌ Missing | Create in Phase 0 |
| `canon/` (7 bibles) | ❌ Missing | Build in Phase 4 |
| `review/` (3 docs) | ❌ Missing | Build across Phases 6–11 |
| `archive/` (old versions) | ❌ Missing | Populate as old plans are superseded |
| Generated TS | ✅ In sync | Recompile after every prose edit |

**P0 contradiction scan (representative):**
- `帶上鏡子` — still in `chapter_1/act6.md` + 6 plan docs (Task 1, unfixed)
- `這一輪`/`上一輪` — across ch5–8,17,18,21,23,28 prose (Task 2; **per-instance** — 澪 legitimately uses loop language, only Kotone's are P0)
- `藤川琴音` — in `chapter_22_plan.md` only (Task 5, prose clean)
- `悠真手機相簿` — in `chapter_12_plan.md`, `chapter_17_plan.md` (Task 3)
- `日下部完整記得` — in `chapter_17_plan.md` (Task 4)
- Ch1 has **zero** of Task 8's foreshadow seeds (短波/接收器/收音機/北海道/靜電 = 0 hits)

---

## 3. Execution Model — Subagent Dispatch

The main agent (you/the orchestrator) **plans, dispatches, reviews, and runs gates**. Subagents do the editing and reviewing.

### Subagent types

| Type | Purpose | Required skill | Context window guidance |
|---|---|---|---|
| **Edit subagent** | Edit plan doc + prose acts for a task | `writing-story-acts` | 1–2 chapters per dispatch |
| **Review subagent** | Verify a batch against canon/gates | `reviewing-written-stories` | 1 batch (4 chapters) per dispatch |
| **Canon subagent** | Extract one Bible from locked corpus | (none — uses spec section) | One Bible per dispatch |
| **Audit subagent** | Run one Phase 6 audit | (none — uses audit spec) | Whole-story read |
| **Red-team subagent** | One reader-perspective pass | (none — uses reader persona) | Whole-story read |

### Dispatch protocol (every task)

1. **Pre-check:** confirm prerequisite gate passed; confirm target files exist.
2. **Dispatch:** send the subagent prompt (task spec + file list + skill to load + preceding-context files to read).
3. **Collect:** subagent returns files-written summary + deviations + characters-needing-added.
4. **Verify locally:** run the task's verification commands (keyword scan, compile, compile:check).
5. **Changelog:** append entry to `final-polish/CHANGELOG_FINAL_POLISH.md`.
6. **Gate check (if task is gate-adjacent):** run gate criteria before next phase.

### Subagent prompt template

```
You are editing 《神鏡七日》 (theSeventhMirror). Load the writing-story-acts skill first.

TASK: <task name and final_polish.md task number>
AUTHORITY: plan-doc wins. Edit docs/chapter_N_plan.md FIRST, then edit the prose acts to match.
DO NOT: <explicit prohibitions from the spec — e.g., "do not let Kotone say 上一輪">

READ FIRST (in order):
  - docs/final_polish.md <section>           # the spec
  - docs/chapter_<N>_plan.md                  # current canon
  - chapter_<N>/act<k>.md                     # current prose (relevant acts only)
  - docs/characters.md                        # if any character is touched

EDIT:
  - docs/chapter_<N>_plan.md: <specific change with verbatim before/after>
  - chapter_<N>/act<k>.md: <specific change>

VERIFY (you run): rg "<keyword>" chapter_<N>/ docs/chapter_<N>_plan.md
REPORT BACK: files changed, any character additions needed, any deviation from spec (with reason).
```

---

## 4. Phase 0 — Source Freeze

**Gate:** Gate 0 — each chapter's latest source is unambiguous.

### Task 0.1 — Commit the spec & scaffold workspace
- **Files (create):** `final-polish/source_manifest.md`, `final-polish/CHANGELOG_FINAL_POLISH.md`
- **Files (commit):** `docs/final_polish.md` (currently untracked)
- [ ] Create `final-polish/source_manifest.md` listing, per chapter (1–28): latest plan doc path, latest act dir path, version tag (all current = "v_current"; ch23–28 pin "v2.2-target" pending Phase 1 confirmation).
- [ ] Create `final-polish/CHANGELOG_FINAL_POLISH.md` with the header template (columns: date, task, reason, chapters touched, canon-changed, re-audit needed).
- [ ] `git add docs/final_polish.md final-polish/ && git commit -m "docs(seventh-mirror): add final polish spec + scaffold source manifest"`

### Task 0.2 — Populate archive list
- **Files (create):** `final-polish/archive_list.md`
- [ ] List every superseded file to move to `archive/` once its `_final` replacement exists (populated incrementally through Phases 3 and 5). Empty for now; just the schema.

### Task 0.3 — Phase 0.5 reconciliation pass (NEW — because prose exists)
- **Dispatch:** 1 review subagent per batch of 4 chapters (7 dispatches), using `reviewing-written-stories` skill.
- **Input per subagent:** chapters N–N+3 plan docs + all their acts.
- **Output:** for each chapter, a diff report: (a) plan says X, prose says Y; (b) prose has detail Z that plan lacks. Save to `final-polish/reconcile/chapter_<N>.md`.
- **Decision rule:** discrepancies feed forward into Phase 1 (P0) or Phase 5 (P1/P2); prose-only good details get folded into the plan during the relevant Phase 1/2 task.
- [ ] Dispatch 7 reconciliation subagents (ch1–4, 5–8, 9–12, 13–16, 17–20, 21–24, 25–28) in parallel.
- [ ] Consolidate into `final-polish/reconcile/_summary.md` ranked by phase.

**Gate 0:** For every chapter 1–28, `source_manifest.md` names exactly one latest plan doc and one latest act dir. ✅ required to enter Phase 1.

---

## 5. Phase 1 — P0 Contradiction Patches (Tasks 1–7)

**Rule:** edit the plan doc first, then propagate to prose. Each task ends with a keyword-scan verification.

### Task 1 — Ch1 anonymous message (final_polish.md Task 1)
- **Plan files:** `docs/chapter_1_plan.md`
- **Prose files:** `chapter_1/act6.md` (1 hit) — and audit ch2 delivery recognition
- **Edit:** `帶上鏡子。不要報警。` → `帶上悠真留下的那件東西。不要報警。` Remove any narrator framing that the anonymous sender knows the object is a mirror.
- **Dispatch:** 1 edit subagent (ch1–ch2 only).
- **Verify:**
  - [ ] `rg "帶上鏡子" chapter_1/ chapter_2/ docs/chapter_1_plan.md docs/chapter_2_plan.md` → 0 hits
  - [ ] Ch2 still recognizes the delivered object (re-read `chapter_2/act1.md`)
- [ ] Changelog entry.

### Task 2 — Kotone's Monday green-tea / loop-testing (final_polish.md Task 2)
- **⚠️ Per-instance, not blanket.** Only **Kotone's** `這一輪`/`上一輪` are P0. 澪 (full memory), 日下部 (fragments), and the ch28 epilogue narrator **legitimately** use loop language.
- **Plan files:** `docs/chapter_1_plan.md`, `docs/chapter_23_plan.md` (Task 2 requires ch1↔ch23 consistency)
- **Prose files (scan results to triage):** `chapter_5/{act6,act8}.md`, `chapter_6/{act3,act6,act8}.md`, `chapter_7/{act1,act3}.md`, `chapter_8/{act1,act5,act6}.md` (early-loop hits likely Kotone or 澪), plus ch17/18/21/23/28.
- **Edit spec:**
  - Delete "Kotone testing whether she entered a new loop" framing.
  - Replace with low-intensity familiarity ritual (unconscious confirmation); Kotone herself must not know the behavior's source.
  - No Kotone line may imply `上一輪` / `這一輪` / "清醒測試".
- **Dispatch:** 2 edit subagents in parallel — (a) ch1+ch23 plan/prose (Kotone ritual); (b) ch5–8 triage pass (classify each hit as Kotone-P0 vs. legitimate, fix only Kotone's).
- **Verify:**
  - [ ] `rg -n "這一輪|上一輪" chapter_*/act*.md` — every remaining hit is attributable to 澪, 日下部, or epilogue narrator (document the attribution in `review/01_chapter_regression_checklist.md`).
- [ ] Changelog entry (canon-changed: Y).

### Task 3 — Yūma screenshot source (final_polish.md Task 3)
- **Plan files:** `docs/chapter_9_plan.md`, `docs/chapter_12_plan.md`, `docs/chapter_17_plan.md`
- **Prose files:** scan ch9, ch12, ch17 acts for `手機相簿` / `相簿`
- **Edit:** `悠真手機相簿` → `家庭共享雲端／家中平板自動同步備份`. Yūma's physical phone still travels with him; screenshots predate disappearance. Ch9 backs up (don't read all small print yet); Ch12 completes source+meaning inference; Ch17 third loop re-fetches the same family backup quickly.
- **Dispatch:** 1 edit subagent (ch9, ch12, ch17 — three small edits, one context).
- **Verify:**
  - [ ] `rg "悠真手機相簿|手機相簿" docs/ chapter_*/act*.md` → 0 hits outside `archive/`
- [ ] Changelog entry.

### Task 4 — Kusakabe memory tier (final_polish.md Task 4)
- **Plan files:** `docs/chapter_17_plan.md` (2 hits), `docs/high-level-plan.md` (but HLP is rewritten in Phase 3 — flag, don't fix here)
- **Prose files:** scan ch17, ch21–27 acts for Kusakabe stating cross-loop details only 澪 could know
- **Edit:** keep language/direction/danger/black-sea/short-phrase fragments. Delete any "完整記得第二輪". Any retained instance must be framed as "不能成立／錯誤推論". Ch21–27 Kusakabe must not state cross-loop details only 澪 knows.
- **Dispatch:** 1 edit subagent (ch17 + audit ch21–27 Kusakabe lines).
- **Verify:**
  - [ ] `rg "日下部完整記得|完整記得第二輪" docs/ chapter_*/act*.md` → 0 hits outside marked "錯誤推論" passages
  - [ ] Random-sample 3 Kusakabe lines in ch21–27; each can name its information source.
- [ ] Changelog entry.

### Task 5 — Kotone surname (final_polish.md Task 5)
- **Plan files:** `docs/chapter_22_plan.md` (1 hit), `docs/characters.md`
- **Prose files:** scan all acts for `藤川琴音` (prose scan came back clean — verify)
- **Edit:** lock `白石琴音` (Kotone), `藤川美空` (Misora). Half-sisters (同母異父). Remove `藤川琴音`. Family/registrar detail only needs to explain the different surnames — no new family mystery.
- **Dispatch:** 1 edit subagent (ch22 plan + characters.md; spot-check prose).
- **Verify:**
  - [ ] `rg "藤川琴音" docs/ chapter_*/act*.md` → 0 hits outside `archive/`
  - [ ] `rg "白石琴音" docs/characters.md` → present
- [ ] Changelog entry.

### Task 6 — Ch6/7 time handoff (final_polish.md Task 6)
- **Plan files:** `docs/chapter_6_plan.md`, `docs/chapter_7_plan.md`
- **Prose files:** `chapter_6/act*.md`, `chapter_7/act*.md`
- **Edit:** ch6 ends 22:18 (Kotone's message is ch6's final hook); ch6 initial questioning 21:40–22:18; ch7 opens at 22:18 reading the message, continues to hospital thread; remove the duplicated 22:20–22:45 scene across both chapters.
- **Dispatch:** 1 edit subagent (ch6 + ch7 together — single time-handoff context).
- **Verify:**
  - [ ] Adjacent-chapter time intervals don't overlap and no scene is told twice.
  - [ ] `rg -n "22:(2[0-9]|3[0-9]|4[0-5])" chapter_6/ chapter_7/` — review each hit for the duplicate-scene rule.
- [ ] Changelog entry.

### Task 7 — Chida testimony boundary (final_polish.md Task 7)
- **Plan files:** `docs/chapter_28_plan.md` + any hearing-summary docs
- **Prose files:** `chapter_28/act*.md`
- **Edit:** Chida MAY say: silver shell ≠ weapon; train footage has interpolation/time discontinuity; R3 handoff was construction corridor; R3 work orders/access/route point to construction corridor; official train version insufficient evidentiary force; his own R2 responsibility. Chida MAY NOT say: prior loops' stabbing definitely happened in construction corridor; what Kotone actually did in prior loops; 澪's cross-loop memory is objectively proven.
- **Dispatch:** 1 edit subagent (ch28 only).
- **Verify:**
  - [ ] Every Chida line in `chapter_28/act*.md` classifies into MAY/MAY-NOT — document in `review/01_chapter_regression_checklist.md`.
- [ ] Changelog entry.

### Phase 1 Gate (Gate 1) — keyword scan
- [ ] Run: `rg "帶上鏡子|這一輪|上一輪|藤川琴音|悠真手機相簿|日下部完整記得|千田證明前輪" docs/ chapter_*/act*.md`
- [ ] Result must be **0**, or only inside passages explicitly marked `舊設定／錯誤推論`.
- [ ] `bun compile:stories` succeeds; `bun run compile:check` passes.
- [ ] Commit gate: `git commit -m "feat(seventh-mirror): apply Phase 1 P0 contradiction patches"`

---

## 6. Phase 2 — Foreshadowing Retrofit (Tasks 8–16)

**Rule:** seed into plan docs first, then edit prose. Principle: low-intensity, ordinary-explanation-first, no early answer exposure.

### Task 8 — Ch1 family & object foreshadow (final_polish.md Task 8)
- **Plan/prose:** `docs/chapter_1_plan.md`, `chapter_1/act*.md`
- **Add:** Kotone's fixed hospital visit/call (no sister name yet); mother's modified shortwave receiver (looks like ordinary old thing — no ending hint); Sae EEG/sleep-research intro book; Hokkaido research-group photo; family habit "夢要先寫日期"; Yūma's everyday reaction to radio static.
- **Constraint:** Ch1 must remain primarily a disappearance/train suspense — no settings exhibition.
- **Dispatch:** 1 edit subagent (ch1 only — many small insertions, one context).
- **Verify:** the Phase 0 keyword scan items now ≥1 each in ch1: `短波`, `接收器`, `收音機`, `北海道`, `靜電`, `夢要先寫日期`.

### Task 9 — Ch5 uncontaminated shell sketch (final_polish.md Task 9)
- **Plan/prose:** `docs/chapter_5_plan.md`, `chapter_5/act*.md`
- **Add:** a sketch block — `第一輪記憶草圖 / 建立時間：第二輪早期 / 來源：澪記憶 / 污染狀態：未接觸同類硬體照片`. Records size, dual clips, slim indicator window. Keeps uncertain lines and `?`. Does NOT write `卡匣` or `HSM`. Ch15 later compares it to real hardware. Prevents reader thinking 澪 reverse-edited memory after seeing the device.
- **Dispatch:** 1 edit subagent (ch5).

### Task 10 — Ch9/10 radio & tone sequence (final_polish.md Task 10)
- **Add:** Yūma once recorded the old receiver's regular static; one line only: `「不像語音，像座標在唱。」` Don't let Yūma solve the star map; don't connect to alien answer; ordinary explanation = teen audio experiment or sleep background sound.
- **Dispatch:** 1 edit subagent (ch9 + ch10).

### Task 11 — Seven-second & peak metadata, layered (final_polish.md Task 11)
- **Ch14:** only reveal public marker vs official-app push differ by ~7s; confirm it's server-side path, not screen-wake difference.
- **Ch21/25/26:** progressively add `ECHO PEAK 06:13:00 / ORDINARY BROADCAST MARKER PEAK-7000ms / APP FOLLOW-UP SEND MARKER+7000ms / CENTRAL FANOUT GATEWAY REQUIRED`.
- **Ch27:** pays off the precise cancellation.
- **Constraint:** Ch14 characters must not know `06:12:53` early.
- **Dispatch:** 1 edit subagent per chapter (ch14, ch21, ch25, ch26, ch27) — 5 dispatches, parallelizable in 2 waves (ch14+ch21 first, then ch25+ch26+ch27 once ch21 anchors the schema).

### Task 12 — 23:50, BCP, MAR-CONT (final_polish.md Task 12)
- **Retrofit:** ch15, ch21, ch24. `BCP CUTOVER 23:50 / PREPOSITION WINDOW 23:50–05:50 / MAR-CONT PROTECTIVE TRANSFER CLASS`. Ordinary explanations: disaster recovery, bayfront continuity transport, key personnel/equipment sea transfer. Must NOT hint: father on this path, C2 relocation, S7 lease.
- **Dispatch:** 1 edit subagent (ch15, ch21, ch24).

### Task 13 — Ch20 technical lineage (final_polish.md Task 13)
- **Add:** M-00 Digital Backup module (`PHYSIOLOGICAL PHASE CONTROL / ECHO SUPPRESSION / SEMANTIC INTERPRETATION / FUTURE CLASSIFICATION / PUBLIC CONSENSUS INTERFACE`); Independent Analog Monitor (modified wideband receiver, out-of-band comparison, later returned to family, no patient data/keys/control); K-01/KAGAMI lineage (early execution-anchor and local-clinical-check fields, incomplete ending-function explanation); Witness/after-action lineage (clinical after-action markers, regional audit receiver, low-freq sideband, no raw neural).
- **Dispatch:** 1 edit subagent (ch20 — dense, single context).

### Task 14 — Ch21 COMMIT-GATE (final_polish.md Task 14)
- **Add:** `SUBJECT DEPENDENCY ATTESTATION / CLINICAL HOLD / BRANCH ISOLATION STATUS / EXECUTION ANCHOR／KAGAMI-01 / REGIONAL PACKAGE／PREPOSITION ONLY / SUBJECT SNAPSHOT EPOCH / DEPENDENCY SNAPSHOT HASH / CLINICAL TOPOLOGY HASH`. Ch21 only needs readers to understand: *regional package preposition ≠ executable; Kagashima still must confirm clinical side.* Must NOT reveal: S42/S43, Subject Bay, managed-equivalent swap, specific latch solution.
- **Dispatch:** 1 edit subagent (ch21).

### Task 15 — Fixed eight-patient matrix (final_polish.md Task 15)
- **Ch22:** add `TOTAL HUMAN RECORDS 9 / SAFE-DETACHED 1 (G07-12, Yūma) / ACTIVE HUMAN DEPENDENCIES 8 / CRITICAL RED-ZONE 4 / OTHER ACTIVE 4`.
- **Ch24:** anonymous prep matrix `G07/05 STAGE-1/ROOT READY / LEGACY/04 STAGE-1/ROOT READY / ACTIVE/C STAGE-0/COMPARE ONLY / ACTIVE/D LOCAL ROOT PENDING/HOLD`.
- **Ch26:** add `G07/05` (16yo, prior assent, proxy/rights), `LEGACY/04` (adult, limited self-consent), `ACTIVE/C` & `ACTIVE/D` ceilings, physical endpoints = 8, unmapped heartbeat = 0.
- **Acceptance:** ch27 must not suddenly produce two conveniently-successful patients.
- **Dispatch:** 3 edit subagents (ch22, ch24, ch26 — one each, parallel).

### Task 16 — Ch25/26 authorization & Subject Bay lineage (final_polish.md Task 16)
- **Retrofit:** seven trust domains; non-exportable science authorization capsules; S7 snapshot-before-queue low-intensity old doc; Science HSM / Operational HSM separation; Subject Bay mounts only after cutover lease loads; package preposition triggers court patient-safety disclosure; execution anchor waits for KAGAMI; Witness Sideband sends only keys/IDs/roots.
- **Dispatch:** 1 edit subagent (ch25 + ch26).

### Phase 2 Gate (Gate 2) — foreshadow fairness test
- **Dispatch:** 1 review subagent per ending mechanism, answering: first-appears-which-chapter / ordinary-explanation-then / first-anomaly-shown / full-payoff. Any mechanism answering "ch26/27 first appears" = FAIL.
- [ ] Consolidate into `review/foreshadow_fairness_matrix.md`.
- [ ] `bun run compile:check` passes.
- [ ] Commit: `feat(seventh-mirror): apply Phase 2 foreshadowing retrofits`

---

## 7. Phase 3 — High-Level Plan Rewrite

**Goal:** replace the old `high-level-plan.md` with `00_high_level_plan_final.md` as the formal entry point.

- **Create:** `docs/00_high_level_plan_final.md`
- **Archive:** move `docs/high-level-plan.md` → `archive/high-level-plan_v1_superseded.md`

### Mandatory corrections (per final_polish.md §7.1–7.8)
- [ ] **§7.1 七大段:** seven cognitive/investigation stages, not seven natural days; list three loops explicitly.
- [ ] **§7.2 琴音:** low-intensity familiarity; doesn't know loop count; prior-loop violence exists only in author truth; R3 legal handling covers only current-loop-provable acts.
- [ ] **§7.3 日下部:** memory fragments; incomplete retention; cannot state full second loop.
- [ ] **§7.4 R4:** reframe as a possible-future 澪 extended from R3; not a fixed past loop's complete version; a failure-mode warning.
- [ ] **§7.5 外星訊號:** "warning" is a high-confidence human interpretation; alien intent unknown; 70-year window is probable/not-proven; no "aliens endorse humanity".
- [ ] **§7.6 TOKYO-7:** current-loop execution scope is the Tokyo reference deployment; international context is tech/data/future template; not "this loop = instant global unified memory".
- [ ] **§7.7 第七日終局:** no artificial-isle destruction; no protective-filter shutdown; patients reach different stages; Witness is opt-in digital release; sensory echo is uncontrollable; Yūma safe-detached; Kotone opens patient-status layer, not a physical child ward.
- [ ] **§7.8 章名承諾:** keep literary titles; each chapter may have a one-line epigraph. **Delete** "all chapter titles are government-deleted sentences".

**Dispatch:** 1 edit subagent (single coherent document — do not parallelize). Read old HLP + final_polish.md §7 + Phase 1/2 changelog as inputs.

**Gate 3:** every setting sentence in `00_high_level_plan_final.md` has a consistent version in either a chapter plan or a Canon Bible. Cross-check performed by 1 review subagent.

---

## 8. Phase 4 — Seven Canonical Bibles

**Gate:** Gate 4 — Bibles are mutually consistent before any broad prose edit.

Build `canon/01`–`canon/07`. **One canon subagent per Bible**, parallelizable. Each subagent reads: the locked chapter plans (post-Phase 1/2), `00_high_level_plan_final.md`, and `docs/characters.md`. Output is **facts only** — no thematic commentary.

| Bible | File | Source spec | Key content |
|---|---|---|---|
| 1 | `canon/01_master_timeline.md` | final_polish.md §8 Bible 1 | 3 loops × every day; per-chapter start/end times; key timestamps 21:04, 22:18, 23:50, 05:50, 06:12:53, 06:13, 06:20; erased-loop events; R3 physical events; ch28 three time-layers |
| 2 | `canon/02_character_knowledge_matrix.md` | §8 Bible 2 | Per-chapter matrix (已知/推測/錯誤相信/不能知道) for 澪,悠真,紗英,琴音,日下部,千田,凪原,真理,佳乃 |
| 3 | `canon/03_evidence_ledger.md` | §8 Bible 3 | Every evidence item tagged CURRENT-LOOP PHYSICAL/DOCUMENT/TESTIMONY, CROSS-LOOP MEMORY, AUTHOR TRUTH, PUBLIC, SEALED, SUBJECTIVE. Cover shell, 7th-car footage, construction corridor, Kotone, cartridge, R4, R5, father, Witness fragments, white-light report, 70-year signal |
| 4 | `canon/04_system_medical_rules.md` | §8 Bible 4 | memory-only loop, M-00, G07, Domain-P/C, patient-bound root, R1–R5, SHARE-S/O/CONT, capsule/lease, Subject Bay/latch, execution anchor, seven-stage schedule, control quiet window, SAFE PAUSE, Witness Path, app seven-second path, consent/expiry/taper, new-signal quarantine |
| 5 | `canon/05_clue_foreshadowing_map.md` | §8 Bible 5 | Per-clue: SEED CHAPTER / ORDINARY EXPLANATION / SECONDARY PAYOFF / FINAL PAYOFF / MISDIRECTION RISK. Groups: train case, Kotone, Yūma/G07, mother/M-00, TOKYO/seven-seconds, R1–R5, continuity, Witness, radio/70-years |
| 6 | `canon/06_terminology_style_guide.md` | §8 Bible 6 | Locked names (白石琴音, 藤川美空, 朝倉紗英, 朝倉悠真, 朝倉澪, 日下部悟, 千田浩介, 凪原唯); first-occurrence human-language explanation per term; one concept ≠ three undefined names; rule: first=中文+system-field, body=中文 first, terminals=English field, characters never speak author-tier abbreviations |
| 7 | `canon/07_open_mysteries_and_final_answers.md` | §8 Bible 7 | Three classes: fully-answered / intentionally-open / forbidden-to-add |

**Gate 4 verification:**
- [ ] 1 review subagent cross-checks all 7 Bibles for conflicts; report must be conflict-free.
- [ ] Commit: `feat(seventh-mirror): build seven Canonical Bibles`

---

## 9. ★ Canon Lock Gate

Before any broad prose edit (Phase 5), canon must be self-consistent. Confirm:

- [ ] Gate 1 passed (P0 keyword scan clean).
- [ ] Gate 2 passed (foreshadow fairness).
- [ ] Gate 3 passed (HLP ↔ plans/Bibles).
- [ ] Gate 4 passed (Bibles mutually consistent).
- [ ] `00_high_level_plan_final.md`, all 28 `chapter_N_plan.md`, and all 7 Bibles committed.
- [ ] `final-polish/CANON_LOCK.md` written — names the locked corpus versions and the locked core rules (final_polish.md §1.1–§1.6 verbatim).

Only after this gate may prose acts be edited broadly. Phase 5 batches now **edit existing prose** to match locked canon.

---

## 10. Phase 5 — Batched Prose Polish (Batches A–G)

Each batch: **edit pass** → **review pass** → **gate**. Order is strict (A before B) so early-chapter seeds are stable.

### Per-batch dispatch pattern
1. **Edit wave:** N edit subagents (one per chapter in the batch), each loads `writing-story-acts`, inputs = locked plan + Bibles + current acts + Phase 0.5 reconcile report for that chapter.
2. **Review wave:** 1 review subagent loads `reviewing-written-stories`, checks the whole batch against the batch gate criteria.
3. **Compile + commit.**

### Batch A — Chapters 1–4
- **Edit target:** surface suspense foregrounds ending settings; first-loop reader can later see fair clues; no early exposure of large institutions beyond the time-loop.
- **Checklist (final_polish.md §9 Batch A):** Yūma disappearance emotional weight; anonymous-message ambiguity; Kotone ordinary-friend presentation; Chida entrance + shell; rib wound + blood; CCTV 11s; 澪 wrongfully accused; ch4 one-week investigation specificity; first white-light + send-back clarity; radio as life-background only; no ending-settings dumping in ch1.
- **Gate A:** first-time reader can only answer "Chida's death and Yūma's disappearance may be connected" — cannot guess M-00, TOKYO-7, or Kotone's full truth before ch4.
- **Dispatch:** 4 edit subagents (parallel) → 1 review subagent.

### Batch B — Chapters 5–8
- **Core:** second loop ≠ replay; construction-corridor reasoning must be fair; Kotone info-tells exist but don't over-convict early.
- **Checklist:** uncontaminated shell sketch (Task 9 paid off); Chida doesn't board; attack moved to construction corridor; ch6/7 no time overlap (Task 6); bayfront-central + "those things" tells; R1 21:19 read-receipt plausibility; Kotone still medically/family-explainable; second death from process; no character says "the killer also remembers" directly.
- **Gate B:** reader can reasonably suspect Kotone but still has ≥2 ordinary explanations.
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Batch C — Chapters 9–12
- **Core:** natural pivot from death case to missing-boys network; before G07 appears, data source must be reliable.
- **Checklist:** family-cloud two screenshots (Task 3); sleep-talk, black sea, seven lines; radio tone-sequence ultra-light foreshadow (Task 10); Kano + Aoi thread; Seventh Dawn misdirection; pre-event timestamps; G07/03,08,12 evidence tiers separated; not all family members say the same thing; Seventh Dawn neither pure cult nor pure good.
- **Gate C:** G07 is a verifiable management code, not a mystical number assembled from dreams alone.
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Batch D — Chapters 13–16
- **Core:** translate TOKYO from city-misdirection to profile; seven-seconds + K-01 show only necessary parts; pre-R2-white-light still feels like mystery escalation.
- **Checklist:** G07/12 conditional reading; TOKYO in profile field; K-01 first as ordinary endpoint; seven-seconds as relative parameter; TOKYO-7 old maintenance name; 23:50/MAR-CONT low-intensity background (Task 12); no full HSM/lease reveal in ch15; ch16 public-document evidence discipline; R2 white-light ≠ simple failure repeat.
- **Gate D:** reader knows "Tokyo" may not be a place, but still doesn't know the full TOKYO-7 execution architecture.
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Batch E — Chapters 17–20
- **Core:** R3 high-speed but no author shortcuts; rescuing Yūma and finding Sae both cost procedure; alien + M-00 settings establish technical lineage.
- **Checklist:** Kusakabe memory fragments (Task 4); family screenshot source (Task 3); Kotone 21:04 route; MAR-CONT low-intensity field; Yūma rescue ≠ ordinary assault; M-00 modular backup (Task 13); K-01/execution-anchor early fields; analog monitor; witness/after-action sideband; Hakodate night-tide real danger; alien intent unknown; Yūma safe-detached.
- **Gate E:** at ch20 end, reader understands: *mother is the system center; signal danger is real; but how the system uses her is not yet fully revealed.*
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Batch F — Chapters 21–24
- **Core:** pivot from "find the truth" to "knowing everything still leads to mistakes"; patient rights + R5 establishment in clear human language.
- **Checklist:** R1–R3 lineage; R4 possible-future source (Task 4 / HLP §7.4); COMMIT-GATE/clinical hold/execution anchor (Task 14); eight-active-patient matrix (Task 15); red-zone four + other four; Kotone surname (Task 5); Misora/Kotone family + age; Domain-P/C; R5 target vs current; patient envelope vs network envelope; federated authorship; Sae consent; Aoi location; 23:50 continuity; science-capsule early lineage (Task 16).
- **Gate F:** reader can state in one non-technical sentence: *"R5 doesn't copy patients — it lets each person establish their own safe rhythm."*
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Batch G — Chapters 25–28
- **Core:** no new major institution layer; all ending solutions have prior foreshadow; patients, legal, public consequences stay restrained.
- **Checklist (final_polish.md §9 Batch G — 23 items):** Public Deny Manifest dual-layer; authorization capsules; S7 snapshot/lease; Subject Bay mount condition; S42/S43; all-human latch; clinical vs public-data hold; Kotone delegation; seven-stage local schedule; control quiet window; guardian HOLD ACK; physical break-glass; opt-in Witness Index; sideband keys-only; central app fanout gateway; public acute outcome; M-00 downstream count = 5; survivor care trust; Chida testimony boundary (Task 7); MAR-CONT dual evidence; distributed signal safety quarantine; 70-years probable/not-proven.
- **Gate G:** ch28 introduces no previously-unseen important equipment/procedure/patient/organization/key.
- **Dispatch:** 4 edit subagents → 1 review subagent.

### Phase 5 exit
- [ ] All 7 batch gates passed.
- [ ] `bun run compile:check` passes.
- [ ] Commit per batch: `feat(seventh-mirror): polish Batch <X> (ch<N>–<M>) prose to canon`

---

## 11. Phase 6 — Six Cross-Story Audits

One audit subagent per audit. Each reads the full locked corpus (plans + Bibles + polished prose). Output → review docs.

| # | Audit | Output | Focus |
|---|---|---|---|
| 1 | Time & geography | updates `canon/01_master_timeline.md` (final) | per-chapter start/end; same-POV two-locations; transit times; medical/police shifts; sleep; white-light cycle; 23:50/05:50/06:13; ch28 time-jumps |
| 2 | Clue & reasoning fairness | `review/02a_clue_audit.md` | seed / ordinary-explanation / second-occurrence / payoff per mystery; no ending-only rule; no sudden character data-grants |
| 3 | Character cognition | `review/02b_character_cognition.md` | per-line: who said it / how do they know now / fact-or-inference-or-memory / would they use this term. High-risk: 琴音,日下部,千田,凪原,紗英,悠真 |
| 4 | Legal & evidence | `review/02c_legal_evidence.md` | current-loop vs cross-loop separation; defense rights; minor representation; visit ≠ interrogation; document release vs medical privacy; Kusakabe evidence handover; Kotone formal-charging language; Chida hearing scope; father dual-evidence chain; Witness provenance; new-signal quarantine |
| 5 | Medical & patient ethics | `review/02d_medical_ethics.md` | patient ≠ tech node; per-patient stage ceiling; SAFE PAUSE; handoff risk comparison; hot standby; delayed effects; M-00 preservation duty; Survivor Care Trust; consent; no unnamed-patient vanishing; Misora + Aoi no miracle-wakeup |
| 6 | Technical system | `review/02e_tech_audit.md` | end-to-end flowchart (SIGNAL→FILTER→CLINICAL→ROOTS; TOKYO-7→tokens→LEASE→PREPOSITION→KAGAMI→CONSENSUS; MARKER→GATEWAY→+7000ms; WITNESS→CONSENT→ENVELOPES→KEYS→INDEX); no two-paths-as-one; no key dual-domain; no undefined override; no ending-new-channel; public HOLD ≠ clinical close; app cancel ≠ ordinary-service break |

**Exit:** all 6 audits committed; any conflict fed back as a targeted Phase 5 patch (re-open the relevant batch).

---

## 12. Phase 7 — Narrative & Emotional Polish

Five sub-areas (final_polish.md §11). **Dispatch:** 1 edit subagent per sub-area, each doing a whole-story pass for its concern only.

1. **Chapter openings** (§11.1) — first 500–800 chars accomplish ≥2 of: locate time/place, carry prior-chapter consequence, pose this-chapter question, show character state change. Cut long technical summaries / repeated prior conclusions / terminal-screen-as-character.
2. **Chapter endings** (§11.2) — each ends as NEW FACT / REINTERPRETATION / CHARACTER CHOICE / TIME PRESSURE / EMOTIONAL COST. Stop using new-conspiracy/new-official/new-device/new-code as the default hook.
3. **Technical translation** (§11.3) — each complex tech keeps ≤1 terminal screen + ≤1 professional judgment + ≤1 human-language translation.
4. **Repetition trim** (§11.4) — ch21–27 high-risk repeats (no single author / no patient copy / no non-response-as-consent / public ≠ clinical / PASSIVE ≠ safe / lease-valid ≠ applicable). Each concept: first full statement → second character-pay → ending short-recycle. Stop re-teaching every chapter.
5. **Character emotional arcs** (§11.5) — verify each arc (澪/琴音/日下部/凪原/紗英/悠真) hits every beat in order; no skipped or doubled beats.

---

## 13. Phase 8 — Ending-Specific Polish (Ch27 & Ch28)

Two edit subagents (ch27, ch28), each with the locked ending canon + final_polish.md §12.

### Ch27 (§12.1)
- [ ] handoff holds only because quiet-window + risk-comparison
- [ ] local schedule ≠ central single-point
- [ ] Witness release always below patient safety
- [ ] fragments opt-in
- [ ] white-light echo vs digital release separated
- [ ] official follow-up is credible crisis comms
- [ ] cancellation is central pre-fanout choke point
- [ ] no over-claim of loop cause
- [ ] last line: `沒有人被迫收到同一個答案。`

### Ch28 (§12.2)
- [ ] `06:13:01`; `先看病人`; Tokyo public acute outcome; 澪 ordinary medical/trauma; downstream = 5; preservation framework; Survivor Care Trust; bridge dates not too neat; M-00 decommission keeps history; Kotone procedure; Kusakabe procedure; Chida testimony; continuity personal decision; father dual-evidence; MAR-CONT preposition; signal safety quarantine; multi-site observation window; +70 years probable; **the locked final sentence**.

---

## 14. Phase 9 — Four Red-Team Reader Reviews

**Four separate subagents, four separate passes — never combined.** Each reads the full polished story in one sitting and answers only its persona's questions (final_polish.md §13).

1. **Reasoning reader** — can the train case be re-solved from supplied clues alone? which evidence looks like author-cheating? Kotone identity too early/late? CCTV/shell contamination? does R2 supply genuinely new info?
2. **Medical/legal reader** — who can consent/operate/publish? is any visit/treatment/safety used as interrogation-trade? which evidence exists only in 澪's memory? does M-00 support still coerce Sae? does patient care depend on lawsuit victory?
3. **System/sci-fi reader** — any ending-new-rule? are HSM/token/lease/anchor roles clear? public/clinical/witness crossed? does seven-seconds act on exactly one path? why can't Subject Bay open earlier? is new-signal safety consistent with prior chapters?
4. **Emotional reader** — which characters have function but no choice? do protagonist's family get too much screen? are unnamed patients still instrumentalized? is Kotone whitewashed? do Misora/Aoi non-wakeup still pay emotionally? does ch28 end too many times? does the radio feel like an author-reward?

**Output:** `review/04_redteam_<persona>.md` ×4. Every reported issue is either patched (re-open targeted batch) or explicitly accepted in `review/04_redteam_disposition.md` with reason.

---

## 15. Phase 10 — Final Regression

Five checks (final_polish.md §14). Run by the orchestrator locally; dispatch a review subagent only for ambiguous hits.

### 14.1 Keyword scan
- [ ] `rg "帶上鏡子|這一輪|上一輪|藤川琴音|悠真手機相簿|日下部完整記得|千田證明|PASSIVE-READY|所有患者安全|零傷亡|外星警告|外星善意|全世界同步|立即完全離線" docs/ chapter_*/act*.md`
- [ ] Each hit either = 0 or inside a marked `舊設定／錯誤推論` passage. Document all survivors in `review/05_keyword_scan_disposition.md`.

### 14.2 Character-knowledge regression
- [ ] Extract every reasoning-conclusion / system-term / prior-loop-info / patient-name / authorization-architecture line from all 28 chapters. Each must name a source. Output → `review/06_knowledge_source_audit.md`.

### 14.3 Time regression
- [ ] R1 one week / R2 one week / R3 one week; ch6/7; ch23 Kotone route; ch24 23:55; ch25 23:50; ch27 seven-stage total; ch28 06:20 lease expiry; epilogue time-distance.

### 14.4 Patient-count regression
- [ ] Any patient-count mention must match `TOTAL 9 / SAFE-DETACHED 1 / ACTIVE 8 / LOCAL-PRIMARY after ch27 2 / CENTRAL-BUS ENDPOINTS 6 / M-00 SOURCE 1 / DOWNSTREAM 5`. Bridge only reduces downstream, never re-increases.

### 14.5 Mystery regression
- [ ] Each major mystery: seed / ordinary-explanation / false-lead / payoff / final-status. No payoff-without-seed; no seed-deleted-by-later-version; no character-solves-with-unprovided-data; no intentional-open-mystery accidentally closed in prose.

---

## 16. Phase 11 — Final Lock

### 15.1 Lock conditions (all must hold)
- [ ] Six direct contradictions fixed (Tasks 1–7)
- [ ] Ending foreshadow written back (Tasks 8–16)
- [ ] High-level plan rewritten (Phase 3)
- [ ] 7 Canonical Bibles complete (Phase 4)
- [ ] 28 chapter latest-files unique (Phase 0 manifest)
- [ ] Whole-story timeline conflict-free (Audit 1)
- [ ] All key lines name information source (Audit 3 + 14.2)
- [ ] Chida/Kotone/Kusakabe evidence boundaries consistent (Tasks 5,7 + Audit 4)
- [ ] Eight-patient count consistent (Task 15 + 14.4)
- [ ] public/clinical/witness paths consistent (Audit 6)
- [ ] Unknown-signal safety-public (Phase 8 + Audit 4)
- [ ] Intentional-open-mystery list fixed (Bible 7)
- [ ] No new major lore added (Bible 7 forbidden list)
- [ ] Final sentence locked (Phase 8)

### 15.2 Final Lock Manifest
- **Create:** `review/03_final_lock_manifest.md` containing: formal chapter files; formal high-level plan; Canon Bible versions; final chapter names; final patient count; final timestamps; final open mysteries; core rules forbidden to re-change; prose-draft-start version number.

---

## 17. Change-Control Rules (final_polish.md §16, restated)

**Before Final Lock**, any new proposal must answer all 8 questions (contradiction-fix vs novelty / foreshadow chapters needed / new term-org-patient-key-location? / changes what characters know? / changes legal-evidence status? / changes patient safety? / weakens existing payoff? / worth delaying formal writing?). If the answer is only "more complex / more shocking / more mystery" → **reject**.

**After Final Lock**, only prose/rhythm/small-scenes/non-canon details may change. Forbidden: mystery-answers, character responsibility, patient counts, loop rules, TOKYO-7 ending, ch28 ending.

---

## 18. Recommended Dispatch Cadence

| Phase | Subagents (parallel waves) | Estimated waves |
|---|---|---|
| 0.3 reconcile | 7 review | 1 |
| 1 (Tasks 1–7) | 9 edit | 3 |
| 2 (Tasks 8–16) | ~13 edit | 4 |
| 3 HLP rewrite | 1 edit + 1 review | 2 |
| 4 Bibles | 7 canon + 1 review | 2 |
| ★ Canon Lock | (orchestrator) | 1 |
| 5 Batches A–G | 4 edit + 1 review × 7 | 14 |
| 6 Audits | 6 audit | 2 |
| 7 Narrative | 5 edit | 2 |
| 8 Ending | 2 edit | 1 |
| 9 Red-team | 4 review | 4 (strictly sequential per persona) |
| 10 Regression | (orchestrator + 1 review for ambiguous) | 2 |
| 11 Final Lock | (orchestrator) | 1 |

**Hard ordering:** Phase 1 → 2 → 3 → 4 → ★ → 5 (A–G in order) → 6 → 7 → 8 → 9 → 10 → 11. Never skip to Phase 5 before the Canon Lock gate — unlocked canon is how drift returns.

---

## 19. Definition of Done (final_polish.md §18, restated)

Not "every chapter looks detailed." Rather:

> Open any chapter at random — characters, time, evidence, medical, tech, and downstream payoff all match one and the same version across the whole book.

Must answer the reader-questions and author-questions in final_polish.md §18, with every answer residing in Canon — never in ad-hoc recall.
