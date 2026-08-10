# Visual Novel Reader Controls and Layout

Date: 2026-08-09  
Status: Revised after review; pending approval

## Goal

Polish Aquila's visual-novel reader so its controls form one predictable
settings surface, character portraits blend into the scene and appear only at
the left or right edge, history is attached to the dialogue box, and the
dialogue box does not resize while typewriter text is revealed.

The existing reader progression contract remains unchanged. `ReaderManager`
and `readerState` continue to own story, scene, dialogue index, URL, bookmarks,
and browser history. This change is presentation, authoring metadata, and
visual-asset work.

## Current Evidence and Root Causes

- The two checked-in Seventh Mirror portraits are 450 x 600 RGB PNGs. Their
  gray backgrounds are painted pixels, so CSS cannot make them transparent.
- `PortraitSlot` currently permits `left | center | right`; the compiler emits
  `center` as the default and the visual runtime also falls back to `center`.
- Mio and Yuma already have explicit `left` and `right` assignments, but the
  contract still permits future and fallback portraits to render in the
  center.
- `ReaderShell` renders a fixed Text/Visual control while
  `VisualNovelReader` separately renders Home, History, and Bookmark controls
  in the same top-right region. The two groups can overlap each other and the
  portrait.
- History currently belongs to that top navigation rather than the dialogue
  box.
- The dialogue box has content-driven height. Its text has only a minimum
  height, and its action control is conditionally inserted after typing, so
  wrapped text and the typing-to-complete transition can move the box edge and
  its contents.

## Product Decisions

| Decision | Choice |
| --- | --- |
| Settings ownership | Shell popup in Visual mode at every breakpoint and desktop Text; mobile Text keeps its existing single menu |
| Popup contents | Bookmark, Text/Visual mode toggle, Back to Home |
| Mobile Text controls | Existing hamburger remains the sole menu and gains a Visual Novel action; its Home and Bookmark actions remain there |
| Home/Bookmark chrome | Removed from Visual and desktop Text leaves; available in shell Settings there |
| History | Always-visible control absolutely anchored at the dialogue box's top-right corner |
| Portrait slots | `left` or `right` only; unspecified portraits default to left |
| Portrait assets | Transparent 450 x 600 RGBA PNGs preserving the existing characters and crop |
| Dialogue height | Fixed per responsive layout class; content scrolls internally |
| Remote publication | Not part of this change; update source and local verification fixtures only |

## Scope

### In scope

- A reusable, accessible reader-settings popup.
- Moving the mode control and the Visual/desktop-Text Bookmark and Home actions
  into it without creating a second mobile-Text menu.
- Moving the visual History control into the dialogue box.
- Fixed dialogue-box geometry at desktop, mobile portrait, and compact
  landscape layouts.
- Removing `center` from authored, generated, and runtime portrait-slot
  contracts.
- Removing the painted backgrounds from the two existing Seventh Mirror
  portrait sources and regenerating local visual fixtures.
- English and Traditional Chinese translation parity.
- Unit, compiler, asset-metadata, and browser regression coverage.

### Out of scope

- New reader preferences such as text size, typewriter speed, audio, or volume.
- Changes to story progression, URL semantics, bookmark persistence, or
  browser-history ownership.
- Generating missing expressions or portraits for additional characters.
- Publishing or activating a new production R2 visual release.
- Redesigning the Acts panel or the text-reader dialogue presentation.

## Architecture and Ownership

### Shared settings surface

Add `ReaderSettingsMenu.svelte` and render it from `ReaderShell`, alongside the
existing visual-status surface and outside the `reader-ready` subtree. It is
the Settings surface in Visual mode at every breakpoint and in Text mode at
desktop breakpoints. In mobile Text mode it is not rendered or focusable;
`MobileNovelReader`'s existing hamburger remains the one control surface and
gains a Visual Novel action. This prevents two visually and semantically
competing mobile menus while preserving a path into Visual mode.

`ReaderShell` already owns the persisted reader mode and receives the bookmark
callback, bookmark visibility, active dialogue index, and home URL. It passes
these values to the menu without introducing a second store or changing
`VisualNovelReader`'s controlled-progression boundary.

Conceptual component contract:

```ts
type ReaderSettingsMenuProps = {
  open: boolean; // Svelte $bindable; ReaderShell uses bind:open
  locale: Locale;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  onBookmark: () => void;
  showBookmarkButton: boolean;
  backUrl: string;
  bookmarkDisabled: boolean;
  triggerUnavailable: boolean;
};
```

`ReaderShell` supplies `onBookmark={() => onBookmark(dialogueIndex + 1)}` so
the established one-based bookmark offset stays intact. Bookmark is omitted
when `showBookmarkButton` is false and disabled while the current payload is
blocked. The mode control and Home link remain available while a replacement
payload is blocked, matching the existing shell-level mode-control behavior.

`ReaderShell` owns `settingsOpen` and binds it to the component's Svelte 5
`$bindable` `open` prop. No callback, event bus, or second store mirrors this
state. It also owns an ephemeral `leafOverlayOpen` flag reported by
`VisualNovelReader` through `onOverlayChange(open)`. The callback reports
`backlogOpen || actPanelOpen`, reports `false` during cleanup, and the shell
resets it on mode replacement. While true, the Settings trigger is removed
from pointer and focus interaction and cannot open above a leaf-owned overlay.

The shell derives Settings availability from
`readerMode === 'visual' || !isMobile`. If a responsive change enters mobile
Text while Settings is open, an effect closes it and clears `settingsOpen`
before the mobile leaf becomes interactive, then moves focus to the mounted
mobile menu trigger when focus was inside Settings. This prevents a breakpoint
change from leaving the reader inert or focus on a removed trigger.

The existing load-blocking contract is reused completely:

```ts
const leafDisabled = isBlocking || settingsOpen;
```

The existing `reader-ready` inert attribute synchronization uses
`leafDisabled`, and every Visual, desktop Text, and mobile Text leaf receives
`interactionDisabled={leafDisabled}`. This prevents pointer interaction and
also blocks the leaves' window-level Enter/Space handlers, which do not rely on
ancestor inert state. Settings stays outside `reader-ready`, so its trigger and
dialog remain operable. The `reader-ready` `aria-hidden` value is derived from
the same `leafDisabled` value, rather than continuing to follow only
`isBlocking`.

`leafOverlayOpen` is deliberately not part of `leafDisabled`: making the
entire `reader-ready` subtree inert would also inert the leaf-owned focus-trap
dialog. It gates only the shell Settings trigger. Mobile Text does not report
its drawer/backlog state because the shell trigger is absent at that
breakpoint.

### Popup interaction

The persistent trigger is a 44 x 44 settings button in the top-right safe area.
It has a visible gear icon and a translated accessible name. It does not show
the current Text/Visual labels in the collapsed state, which removes the
current overlap with visual controls and portraits.

The popup is an anchored dialog with a scrim:

- `aria-haspopup="dialog"` and `aria-expanded` describe the trigger.
- The dialog has a translated title and uses the existing `focusTrap` action.
- Opening focuses the first actionable item.
- Escape, the close button, or the scrim closes it.
- Closing restores focus to the settings trigger.
- Selecting Text or Visual closes the active menu, awaits `tick()`, updates the
  persisted shell mode, awaits the replacement leaf, and focuses that mode's
  surviving menu trigger. This matters for mobile Visual-to-Text and
  Text-to-Visual switches, where the initiating trigger is unmounted.
- Selecting Bookmark sets `settingsOpen = false`, awaits Svelte's `tick()`, and
  only then calls the existing bookmark callback. The popup focus trap is
  fully deactivated before the bookmark prompt synchronously focuses its input,
  so focus restoration cannot steal focus back to the Settings trigger.
- Back to Home is a normal localized link to `backUrl`.

The Text/Visual choice is a two-button segmented control with `aria-pressed`.
It is the mode control in Visual and desktop Text. Mobile Text enters Visual
through an equivalent translated action in its existing hamburger menu; once
Visual is active, the shell popup provides the way back to Text.

`ReaderSettingsMenu` follows the proven `VisualBacklog` dialog shape and uses
the existing `focusTrap` action directly. It does not reuse or extend
`apps/web/src/components/ui/Modal.svelte`: that component has no focus trap or
focus-restoration contract and still exposes the legacy Svelte 4 slot API, so
making it the reader primitive would expand this task into an unrelated modal
refactor.

### Responsive Home/Bookmark control map

The ownership map has one menu at each breakpoint and mode:

- `VisualNovelReader` removes Home and Bookmark from its top navigation;
- `NovelReader` removes its top-right Home link and bottom Bookmark button,
  while retaining dialogue progress;
- `MobileNovelReader` retains Home, Bookmark, the mobile menu toggle, Acts,
  History, and progress in its auto-hiding chrome, and adds the translated
  Visual Novel mode action there.

The shell stops passing `backUrl`, `onBookmark`, and `showBookmarkButton` to
Visual and desktop Text leaves that no longer consume them; mobile Text keeps
those existing props. It passes the existing mode-change callback to mobile
Text for the new Visual Novel action. History remains leaf-owned: visual
History moves to the dialogue box, mobile History remains in mobile chrome,
and desktop Text remains unchanged because it has no separate backlog control.

## Visual Reader Layout

### History placement

Remove Home, History, and Bookmark from `VisualNovelReader`'s top navigation.
Home and Bookmark move to the shared settings popup. History stays leaf-owned
because its backlog and focus restoration belong to `VisualNovelReader`.

The dialogue box becomes the History button's positioning context. History is
absolutely anchored at its top-right in all dialogue states rather than taking
a dedicated grid row. The scrollable body reserves matching right padding of
at least the 44 px target plus its visual gap, so speaker and dialogue text can
never render underneath it. For narration, no empty speaker placeholder is
reserved. The History button stays at least 44 x 44, retains the existing
focus-return behavior, and continues to open the current-scene backlog through
the active line.

### Fixed dialogue geometry

The dialogue box uses `position: relative`, `box-sizing: border-box`,
`overflow: hidden`, and a two-row grid:

```text
body: speaker + dialogue or choices; minmax(0, 1fr); internally scrollable
footer: reserved action slot and progress in one 44px-minimum row
History: absolute top-right overlay; body reserves its width
```

The footer remains in the grid while typing. The Continue/Next/Complete action
is hidden but its slot is reserved until it becomes actionable. Consequently,
the transition from partial typewriter text to complete text cannot change the
dialogue-box height or move the progress indicator. Combining action and
progress in the footer, and keeping History out of grid flow, leaves useful
text space within the compact `9.5rem` panel without reducing any interactive
target below 44 px.

The fixed responsive heights are:

| Layout | Dialogue-box height |
| --- | --- |
| Desktop and regular landscape | `18rem` |
| Mobile portrait | `40dvh` |
| Compact landscape (`max-height: 31rem`) | `9.5rem` |

Long dialogue and choice lists scroll inside the body row. The page itself
does not gain a reader scroll trap. Pointer-movement guards continue to ensure
that scrolling the dialogue body does not advance the line.

The same breakpoint rules define a `--dialogue-box-height` custom property
used by both the dialogue box and portrait geometry. Portrait bottom offset is
the dialogue-box height plus its safe-area bottom offset and a minimum
`0.75rem` gap. Portrait maximum height is retuned from the remaining viewport
above that boundary. This replaces the current independent portrait offsets,
which were tuned against a content-sized box, and guarantees that the portrait
image rectangle does not intersect the fixed dialogue panel in desktop,
mobile portrait, or compact landscape layouts.

### Portrait geometry

Narrow the shared story and visual-runtime types to:

```ts
type PortraitSlot = 'left' | 'right';
```

Apply the rule throughout the pipeline:

- the character parser accepts only `left` or `right` and reports those two
  choices in validation errors;
- generated presentation metadata uses `left` as `defaultSlot`;
- the visual controller uses `left` as its missing-presentation fallback;
- empty visual snapshots use `left`;
- the visual layer type drops `center`;
- the center CSS selector and translate transform are removed.

Existing Seventh Mirror assignments remain Mio left and Yuma right. Stories
without authored slot assignments regenerate with a left fallback. This is a
deliberate contract change requested by the product behavior; no compatibility
alias preserves center rendering.

## Portrait Asset Treatment

### Source and runtime inventory

The repository contains exactly two Seventh Mirror portrait source files:

- `asakura_mio/base.png`
- `asakura_yuma/base.png`

The bundled `hpa-228-local` preview likewise serves exactly those two portrait
identities, plus two `ch1_act2` backgrounds. Generated story metadata names
additional expressions, but those are logical authoring targets rather than
checked-in source files, and the bundled preview does not resolve them. If the
local reader navigates outside the preview's representative path, such keys
retain the existing quiet missing-asset fallback.

The production release plan references additional Mio/Yuma expressions whose
source binaries were deliberately removed from this checkout after migration.
Changing those private sources and activating a replacement production release
requires a separate, explicitly authorized release task. This design therefore
guarantees transparency for every portrait source and encoded portrait variant
that the checked-in local preview can serve; it does not claim to rewrite
unavailable production-only expression sources.

### Background removal

Edit the two existing source portraits rather than regenerating different
characters:

- `asakura_mio/base.png`
- `asakura_yuma/base.png`

Each result must remain a 450 x 600 PNG with the same character appearance,
pose, clothing, crop, and edge placement. Only the painted gray background is
removed. The canvas outside the character becomes transparent and retains a
real alpha channel; a visually gray replacement layer or CSS blend is not
acceptable.

After editing:

1. inspect both images over light and dark checkerboard-style backgrounds;
2. extend `apps/web/scripts/verify-visual-fixtures.ts` to inspect each approved
   source with Sharp and verify width, height, PNG format, and `hasAlpha: true`;
3. regenerate the local content-addressed visual fixture using the existing
   `apps/web/scripts/build-visual-fixtures.ts` path;
4. have that same verifier assert each emitted portrait WebP retains alpha,
   then ensure pointer/manifest hashes and size limits still match;
5. verify in the browser that scene backgrounds remain visible around each
   character silhouette.

The fixture builder uses the full production-equivalent WebP option set:
`quality: 82`, `alphaQuality: 100`, `lossless: false`, `preset: 'picture'`,
`smartSubsample: true`, and `effort: 6`. These values remain explicit in the
web fixture builder. Importing `ENCODER_POLICY_V1` directly would require a new
web-to-infrastructure workspace dependency and a new package export solely for
test fixtures; that coupling is not justified here. The verifier checks the
property that matters at the boundary—the emitted portrait still has alpha.

No credentials, upload, active-pointer mutation, or remote release activation
is authorized by this design.

## Data and Interaction Flow

### Settings flow

1. A Visual or desktop-Text user opens the shell-level Settings trigger; a
   mobile-Text user selects Visual Novel in the existing hamburger menu.
2. `ReaderShell` marks the popup open; `leafDisabled` drives both
   `reader-ready` inert synchronization and every leaf's
   `interactionDisabled` prop.
3. Mode selection calls the existing `setReaderMode` path; the dialogue index,
   scene, URL, and retained visual runtime are unchanged, and focus moves to
   the surviving Settings or mobile-menu trigger after the replacement leaf
   mounts.
4. Bookmark closes Settings, awaits `tick()`, and calls the existing callback
   with `dialogueIndex + 1`.
5. Home follows the existing `backUrl`.
6. Closing restores focus and re-enables the leaf reader.

### History flow

1. User activates History at the dialogue box's top-right.
2. `VisualNovelReader` makes its content inert and opens `VisualBacklog`.
3. The backlog derives entries from `dialogue.slice(0, dialogueIndex + 1)`.
4. Closing restores focus to the History button in its new location.

Neither flow imports or writes `readerState` from a leaf component.

## Internationalization

All added or changed user-facing strings are added to both translation files.
Reuse existing reader keys where their meaning is exact, including Bookmark,
Text, Visual Novel, Open/Close History, and Back to Home. Add explicit reader
settings labels for the trigger, dialog title, and close action rather than
relying on icon-only or English-only text.

## Accessibility and Input Safety

- All controls have at least a 44 x 44 target.
- The settings popup and backlog each have one focus owner; they cannot be open
  simultaneously because a leaf overlay makes the Settings trigger
  unavailable, while opening Settings disables the leaf surface.
- Popup and backlog both support Escape, focus trapping, inert background
  content, and deterministic focus restoration.
- Settings actions are marked as reader-interactive, so pointer or keyboard
  activation cannot advance dialogue.
- `leafDisabled` prevents window-level Enter/Space handlers from skipping or
  advancing typewriter text while Settings is open.
- `reader-ready` uses `leafDisabled` for both `inert` and `aria-hidden`, keeping
  the accessibility tree and interaction state synchronized.
- The fixed dialogue body retains keyboard and touch scrolling.
- `prefers-reduced-motion` continues to disable decorative transitions without
  changing layout geometry.

## Testing Strategy

### Story compiler and runtime tests

- RED: parser rejects `center` and reports `left or right`.
- RED: generated presentation defaults to `left` and emits only left/right
  assignments.
- RED: visual controller falls back to left when metadata or a character slot
  is absent.
- Existing explicit left/right resolution remains green.

The contract slice updates not just generated output but every handwritten
fixture that currently encodes `center`, including:

- `apps/web/src/lib/__tests__/reader-intent.test.ts`;
- `apps/web/src/lib/__tests__/reader-manager.test.ts` and
  `reader-manager-coverage.test.ts`;
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`;
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`;
- `packages/stories/src/__tests__/stories.test.ts`;
- `packages/stories/src/async/__tests__/loader.test.ts`;
- `packages/stories/src/compiler/__tests__/parse-characters.test.ts` and
  `emit.test.ts`.

### Component tests

- Settings trigger opens the dialog, focus enters it, and Escape/scrim/close
  restore trigger focus.
- Text/Visual selection changes mode in both directions and closes the popup.
- Mode changes and a desktop-to-mobile breakpoint change move focus to the
  surviving Settings or mobile-menu trigger rather than leaving it on removed
  chrome.
- Bookmark uses the active one-based dialogue number and is omitted or disabled
  under the existing guards; after selection, the bookmark prompt input—not
  the Settings trigger—owns focus.
- Home uses the supplied localized URL.
- Desktop Text and Visual leaves no longer render Home or Bookmark controls.
- Mobile Text retains one hamburger menu, retains Home/Bookmark, adds the
  Visual Novel action, and does not render a second Settings trigger.
- `settingsOpen` drives the same inert attribute synchronization and
  `interactionDisabled` props as the existing load-blocking state, and
  `aria-hidden` follows the same derived value.
- Opening the visual backlog or Acts panel makes the shell Settings trigger
  unavailable; closing or unmounting it restores trigger availability.
- Visual History renders at the dialogue box's top-right and restores focus
  there.
- Visual top navigation no longer contains Home, History, or Bookmark.
- The reserved footer remains present during typing and after completion.

The component task updates the directly affected suites in sequence with the
chrome change: `apps/web/src/components/__tests__/ReaderShell.test.ts`,
`NovelReader.test.ts`, `MobileNovelReader.test.ts`, and
`VisualNovelReader.test.ts`.

### Asset tests

- Both source portraits are exactly 450 x 600 PNGs with alpha.
- Every portrait entry in the regenerated local preview manifest is one of the
  two base identities and its WebP encoding preserves alpha.
- Fixture verification and pointer/manifest integrity checks pass.

The asset task extends
`apps/web/scripts/__tests__/verify-visual-fixtures.test.ts` and
`build-visual-fixtures.test.ts` alongside their corresponding scripts; it does
not create a parallel verifier.

### Browser tests

- Text mode opens Settings and switches to Visual without changing the URL
  line on desktop; mobile Text uses its existing menu for the same transition;
  Visual opens Settings and switches back to Text.
- Bookmark, Home, and mode controls are found only in the Settings popup for
  Visual and desktop Text, and only in the existing hamburger menu for mobile
  Text.
- Desktop Text, mobile Text, and Visual modes are each checked for duplicate or
  competing menu chrome.
- Enter and Space do not skip or advance text while Settings is open.
- History is visibly located at the dialogue box's top-right and opens/closes
  the backlog with correct focus restoration.
- Mio renders left and Yuma renders right; no rendered portrait exposes a
  center slot.
- Scene imagery is visible around the transparent portrait silhouette.
- The dialogue-box bounding-box height is identical at the start, middle, and
  completion of typewriter propagation.
- Desktop, mobile portrait, and compact mobile landscape use their specified
  fixed heights; portrait and dialogue bounding boxes retain at least the
  specified `0.75rem` gap.
- Page identity, non-blank rendering, framework-overlay absence, console
  health, screenshot evidence, and target interaction paths are recorded.

The browser task updates `packages/e2e/tests/reader-visual.spec.ts` and the
selectors/page objects in `packages/e2e/tests/utils.ts` in the same slice as
chrome removal. Existing mobile bookmark/back page-object flows remain; tests
add the mobile Text-to-Visual mode path rather than moving those actions to a
second menu.

## Acceptance Criteria

The change is complete when:

1. One Settings trigger is present in desktop Text and Visual modes; mobile
   Text has only its existing hamburger trigger.
2. The Settings popup is the only surface containing Bookmark, Text/Visual
   mode, and Back to Home in Visual and desktop Text; mobile Text keeps those
   actions in its one existing menu.
3. A user can return from Visual to Text without changing their story position.
4. History is at the top-right of the visual dialogue box and retains the
   accessible backlog behavior.
5. The dialogue box has constant height while text types and after it finishes
   at all supported layout classes.
6. Runtime and compiler portrait slots are left/right only.
7. Both existing portrait sources and local rendered variants have transparent
   backgrounds.
8. Focus, keyboard, pointer, scrolling, translations, and existing progression
   behavior pass focused and regression verification.

## Implementation-Planning Constraints

The implementation plan must keep independently risky changes observable:

1. Establish RED tests in the four named component suites for shell Settings
   state, Visual/desktop-Text Home/Bookmark de-duplication, the mobile single-
   menu mode path, leaf-overlay exclusion, bookmark-prompt focus, and
   Enter/Space blocking before changing reader chrome.
2. Implement and verify the shell popup, `tick()` bookmark handoff,
   `onOverlayChange` exclusion, and complete `leafDisabled` inert/
   `aria-hidden`/interaction gate as one coherent slice. Update
   `reader-visual.spec.ts` and `utils.ts` with that chrome slice.
3. Implement fixed dialogue geometry and portrait clearance as a separate
   slice with browser bounding-box evidence at every layout class.
4. Change the portrait-slot compiler/runtime contract in its own slice, update
   every named handwritten `center` fixture, and regenerate all story
   presentation files.
5. Add failing source/output alpha assertions to the existing fixture verifier
   and its tests before editing binaries; then perform background removal,
   production-equivalent fixture encoding, and fixture regeneration in a
   dedicated asset slice with its own integrity and browser smoke checks.
6. Finish with combined focused tests, the repository regression suite, and a
   rendered desktop/mobile interaction pass.

Binary portrait/fixture diffs, the compiler contract cut, and shell UI changes
must remain separate plan tasks so a hash or visual failure can be attributed
to one boundary. No task may rely only on typechecking for interaction or
layout acceptance.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Removing `center` breaks stale generated metadata | Regenerate every story presentation file and make compiler/type tests fail on center |
| Popup competes with loading or leaf-owned overlays | Drive the complete `leafDisabled` contract while Settings is open; use `onOverlayChange` to make its trigger unavailable while a Visual backlog or Acts panel owns focus |
| Enter/Space advances beneath an open popup | Pass `leafDisabled` to every leaf's existing `interactionDisabled` guard and add keyboard regression tests |
| Home/Bookmark remain duplicated or mobile gets two menus | Remove them from Visual and desktop Text, retain one mobile hamburger owner, and assert the responsive ownership map at each breakpoint |
| Fixed height clips long content | Put dialogue and choices in a dedicated internal scroll row and retain pointer-movement guards |
| Fixed panel intersects portrait geometry | Derive portrait offsets from the shared height variable and assert the minimum gap by bounding box at each layout class |
| Background removal damages hair or clothing edges | Edit from the current images, inspect over contrasting backgrounds, and reject changes beyond background removal |
| Local assets diverge from published R2 content | Regenerate and verify local fixtures; explicitly document that unavailable production expressions require a separately authorized source-edit and release task |
