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
| `apps/web/src/components/MobileNovelReader.svelte` | `showChoices` replaces the last-line text panel; non-final lines show the `▼` cue, while `chromeVisible` can swallow the first advance tap | Keep the `▼` cue on non-final lines, make terminal Choose a real `button` that acts in one tap even with mobile chrome visible, and preserve ordinary reading-area tap behavior |
| `apps/web/src/components/ReaderShell.svelte` | Bridges `readerState` to leaves; the wrapper currently mixes `inert={endingOpen}` with an effect setting inert from `leafDisabled` | Own one position-keyed overlay state, pass `onOpenChoice`, and use **the same** `leafDisabled` for the declarative `inert` binding, inert synchronization, and `ReaderSettingsMenu.triggerUnavailable` gate |
| `apps/web/src/lib/reader-state.svelte.ts` and `reader-manager.ts` | Own choice/flow and canonical URL, progress, navigation | **No change**; do not serialize modal visibility |
| `apps/web/src/lib/reader-second-language.ts` and `RubyText.svelte` | Supply bilingual prompt/labels and ruby | Reuse as-is, including `secondChoice.labels[option.id]` and ruby fields |
| `StoryMapSheet.svelte` / `focus-trap.ts` | Existing `focusTrap` action and a Story Map `<svelte:window onkeydowncapture>` handler | Reuse those behaviors, not a new modal framework. Focus the prompt, use capture-phase Escape/digit shortcuts, and **do not pass** the ending's settings/menu `restoreFocus` target |
| `packages/e2e/tests/utils.ts` | Page objects such as `VisualReaderPage` support existing reader flows | Add one shared `chooseRoute(label)` operation; update the existing multi-mode `story-map.spec.ts` assertions and release-gate caller **in the coordinated reader cutover** |
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

Add a narrow `advanceLabelKey(decision)` helper mapping `advance-line → continue`, `open-choice → choose`, `advance-scene → nextScene` and `complete → complete`; return no label for `skip`/`none`. Desktop text/visual readers derive the existing progression-button label from that decision, using `isTyping: false` for fully revealed text. **Mobile keeps the existing bouncing `▼` on non-final lines** (no Continue label replacement); only terminal decisions render a real button, labeled via `advanceLabelKey`. For the explicit mobile Choose button, bypass the *chrome-dismiss-only* early return: close `chromeVisible`, respect `hasOverlay` and `interactionDisabled`, then execute `open-choice` once. The normal reading-area tap still dismisses open chrome first. Leaves call shell `onOpenChoice`, never `onNext` (which controls endings).

## Crossroads visual specification (chosen Option B)

- Darken the **current** scene; do not change it, navigate, or restart its voice. Display a small fork icon, localized `Decision · Act N` eyebrow, and the existing localized choice prompt in the reader's serif style.
- Render each option as a route card: localized `Route A/B/C/D`, existing option label, and italic secondary-language label when enabled. Use `RubyText` for the prompt and option labels so Japanese furigana and the second-language ruby remain available. Preserve the main/secondary `lang` attributes.
- Routes use purely decorative dashed lines consistent with the existing Story Map styling. **One** option ends a straight line; **two to four** fan into one card row on desktop. On a phone the options stack off a vertical trunk and numerical key hints are hidden. Card/button hit targets are at least 44px.
- Put **Back to the last line** at the bottom. Keep the content within the viewport with scrollable modal content where needed (long labels, bilingual text, iOS safe areas); do not put option buttons inside the old dialogue scroll box.
- CSS/SVG is sufficient for the connectors; no algorithmic graph layout, image assets, new fonts, or dependencies. Reference the ticket's Option B examples rather than inventing a new palette.

## Interaction, focus, and lifecycle

1. The last line appears and its voice plays exactly as before. The pop-up **never auto-opens** when the line finishes, when navigating to it, or when restoring a saved/deep-linked position.
2. The **existing desktop progression button**, labeled Choose at the final choice line, opens Crossroads. Enter/Space away from other controls and the reading-area tap retain their existing behavior. On phones, preserve the `▼` cue before the final line and render a focusable terminal Choose button (`pointer-events-auto`) that opens Crossroads **on the first tap even when `chromeVisible` is true**; ordinary reading-area taps may still dismiss the chrome first. Prevent button clicks from also advancing the reading-area layer.
3. Render `role="dialog"` with `aria-modal="true"`, a name from the prompt/eyebrow, and `focusTrap`. Initial focus is on the prompt heading with `tabindex="-1"`, **not** on any option. A repeated Enter immediately after opening cannot choose a route. Tab reaches option buttons; Tab+Enter activates the focused button. No global keyboard handler should fire through the inert reader.
4. With the pop-up open, handle **Escape and plain digits `1`–`4` in a `<svelte:window onkeydowncapture>` handler**, before other reader/ActPanel window listeners; `preventDefault()` and `stopPropagation()` for handled keys. Ignore modifiers, composition, repeated keys, editable controls, and out-of-range option numbers. Keep Tab cycling in the existing `focusTrap` action and do **not** intercept Enter: focus starts on the non-button heading, so repeated Enter cannot select a route. An option click/tap selects once. Back, Escape or backdrop click closes without navigating; clicks inside the modal do not close it.
5. On selection, close the overlay and call the existing `onChoice(option.nextScene)` exactly once. **Do not** reimplement `goToScene`, URL writes, bookmark handling, Story Map progress, or audio scene transitions in the modal.
6. Use the existing `focusTrap` **without an explicit `restoreFocus` prop**: it restores the previously focused Choose button after inert clears, and naturally preserves `<body>` if opened by an unfocused page-level key/tap. Do not copy the ending overlay's `overlayFocusTarget` (Settings/menu), and do not add a focus fallback coordinator. Reopening by Choose works; History, Settings, Acts, and Story Map remain available after close.
7. Keep one shell-local `crossroadsPositionKey` (story ID, scene ID, dialogue index, **locale and reader mode** when opened) and derive `crossroadsOpen` from matching current identity, `isChoicePosition`, and `!isBlocking`. One `$effect.pre` clears the key when those values change. This covers story/scene/line changes, history navigation, and mode/locale changes without per-event close handlers; reloads/deep links never persist/open Crossroads.
8. Do not stack overlays. Extend **both** shell gates: `leafDisabled`/inert for the three reader leaves, and `ReaderSettingsMenu.triggerUnavailable` for the settings trigger rendered **outside** `reader-ready`. Replace the wrapper's conflicting `inert={endingOpen}` binding with `inert={leafDisabled}` (consistent with the existing inert synchronization effect). Do not fold Crossroads into unrelated chrome-blocking logic or introduce an overlay coordinator; do not stop voice when the dialog opens.

### State ownership

`ReaderShell` derives choice, scene, locale, second-choice labels, and settings from its existing bridge. It owns only a nullable `crossroadsPositionKey` and derives the `crossroadsOpen` visible flag; it passes the three readers `onOpenChoice: () => void`. **Remove now-unused `onChoice` and `secondChoice` props from all three leaves**, as well as stale visual-reader `.choices`/`.second-choice-label` CSS; only the new dialog receives the translated choice data and existing `onChoice` handler. Leaves keep their `choice` prop solely to identify the final choice line. Opening requires `isChoicePosition`, no blocking load, and no other overlay.

A new `CrossroadsDialog.svelte` is controlled/presentational: choice/prompt, existing translated secondary labels, locale/language/ruby settings, localized strings and act caption, plus `onSelect(nextScene)` / `onClose()`. It reuses `focusTrap`'s default focus restoration; it does not fetch assets, read storage, or mutate the flow.

Keep the URL/index and storage untouched on open/cancel. The existing choice callback remains the only path that persists a selected branch. Do not add a save-schema migration.

## Implementation plan — one branch, one PR

Use **one implementation cutover** for the shell plus all three readers, including existing unit and E2E assertions. Separate preparatory commits are fine, but don't claim the full browser suite is green while only one reader has been converted; all changes stay in **PR #125**. Avoid introducing a compatibility layer just to make intermediate commits pass.

### 1. Shared advance contract, compiler invariant and translations
- In `reader-interaction.ts`, add `open-choice`, `isChoicePosition` and `advanceLabelKey`. Unit-test typing, final/non-final positions, no-dialogue scenes, normal endings, labels, and option counts. Existing readers can still render inline choices until the coordinated cutover.
- In `packages/stories/src/compiler/validate.ts`, reject `scene.next.startsWith('choice:') && scene.entries.length === 0` with a useful error. Add a regression in `validate.test.ts`. No new compiler output, schema or story-file migration.
- Add `reader.choose` and the small en/zh/ja Crossroads strings (Back, Route, key hint) to the existing translation JSON files; reuse `reader.storyMap.decision` and `actLabel`.

### 2. Shared Crossroads dialog, with component tests
- Create `apps/web/src/components/CrossroadsDialog.svelte` with native buttons, `RubyText` and `secondChoice`, responsive dashed routes, a fork icon, and a scrollable viewport-bounded dialog. Use the existing `focusTrap` action with heading initial focus **and no explicit `restoreFocus`**.
- Use `<svelte:window onkeydowncapture>` for Escape and plain digit shortcuts 1–4; call `preventDefault` and `stopPropagation` on handled keys, ignore modifiers/repeats/composing/editable targets/out-of-range keys. Keep Tab trapping with the existing action and don't trap Enter.
- Component-test 1/2/3/4 cards, bilingual text and furigana, keyboard focus/shortcuts, cancellation and single-selection behavior. Keep the dialog presentational and independent of `ReaderManager`.

### 3. Coordinated shell + all reader cutover, with existing tests updated together
- In `ReaderShell.svelte`, own one position key and one `$effect.pre` stale-state guard, add `onOpenChoice`, and render a single `CrossroadsDialog` outside the inert reader. Gate `leafDisabled` and `ReaderSettingsMenu.triggerUnavailable` and make the wrapper's declarative `inert={leafDisabled}` agree with its existing synchronization effect. Keep `readerState`, `ReaderManager`, URL and persistence unchanged.
- Convert **all three reader leaves in the same tested change**:
  - `NovelReader.svelte`: retain a visible existing progression button on **every** finished line (fix `!choice` hiding it early), derive its label, delete inline choice rendering.
  - `VisualNovelReader.svelte`: retain the existing footer progression button, derive Choose/other labels, delete `showChoices` footer suppression and inline block.
  - `MobileNovelReader.svelte`: preserve non-final `▼`, keep the final sentence visible, render a real terminal Choose button, close `chromeVisible` and execute the explicit-button action in **one tap** (while preserving reading-area tap-to-dismiss and other overlay guards).
  - Remove unused leaf `onChoice`/`secondChoice` props and unused visual CSS; move bilingual-choice and ruby assertions from leaf tests into `CrossroadsDialog.test.ts`.
- Update **the existing test callers in this same cutover**, not afterward: `ReaderShell.test.ts` BGM/translated-choice assertions, `VisualNovelReader.test.ts` empty-choice fixture, leaf unit suites, `reader-mobile.spec.ts`'s chevron expectation, `reader-visual.spec.ts` (including obsolete inline-choice/History layout assumptions), `story-map.spec.ts`, and separately configured `visual-novel-deployed.spec.ts`.
- Add one reusable `chooseRoute(label)` in `packages/e2e/tests/utils.ts` for the mode-appropriate Choose → dialog → labeled-card flow and reuse it in relevant page objects/specs. **Not all choice-related expectations are clicks:** in `story-map.spec.ts` replace last-line deep-link checks at ~420/~518 with a visible Choose assertion. After a Story Map decision jump (~228–248), assert focus restored to the Settings/menu trigger and Choose visible **before** opening Crossroads, then check prompt/options inside the dialog.
- The release-gate spec is intentionally excluded from normal PR Playwright CI. Update it during this cutover and verify it using its existing deployed-only config when a release candidate is available; never claim ordinary CI covered it.

### 4. New Crossroads E2E and visual evidence
- Add `packages/e2e/tests/reader-crossroads.spec.ts` and extend `playwright.config.ts`'s mobile `testMatch` so it runs under current CI projects `chromium`, `mobile-chrome` and `mobile-safari`; no new OS/device farm or screenshot-baseline infrastructure.
- Assert last-line Choose, no auto-open after reload/deep-link, initial heading focus (Enter must not select), Escape/backdrop focus restore, reopening, keyboard 1–4, tap selection, route/progress/Story Map updates, and the 3-option Japanese bilingual + furigana phone case **after leaving mobile chrome open**.
- Check card count, stacking, 44px hit areas, viewport bounds, scrolling/no horizontal overflow and a safe-area CSS inset rule (`env(safe-area-inset-bottom)`). Use Playwright geometry assertions and capture representative screenshots for the selected **Linear Option B** mock-up: one-, two-, three- and four-route layouts. Link screenshots as automated PR evidence, not human signoff or brittle pixel-diff baselines.
- Keep **platform-targeted acceptance** for iOS Safari, macOS and Windows below. Current CI's Chromium/WebKit mobile emulation gives engine/layout regression coverage **but is not itself native iOS/macOS/Windows execution**. Do not add a physical-device/simulator prerequisite the repo cannot run or claim one has executed; record OS-specific automated results as pending until such an environment is available.

### 5. Validate and finish on this PR
- Run `bun --filter @aquila/stories test`, `bun --filter web test`, `bun --filter web test:coverage`, `bun --filter web lint` and `bun --filter web build`.
- Run `bun --filter e2e test:e2e tests/reader-crossroads.spec.ts tests/reader-visual.spec.ts tests/story-map.spec.ts tests/reader-mobile.spec.ts` and other affected reader suites. Check the separate release-gate config against a valid deployed release candidate if one is available.
- Require the **existing runnable CI** matrix, automated browser functional/geometry checks and coverage-report generation to pass before marking ready. Do not invent a numerical coverage gate or block a documentation/implementation PR on an unprovisioned Windows/macOS/iOS lab. Keep explicit platform-specific acceptance runs marked **not yet verified** until executed, with no false pass claims.
- All implementation, tests and review corrections remain in **one PR**, #125.

## End-to-end acceptance criteria

- [ ] **macOS desktop — Chrome/Safari:** when an automated macOS browser runner is available, the end-to-end reader flow keeps the last choice line visible, opens Crossroads explicitly in text and visual modes, supports Enter/Space/Tab, chooses the correct branch, and restores focus on cancel. Report actual run evidence or mark **not verified**; Linux CI is not a substitute.
- [ ] **Windows desktop — Chrome/Edge:** when an automated Windows browser runner is available, the same end-to-end choice, keyboard, branch-navigation and progress-restoration flow passes in both desktop modes. Report actual run evidence or mark **not verified**.
- [ ] **iOS Safari:** when iOS device/simulator automation is available, the end-to-end phone text/visual flows retain the last dialogue line, allow Choose with mobile chrome visible, render stacked scrollable cards within safe-area insets, and return to that line on Back. Report actual run evidence or mark **not verified**; Playwright's `mobile-safari` on Linux is not an actual iOS run.
- [ ] **Runnable CI browser regression gate:** Playwright `chromium`, `mobile-chrome` and `mobile-safari` assert the 1/2/3/4-option variants, no accidental selection on initial Enter, digit keys/Escape/Back, settings/reader inertness, deep-link behavior, and correct URL/Story Map progress. Preserve mobile's `▼` indicator on non-final lines.
- [ ] en/zh/ja, ruby and secondary-language options show complete labels without clipping, including the ticket's 3-option Japanese bilingual phone/text scenario with the mobile chrome open.
- [ ] Selecting a route navigates once to the correct act with existing URL, progress and Story Map updates; cancel/reload/deep-link/history never auto-open or retain a stale modal. A zero-dialogue scene leading to a choice fails compiler validation.
- [ ] **Automated visual check vs the attached Linear Option B mock-up:** E2E captures representative scenario screenshots and verifies card count, geometry, responsive arrangement, viewport bounds, and overflow; screenshots are attached to the PR as automated evidence. No pixel-diff baseline or human approval criterion.
- [ ] Component/unit/Playwright suites pass, the separately configured deployed release gate is validated when a release candidate is available, and coverage reports are generated/uploaded to Codecov. No additional Android/Linux acceptance steps; existing CI covers those development environments.

## Implementation risks to cover (not extra subsystems)

- **Keyboard reentrancy:** the modal's capture-phase Escape/digit handler must run before ActPanel/reader window bubble handlers, ignore modifiers/repeat/composition, and preserve the non-button heading focus so Enter never auto-selects.
- **Phone last-line behavior:** preserve the last sentence and voice and the non-final `▼`. The explicit Choose button must bypass the `chromeVisible` early-return path without breaking reading-area tap-to-dismiss or overlay guards.
- **Focus and stacking:** mount the modal outside `reader-ready` before setting inert, do not pass the ending's settings/menu restore target, and verify the existing focus-trap inert-race handling restores the prior focused Choose button. Explicitly disable the separately rendered settings trigger.
- **Test coordination:** `story-map.spec.ts` runs across all three reader modes and contains **non-click** inline-choice assertions, so update them and the translated-choice/empty-scene unit fixtures in the same cutover as all leaves. The mobile Playwright `testMatch` must also include the new Crossroads spec.
- **Visual mock-up drift:** the Linear resource specifies **Option B**; avoid mixing in A/C. Use measurable responsive geometry and captured screenshot evidence, not brittle pixel diffs against a standalone HTML mock-up.
- **Release-gate isolation:** ordinary PR Playwright excludes `visual-novel-deployed.spec.ts`, so the `chooseRoute` conversion needs the separate release-gate config when a candidate deployment exists.
- **Choice source validity:** reject empty choice-origin dialogue in the existing compiler validator rather than adding a silent runtime fallback.
- **Unused props/styles:** after the cutover, remove `onChoice`/`secondChoice` from the leaves and their stale choice CSS; move bilingual/ruby rendering tests to the dialog.
- **Runnable acceptance:** current CI runs three browser emulations on Ubuntu, not native macOS/Windows/iOS. Preserve platform-specific E2E acceptance and report its execution status accurately without setting up an unnecessary device farm or manual signoff.
