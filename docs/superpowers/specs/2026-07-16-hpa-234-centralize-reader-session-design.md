# Centralize Aquila reader session and URL state

Linear: [HPA-234](https://linear.app/cwchanap/issue/HPA-234/centralize-aquila-reader-session-and-url-state)
Date: 2026-07-16
Status: Approved

## Goal

Create one canonical reader-session state model before visual mode (HPA-228)
and asynchronous story loading (HPA-232) independently modify the reader area.
This task owns progression state and browser synchronization only. It does not
add visual-novel presentation or dynamic story imports.

## Problem (current state)

Progression is distributed across six owners with no single source of truth:

| Location | Owns | Reactive? |
| --- | --- | --- |
| `ReaderManager` (TS class) | `currentState` (storyId/sceneId/locale), `initialDialogueIndex` (one-shot bookmark seed), localStorage, URL parse/serialize, navigation/bookmark actions | No |
| `readerState` (Svelte `$state` singleton) | `dialogue`, `choice`, `currentSceneId`, `storyId`, `canGoNext`, `locale` | Yes |
| `NovelReader.svelte` / `MobileNovelReader.svelte` | `currentDialogueIndex` (local `$state(0)`) — the de-facto active-line owner, duplicated in both | Yes |
| `ReaderShell.svelte` | `liveIndex`/`hasSwapped`/`effectiveInitialDialogueIndex` — a fragile feedback loop to survive the mobile/desktop swap | Yes |
| URL (`story`/`scene`/`dialogue`) | Parsed on load only; `pushState` on scene change; **no `popstate` handler exists**; dialogue index never written to URL | n/a |
| localStorage `aquila:readerState:{locale}` | `{storyId, sceneId, locale}` — no dialogue index | n/a |

The active dialogue index has no canonical owner; browser back/forward does not
restore reader state; the breakpoint-swap coordination is a race-prone feedback
loop; and precedence between URL, bookmark, persisted state, and defaults is
implicit and untested.

## Design decisions

Two architectural forks were resolved:

1. **Canonical state home** — Extend the existing `readerState.svelte.ts`
   singleton to own `dialogueIndex`, making it the full reactive progression
   owner. `ReaderManager` stays a plain-TS orchestrator that reads/writes the
   reactive store. (Chosen over a new `ReaderSession` module or a reactive
   `ReaderManager`.)

2. **Reader index contract** — Props-driven controlled readers. Reader
   components receive `dialogueIndex` and call `onIndexChange(newIndex)`,
   rather than binding to the store directly. Explicit, unit-testable, matches
   the issue's "controlled component" language, and gives HPA-228's future
   `VisualReader` a drop-in contract. (Chosen over direct store binding.)

## Architecture

### Section 1 — Canonical session state & ownership

```ts
interface ReaderSessionState {
  storyId: string;
  sceneId: string;
  dialogueIndex: number; // zero-based active line; validated to [0, dialogue.length-1]
  locale: Locale;
}
```

`dialogueIndex` is the **zero-based index of the active line**, matching the
internal `currentDialogueIndex` the readers already use. The URL `dialogue=N`
param (1-based "N lines shown") is translated to/from this at the serialization
boundary: `index = N - 1`, `N = index + 1`.

`readerState.svelte.ts` gains `dialogueIndex: number = $state(0)`. It already
holds `dialogue`/`choice`/`currentSceneId`/`storyId`/`canGoNext`/`locale`, so
adding `dialogueIndex` makes it the full reactive progression owner. `readerState`
remains the single reactive store; `ReaderManager` remains the orchestrator that
owns behavior (restore, navigation, URL sync, persistence, popstate) and
reads/writes the store. `ReaderManager` never becomes reactive.

Reader-mode preference (text vs visual) is intentionally **not** part of this
state, so swapping modes never forks a save.

A pure validator centralizes bounds checking:

```ts
validateSessionState(state, flow, dialogue): ReaderSessionState | null
```

It checks story existence (flow present), scene existence (node in flow),
locale ∈ {en, zh}, and dialogueIndex bounds. Returns a valid (possibly clamped)
state or `null`. Restore, popstate, and persisted-state migration share this one
validator.

### Section 2 — Controlled reader contract & ReaderShell

Both `NovelReader` and `MobileNovelReader` (and the future `VisualReader`) become
controlled components. They stop owning `currentDialogueIndex` and instead
consume/report it through props:

```ts
interface ControlledReaderProps {
  dialogueIndex: number;                  // the active line (read from store)
  onIndexChange: (index: number) => void; // report forward/back navigation
  // ...existing props: dialogue, choice, onChoice, onBookmark, onNext,
  //    onNavigate, locale, backUrl, showBookmarkButton
}
```

- The component renders the line at `dialogueIndex`. It does not keep a local
  `currentDialogueIndex = $state(0)`.
- On advance/return (click, Enter, tap, the mobile back-one-line button), the
  component calls `onIndexChange(newIndex)` instead of mutating local state.
- Typewriter/typing UX state (`isTyping`, `typingText`, `skipTyping`,
  `sceneVersion`) stays **component-local** — presentation, not progression. The
  scene-reset effect keys off the `dialogue` array reference change as today,
  but resets typing rather than the index.
- The bookmark callback reports `dialogueIndex + 1` (existing 1-based
  convention), sourced from the canonical index rather than
  `displayedDialogues.length`.

**ReaderShell shrinks** to a thin responsive switch with no index state:

```svelte
{#if isMobile}
  <MobileNovelReader {...sharedProps} {dialogueIndex} {onIndexChange} />
{:else}
  <NovelReader {...sharedProps} {dialogueIndex} {onIndexChange} />
{/if}
```

The `MOBILE_QUERY` matchMedia listener stays (to swap which reader mounts), but
`liveIndex`, `hasSwapped`, `effectiveInitialDialogueIndex`, and the
`onIndexChange` interception are deleted. Both readers read the same
`readerState.dialogueIndex`, so a breakpoint swap preserves the exact line for
free. The `initialDialogueIndex` prop is removed entirely — initial seeding
happens once in the orchestrator before mount, so there is no initial-index
callback clobbering a bookmark to guard against.

### Section 3 — ReaderManager orchestration & URL/history

`ReaderManager` narrows to behavior, delegating progression to `readerState`:

- **Restore** (`initialize`): runs the precedence resolver once, writes the
  resolved `ReaderSessionState` into `readerState` (storyId, sceneId, locale,
  dialogueIndex), loads scene dialogue/choice, then mounts the shell.
- **Index glue**: passes `dialogueIndex={readerState.dialogueIndex}` and
  `onIndexChange` into the mounted `ReaderShell`. `onIndexChange(i)` is the
  single write path: sets `readerState.dialogueIndex = i`, schedules a throttled
  URL `replaceState`, and schedules a debounced localStorage persist. Navigation
  actions (`handleNext`, `handleChoice`, `onNavigate`) call a shared
  `goToScene(sceneId)` that resets `dialogueIndex` to 0, pushes scene data into
  the store, and does a `pushState`.

**URL/history strategy — three tiers:**

| Event | History action | URL params |
| --- | --- | --- |
| Scene change (next/choice/act-nav) | `pushState` (new history entry) | `story`, `scene`; `dialogue` reset to `1` |
| Dialogue line advance/return | `replaceState` (no new entry), **throttled** via rAF coalescing | `story`, `scene`, `dialogue=N` |
| `popstate` (back/forward) | browser-driven | parse → validate → restore exact line |

This gives navigable per-scene history without one entry per line. The rAF
throttle batches multiple rapid line advances into a single `replaceState` per
frame, so holding Enter does not spam history.

**`popstate` handler** (new): on browser back/forward, parse
`story`/`scene`/`dialogue` from the URL, run them through the same validator,
and write the restored state into `readerState`. If the scene differs from
current, reload scene dialogue; always restore the exact validated
`dialogueIndex`. Registered in `initialize`, removed on teardown.

**Initial-seed race, solved:** the orchestrator seeds
`readerState.dialogueIndex` to the resolved value *before* the shell mounts, and
the controlled reader simply renders `props.dialogueIndex`. There is no feedback
loop to clobber — the bookmark value is already canonical when first render
happens.

**Persistence cadence:** localStorage writes are debounced (~500ms) on
`onIndexChange`, plus an immediate write on scene change and on
`pagehide`/`visibilitychange=hidden`. Avoids per-keystroke writes while
guaranteeing the latest line survives a refresh or tab close.

### Section 4 — Restore precedence, legacy migration & testing

**Restore precedence** (single pure function `resolveInitialState`, in order):

1. **Valid explicit URL params** — `story`+`scene`+`dialogue` that pass
   validation (story has flow, scene is a node, dialogueIndex in bounds). URL
   wins so direct links are deterministic.
2. **Explicit bookmark restoration** — a bookmark URL/link carrying
   `dialogue=N`. Handled via the same URL path (bookmarks encode `[dlg:N]` into
   links), so it folds into tier 1. Authenticated and anonymous
   (`LocalBookmarksStore`) bookmarks are unaffected — only *resolution* of where
   to start moves into the central resolver.
3. **Valid persisted session state** — localStorage
   `aquila:readerState:{locale}` now stores
   `{storyId, sceneId, dialogueIndex, locale, version}`. Validated against
   current flow + dialogue bounds; locale must match the page locale.
4. **Story start/default** — `getStoryFlow(storyId).start ?? 'act1'`,
   dialogueIndex 0.

Each tier falls through to the next on invalid/partial data; a safe fallback
always updates persisted state so stale data self-heals.

**Legacy migration.** The existing `purgeLegacyState()` (clears
`aquila:currentScene`, `aquila:currentScene:en/zh`) stays. The reader-state
schema gains a numeric `version` field (`version: 2`). The loader: if the stored
object is missing `dialogueIndex` or `version < 2`, treat it as legacy — keep
storyId/sceneId if still valid, default dialogueIndex to 0, rewrite as v2. No
data loss for existing users.

**Testing strategy:**

| Area | Type | Coverage |
| --- | --- | --- |
| `validateSessionState` / `resolveInitialState` | Unit | Each precedence tier, fallthrough, bounds clamping, locale mismatch, invalid story/scene |
| URL serialize/parse round-trip | Unit | `dialogue=N` ↔ index, throttle behavior, `pushState` vs `replaceState` calls |
| `popstate` restore | Unit (jsdom) | Back/forward restores exact line; invalid URL falls back safely; scene reload on mismatch |
| Controlled reader contract | Component | `onIndexChange` fires on advance/back; renders `dialogueIndex` prop; no local index state |
| Breakpoint swap | Component (`ReaderShell.test.ts`) | Preserve exact line across mobile/desktop swap (now trivial) |
| Regression | Existing | Bookmarks (auth + local), choices, locale routing, scene progression — keep green |

`reader-manager.test.ts` and `ReaderShell.test.ts` are updated to the new
contract. New pure helpers get dedicated unit tests. A short **architecture
note** documents: `readerState` owns progression; `ReaderManager` orchestrates;
readers are controlled; URL = scene→pushState / line→replaceState.

## Deliverables mapping

- Typed canonical reader-session state and validation helpers — Section 1.
- Shared controlled-reader index contract — Section 2.
- Refactored `ReaderManager` / `readerState` ownership with one source of truth — Sections 1 & 3.
- URL serialization, parsing, precedence, and `popstate` handling — Sections 3 & 4.
- Legacy state migration or cleanup behavior — Section 4.
- Unit tests for restore precedence, bounds, mode/breakpoint swaps, and browser navigation — Section 4.
- Regression tests for bookmarks, choices, locale, and scene progression — Section 4.
- Short architecture note describing state ownership — Section 4.

## Non-goals

- Visual novel UI or image loading (HPA-228).
- Reader-mode selection UI.
- Dynamic story imports (HPA-232).
- Cloudflare R2 or publishing work.
- Cross-device cloud synchronization of reader progress.
