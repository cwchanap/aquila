# HPA-1129 — Wide story-map sheet and responsive header status card

**Status:** Revised after the [first design review](https://github.com/cwchanap/aquila/pull/143#pullrequestreview-6003775657) and [second review of `1217728`](https://github.com/cwchanap/aquila/pull/143#pullrequestreview-6003865048). Still docs-only; implement all UI/test changes in **this same PR**.

- Linear: https://linear.app/cwchanap/issue/HPA-1129/widen-the-story-map-sheet-to-95percent-and-move-the-sidebar-into-the
- Prerequisite: HPA-691 (branching story map) is Done; no blocked-by relations.
- Baseline reviewed: `main` at `4804cc20482e0e1092181c4e557d656d8ebfb50b` on 2026-11-20. Recheck the touched files against latest main before implementation.
- **Visual source of truth:** HPA-1129's attached `story-map-wide-mockup.html` (default proposed design; `?mode=today` compares the original), and the four screenshots in the issue. Click map nodes in the HTML to inspect all card states.
- Delivery: **one PR for this ticket** (design, implementation, tests, screenshots and review fixes). No standalone implementation PR.

## Problem and success criteria

The current `StoryMapSheet` caps its desktop width at 1024 px (`lg:max-w-5xl`) and places a 240 px selection sidebar beside the map (`lg:w-60`). The result is a map viewport of about 724 px for a 1696 px-wide Platform example. On phones the same sidebar moves below the map and consumes substantial vertical space.

Replace that sidebar with a compact, selected-node-sensitive card in the sheet header. At 1440×900, the reference mock-up targets a ~1320×557 px map viewport instead of ~724×583 px; the map's **natural canvas dimensions and scrollability are unchanged**. The sheet is 95% of viewport width on desktop and remains 85% of viewport height. Mobile stays full screen and gains the space previously taken by the sidebar.

The change is deliberately **presentation-only**. Keep `buildStoryMap`, `layoutStoryMap`, `StoryProgress`, map metrics, node/edge drawing, navigation callbacks, story data, audio and progress semantics untouched.

## Existing component seams

| Seam | Current code | Planned change |
| --- | --- | --- |
| Modal geometry | `apps/web/src/components/StoryMapSheet.svelte`: `lg:max-w-5xl lg:h-[85vh]`, outer `lg:p-8` | Use `lg:w-[95vw] lg:max-w-none lg:h-[85vh]` and remove conflicting desktop wrapper padding; preserve sheet glass styling, radius, scrim and full-screen layout below 1024 px |
| Details area | `<aside data-testid="story-map-details" aria-live="polite">`, rendered beside/below map | Move the same `selection` branches into a single header status card, `data-testid="story-map-status-card"`; remove the aside and its fixed 240 px allocation |
| Selection | `selection` derives `current/run/scene/decision/ending/unknown` from `selectedId`, `selectedKind`, `index`; the `scene` variant currently lacks route/explored status | **Reuse the existing derivation and state model**, but add a `scene.status: 'route' | 'explored'` field derived from the owning run's `sceneIds`/`routeCount`; no second store, overlay, graph re-layout or new data model |
| Map | `story-map-surface`, SVG, legend, locate, on-map run pill and collapse control | Preserve behavior, canvas sizing, focus handling and layout algorithm; only freed viewport space changes |
| Tests | `apps/web/src/components/__tests__/StoryMapSheet.test.ts`, **`apps/web/src/components/__tests__/ReaderShell.test.ts`** (its `details()` helper and snapshot/jump checks), and `packages/e2e/tests/story-map.spec.ts` all use `story-map-details` | Update all three **in the same UI commit** to `story-map-status-card`, preserving functional assertions rather than leaving intermediate test failures |

## Layout and visual specification

### Desktop: viewport width >= 1024 px

1. Outer modal width is **95vw**, not a fixed 1024 px; height remains **85vh**. Ensure its centering wrapper does not shrink it below 95vw at the 1024 px breakpoint (the existing `lg:p-8` would conflict).
2. Header is one horizontal row: left story-map eyebrow/title; **right-aligned content-hugging card**; 44×44 close button at the far right. Title is allowed to wrap/clamp without pushing the close button away.
3. Card is **84 px tall** with a 5 px color-coded left edge, white translucent glass fill and rounded corners. It can shrink in width when needed (especially at 1024 px). Contents clamp/ellipsis rather than expanding the header. Use normal flex/grid and responsive utility classes, not JS layout measurement or resize observers.
4. Body contains **only** the existing map card and its legend/locate footer. Remove the sidebar and `lg:flex-row` split. Preserve natural map width, two-axis scrolling and current-node locate behavior; never auto-fit or re-layout graph nodes.
5. Card height must not change on node selection, including real decision nodes with **two to four** options and long text. In `buildStoryMap`, single-option choices are intentionally **linear links**, not decision nodes: preserve that behavior. Selecting a node must not move or resize the map surface; fixed-height card overflow must not clip interactive controls.

### Mobile / tablet: viewport width < 1024 px

1. Sheet retains `h-full w-full`. Header is title/close row followed by a **full-width 92 px card**. The map takes the remaining flex height (no sidebar below it).
2. Current state uses a compact act/line row with inline counts; omit the desktop stats divider. Decision state shows the prompt (clamped at two lines) and Jump, but **not the option chips**. Other selection kinds show label and their action when applicable.
3. Keep the 44 px button target, small-screen text overflow protection and fixed card height at ordinary portrait and short landscape sizes. Map legend and locate remain usable.
4. Breakpoint is the existing Tailwind `lg` (1024 px); no new bespoke breakpoints, mobile overlay stack, or responsive JS state. **Single markup tree per selection kind:** use responsive styles on the same stats list and hide the same decision-chip row on mobile (`hidden lg:flex`), without duplicating the six kinds for desktop and mobile.

### Reuse the existing selection state

| Kind | Card content | Behavior |
| --- | --- | --- |
| `current` / no selection | “You are here”, act, line N of M, explored-act/decision/ending counts | Desktop three small stat columns; mobile inline stats; no jump |
| `run` | Run label and `Jump to …`; “current position” if applicable | `onJump(run.entrySceneId, 'start')`; **no sidebar Expand/Collapse button** (existing map run pill/collapse affordance owns folding) |
| `scene` | Act label, optional “current position”, Jump; accent reflects **route vs explored**, even when the scene is not current | `onJump(selection.sceneId, 'start')`; derive `status` from `sceneRun.sceneIds.indexOf(sceneId) < sceneRun.routeCount ? 'route' : 'explored'`, matching `story-map.ts`'s layout-node coloring |
| `decision` | Decision/option count, up-to-two-line localized prompt; one small option chip per option on desktop, each with colored/dotted status indicator; Jump | Existing `onJump(precedingSceneId, 'end')` when preceding scene exists; deliberately drop **both** the long visible status line **and** `option.child.label` destination act from the sidebar (revealed destinations already appear on map nodes/edges); preserve accessible chip status |
| `ending` | “Ending {label}”, `Read this ending again` | `onJump(ending.sceneId, 'start')` |
| `unknown` | “Not read yet” | No jump control or spoiler content |

Use existing `option.child.kind`/`.status`: route = blue, explored = teal, unknown = grey dotted. Compose **one accessible announcement per option** via an `sr-only` span containing `sm.withBranch.replace('{label}', status).replace('{branch}', option.label)`, where `status` is `sm.yourRoute`, `sm.explored` or `sm.unreadLabel`. Mark both the **visible truncated `option.label` span and decorative dot `aria-hidden="true"`** so screen readers do not hear the option label twice inside `aria-live`. Reuse en/zh/ja Story Map keys; no new strings. Header accent is blue for route acts (including non-current route scenes), teal for explored acts/endings, amber for decisions, grey for unknown. Add `status: 'route' | 'explored'` to the `scene` selection variant using `sceneRun.sceneIds.indexOf(id) < sceneRun.routeCount`, then derive the card accent with one **pure `accentKey(selection)`** and an in-file `statusStyles` lookup keyed `route | explored | unread | decision`. Preserve the actual map node/edge coloring; no new module or graph refactor.

**Accessibility:** Keep `aria-modal`, title association, `focusTrap`, Escape capture, scrim close and opener focus restoration. Put `aria-live="polite"` on the card; keep semantic headings/buttons. Pair the single translated `sr-only` option status with `aria-hidden="true"` on its visible label/dot so the announcement isn't duplicated. Hidden mobile chips must not create focus targets. No new translation keys.

## One-PR implementation sequence (second-review-revised)

**Preflight:** reconfirm latest `main`, ticket and PR state, then run existing focused tests. All implementation commits and review fixes remain in **PR #143**. **Each commit must keep existing component/E2E tests runnable**; do not commit red-first E2E assertions before the UI that satisfies them.

1. **Extract reusable fixtures without changing behavior (green).** Move only `expectNoHorizontalOverflow(page)` from `packages/e2e/tests/reader-crossroads.spec.ts` into `packages/e2e/tests/utils.ts`. Move `VARIANTS`, `choiceAfter`, the generated `train_adventure` imports, and existing option-count guards into **`packages/e2e/tests/support/train-adventure-choices.ts`**, imported **only by** `reader-crossroads.spec.ts` and `story-map.spec.ts` (not by shared `utils.ts`, imported by unrelated and remote-release E2E suites). Preserve all existing Crossroads coverage. Extend `MobileReaderPage.seedVisitedScenes(storyId, sceneIds, currentSceneId?, endings: string[] = [])` with optional endings; preserve the prior `[]` default and route the value into the stored progress record, with no runtime API change.
2. **Implement the complete UI and update existing test selectors together (green).** In `StoryMapSheet.svelte`, remove conflicting wrapper `lg:p-8` / modal `lg:max-w-5xl`, use `lg:w-[95vw] lg:max-w-none lg:h-[85vh]`, and replace the sidebar with one fixed **84px desktop / 92px mobile** `data-testid="story-map-status-card"` in the responsive header. Render all six selection kinds as a **single DOM tree per kind**, including status chips, accessible `sr-only` status, `aria-hidden` visible label/dot, `statusStyles`, and CSS-only responsive hiding. Change the existing `Selection['scene']` to include the run-based route/explored status and derive header accents via one pure `accentKey(selection)` helper; test route act vs explored act. Preserve map/legend/locate/folding and all navigation, progress and modal semantics. **In the same commit**, rename `details()` and update `story-map-details` selectors in **both** `apps/web/src/components/__tests__/StoryMapSheet.test.ts` **and** `apps/web/src/components/__tests__/ReaderShell.test.ts` (ending snapshot and decision jump cases), plus existing assertions at `packages/e2e/tests/story-map.spec.ts:215`. Remove only sidebar-specific fold/destination/status assertions; keep run-pill fold and focus tests. Unit/component tests cover DOM content, accessible names, callbacks and `aria-live`, **not** CSS layout in happy-dom.
3. **Add Playwright browser invariants with the finished UI (green).** Extend `packages/e2e/tests/story-map.spec.ts` with geometry and overflow tests at **1440px and 1024px desktop**, and **390×844 / 844×390** mobile, using `setViewportSize`, `expectNoHorizontalOverflow`, `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth`, Jump bounding boxes, and stable map surface rectangle/scroll offsets. Use reduced motion/settled scroll before comparison. Reuse the support fixtures `act3` (2), `b1b_act8` (3), `b1a_b2b_b3b_b4b_b5a_act70` (4): seed a **passed** choice by including its preceding scene and one child via `seedVisitedScenes`, since `buildStoryMap` hides unpassed choices. Preserve one-option Crossroads regression; it is a **linear map link**, not a decision card. Seed a completed ending using the new optional `endings` parameter, not an expensive end-to-end replay per matrix case.
4. **Bound locale coverage to avoid a Cartesian-product CI explosion.** Parameterize `openStoryMap(page, projectName, locale: Locale = 'en')` with **`getTranslations(locale)` from `@aquila/stories/translations`** for correctly localized Settings, Story Map and mobile opener labels. Run 2/3/4-option variations and all six selection kinds in **en**. Run **zh and ja** only for worst-case layout/overflow: `current`, four-option `decision` at **1024px desktop / 390px phone**, and `ending` (long Japanese Jump label). Reuse existing Playwright browser projects, no new test harness or native acceptance. Add only **three** `testInfo.attach` screenshots to the existing report: 4-option desktop decision, phone decision, phone current; no screenshot baselines or commits of image evidence.
5. **MCP-driven end-to-end and mock-up visual acceptance.** Drive one actual story-choice → Story Map → decision Jump → reopen/close journey using browser/Playwright MCP; compare desktop and phone presentation against the Linear `story-map-wide-mockup.html`. Record evidence on the PR. Deterministic geometry/scroll/overflow assertions remain in CI; avoid screenshot matrices. Browser MCP E2E plus this visual check satisfies acceptance; **no human sign-off**.
6. **Quality gate in this same PR.** Run web tests, targeted Story Map and Crossroads Playwright suites, lint, build and applicable checks. `.github/workflows/e2e-tests.yml` skips Draft PRs, so once implementation + MCP verification are complete **mark ready to trigger E2E CI**, and do not report success until it runs green. `vitest.config.ts` has **no numeric coverage thresholds**; do not invent a coverage gate.

**Expected touched files:** `apps/web/src/components/StoryMapSheet.svelte`, `apps/web/src/components/__tests__/StoryMapSheet.test.ts`, **`apps/web/src/components/__tests__/ReaderShell.test.ts`**, `packages/e2e/tests/story-map.spec.ts`, `packages/e2e/tests/reader-crossroads.spec.ts`, `packages/e2e/tests/utils.ts`, **`packages/e2e/tests/support/train-adventure-choices.ts`**, and this plan. No changes to compiler, graph/layout code, translations, database, backend, mobile-native, art or sound.

## End-to-end acceptance matrix (repeatable CI + MCP visual check)

- [ ] **CI desktop geometry:** Chromium at **1440×900** and **1024×768** measures modal width 95vw (±2px) and height 85vh, one fixed-height header status card between title/close, no sidebar or horizontal overflow; map canvas bounds unchanged.
- [ ] **CI selection/jumps:** Current, run, scene, decision, completed ending and unread card states show the correct content. Jump targets retain original `start`/`end` semantics; unread remains spoiler-safe. On-map expand/fold and locate, focus trap, `aria-live`, Escape, scrim and focus restoration work.
- [ ] **CI route/accent semantics:** Component test verifies a **non-current active-route scene is blue** while a genuinely explored scene is teal, using the run's `sceneIds` and `routeCount` (not just `selection.current`); keep map node colors unchanged.
- [ ] **CI no duplicate screen-reader label:** Each decision chip has one accessible option announcement formatted using `sm.withBranch`, its decorative dot and visible truncated label marked `aria-hidden`; `aria-live` remains on the card.
- [ ] **CI stable geometry:** After initial auto-scroll settles, record `story-map-surface` rectangle and scrollLeft/scrollTop plus SVG dimensions; changing selection current → decision → unknown and completed ending does not move/resize the map. Expanding a run is a separate intentional layout change.
- [ ] **CI choice fixtures:** The generated-story-dependent `VARIANTS`/`choiceAfter` live **only in `tests/support/train-adventure-choices.ts`**, imported by two relevant specs; shared `utils.ts` stays free of generated-story imports. Seed 2/3/4-option `train_adventure` decisions as passed by recording preceding and child scenes, then check count, status-dot color and readable/accessibly named chips. A single-option choice remains a linear link.
- [ ] **CI no silent clipping:** `scrollHeight <= clientHeight`, `scrollWidth <= clientWidth`, Jump button/focus bounding boxes inside the card across English selection cases and targeted zh/ja worst cases. Stress 4-option 84px card at **1024px** and 2-line 92px prompt at **390px**. Reuse `expectNoHorizontalOverflow`.
- [ ] **CI mobile/landscape:** At **390×844** / **844×390**, 92px card is below title/close row, chips actually hidden through responsive CSS (not class-name unit tests), Jump remains usable, freed map height allows scrolling and legend/locate still work.
- [ ] **Bounded localization:** `openStoryMap` uses `getTranslations(locale)`. Full 2/3/4 and state coverage runs in **en**; targeted **zh/ja** checks cover current, 4-option decision at desktop/mobile critical widths, and ending with long translated Jump text. Do not run locales × all variants × all states × three projects.
- [ ] **E2E support for completed ending:** `seedVisitedScenes(..., endings = [])` stays backward-compatible for existing callers and supports a real completed-ending map fixture, avoiding repeated long ending-playthrough setup.
- [ ] **Report screenshots:** Attach three representative states with `testInfo.attach`: desktop four-option decision, phone decision, phone current. No image baselines or committed screenshot files.
- [ ] **MCP E2E acceptance + visual check:** Use Playwright/browser MCP to exercise a real story-choice → map → Jump → reopen/close journey and visually check desktop/mobile against the Linear interactive HTML mock-up, documenting the result on PR #143. **One browser platform suffices; no native or human acceptance required.**
- [ ] **Quality gate:** Each implementation commit keeps existing tests runnable; web component tests, new/updated Story Map and Crossroads Playwright tests, lint, build and E2E CI pass after leaving Draft. No backend change or numeric Vitest coverage threshold.

Suggested commands:

```bash
bun --filter web test
bun --filter e2e test:e2e tests/story-map.spec.ts tests/reader-crossroads.spec.ts --workers=1
bun lint
bun run build
```

The Vercel preview reports deployment status, not test acceptance. `.github/workflows/e2e-tests.yml` skips Draft PRs.

## Explicit non-goals and risks

- **No map fitting/scaling**, layout algorithm changes, node/edge style redesign or changes to scrolling/locate logic. Wider viewport simply exposes more of the unchanged natural-size graph.
- **No new graph/progress state or API**, no new Svelte component abstraction unless duplication emerges, no locale rewrites, no art/SFX, no parallel PR.
- **Responsive collision risk at exactly 1024 px:** 95vw plus close button/card/title can compete for width; use flex shrink and truncation, and verify via browser geometry instead of introducing a new breakpoint.
- **Fixed-height decision risk:** long prompts and localized labels may overflow; clamp text while retaining the 44 px Jump target. `overflow-hidden` can silently clip buttons or focus rings: assert card scroll dimensions and button bounds in CI plus MCP visual check.
- **Test coupling:** existing E2E **and `ReaderShell.test.ts`** assert on `story-map-details`. Switch all three test files alongside the completed UI to preserve green commits; remove obsolete destination/status lines, retaining real navigation/folding assertions.
- **Shared fixtures:** importing generated `trainAdventure` data from shared `utils.ts` would break unrelated specs; isolate those imports in `tests/support/train-adventure-choices.ts` and keep only generic utilities in `utils.ts`.
- **Accessibility:** never announce a chip option twice: visible label and dot are `aria-hidden`, paired with one translated `sr-only` status+label. `aria-live` should not repeat the visible label.
- **Single-option behavior:** the map builder treats one-option choices as linear links. Do **not** extend graph semantics to manufacture one-option status-card coverage.

This docs-only draft is **not** a claim that implementation, CI or MCP end-to-end/visual acceptance has completed. No human sign-off is an acceptance criterion.
