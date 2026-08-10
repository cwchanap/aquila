# Visual Novel Reader Controls and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver transparent local-preview portraits, left/right-only portrait placement, a reversible Visual mode, consolidated reader controls, dialogue-attached History, and fixed visual dialogue geometry without changing canonical reader progression.

**Architecture:** `ReaderShell` remains the owner of reader mode, bookmark delegation, responsive leaf selection, and the new settings state. `ReaderSettingsMenu` is a shell-owned focus-trapped dialog used by Visual mode at every breakpoint and desktop Text, while mobile Text retains its one hamburger menu and gains a Visual Novel action. Portrait-slot narrowing stays in the story compiler/runtime contract, and transparent source/encoded asset acceptance stays in the existing local fixture builder and verifier.

**Tech Stack:** Bun workspaces, TypeScript 5.9, Svelte 5 runes, Astro 5, Vitest, Testing Library, Playwright, Sharp 0.34, the existing `focusTrap` Svelte action, and the built-in image-generation editor.

## Global Constraints

- Prefix every repository command with `rtk`.
- Execute implementation in an isolated git worktree created with `superpowers:using-git-worktrees`.
- Use test-driven development: observe the focused RED failure before each implementation slice, then run focused GREEN verification before committing.
- `ReaderManager` and `readerState` remain the only owners of story, scene, locale, dialogue index, URL, browser history, and bookmark progression.
- Never add settings, reader mode, portrait placement, or visual state to the URL, bookmark record, or persisted `ReaderSessionState`.
- Persist only `text | visual` under the existing `aquila:reader-mode:v1` key.
- Use `ReaderShell` state and controlled props; do not add a store, event bus, or direct `readerState` import to a leaf.
- Add all new reader strings to both `packages/stories/src/translations/en.json` and `packages/stories/src/translations/zh.json`.
- Use Svelte interpolation and `textContent`; never use `innerHTML`.
- Every interactive control remains at least 44 x 44 CSS pixels.
- Build `ReaderSettingsMenu` from the `VisualBacklog` + `focusTrap` pattern; do not reuse or refactor `apps/web/src/components/ui/Modal.svelte`.
- Visual and desktop Text expose Home, Bookmark, and mode only through Settings. Mobile Text keeps Home and Bookmark in its existing hamburger and adds Visual Novel there.
- Keep `reader-ready` `inert` and `aria-hidden` synchronized from `leafDisabled = isBlocking || settingsOpen`.
- A Visual backlog or Acts panel makes the shell Settings trigger unavailable; never inert a leaf-owned focus-trap dialog.
- Dialogue heights are exactly `18rem` for desktop/regular landscape, `40dvh` for mobile portrait, and `9.5rem` for compact landscape at `max-height: 31rem`.
- Portrait and dialogue rectangles retain at least `0.75rem` separation at every layout class.
- `PortraitSlot` is exactly `'left' | 'right'`; missing metadata defaults to `left`, with no `center` compatibility alias.
- Source portraits remain exactly 450 x 600 PNGs with real alpha and preserve the existing character, pose, clothing, crop, and edge placement.
- Local portrait WebP encoding uses `quality: 82`, `alphaQuality: 100`, `lossless: false`, `preset: 'picture'`, `smartSubsample: true`, and `effort: 6`.
- Do not add a web dependency on `@aquila/infra-cloudflare`; keep the fixture options explicit and verify the emitted alpha boundary.
- Do not generate unavailable expressions, touch private source archives, publish to R2, mutate a remote pointer, or use release credentials.
- `rtk bun run test`, not bare `bun test`, is the repository-wide test command.

---

## File Structure

### Reader settings and responsive ownership

- Create `apps/web/src/components/ReaderSettingsMenu.svelte` — shell-owned trigger, scrim, focus-trapped dialog, mode actions, bookmark handoff, and Home link.
- Create `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts` — focused dialog, focus restoration, bookmark-timing, and disabled-state tests.
- Modify `apps/web/src/components/ReaderShell.svelte` — own `settingsOpen`, `leafOverlayOpen`, `leafDisabled`, mode focus handoff, and responsive Settings availability.
- Modify `apps/web/src/components/NovelReader.svelte` — remove desktop Home/Bookmark props and chrome while retaining progress.
- Modify `apps/web/src/components/MobileNovelReader.svelte` — retain the existing chrome and add the controlled Visual Novel action.
- Modify `apps/web/src/components/VisualNovelReader.svelte` — remove Home/Bookmark props and report leaf-overlay state.
- Modify `apps/web/src/components/__tests__/ReaderShell.test.ts` — shell gating, responsive ownership, focus transfer, and mode-position preservation.
- Modify `apps/web/src/components/__tests__/NovelReader.test.ts` — desktop chrome removal.
- Modify `apps/web/src/components/__tests__/MobileNovelReader.test.ts` — single-menu retention and Text-to-Visual callback.
- Modify `apps/web/src/components/__tests__/VisualNovelReader.test.ts` — visual chrome removal and overlay reporting.
- Modify `packages/stories/src/translations/en.json` and `zh.json` — Settings trigger/title/close labels.
- Modify `packages/e2e/tests/utils.ts` — settings-aware Visual page object while preserving mobile bookmark/Home locators.
- Modify `packages/e2e/tests/reader-visual.spec.ts` — open Settings before mode/bookmark actions and cover mobile mode entry.

### Visual dialogue geometry

- Modify `apps/web/src/components/VisualNovelReader.svelte` — move History into the dialogue box; add two-row fixed geometry and portrait clearance driven by `--dialogue-box-height`.
- Modify `apps/web/src/components/__tests__/VisualNovelReader.test.ts` — History placement and permanently reserved footer structure.
- Modify `packages/e2e/tests/utils.ts` — dialogue/body/footer locators.
- Modify `packages/e2e/tests/reader-visual.spec.ts` — height stability, responsive heights, History position, and portrait-gap measurements.

### Portrait-slot contract

- Modify `packages/stories/src/types.ts` — narrow `PortraitSlot`.
- Modify `packages/stories/src/compiler/parse-characters.ts` — accept left/right only and report the narrowed error.
- Modify `packages/stories/src/compiler/emit.ts` — emit `left` as the default.
- Modify compiler/runtime/unit fixtures that currently hard-code `center`.
- Regenerate the three checked-in `packages/stories/src/generated/*/presentation.ts` files through `compile:stories`.
- Modify `apps/web/src/lib/visual-assets/types.ts`, `visual-state-controller.ts`, and `VisualNovelReader.svelte` — left fallback and no center selector.

### Transparent asset tooling and binaries

- Modify `apps/web/scripts/verify-visual-fixtures.ts` — source PNG metadata and source/output alpha checks inside the existing verifier.
- Modify `apps/web/scripts/__tests__/verify-visual-fixtures.test.ts` — path-aware Sharp metadata fixtures and RED coverage.
- Modify `apps/web/scripts/build-visual-fixtures.ts` — complete explicit WebP options.
- Modify `apps/web/scripts/__tests__/build-visual-fixtures.test.ts` — exact encoder-option assertion.
- Modify the two checked-in base PNG portraits using the built-in image editor.
- Regenerate the local content-addressed pointer, manifest, and portrait WebP objects; remove only the obsolete release manifest and portrait objects.
- Modify `packages/e2e/tests/reader-visual.spec.ts` — update the content-addressed Mio object route from the regenerated manifest.

---

### Task 1: Add Shell Settings and Preserve One Responsive Menu

**Files:**
- Create: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Create: `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/NovelReader.svelte`
- Modify: `apps/web/src/components/MobileNovelReader.svelte`
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `apps/web/src/components/__tests__/NovelReader.test.ts`
- Modify: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`
- Modify: `packages/e2e/tests/utils.ts`
- Modify: `packages/e2e/tests/reader-visual.spec.ts`

**Interfaces:**
- Produces: `ReaderSettingsMenu` with `open?: boolean` as a Svelte 5 `$bindable` prop.
- Produces: `onModeChange: (mode: ReaderMode) => void | Promise<void>` for the popup and mobile leaf.
- Produces: `onOverlayChange?: (open: boolean) => void` from `VisualNovelReader` to `ReaderShell`.
- Preserves: `onBookmark(dialogueIndex + 1)`, `backUrl`, mode persistence, visual-runtime retention, and mobile Home/Bookmark page-object flows.

- [ ] **Step 1: Add focused RED tests for the Settings component**

Create `ReaderSettingsMenu.test.ts` with tests that render `open: true`, verify the dialog title and first focused action, close through Escape/scrim/close, and prove the bookmark prompt keeps focus after the callback:

```ts
it('deactivates the trap before opening the bookmark prompt', async () => {
    const onBookmark = vi.fn(() => {
        const input = document.createElement('input');
        input.setAttribute('aria-label', 'Bookmark name');
        document.body.append(input);
        input.focus();
    });
    render(ReaderSettingsMenu, {
        props: {
            open: true,
            locale: 'en',
            mode: 'visual',
            onModeChange: vi.fn(),
            onBookmark,
            showBookmarkButton: true,
            backUrl: '/en/',
            bookmarkDisabled: false,
            triggerUnavailable: false,
        },
    });

    await fireEvent.click(screen.getByRole('button', { name: '📖 Bookmark' }));

    expect(onBookmark).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Bookmark name')).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Reader settings' }))
        .not.toBeInTheDocument();
});
```

Add assertions that `showBookmarkButton: false` omits Bookmark, `bookmarkDisabled: true` disables it, mode buttons expose `aria-pressed`, Home uses `/en/`, and `triggerUnavailable: true` removes the Settings trigger from focus and pointer interaction.

- [ ] **Step 2: Add shell/leaf RED tests before removing chrome**

In the four existing component suites, add exact expectations for:

```ts
expect(screen.getByRole('button', { name: 'Open reader settings' }))
    .toBeInTheDocument();
await fireEvent.click(screen.getByRole('button', { name: 'Open reader settings' }));
expect(screen.getByTestId('reader-ready')).toHaveAttribute('inert');
expect(screen.getByTestId('reader-ready')).toHaveAttribute('aria-hidden', 'true');
await fireEvent.keyDown(window, { key: 'Enter' });
expect(onIndexChange).not.toHaveBeenCalled();
```

Add a Visual test that opens History and an Acts-panel test that expects `onOverlayChange(true)`, then closes/unmounts and expects `false`. Add a mobile Text test that opens the existing hamburger, retains Home and Bookmark, invokes `onModeChange('visual')`, and never renders `Open reader settings`. Replace desktop Text/Visual assertions for their old Home/Bookmark controls with absence assertions.

- [ ] **Step 3: Run component tests and confirm the expected RED failures**

Run:

```bash
rtk bun --filter web test src/components/__tests__/ReaderSettingsMenu.test.ts src/components/__tests__/ReaderShell.test.ts src/components/__tests__/NovelReader.test.ts src/components/__tests__/MobileNovelReader.test.ts src/components/__tests__/VisualNovelReader.test.ts
```

Expected: FAIL because `ReaderSettingsMenu.svelte`, its translated labels, the overlay callback, and the new ownership map do not exist.

- [ ] **Step 4: Add translation keys in both locales**

Add these exact keys under `reader`:

```json
"openSettings": "Open reader settings",
"settingsTitle": "Reader settings",
"closeSettings": "Close reader settings"
```

```json
"openSettings": "開啟閱讀設定",
"settingsTitle": "閱讀設定",
"closeSettings": "關閉閱讀設定"
```

Reuse the existing `readerMode`, `textMode`, `visualNovelMode`, `bookmark`, and `common.backToHome` strings.

- [ ] **Step 5: Implement the focused Settings dialog**

Use this prop and timing contract in `ReaderSettingsMenu.svelte`:

```ts
import { tick } from 'svelte';
import { Cog, X } from 'lucide-svelte';
import type { Locale } from '@aquila/stories';
import { getTranslations } from '@aquila/stories/translations';
import type { ReaderMode } from '@/lib/reader-mode';
import { focusTrap } from '@/lib/focus-trap';

let {
    open = $bindable(false),
    locale,
    mode,
    onModeChange,
    onBookmark,
    showBookmarkButton,
    backUrl,
    bookmarkDisabled,
    triggerUnavailable,
}: {
    open?: boolean;
    locale: Locale;
    mode: ReaderMode;
    onModeChange: (mode: ReaderMode) => void | Promise<void>;
    onBookmark: () => void;
    showBookmarkButton: boolean;
    backUrl: string;
    bookmarkDisabled: boolean;
    triggerUnavailable: boolean;
} = $props();

let trigger: HTMLButtonElement | null = $state(null);
let t = $derived(getTranslations(locale));

async function chooseMode(nextMode: ReaderMode): Promise<void> {
    open = false;
    await tick();
    await onModeChange(nextMode);
}

async function bookmark(): Promise<void> {
    open = false;
    await tick();
    onBookmark();
}
```

Render `#reader-settings-trigger` as a fixed 44 x 44 gear button outside the dialog. When open, render a fixed scrim plus `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="reader-settings-title"`; use `use:focusTrap={{ enabled: true, restoreFocus: trigger }}`. Provide Escape, close-button, and scrim closing. Render the Text/Visual buttons as `aria-pressed`, conditionally render Bookmark, and render Home as an anchor to `backUrl`. Keep the component above reader blocking content and below no other shell modal by using one fixed `z-[90]` layer.

- [ ] **Step 6: Replace the shell mode group with controlled Settings state**

In `ReaderShell.svelte`, add the state and derived gates after `isMobile` has
been initialized:

```ts
let settingsOpen = $state(false);
let leafOverlayOpen = $state(false);
let settingsAvailable = $derived(readerMode === 'visual' || !isMobile);
let leafDisabled = $derived(isBlocking || settingsOpen);

async function changeReaderMode(mode: ReaderMode): Promise<void> {
    leafOverlayOpen = false;
    setReaderMode(mode);
    await tick();
    const triggerId =
        mode === 'text' && isMobile
            ? 'mobile-reader-menu-trigger'
            : 'reader-settings-trigger';
    document.getElementById(triggerId)?.focus();
}

function handleVisualOverlayChange(open: boolean): void {
    leafOverlayOpen = open;
}
```

Add this responsive-close effect:

```ts
$effect(() => {
    if (settingsAvailable || !settingsOpen) return;
    const focusWasInSettings =
        document.activeElement?.closest('[data-reader-settings]') !== null;
    settingsOpen = false;
    void tick().then(() => {
        if (focusWasInSettings) {
            document.getElementById('mobile-reader-menu-trigger')?.focus();
        }
    });
});
```

Change both the inert synchronization effect and `aria-hidden` to
`leafDisabled`; pass `interactionDisabled={leafDisabled}` to every leaf.
Render `ReaderSettingsMenu` only when `settingsAvailable`, bind `open`, pass
`triggerUnavailable={leafOverlayOpen}`, use
`onBookmark={() => onBookmark(dialogueIndex + 1)}`, add
`data-reader-settings` to its fixed wrapper, and keep it outside
`reader-ready`.

- [ ] **Step 7: Apply the responsive control ownership map**

Remove `backUrl`, `showBookmarkButton`, and `onBookmark` from `NovelReader` and `VisualNovelReader` props and markup. Keep the desktop progress line. Keep mobile Home/Bookmark unchanged and add:

```ts
import type { ReaderMode } from '@/lib/reader-mode';

onModeChange = () => {},

onModeChange?: (mode: ReaderMode) => void | Promise<void>;

async function enterVisualMode(): Promise<void> {
    chromeVisible = false;
    await tick();
    await onModeChange('visual');
}
```

Add a 44 x 44 translated Visual Novel action to the existing mobile chrome, set `id="mobile-reader-menu-trigger"` on its persistent hamburger, and pass `onModeChange={changeReaderMode}` from the shell. In `VisualNovelReader`, add `onOverlayChange = () => {}`; report `backlogOpen || actPanelOpen` from an effect and call `onOverlayChange(false)` in `onDestroy`.

- [ ] **Step 8: Update browser page objects and mode/chrome flows in the same slice**

Replace `VisualReaderPage.modeControl` with Settings helpers:

```ts
get settingsButton() {
    return this.page.getByRole('button', { name: 'Open reader settings' });
}

get settingsDialog() {
    return this.page.getByRole('dialog', { name: 'Reader settings' });
}

async openSettings() {
    await this.settingsButton.click();
    await expect(this.settingsDialog).toBeVisible();
}
```

Update every Visual mode toggle and bookmark flow to call `openSettings()` first. Keep `MobileReaderPage.bookmarkButton` and `backToHomeLink` unchanged, add a localized `visualNovelModeButton`, and add a mobile Text-to-Visual test that confirms the URL dialogue line is unchanged and focus lands on `Open reader settings` after the leaf swap.

- [ ] **Step 9: Run focused GREEN verification**

Run:

```bash
rtk bun --filter web test src/components/__tests__/ReaderSettingsMenu.test.ts src/components/__tests__/ReaderShell.test.ts src/components/__tests__/NovelReader.test.ts src/components/__tests__/MobileNovelReader.test.ts src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk bun --filter web lint
rtk git diff --check
```

Expected: focused component and browser tests PASS; lint and whitespace checks PASS. Existing mobile bookmark/Home tests continue passing without locator changes.

- [ ] **Step 10: Commit the settings slice**

```bash
rtk git add apps/web/src/components/ReaderSettingsMenu.svelte apps/web/src/components/ReaderShell.svelte apps/web/src/components/NovelReader.svelte apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts apps/web/src/components/__tests__/ReaderShell.test.ts apps/web/src/components/__tests__/NovelReader.test.ts apps/web/src/components/__tests__/MobileNovelReader.test.ts apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/stories/src/translations/en.json packages/stories/src/translations/zh.json packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): consolidate visual reader controls"
```

---

### Task 2: Fix Visual Dialogue Geometry and Attach History

**Files:**
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- Modify: `packages/e2e/tests/utils.ts`
- Modify: `packages/e2e/tests/reader-visual.spec.ts`

**Interfaces:**
- Produces: `data-testid="visual-dialogue-box"`, `visual-dialogue-body`, and `visual-dialogue-footer` for layout acceptance.
- Preserves: current-scene backlog content, `historyButton` focus restoration, pointer-movement guards, choices, Continue/Next/Complete semantics, and progress text.

- [ ] **Step 1: Add RED structure tests**

In `VisualNovelReader.test.ts`, assert History is a child of the dialogue box, the old `.reader-controls` nav is absent, and the body/footer remain mounted during and after typing:

```ts
const box = screen.getByTestId('visual-dialogue-box');
expect(within(box).getByRole('button', { name: 'Open history' }))
    .toBeInTheDocument();
expect(screen.getByTestId('visual-dialogue-body')).toBeInTheDocument();
expect(screen.getByTestId('visual-dialogue-footer')).toBeInTheDocument();
expect(document.querySelector('.reader-controls')).toBeNull();
```

Run:

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
```

Expected: FAIL because History still lives in the top navigation and the fixed body/footer test IDs do not exist.

- [ ] **Step 2: Move History and implement the two-row panel**

Use this structure:

```svelte
<section class="dialogue-box" data-testid="visual-dialogue-box" aria-live="off">
  <button
    bind:this={historyButton}
    type="button"
    class="history-control"
    data-reader-interactive
    aria-label={t.reader.openHistory}
    onclick={() => (backlogOpen = true)}
  >
    {t.reader.openHistory}
  </button>

  <div class="dialogue-body" data-testid="visual-dialogue-body">
    {#if currentName}<p class="speaker">{currentName}</p>{/if}
    {#if currentDialogue}
      <p class="dialogue-text">
        {#if isTyping}
          {typingText}<span
            data-testid="visual-typewriter-cursor"
            class="typewriter-cursor"
            aria-hidden="true"
          ></span>
        {:else}
          {currentDialogue.dialogue}
        {/if}
      </p>
    {/if}
    {#if showChoices}
      <div class="choices">
        <p>{choice?.prompt}</p>
        {#each choice?.options ?? [] as option (option.id)}
          <button
            type="button"
            data-reader-interactive
            onclick={() => onChoice(option.nextScene)}
          >{option.label}</button>
        {/each}
      </div>
    {/if}
  </div>

  <footer class="dialogue-footer" data-testid="visual-dialogue-footer">
    <div class="action-slot">
      {#if !showChoices && !isTyping && currentDialogue}
        <button
          type="button"
          class="next-control"
          data-reader-interactive
          onclick={advance}
        >
          {#if !isLastDialogue}
            {t.reader.continue}
          {:else if canGoNext}
            {t.reader.nextScene}
          {:else}
            {t.reader.complete}
          {/if}
        </button>
      {/if}
    </div>
    {#if dialogue.length > 0}<p class="progress">{progressText}</p>{/if}
  </footer>
</section>
```

Keep `.action-slot` mounted while typing. Make `.dialogue-box` `position: absolute`, `box-sizing: border-box`, `height: var(--dialogue-box-height)`, `overflow: hidden`, and a two-row grid with `minmax(0, 1fr) minmax(2.75rem, auto)`. Make `.dialogue-body` internally scrollable with right padding of at least `3.5rem`. Absolutely anchor `.history-control` at the panel's top-right with a 44 x 44 minimum. Put action and progress in the same footer row.

- [ ] **Step 3: Drive portrait clearance from one height variable**

Define the default and responsive values on `.visual-novel-reader`:

```css
.visual-novel-reader {
  --dialogue-box-height: 18rem;
}

@media (max-width: 47.99rem) and (orientation: portrait) {
  .visual-novel-reader { --dialogue-box-height: 40dvh; }
}

@media (max-height: 31rem) and (orientation: landscape) {
  .visual-novel-reader { --dialogue-box-height: 9.5rem; }
}
```

Replace independent portrait offsets with:

```css
.visual-portrait {
  bottom: calc(
    var(--dialogue-box-height) +
    max(1rem, env(safe-area-inset-bottom)) +
    0.75rem
  );
  max-height: calc(
    100dvh - var(--dialogue-box-height) - 3.5rem -
    env(safe-area-inset-top) - env(safe-area-inset-bottom)
  );
}
```

Retain breakpoint-specific portrait width tuning, but remove the old `12rem/28vh/20rem`, `42dvh`, and `8.5rem` bottom rules and the dialogue `max-height` rules.

- [ ] **Step 4: Add RED/GREEN browser geometry assertions**

Expose these page-object locators:

```ts
get dialogueBox() { return this.root.getByTestId('visual-dialogue-box'); }
get dialogueBody() { return this.root.getByTestId('visual-dialogue-body'); }
get dialogueFooter() { return this.root.getByTestId('visual-dialogue-footer'); }
```

In `reader-visual.spec.ts`, measure the box immediately after navigation, during typing, and after clicking to complete typing. Assert height deltas are below 1 CSS pixel. Test viewports `1280 x 800`, `390 x 844`, and `844 x 390`; assert heights are respectively 288 px, `0.40 * viewport height`, and 152 px within 1 px. Assert the History rectangle is inside the box's top-right region and:

```ts
expect(portraitBox.y + portraitBox.height)
    .toBeLessThanOrEqual(dialogueBox.y - 12 + 1);
```

- [ ] **Step 5: Run focused GREEN verification**

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk bun --filter web lint
rtk git diff --check
```

Expected: History/focus tests, fixed-height measurements, all three responsive classes, portrait-gap assertions, lint, and diff checks PASS.

- [ ] **Step 6: Commit the layout slice**

```bash
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "fix(reader): stabilize visual dialogue layout"
```

---

### Task 3: Narrow Portrait Slots to Left and Right

**Files:**
- Modify: `packages/stories/src/types.ts`
- Modify: `packages/stories/src/compiler/parse-characters.ts`
- Modify: `packages/stories/src/compiler/emit.ts`
- Modify: `packages/stories/src/compiler/__tests__/parse-characters.test.ts`
- Modify: `packages/stories/src/compiler/__tests__/emit.test.ts`
- Modify: `packages/stories/src/__tests__/stories.test.ts`
- Modify: `packages/stories/src/async/__tests__/loader.test.ts`
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Modify: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-intent.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- Regenerate: `packages/stories/src/generated/trainAdventure/presentation.ts`
- Regenerate: `packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts`
- Regenerate: `packages/stories/src/generated/theSeventhMirror/presentation.ts`

**Interfaces:**
- Produces: `export type PortraitSlot = 'left' | 'right'`.
- Produces: compiler and runtime missing-slot fallback `left`.
- Preserves: explicit Mio-left and Yuma-right assignments and the one-active-portrait limit.

- [ ] **Step 1: Change tests to the intended contract and observe RED**

Update parser tests so case-insensitive Left/Right are accepted and Center is rejected:

```ts
expect(() => parseCharacters(centerMarkdown)).toThrow(
    /Portrait Slot.*left or right/
);
expect(parseCharacters(rightMarkdown).getById('b')?.portraitSlot).toBe('right');
```

Change emit/story/loader/controller expectations from `center` to `left`, including missing-presentation and missing-character cases. Change all handwritten reader fixtures listed in the file block to `defaultSlot: 'left'` and `slot: 'left'`.

Run:

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts
```

Expected: FAIL on the existing center parser/type/emitter/runtime behavior.

- [ ] **Step 2: Narrow compiler and runtime types**

Make these exact changes:

```ts
// packages/stories/src/types.ts
export type PortraitSlot = 'left' | 'right';

// apps/web/src/lib/visual-assets/types.ts
export type VisualPortraitLayer = VisualImageLayer & {
    slot: 'left' | 'right';
};
```

In `parsePortraitSlot`, accept only left/right and change the error to `expected left or right`. In `emitPresentation`, emit `defaultSlot: "left"`. Change `initialSnapshot()`, `portraitSlot()`, and `VisualNovelReader.emptySnapshot` to `left`. Remove `.visual-portrait[data-portrait-slot='center']` entirely.

- [ ] **Step 3: Regenerate presentations and prove the diff is bounded**

```bash
rtk bun compile:stories
rtk git diff --name-only -- packages/stories/src/generated packages/stories/src/stories
```

Expected generated diff: only these files:

```text
packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts
packages/stories/src/generated/theSeventhMirror/presentation.ts
packages/stories/src/generated/trainAdventure/presentation.ts
```

Each changes only `defaultSlot: "center"` to `defaultSlot: "left"`; explicit Mio/Yuma assignments remain left/right.

- [ ] **Step 4: Run focused GREEN verification and scan out center contract remnants**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts
rtk rg -n "defaultSlot.*center|slot.*center|Portrait Slot.*center|data-portrait-slot='center'" packages/stories apps/web/src
rtk git diff --check
```

Expected: tests PASS; the center scan returns no portrait-contract matches. Unrelated CSS values such as `align-items: center` are not part of the scan.

- [ ] **Step 5: Stage generated output, run drift verification, and commit**

```bash
rtk git add packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts packages/stories/src/compiler/__tests__/parse-characters.test.ts packages/stories/src/compiler/__tests__/emit.test.ts packages/stories/src/__tests__/stories.test.ts packages/stories/src/async/__tests__/loader.test.ts packages/stories/src/generated/trainAdventure/presentation.ts packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts packages/stories/src/generated/theSeventhMirror/presentation.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts apps/web/src/lib/__tests__/reader-intent.test.ts apps/web/src/lib/__tests__/reader-manager.test.ts apps/web/src/lib/__tests__/reader-manager-coverage.test.ts apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts
rtk bun compile:check
rtk git commit -m "feat(stories): restrict portrait slots to scene edges"
```

Expected: `compile:check` regenerates no unstaged story drift; commit contains the compiler cut, fixtures, runtime fallback, CSS removal, and three generated presentations only.

---

### Task 4: Extend Existing Fixture Verification for Alpha

**Files:**
- Modify: `apps/web/scripts/verify-visual-fixtures.ts`
- Modify: `apps/web/scripts/__tests__/verify-visual-fixtures.test.ts`
- Modify: `apps/web/scripts/build-visual-fixtures.ts`
- Modify: `apps/web/scripts/__tests__/build-visual-fixtures.test.ts`

**Interfaces:**
- Produces: source format/dimension/alpha problems aggregated by `verifyVisualFixtures()`.
- Produces: output portrait WebP alpha verification in the same manifest loop.
- Preserves: source allowlist, 768 KiB limit, coverage, pointer/manifest integrity, hashes, byte lengths, dimensions, and stale-manifest checks.

- [ ] **Step 1: Add verifier RED cases**

Replace the source set in the test harness with expected metadata and make the Sharp mock distinguish string source paths from object buffers. Add tests for a portrait source with `format: 'jpeg'`, `width: 449`, `height: 600`, or `hasAlpha: false`, plus a portrait WebP with `hasAlpha: false`.

Use exact expected messages:

```ts
await expect(verifyVisualFixtures()).rejects.toThrow(
    /portrait source must be a 450 x 600 PNG with alpha/
);
await expect(verifyVisualFixtures()).rejects.toThrow(
    /portrait object does not preserve alpha/
);
```

- [ ] **Step 2: Add the exact encoder-option RED assertion**

Expose one shared `webpMock` from the chain and assert:

```ts
expect(webpMock).toHaveBeenCalledWith({
    quality: 82,
    alphaQuality: 100,
    lossless: false,
    preset: 'picture',
    smartSubsample: true,
    effort: 6,
});
expect(webpMock).toHaveBeenCalledTimes(4);
```

Run:

```bash
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts
```

Expected: FAIL because source/output alpha is unchecked and the builder omits three explicit options.

- [ ] **Step 3: Add source metadata to the existing allowlist walk**

Replace the Set with a typed metadata map:

```ts
type FixtureSourceExpectation = {
    width: number;
    height: number;
    requiresAlpha: boolean;
};

const APPROVED_FIXTURE_SOURCES = new Map<string, FixtureSourceExpectation>([
    ['the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        { width: 1672, height: 941, requiresAlpha: false }],
    ['the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
        { width: 1672, height: 941, requiresAlpha: false }],
    ['the_seventh_mirror/characters/asakura_mio/base.png',
        { width: 450, height: 600, requiresAlpha: true }],
    ['the_seventh_mirror/characters/asakura_yuma/base.png',
        { width: 450, height: 600, requiresAlpha: true }],
] as const);
```

For every approved source, call `sharp(path).metadata()`. Require PNG plus the mapped dimensions for all four; when `requiresAlpha`, also require `hasAlpha === true`. Catch metadata failures and append them to `problems` rather than fail-fast.

Use `APPROVED_FIXTURE_SOURCES.get(rel)` in the source walk and iterate
`APPROVED_FIXTURE_SOURCES.keys()` for the missing-source check. In the test
harness, make source and object metadata explicit:

```ts
sharpMock.mockImplementation((input: unknown) => ({
    metadata: vi.fn(async () => {
        if (typeof input === 'string') {
            const portrait = input.includes('/characters/');
            return portrait
                ? { format: 'png', width: 450, height: 600, hasAlpha: true }
                : { format: 'png', width: 1672, height: 941, hasAlpha: false };
        }
        return { format: 'webp', width: 960, height: 540, hasAlpha: true };
    }),
}));
```

Allow each RED test to override one returned field without changing the
pointer/manifest/hash fixtures.

- [ ] **Step 4: Verify output alpha and complete builder options**

After the existing object dimension check, add:

```ts
if (asset.identity.type === 'portrait' && metadata.hasAlpha !== true) {
    problems.push(`portrait object does not preserve alpha: ${object.path}`);
}
```

Change the fixture encoding call to:

```ts
.webp({
    quality: 82,
    alphaQuality: 100,
    lossless: false,
    preset: 'picture',
    smartSubsample: true,
    effort: 6,
})
```

- [ ] **Step 5: Run GREEN tooling tests and commit without binary churn**

```bash
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts
rtk bun --filter web lint
rtk git diff --check
rtk git add apps/web/scripts/verify-visual-fixtures.ts apps/web/scripts/__tests__/verify-visual-fixtures.test.ts apps/web/scripts/build-visual-fixtures.ts apps/web/scripts/__tests__/build-visual-fixtures.test.ts
rtk git commit -m "test(assets): verify portrait alpha fixtures"
```

Expected: unit tests PASS. Do not run the real fixture verifier as GREEN yet: against the still-RGB source portraits it must fail, which is Task 5's acceptance RED.

---

### Task 5: Remove Portrait Backgrounds and Regenerate Local Fixtures

**Files:**
- Modify: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png`
- Modify: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png`
- Modify: `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json`
- Delete: `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/sha256-9ec642a37a531d9d59fb22470ef95e35493e6b7b9c92b240fd59ff0014fa1b4d/runtime-manifest.json`
- Generate: one replacement `runtime-manifest.json` under the release ID written to `current.json`
- Delete: `apps/web/public/assets/vn/objects/a930d03b393e3c2c2005018eef18328b2cc1cab5934628f0e6b8237040a2cccb.webp`
- Delete: `apps/web/public/assets/vn/objects/aa3669c33656995b535653b315f40cb4c7bb52f248eb79f6ce3189ab49e883e7.webp`
- Generate: two replacement content-addressed portrait WebP objects
- Modify: `packages/e2e/tests/reader-visual.spec.ts`

**Interfaces:**
- Produces: two 450 x 600 RGBA PNG sources and two alpha-preserving 450 x 600 WebP variants.
- Preserves: existing character identity, pose, clothing, crop, edge placement, two background objects, preview target `hpa-228-local`, and `publishedAt: 2026-07-26T00:00:00.000Z`.

- [ ] **Step 1: Observe the real alpha RED failure**

```bash
rtk bun --filter web verify:visual-fixtures
```

Expected: FAIL with both Mio and Yuma reported as portrait sources without alpha. If it passes, stop and inspect Task 4 because the real RGB files are not being checked.

- [ ] **Step 2: Inspect both source portraits before editing**

Use `view_image` on both exact source paths at original detail. Record that character appearance/crop is the visual baseline and only the painted gray background may change.

- [ ] **Step 3: Use the built-in image editor for background removal**

Use the `imagegen` skill and `image_gen.imagegen` separately for each source with its exact path and this edit instruction:

```text
Edit this existing 450 x 600 character portrait. Remove only the painted gray background and replace every background pixel with true transparency. Preserve the character exactly: same face, hair, expression, pose, clothing, proportions, crop, edge placement, colors, lighting, and linework. Preserve fine hair and clothing edges without halos. Do not add scenery, shadows, outlines, text, or new body details. Return a 450 x 600 RGBA PNG with transparent pixels outside the character.
```

Copy each accepted tool result to its corresponding checked-in `base.png`. Do not modify or generate any other portrait expression.

- [ ] **Step 4: Verify metadata and inspect transparency over contrast backgrounds**

Run:

```bash
rtk file packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png
rtk stat -f '%N %z bytes' packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png
```

Expected: both are 450 x 600 RGBA PNGs and each remains below 786432 bytes.

Create `/private/tmp/aquila-portrait-checks/`, then use Sharp from the web
workspace to flatten each source once over `#ffffff` and once over `#111827`:

```bash
rtk mkdir -p /private/tmp/aquila-portrait-checks
rtk bun --cwd apps/web --eval "import sharp from 'sharp'; const portraits = [['mio','../../packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png'],['yuma','../../packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png']]; for (const [name,path] of portraits) { await sharp(path).flatten({background:'#ffffff'}).png().toFile('/private/tmp/aquila-portrait-checks/'+name+'-light.png'); await sharp(path).flatten({background:'#111827'}).png().toFile('/private/tmp/aquila-portrait-checks/'+name+'-dark.png'); }"
```

Inspect all four composites with `view_image`. Reject and re-edit any result
with gray background remnants, bright/dark halos, missing hair, changed
clothing, changed crop, or altered character features.

- [ ] **Step 5: Regenerate the content-addressed local preview**

```bash
rtk bun --filter web build:visual-fixtures
```

Then remove only the obsolete manifest and portrait objects listed in this task:

```bash
rtk git rm apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/sha256-9ec642a37a531d9d59fb22470ef95e35493e6b7b9c92b240fd59ff0014fa1b4d/runtime-manifest.json apps/web/public/assets/vn/objects/a930d03b393e3c2c2005018eef18328b2cc1cab5934628f0e6b8237040a2cccb.webp apps/web/public/assets/vn/objects/aa3669c33656995b535653b315f40cb4c7bb52f248eb79f6ce3189ab49e883e7.webp
```

Keep the unchanged background objects
`e7b5e3372ebcb23f63bef4cf2e762679c35e61babc13829ed665eaaa49fdd9f6.webp`
and
`8bfdc7f3c41049680918be340114f37ed433763672369c86c84ef620b1d8aaba.webp`.
Read the replacement manifest, find the `portrait/asakura_mio/base` WebP
path, and replace `MIO_OBJECT` in `reader-visual.spec.ts` with that exact
content-addressed filename.

- [ ] **Step 6: Verify fixture integrity and browser transparency**

```bash
rtk bun --filter web verify:visual-fixtures
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts src/lib/visual-assets/__tests__/visual-fixtures.test.ts
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk git diff --check
```

Expected: verifier and tests PASS. Browser evidence shows scene imagery around both silhouettes, Mio left and Yuma right, no opaque portrait rectangle, and no framework or console errors.

- [ ] **Step 7: Audit the binary/generated diff and commit it alone**

```bash
rtk git status --short
rtk git diff --stat
```

Expected changes: two source PNGs, `current.json`, one removed/one added release manifest, two removed/two added portrait WebPs, and the single Mio E2E route constant. No generated story file, background image, release plan, production pointer, or private source changes.

```bash
rtk git add packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror apps/web/public/assets/vn/objects packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(assets): make visual portraits transparent"
```

---

### Task 6: Run the Combined Acceptance and Regression Gate

**Files:**
- Verify only; corrections return to and amend the owning task commit.

**Interfaces:**
- Consumes: settings/chrome, fixed dialogue geometry, left/right contract, verifier, transparent sources, and regenerated local fixtures.
- Produces: final repository, browser, metadata, and clean-worktree evidence without additional feature scope.

- [ ] **Step 1: Run compiler, fixture, focused web, and story checks**

```bash
rtk bun compile:check
rtk bun --filter web verify:visual-fixtures
rtk bun --filter @aquila/stories test
rtk bun --filter web test src/components/__tests__/ReaderSettingsMenu.test.ts src/components/__tests__/ReaderShell.test.ts src/components/__tests__/NovelReader.test.ts src/components/__tests__/MobileNovelReader.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/lib/visual-assets/__tests__/visual-fixtures.test.ts scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts
```

Expected: no generated drift and all focused suites PASS.

- [ ] **Step 2: Run full repository checks**

```bash
rtk bun run test
rtk bun lint
rtk bun build
rtk git diff --check
```

Expected: all Turbo test workspaces, lint, production build, story chunk assertions, and diff checks PASS. If the browser cannot launch inside the macOS sandbox, rerun only the blocked Playwright command with the required approval; do not weaken the suite.

- [ ] **Step 3: Run the complete reader browser matrix**

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts tests/reader-mobile.spec.ts tests/bookmarks.spec.ts
```

Expected: Chromium, mobile Chrome, and mobile Safari projects pass their configured reader specs. Verify Settings-to-Visual/Text focus handoff, mobile single-menu ownership, prompt focus, History/backlog focus restoration, fixed heights, portrait gap, transparency, Home, and bookmark flows.

- [ ] **Step 4: Perform the rendered acceptance pass**

Use the browser verification skill against the local web server and record desktop `1280 x 800`, mobile portrait `390 x 844`, and compact landscape `844 x 390` evidence. At each layout confirm:

```text
Settings/menu ownership is singular.
Visual can return to Text without URL-line movement.
History sits at the dialogue box top-right.
Dialogue height does not change from typing start through completion.
Long text/choices scroll inside the body.
Portrait and dialogue retain at least 12 CSS pixels of separation.
Mio is left; Yuma is right; neither has an opaque background rectangle.
No blank page, framework overlay, console error, or unexpected network error appears.
```

- [ ] **Step 5: Confirm final scope and clean state**

```bash
rtk rg -n "defaultSlot.*center|slot.*center|Portrait Slot.*center|data-portrait-slot='center'" packages/stories apps/web/src
rtk git status --short
rtk git log --oneline -5
```

Expected: no portrait-center contract matches; worktree is clean; the latest
five implementation commits are settings, layout, portrait contract, asset
tooling, and transparent assets, with the approved design revision immediately
before them. If verification required a correction, amend the owning commit and
rerun the failed focused and final gates before reporting completion.
