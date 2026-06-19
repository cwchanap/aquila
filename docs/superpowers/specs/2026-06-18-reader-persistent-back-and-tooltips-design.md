# Mobile Reader — Persistent Back Button & Long-Press Tooltips Design

**Date:** 2026-06-18
**Branch:** `feat/mobile-reader`
**Status:** Approved (design)

## Problem

Two UX gaps in the mobile visual-novel reader (`apps/web/src/components/MobileNovelReader.svelte`):

1. **The go-back (◀) control is hidden.** It currently lives inside the auto-hiding hamburger chrome toolbar (`:282–290`), so a reader must open the ☰ menu every time they want to step back one line. The user wants it **always visible**.
2. **The toolbar icons are unlabeled.** The chrome toolbar icons (Home / Acts / History / Bookmark) carry `aria-label`s for screen readers but give a sighted user no hint of what each does. The user wants a **long-press** on an icon to reveal its name.

A secondary issue surfaced while placing an always-visible back control: the dialogue box **grows with text** (`min-h-[7rem]`, `:345`), so its top edge moves as line length varies — an unstable anchor for any control placed "above" it.

## Scope

- **In scope:** `MobileNovelReader.svelte`; one new reusable helper `apps/web/src/lib/longpress.ts`; their unit tests.
- **Out of scope (non-goals):** the desktop reader (`NovelReader.svelte`), `ReaderShell.svelte`, `reader-manager.ts`, `MobileActDrawer.svelte`, `MobileBacklogSheet.svelte`, any other page. No new routes. No new i18n keys (reuse existing `aria-label` strings). No change to `goBack()` semantics.

## Design

### A. Fixed-size dialogue box

The non-choice (reading) dialogue box becomes a **fixed-height flex column** so its size — and therefore the top edge the back button sits above — is stable regardless of dialogue length.

- Replace `min-h-[7rem]` on the reading box (`:345`) with a **fixed height** (`h-52`, 208px — tunable during the manual viewport check) and `flex flex-col`.
- Three stacked regions inside the box:
  - **Character chip** (top, auto height) — unchanged markup, shown when `currentName` is set.
  - **Scrollable text region** (`flex-1 overflow-y-auto`) — holds `typingText` + the typing caret. Overlong lines scroll within the box instead of resizing it.
  - **Indicator row** (bottom, auto height) — the existing ▼ / next-scene / complete indicator, pinned to the box bottom.
- The **choices box is unchanged** — it must grow to show all options; only the reading box is fixed-size.

### B. Always-visible back button, above the dialogue

- **Remove** the `ChevronLeft` "Previous line" button from the chrome toolbar (`:282–290`). It is now persistent, so a toolbar duplicate is redundant. The toolbar's remaining icons are Home / Acts / History / Bookmark.
- Add a **persistent ◀ button** inside the bottom panel container, rendered **immediately above the dialogue box**, left-aligned.
  - Because the bottom panel is `pointer-events-none` while reading (taps fall through to the advance layer), the back button carries its **own `pointer-events-auto`** so it stays clickable.
  - Reuses the existing **`goBack()` unchanged** — it already bails on `hasOverlay`, no-ops at `currentDialogueIndex <= 0`, cancels any in-flight typewriter via `sceneVersion++`, and never calls `onNext`/`onNavigate`.
  - **Disabled + greyed at line 1** (`disabled={currentDialogueIndex === 0}`, `disabled:opacity-40`) — discoverable rather than popping in and out.
  - Keeps `aria-label={t.reader.previousLine}` and a `ChevronLeft` icon with `aria-hidden="true"`.
- Only rendered in reading mode (not when `showChoices`), matching where stepping back is meaningful.

### C. Long-press tooltips on icon buttons

Native `title` tooltips are unreliable on touch (notably iOS Safari), so tooltips are driven by a small **reusable Svelte action** in its own file for isolation and testability.

**`apps/web/src/lib/longpress.ts`** — `longpress(node, params)`:
- `params`: `{ onLongPress: () => void; onRelease: () => void; delay?: number }` (default `delay = 450`).
- On `pointerdown`: start a `delay`ms timer. If it elapses without an intervening `pointerup` / `pointerleave` / `pointercancel`, call `onLongPress()` and set an internal `firedFlag`.
- On `pointerup` / `pointerleave` / `pointercancel`: clear the timer; if it had fired, call `onRelease()`.
- **Click suppression (peek-only):** when a long-press fired, the action swallows the immediately-following `click` (capture-phase listener that `stopImmediatePropagation()` + `preventDefault()` once), so holding an icon to read its label does not also trigger its action. A normal short tap is unaffected.
- Cleanup: returns `{ destroy() }` removing all listeners and clearing any pending timer. Svelte 5 runes mode supports `use:` actions; this stays a plain action.

**In `MobileNovelReader.svelte`:**
- `let activeTooltip = $state<string | null>(null);`
- Each icon-only control (toolbar Home / Acts / History / Bookmark **and** the persistent ◀) gets `use:longpress={{ onLongPress: () => (activeTooltip = <label>), onRelease: () => (activeTooltip = null) }}`, where `<label>` is that control's existing `aria-label` string. No new translation keys.
- When `activeTooltip` is non-null, render a small label bubble (`role="tooltip"`, `aria-hidden="true"` since the control's `aria-label` already serves assistive tech) positioned near the active control. A single shared bubble showing `activeTooltip` text is sufficient (only one can be held at a time).
- Screen-reader behavior is unchanged: every control keeps its `aria-label`.

## Edge cases

- **Back at line 0:** `disabled` attribute + `goBack()`'s `<= 0` guard — double-guarded, no-op.
- **Back while an overlay is open:** the persistent ◀ sits at a lower z-index than the drawer/backlog overlays (z-40/z-50), so it is visually covered; `goBack()`'s `hasOverlay` guard is the belt-and-suspenders backstop.
- **Long-press then drag off the button:** `pointerleave`/`pointercancel` clears the timer and hides the tooltip; if it had already fired, the click is still suppressed (peek-only).
- **Long-press vs. short tap:** under `delay`, no tooltip, click fires normally (existing behavior preserved).
- **Overlong dialogue line:** scrolls within the fixed-height text region; the indicator stays pinned at the box bottom via flex.

## Testing

- **`apps/web/src/lib/__tests__/longpress.test.ts`** (new): timer fires `onLongPress` after `delay` (fake timers); early `pointerup` cancels (no `onLongPress`); a fired long-press suppresses a following `click`; `destroy()` removes listeners. Uses happy-dom `PointerEvent`/dispatch.
- **`apps/web/src/components/__tests__/MobileNovelReader.test.ts`** (extend): the ◀ button is present **without** opening the menu; it is `disabled` on line 1; stepping back via it returns to the previous line and does not call `onNext`; the reading box renders at fixed size (assert the fixed-height class / structure). The toolbar no longer contains a second Previous-line control (the persistent one is the only ◀).
- **Regression:** existing `MobileNovelReader.test.ts` and `reader-mobile.spec.ts` stay green — all accessible names (`Open menu`, `Open acts panel`, `Open history`, `Back to Home`, `Tap to continue`, `Previous line`, `Bookmark`) are preserved.

## Defaults chosen (overridable)

- Dialogue reading box fixed height: `h-52` (tunable in the viewport check).
- Long-press = **peek-only** (suppresses the subsequent tap).
- Long-press delay: `450ms`.
- Long-press tooltips applied to the persistent ◀ as well as the four toolbar icons.
