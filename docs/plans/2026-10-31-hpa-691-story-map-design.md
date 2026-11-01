# HPA-691 — Branching Story Map (Sky Glass)

Status: proposed design and implementation plan. Implement this feature **in this same draft PR** after design review; do not open a second PR for the ticket.

- Linear: https://linear.app/cwchanap/issue/HPA-691/add-a-branching-story-map-to-the-aquila-reader-sky-glass-style
- Style reference: https://claude.ai/artifact/P5bW5LEP9r4pAv5MfioEjD#style-e (option E, Sky Glass)
- Original design exploration: https://claude.ai/artifact/ATv2awsU92WqHSARtFbTLg

## Decision and scope

Add a reader-only branching story map for stories with **at least one choice with 2+ outcomes**. It displays visited acts as a left-to-right tree, hides unexplored content behind `?`, and jumps to visited acts, decisions, and endings. **For branching stories, the existing Acts panel and mobile Acts drawer must also hide unvisited acts**: otherwise they reveal future acts and allow skip-ahead jumps that defeat the map's spoiler rules. This intentionally removes skip-ahead from branching stories; linear stories retain their existing Acts-panel navigation.

Supported: `train_adventure` (The Platform at the End of the World) and the five branching shorts. Hidden for `dont_save_me_before_midnight` and `the_seventh_mirror`. Treat choices with one option as links, never forks.

Keep this implementation simple:

- A pure TypeScript graph builder and layout helper; render with native SVG in one Svelte sheet.
- Use existing compiled `FlowConfig` and localized `ChoiceMap`. No compiler changes, database, third-party graph/layout dependency, or new global store.
- Keep progress in existing `StoryProgressStore`, reader position in existing `readerState`/`ReaderManager`, and sheet visibility in `ReaderShell`. Reuse one pure scene-visibility helper for both the map and existing Acts navigation; no extra state owner.
- No new artwork, animation assets, SFX, or BGM. The pulse effect is CSS-only and disabled with reduced motion.
- Target a focused change (the issue suggests roughly 750 lines including tests), but prefer correct, readable behavior to an artificial line limit.

## Current architecture confirmed on `main`

| Existing seam | Current behavior | Minimal change |
| --- | --- | --- |
| `packages/stories/src/flow-types.ts` | Scene nodes link by `next`; choice nodes expose `choiceId` / `nextByOption` | Read as-is |
| `packages/stories/src/types.ts` | `ChoiceMap` provides prompts, labels, and destination scenes | Make active map available to the sheet |
| `apps/web/src/lib/story-progress-store.ts` | Persists one position plus all reached ending IDs per story | Add optional visited-scene IDs |
| `apps/web/src/lib/reader-manager.ts` | `goToScene(sceneId)` pushes one history entry; `applySession` loads active flow; line persistence is debounced by 500 ms | Optional `at: 'start' | 'end'` jump, active choices, and a synchronous current-progress snapshot callback that flushes pending position writes |
| `apps/web/src/lib/reader-state.svelte.ts` | Canonical reactive progression and active flow | Add/reset `activeChoices` runtime payload only |
| `apps/web/src/components/ReaderShell.svelte` | Chooses the text/mobile/visual leaf, owns settings overlay, and renders Settings *outside* the inert reader subtree | Own map sheet, derive eligibility/visible acts once, disable reader leaf **and Settings trigger** while open; restore focus after unlock |
| `apps/web/src/lib/act-navigation.ts` | `buildChapterData` builds full Acts lists for desktop and mobile | Optional visible-scene filter **before** choosing/grouping act candidates |
| `apps/web/src/components/ActPanel.svelte` / `MobileActDrawer.svelte` | Both call `buildChapterData` | Accept the same optional allowlist passed through the controlled reader leaves |
| `apps/web/src/components/ReaderSettingsMenu.svelte` | Closes then awaits `tick()` before invoking bookmark/mode actions | Same close-then-open pattern |
| `apps/web/src/components/MobileNovelReader.svelte` | Phone text mode has its own chrome while settings popup is hidden | Add conditional Map icon alongside Acts/History |

The generated `elevator_game` flow has a straightforward decision: `act1 → act2 → act3 → choice:choice_act3`, then two distinct `act4` endings. Use it as the E2E fixture. The compiler's directory-tree builder (`packages/stories/src/compiler/build-graph.ts`) connects choices to child directories and links chapters from terminal tails; current generated flows have no merges, so a general DAG engine or additional tree validator is unnecessary. Do **not** reuse `packages/game/src/StoryProgressionMap.ts`: it is Phaser-specific and lacks the reader's spoiler/reveal contract.

## Visibility and spoiler contract

1. Start from `progress.visited ?? []` and the **current scene ID only**; close this set over ancestors from the flow root. This supports direct links and bookmarks to a scene without retroactively reconstructing older visits. Reached `endings` are not automatically considered visited; they only control completion markers for terminal scenes already in the visible set.
2. A **run** is the longest sequence of scenes connected by `next` or a single-option choice. Split at a real choice (2+ options) or a terminal scene.
3. Show visited acts; never render unread act names, scene IDs, ending titles, or undiscovered outcomes.
4. At an unpassed decision, show a single `?` continuation after the last read act, with no decision marker or warning that a fork exists.
5. Once an option from that decision is visited, show the decision and *all* option labels already presented there. A visited option continues into its revealed run; every unvisited option ends in `?`.
6. At the frontier of a run, show `?` when more scenes remain, a hidden decision follows, or an ending has not yet been completed. Show the ending marker only when that terminal scene ID is in progress `endings`.
7. Color route = root-to-current path, explored = other visited path, unread = `?`. Current act is always unfolded. Collapse other visited runs to `Act N` / `Acts N–M` until selected.
8. Reuse `extractActName`, `actLabel` and `actSortKey` from `act-navigation.ts`, including the translated Final/Epilogue labels.

Do not leak node counts or unknown branch destinations in the detail panel. Stats count only visible acts, passed decisions and visible terminal scenes whose IDs are in `endings`.

**Existing Acts navigation:** For map-eligible branching stories, use exactly the same visible-scene allowlist for `ActPanel` and `MobileActDrawer`. Pass an optional `ReadonlySet<string>` into `buildChapterData(flow, currentSceneId, t, visibleSceneIds?)`; filter scene candidates **before** grouping or choosing branch matches. Do not show unread act labels or offer a jump to an unread act. The existing skip-ahead affordance is deliberately removed **only** for branching stories. For straight-line stories, omit the filter and preserve the current Acts panel. A direct URL or server bookmark to a later scene is explicit navigation; the current-scene ancestor closure reveals that path.

## Pure builder and layout

Create `apps/web/src/lib/story-map.ts`:

- `hasRealDecision(flow)` scans choice nodes for 2+ outgoing options.
- `visibleSceneIds(flow, progress, currentSceneId)` returns the visited/current ancestor-closed scene-ID set, shared by the map and Acts navigation. It must not expose undiscovered paths.
- `buildStoryMap({ flow, choices, progress, currentSceneId, t })` consumes that shared visible set and returns an immutable view model containing revealed acts/runs, visible decisions/option labels, endings, unknowns, route/explored status, and minimal scene IDs for legal jumps.
- Index nodes by ID; traverse from `flow.start`. Follow single-option choices as linear edges. Use parent links for ancestor closure and the current route. Collapse an unexplored frontier **before** branching/ending information is exposed. Ignore unreachable nodes.
- Keep the view-model types narrow; avoid a second persistent graph or generalized graph abstractions. Use scene IDs and choice IDs as stable keys.
- `layoutStoryMap(tree, expandedRunIds, metrics)` returns positioned nodes and labeled SVG edges plus bounds. Horizontal placement follows visible depth; the current route occupies row 0. Allocate side rows post-order (deepest decisions first) with a shared trunk for siblings. Use bezier branches. Expanding one run increases only its horizontal footprint.
- Recompute on opening the sheet, selection/reveal changes or run expansion; no caching/workers are justified for the current 495-scene Platform graph.

The visible-set calculation, branch reveal rules and layout are unit-testable without DOM. UI interactions never mutate the compiled flow. The existing Acts panel consumes only the allowed IDs; it does not implement its own spoiler logic.

## Sky Glass sheet and interaction

Create `apps/web/src/components/StoryMapSheet.svelte`. `ReaderShell` passes the active flow, localized choices, story title, current scene/index, translations, latest per-story progress and `onJump(sceneId, at)`. The sheet and Acts panels use the **same** progress/visibility snapshot. **Do not read localStorage directly on open:** the reader's final-line progress may still be waiting for its 500 ms debounced write, so a completed ending can otherwise appear as `?` until the sheet is reopened. `ReaderShell` obtains the authoritative snapshot through `ReaderManager.getCurrentStoryProgressSnapshot()` **before** setting `storyMapOpen = true`. Refresh on story/scene changes too, but not every dialogue-index change; use `untrack` around manager reads in a Svelte effect to keep the debounce intact. No new reactive progress store is needed.

- On phones: full-screen sheet; on desktop: large centered rounded sheet. Sky gradient `#bae6fd → #7dd3fc → #60a5fa`. Frosted scrollable map surface with `bg-white/55` and white ring.
- Paths: route blue-to-cyan gradient (6px); explored teal (4.5px); unknown slate dotted (2.5px). Sibling options emerge from one trunk.
- Nodes: white visited act dot; larger blue current dot with a CSS halo and “You are here”; amber decision diamond; dashed slate `?`; teal-ring ending with amber star; pill for folded run; clear option labels only after a choice has been passed.
- Details: white panel on the right at desktop width, beneath the map on phones. Default shows current act, line X/Y and discovered stats; selection shows decision prompt and known option statuses, act/ending jump, folded-run expand hint, or “Not read yet” without jump.
- Selecting a run unfolds it; the current run is always expanded. On open and on “Locate current”, scroll the current node into view, preferably right-aligned. Both map axes are scrollable.
- Accessibility: real focusable nodes (Enter/Space and 44px hit targets), meaningful labels, selected-state indication, `aria-live="polite"` for details, focus trap, Escape to close and focus restoration. Reuse `focusTrap`; never use `innerHTML`.

Translations: add the story-map labels together under `reader` in `en.json`, `zh.json`, and `ja.json`. Use existing act labels instead of duplicating numbering logic.

## Jump contract and overlay wiring

- Act: `goToScene(sceneId)` => first line.
- Decision: `goToScene(sceneBeforeDecision, 'end')` => last line of its preceding act. The choice prompt appears after the line has finished typing, in text/mobile/visual modes.
- Ending: jump to the first line of its known ending act.
- In `ReaderManager.goToScene`: flush any pending line URL replace, load the destination dialogue, set the index via `clampIndex` (0 for start, last line for end), then `syncUrl(false)` and `persist()` **once**. A jump produces one new browser history entry, not one per line skipped.
- In `ReaderManager.applySession` set `readerState.activeChoices = payload.choices`; clear it in both `readerState.reset()` and the `ReaderManager` constructor's explicit initialization, and on story unload. Keep it runtime-only, outside the serialized reader session.
- Expose `getCurrentStoryProgressSnapshot(): StoryProgress | null` as a synchronous `ReaderManager` → `ReaderShell` prop, next to existing `onNavigate` / `onIndexChange`. When the active payload is ready, use existing `flushPendingReplace()` to synchronize a queued line URL replacement. If a 500 ms `persistTimer` is pending, clear it and call existing `persist()` **once** to record the canonical scene/index and ending (no `pushState`); then return `storyProgress.get(readerState.storyId)`. If no save is pending, just return the existing record. Do not introduce a second writer, event bus or reactive progress store. `ReaderShell` calls this before opening the map and shares the resulting snapshot with the Acts filter.
- `ReaderShell` derives `storyMapAvailable` **once** from the active flow using `hasRealDecision`. Pass a boolean and optional `onOpenStoryMap` callback to the controlled settings/mobile components instead of having either component inspect the flow.
- `ReaderSettingsMenu` exposes “Story map” only when `storyMapAvailable`; close settings, await `tick()`, then call `onOpenStoryMap`.
- Phone text mode gets a Map icon in its existing chrome when eligible. Close chrome before opening the parent-owned sheet.
- `ReaderShell` also calculates `visibleSceneIds` for branching stories and passes an optional allowlist through `NovelReader`, `VisualNovelReader` and `MobileNovelReader` into `ActPanel` / `MobileActDrawer`. No storage reads inside the controlled leaves. For linear stories pass no filter.
- `ReaderShell` owns `storyMapOpen`. Add it to `leafDisabled` and render the sheet outside the inert reader leaf. **Also** update the sibling `ReaderSettingsMenu` prop to `triggerUnavailable={storyMapOpen || (leafOverlayOpen && !isBlocking)}` (or equivalent), because Settings is rendered outside `readerReadyElement` and otherwise remains keyboard/assistive-tech activatable behind the modal. Keep the existing `disabled`/`tabindex={-1}` enforcement in `ReaderSettingsMenu` and prevent a second dialog. On close, clear `storyMapOpen`, await `tick()` so Settings is enabled again, then restore focus to the persistent desktop `reader-settings-trigger` or mobile `mobile-reader-menu-trigger` as appropriate. Reuse `focusTrap`; do not add an overlay manager.

**Accepted trade-off:** jumping backward updates the saved Continue position, but previously visited acts remain in the map. No furthest-position banner or position snapshot in this ticket.

## Implementation order — one PR

1. **Model and persistence:** introduce `story-map.ts` (`hasRealDecision`, `visibleSceneIds`, `buildStoryMap`, `layoutStoryMap`), add `visited?: string[]` to `StoryProgress` and append unique scene IDs in `record()`. Keep the field optional without migration/version bump; do not reconstruct historical visits. Unit-test a small fork plus the real Platform flow; smoke-test all existing catalog flows.
2. **Reader wiring:** expose the localized active `ChoiceMap`, the optional end-of-scene navigation argument, and `getCurrentStoryProgressSnapshot()` across the existing manager → shell boundary. Test correct last-line selection, flushing the pending debounce, storage and history semantics.
3. **Presentation and localization:** add the en/zh/ja translation keys **before** implementing `StoryMapSheet.svelte` (the `Translations` type derives from `en.json`); connect settings and mobile chrome to `ReaderShell`, pass the visibility filter to existing Acts panels, open from a flushed progress snapshot, and wire jump callbacks, both reader/Settings modal locks and focus restoration. Keep styling co-located in the component.
4. **Proof:** component tests plus a focused Playwright smoke on **all three browser projects** and manual visuals/locale checks. Keep implementation commits on this draft PR; mark ready only after the acceptance checks pass.

## Test and acceptance checklist

**Pure model / layout**

- [ ] No map for linear stories; one-option choices do not count as forks.
- [ ] Fresh start, middle of run, decision not yet passed, passed decision with unread labeled option, fully explored alternatives.
- [ ] Hidden endings until completed; reached ending marker; ancestor closure for direct links and server bookmarks.
- [ ] Current route versus explored coloring; no leaked unknown act names or branch destinations; **real** Platform flow via `getStoryFlow('train_adventure')`.
- [ ] Build and lay out each flow from `STORY_CATALOG` (via `@aquila/stories/catalog`) with every scene visited, using `getStoryFlow` / `getStoryContent`; no hand-maintained large synthetic fixture.
- [ ] Row-0 current route, deepest-first side rows, sibling trunk, expansion affects only the expanded run width.

**Persistence / navigation**

- [ ] `visited` records scenes only once, per story. No historical-visit reconstruction or old-record migration test.
- [ ] `goToScene(id, 'end')` lands on the final line and pushes one history entry; Back restores the prior scene/line.
- [ ] A jump changes Continue to the destination without erasing visited history.
- [ ] **Immediate-ending regression:** with fake timers, change to the final line of a known terminal scene and open the map **before** the 500 ms save fires. The snapshot, ending marker and completed-ending count must already reflect completion; later timers must not add duplicate writes or browser-history entries.

**UI / end-to-end**

- [ ] Settings entry appears in desktop text/visual and phone visual modes only for branching stories.
- [ ] Phone text chrome exposes the map; both entry points work with sheet close, focus, Escape and inert reader behavior.
- [ ] **Sibling Settings lock:** while the map is open, the separate Settings trigger is disabled, non-tabbable and cannot open a second modal even through programmatic activation; after close/unlock, focus returns to the desktop Settings trigger or the stable mobile menu toggle.
- [ ] Fold/unfold, selection, locate-current, and detail panel work with keyboard, reduced motion, zh/ja labels and small viewports.
- [ ] Text, phone text and visual jumps to decisions expose the intended prompt.
- [ ] For branching stories, both Acts panels expose **only** allowed/visited scenes (no future act labels and no skip-ahead navigation). Verify that linear stories retain their existing unrestricted Acts lists.
- [ ] Add `story-map` to the `mobile-chrome` / `mobile-safari` `testMatch` in `packages/e2e/playwright.config.ts` (currently only `reader-(mobile|visual)`). The new spec must run in **chromium, mobile-chrome and mobile-safari**.
- [ ] `packages/e2e/tests/story-map.spec.ts`: deep-link to the **last valid line** of `elevator_game` `act3`, then choose a route, open the map, verify an unread option remains `?`, jump back and see the choice prompt. Branch the opener on `testInfo.project.name`: desktop Settings versus mobile text chrome; test phone opener close/focus handling. Reuse the actual act3 dialogue length instead of a guessed index.
- [ ] Existing reader, Acts-panel (with new branching filter), progress and other E2E tests remain green.

Verification commands:

```bash
bun --filter web test
bun --filter e2e test:e2e tests/story-map.spec.ts --workers=1
bun lint
bun run build
```

Manual: Platform desktop and phone viewport, an unfolded long run and a side branch two decisions deep; visual-mode opener, zh/ja text and reduced-motion setting.

## Deferred / explicitly excluded

No compiler tree validator, no new story content, no desktop Phaser parity, no further redesign of the existing Acts panels **beyond the branching-story spoiler filter**, no general DAG/reconvergence support, no furthest-position marker/Return banner, no alternative list layout, no generated art or audio, and no database work. Revisit only if actual playtesting demonstrates a need.
