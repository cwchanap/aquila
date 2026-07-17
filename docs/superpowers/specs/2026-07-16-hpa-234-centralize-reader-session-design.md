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
reads/writes the store. `ReaderManager` never becomes reactive. The existing
`readerState.reset()` must also reset `dialogueIndex` to `0` so a reset never
leaves a stale index.

Reader-mode preference (text vs visual) is intentionally **not** part of this
state, so swapping modes never forks a save.

A pure validator centralizes bounds checking:

```ts
validateSessionState(state, flow, dialogue): ReaderSessionState | null
```

It checks story existence (flow present), scene existence (node in flow), and
locale ∈ {en, zh}. For `dialogueIndex`: a **non-negative** number is **clamped**
into `[0, dialogue.length-1]`; a negative number, `NaN`, or non-number makes the
whole state `null`. Thus an over-range `dialogue=999` clamps to the last line
(friendly), while a malformed/zero/negative value is structurally invalid and
falls through per the precedence rules. Restore, popstate, and persisted-state
migration share this one validator. `flow` and `dialogue` are passed as
parameters (not imported inside the helper), so per-precedence-tier unit tests
can stub them without mocking the `@aquila/stories` module.

**One source of truth, no mirror.** `readerState` already holds
`storyId`/`currentSceneId`/`locale` fields that duplicate `ReaderManager`'s
private `currentState` (`reader-manager.ts:21`). `ReaderManager` **drops the
`currentState` mirror** and reads story/scene/locale from `readerState`. Every
write path — restore, `goToScene`, `onIndexChange`, `popstate` — updates the
`readerState` fields in one place, so navigation/bookmark/scene-data methods can
never operate on a stale mirror.

### Section 2 — Controlled reader contract & ReaderShell

Both `NovelReader` and `MobileNovelReader` (and the future `VisualReader`) become
controlled components. They stop owning `currentDialogueIndex` and instead
consume/report it through props:

```ts
interface ControlledReaderProps {
  dialogueIndex: number;                  // the active line (forwarded by ReaderShell)
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

**ReaderShell shrinks** to a thin responsive switch with no index state, but it
becomes the **reactive bridge** between the store and the controlled readers:

```svelte
<script>
  import { readerState } from '@/lib/reader-state.svelte';
  // ReaderManager mounts ReaderShell once with non-reactive props. Because
  // ReaderShell is a Svelte component, it derives the index reactively from the
  // store and forwards it as a prop — so popstate/onIndexChange updates flow
  // through without ReaderManager needing to re-push props.
  // The WRITE side (onIndexChange) is supplied by the orchestrator as a prop,
  // keeping URL/history/persistence logic out of the component.
  let { onIndexChange, ...sharedProps } = $props();
  let dialogueIndex = $derived(readerState.dialogueIndex);
</script>

{#if isMobile}
  <MobileNovelReader {...sharedProps} {dialogueIndex} {onIndexChange} />
{:else}
  <NovelReader {...sharedProps} {dialogueIndex} {onIndexChange} />
{/if}
```

`ReaderManager` (a plain-TS class) calls `mount()` exactly once; it cannot push
updated prop values afterward. `ReaderShell`, being a Svelte component,
re-derives `dialogueIndex` from `readerState` via `$derived` (the **read** side),
so any store mutation — `onIndexChange`, `popstate` restore, `goToScene` —
propagates to the leaf readers automatically. The **write** side
(`onIndexChange`) is supplied by the orchestrator as a prop, so URL/history and
persistence logic stay in the unit-testable `ReaderManager`, not in the
component. The leaf readers (`NovelReader`/`MobileNovelReader`) remain pure
controlled components: they read `dialogueIndex` as a prop and emit
`onIndexChange`, never importing the store directly. (`dialogue`/`choice`/etc.
also flow through `ReaderShell` from `readerState` as props, so leaf readers hold
no store import at all.)

The `MOBILE_QUERY` matchMedia listener stays (to swap which reader mounts), but
`liveIndex`, `hasSwapped`, `effectiveInitialDialogueIndex`, and the
`onIndexChange` interception are deleted. Both readers receive the same
`dialogueIndex`, so a breakpoint swap preserves the exact line for free. The
`initialDialogueIndex` prop is removed entirely — initial seeding happens once in
the orchestrator before mount, so there is no initial-index callback clobbering a
bookmark to guard against.

**Desktop history must derive from the index.** Today `NovelReader` accumulates
a `displayedDialogues` array (`NovelReader.svelte:68-72`) back-filled only by the
initial-index effect (`NovelReader.svelte:129-133`). Under the controlled model a
`popstate` can jump `dialogueIndex` within the same scene (e.g. 5 → 3, or 0 → 5)
without the dialogue array reference changing, so the scene-reset effect would
not fire and `displayedDialogues` would disagree with the index (six lines shown
while index says 3). The desktop reader must therefore derive its visible history
from the index, exactly as `MobileNovelReader` already does with
`backlogLines = dialogue.slice(0, currentDialogueIndex + 1)`
(`MobileNovelReader.svelte:268`). The `displayedDialogues` accumulator is
deleted.

**History rendering (no active-line duplication).** Completed lines are
`dialogue.slice(0, dialogueIndex)` (indices **strictly before** the active line).
The active line at `dialogueIndex` is rendered **separately**, showing
`typingText` + cursor while `isTyping`, and the full text once typing completes.
This avoids the duplication that would occur from slicing *through* the active
index and then rendering it again. (Equivalently: render one list
`slice(0, dialogueIndex + 1)` where only the final item is in the "active"
state.)

**External index jumps snap, not animate.** When `dialogueIndex` changes for a
reason other than the reader's own advance — `popstate`, breakpoint swap, initial
restore — the typewriter must reconcile: cancel any in-flight typewriter (bump
the `sceneVersion`/generation token), set `isTyping = false`, and set
`typingText` to the target line's full text immediately (**snap**, no animation).
The leaf reader distinguishes self-initiated changes from external ones via a
flag it sets immediately before calling `onIndexChange`; only self-initiated
advances animate the typewriter. This guarantees a `popstate` jump from line 5 to
line 3 (or 0 → 5) shows the correct full line with no stale typewriter running,
on both desktop and mobile.

### Section 3 — ReaderManager orchestration & URL/history

`ReaderManager` narrows to behavior, delegating progression to `readerState`:

- **Restore** (`initialize`): runs the precedence resolver once, writes the
  resolved `ReaderSessionState` into `readerState` (storyId, sceneId, locale,
  dialogueIndex), loads scene dialogue/choice, then mounts the shell.
- **Index glue**: passes the static action props (`onChoice`, `onBookmark`,
  `onNext`, `onNavigate`, `backUrl`) plus its orchestrator-owned `onIndexChange`
  into the mounted `ReaderShell`. `ReaderShell` derives `dialogueIndex`
  reactively from `readerState` (read side) and forwards both as props to the
  leaf readers. The orchestrator's `onIndexChange(i)` is the single write path:
  it sets `readerState.dialogueIndex = i`, schedules a throttled URL
  `replaceState`, and schedules a debounced localStorage persist. Navigation
  actions (`handleNext`, `handleChoice`, `onNavigate`) call a shared
  `goToScene(sceneId)` that resets `dialogueIndex` to 0, pushes scene data into
  the store, and does a `pushState`. `goToScene` **flushes** any pending
  throttled `replaceState` before its `pushState`, so the scene being left
  records its accurate last line position (Back lands on the right line, not a
  stale one).

  **Flush vs cancel is decided per call site, not globally:**
  - `goToScene` → **flush** (preserve the accurate line for Back).
  - `popstate` → **cancel** (the queued `replaceState` would otherwise mutate the
    *destination* history entry after navigation has already switched to it,
    corrupting it with the old scene's line position).
  - `pagehide`/`visibilitychange=hidden` → **flush** (so the URL is correct if
    the tab is later restored).

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
and write the restored state into `readerState`. The handler **cancels any
pending throttled `replaceState`** first, so the browser-driven entry is not
overwritten by a stale queued line-position write. If the scene differs from
current, reload scene dialogue; always restore the exact validated
`dialogueIndex`. The reader is a full-page Astro app (`reader.astro` constructs
the manager on `DOMContentLoaded` with no SPA teardown), so `popstate`,
`pagehide`, and `visibilitychange` listeners live for the page lifetime and are
reaped on page unload — there is no explicit `destroy()` call site.

**Initial-seed race, solved:** the orchestrator seeds
`readerState.dialogueIndex` to the resolved value *before* the shell mounts, and
the controlled reader simply renders `props.dialogueIndex`. There is no feedback
loop to clobber — the bookmark value is already canonical when first render
happens.

**Persistence cadence:** localStorage writes are debounced (~500ms) on
`onIndexChange`, plus an immediate write on scene change and on
`pagehide`/`visibilitychange=hidden`. The `pagehide`/`visibilitychange=hidden`
handler also **flushes any pending throttled `replaceState`** so the URL is
correct if the user later restores the tab via history. Avoids per-keystroke
writes while guaranteeing the latest line survives a refresh or tab close.

### Section 4 — Restore precedence, legacy migration & testing

**Restore precedence** (single pure function `resolveInitialState`, in order):

1. **Valid explicit URL params** — if the URL carries a valid `story` (flow
   exists), the URL tier **wins and fully resolves**, never falling through to
   persisted state. Fields are resolved independently:
   - `story` = url story (required for this tier).
   - `scene` = url `scene` if it is a node in that story's flow; otherwise the
     story's `start` scene. (Covers story-only links like the story cards'
     `?story=THE_SEVENTH_MIRROR` at `stories/index.astro:67`, and story+scene
     links from bookmarks without `[dlg:N]`.)
   - `dialogueIndex` = url `dialogue=N` clamped into bounds if present and
     non-negative; otherwise `0`.
   A URL with an *invalid* story (no flow) does not lock the tier and falls
   through. This makes story-card and bookmark links deterministic — they never
   accidentally resume an unrelated persisted session.
2. **Explicit bookmark restoration** — a bookmark URL/link carrying
   `dialogue=N`. Handled via the same URL path: bookmarks parse `[dlg:N]` from
   the name and build a `…reader?story=&scene=&dialogue=N` href
   (`bookmarks-manager.ts:254` parse, `bookmarks-manager.ts:285-287` href build),
   so tier 2 genuinely folds into tier 1. Authenticated and anonymous
   (`LocalBookmarksStore`) bookmarks are unaffected — only *resolution* of where
   to start moves into the central resolver.
3. **Valid persisted session state** — fires only when the URL has **no** valid
   `story`. localStorage `aquila:readerState:{locale}` now stores
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
| `validateSessionState` / `resolveInitialState` | Unit | Each precedence tier, fallthrough, bounds clamping (over-range clamps; negative/zero/NaN → invalid), locale mismatch, invalid story/scene; `flow`/`dialogue` injected so no `@aquila/stories` mock needed |
| Partial-URL precedence | Unit | story-only → story start, no persisted fallthrough; story+scene (no dialogue) → that scene, index 0; invalid story → falls through to persisted/default |
| Single source of truth | Unit | `handleNext`/`handleBookmark`/`getSceneData` read from `readerState` (no `currentState` mirror); invoke next/bookmark after a `popstate` restore and assert they operate on the restored scene |
| URL serialize/parse round-trip | Unit | `dialogue=N` ↔ index, throttle behavior, `pushState` vs `replaceState` calls, flush-on-`goToScene`, cancel-on-`popstate`, flush-on-`pagehide` |
| `popstate` restore | Unit (jsdom) | Back/forward restores exact line; invalid URL falls back safely; scene reload on mismatch; pending `replaceState` cancelled |
| `NovelReader` controlled contract | Component (`NovelReader.test.ts`) | Renders `dialogueIndex` prop; `onIndexChange` fires on advance/back; **tap during typing does NOT call `onIndexChange`**; visible history = `slice(0, index)` + active line (no duplication); **external index jump snaps full text and cancels typewriter** |
| `MobileNovelReader` controlled contract | Component (`MobileNovelReader.test.ts`) | Renders `dialogueIndex` prop; `onIndexChange` fires on advance/goBack; tap during typing does not call `onIndexChange`; external index jump snaps; backlog derives from index |
| Reactive propagation | Component (`ReaderShell.test.ts`) | `dialogueIndex` prop updates when `readerState` mutates (popstate/onIndexChange) without remount; breakpoint swap preserves exact line |
| Regression | Existing | Bookmarks (auth + local), choices, locale routing, scene progression — keep green |

`reader-manager.test.ts`, `ReaderShell.test.ts`, `NovelReader.test.ts`, and
`MobileNovelReader.test.ts` are updated to the controlled contract. New pure
helpers get dedicated unit tests. A short **architecture note** documents:
`readerState` owns progression; `ReaderManager` orchestrates; readers are
controlled; URL = scene→pushState / line→replaceState.

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
