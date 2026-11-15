# HPA-961 — Crossroads choice pop-up

**Status:** Proposed design specification and implementation plan. This draft PR is the **single PR for HPA-961**: implement and validate on this same branch after design review; do not open a separate implementation PR.

- Linear: https://linear.app/cwchanap/issue/HPA-961/show-branch-choices-in-a-crossroads-pop-up-instead-of-the-dialogue-box
- Related reader-friction report: https://linear.app/cwchanap/issue/HPA-821/reader-friction-main-menu-settings-does-nothing-first-choice-is-hidden
- Source of visual truth: the Linear ticket's attached `branch-choice-popup.html`, **Option B: Crossroads**. Its screenshots cover one, two, three, and four routes, desktop and phone, text/visual modes, Japanese furigana, and a second-language line.
- Baseline reviewed: `main` at `d0c4f480cdcd757a7db21f130736ad507c3d7c42` (2026-11-14). Re-check the touched seams when implementation begins.

## Goal, scope, and constraints

A decision deserves an intentional pause. At the final dialogue line of a scene with a choice, show **Choose** rather than inline prompts/options. Advancing then opens one shared full-screen **Crossroads** overlay. The reader chooses a route or returns to that final line.

Applies uniformly to visual, desktop text, and phone readers, including the Platform's 30 decisions and the five short stories' decisions. The same generated choice data and existing navigation logic remain authoritative.

**In scope:** one shared modal, small changes to the three reader leaves and common advance helper, a targeted compiler validation rule for empty choice scenes, en/zh/ja reader strings, shared E2E helpers, regression tests and updated release-gate tests. Reuse existing SVG/CSS route styling and `lucide-svelte` icons; **no new art or SFX tasks** are necessary.

**Out of scope:** compiler output/schema changes or story/choice-file edits (apart from the narrow validator rule), per-story styling, animated/timed choices, an extra modal framework or global store, URL schema changes, Story Map redesign, the other HPA-821 issues, and any backend/database changes. No compatibility layer for the old inline choice UI.

## Current architecture and minimal change

| Current seam | Confirmed behavior on main | Intended change |
| --- | --- | --- |
| `apps/web/src/lib/reader-interaction.ts` | `getReaderAdvanceDecision` returns `none` at a final choice line | Extend with `open-choice`, pure `isChoicePosition` guard, and shared `advanceLabelKey` (Continue / Choose / Next Scene / Complete) |
| `packages/stories/src/compiler/validate.ts` | Checks targets and reachability; empty choice-origin scenes are allowed | Reject a scene whose `next` is a choice and whose `entries` is empty; test with a minimal `StoryIR`, leaving schema/output alone |
| `apps/web/src/components/NovelReader.svelte` | `!choice` hides Continue on **every** line in a scene that ends in a choice; inline choices render below dialogue | Reuse the existing progression button on every finished line, label via helper, remove inline block |
| `apps/web/src/components/VisualNovelReader.svelte` | `showChoices` replaces the footer action with option buttons | Reuse the existing footer progression button with Choose label, remove inline block |
| `apps/web/src/components/MobileNovelReader.svelte` | `showChoices` replaces the last-line text panel; label indicator is a `span` | Keep the text panel, use shared label helper and make the Choose indicator an actual focusable `button`; preserve tap-to-advance |
| `apps/web/src/components/ReaderShell.svelte` | Bridges `readerState` to leaves, owns ending/Story Map overlays and settings trigger | Own one position-keyed overlay state, pass `onOpenChoice`, and gate both `leafDisabled`/inert **and** `ReaderSettingsMenu.triggerUnavailable` |
| `apps/web/src/lib/reader-state.svelte.ts` and `reader-manager.ts` | Own choice/flow and canonical URL, progress, navigation | **No change**; do not serialize modal visibility |
| `apps/web/src/lib/reader-second-language.ts` and `RubyText.svelte` | Supply bilingual prompt/labels and ruby | Reuse as-is, including `secondChoice.labels[option.id]` and ruby fields |
| `StoryMapSheet.svelte` / `focus-trap.ts` | Overlay focus trap, inert race handling and dashed-path conventions | Reuse the existing behavior and styles. For Crossroads **do not pass the ending's settings/menu restoreFocus target**; default to the previously focused element |
| `packages/e2e/tests/utils.ts` | Page objects such as `VisualReaderPage` support existing reader flows | Add one shared `chooseRoute(label)` operation and reuse from relevant page objects/specs |
| `packages/e2e/tests/visual-novel-deployed.spec.ts` | Release-gate config runs it separately from regular PR E2E; it clicks an option directly | Migrate it to the shared Choose → route operation and validate with the release-gate config |
| `packages/stories/src/translations/{en,zh,ja}.json` | Reader strings and existing `reader.storyMap.decision` | Add only Choose, Back to last line, Route, and key-hint strings |

### Advance contract

| Reader state | Advance gesture | Result |
| --- | --- | --- |
| Typewriter running | Existing Next/Enter/Space/tap | Reveal/skip typing as now; **no modal yet** |
| Before final line | Existing advance gesture | Advance one line as now |
| Final line, choice present and typing done | Choose/Enter/Space/tap | Return `open-choice`; shell opens Crossroads; **no navigation or persistence write** |
| Final line, no choice, linked next scene | Existing advance gesture | Advance scene as now |
| Final line, no choice, ending | Existing advance gesture | Complete as now |

Implement `ReaderAdvanceDecision = 'skip' | 'advance-line' | 'open-choice' | 'advance-scene' | 'complete' | 'none'`. Evaluate `open-choice` after `skip`/`advance-line` and before non-choice navigation; its precondition is a nonempty final line with a choice. Add pure `isChoicePosition(index, length, hasChoice)` and unit-test it separately. A choice scene with zero entries is rejected by `validateStory` rather than adding runtime fallback UI. Non-choice empty scenes keep existing behavior.

Add a narrow `advanceLabelKey(decision)` helper mapping `advance-line → continue`, `open-choice → choose`, `advance-scene → nextScene` and `complete → complete`; return no label for `skip`/`none`. The three leaves derive button text from the same decision they execute, using `isTyping: false` for the fully revealed label. Existing progression buttons stay in place (mobile's current text-only indicator becomes a real button for Choose); no separate fourth CTA is needed. The leaf handles `open-choice` by calling the shell's `onOpenChoice` callback, never `onNext` (which controls ending behavior).

## Crossroads visual specification (chosen Option B)

- Darken the **current** scene; do not change it, navigate, or restart its voice. Display a small fork icon, localized `Decision · Act N` eyebrow, and the existing localized choice prompt in the reader's serif style.
- Render each option as a route card: localized `Route A/B/C/D`, existing option label, and italic secondary-language label when enabled. Use `RubyText` for the prompt and option labels so Japanese furigana and the second-language ruby remain available. Preserve the main/secondary `lang` attributes.
- Routes use purely decorative dashed lines consistent with the existing Story Map styling. **One** option ends a straight line; **two to four** fan into one card row on desktop. On a phone the options stack off a vertical trunk and numerical key hints are hidden. Card/button hit targets are at least 44px.
- Put **Back to the last line** at the bottom. Keep the content within the viewport with scrollable modal content where needed (long labels, bilingual text, iOS safe areas); do not put option buttons inside the old dialogue scroll box.
- CSS/SVG is sufficient for the connectors; no algorithmic graph layout, image assets, new fonts, or dependencies. Reference the ticket's Option B examples rather than inventing a new palette.

## Interaction, focus, and lifecycle

1. The last line appears and its voice plays exactly as before. The pop-up **never auto-opens** when the line finishes, when navigating to it, or when restoring a saved/deep-linked position.
2. The **existing progression button**, labeled Choose at the final choice line, opens Crossroads. Enter/Space away from other controls and the reading-area tap retain their existing advance behavior. On phones, the current last-line label becomes an actual focusable Choose button (`pointer-events-auto`), while the tap-to-advance surface still opens the dialog after typing completes.
3. Render `role="dialog"` with `aria-modal="true"`, a name from the prompt/eyebrow, and `focusTrap`. Initial focus is on the prompt heading with `tabindex="-1"`, **not** on any option. A repeated Enter immediately after opening cannot choose a route. Tab reaches option buttons; Tab+Enter activates the focused button. No global keyboard handler should fire through the inert reader.
4. With the pop-up open, number keys `1`–`4` select the corresponding visible option (ignore out-of-range keys and modified shortcuts). An option click/tap selects exactly once. Back, Escape, or a backdrop click closes without navigating; clicks inside the modal do not close it.
5. On selection, close the overlay and call the existing `onChoice(option.nextScene)` exactly once. **Do not** reimplement `goToScene`, URL writes, bookmark handling, Story Map progress, or audio scene transitions in the modal.
6. Use the existing `focusTrap` **without an explicit `restoreFocus` prop**: it restores the previously focused Choose button after inert clears, and naturally preserves `<body>` if opened by an unfocused page-level key/tap. Do not copy the ending overlay's `overlayFocusTarget` (Settings/menu), and do not add a focus fallback coordinator. Reopening by Choose works; History, Settings, Acts, and Story Map remain available after close.
7. Keep one shell-local `crossroadsPositionKey` (`storyId:sceneId:dialogueIndex` at open) and derive `crossroadsOpen` from its presence plus `!isBlocking`. One `$effect.pre` clears the key if the current position changes or `isChoicePosition` becomes false. This covers story/scene switches, back/forward and line changes without per-event close handlers. Reloads/deep links never persist/open Crossroads.
8. Do not stack overlays. Extend **both** shell gates: `leafDisabled`/inert for the three reader leaves, and `ReaderSettingsMenu.triggerUnavailable` for the settings trigger rendered **outside** `reader-ready`. Do not introduce an overlay coordinator or stop voice when Crossroads opens.

### State ownership

`ReaderShell` derives choice, scene, locale, second-choice labels, and settings from its existing bridge. It owns only a nullable `crossroadsPositionKey` and derives the `crossroadsOpen` visible flag; it passes the three readers `onOpenChoice: () => void`. Leaves never import `readerState` or render Crossroads themselves. Opening requires `isChoicePosition`, no blocking load, and no other overlay.

A new `CrossroadsDialog.svelte` is controlled/presentational: choice/prompt, existing translated secondary labels, locale/language/ruby settings, localized strings and act caption, plus `onSelect(nextScene)` / `onClose()`. It reuses `focusTrap`'s default focus restoration; it does not fetch assets, read storage, or mutate the flow.

Keep the URL/index and storage untouched on open/cancel. The existing choice callback remains the only path that persists a selected branch. Do not add a save-schema migration.

## Implementation plan — one branch, one PR

Every step is a commit or compact series of commits **within PR #125**, never a second PR. Each reader conversion includes its own tests; until converted, a reader may continue using its inline choices because an unhandled `open-choice` behaves as a no-op just like today's `none`.

### 1. Shared advance and source validation, with tests
- In `reader-interaction.ts`, add `open-choice`, `isChoicePosition`, and `advanceLabelKey`. Keep their contracts pure and test the full progression/label matrix in `reader-interaction.test.ts` (typing, nonfinal/final, 1–4 choice options, and nonchoice endings).
- In `packages/stories/src/compiler/validate.ts`, reject `scene.next.startsWith('choice:') && scene.entries.length === 0` with a useful source-scene error. Add a test in the existing `validate.test.ts`. No new compiler output or runtime compatibility branch.
- Confirm existing reader suites still pass before converting any leaf.

### 2. Shared dialog, shell gate, and E2E action
- Create `apps/web/src/components/CrossroadsDialog.svelte`: native buttons, `RubyText`, fork icon, decorative dashed lines, prompt-focused `focusTrap` (without `restoreFocus`), Back/backdrop/Escape, numeric shortcuts and one-shot selection. Test 1/2/3/4 cards, bilingual/ruby labels, key behavior and cancellation.
- Add en/zh/ja strings: `reader.choose` plus a small `reader.crossroads` group (back, route and key hint). Reuse `reader.storyMap.decision` and `actLabel`; adapt existing test translation mocks.
- Wire the shell's one nullable position key and guard, `leafDisabled` plus `ReaderSettingsMenu.triggerUnavailable`, and `onOpenChoice` without changing `readerState` or `ReaderManager`. Test no auto-open, no stale modal on navigation, background inertness and keyboard/focus behavior.
- Add a single `chooseRoute(label)` operation in `packages/e2e/tests/utils.ts` that first activates Choose, waits for Crossroads, and then clicks the labeled card. Reuse it from relevant page objects/fixtures rather than hardcoding the transition in several specs.

### 3a. Convert desktop text reader, with tests
- Keep the existing progression control visible on **every** finished line; delete the `!choice` gate (currently incorrectly hiding Continue throughout a scene that eventually has a choice) and the inline option block.
- Wire `onOpenChoice`, derive the button label via `advanceLabelKey`, and add component tests and a focused text-reader E2E asserting Choose → modal → branch and Back → unchanged final line.

### 3b. Convert visual reader, with tests
- Delete `showChoices` rendering and the matching footer suppression, retain the existing footer progression button with derived Choose/Continue/Next Scene/Complete label.
- Update visual-reader component/E2E call sites; replace the mobile-portrait test's assumption that long choice text occupies the dialogue box with an assertion that Crossroads content stays readable and fits/scrolls without obscuring History or options.
- Update `packages/e2e/tests/visual-novel-deployed.spec.ts` (separately run release gate) to use `chooseRoute`. The deployed test is **not run in ordinary PR Playwright CI**, so explicitly validate its updated flow under the release-gate config when a deployed release candidate is available.

### 3c. Convert mobile text reader, with tests
- Retain the last dialogue line rather than replacing its panel with choice buttons. Turn the final-line Choose indicator into a real `button` with `pointer-events-auto` and the shared label helper; keep existing tap-to-advance, chrome dismissal, and overlay behavior.
- Remove inline choices and add phone component/E2E tests for visible last line, taps, Back/reopen, scrollability and Japanese furigana/second-language labels.

### 4. Integrated E2E and visual evidence
- Add `packages/e2e/tests/reader-crossroads.spec.ts`, and extend `packages/e2e/playwright.config.ts` mobile `testMatch` regex so this spec runs on Chromium, Pixel 5 and iPhone 12/WebKit emulation. Keep existing `story-map.spec.ts` and `reader-visual.spec.ts` using `chooseRoute`, including all direct option clicks.
- Assert exact card counts, click/keyboard paths, route/persistence/Story Map correctness, and visibility within viewport with `boundingBox` plus no horizontal overflow. Test 1/2/3/4 cards, locale, ruby and secondary-language variations using the ticket's choice fixtures.
- **Visual check against the attached Linear Option B mock-up:** capture automated screenshots for its 2-option desktop, 4-option desktop, 1-option desktop, and 3-option Japanese bilingual phone/text scenarios. Compare the layout via objective geometry/overflow/card-visibility assertions, and attach representative screenshots alongside the selected mock-up to the PR as visual evidence. Do **not** introduce pixel-diff golden baselines against an HTML mock-up or require a manual approval gate.
- Platform-targeted E2E acceptance covers iOS Safari, macOS and Windows; leverage existing Playwright flows and focused platform smoke runs rather than a new sprawling OS/browser matrix. A simulator/emulator alone does not prove physical iOS safe-area insets, so include one automated real-device/simulator safe-area check using a supported iOS runner/device when available; record any unavailable run as **not verified**, never as passed.

### 5. Validation and finish within this PR
- Run `bun --filter @aquila/stories test` (including compiler validation), `bun --filter web test`, `bun --filter web test:coverage`, `bun --filter web lint` and `bun --filter web build`.
- Run `bun --filter e2e test:e2e tests/reader-crossroads.spec.ts tests/reader-visual.spec.ts tests/story-map.spec.ts` and affected reader suites. The separate deployed-only release gate is run using its existing configuration against a valid release candidate.
- Verify generated coverage reports and Codecov upload **without inventing a numeric coverage threshold**; current Vitest config has no threshold gate.
- Keep implementation, automated checks, and review fixes on this same draft PR; mark ready only after supported automated evidence satisfies the criteria.

## End-to-end acceptance criteria

- [ ] **macOS (Chrome/Safari) and Windows (Chrome/Edge)**: automated desktop browser E2E confirms the final choice line remains readable, its footer/button says Choose (not inline options), and Choose/Enter/Space opens Crossroads only on explicit advancement. Where OS-specific test execution is not available, report it as unverified rather than treating Linux CI as equivalent.
- [ ] **iOS Safari**: automated device/simulator phone E2E confirms the last line is retained in text/visual modes, Choose or tap opens Crossroads, card scrolling/stacking and safe-area insets keep options reachable, and Back restores the line. Include one actual iOS safe-area smoke check if the existing runner provides it.
- [ ] Supported-platform E2E covers 1/2/3/4 visible cards, button/touch and keyboard selection, Tab+Enter/Escape/Back, and pressing Enter immediately after modal open never selecting a route. The settings trigger and reader subtree stay unavailable while the dialog is open.
- [ ] en/zh/ja, ruby and secondary-language options show complete labels without clipping, including the ticket's 3-option Japanese bilingual phone/text scenario.
- [ ] Selecting a route navigates once to the correct act with existing URL, progress and Story Map updates; cancel/reload/deep-link/Back/forward never auto-open or retain stale Crossroads state. An empty dialogue scene leading to a choice fails source validation.
- [ ] **Automated visual check vs the attached Linear Option B mock-up:** the E2E captures reference-scenario screenshots and verifies card count, responsive arrangement, viewport bounds and overflow; screenshots are available in the PR as visual evidence. No pixel-diff baselines or human signoff are required.
- [ ] Component/unit/Playwright and separately configured deployed release-gate checks pass when run against an available deployed release candidate; coverage reports are generated/uploaded to Codecov. CI has no pre-existing numeric coverage threshold; no additional Android/Linux acceptance steps.

## Implementation risks to cover (not extra subsystems)

- **Keyboard reentrancy:** all three reader leaves install window key handlers; the shell must disable them while Crossroads is open and focus the non-button heading first.
- **Phone last-line behavior:** the current phone choice panel replaces the dialogue text; the new flow must preserve that final sentence and voice, not merely move the option buttons.
- **Focus and stacking:** mount the modal outside `reader-ready` before setting inert, do not pass the ending's settings/menu restore target, and verify the existing focus-trap inert-race handling restores the prior focused Choose button. Explicitly disable the separately rendered settings trigger.
- **E2E project selection:** the current mobile Playwright `testMatch` excludes a newly named Crossroads spec unless updated.
- **Visual mock-up drift:** the Linear resource specifies **Option B**; avoid mixing in A/C. Use measurable responsive geometry and captured screenshot evidence, not brittle pixel diffs against a standalone HTML mock-up.
- **Release-gate isolation:** ordinary PR Playwright excludes `visual-novel-deployed.spec.ts`, so the `chooseRoute` conversion needs the separate release-gate config when a candidate deployment exists.
- **Choice source validity:** reject empty choice-origin dialogue in the existing compiler validator rather than adding a silent runtime fallback.
