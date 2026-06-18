# Mobile Story Reader — Design Spec

**Date:** 2026-06-17
**Status:** Approved (brainstorming) — ready for implementation planning
**Scope:** A phone/tablet-first visual-novel reading experience for the story reader, delivered as a responsive layer over the existing web reader.

---

## 1. Summary

Add a **purpose-built, touch-first visual-novel (VN) reader** that activates below the
Tailwind `lg` breakpoint (`max-width: 1023px`). Below the breakpoint the reader presents
**one dialogue line at a time** in a bottom text panel with a name plate and typewriter
effect; the user **taps anywhere to advance**; chrome (back / acts / bookmark / progress)
**auto-hides** for immersive reading; act/chapter navigation is a **slide-in drawer**; and a
**swipe-up backlog** lets the reader re-read the current scene. At and above `lg` (≥1024px),
the existing desktop `NovelReader` is used unchanged.

This is a **responsive web** feature on the existing `/[locale]/reader` route — no native
app, no separate URL.

### Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Delivery | Responsive web reader (same route, breakpoint-driven) |
| Ambition | Purpose-built touch reading mode (not a light responsive pass) |
| Presentation | Classic VN single panel (one line at a time + backlog) |
| Controls | Auto-hiding immersive chrome |
| Architecture | Shell + separate `MobileNovelReader` (Option A), with shared-logic extraction |
| Breakpoint | Tailwind `lg`: mobile VN below 1024px, desktop at ≥1024px |

---

## 2. Goals / Non-Goals

### Goals

- A native-feeling VN reading experience on phones and tablets (and narrow desktop windows).
- Tap-anywhere-to-advance with typewriter skip-on-first-tap.
- Immersive, auto-hiding chrome; act/chapter drawer; current-scene backlog.
- Keep the desktop reader stable: touch only well-bounded, testable shared logic.
- Full i18n parity (`en` + `zh`) and accessible controls.

### Non-Goals (YAGNI)

- Native / Tauri mobile packaging.
- Cross-scene global reading history (data model is per-scene).
- Character sprites, backgrounds, or audio (content model is text-only).
- Reader settings (text size, typing speed).
- Horizontal swipe between scenes.

These are noted as possible future enhancements, not built now.

---

## 3. Architecture

### 3.1 Component & module structure

| File | Status | Responsibility |
|---|---|---|
| `apps/web/src/lib/reader-manager.ts` | edit (minimal) | Mount `ReaderShell` instead of `NovelReader`; props unchanged |
| `apps/web/src/components/ReaderShell.svelte` | **new** | Reactive `matchMedia('(max-width: 1023px)')` → render `MobileNovelReader` or `NovelReader`; pass through all props + shared `readerState` |
| `apps/web/src/components/MobileNovelReader.svelte` | **new** | VN presentation: text panel, tap-to-advance, chrome, choices, state |
| `apps/web/src/components/MobileActDrawer.svelte` | **new** | Off-canvas act/chapter navigation drawer |
| `apps/web/src/components/MobileBacklogSheet.svelte` | **new** | Swipe-up history sheet for the current scene |
| `apps/web/src/lib/act-navigation.ts` | **new** | Pure chapter/act parsing extracted from `ActPanel.svelte` (chapters-vs-branches), shared by desktop panel + mobile drawer |
| `apps/web/src/lib/typewriter.ts` | **new** | Callback-based `typeText(...)` used by both readers |
| `apps/web/src/lib/character-name.ts` | **new** | `resolveCharacterName(entry, t)` extracted from `NovelReader.svelte` |
| `apps/web/src/components/ActPanel.svelte` | edit | Consume `lib/act-navigation.ts`; rendering unchanged |
| `apps/web/src/components/NovelReader.svelte` | edit (minimal) | Consume `lib/typewriter.ts` + `lib/character-name.ts`; behavior preserved |

The only desktop code touched lives in the three extracted helpers (`act-navigation`,
`typewriter`, `character-name`) — all pure / well-bounded and covered by existing + new unit
tests, so the desktop path stays stable.

### 3.2 Shared module contracts

**`lib/typewriter.ts`**

```ts
export interface TypewriterOptions {
  text: string;
  speed: number;                  // ms per character
  onTick: (partial: string) => void;
  isSkipped: () => boolean;       // user requested skip → reveal full text immediately
  isCancelled: () => boolean;     // scene changed → abort without finalizing
}

// Resolves 'done' when the full text has been emitted (onTick called with full text),
// or 'cancelled' if isCancelled() became true mid-run.
export async function typeText(opts: TypewriterOptions): Promise<'done' | 'cancelled'>;
```

Each component keeps its own Svelte `$state` (`typingText`, `skipTyping`, `sceneVersion`)
and passes closures; reactivity stays in the components, the helper stays pure/testable.

**`lib/character-name.ts`**

```ts
import type { DialogueEntry } from '@aquila/stories';

// Moved verbatim from NovelReader.getCharacterName:
//  1. entry.character (author override / alias / role label) wins
//  2. else entry.characterId → t.characterNames[id] (fallback t.reader.unknown)
//  3. else '' (narration)
export function resolveCharacterName(
  entry: DialogueEntry | undefined,
  t: ReturnType<typeof import('@aquila/stories').getTranslations>
): string;
```

**`lib/act-navigation.ts`**

Pure functions extracted from `ActPanel.svelte` (no behavior change): `buildChapterData`,
`extractActName`, `extractChapterKey`, `extractChapterNum`, `actLabel`, `actSortKey`,
`extractBranchPrefix`, `branchMatchScore`, `chapterLabel`, and the `PanelData` /
`ChapterGroup` / `ActInfo` types. Both `ActPanel.svelte` (desktop) and
`MobileActDrawer.svelte` render from this shared data; the two components keep their own
(push vs off-canvas) markup. Label helpers that depend on translations take `t` as a param.

### 3.3 Breakpoint & switching

- **Breakpoint:** `max-width: 1023px` (below Tailwind `lg`). Phones, tablets, and narrow
  desktop windows → mobile VN; ≥1024px → existing `NovelReader`.
- **`ReaderShell`** computes `isMobile` synchronously from `matchMedia(query).matches` at
  mount (no desktop→mobile flash; the whole reader is client-mounted via `ReaderManager`),
  and subscribes to the media-query `change` event to update reactively. The
  `{#if isMobile}` swap remounts the active reader.
- **Crossing the breakpoint** mid-read (rotate / resize) remounts the active reader.
  Scene/story persist via `readerState` + `localStorage`; the **transient line position
  resets to scene start**. This is rare and accepted. Preserving the line index across the
  swap is an optional future nice-to-have, not built now.
- `ReaderShell` guards `typeof window === 'undefined'` and defaults `isMobile = false` if
  `matchMedia` is unavailable.

---

## 4. Mobile UX

### 4.1 Screens (portrait-first, full-screen)

- **Background:** existing sky gradient (`from-sky-200 via-sky-300 to-blue-400`), full-bleed.
- **Text panel** (anchored bottom; glassmorphism `bg-white/90 backdrop-blur-md`;
  rounded-top; respects `env(safe-area-inset-bottom)`):
  - **Name plate** — speaker name in a pill, stacked **above** the dialogue text (no desktop
    side column). Hidden when there is no speaker (narration).
  - **Dialogue text** — current line, large readable serif, typewriter effect with a blinking
    cursor while typing.
  - **Continue hint** — a subtle pulsing ▼ at the panel's bottom-right when the line is fully
    typed and more lines remain.
- **Tap-to-advance layer** — a full-screen region above the background/text panel but below
  chrome and any open overlay. Implemented as a real `<button>` (see Accessibility).
- **Auto-hiding chrome** — hidden while reading. A small persistent menu affordance toggles a
  translucent top bar with: back (→ `backUrl`), acts/menu (opens the drawer), bookmark, and a
  compact progress indicator (`line x/N` within scene + act label). Controls do not advance;
  an advance-tap in the reading area also dismisses the bar.
- **Act drawer** (`MobileActDrawer`) — off-canvas from the left (~80% width) + scrim.
  Selecting a scene calls `onNavigate(sceneId)` and closes the drawer. Dismiss via scrim tap,
  close button, or `Escape`.
- **Backlog sheet** (`MobileBacklogSheet`) — swipe-up from the text panel (or a history
  affordance) opens a scrollable list of the **current scene's** revealed lines (name + text),
  newest at the bottom. Dismiss via swipe-down, scrim tap, or close button. Backlog is derived
  from `dialogue.slice(0, currentDialogueIndex + 1)`. *(Cross-scene history is out of scope.)*

### 4.2 State (in `MobileNovelReader`)

Mirrors the desktop reader's proven pattern plus mobile UI flags:

- Reading: `currentDialogueIndex`, `isTyping`, `typingText`, `skipTyping`, `sceneVersion`.
- UI: `chromeVisible`, `drawerOpen`, `backlogOpen`.
- **Scene-change reset** reuses the dialogue-ref-change `$effect` (when the `dialogue` array
  reference changes: reset index to 0, clear typing state, bump `sceneVersion`).
- **`initialDialogueIndex`** (bookmarks / deep links) applies once on mount by setting
  `currentDialogueIndex` directly to the clamped target (single-panel needs no accumulation;
  backlog derives from the index). Uses the same "consume once" guard as desktop so it is not
  re-applied on later scene changes.

### 4.3 Interaction rules

**Tap on the reading area:**

1. If an overlay (drawer or backlog) is open → the tap closes it; no advance.
2. If `isTyping` → set `skipTyping = true` (first tap completes the current line).
3. Else if `currentDialogueIndex < dialogue.length - 1` → advance index and type next line.
4. Else (last line):
   - if a `choice` is present → choices are shown; do not advance.
   - else if `canGoNext` → call `onNext()` (manager navigates to next scene).
   - else → end of story (manager surfaces the existing alert).

**Choices:** at the last line with a `choice`, full-width stacked buttons replace the panel
content; tapping calls `onChoice(option.nextScene)`. Tap-to-advance is disabled while choices
are shown.

**Bookmark:** chrome bookmark button calls `onBookmark(currentDialogueIndex + 1)`, matching
the desktop `[dlg:N]` offset semantics (`dialogue=N` → index `N-1`).

**Keyboard:** Enter / Space still advance via a window `keydown` handler (external keyboards,
accessibility), reusing the desktop guard that ignores interactive/editable targets.

---

## 5. Internationalization

- All new UI strings added to **both** `packages/stories/src/translations/en.json` and
  `zh.json` under `reader.*`, simultaneously.
- **Reuse** existing keys: `bookmark`, `continue`, `nextScene`, `complete`, `unknown`,
  `actPanel`, `actLabel`, `actFinal`, `actEpilogue`, `chapterLabel`, `openActsPanel`,
  `closeActsPanel`, `pageDisplay`, and `common.backToHome`.
- **New keys** (final names finalized in implementation): backlog/history title; "tap to
  continue" a11y label; open-menu / close-menu labels; optionally a line-progress label if
  `pageDisplay` ("Page {current} of {total}") doesn't fit the VN framing.

---

## 6. Accessibility

- The reading area is a real `<button>` with a translated `aria-label` ("tap to continue"),
  not a bare `div`; Enter / Space advance via the window `keydown` handler.
- Drawer and backlog: focus trap, `Escape` closes, background `inert` (mirrors the existing
  `ActPanel` pattern).
- Tap targets ≥44px.
- `prefers-reduced-motion` disables slide and pulse animations. (Text still types — it is
  content, not motion — but can be made instant under reduced motion if desired.)
- Chrome toggle and all controls are keyboard-reachable and labeled.

---

## 7. Testing

### Unit (Vitest / jsdom)

- `lib/act-navigation.ts` — chapters-vs-branches parsing (migrate and extend the existing
  `ActPanel.test.ts` coverage).
- `lib/typewriter.ts` — `done`, `cancelled`, and skip paths.
- `lib/character-name.ts` — `character` override, `characterId` lookup, unknown, narration.
- `MobileNovelReader.test.ts` — line render, tap advances, tap skips typing, choices render +
  select, last-line → `onNext`, bookmark number, drawer/backlog open-close, `initialDialogueIndex`
  jump.
- `ReaderShell.test.ts` — `matchMedia` mock renders mobile vs desktop and switches on the
  `change` event.
- Existing `NovelReader.test.ts`, `ActPanel.test.ts`, and `reader-manager*.test.ts` must stay
  green after the helper extractions (desktop regression guard).

### E2E (Playwright)

- **Add a mobile project** to `packages/e2e/playwright.config.ts` (currently only
  `Desktop Chrome`): e.g. Pixel 5 and/or iPhone 12 via `devices[...]`.
- New `packages/e2e/tests/reader-mobile.spec.ts`: VN panel visible at mobile viewport, tap
  advances a line, open drawer + navigate to an act, open backlog, bookmark flow. Desktop
  specs untouched.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Extractions destabilize the desktop reader | Extract only pure, well-bounded helpers; keep behavior identical; existing desktop unit tests are the regression guard |
| Full-screen tap `<button>` traps SR/keyboard focus | Use a labeled button + explicit chrome controls; keep keyboard advance; manage focus for overlays |
| Breakpoint swap loses reading position | Accepted (rare); scene/story persist; index-preservation deferred as a future nice-to-have |
| Tap-to-advance conflicts with control taps | Controls live in chrome/overlays above the advance layer; advance disabled while overlays open |

---

## 9. Open Items (resolve during implementation)

- Final translation key names for new strings.
- Exact menu affordance for revealing chrome (top-edge zone vs always-faint button).
- Which mobile device(s) to add to the Playwright matrix (Pixel 5, iPhone 12, or both).
