# Archive List — 《神鏡七日》 Final Polish

> Tracks every file moved to `archive/` once its `_final` replacement exists.
> Per final_polish.md §2.1: old versions may be archived but must not co-exist as canon alongside the formal version.
> Populate incrementally through Phases 3 and 5.

## Pending archive (move when `_final` replacement lands)

| File | Replacement | Move at phase | Status |
|---|---|---|---|
| `docs/high-level-plan.md` | `docs/00_high_level_plan_final.md` | Phase 3 | pending |
| `docs/chapter_<N>_plan.md` (per chapter) | `docs/chapter_<N>_plan_final.md` | Phase 5 (batch gate per chapter) | pending |

## Schema for archived files

When a file moves to `archive/`:
- Path: `archive/<original-relative-path>_v<version>_superseded.md`
- Header note (top of file):
  ```
  > ⚠️ SUPERSEDED — moved from <original-path> on <date> during final-polish Phase <P>.
  > Replaced by <replacement-path>. Do NOT pull settings from this file.
  ```
- Original path is then occupied by the `_final` version (or, for plan docs that keep their name, edited in place with the old version archived under a versioned name).

## Decisions to make before Phase 5

- Do chapter plan docs keep their filename (`chapter_N_plan.md`) and get edited in place, or get a `_final` rename? **Recommendation:** edit in place (rename adds 28 rename diffs and breaks cross-references); archive a versioned copy (`archive/chapter_N_plan_v_pre_polish.md`) at the Canon Lock gate so the pre-polish state is recoverable. Confirm before Phase 5.
