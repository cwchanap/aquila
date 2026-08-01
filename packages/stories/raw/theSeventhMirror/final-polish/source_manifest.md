# Source Manifest — 《神鏡七日》 Final Polish

> Single source of truth for "which file is the latest version of each chapter."
> Per final_polish.md §4 (Phase 0): no edit may pull settings from a superseded file.
> **Authority rule:** `docs/chapter_N_plan.md` is canon source; `chapter_N/act*.md` is prose to be kept in sync.

## Story-level documents

| Artifact | Path | Status |
|---|---|---|
| Polish spec | `docs/final_polish.md` | ✅ Locked spec (committed baseline) |
| Execution plan | `docs/final_polish_execution_plan.md` | ✅ Active |
| High-level plan (current) | `docs/high-level-plan.md` | ⚠️ OLD — supersedes pending Phase 3 → `docs/00_high_level_plan_final.md` |
| Character registry | `docs/characters.md` | ✅ Active (verify post-Task 5) |

## Per-chapter latest source (28 chapters)

| Ch | Plan doc (canon source) | Act dir | Acts | Version tag |
|---|---|---|---|---|
| 1 | `docs/chapter_1_plan.md` | `chapter_1/` | 7 (act1–7) | v_current |
| 2 | `docs/chapter_2_plan.md` | `chapter_2/` | 6 (act1–6) | v_current |
| 3 | `docs/chapter_3_plan.md` | `chapter_3/` | 6 (act1–6) | v_current |
| 4 | `docs/chapter_4_plan.md` | `chapter_4/` | 8 (act1–8) | v_current |
| 5 | `docs/chapter_5_plan.md` | `chapter_5/` | 8 (act1–8) | v_current |
| 6 | `docs/chapter_6_plan.md` | `chapter_6/` | 8 (act1–8) | v_current |
| 7 | `docs/chapter_7_plan.md` | `chapter_7/` | 6 (act1–6) | v_current |
| 8 | `docs/chapter_8_plan.md` | `chapter_8/` | 7 (act1–7) | v_current |
| 9 | `docs/chapter_9_plan.md` | `chapter_9/` | 10 (act1–10) | v_current |
| 10 | `docs/chapter_10_plan.md` | `chapter_10/` | 8 (act1–8) | v_current |
| 11 | `docs/chapter_11_plan.md` | `chapter_11/` | 8 (act1–8) | v_current |
| 12 | `docs/chapter_12_plan.md` | `chapter_12/` | 9 (act1–9) | v_current |
| 13 | `docs/chapter_13_plan.md` | `chapter_13/` | 8 (act1–8) | v_current |
| 14 | `docs/chapter_14_plan.md` | `chapter_14/` | 6 (act1–6) | v_current |
| 15 | `docs/chapter_15_plan.md` | `chapter_15/` | 6 (act1–6) | v_current |
| 16 | `docs/chapter_16_plan.md` | `chapter_16/` | 6 (act1–6) | v_current |
| 17 | `docs/chapter_17_plan.md` | `chapter_17/` | 8 (act1–8) | v_current |
| 18 | `docs/chapter_18_plan.md` | `chapter_18/` | 8 (act1–8) | v_current |
| 19 | `docs/chapter_19_plan.md` | `chapter_19/` | 10 (act1–10) | v_current |
| 20 | `docs/chapter_20_plan.md` | `chapter_20/` | 8 (act1–8) | v_current |
| 21 | `docs/chapter_21_plan.md` | `chapter_21/` | 8 (act1–8) | v_current |
| 22 | `docs/chapter_22_plan.md` | `chapter_22/` | 8 (act1–8) | v_current |
| 23 | `docs/chapter_23_plan.md` | `chapter_23/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |
| 24 | `docs/chapter_24_plan.md` | `chapter_24/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |
| 25 | `docs/chapter_25_plan.md` | `chapter_25/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |
| 26 | `docs/chapter_26_plan.md` | `chapter_26/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |
| 27 | `docs/chapter_27_plan.md` | `chapter_27/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |
| 28 | `docs/chapter_28_plan.md` | `chapter_28/` | 8 (act1–8) | v_current (v2.2-target pending Phase 1) |

**Totals:** 28 plan docs, 28 act dirs, 215 act files.

## Version-tag policy

- `v_current` — the latest committed version; canonical until a `_final` replacement exists.
- `v2.2-target` — chapters 23–28 are expected to converge to a v2.2 baseline per final_polish.md §4; tag promoted to `v2.2` once Phase 1 confirms no older settings remain.
- `_final` — applied in Phase 5 when a chapter's plan+prose clear their batch gate; the non-`_final` predecessor moves to `archive/`.

## Compiled output (downstream, not canon)

- Generated TS root: `packages/stories/src/generated/theSeventhMirror/`
- Regenerate after every `act*.md` or `docs/characters.md` edit: `bun compile:stories`
- CI no-drift guard: `bun run compile:check`
- Plan-doc edits (`docs/chapter_N_plan.md`) do **not** trigger recompile.
