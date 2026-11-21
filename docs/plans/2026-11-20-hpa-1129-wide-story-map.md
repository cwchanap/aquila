# HPA-1129 — Wide story-map sheet and responsive header status card

**Status:** Revised after the [2026-11-21 review](https://github.com/cwchanap/aquila/pull/143#pullrequestreview-6003775657). Still docs-only; implement all UI/test changes in **this same PR**.

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
| `scene` | Act label, optional “current position”, Jump | `onJump(selection.sceneId, 'start')` |
| `decision` | Decision/option count, up-to-two-line localized prompt; one small option chip per option on desktop, each with colored/dotted status indicator; Jump | Existing `onJump(precedingSceneId, 'end')` when preceding scene exists; deliberately drop **both** the long visible status line **and** `option.child.label` destination act from the sidebar (revealed destinations already appear on map nodes/edges); preserve accessible chip status |
| `ending` | “Ending {label}”, `Read this ending again` | `onJump(ending.sceneId, 'start')` |
| `unknown` | “Not read yet” | No jump control or spoiler content |

Use existing `option.child.kind`/`.status`: route = blue, explored = teal, unknown = grey dotted. Render each option label once, truncating visually as needed, and compose an **`sr-only` status + label** via existing `sm.withBranch.replace('{label}', status).replace('{branch}', option.label)`, where `status` is `sm.yourRoute`, `sm.explored` or `sm.unreadLabel`. Reuse en/zh/ja Story Map keys; no new strings. Header accent is blue for current/route acts, teal for explored acts/endings, amber for decisions, grey for unknown. Keep one small in-file `statusStyles` lookup keyed `route | explored | unread | decision` for the card/chips (not a new module or global graph-refactor).

**Accessibility:** Keep `aria-modal`, title association, `focusTrap`, Escape capture, scrim close and opener focus restoration. Put `aria-live="polite"` on the card; use semantic headings, buttons and the translated `sr-only` chip statuses above. Hidden mobile chips must not create focus targets. No new translation keys.

## One-PR implementation sequence (review-revised)

**Preflight, not a separate task:** reconfirm latest `main`, ticket and branch state, then run existing focused tests. All commits and review fixes remain in **PR #143**.

1. **CI assertions first (red on old UI).** Extend `packages/e2e/tests/story-map.spec.ts` with browser measurements: 95vw modal at 1440 and 1024 px, fixed card height and `scrollHeight <= clientHeight` / `scrollWidth <= clientWidth`, visible Jump bounds, and invariant `story-map-surface` rectangle/scroll offsets across selections. Use reduced motion and settle scrolling before comparison. Move the existing `expectNoHorizontalOverflow(page)` from `reader-crossroads.spec.ts` to `packages/e2e/tests/utils.ts` for reuse.
2. **Share real choice fixtures.** Move `VARIANTS` + `choiceAfter` from `reader-crossroads.spec.ts` into `utils.ts` (or a small shared test helper if cleaner), retaining its checked expected option counts. Use `train_adventure` `act3` (2 options), `b1b_act8` (3), and `b1a_b2b_b3b_b4b_b5a_act70` (4) in Story Map tests. Before opening the map, `MobileReaderPage.seedVisitedScenes` must include the preceding scene and **one child**: the map hides choices until passed. The single-option `b1a_b2a_act8` remains covered by Crossroads; it is a **linear Story Map link**, not a decision card, and must stay that way.
3. **Header + component tests in one commit.** Modify only `StoryMapSheet.svelte`'s modal/header/details presentation: remove conflicting wrapper `lg:p-8` and sheet `lg:max-w-5xl`, use `lg:w-[95vw] lg:max-w-none lg:h-[85vh]`; move existing six `selection` cases to one `data-testid="story-map-status-card"` in the header, remove sidebar and `lg:flex-row`. In the same commit rename `details()` to `statusCard()` in `StoryMapSheet.test.ts` and update the selector. Drop the old sidebar-fold test half; on-map run pill/collapse test remains unchanged. Keep map/legend/locate/aria/focus logic intact.
4. **Chips, accents and fixed responsive card.** Use 84 px height desktop and 92 px mobile, one DOM tree per selection case, CSS-only `lg` responsive layout. Make decision chips share that tree but hide with CSS below `lg`; derive classes through the tiny in-file status mapping and accessible option statuses through `sm.withBranch`/`sr-only`. Deliberately remove the sidebar's visible destination-act labels/status sentences. Unit/component tests verify DOM content, count, accessible text, callbacks and `aria-live`—**not** computed layout in happy-dom, which has no Tailwind layout engine.
5. **Complete repeatable Playwright coverage.** Replace `story-map-details` references and obsolete sidebar geometry assertions in `story-map.spec.ts`. Check 2–4 option chips, overflow, right-aligned header and Jump bounds at 1024, card/surface stability across current/decision/unknown and completed ending fixture, no horizontal page overflow, mobile chip hiding at 390×844 / 844×390, and en/zh/ja text without clipping. `testInfo.attach` **only three screenshots** to the Playwright report: desktop four-option decision, phone decision, phone current. Avoid committing screenshot files or `toHaveScreenshot` baselines that vary by OS.
6. **MCP-driven E2E and visual acceptance.** Run the actual reader choice → map → decision Jump → reopen/close with Playwright/browser MCP. Perform one compact automated visual comparison with the ticket's proposed desktop/phone interactive HTML mock-up; record evidence in PR discussion. CI Playwright owns the durable quantitative assertions, while MCP supplies required end-to-end + visual acceptance—not a dozen locale/viewport screenshot sets.
7. **Quality gate before ready.** Run `bun --filter web test`, targeted Story Map + Crossroads E2E, `bun lint`, `bun run build`, and available GitHub checks. `.github/workflows/e2e-tests.yml` **skips draft PRs**, so the workflow result is required once marked ready. `vitest.config.ts` has **no numeric coverage threshold**, so report coverage if available but don't invent a coverage gate.

**Expected touched files:** `StoryMapSheet.svelte`, `apps/web/src/components/__tests__/StoryMapSheet.test.ts`, `packages/e2e/tests/story-map.spec.ts`, `packages/e2e/tests/reader-crossroads.spec.ts`, `packages/e2e/tests/utils.ts` and this plan. No backend, compiler, graph/layout, translations, database, asset, art, SFX or native-platform changes.

## End-to-end acceptance matrix (automated, including MCP)

- [ ] **CI desktop geometry:** In Chromium at **1440×900** and **1024×768**, modal width = 95vw (±2px), height = 85vh, card sits between title and close, sidebar is absent, and `expectNoHorizontalOverflow` succeeds; natural map bounds remain unchanged.
- [ ] **CI selection/jumps:** Current, run, scene, decision, completed ending and unread card states show their correct contents. Jump actions retain the original target and `start`/`end` semantics; unread remains spoiler-safe with no Jump. On-map run expansion/collapse, locate, focus trap, Escape, scrim and `aria-live` continue working.
- [ ] **CI map stability:** After settling initial auto-scroll, capture `story-map-surface` rectangle and scrollLeft/scrollTop plus graph SVG dimensions; switching selection current → decision → unknown and, in a completed-ending fixture, ending does not change them. Folding a run is a separate intentional layout change and is not subject to this invariant.
- [ ] **CI decision chip fixtures:** Share real Crossroads variants for 2/3/4-option Story Map cards, seeding visited path through a choice plus one child. Assert exactly N chips, visible route/explored/unread status dots, accessible `sm.withBranch` status text and no future-branch spoilers. The existing one-option fixture is only a Crossroads/linear-link regression, **not** a map decision-card case.
- [ ] **CI no silent clipping:** For each card state, 2–4 option decisions and en/zh/ja locale cases, card `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth`; Jump/button bounding box remains **fully inside** the card. Stress the four-option **84 px card at 1024 px** and two-line prompt **92 px card at 390 px**, including focus and long translated text. Visual ellipsis alone is not enough.
- [ ] **CI mobile/landscape:** At **390×844** and **844×390**, card is below title/close with fixed 92 px height, decision chips actually hidden by CSS (verify in real browser, not happy-dom), prompt and Jump visible, map gets freed height, and legend/locate/scroll remain usable. Existing Playwright browser projects suffice; no native app acceptance.
- [ ] **Unit/component tests:** One markup tree per selected kind. Verify semantic content, chip counts, translated accessible status strings, `aria-live`, jump callback arguments and keyboard/focus behavior. Keep existing on-map fold regression; delete sidebar-specific tests rather than replacing them with CSS-class assertions.
- [ ] **Lightweight screenshot evidence:** `testInfo.attach` desktop four-option decision, phone decision and phone current into the existing Playwright report; **no** screenshot baselines or en/zh/ja × viewport screenshot matrix. Locale clipping remains assertive CI coverage.
- [ ] **MCP E2E + visual acceptance:** Use Playwright/browser MCP to exercise one real story-choice-to-map-to-Jump-and-close journey, then visually check desktop and phone states **against `story-map-wide-mockup.html` from Linear**. Record the result in the PR. This is the required MCP-driven acceptance; deterministic CI assertions protect future changes. One browser platform is enough, no native acceptance.
- [ ] **Quality gate:** Web component tests, updated Story Map/Crossroads Playwright suites, lint, build, and GitHub E2E CI pass after PR leaves Draft. No backend changes and no configured numeric coverage threshold.

Suggested commands:

```bash
bun --filter web test
bun --filter e2e test:e2e tests/story-map.spec.ts tests/reader-crossroads.spec.ts --workers=1
bun lint
bun run build
```

The Vercel preview reports deployment status only; E2E GitHub Actions currently skips draft PRs.

## Explicit non-goals and risks

- **No map fitting/scaling**, layout algorithm changes, node/edge style redesign or changes to scrolling/locate logic. Wider viewport simply exposes more of the unchanged natural-size graph.
- **No new graph/progress state or API**, no new Svelte component abstraction unless duplication emerges, no locale rewrites, no art/SFX, no parallel PR.
- **Responsive collision risk at exactly 1024 px:** 95vw plus close button/card/title can compete for width; use flex shrink and truncation, and verify via browser geometry instead of introducing a new breakpoint.
- **Fixed-height decision risk:** long prompts and localized labels may overflow; clamp text while retaining the 44 px Jump target. `overflow-hidden` can silently clip buttons or focus rings: assert card scroll dimensions and button bounds in CI plus MCP visual check.
- **Test coupling:** existing E2E asserts visible status/destination lines and sidebar geometry; replace those intentionally with dots, `sr-only` status and status-card geometry. Preserve real navigation and map-fold tests.
- **Single-option behavior:** the map builder treats one-option choices as linear links. Do **not** extend graph semantics to manufacture one-option status-card coverage.

This docs-only draft is **not** a claim that implementation, CI or MCP end-to-end/visual acceptance has completed. No human sign-off is an acceptance criterion.
