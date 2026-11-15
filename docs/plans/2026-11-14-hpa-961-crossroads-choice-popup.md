# HPA-961 — Crossroads choice pop-up

**Status:** Proposed design specification and implementation plan. This draft PR is the **single PR for HPA-961**: implement and validate on this same branch after design review; do not open a separate implementation PR.

- Linear: https://linear.app/cwchanap/issue/HPA-961/show-branch-choices-in-a-crossroads-pop-up-instead-of-the-dialogue-box
- Related reader-friction report: https://linear.app/cwchanap/issue/HPA-821/reader-friction-main-menu-settings-does-nothing-first-choice-is-hidden
- Source of visual truth: the Linear ticket's attached `branch-choice-popup.html`, **Option B: Crossroads**. Its screenshots cover one, two, three, and four routes, desktop and phone, text/visual modes, Japanese furigana, and a second-language line.
- Baseline reviewed: `main` at `d0c4f480cdcd757a7db21f130736ad507c3d7c42` (2026-11-14). Re-check the touched seams when implementation begins.

## Goal, scope, and constraints

A decision deserves an intentional pause. At the final dialogue line of a scene with a choice, show **Choose** rather than inline prompts/options. Advancing then opens one shared full-screen **Crossroads** overlay. The reader chooses a route or returns to that final line.

Applies uniformly to visual, desktop text, and phone readers, including the Platform's 30 decisions and the five short stories' decisions. The same generated choice data and existing navigation logic remain authoritative.

**In scope:** one shared modal, small changes to the three reader leaf components and their common advance decision, en/zh/ja reader strings, tests, and E2E fixture updates. Reuse existing SVG/CSS route styling and `lucide-svelte` icons; **no new art or SFX tasks** are necessary.

**Out of scope:** compiler/choice-file edits, per-story styling, animated/timed choices, extra modal framework or global store, URL schema changes, Story Map redesign, the other HPA-821 reader issues, and any backend/database changes. No compatibility layer for the old inline choice UI.

## Current architecture and minimal change

| Current seam | Confirmed behavior on main | Intended change |
| --- | --- | --- |
| `apps/web/src/lib/reader-interaction.ts` | `getReaderAdvanceDecision` returns `none` at the final line of a choice | Return `open-choice` **only** after typing finishes at a nonempty scene's last line |
| `apps/web/src/components/NovelReader.svelte` | Hides Continue if `choice`; renders the choice block below the dialogue | Keep a visible final-line Choose button; delete inline block |
| `apps/web/src/components/VisualNovelReader.svelte` | `showChoices` replaces the footer action with choice buttons in the dialogue box | Keep the dialogue/footer and show Choose; delete inline block |
| `apps/web/src/components/MobileNovelReader.svelte` | `showChoices` replaces the last-line text panel; normal reading advances by tap | Retain the final line, expose Choose, preserve tap-to-advance and delete inline block |
| `apps/web/src/components/ReaderShell.svelte` | Bridges `readerState` to all three readers, owns ending and Story Map overlays, passes `onChoice` | Own an ephemeral `crossroadsOpen` flag; expose `onOpenChoice` to leaves and render one `CrossroadsDialog` outside the inert reader |
| `apps/web/src/lib/reader-state.svelte.ts` and `reader-manager.ts` | Own active choice/flow and canonical URL, progress, and navigation | **No change**; do not serialize modal visibility |
| `apps/web/src/lib/reader-second-language.ts` and `RubyText.svelte` | Supply bilingual prompt/labels and ruby | Reuse as-is, including `secondChoice.labels[option.id]` and ruby fields |
| `StoryMapSheet.svelte` / `focus-trap.ts` | Established overlay focus and decorative dashed-path conventions | Reuse visual/focus patterns, **not** the Story Map's graph builder |
| `packages/stories/src/translations/{en,zh,ja}.json` | Reader strings and existing `reader.storyMap.decision` | Add only Choose, Back to last line, Route, and key-hint strings |

### Advance contract

| Reader state | Advance gesture | Result |
| --- | --- | --- |
| Typewriter running | Existing Next/Enter/Space/tap | Reveal/skip typing as now; **no modal yet** |
| Before final line | Existing advance gesture | Advance one line as now |
| Final line, choice present and typing done | Choose/Enter/Space/tap | Return `open-choice`; shell opens Crossroads; **no navigation or persistence write** |
| Final line, no choice, linked next scene | Existing advance gesture | Advance scene as now |
| Final line, no choice, ending | Existing advance gesture | Complete as now |

Implement `ReaderAdvanceDecision = 'skip' | 'advance-line' | 'open-choice' | 'advance-scene' | 'complete' | 'none'`. Evaluate `open-choice` after `skip`/`advance-line` and before non-choice navigation; never open for empty dialogue. The leaf handles `open-choice` by calling the shell's `onOpenChoice` callback. Do not route it through `onNext`, which currently controls ending behavior.

## Crossroads visual specification (chosen Option B)

- Darken the **current** scene; do not change it, navigate, or restart its voice. Display a small fork icon, localized `Decision · Act N` eyebrow, and the existing localized choice prompt in the reader's serif style.
- Render each option as a route card: localized `Route A/B/C/D`, existing option label, and italic secondary-language label when enabled. Use `RubyText` for the prompt and option labels so Japanese furigana and the second-language ruby remain available. Preserve the main/secondary `lang` attributes.
- Routes use purely decorative dashed lines consistent with the existing Story Map styling. **One** option ends a straight line; **two to four** fan into one card row on desktop. On a phone the options stack off a vertical trunk and numerical key hints are hidden. Card/button hit targets are at least 44px.
- Put **Back to the last line** at the bottom. Keep the content within the viewport with scrollable modal content where needed (long labels, bilingual text, iOS safe areas); do not put option buttons inside the old dialogue scroll box.
- CSS/SVG is sufficient for the connectors; no algorithmic graph layout, image assets, new fonts, or dependencies. Reference the ticket's Option B examples rather than inventing a new palette.

## Interaction, focus, and lifecycle

1. The last line appears and its voice plays exactly as before. The pop-up **never auto-opens** when the line finishes, when navigating to it, or when restoring a saved/deep-linked position.
2. Choose (button), Enter/Space when not on another interactive control, or the reading-area tap opens Crossroads **after** typing is complete. On phones, retain normal tap behavior outside the decision state; a visible Choose CTA makes the decision discoverable.
3. Render `role="dialog"` with `aria-modal="true"`, a name from the prompt/eyebrow, and `focusTrap`. Initial focus is on the prompt heading with `tabindex="-1"`, **not** on any option. A repeated Enter immediately after opening cannot choose a route. Tab reaches option buttons; Tab+Enter activates the focused button. No global keyboard handler should fire through the inert reader.
4. With the pop-up open, number keys `1`–`4` select the corresponding visible option (ignore out-of-range keys and modified shortcuts). An option click/tap selects exactly once. Back, Escape, or a backdrop click closes without navigating; clicks inside the modal do not close it.
5. On selection, close the overlay and call the existing `onChoice(option.nextScene)` exactly once. **Do not** reimplement `goToScene`, URL writes, bookmark handling, Story Map progress, or audio scene transitions in the modal.
6. On close, restore focus to the mode's Choose trigger where possible, after removing the inert state; if the original trigger is gone, use a stable reader fallback. Reopening by Choose works. History, Settings, Acts, and Story Map remain available after close.
7. Modal visibility is shell-local, not persisted. Closing on story/scene replacement, load/error, or browser history navigation prevents a stale choice from another scene. A reopened/saved final line always starts with Crossroads closed.
8. Do not stack Crossroads with Settings, Story Map, ending overlay, or a leaf-local drawer. Reuse shell gating (`leafDisabled`/inert) instead of introducing a new overlay coordinator. Do not interrupt voice just because Crossroads opens.

### State ownership

`ReaderShell` derives the choice, scene, locale, second-choice labels, and reading settings from its existing state bridge. It owns the **only** `crossroadsOpen` state and passes the three readers `onOpenChoice: () => void`; leaves never import `readerState` or render Crossroads themselves.

A new `CrossroadsDialog.svelte` is controlled/presentational: choice/prompt, existing translated secondary labels, locale/language/ruby settings, localized strings and act caption, plus `onSelect(nextScene)` / `onClose()` and focus return. It does not fetch assets, read storage, or mutate the flow.

Keep the URL/index and storage untouched on open/cancel. The existing choice callback remains the only path that persists a selected branch. Do not add a save-schema migration.

## Implementation plan — one branch, one PR

### 1. Core advancement and testable behavior
- Extend `ReaderAdvanceDecision` with `open-choice`; adapt `getReaderAdvanceDecision` and its Vitest matrix for typing, final/nonfinal positions, 0 lines, choice and non-choice endings.
- Define a narrow `onOpenChoice` prop on the three reader leaves, retaining existing `onChoice` routing solely for the chosen route.
- Add tests ensuring the new decision never invokes `onNext` or picks a route on its own.

### 2. Shared Crossroads dialog
- Create `apps/web/src/components/CrossroadsDialog.svelte` with native buttons, `RubyText`, focus trap, fork icon, decorative path lines, accessible title, Back/backdrop/Escape, and digit shortcuts.
- Handle 1/2/3/4 options with simple CSS layout rules; responsive stacking and safe-area/overflow behavior without a graph/layout abstraction.
- Add `reader.choose` and a small `reader.crossroads` group for back/route/key-hint strings in en/zh/ja. Reuse `reader.storyMap.decision` and existing act-label helpers.
- Add focused component tests for labels/ruby, keyboard focus and shortcuts, backdrop/Escape, and single-selection behavior.

### 3. Shell wiring and all three reader modes
- Add shell-owned open/close/select callbacks and one dialog instance outside the reader-ready subtree; include `crossroadsOpen` in `leafDisabled` and focus restoration.
- Text: replace the inline prompt/options block with a final-line Choose action; keep normal Continue/Next Scene/Complete semantics elsewhere.
- Visual: remove `showChoices` as the footer suppression condition; show Choose at the final line instead of inline choices; preserve typewriter, scroll, tap, voice and background.
- Phone: remove choice-panel replacement so the last line stays visible; add a clear Choose control and route the ordinary tap gesture to the shared open action at a completed choice line. Keep settings/history/drawer interactions isolated.
- Guard against stale overlays after mode/story/scene/navigation changes, without adding persistent modal state.

### 4. Existing regressions and E2E tests
- Update `apps/web/src/lib/__tests__/reader-interaction.test.ts`, affected reader component tests, and `ReaderShell.test.ts` (including translation mocks).
- Add `packages/e2e/tests/reader-crossroads.spec.ts`. Amend `packages/e2e/playwright.config.ts` so the new file is matched by its mobile projects as well as desktop Chromium.
- Update E2E callers that currently click a choice immediately, particularly `packages/e2e/tests/reader-visual.spec.ts` and `story-map.spec.ts`: first invoke **Choose**, then select the option in the dialog. Keep story-map jump and progress assertions.
- Use compact actual story fixtures: `choice_act3` (2), `choice_b1b_act8` (3), `choice_b1a_b2a_act8` (1), and `choice_b1a_b2b_b3b_b4b_b5a_act70` (4), plus a short story. Avoid modifying story content to create tests.

### 5. Validation and finish in this PR
- Run `bun --filter web test`, `bun --filter web test:coverage`, `bun --filter web lint`, and `bun --filter web build`.
- Run `bun --filter e2e test:e2e tests/reader-crossroads.spec.ts tests/reader-visual.spec.ts tests/story-map.spec.ts` (and other impacted reader suites).
- Verify responsive screenshots against the **attached Linear Option B mock-up**; use screenshot-based comparisons/checks, not an untracked approval task.
- Include a visual regression for choice count, text mode and phone bilingual/furigana content. Keep changes on this same draft PR; mark ready only when code and automated evidence satisfy the criteria.

## End-to-end acceptance criteria

- [ ] **macOS desktop** (Chrome/Safari) and **Windows desktop** (Chrome/Edge): in text and visual modes, a choice scene's last line remains readable with Choose; its prompt/options are **not** inline, and Crossroads opens only on an explicit advance gesture.
- [ ] **iOS Safari** (device/simulator): in phone text and visual modes, a tap or Choose opens the same overlay, route cards stack correctly, the last line is restored by Back, and safe-area/scrolling does not obscure any option.
- [ ] In these supported platform flows, each 1/2/3/4-option scenario renders the expected number of cards; click/tap, digit shortcuts (where a physical keyboard is available), Tab+Enter and Escape/Back work; an Enter immediately after opening never silently selects the first option.
- [ ] Switching between en, zh, ja and enabling a second-language line/furigana shows the correct localized prompt and labels without clipping, including the ticket's three-option Japanese text-mode example.
- [ ] Selecting an option navigates to its correct act **once**, keeps the existing URL and progress/bookmark behavior, and reveals the chosen path in the Story Map; cancelling and reloading/deep-linking to the last line never auto-selects or reopens Crossroads.
- [ ] Automated visual screenshots are checked against **Option B in HPA-961's HTML mock-up** for two-option desktop visual, four-option desktop, one-option desktop, and three-option Japanese/bilingual phone/text cases: backdrop, eyebrow, path geometry, card arrangement, and readable labels match the chosen design.
- [ ] Automated Vitest/component/Playwright suites and existing coverage gate pass in CI. Other CI platforms can run their existing checks; no separate Android/Linux acceptance gate is required.

## Implementation risks to cover (not extra subsystems)

- **Keyboard reentrancy:** all three reader leaves install window key handlers; the shell must disable them while Crossroads is open and focus the non-button heading first.
- **Phone last-line behavior:** the current phone choice panel replaces the dialogue text; the new flow must preserve that final sentence and voice, not merely move the option buttons.
- **Focus and stacking:** mount the modal outside `reader-ready` before setting inert. Restore focus *after* closing/inert removal, and avoid simultaneous overlays.
- **E2E project selection:** the current mobile Playwright `testMatch` excludes a newly named Crossroads spec unless updated.
- **Visual mock-up drift:** the Linear resource specifies **Option B**; avoid mixing in alternative concepts A or C.
