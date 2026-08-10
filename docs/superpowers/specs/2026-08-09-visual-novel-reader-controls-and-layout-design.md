# Visual Novel Reader Controls and Layout

Date: 2026-08-09  
Status: Approved

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
| Settings ownership | One shared popup rendered by `ReaderShell` in both Text and Visual modes |
| Popup contents | Bookmark, Text/Visual mode toggle, Back to Home |
| History | Always-visible control in the dialogue-box header, at its top-right corner |
| Portrait slots | `left | right` only; unspecified portraits default to left |
| Portrait assets | Transparent 450 x 600 RGBA PNGs preserving the existing characters and crop |
| Dialogue height | Fixed per responsive layout class; content scrolls internally |
| Remote publication | Not part of this change; update source and local verification fixtures only |

## Scope

### In scope

- A reusable, accessible reader-settings popup.
- Moving the mode control and visual-reader Bookmark/Home actions into it.
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
existing visual-status surface and outside the `reader-ready` subtree. This is
the only settings trigger and popup for the reader route, regardless of the
active mode or breakpoint.

`ReaderShell` already owns the persisted reader mode and receives the bookmark
callback, bookmark visibility, active dialogue index, and home URL. It passes
these values to the menu without introducing a second store or changing
`VisualNovelReader`'s controlled-progression boundary.

Conceptual component contract:

```ts
type ReaderSettingsMenuProps = {
  locale: Locale;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  onBookmark: () => void;
  showBookmarkButton: boolean;
  backUrl: string;
  bookmarkDisabled: boolean;
  onOpenChange: (open: boolean) => void;
};
```

`ReaderShell` supplies `onBookmark={() => onBookmark(dialogueIndex + 1)}` so
the established one-based bookmark offset stays intact. Bookmark is omitted
when `showBookmarkButton` is false and disabled while the current payload is
blocked. The mode control and Home link remain available while a replacement
payload is blocked, matching the existing shell-level mode-control behavior.

The shell tracks whether settings are open. While open, `reader-ready` is
inert and leaf-reader advancement is disabled. This prevents clicks through
the scrim without giving the menu any ownership of reader progression.

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
- Selecting Text or Visual updates the persisted shell mode, closes the popup,
  and restores focus to the still-mounted settings trigger.
- Selecting Bookmark closes the popup before calling the existing bookmark
  callback, so the existing prompt is not opened behind a focus trap.
- Back to Home is a normal localized link to `backUrl`.

The Text/Visual choice is a two-button segmented control with `aria-pressed`.
It is available in both modes, making the popup the way to enter and leave
Visual mode.

## Visual Reader Layout

### History placement

Remove Home, History, and Bookmark from `VisualNovelReader`'s top navigation.
Home and Bookmark move to the shared settings popup. History stays leaf-owned
because its backlog and focus restoration belong to `VisualNovelReader`.

The dialogue box gains a header row:

- speaker name on the left when one exists;
- History button on the right in all dialogue states.

For narration, the empty speaker area collapses while History remains aligned
to the top-right. The History button stays at least 44 x 44, retains the
existing focus-return behavior, and continues to open the current-scene
backlog through the active line.

### Fixed dialogue geometry

The dialogue box uses `box-sizing: border-box`, `overflow: hidden`, and a
three-row grid:

```text
header: speaker + History
body: dialogue or choices; minmax(0, 1fr); internally scrollable
footer: reserved action slot + progress
```

The footer remains in the grid while typing. The Continue/Next/Complete action
is hidden but its slot is reserved until it becomes actionable. Consequently,
the transition from partial typewriter text to complete text cannot change the
dialogue-box height or move the progress indicator.

The fixed responsive heights are:

| Layout | Dialogue-box height |
| --- | --- |
| Desktop and regular landscape | `18rem` |
| Mobile portrait | `40dvh` |
| Compact landscape (`max-height: 31rem`) | `9.5rem` |

Long dialogue and choice lists scroll inside the body row. The page itself
does not gain a reader scroll trap. Pointer-movement guards continue to ensure
that scrolling the dialogue body does not advance the line.

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
2. verify width, height, PNG format, and `hasAlpha: true` with the existing
   image tooling;
3. regenerate the local content-addressed visual fixture using the existing
   publisher/fixture path;
4. run the existing fixture verifier and ensure release-plan hashes match;
5. verify in the browser that scene backgrounds remain visible around each
   character silhouette.

No credentials, upload, active-pointer mutation, or remote release activation
is authorized by this design.

## Data and Interaction Flow

### Settings flow

1. User opens the shell-level settings trigger.
2. `ReaderShell` marks the popup open and disables the active leaf surface.
3. Mode selection calls the existing `setReaderMode` path; the dialogue index,
   scene, URL, and retained visual runtime are unchanged.
4. Bookmark calls the existing callback with `dialogueIndex + 1`.
5. Home follows the existing `backUrl`.
6. Closing restores focus and re-enables the leaf reader.

### History flow

1. User activates History in the dialogue header.
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
  simultaneously because opening settings disables the leaf surface.
- Popup and backlog both support Escape, focus trapping, inert background
  content, and deterministic focus restoration.
- Settings actions are marked as reader-interactive, so pointer or keyboard
  activation cannot advance dialogue.
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

### Component tests

- Settings trigger opens the dialog, focus enters it, and Escape/scrim/close
  restore trigger focus.
- Text/Visual selection changes mode in both directions and closes the popup.
- Bookmark uses the active one-based dialogue number and is omitted or disabled
  under the existing guards.
- Home uses the supplied localized URL.
- Visual History renders inside the dialogue header and restores focus there.
- Visual top navigation no longer contains Home, History, or Bookmark.
- The reserved footer remains present during typing and after completion.

### Asset tests

- Both source portraits are exactly 450 x 600 PNGs with alpha.
- Regenerated portrait variants preserve alpha.
- Fixture verification and release-plan integrity checks pass.

### Browser tests

- Text mode opens Settings and switches to Visual without changing the URL
  line; Visual opens Settings and switches back to Text.
- Bookmark, Home, and mode controls are found only in the popup.
- History is visibly located at the dialogue box's top-right and opens/closes
  the backlog with correct focus restoration.
- Mio renders left and Yuma renders right; no rendered portrait exposes a
  center slot.
- Scene imagery is visible around the transparent portrait silhouette.
- The dialogue-box bounding-box height is identical at the start, middle, and
  completion of typewriter propagation.
- Desktop, mobile portrait, and compact mobile landscape use their specified
  fixed heights without control/portrait overlap.
- Page identity, non-blank rendering, framework-overlay absence, console
  health, screenshot evidence, and target interaction paths are recorded.

## Acceptance Criteria

The change is complete when:

1. One Settings trigger is present in Text and Visual modes.
2. Its popup is the only surface containing Bookmark, Text/Visual mode, and
   Back to Home.
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

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Removing `center` breaks stale generated metadata | Regenerate every story presentation file and make compiler/type tests fail on center |
| Popup competes with loading or backlog overlays | Keep popup shell-owned above blocking content; inert the leaf while open; prevent simultaneous backlog interaction |
| Fixed height clips long content | Put dialogue and choices in a dedicated internal scroll row and retain pointer-movement guards |
| Background removal damages hair or clothing edges | Edit from the current images, inspect over contrasting backgrounds, and reject changes beyond background removal |
| Local assets diverge from published R2 content | Regenerate and verify local fixtures; explicitly leave production upload/activation to a separately authorized release task |
