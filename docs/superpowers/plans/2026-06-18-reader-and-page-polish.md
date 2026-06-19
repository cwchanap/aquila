# Reader UX & Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile reader a clean icon chrome bar with a go-back control and collapsible chapters, and polish the main-menu and story-choosing pages — without changing the desktop reader or any navigation behavior.

**Architecture:** Phase A (Tasks 1–3) edits only `MobileNovelReader.svelte`, `MobileActDrawer.svelte`, and the two translation JSONs — Svelte 5 runes, TDD via Vitest/happy-dom. Phase B (Tasks 4–5) restyles `MainMenu.svelte` (legacy Svelte 4) and `stories/index.astro`, preserving every selector the existing unit + E2E suites assert; visual production uses the frontend-design skill, and the existing suites are the regression gate.

**Tech Stack:** Astro SSR, Svelte 5 (runes) + legacy Svelte 4 components, Tailwind v4, lucide-svelte, Vitest (happy-dom) + Testing Library, Playwright E2E, `@aquila/stories` for i18n/flow.

## Global Constraints

- Branch: `feat/mobile-reader`. Commit after every task.
- Reader components (`MobileNovelReader.svelte`, `MobileActDrawer.svelte`) are **Svelte 5 runes**: state via `$state`/`$derived`/`$effect`, event handlers via property syntax (`onclick=`, `onkeydown=`), **never** `on:click`.
- `MainMenu.svelte` and `UserStatus.svelte` are **legacy Svelte 4** (`export let`, `$:`, `on:click`). Do **not** migrate them to runes — restyle markup/classes only.
- i18n: every new user-facing string is added to **both** `packages/stories/src/translations/en.json` and `…/zh.json`. No hard-coded UI text.
- Icons: `lucide-svelte` (`^0.468.0`, already a dependency). Import PascalCase from `'lucide-svelte'`; verified available names used here: `House`, `Layers`, `History`, `Bookmark`, `ChevronLeft`, `ChevronDown`, `ChevronRight`. Every icon gets `aria-hidden="true"`; the button/link carries the accessible name via `aria-label`.
- **Do NOT modify** in Phase A: `NovelReader.svelte`, `ReaderShell.svelte`, `reader-manager.ts`, `typewriter.ts`, `character-name.ts`, `act-navigation.ts`.
- Tests: `bun --filter web test <path>` (Vitest, happy-dom, **global fake timers**; flush the typewriter with `await vi.runAllTimersAsync()`). Role queries honor `aria-hidden`/`inert`; `getByLabelText` does not. E2E: `bun --filter e2e test:e2e tests/<file>`.
- **Preserve these contracts the existing suites assert** (do not rename/remove): `#start-btn`, `#settings-btn`, `#reader-container`; main-menu first `<h1>` renders `translations.menu.heading`; story-page first `<h1>` renders `t('stories.heading')`; the Train Adventure story stays a link whose accessible name contains `t('stories.trainAdventure')`; the mobile reader keeps accessible names `Open menu`/`Close menu`, `Open acts panel`, `Open history`, `Tap to continue`, and a `Back to Home` link (accessible name from `t.common.backToHome`, currently `← Back to Home`).

---

## Phase A — Mobile reader

### Task 1: Chrome-bar icon toolbar (#1)

**Files:**
- Modify: `apps/web/src/components/MobileNovelReader.svelte` (imports near top; chrome block `:238–277`; add one `$derived`)
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Consumes: existing `chromeVisible`, `drawerOpen`, `backlogOpen`, `currentDialogueIndex`, `dialogue`, `progressText`, `backUrl`, `showBookmarkButton`, `onBookmark`, `t`.
- Produces: `progressFraction` (`number`, 0–100) consumed only inside this component's template; an icon-only chrome bar (Home · Acts · History · Bookmark) + slim progress bar. No prop or public-API changes.

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('MobileNovelReader', …)` block in `MobileNovelReader.test.ts`:

```ts
it('renders the chrome as labeled icon buttons with a progress bar', async () => {
    render(MobileNovelReader, {
        props: { dialogue: mockDialogue, choice: null, showBookmarkButton: true, locale: 'en' },
    });
    await vi.runAllTimersAsync();
    await fireEvent.click(screen.getByLabelText('Open menu'));
    // Icon buttons expose their action via aria-label (no visible text label).
    expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Open acts panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Open history')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmark')).toBeInTheDocument();
    // The numeric progress caption is retained.
    expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts -t "labeled icon buttons"`
Expected: FAIL — `getByLabelText('Back to Home')` / `getByLabelText('Bookmark')` throw, because today those controls are text links/buttons with no `aria-label`.

- [ ] **Step 3: Add the icon imports and the progress fraction**

At the top of `MobileNovelReader.svelte`, after the existing `import MobileBacklogSheet …` line, add:

```svelte
  import { House, Layers, History, Bookmark } from 'lucide-svelte';
```

After the existing `progressText` `$derived` block (around `:197–201`), add:

```svelte
  let progressFraction = $derived(
    dialogue.length > 0
      ? ((currentDialogueIndex + 1) / dialogue.length) * 100
      : 0
  );
```

- [ ] **Step 4: Replace the chrome block with the icon toolbar**

Replace the entire `{#if chromeVisible} … {/if}` chrome block (currently `:238–277`) with:

```svelte
  <!-- Auto-hiding chrome bar (icon toolbar + slim progress). -->
  {#if chromeVisible}
    <div
      class="absolute inset-x-0 top-0 z-20 bg-white/80 shadow backdrop-blur-md"
      style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
    >
      <div class="flex items-center gap-1 px-2 py-2 pl-16">
        <a
          href={backUrl}
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.common.backToHome}
        >
          <House size={20} aria-hidden="true" />
        </a>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.reader.openActsPanel}
          onclick={() => {
            drawerOpen = true;
            chromeVisible = false;
          }}
        >
          <Layers size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.reader.openHistory}
          onclick={() => {
            backlogOpen = true;
            chromeVisible = false;
          }}
        >
          <History size={20} aria-hidden="true" />
        </button>
        {#if showBookmarkButton}
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
            aria-label={t.reader.bookmark}
            onclick={() => onBookmark(currentDialogueIndex + 1)}
          >
            <Bookmark size={20} aria-hidden="true" />
          </button>
        {/if}
        <span class="ml-auto pr-2 text-xs font-medium text-slate-600">{progressText}</span>
      </div>
      <div class="h-1 w-full bg-slate-200/70" aria-hidden="true">
        <div
          class="h-full bg-blue-500 motion-safe:transition-[width] motion-safe:duration-200"
          style="width: {progressFraction}%;"
        ></div>
      </div>
    </div>
  {/if}
```

- [ ] **Step 5: Update the two existing tests that depended on visible text labels**

In `MobileNovelReader.test.ts`:

In `it('bookmarks the current line number', …)`, change:

```ts
    await fireEvent.click(screen.getByText('Bookmark'));
```

to:

```ts
    await fireEvent.click(screen.getByLabelText('Bookmark'));
```

In `it('toggles chrome with the menu button', …)`, change the two `Back to Home` lines:

```ts
    expect(screen.queryByText('Back to Home')).not.toBeInTheDocument();
    await fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
```

to:

```ts
    expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
    await fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
```

In `it('opens the backlog with the current scene lines', …)`, change:

```ts
    expect(screen.queryByText('Back to Home')).not.toBeInTheDocument();
```

to:

```ts
    expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
```

(The `getByText('History')` assertion in that test is unchanged — it matches the backlog **heading**, not the toolbar.)

- [ ] **Step 6: Run the reader tests**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (all tests, including the new icon-toolbar test).

- [ ] **Step 7: Run lint**

Run: `bun lint`
Expected: no new errors (icons imported and used; no unused vars).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "feat(reader): icon toolbar + progress bar for mobile chrome"
```

---

### Task 2: Go-back button (#4, mobile only)

**Files:**
- Modify: `packages/stories/src/translations/en.json` + `…/zh.json` (`reader.previousLine`)
- Modify: `apps/web/src/components/MobileNovelReader.svelte` (`ChevronLeft` import; `goBack()`; toolbar button before History)
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Consumes: `currentDialogueIndex`, `dialogue`, `hasOverlay`, `isTyping`, `skipTyping`, `sceneVersion`, `typingText`, `t.reader.previousLine` (added here).
- Produces: `goBack(): void` — steps `currentDialogueIndex` back one within the current scene, no-op at index 0, never calls `onNext`/`onNavigate`; a disabled-at-start `ChevronLeft` toolbar button labeled `t.reader.previousLine`, placed immediately before History.

- [ ] **Step 1: Add the i18n key to both locales**

In `packages/stories/src/translations/en.json`, inside the `reader` object, after `"lineProgress": "Line {current} of {total}"`, add a comma and:

```json
    "previousLine": "Previous line"
```

In `packages/stories/src/translations/zh.json`, inside the `reader` object, after `"lineProgress": "第 {current} / {total} 行"`, add a comma and:

```json
    "previousLine": "上一行"
```

- [ ] **Step 2: Add `previousLine` to the test mock and write the failing tests**

In `MobileNovelReader.test.ts`, in the `vi.mock('@aquila/stories', …)` `reader` object, after `lineProgress: 'Line {current} of {total}',` add:

```ts
            previousLine: 'Previous line',
```

Then add these two tests inside the `describe` block:

```ts
it('disables the previous-line button on the first line', async () => {
    render(MobileNovelReader, {
        props: { dialogue: mockDialogue, choice: null, locale: 'en' },
    });
    await vi.runAllTimersAsync();
    await fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Previous line')).toBeDisabled();
});

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

    await fireEvent.click(screen.getByLabelText('Open menu'));
    await fireEvent.click(screen.getByLabelText('Previous line'));
    expect(screen.getByText('First line.')).toBeInTheDocument();
    expect(screen.queryByText('Second line.')).not.toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts -t "previous-line"`
Expected: FAIL — `getByLabelText('Previous line')` throws (the button does not exist yet).

- [ ] **Step 4: Implement `goBack()` and extend the icon import**

Change the Task 1 icon import line in `MobileNovelReader.svelte` to add `ChevronLeft`:

```svelte
  import { House, Layers, ChevronLeft, History, Bookmark } from 'lucide-svelte';
```

After the `advance()` function (around `:173`), add:

```svelte
  function goBack(): void {
    // Overlays own their own taps; never step the scene from under them.
    if (hasOverlay) return;
    // At the start of the scene there is nowhere to go back to.
    if (currentDialogueIndex <= 0) return;
    skipTyping = false;
    isTyping = false;
    sceneVersion++; // cancel any in-flight typewriter for this scene
    currentDialogueIndex--;
    typingText = dialogue[currentDialogueIndex]?.dialogue ?? '';
  }
```

- [ ] **Step 5: Add the Previous-line button to the toolbar (before History)**

In the chrome toolbar, between the Acts `<button>` (`Layers`) and the History `<button>` (`History`), insert:

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

- [ ] **Step 6: Run the reader tests**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (all, including the two new previous-line tests).

- [ ] **Step 7: Run lint**

Run: `bun lint`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts packages/stories/src/translations/en.json packages/stories/src/translations/zh.json
git commit -m "feat(reader): add mobile go-back-one-line control"
```

---

### Task 3: Collapsible chapters (#3)

**Files:**
- Modify: `apps/web/src/components/MobileActDrawer.svelte` (icon import; expand state + helpers; `chapters`-mode template `:73–98`)
- Test: `apps/web/src/components/__tests__/MobileActDrawer.test.ts`

**Interfaces:**
- Consumes: existing `chapterData` (`PanelData`), `currentChapterKey`, `currentAct`, `currentSceneId`, `handleSelect`, `extractChapterKey`.
- Produces: `expandedChapters` (`number[]`), `isExpanded(num): boolean`, `toggleChapter(num): void`; chapter headers become accordion buttons (`aria-expanded`/`aria-controls`); only the chapter holding the current act is expanded by default. Flat `branches`-mode rendering is unchanged.

- [ ] **Step 1: Write the failing test**

In `MobileActDrawer.test.ts`, add this import after the existing imports:

```ts
import { getStoryFlow } from '@aquila/stories';
import type { Mock } from 'vitest';
```

Add a `beforeEach` that resets the flow mock to the existing branch flow (so test order can't leak the chapters flow), immediately after `afterEach(() => vi.clearAllMocks());`:

```ts
    beforeEach(() => {
        (getStoryFlow as unknown as Mock).mockReturnValue(branchFlow);
    });
```

Then add this test inside the `describe` block:

```ts
const chaptersFlow = {
    start: 'ch1_act1',
    nodes: [
        { kind: 'scene', sceneId: 'ch1_act1' },
        { kind: 'scene', sceneId: 'ch1_act2' },
        { kind: 'scene', sceneId: 'ch2_act3' },
    ],
};

it('expands only the current chapter and toggles others', async () => {
    (getStoryFlow as unknown as Mock).mockReturnValue(chaptersFlow);
    render(MobileActDrawer, {
        props: {
            storyId: 's',
            currentSceneId: 'ch1_act1',
            onNavigate,
            onClose,
            open: true,
            locale: 'en',
        },
    });
    // Chapter 1 (holds the current act) is expanded by default…
    expect(screen.getByText('Act 1')).toBeInTheDocument();
    expect(screen.getByText('Act 2')).toBeInTheDocument();
    // …Chapter 2 is collapsed, so its act is not rendered.
    expect(screen.queryByText('Act 3')).not.toBeInTheDocument();
    expect(
        screen.getByRole('button', { name: 'Chapter 2' })
    ).toHaveAttribute('aria-expanded', 'false');

    // Expanding Chapter 2 reveals its act.
    await fireEvent.click(screen.getByRole('button', { name: 'Chapter 2' }));
    expect(screen.getByText('Act 3')).toBeInTheDocument();
    expect(
        screen.getByRole('button', { name: 'Chapter 2' })
    ).toHaveAttribute('aria-expanded', 'true');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileActDrawer.test.ts -t "expands only the current chapter"`
Expected: FAIL — today all acts render expanded, so `queryByText('Act 3')` is non-null (and there is no `Chapter 2` button role with `aria-expanded`).

- [ ] **Step 3: Add the icon import and accordion state**

At the top of `MobileActDrawer.svelte`, after the `buildChapterData …` import block, add:

```svelte
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
```

After the existing `let currentChapterKey = $derived(…)` line (`:28`), add:

```svelte
  let expandedChapters = $state<number[]>([]);
  let seededFor: string | undefined = undefined;

  function isExpanded(num: number): boolean {
    return expandedChapters.includes(num);
  }

  function toggleChapter(num: number): void {
    expandedChapters = isExpanded(num)
      ? expandedChapters.filter(n => n !== num)
      : [...expandedChapters, num];
  }

  // Seed the open chapter once per current scene: expand the chapter that
  // holds the current act, collapse the rest. User toggles persist until the
  // current scene changes.
  $effect(() => {
    if (chapterData.mode !== 'chapters') return;
    if (seededFor === currentSceneId) return;
    seededFor = currentSceneId;
    expandedChapters = chapterData.chapters
      .filter(ch =>
        ch.acts.some(a => extractChapterKey(a.sceneId) === currentChapterKey)
      )
      .map(ch => ch.chapterNum);
  });
```

- [ ] **Step 4: Replace the `chapters`-mode branch with the accordion**

Replace the `{#if chapterData.mode === 'chapters'} … {:else}` block's **chapters** branch (currently `:73–98`, the `<div class="space-y-3">…</div>` that renders each chapter label `<p>` followed by its acts) with:

```svelte
    {#if chapterData.mode === 'chapters'}
      <div class="space-y-3">
        {#each chapterData.chapters as chapter (chapter.chapterNum)}
          <div>
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              aria-expanded={isExpanded(chapter.chapterNum)}
              aria-controls={`chapter-acts-${chapter.chapterNum}`}
              onclick={() => toggleChapter(chapter.chapterNum)}
            >
              <span>{chapter.label}</span>
              {#if isExpanded(chapter.chapterNum)}
                <ChevronDown size={18} aria-hidden="true" />
              {:else}
                <ChevronRight size={18} aria-hidden="true" />
              {/if}
            </button>
            {#if isExpanded(chapter.chapterNum)}
              <div
                id={`chapter-acts-${chapter.chapterNum}`}
                class="ml-3 mt-1 space-y-1"
              >
                {#each chapter.acts as act (act.rawName)}
                  {@const isActive =
                    act.rawName === currentAct &&
                    extractChapterKey(act.sceneId) === currentChapterKey}
                  <button
                    type="button"
                    class="w-full rounded-lg px-3 py-3 text-left text-sm {isActive
                      ? 'bg-blue-500 font-semibold text-white'
                      : 'bg-white/60 text-slate-700 hover:bg-blue-50'}"
                    onclick={() => handleSelect(act.sceneId)}
                  >
                    {act.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
```

Leave the `{:else}` (branches mode) block and everything after it unchanged.

- [ ] **Step 5: Run the drawer tests**

Run: `bun --filter web test src/components/__tests__/MobileActDrawer.test.ts`
Expected: PASS (all, including the new accordion test; the existing branch-mode tests still pass via the `beforeEach` reset).

- [ ] **Step 6: Run lint**

Run: `bun lint`
Expected: no new errors. (Note: `expandedChapters` is a plain reassigned array — no `Set`/`Map` — so `svelte/prefer-svelte-reactivity` does not fire.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/MobileActDrawer.svelte apps/web/src/components/__tests__/MobileActDrawer.test.ts
git commit -m "feat(reader): collapsible chapters in the mobile act drawer"
```

---

### Task 4: Phase A regression sweep + mobile E2E

**Files:** none (verification only).

- [ ] **Step 1: Run the full web unit suite**

Run: `bun --filter web test`
Expected: PASS — all suites green (NovelReader untouched; MobileNovelReader, MobileActDrawer, ReaderShell, reader-manager, MobileBacklogSheet, etc.).

- [ ] **Step 2: Run the mobile E2E**

Run: `bun --filter e2e test:e2e tests/reader-mobile.spec.ts`
Expected: PASS (3 tests). The spec uses `getByLabel('Open menu')`, `getByRole('link', { name: /Back to Home/i })`, `getByLabel('Open acts panel')`, `getByLabel('Open history')`, and the drawer/backlog headings — all preserved by Tasks 1–3.

- [ ] **Step 3: Manual viewport check (recommended)**

Start `bun dev:web` (port 5090), open `/en/reader` at a phone viewport: confirm the hamburger reveals the icon toolbar without crowding, the progress bar tracks position, ◀ steps back (disabled on line 1), History opens the backlog, and the acts drawer chapters collapse/expand. Confirm the desktop reader at ≥1024px is unchanged.

No commit (verification only). If anything fails, fix under the owning task before continuing.

---

## Phase B — Page polish

> Phase B is independent of Phase A and may merge separately. Visual production uses the **frontend-design skill**; the existing unit + E2E suites encode the behavioral contract and are the regression gate. These tasks keep the current ocean + glassmorphism identity and reduce the heavy `Orbitron`/neon/hexagon/"power-bar" chrome to tasteful accents — no new theme, routes, or destinations.

### Task 5: Main menu polish (#2)

**Files:**
- Modify: `apps/web/src/components/MainMenu.svelte` (template/markup + classes only; **keep Svelte 4 syntax**)
- Regression: `apps/web/src/components/__tests__/MainMenu.test.ts` (must stay green, unmodified)

**Preserve exactly (asserted by `MainMenu.test.ts` + `MainMenuPage`):**
- First `<h1>` renders `{translations.menu.heading}`.
- Start control: an `<a id="start-btn" href={/${currentLocale}/stories}>` whose text is `{translations.menu.startGame}` (locale-correct href via the existing `currentLocale` logic).
- Bookmarks: a `<button>` with text `{translations.menu.bookmarks}` wired to `handleBookmarksClick`.
- Settings: a `<button id="settings-btn">` with text `{translations.menu.settings}` wired to `handleSettingsClick`.
- Language links: `English` → `/en/` and `中文` → `/zh/`, each calling `handleLanguageClick(...)`.

- [ ] **Step 1: Confirm the baseline is green**

Run: `bun --filter web test src/components/__tests__/MainMenu.test.ts`
Expected: PASS (records the contract before any change).

- [ ] **Step 2: Restyle the markup (frontend-design skill)**

Invoke the frontend-design skill and restyle `MainMenu.svelte` while preserving every item in "Preserve exactly" above. Direction:
- Limit `Orbitron` to the `<h1>` (and at most small accents); render button labels and body copy in a readable sans (the existing `Exo 2`/system stack).
- Establish clear hierarchy: Start as the primary action, Bookmarks/Settings visually secondary; even vertical rhythm between buttons.
- Make the title and buttons responsive — the title should scale down on small screens (e.g. `text-4xl sm:text-5xl lg:text-6xl`) rather than the fixed `text-6xl`; buttons should not overflow narrow viewports.
- Reduce decorative clutter (oversized glow corners, etc.) to subtle accents; keep the ocean background and the glass card.
- Keep the existing `on:click` handlers and `export let`/`$:` logic unchanged (legacy Svelte 4).

- [ ] **Step 3: Run the unit tests**

Run: `bun --filter web test src/components/__tests__/MainMenu.test.ts`
Expected: PASS (unchanged) — every preserved selector/text/href/handler still resolves.

- [ ] **Step 4: Lint**

Run: `bun lint`
Expected: no new errors.

- [ ] **Step 5: Manual viewport check**

`bun dev:web`; open `/en/` and `/zh/` at desktop + phone widths; confirm hierarchy/spacing improved, no overflow, links/buttons work.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/MainMenu.svelte
git commit -m "style(menu): polish main menu layout and hierarchy"
```

---

### Task 6: Story-choosing page polish (#2)

**Files:**
- Modify: `apps/web/src/pages/[locale]/stories/index.astro` (markup + classes; new story descriptors if added → i18n both locales)
- Regression: `packages/e2e/tests/navigation.spec.ts` + `StoriesPage` (must stay green)

**Preserve exactly (asserted by `StoriesPage`/`navigation.spec.ts`):**
- First `<h1>` renders `t('stories.heading')`.
- Train Adventure stays a **link** (`<a>`/`Button … href`) whose accessible name **contains** `t('stories.trainAdventure')`, pointing to `/${locale}/reader?story=${StoryId.TRAIN_ADVENTURE}`.
- The second story keeps its link to `…?story=${StoryId.DONT_SAVE_ME_BEFORE_MIDNIGHT}`.
- Back button and `UserStatus` remain.

- [ ] **Step 1: Confirm the baseline E2E is green**

Run: `bun --filter e2e test:e2e tests/navigation.spec.ts`
Expected: PASS (the start-game → stories → reader flow).

- [ ] **Step 2: Restyle into story cards (frontend-design skill)**

Invoke the frontend-design skill and restyle `stories/index.astro`. Direction:
- Present the two stories as consistent selectable **cards** (each card is the link; title from `t('stories.trainAdventure')` / `t('stories.dontSaveMeBeforeMidnight')` plus an optional short descriptor). If a descriptor is added, add the key to **both** `en.json` and `zh.json` and keep the story title as a substring of the link's accessible name.
- Tone down the hexagon + "power indicator bar" decorative cluster to a subtle accent; keep the ocean background, glass card, back button, and `UserStatus`.
- Improve hierarchy/spacing and mobile layout; keep `prefers-reduced-motion` handling already present in the page `<style>`.

- [ ] **Step 3: Run the navigation E2E**

Run: `bun --filter e2e test:e2e tests/navigation.spec.ts`
Expected: PASS — `StoriesPage.expectToBeVisible()` (heading + Train Adventure link) and `selectTrainAdventure()` still resolve.

- [ ] **Step 4: Lint**

Run: `bun lint`
Expected: no new errors.

- [ ] **Step 5: Manual viewport check**

`bun dev:web`; open `/en/stories` and `/zh/stories` at desktop + phone widths; confirm the cards read clearly, both stories navigate to the reader, and the layout holds on mobile.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/[locale]/stories/index.astro packages/stories/src/translations/en.json packages/stories/src/translations/zh.json
git commit -m "style(stories): polish story-choosing page into cards"
```

(If no descriptor strings were added, drop the two translation files from the `git add`.)

---

## Self-Review

**Spec coverage:**
- §3.1 A1 chrome-bar layout → Task 1 (icon toolbar + progress bar). ✓
- §3.2 A2 go-back (mobile only, within-scene, disabled at 0, no `onNext`) → Task 2. ✓
- §3.3 A3 collapsible chapters (current expanded by default) → Task 3. ✓
- §3.4 edge cases (index-0 no-op, length guard, reduced-motion) → Task 2 `goBack`, Task 1 `progressFraction` guard + `motion-safe:`. ✓
- §3.5 Phase A testing + desktop regression → Tasks 1–3 unit tests + Task 4 full suite & mobile E2E. ✓
- §4.1 main menu polish → Task 5. ✓  §4.2 story page cards → Task 6. ✓  §4.3 constraints (no route/behavior change, i18n parity, a11y, suites green) → "Preserve exactly" blocks + regression steps in Tasks 5–6. ✓
- §2 non-goals (no desktop changes, no site-wide header, no full restyle) → Phase A files are reader-only; Phase B restyles two named files preserving contracts. ✓

**Placeholder scan:** every code step contains full code; every test step contains real assertions; every run step states the command and expected result. Tasks 5–6 explicitly delegate visual markup to the frontend-design skill with a hard preservation contract (not a placeholder — the contract is exact and test-enforced). ✓

**Type consistency:** `goBack(): void`, `isExpanded(num: number): boolean`, `toggleChapter(num: number): void`, `progressFraction: number` are defined once and referenced consistently. Icon names (`House`, `Layers`, `ChevronLeft`, `History`, `Bookmark`, `ChevronDown`, `ChevronRight`) match verified lucide-svelte exports. i18n key `reader.previousLine` is added (both locales + test mock) before use. ✓
