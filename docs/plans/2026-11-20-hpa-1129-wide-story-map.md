# HPA-1129 — Wide story-map sheet and responsive header status card

**Status:** Design specification and implementation plan. This draft PR intentionally changes documentation only; implement the UI and tests **in this same PR** after plan review.

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
| Selection | `selection` derives `current/run/scene/decision/ending/unknown` from `selectedId`, `selectedKind`, `index` | **Reuse as-is**; do not introduce a second selection store, overlay, or component state model |
| Map | `story-map-surface`, SVG, legend, locate, on-map run pill and collapse control | Preserve behavior, canvas sizing, focus handling and layout algorithm; only freed viewport space changes |
| Tests | `StoryMapSheet.test.ts` and `packages/e2e/tests/story-map.spec.ts` query `story-map-details` | Update the selector and expectations for the compact card; replace sidebar-only expectations with the new design |

## Layout and visual specification

### Desktop: viewport width >= 1024 px

1. Outer modal width is **95vw**, not a fixed 1024 px; height remains **85vh**. Ensure its centering wrapper does not shrink it below 95vw at the 1024 px breakpoint (the existing `lg:p-8` would conflict).
2. Header is one horizontal row: left story-map eyebrow/title; **right-aligned content-hugging card**; 44×44 close button at the far right. Title is allowed to wrap/clamp without pushing the close button away.
3. Card is **84 px tall** with a 5 px color-coded left edge, white translucent glass fill and rounded corners. It can shrink in width when needed (especially at 1024 px). Contents clamp/ellipsis rather than expanding the header. Use normal flex/grid and responsive utility classes, not JS layout measurement or resize observers.
4. Body contains **only** the existing map card and its legend/locate footer. Remove the sidebar and `lg:flex-row` split. Preserve natural map width, two-axis scrolling and current-node locate behavior; never auto-fit or re-layout graph nodes.
5. Card height must not change on node selection, including decision nodes with one to four options and long text. Switching selections must not change the map surface's geometry or scroll position.

### Mobile / tablet: viewport width < 1024 px

1. Sheet retains `h-full w-full`. Header is title/close row followed by a **full-width 92 px card**. The map takes the remaining flex height (no sidebar below it).
2. Current state uses a compact act/line row with inline counts; omit the desktop stats divider. Decision state shows the prompt (clamped at two lines) and Jump, but **not the option chips**. Other selection kinds show label and their action when applicable.
3. Keep the 44 px button target, small-screen text overflow protection and fixed card height at ordinary portrait and short landscape sizes. Map legend and locate remain usable.
4. Breakpoint is the existing Tailwind `lg` (1024 px); no new bespoke breakpoints, mobile overlay stack, or responsive JS state.

### Reuse the existing selection state

| Kind | Card content | Behavior |
| --- | --- | --- |
| `current` / no selection | “You are here”, act, line N of M, explored-act/decision/ending counts | Desktop three small stat columns; mobile inline stats; no jump |
| `run` | Run label and `Jump to …`; “current position” if applicable | `onJump(run.entrySceneId, 'start')`; **no sidebar Expand/Collapse button** (existing map run pill/collapse affordance owns folding) |
| `scene` | Act label, optional “current position”, Jump | `onJump(selection.sceneId, 'start')` |
| `decision` | Decision/option count, up-to-two-line localized prompt; one small option chip per option on desktop, each with colored/dotted status indicator; Jump | Existing `onJump(precedingSceneId, 'end')` when preceding scene exists; no written per-option status line, but preserve accessible status via existing translations |
| `ending` | “Ending {label}”, `Read this ending again` | `onJump(ending.sceneId, 'start')` |
| `unknown` | “Not read yet” | No jump control or spoiler content |

Use the current `option.child.kind` and `option.child.status` values: route = blue dot, explored = teal dot, unread/unknown = grey dotted dot. Reuse option labels already present in `d.options`; long labels visually truncate within the available card width and remain accessible via native text/accessible labels. No new locale keys: reuse `t.reader.storyMap` from en/zh/ja, plus the existing line-progress format. Header accent: blue for current/route acts, teal for explored acts and endings, amber for decisions, grey for unknown.

**Accessibility:** Keep the modal's `aria-modal`, title association, `focusTrap`, Escape capture, scrim close and opener focus restoration unchanged. Put `aria-live="polite"` on the replacement card; maintain semantic headings, real buttons and readable option status labels even though the long visible status sentences are removed. Hidden mobile chips must not create stray focus targets. No accessibility regression or new translated prose.

## One-PR implementation sequence

1. **Rebase/check main and test baseline.** Confirm this ticket is still Todo, HPA-691 remains present, the Svelte component still has the aside, and no new PR has taken the work. Run targeted component and story-map E2E tests before edits.
2. **Modal/header structure.** In `apps/web/src/components/StoryMapSheet.svelte`, update the desktop width/wrapper interaction; make the header responsive, holding the existing title, one new status card, and close button. Remove the old aside and map/sidebar flex split. Preserve map, legend and locate markup.
3. **Move and compact content.** Render the existing six `selection` cases directly in the header card. Keep current jump callbacks, derived stats, selection and folding logic. Drop only the sidebar-only Expand/Collapse action; keep the map's expand/collapse controls and keyboard focus restoration.
4. **Decision chips and fixed heights.** Derive chip color/status inline from existing data (no new domain helpers or store). Add responsive overflow/clamp styles, 84 px desktop / 92 px mobile heights, and accessible translated status labels. Verify 1–4 options, including four long localized options, fit without changing header height.
5. **Update component tests.** Rename `details()` helper to `statusCard()`, change `story-map-details` queries, cover each card kind, chip counts/statuses, mobile chip hiding, fixed-header class/structure, jump values, Escape/focus/aria-live. Replace the old sidebar fold-button test with an assertion that folding remains available **on the map**; don't re-implement a duplicate fold button.
6. **Update the existing Playwright story-map E2E suite.** Replace old details selectors/status-line assertions and sidebar geometry checks. Preserve spoiler-safe choice navigation and focus regression. Add geometry, responsive layout and screenshot capture to the **existing** spec, rather than a second test harness.
7. **MCP end-to-end acceptance.** Start the app through the project's existing Bun/Playwright workflow and use **Playwright/browser MCP** to exercise the actual reader, capture screenshots and compare against the issue mock-up. Check the full acceptance matrix below; fix issues and repeat within this PR. Run lint, build, unit tests, E2E suite and coverage checks; commit evidence/results to PR description or test report.

**Touched files expected:** `StoryMapSheet.svelte`, `apps/web/src/components/__tests__/StoryMapSheet.test.ts`, `packages/e2e/tests/story-map.spec.ts`, and this plan. No compiler, flow graph, translations, database, backend, mobile-native, asset, artwork or sound work.

## End-to-end acceptance matrix (automated; no human sign-off)

- [ ] **Desktop geometry / mock-up:** In MCP browser at **1440×900**, opening Story Map yields a modal ~95vw wide / 85vh tall, with **no sidebar**. The header has title, right card and close; map viewport is approximately **1320 px wide** after padding. Capture a screenshot and visually compare against the issue's proposed desktop mock-up.
- [ ] **Breakpoint geometry:** At **1024×768**, modal still measures 95% of viewport width (not clipped by wrapper padding). Card stays next to title/close, with no horizontal header overflow.
- [ ] **Current + five selected kinds:** With no node selected, MCP verifies act, line and three stats; select run, scene, decision, ending and unread marker to verify their exact mapped content. For valid run/scene/decision/ending selections, clicking Jump navigates to the **same** scene and start/end position as before. Unread selection reveals no future story content and has no Jump.
- [ ] **Decision chips:** At desktop widths, 1-, 2-, 3- and 4-option decisions show the right number of chips and blue/teal/grey status dots; long option text truncates rather than overlapping Jump or Close. The dot's status is accessible using existing localized strings. No duplicate status sentences or spoiler text appear.
- [ ] **Stable map surface:** MCP records `story-map-surface` bounding box, `scrollLeft` / `scrollTop` and SVG/layout bounds before switching between node selections; **surface geometry and map position remain unchanged** by selecting nodes. Existing locate and run expand/collapse still work and retain focus behavior.
- [ ] **Mobile / landscape mock-up:** MCP runs at **390×844** and **844×390**. The 92 px card sits below the title/close row, decision chips are hidden, the prompt and Jump remain reachable, and the map fills the height freed by removing the sidebar. Capture screenshots of current and decision states; compare against the issue's phone mock-up. Legend, locate and map scroll stay usable.
- [ ] **Locales:** MCP browser checks **en, zh and ja** card variants, including long translated labels, without overflow or broken action labels; screenshots exist for each relevant responsive layout.
- [ ] **Accessibility / focus:** `aria-live="polite"` remains on the card; tab focus stays inside the dialog; Escape/scrim close work; closing or jumping restores focus to the appropriate reader opener; buttons remain keyboard accessible.
- [ ] **Real user flow:** Playwright tests in existing `packages/e2e/tests/story-map.spec.ts` pass on **Chromium, mobile Chrome and mobile Safari** for opening after a real branching choice, seeing unread destinations as “?”, jumping to the choice prompt, reopening and closing the sheet. A screenshot visual check is performed through MCP; one browser-platform result is sufficient for non-platform-specific behavior, and **no native mobile acceptance** is required.
- [ ] **Quality gate:** component tests, story-map Playwright tests, lint, build and coverage checks pass. No changed backend code means no new backend E2E suite is needed.

Suggested project commands (from existing scripts):

```bash
bun --filter web test
bun --filter e2e test:e2e tests/story-map.spec.ts --workers=1
bun lint
bun run build
```

Capture test screenshots or Playwright report artifacts for the PR as evidence; do not substitute a human acceptance step for the automated browser/MCP checks.

## Explicit non-goals and risks

- **No map fitting/scaling**, layout algorithm changes, node/edge style redesign or changes to scrolling/locate logic. Wider viewport simply exposes more of the unchanged natural-size graph.
- **No new graph/progress state or API**, no new Svelte component abstraction unless duplication emerges, no locale rewrites, no art/SFX, no parallel PR.
- **Responsive collision risk at exactly 1024 px:** 95vw plus close button/card/title can compete for width; use flex shrink and truncation, and verify via browser geometry instead of introducing a new breakpoint.
- **Fixed-height decision risk:** very long prompts or translated option labels can overflow; clamp prompt, elide option chips, keep 44 px Jump target. Verify actual screenshots.
- **Test coupling:** existing E2E asserts a visible text status line and sidebar bounding box; that is intentionally replaced by compact dots/accessible names and status-card geometry. Keep the functional navigation assertion intact.

The approval gate for implementation is the design in this file and the ticket mock-up; this draft PR is **not** a claim that implementation or MCP validation has already been completed.
