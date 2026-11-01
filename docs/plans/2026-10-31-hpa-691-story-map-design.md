# HPA-691 — Branching Story Map (Sky Glass)

Status: proposed design and implementation plan. Implement this feature **in this same draft PR** after design review; do not open a second PR for the ticket.

- Linear: https://linear.app/cwchanap/issue/HPA-691/add-a-branching-story-map-to-the-aquila-reader-sky-glass-style
- Style reference: https://claude.ai/artifact/P5bW5LEP9r4pAv5MfioEjD#style-e (option E, Sky Glass)
- Original design exploration: https://claude.ai/artifact/ATv2awsU92WqHSARtFbTLg

## Decision and scope

Add a reader-only branching story map for stories with **at least one choice with 2+ outcomes**. It displays visited acts as a left-to-right tree, hides unexplored content behind `?`, and jumps to visited acts, decisions, and endings. The existing Acts panel remains unchanged.

Supported: `train_adventure` (The Platform at the End of the World) and the five branching shorts. Hidden for `dont_save_me_before_midnight` and `the_seventh_mirror`. Treat choices with one option as links, never forks.

Keep this implementation simple:

- A pure TypeScript graph builder and layout helper; render with native SVG in one Svelte sheet.
- Use existing compiled `FlowConfig` and localized `ChoiceMap`. No compiler changes, database, third-party graph/layout dependency, or new global store.
- Keep progress in existing `StoryProgressStore`, reader position in existing `readerState`/`ReaderManager`, and sheet visibility in `ReaderShell`.
- No new artwork, animation assets, SFX, or BGM. The pulse effect is CSS-only and disabled with reduced motion.
- Target a focused change (the issue suggests roughly 750 lines including tests), but prefer correct, readable behavior to an artificial line limit.

## Current architecture confirmed on `main`

| Existing seam | Current behavior | Minimal change |
| --- | --- | --- |
| `packages/stories/src/flow-types.ts` | Scene nodes link by `next`; choice nodes expose `choiceId` / `nextByOption` | Read as-is |
| `packages/stories/src/types.ts` | `ChoiceMap` provides prompts, labels, and destination scenes | Make active map available to the sheet |
| `apps/web/src/lib/story-progress-store.ts` | Persists one position plus all reached ending IDs per story | Add optional visited-scene IDs |
| `apps/web/src/lib/reader-manager.ts` | `goToScene(sceneId)` pushes one history entry; `applySession` loads active flow | Optional `at: 'start' | 'end'` jump and active choices |
| `apps/web/src/lib/reader-state.svelte.ts` | Canonical reactive progression and active flow | Add/reset `activeChoices` runtime payload only |
| `apps/web/src/components/ReaderShell.svelte` | Chooses the text/mobile/visual leaf, owns settings overlay | Own map sheet, disable underlying leaf while open |
| `apps/web/src/components/ReaderSettingsMenu.svelte` | Closes then awaits `tick()` before invoking bookmark/mode actions | Same close-then-open pattern |
| `apps/web/src/components/MobileNovelReader.svelte` | Phone text mode has its own chrome while settings popup is hidden | Add conditional Map icon alongside Acts/History |

The generated `elevator_game` flow has a straightforward decision: `act1 → act2 → act3 → choice:choice_act3`, then two distinct `act4` endings. Use it as the E2E fixture. The existing supported flows are trees with no merge points, per the issue's content inventory; do not build a general DAG layout engine.

## Visibility and spoiler contract

1. Read visited scene IDs from progress, then union them with reached `endings` and saved/current scene IDs. Close this set over ancestors from the flow root. A saved record lacking `visited` still displays the ancestor path to the saved act.
2. A **run** is the longest sequence of scenes connected by `next` or a single-option choice. Split at a real choice (2+ options) or a terminal scene.
3. Show visited acts; never render unread act names, scene IDs, ending titles, or undiscovered outcomes.
4. At an unpassed decision, show a single `?` continuation after the last read act, with no decision marker or warning that a fork exists.
5. Once an option from that decision is visited, show the decision and *all* option labels already presented there. A visited option continues into its revealed run; every unvisited option ends in `?`.
6. At the frontier of a run, show `?` when more scenes remain, a hidden decision follows, or an ending has not yet been completed. Show the ending marker only when that terminal scene ID is in progress `endings`.
7. Color route = root-to-current path, explored = other visited path, unread = `?`. Current act is always unfolded. Collapse other visited runs to `Act N` / `Acts N–M` until selected.
8. Reuse `extractActName`, `actLabel` and `actSortKey` from `act-navigation.ts`, including the translated Final/Epilogue labels.

Do not leak node counts or unknown branch destinations in the detail panel. Stats count only discovered acts, passed decisions and reached endings.

## Pure builder and layout

Create `apps/web/src/lib/story-map.ts`:

- `hasRealDecision(flow)` scans choice nodes for 2+ outgoing options.
- `buildStoryMap({ flow, choices, visited, endings, savedSceneId, currentSceneId, t })` returns an immutable view model containing revealed acts/runs, visible decisions/option labels, endings, unknowns, route/explored status, and minimal scene IDs for legal jumps.
- Index nodes by ID; traverse from `flow.start`. Follow single-option choices as linear edges. Construct parent links for ancestor closure and the current route. Collapse an unexplored frontier **before** branching/ending information is exposed. Ignore unreachable nodes.
- Keep the view-model types narrow; avoid a second persistent graph or generalized graph abstractions. Use scene IDs and choice IDs as stable keys.
- `layoutStoryMap(tree, expandedRunIds, metrics)` returns positioned nodes and labeled SVG edges plus bounds. Horizontal placement follows visible depth; the current route occupies row 0. Allocate side rows post-order (deepest decisions first) with a shared trunk for siblings. Use bezier branches. Expanding one run increases only its horizontal footprint.
- Recompute on opening the sheet, selection/reveal changes or run expansion; no caching/workers are justified for the current 495-scene Platform graph.

The visual model, branch visibility rules and layout are unit-testable without DOM. UI interactions never mutate the compiled flow.

## Sky Glass sheet and interaction

Create `apps/web/src/components/StoryMapSheet.svelte`. `ReaderShell` passes the active flow, localized choices, story title, current scene/index, translations and `onJump(sceneId, at)`. Read the saved progress when the sheet opens.

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
- In `ReaderManager.applySession` set `readerState.activeChoices = payload.choices`; clear it on state reset and when a story is unloaded. Keep it runtime-only, outside the serialized reader session.
- `ReaderSettingsMenu` exposes “Story map” only when `hasRealDecision(activeFlow)`; close settings, await `tick()`, then call `onOpenStoryMap`.
- Phone text mode gets a Map icon in its existing chrome with the same eligibility guard. Close chrome before opening the parent-owned sheet.
- `ReaderShell` owns `storyMapOpen`. Add it to `leafDisabled` and render the sheet outside the inert reader leaf. Closing/reopening returns focus to a stable opener. Do not introduce another dialog state owner.

**Accepted trade-off:** jumping backward updates the saved Continue position, but previously visited acts remain in the map. No furthest-position banner or position snapshot in this ticket.

## Implementation order — one PR

1. **Model and persistence:** introduce `story-map.ts`, add `visited?: string[]` to `StoryProgress` and append unique scene IDs in `record()`. Let existing records without the field load; no migration or key/version bump. Test the visibility algorithm on small fork and Platform-sized fixtures.
2. **Reader wiring:** expose the localized active `ChoiceMap` and add the optional end-of-scene navigation argument. Test correct last-line selection, storage and history semantics.
3. **Presentation:** add `StoryMapSheet.svelte`; connect settings and mobile chrome to `ReaderShell`, then wire jump callbacks and inert/focus behavior. Keep styling co-located in the component.
4. **Localization and proof:** ship en/zh/ja keys, unit/component tests, a focused Playwright smoke and manual desktop/mobile checks. Keep implementation commits on this draft PR; mark ready only after the acceptance checks pass.

## Test and acceptance checklist

**Pure model / layout**

- [ ] No map for linear stories; one-option choices do not count as forks.
- [ ] Fresh start, middle of run, decision not yet passed, passed decision with unread labeled option, fully explored alternatives.
- [ ] Hidden endings until completed; reached ending marker; ancestor closure for old records without `visited`.
- [ ] Current route versus explored coloring; no leaked unknown act names or branch destinations; Platform-sized fixture.
- [ ] Row-0 current route, deepest-first side rows, sibling trunk, expansion affects only the expanded run width.

**Persistence / navigation**

- [ ] `visited` records scenes only once, per story; existing progress records load unchanged.
- [ ] `goToScene(id, 'end')` lands on the final line and pushes one history entry; Back restores the prior scene/line.
- [ ] A jump changes Continue to the destination without erasing visited history.

**UI / end-to-end**

- [ ] Settings entry appears in desktop text/visual and phone visual modes only for branching stories.
- [ ] Phone text chrome exposes the map; both entry points work with sheet close, focus, Escape and inert reader behavior.
- [ ] Fold/unfold, selection, locate-current, and detail panel work with keyboard, reduced motion, zh/ja labels and small viewports.
- [ ] Text, phone text and visual jumps to decisions expose the intended prompt.
- [ ] `packages/e2e/tests/story-map.spec.ts`: use `elevator_game`, reach its first decision, choose a route, reopen the map, see an unread alternative as `?`, jump to the decision and see its prompt.
- [ ] Existing Acts panel, progress and reader tests remain green.

Verification commands:

```bash
bun --filter web test
bun --filter e2e test:e2e tests/story-map.spec.ts --workers=1
bun lint
bun run build
```

Manual: Platform desktop and phone viewport, an unfolded long run and a side branch two decisions deep; zh/ja text and reduced-motion setting.

## Deferred / explicitly excluded

No compiler tree validator, no new story content, no desktop Phaser parity, no hiding unread items in the pre-existing Acts panel, no general DAG/reconvergence support, no furthest-position marker/Return banner, no alternative list layout, no generated art or audio, and no database work. Revisit only if actual playtesting demonstrates a need.
