# Mobile Reader UX & Page Polish — Design Spec

**Date:** 2026-06-18
**Status:** Approved (brainstorming) — ready for implementation planning
**Scope:** Four follow-up improvements raised after the mobile reader shipped: (1) a better
layout for the mobile reader's chrome bar, (2) a visual polish of the main menu and
story-choosing pages, (3) collapsible chapters in the mobile act drawer, and (4) a
go-back-one-line button in the mobile reader.

---

## 1. Summary

Four issues, grouped into **two independent phases**:

- **Phase A — Mobile reader** (extends the `feat/mobile-reader` branch). Three tightly-coupled
  changes to the touch reader:
  - **A1 (#1) Chrome-bar layout** — replace the cramped single-row text bar revealed by the
    hamburger with a clean **icon toolbar** + slim progress bar, in the same glass style.
  - **A2 (#4) Go-back button** — a one-tap step **back one dialogue line within the current
    scene**, placed in the toolbar immediately before History. **Mobile only.**
  - **A3 (#3) Collapsible chapters** — chapter headers in the act drawer become accordion
    rows; the chapter holding the current act is expanded by default, the rest collapsed.
- **Phase B — Page polish** (independent). Improve the **main menu** (`MainMenu.svelte`) and
  **story-choosing page** (`stories/index.astro`) layouts while keeping the existing ocean +
  glassmorphism theme ("polish, don't replace").

Phases are decoupled: Phase A can merge even while Phase B continues to iterate visually.

### Decisions locked during brainstorming

| Question | Decision |
|---|---|
| "Upload bar" / "head bar" identity | The mobile reader's chrome bar (revealed by the ☰ hamburger) |
| Visual direction (#1, #2) | **Polish** the current ocean + glass theme; dial back the `Orbitron`/neon/hexagon gamer chrome — do not restyle from scratch |
| Go-back scope (#4) | **Mobile only** (`MobileNovelReader`), not the desktop `NovelReader` |
| Go-back bounds | Steps back within the current scene only; disabled at line 0; does not cross scene boundaries |
| Chrome toolbar style | Icon buttons (lucide-svelte) with i18n `aria-label`s; progress as a slim bar |
| Chapter accordion default | Current chapter expanded, others collapsed |
| Structure | One spec, two implementation phases/plans |

---

## 2. Goals / Non-Goals

### Goals

- A mobile chrome bar that fits a narrow viewport without wrapping/crowding, and that has room
  for the new go-back control.
- One-tap reverse navigation through the current scene's lines on mobile.
- An act drawer that stays short and oriented to "where am I" via collapsible chapters.
- A cleaner, better-organized main menu and story-choosing page that keep the current look.
- Full i18n parity (`en` + `zh`), accessibility preserved, desktop reader untouched.

### Non-Goals (YAGNI)

- Desktop reader go-back / chrome changes (mobile only).
- Cross-scene back navigation or global reading history (data model stays per-scene).
- A from-scratch visual redesign or a new theme/palette.
- New navigation destinations, routes, or settings.
- A shared/site-wide header component (out of scope; "head bar" was the reader chrome, not a
  page header).
- Reader settings (text size, typing speed), sprites, audio.

---

## 3. Phase A — Mobile reader

All Phase A changes are confined to `apps/web/src/components/MobileNovelReader.svelte`,
`apps/web/src/components/MobileActDrawer.svelte`, and the two translation JSON files. The
desktop `NovelReader.svelte`, `ReaderShell.svelte`, `reader-manager.ts`, and the shared
helpers (`typewriter.ts`, `character-name.ts`, `act-navigation.ts`) are **not** modified.

### 3.1 A1 — Chrome-bar layout (#1)

**Current state** (`MobileNovelReader.svelte:238–277`): when `chromeVisible` is true, a glass
strip renders a single flex row of text controls — `Back to Home` (link), `Acts`, `History`,
`Bookmark` — plus right-aligned `progressText`, with `pl-16` to clear the hamburger. On a
phone these labels compete for horizontal space and wrap.

**New layout:** the same glass strip, restyled as a horizontal **icon toolbar**:

- Buttons, left→right: **Home · Acts · ◀ Previous-line · History · Bookmark** (Bookmark still
  gated by `showBookmarkButton`). Previous-line is A2.
- Each control is an icon button (lucide-svelte) with a ≥44×44px tap target and the existing
  i18n string as its `aria-label`. Home stays an `<a href={backUrl}>`; the rest stay
  `<button>`s with their current `onclick` handlers.
- **Progress** moves out of the row into a **slim horizontal progress bar** pinned to the
  bottom edge of the chrome strip: a track plus a fill whose width is
  `(currentDialogueIndex + 1) / dialogue.length`. The numeric `progressText` ("12 / 48")
  remains, rendered small (e.g. as the bar's accessible label / a compact caption) so screen
  readers and sighted users still get the exact count.
- Icons (lucide-svelte, already a dependency): Home → `House`, Acts → `Layers` (or `List`),
  Previous-line → `ChevronLeft` (or `Undo2`), History → `History` (or `Clock`),
  Bookmark → `Bookmark`. Final icon choices are an implementation detail; the contract is
  "one labeled icon button per action."

**Behavior preserved:** opening Acts/History still sets `chromeVisible = false` (chrome closes
when an overlay opens — existing behavior). The hamburger toggle (`☰`/`✕`) and its `pl-16`
clearance are unchanged in function; spacing adjusts so the icon row sits beside it cleanly.

This is a **layout/presentation change only** — no new props, no state-machine changes, no
change to `advance()`.

### 3.2 A2 — Go-back button (#4, mobile only)

**New function** in `MobileNovelReader.svelte`:

```
function goBack(): void {
  if (hasOverlay) return;          // overlays own their own taps
  if (currentDialogueIndex <= 0) return;  // at scene start, no-op
  skipTyping = false;
  isTyping = false;
  sceneVersion++;                  // cancel any in-flight typewriter for this scene
  currentDialogueIndex--;
  typingText = dialogue[currentDialogueIndex]?.dialogue ?? '';  // show fully typed, no re-type
}
```

- **Placement:** toolbar button immediately **before History** ("alongside History").
- **Bounds:** within the current scene only. Disabled (and visibly de-emphasized) when
  `currentDialogueIndex === 0`; never calls `onNavigate`/`onNext` and never crosses scene
  boundaries — symmetric with History, which only lists the current scene.
- **Interaction with typing:** stepping back cancels an in-progress typewriter (via
  `sceneVersion++`, the existing cancellation mechanism) and shows the previous line in full,
  matching how a bookmark jump seeds `typingText` in `initScene()`.
- **No effect on choices:** going back from a non-final line leaves `showChoices` false as
  usual; choices only render on the last line when not typing.
- **i18n:** new key `reader.previousLine` (en + zh) for the `aria-label`.

The forward tap-to-advance layer (`advance()`) is unchanged; go-back is a deliberate toolbar
action, not a gesture, to avoid competing with tap-to-advance.

### 3.3 A3 — Collapsible chapters (#3)

**Current state** (`MobileActDrawer.svelte:73–98`): in `chapters` mode every chapter renders
its label followed by **all** of its act buttons, always expanded. With several chapters the
drawer becomes a long flat list.

**New behavior:** each chapter label becomes a tappable **accordion header**:

- Header is a `<button>` with a chevron that rotates on expand, `aria-expanded`, and
  `aria-controls` pointing at its acts container.
- Expanded chapters render their acts (as today); collapsed chapters render only the header.
- **Default expansion:** the chapter whose key matches `currentChapterKey` (already derived as
  `extractChapterKey(currentSceneId)`) starts expanded; all others start collapsed.
- State is local presentational `$state` — a set/record of expanded chapter numbers seeded once
  from the current chapter. Selecting an act still calls `handleSelect` (navigate + close) with
  no change. The flat `acts`-mode branch (`:73` `{:else}`) is unchanged.
- `act-navigation.ts` and `buildChapterData` are **not** modified — this is purely a rendering
  concern in the drawer.

### 3.4 Phase A — error handling & edge cases

- Empty / single-line scene: go-back is a no-op at index 0; progress bar fill is
  `1 / length` (guard `length > 0`; if `dialogue.length === 0`, fill is 0 and the count hidden,
  consistent with existing guards).
- Bookmark jump (`initialDialogueIndex`): unaffected; go-back simply steps back from the
  restored index within the scene.
- Reduced motion: the chevron rotation and progress-fill transitions use `motion-safe:` /
  respect `prefers-reduced-motion`, matching the existing reader.

### 3.5 Phase A — testing

Vitest (happy-dom), `@testing-library/svelte`, following the existing reader test patterns
(global fake timers; `await vi.runAllTimersAsync()` to flush the typewriter; role queries honor
`aria-hidden`/`inert`).

- **A1 chrome toolbar** (`MobileNovelReader.test.ts`): opening the menu renders the labeled
  icon buttons (`getByLabelText` for Home/Acts/History/Bookmark); a progress indicator reflects
  position (`1 / N` at start, advances after a tap).
- **A2 go-back** (`MobileNovelReader.test.ts`): from line 0 the previous-line control is
  disabled / no-ops (index stays 0); after advancing one line, clicking previous-line returns
  to line 0 and shows that line's text fully typed; it never triggers `onNext`/`onNavigate`.
- **A3 collapsible chapters** (`MobileActDrawer.test.ts`): in `chapters` mode the current
  chapter's acts are visible and a non-current chapter's acts are hidden by default; clicking a
  collapsed chapter header reveals its acts and toggles `aria-expanded`; `acts`-mode rendering
  is unchanged.
- Desktop regression: `NovelReader.test.ts` and the full web suite stay green (Phase A does not
  touch desktop code).

---

## 4. Phase B — Page polish

**Direction:** keep the ocean gradient + glassmorphism identity; improve layout quality. Reduce
the heavy `Orbitron`/neon-gradient/hexagon/"power-indicator-bar" gamer chrome to tasteful
accents; improve visual hierarchy, spacing, and the story-selection cards; tighten mobile
responsiveness. No new theme, palette, routes, or destinations.

### 4.1 Main menu — `MainMenu.svelte`

- Preserve the animated ocean background, the glass card, the title, and the existing menu
  destinations (Start → `/[locale]/stories`, Bookmarks, etc.) and their handlers.
- Improve: spacing/rhythm of the menu buttons, restrained typography (limit `Orbitron` to the
  title/accents, body in a readable sans), clearer button hierarchy (primary vs secondary),
  and mobile sizing (the `text-6xl` title and large buttons should scale down gracefully on
  small screens).

### 4.2 Story-choosing page — `stories/index.astro`

- Preserve the ocean background, back button, `UserStatus`, and the two story destinations
  (`reader?story=…`) with their `StoryId` links intact.
- Improve: present the stories as **selectable cards** (title + short descriptor, consistent
  sizing) instead of bare stacked buttons; tone down the decorative hexagon/power-bar cluster;
  improve hierarchy and mobile layout. Reuse `Button.svelte` variants where they fit.

### 4.3 Phase B — constraints & testing

- **No behavioral/route changes:** every existing link target, `client:load` boundary, i18n
  key, and `data-testid`/`id` used by current tests or E2E (e.g. `#start-btn`) is preserved. If
  a hook must move, update it consistently.
- i18n: any new visible copy (e.g. story descriptors) added to **both** `en.json` and
  `zh.json`; no hard-coded strings.
- Accessibility: maintain `prefers-reduced-motion` handling already present on these pages;
  keep adequate contrast on glass surfaces; preserve focus order and labels.
- Testing: existing unit/E2E for these pages stay green; this is primarily presentational, so
  changes are validated by the existing suite plus manual viewport checks (desktop + Pixel 5 /
  iPhone 12). Add assertions only where new structure (e.g. story cards) warrants it without
  over-coupling tests to styling.

---

## 5. Implementation notes

- **Branch:** Phase A continues on `feat/mobile-reader`. Phase B is independent and may land on
  the same branch or its own; it does not depend on Phase A.
- **frontend-design skill:** used during Phase A1 (toolbar) and all of Phase B implementation
  for visual quality. (It is an implementation skill — invoked when executing the plan, not
  during planning.)
- **Dependencies:** lucide-svelte is already used in the repo (`StoryWriter`, `StoryTree`); no
  new dependencies.
- **i18n keys added:** `reader.previousLine` (Phase A) and any Phase B story descriptors — both
  locales, in lock-step.

---

## 6. Self-review checklist (for the spec author)

- Placeholders: none — every section states concrete files, behavior, and tests.
- Consistency: Phase A is mobile-only and desktop-preserving throughout; "head bar" defined
  once (reader chrome) and used consistently; go-back bounds stated identically in §3.2 and the
  decisions table.
- Scope: four issues, two phases, all confined to named files; non-goals fence out a site-wide
  header, desktop changes, and a full restyle.
- Ambiguity: icon choices and exact card markup are explicitly flagged as implementation
  details with a fixed contract (labeled icon button per action; selectable cards), so they
  can't be misread as load-bearing requirements.
