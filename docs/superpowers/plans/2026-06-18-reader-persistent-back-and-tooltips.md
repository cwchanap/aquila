# Mobile Reader — Persistent Back Button & Long-Press Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile reader's go-back control always visible above a fixed-size dialogue box, and let a long-press on any icon button reveal its label.

**Architecture:** Task 1 restructures the dialogue box to a fixed-height flex column and moves the ◀ control out of the hamburger toolbar to a persistent spot above it (reusing `goBack()` unchanged). Task 2 adds a small, isolated, unit-tested `longpress` Svelte action. Task 3 wires that action onto the five icon controls to drive a single visual tooltip bubble. Task 4 is a verification sweep. All product code stays in `MobileNovelReader.svelte` plus one new helper file.

**Tech Stack:** Astro SSR, Svelte 5 (runes) + Svelte actions, Tailwind v4, lucide-svelte, Vitest (happy-dom, global fake timers) + Testing Library, Playwright E2E.

## Global Constraints

- Branch: `feat/mobile-reader`. Commit after every task.
- `MobileNovelReader.svelte` is **Svelte 5 runes**: state via `$state`/`$derived`/`$effect`, event handlers via property syntax (`onclick=`), Svelte `use:` actions are allowed; **never** `on:click`.
- **No new i18n keys.** Tooltip labels reuse the controls' existing `aria-label` strings: `t.common.backToHome`, `t.reader.openActsPanel`, `t.reader.openHistory`, `t.reader.bookmark`, `t.reader.previousLine` — all already present in both locale JSONs and in the test mock (`MobileNovelReader.test.ts:6–34`).
- Icons: `lucide-svelte` — `House`, `Layers`, `ChevronLeft`, `History`, `Bookmark` are **already imported** at `MobileNovelReader.svelte:13`. Every icon keeps `aria-hidden="true"`; the control carries the accessible name via `aria-label`.
- `goBack()` is **reused unchanged** — it already bails on `hasOverlay`, no-ops at `currentDialogueIndex <= 0`, cancels any in-flight typewriter via `sceneVersion++`, and never calls `onNext`/`onNavigate`.
- The tooltip bubble is **visual-only**: `aria-hidden="true"`, no `role` — each control already exposes its name via `aria-label`, so the bubble must not double-announce. (This resolves the spec's `role="tooltip"` note toward no double-announcement.)
- **Do NOT modify:** `NovelReader.svelte`, `ReaderShell.svelte`, `reader-manager.ts`, `typewriter.ts`, `character-name.ts`, `act-navigation.ts`, `MobileActDrawer.svelte`, `MobileBacklogSheet.svelte`.
- Tests: `bun --filter web test <path>` (Vitest, happy-dom, **global fake timers** via `src/lib/test-setup.ts` — flush with `await vi.runAllTimersAsync()` / `await vi.advanceTimersByTimeAsync(ms)`). Role queries honor `aria-hidden`; `getByText` does not. E2E: `bun --filter e2e test:e2e tests/<file>`.
- **Preserve these accessible names the suites assert** (do not rename/remove): `Open menu`/`Close menu`, `Open acts panel`, `Open history`, `Back to Home`, `Tap to continue`, `Previous line`, `Bookmark`.

---

### Task 1: Persistent back button + fixed-size dialogue box

**Files:**
- Modify: `apps/web/src/components/MobileNovelReader.svelte` (remove the toolbar `ChevronLeft` block `:282–290`; restructure the reading box `:344–370`)
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Consumes (unchanged): `goBack()`, `currentDialogueIndex`, `currentName`, `typingText`, `isTyping`, `isLastDialogue`, `canGoNext`, `showChoices`, `t`, `ChevronLeft`.
- Produces: a persistent ◀ button (accessible name `Previous line`) rendered in reading mode above a **fixed-height** (`h-52`) flex-column dialogue box; the toolbar no longer contains a Previous-line button. No prop/API changes.

- [ ] **Step 1: Update the two existing previous-line tests and add the persistence assertion**

In `MobileNovelReader.test.ts`, **replace** the existing test `it('disables the previous-line button on the first line', …)` (currently `:241–248`) with:

```ts
    it('shows a disabled previous-line button on the first line without opening the menu', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        // The back control is persistent: visible with the hamburger chrome closed…
        expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Previous line')).toBeInTheDocument();
        // …and disabled on the first line.
        expect(screen.getByLabelText('Previous line')).toBeDisabled();
    });
```

**Replace** the existing test `it('steps back one line within the scene without leaving it', …)` (currently `:250–272`) with (the only change is removing the `Open menu` click — the back button is now persistent):

```ts
    it('steps back one line within the scene without leaving it', async () => {
        const onNext = vi.fn();
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, onNext, locale: 'en' },
        });
        const tap = screen.getByLabelText('Tap to continue');
        await fireEvent.click(tap); // complete typing of line 1
        await vi.runAllTimersAsync();
        await fireEvent.click(tap); // advance to line 2 (index 1)
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();

        // The persistent back button works without opening the hamburger menu.
        await fireEvent.click(screen.getByLabelText('Previous line'));
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.queryByText('Second line.')).not.toBeInTheDocument();
        expect(onNext).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts -t "previous-line button on the first line"`
Expected: FAIL — today the Previous-line button only exists inside the chrome (requires opening the menu), so `getByLabelText('Previous line')` throws while the chrome is closed.

- [ ] **Step 3: Remove the Previous-line button from the chrome toolbar**

In `MobileNovelReader.svelte`, delete the entire Acts-to-History `ChevronLeft` button block (currently `:282–290`):

```svelte
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60 disabled:opacity-40"
          aria-label={t.reader.previousLine}
          disabled={currentDialogueIndex === 0}
          onclick={goBack}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
```

Leave the surrounding Acts (`Layers`) and History (`History`) buttons in place. (`ChevronLeft` stays imported — it is reused in Step 4.)

- [ ] **Step 4: Add the persistent back button and fix the dialogue box size**

Replace the reading-mode `{:else}` branch of the bottom panel (currently `:344–370`, from `{:else}` through the matching `{/if}`) with:

```svelte
    {:else}
      <!-- Persistent back-one-line control, above the dialogue box. Its own
           pointer-events-auto re-enables clicks (the panel is none while reading). -->
      <div class="pointer-events-auto mb-2 flex">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow backdrop-blur-sm disabled:opacity-40"
          aria-label={t.reader.previousLine}
          disabled={currentDialogueIndex === 0}
          onclick={goBack}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </div>
      <!-- Fixed-height reading box: chip · scrollable text · pinned indicator. -->
      <div class="flex h-52 flex-col rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        {#if currentName}
          <span
            class="mb-2 inline-block self-start rounded-xl bg-blue-100/80 px-3 py-1 text-base font-bold text-blue-600"
          >
            {currentName}
          </span>
        {/if}
        <p class="flex-1 overflow-y-auto text-lg leading-relaxed text-slate-800">
          {typingText}{#if isTyping}<span
              class="ml-0.5 inline-block h-5 w-2 animate-pulse bg-blue-600 align-middle"
            ></span>{/if}
        </p>
        {#if !isTyping}
          <div class="mt-2 text-right text-blue-500">
            {#if !isLastDialogue}
              <span class="inline-block motion-safe:animate-bounce" aria-hidden="true">▼</span>
            {:else if canGoNext}
              <span class="text-sm font-semibold">{t.reader.nextScene}</span>
            {:else}
              <span class="text-sm font-semibold">{t.reader.complete}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
```

- [ ] **Step 5: Run the reader tests**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (all). The chrome icon-toolbar test (`renders the chrome as labeled icon buttons…`) is unaffected — it never queried `Previous line`. The backlog test is unaffected — after two taps the reading box shows `Third line.` (index 2), so `First line.`/`Second line.` remain unique to the backlog.

- [ ] **Step 6: Run lint**

Run: `bun lint`
Expected: no new errors (all icon imports still used; no unused vars).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "feat(reader): persistent back button above a fixed-size dialogue box"
```

---

### Task 2: `longpress` Svelte action

**Files:**
- Create: `apps/web/src/lib/longpress.ts`
- Test: `apps/web/src/lib/__tests__/longpress.test.ts`

**Interfaces:**
- Produces:
  - `interface LongpressParams { onLongPress: () => void; onRelease: () => void; delay?: number }`
  - `function longpress(node: HTMLElement, params: LongpressParams): { update(p: LongpressParams): void; destroy(): void }` — a Svelte action. Holding the pointer ≥ `delay` ms (default `450`) fires `onLongPress`; a release after a fired long-press fires `onRelease` and **suppresses the following `click`** (peek-only); a release before `delay` does neither and lets the click through.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/__tests__/longpress.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from 'vitest';
import { longpress } from '../longpress';

describe('longpress action', () => {
    afterEach(() => vi.clearAllTimers());

    it('fires onLongPress after the delay, then onRelease on release', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const onRelease = vi.fn();
        const handle = longpress(node, { onLongPress, onRelease, delay: 450 });

        node.dispatchEvent(new Event('pointerdown'));
        expect(onLongPress).not.toHaveBeenCalled();
        vi.advanceTimersByTime(450);
        expect(onLongPress).toHaveBeenCalledTimes(1);

        node.dispatchEvent(new Event('pointerup'));
        expect(onRelease).toHaveBeenCalledTimes(1);
        handle.destroy();
    });

    it('does not fire when released before the delay', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const onRelease = vi.fn();
        const handle = longpress(node, { onLongPress, onRelease, delay: 450 });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(200);
        node.dispatchEvent(new Event('pointerup'));
        vi.advanceTimersByTime(450);
        expect(onLongPress).not.toHaveBeenCalled();
        expect(onRelease).not.toHaveBeenCalled();
        handle.destroy();
    });

    it('suppresses the click that follows a long-press (peek-only)', () => {
        // Model Svelte's delegated click handler as a bubble-phase listener on
        // an ancestor: stopping propagation at the target must prevent it.
        const parent = document.createElement('div');
        const node = document.createElement('button');
        parent.appendChild(node);
        const delegated = vi.fn();
        parent.addEventListener('click', delegated);

        const handle = longpress(node, {
            onLongPress: vi.fn(),
            onRelease: vi.fn(),
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        node.dispatchEvent(new Event('pointerup'));

        const click = new Event('click', { bubbles: true, cancelable: true });
        node.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(true);
        expect(delegated).not.toHaveBeenCalled();
        handle.destroy();
    });

    it('lets a normal click through when there was no long-press', () => {
        const parent = document.createElement('div');
        const node = document.createElement('button');
        parent.appendChild(node);
        const delegated = vi.fn();
        parent.addEventListener('click', delegated);

        const handle = longpress(node, {
            onLongPress: vi.fn(),
            onRelease: vi.fn(),
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(200);
        node.dispatchEvent(new Event('pointerup'));
        node.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

        expect(delegated).toHaveBeenCalledTimes(1);
        handle.destroy();
    });

    it('removes listeners on destroy', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const handle = longpress(node, {
            onLongPress,
            onRelease: vi.fn(),
            delay: 450,
        });
        handle.destroy();
        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        expect(onLongPress).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter web test src/lib/__tests__/longpress.test.ts`
Expected: FAIL — `Cannot find module '../longpress'` (the file does not exist yet).

- [ ] **Step 3: Implement the action**

Create `apps/web/src/lib/longpress.ts`:

```ts
export interface LongpressParams {
    onLongPress: () => void;
    onRelease: () => void;
    delay?: number;
}

const DEFAULT_DELAY = 450;

/**
 * Svelte action: hold the pointer for `delay` ms to "peek" — fires
 * `onLongPress` (e.g. show a tooltip) and suppresses the click that would
 * otherwise follow, so holding a control to read its label never triggers it.
 * A short tap is untouched.
 */
export function longpress(node: HTMLElement, params: LongpressParams) {
    let current = params;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fired = false;

    function clearTimer(): void {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
    }

    function onPointerDown(): void {
        fired = false;
        clearTimer();
        timer = setTimeout(() => {
            timer = undefined;
            fired = true;
            current.onLongPress();
        }, current.delay ?? DEFAULT_DELAY);
    }

    function onPointerEnd(): void {
        clearTimer();
        if (fired) {
            current.onRelease();
        }
    }

    // Capture-phase: a long-press swallows the subsequent click before it can
    // reach the element's (delegated) click handler.
    function onClickCapture(event: Event): void {
        if (fired) {
            event.stopImmediatePropagation();
            event.preventDefault();
            fired = false;
        }
    }

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointerup', onPointerEnd);
    node.addEventListener('pointerleave', onPointerEnd);
    node.addEventListener('pointercancel', onPointerEnd);
    node.addEventListener('click', onClickCapture, true);

    return {
        update(next: LongpressParams): void {
            current = next;
        },
        destroy(): void {
            clearTimer();
            node.removeEventListener('pointerdown', onPointerDown);
            node.removeEventListener('pointerup', onPointerEnd);
            node.removeEventListener('pointerleave', onPointerEnd);
            node.removeEventListener('pointercancel', onPointerEnd);
            node.removeEventListener('click', onClickCapture, true);
        },
    };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --filter web test src/lib/__tests__/longpress.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Run lint**

Run: `bun lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/longpress.ts apps/web/src/lib/__tests__/longpress.test.ts
git commit -m "feat(reader): add longpress peek action with click suppression"
```

---

### Task 3: Wire long-press tooltips into the reader

**Files:**
- Modify: `apps/web/src/components/MobileNovelReader.svelte` (import `longpress`; add `activeTooltip` state; `use:longpress` on the five icon controls; render the tooltip bubble)
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Consumes: `longpress` (Task 2), `LongpressParams`; existing `t`, the five icon controls.
- Produces: `activeTooltip` (`$state<string | null>`); a single visual tooltip bubble showing the held control's label.

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('MobileNovelReader', …)` block in `MobileNovelReader.test.ts`:

```ts
    it('reveals an icon label on long-press and hides it on release', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        const acts = screen.getByLabelText('Open acts panel');
        await fireEvent.pointerDown(acts);
        await vi.advanceTimersByTimeAsync(450);
        // The icon button has no visible text (only its aria-label), so this
        // visible text can only be the tooltip bubble.
        expect(screen.getByText('Open acts panel')).toBeInTheDocument();
        await fireEvent.pointerUp(acts);
        expect(screen.queryByText('Open acts panel')).not.toBeInTheDocument();
    });
```

(If `fireEvent.pointerDown`/`pointerUp` are unavailable in happy-dom, fall back to `await fireEvent(acts, new Event('pointerdown', { bubbles: true }))` / `'pointerup'`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts -t "reveals an icon label"`
Expected: FAIL — no tooltip bubble exists, so `getByText('Open acts panel')` (visible text) throws.

- [ ] **Step 3: Import the action and add tooltip state**

In `MobileNovelReader.svelte`, after the existing `lucide-svelte` import (`:13`), add:

```svelte
  import { longpress } from '@/lib/longpress';
```

After the `let backlogOpen = $state(false);` line (`:79`), add:

```svelte
  let activeTooltip = $state<string | null>(null);
```

- [ ] **Step 4: Attach `use:longpress` to the five icon controls**

Add `use:longpress={{ onLongPress: () => (activeTooltip = LABEL), onRelease: () => (activeTooltip = null) }}` to each control, where `LABEL` is that control's existing `aria-label` expression. Concretely:

- Home link (`<a href={backUrl} … aria-label={t.common.backToHome}>`):
  ```svelte
        use:longpress={{
          onLongPress: () => (activeTooltip = t.common.backToHome),
          onRelease: () => (activeTooltip = null),
        }}
  ```
- Acts button (`aria-label={t.reader.openActsPanel}`):
  ```svelte
        use:longpress={{
          onLongPress: () => (activeTooltip = t.reader.openActsPanel),
          onRelease: () => (activeTooltip = null),
        }}
  ```
- History button (`aria-label={t.reader.openHistory}`):
  ```svelte
        use:longpress={{
          onLongPress: () => (activeTooltip = t.reader.openHistory),
          onRelease: () => (activeTooltip = null),
        }}
  ```
- Bookmark button (`aria-label={t.reader.bookmark}`):
  ```svelte
        use:longpress={{
          onLongPress: () => (activeTooltip = t.reader.bookmark),
          onRelease: () => (activeTooltip = null),
        }}
  ```
- Persistent back button from Task 1 (`aria-label={t.reader.previousLine}`):
  ```svelte
        use:longpress={{
          onLongPress: () => (activeTooltip = t.reader.previousLine),
          onRelease: () => (activeTooltip = null),
        }}
  ```

Add the directive alongside the existing attributes on each element; do not change any `aria-label`, `href`, `onclick`, or `disabled`.

- [ ] **Step 5: Render the tooltip bubble**

Immediately after the bottom-panel container's closing `</div>` (currently `:371`, before the `{#if storyId !== undefined …}` MobileActDrawer block), add:

```svelte
  <!-- Visual-only long-press tooltip. Controls already expose their name via
       aria-label, so this bubble is aria-hidden to avoid double-announcement. -->
  {#if activeTooltip}
    <div
      class="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1 text-sm font-medium text-white shadow-lg"
      style="top: calc(3.5rem + env(safe-area-inset-top));"
      aria-hidden="true"
    >
      {activeTooltip}
    </div>
  {/if}
```

- [ ] **Step 6: Run the reader tests**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (all, including the new long-press test). Long-pressing `Open acts panel` shows the bubble and — because the action suppresses the click — does **not** open the drawer.

- [ ] **Step 7: Run lint**

Run: `bun lint`
Expected: no new errors (`longpress` imported and used; `activeTooltip` used).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "feat(reader): long-press tooltips on mobile reader icon controls"
```

---

### Task 4: Verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Run the full web unit suite**

Run: `bun --filter web test`
Expected: PASS — all suites green (the new `longpress` suite + the extended `MobileNovelReader` suite; `NovelReader`, `MobileActDrawer`, `ReaderShell`, etc. untouched).

- [ ] **Step 2: Run the mobile E2E**

Run: `bun --filter e2e test:e2e tests/reader-mobile.spec.ts`
Expected: PASS (3 tests). The spec uses `getByLabel('Open menu')`, `getByRole('link', { name: /Back to Home/i })`, `getByLabel('Open acts panel')`, `getByLabel('Open history')`, and drawer/backlog headings — all preserved (Task 1 only relocated the ◀ control; Task 3 added no new accessible names).

- [ ] **Step 3: Manual viewport check (recommended)**

`bun dev:web` (port 5090), open `/en/reader` at a phone viewport: confirm the ◀ back button is visible above the dialogue box without opening the ☰ menu (greyed on line 1), the dialogue box keeps a constant size as lines vary (long lines scroll inside), and long-pressing each toolbar icon (and ◀) shows its label then hides on release without triggering the action. Tune the box height (`h-52`) here if needed. Confirm the desktop reader at ≥1024px is unchanged.

No commit (verification only). If anything fails, fix under the owning task before continuing.

---

## Self-Review

**Spec coverage:**
- §A fixed-size dialogue box (fixed height, flex column, scrollable text, pinned indicator; choices box unchanged) → Task 1 Step 4. ✓
- §B always-visible back button above the dialogue (removed from toolbar, persistent, `pointer-events-auto`, disabled at 0, reuses `goBack()`) → Task 1 Steps 3–4. ✓
- §C long-press tooltips (reusable `longpress.ts` action, ~450ms, peek-only click suppression, applied to four toolbar icons + ◀, labels from existing aria-labels, no new i18n) → Tasks 2–3. ✓
- Edge cases (disabled+guarded at 0; overlay backstop via unchanged `goBack`; release-before-delay lets click through; overlong line scrolls) → Task 1 (disabled), Task 2 tests, Task 1 box structure. ✓
- Testing (longpress unit tests; reader tests for persistence/disabled/step-back/tooltip; regression suite + E2E green) → Tasks 2–4. ✓
- Non-goals (no desktop/ReaderShell/other-component changes, no new routes, no new i18n keys) → file lists confine edits to `MobileNovelReader.svelte` + new `longpress.ts`. ✓

**Placeholder scan:** every code step shows full code; every test step shows real assertions; every run step states command + expected result. `LABEL` in Task 3 Step 4 is immediately expanded to the five concrete `aria-label` expressions. ✓

**Type consistency:** `LongpressParams { onLongPress: () => void; onRelease: () => void; delay?: number }` and `longpress(node, params)` defined in Task 2 are consumed verbatim in Task 3. `activeTooltip: string | null`. Icon names match the existing import. Tooltip labels match the controls' `aria-label` expressions. ✓
