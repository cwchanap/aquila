# Aquila VisualNovelReader MVP with local assets

Linear: [HPA-228](https://linear.app/cwchanap/issue/HPA-228/build-aquila-visualnovelreader-mvp-with-local-assets)  
Date: 2026-07-26  
Status: Approved

## Goal

Build the first usable Aquila visual-novel reader using small, checked-in local
assets. The MVP must prove responsive visual presentation, browser-side
resolution and decoding, graceful fallback, bounded caching, one-edge
prefetching, and exact progression continuity without depending on Cloudflare
or the production publisher.

HPA-227 is the authoritative runtime asset contract. HPA-234 remains the sole
owner of story, scene, dialogue-index, locale, URL, bookmark, and browser
history state. HPA-228 consumes those boundaries; it does not redefine them.

## Current baseline

- `ReaderManager` owns reader behavior and canonical URL/persistence writes.
- `readerState` is the reactive owner of progression and the current runtime
  scene payload.
- `ReaderShell` is the stable store-to-props bridge.
- `NovelReader` and `MobileNovelReader` are controlled presentation
  components receiving `dialogueIndex` and reporting `onIndexChange`.
- Async story loaders already return generated `presentation` metadata.
- HPA-227 exports versioned pointer, manifest, release-plan, path, validation,
  cache, timeout, prefetch, dimension, resolver, and error contracts.
- The Seventh Mirror has existing Chapter 1 backgrounds and portraits, with
  Asakura Mio assigned to `left` and Asakura Yuma assigned to `right`.

## Product decisions

| Decision | Choice |
| --- | --- |
| Default mode | Text |
| Preference scope | Persisted locally per device, not per story or locale |
| Visual demo | The Seventh Mirror, Chapter 1 |
| Mode control | Always-visible compact Text / Visual Novel control in the top-right safe area |
| Visual failure | Continue quietly with the previous or neutral background and no failed portrait |
| Failure notice | Small, non-blocking accessible status indicator |
| Backlog scope | Current scene from its first line through the active line |
| Visual component model | One responsive `VisualNovelReader` for desktop and mobile |
| Runtime architecture | Isolated resolver, decoded cache, and visual state controller |

## Architecture and ownership

### Reader mode and composition

`ReaderShell` gains a versioned device-local presentation preference:

```ts
type ReaderMode = 'text' | 'visual';
```

The preference is stored under a dedicated key such as
`aquila:reader-mode:v1`. Missing, malformed, or unknown values resolve to
`text`. Reader mode is never added to `ReaderSessionState`, URL parameters,
bookmarks, or story saves.

`ReaderShell` remains the only leaf-reader selection point:

- Text mode keeps the existing breakpoint choice between `NovelReader` and
  `MobileNovelReader`.
- Visual mode mounts one responsive `VisualNovelReader` at every breakpoint.
- The mode control is rendered by `ReaderShell`, outside the leaf reader, so it
  remains in the same place across mode and breakpoint swaps.
- All readers receive the same controlled dialogue index, scene payload,
  choices, navigation callbacks, bookmark callback, retry/loading state, and
  interaction-disabled state.

Switching modes unmounts one presentation and mounts another without changing
`readerState.dialogueIndex`. No initial-index callback is introduced.

### Runtime story data

`readerState` gains generated `StoryPresentationMetadata | null` as runtime
payload. `ReaderManager` assigns it atomically with the successfully loaded
story payload and clears it on reset. Presentation metadata is never serialized
or persisted.

The visual prefetch planner needs read-only access to dialogue in immediately
reachable scenes. `ReaderManager` supplies a stable
`getSceneDialogue(sceneId)` callback to `ReaderShell`; the callback reads the
currently loaded story bundle and cannot mutate progression. This avoids
duplicating the full dialogue map into reactive state.

`VisualNovelReader` remains controlled:

- It does not import `readerState`.
- It does not read or write URL state.
- It does not persist story position or reader mode.
- It reports line changes only through `onIndexChange`.
- It reports choices and scene navigation through existing callbacks.

### Visual runtime modules

Browser visual behavior lives under `apps/web/src/lib/visual-assets/`.

#### `WebAssetResolver`

Implements HPA-227's `AssetResolver` interface:

- Loads and validates the active pointer and immutable manifest.
- Rejects unsafe paths before issuing requests.
- Verifies exact manifest bytes against the pointer checksum.
- Verifies schema, story, release, and canonical release identity.
- Resolves type-qualified logical identities to safe variant URLs.
- Retains and revalidates eligible last-known-good releases.
- Returns HPA-227 typed fallback results rather than unchecked URLs.

The resolver is configured with an `AssetResolverSource`. A resolver factory
maps a registered story to its local preview source. UI components call the
factory but never concatenate asset paths or construct asset-domain URLs.

#### `DecodedAssetCache`

Owns browser image fetching and decoding:

- Deduplicates concurrent requests by immutable object identity.
- Applies the HPA-227 15-second image timeout.
- Fetches exact bytes before decoding.
- Verifies content SHA-256 and declared byte length.
- Verifies decoded intrinsic dimensions against the manifest.
- Prefers AVIF only after a capability check and retries required WebP when an
  optional AVIF variant is unsupported or fails to decode.
- Produces a verified Blob URL for rendering.
- Revokes Blob URLs on eviction and disposal.
- Enforces both 48 decoded assets and 96 MiB of decoded pixels, where decoded
  cost is `width * height * 4`.

The cache protects the active, staging, previous, and immediate-prefetch
objects while they are in use. Other entries are evicted by least-recent use.
An object is never left cached after failed integrity or decode validation.

#### `VisualStateController`

Converts controlled reader data into renderable visual state:

- Maps the active line's `background` and `portrait` keys to type-qualified
  identities.
- Distinguishes `omitted` (the line has no logical key) from `missing` (a key
  exists but the active manifest cannot resolve it).
- Tracks `loading`, `ready`, `omitted`, `missing`, `failed`, and
  `stale-but-usable` states.
- Coordinates the two background layers.
- Applies deterministic portrait slots.
- Plans and executes bounded lookahead.
- Uses generation tokens and abort signals so late story, line, or mode results
  cannot overwrite current state.
- Releases references when disposed.

The visual runtime is created lazily when Visual Novel mode is first selected.
It remains alive across later text/visual switches in the same `ReaderShell`
and is cleared on story change or reader destruction.

## Active-line data flow

For every controlled `dialogueIndex`:

1. Read the active `DialogueEntry`.
2. Build optional type-qualified background and portrait identities.
3. Resolve identities against the fully validated active release.
4. Ask `DecodedAssetCache` for verified decoded objects.
5. Apply each completion only if its story, line, and request generation still
   matches.
6. Derive one-edge lookahead without changing progression.

Dialogue and choices render immediately and never wait for pointer, manifest,
network, integrity, or image decoding work.

## Background state machine

Two persistent render layers prevent blank replacement frames.

1. The active layer contains the last decoded ready background.
2. A new identity enters a staging state while the active layer stays visible.
3. A successful decode assigns the staging image and dimensions.
4. With normal motion, staging crossfades over active; with reduced motion, it
   swaps immediately.
5. After promotion, the former active image becomes the retained previous
   state and older unprotected references are released.
6. Missing, omitted, timed-out, invalid, or undecodable replacements do not
   clear the active layer.
7. If there has never been a ready background, the reader renders a neutral
   CSS backdrop.

The DOM exposes deterministic layer identifiers and states for tests. No
pixel-perfect screenshot assertion is required.

## Portrait state machine

V1 renders at most one active portrait.

- The portrait identity comes from the active dialogue line.
- The slot comes from
  `presentation.portrait.slotsByCharacterId[characterId]`.
- Missing character metadata uses `presentation.portrait.defaultSlot`, which
  is `center` under HPA-227.
- When portrait identity changes, the previous speaker is removed so a slow or
  failed load never shows the wrong speaker.
- The replacement portrait appears only after successful verification and
  decode.
- Missing, omitted, timed-out, invalid, or undecodable portraits render as no
  portrait and never block dialogue.

Slot placement is an anchor, not multi-character staging.

## Prefetch policy

Prefetch remains bounded by one story-flow edge and two concurrent requests.

- Within the current scene, the controller may warm the next distinct visual
  state.
- At a linear scene boundary, it requests only the first visual state of the
  immediately reachable scene.
- At a choice, it requests only the first visual state of each immediate
  branch.
- It never recursively follows a branch's next edge.
- It never preloads a whole scene, chapter, or story.
- Concurrent requests reuse the same cache promise as foreground loads.
- Prefetched entries remain subject to the global count and decoded-byte
  bounds.

The planner uses the active `StoryFlowConfig` plus the read-only
`getSceneDialogue` callback. It does not advance or persist story state.

## Resolver validation and stale-release behavior

`loadActiveRelease()` follows this order:

1. Build `current.json` with HPA-227's safe path helper.
2. Fetch it with the 5-second pointer timeout.
3. Parse and validate `ActiveReleasePointerV1`.
4. Reject a story mismatch, unsafe manifest path, or older activation pointer.
5. Fetch the manifest's exact bytes with the 10-second manifest timeout.
6. Verify `manifestSha256` before parsing.
7. Parse and validate `RuntimeAssetManifestV1`.
8. Verify story, release, and canonical release-content identity.
9. Activate the candidate atomically only after every check succeeds.

At most two fully validated releases are stored locally with their exact
manifest bytes, pointer, and validation timestamp. Reading stored data repeats
schema, byte-checksum, story, release, and canonical-content verification;
local storage is never trusted merely because this client wrote it.

When the current candidate is unavailable, stale, malformed, or invalid, the
resolver may continue the newest revalidated release for the same story if it
is no more than 24 hours old. The active state becomes `stale-but-usable` and
the UI exposes a small non-blocking status indicator. An older pointer cannot
downgrade a cached release. A deliberate rollback remains valid because it has
a newer `publishedAt`.

Without an eligible release, the resolver returns typed fallback state.
Dialogue, choices, and navigation remain usable.

## Local fixture strategy

### User-visible The Seventh Mirror preview

The demo uses an isolated local preview target so partial Chapter 1 coverage is
contract-valid and cannot update a production pointer:

```text
apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json
apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/<releaseId>/runtime-manifest.json
apps/web/public/assets/vn/objects/<sha256>.webp
```

Small fixtures are derived from existing repository artwork:

- At least two Chapter 1 backgrounds demonstrating a transition
- At least one Asakura Mio portrait in the left slot
- At least one Asakura Yuma portrait in the right slot

Images are downscaled and converted to WebP with aspect ratio preserved. The
fixture manifest records their actual byte length, checksum, width, and height.
AVIF is optional and not required for this local release.

The preview `StoryAssetReleasePlanV1` is checked in with source-side test
fixtures rather than under `public/`. Preview classification may be incomplete
under HPA-227; only the small included subset is published into the runtime
manifest.

### Synthetic resolver fixtures

A separate synthetic fixture set covers:

- A valid CJK, spaces, and nested logical key
- An explicitly omitted release-plan key
- A small story-flow and dialogue-map fixture whose choice has two immediate
  branches with different first visual states
- A manifest identity whose object path returns 404
- An object containing invalid image bytes
- Invalid pointer and manifest schema versions
- Unsafe and absolute paths
- Exact-byte manifest checksum mismatch
- Story and release mismatches

Source release plans may contain source paths and therefore are never served as
runtime data. Public runtime fixtures contain no prompts, local source paths,
provider metadata, or credentials.

## Visual reader layout

`VisualNovelReader` is a full-viewport cinematic composition:

- Backgrounds cover the viewport with aspect ratio preserved through cropping.
- The single 3:4 portrait is anchored left, center, or right above the dialogue
  area and sized using manifest dimensions.
- A translucent bottom dialogue box contains speaker name, active text,
  navigation controls, backlog control, bookmark control, and choices.
- Choices replace advancement controls at the active scene's final line and use
  the existing `onChoice` callback.
- The mode switch is layered above the scene in the top-right safe area.
- A small status indicator identifies fallback or stale-release use without
  opening a modal or interrupting progression.

Desktop, mobile portrait, and mobile landscape share the same markup.
Responsive CSS changes scale, spacing, portrait maximum height, and dialogue
box width. Essential controls use `env(safe-area-inset-top)`,
`env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, and
`env(safe-area-inset-left)`.

## Backlog

The visual backlog contains
`dialogue.slice(0, dialogueIndex + 1)` for the current scene.

- It resets naturally when the controlled scene dialogue changes.
- It does not create or persist a cross-scene traversal log.
- Opening it moves focus to the panel.
- Escape and Close return focus to the trigger.
- The scene behind it is inert while open.
- Pointer, touch, Enter, and Space events inside it never advance dialogue.

## Input and typewriter behavior

Visual mode follows the existing controlled-reader semantics:

- A first action while the line is typing reveals the complete active line.
- A subsequent action reports `dialogueIndex + 1` through `onIndexChange`.
- Enter, Space, primary click, and touch are supported.
- Self-initiated same-scene advances animate the next line.
- External index changes from restore, popstate, mode swap, or breakpoint
  changes snap to the complete target line.
- A new scene animates its first line.

The root advancement handler ignores events originating from:

- Links and buttons
- Inputs, selects, and textareas
- Editable content
- Choice controls
- Navigation and bookmark controls
- The mode selector
- The backlog and its controls
- Any element explicitly marked as reader-interactive

Interaction is also disabled while the backlog is open or `ReaderShell` marks
the active payload inert.

## Accessibility

- Mode selection, backlog, choices, bookmark, and navigation controls have
  translated accessible names.
- Opening and closing overlays follows deterministic focus management.
- Background and portrait images use empty alternative text because V1 authoring
  has no explicit visual descriptions.
- Dialogue text, speaker names, choices, and navigation remain available when
  every visual fails.
- Fallback and stale-release status is non-blocking and exposed politely to
  assistive technology.
- Reduced-motion users receive no crossfade and no unnecessary portrait motion.
- Touch targets remain usable in mobile portrait and landscape layouts.
- All new user-facing strings are added to both English and Chinese translation
  files.

## Testing strategy

### Resolver and cache unit tests

- Valid pointer, manifest, CJK/nested key, and URL resolution
- Unknown schema versions and validation failures
- Unsafe paths rejected before `fetch`
- Pointer and manifest timeouts
- Network, HTTP, and unavailable responses
- Exact manifest-byte checksum mismatch
- Story, release, and canonical-content mismatch
- Cached release revalidation, expiry, tamper rejection, stale pointer, and
  two-release eviction
- Image byte-length, content-hash, decoded-dimension, and decode failures
- AVIF capability/failure fallback to required WebP
- Concurrent request deduplication
- Count and decoded-byte eviction
- Blob URL revocation and `clear()`

### Controller unit tests

- No blank background while staging
- Promotion after successful decode
- Previous background retained on every fallback class
- Neutral background before the first success
- Late async results ignored after line, story, mode, or generation changes
- Portrait left/right/default-center placement
- Old portrait removed before a different speaker finishes loading
- Explicit omitted, missing, failed, ready, loading, and stale states
- Linear, within-scene, and immediate-choice prefetch
- No recursive edge traversal and no more than two concurrent requests

### Svelte component tests

- Text default and valid persisted Visual Novel preference
- Malformed preference fallback
- Exact index preservation across mode and breakpoint swaps
- Controlled `onIndexChange`, `onChoice`, bookmark, and scene navigation
- Backlog contents and focus restoration
- Typewriter skip-before-advance behavior
- Interactive-element keyboard, pointer, and touch safety
- Reduced-motion behavior
- Decorative image semantics and accessible status
- Safe-area CSS and mobile landscape layout state

### Playwright flows

- Desktop Visual Novel mode with The Seventh Mirror Chapter 1 assets
- Mobile Visual Novel mode on the existing mobile Chromium and WebKit projects
- A mobile landscape interaction pass
- Text to Visual Novel to Text switching at a nonzero dialogue index
- Exact direct-URL and browser-history restoration
- A real background transition with DOM layer-state assertions
- Asakura Mio left-slot and Asakura Yuma right-slot rendering
- A Train Adventure choice loaded by direct scene URL, proving choices and
  progression continue when visuals are absent
- Non-blocking missing and decode-failure behavior

Pixel-perfect screenshot comparison is not an acceptance requirement.

## Verification

Before completion:

1. Run focused resolver, controller, component, ReaderShell, and ReaderManager
   unit tests.
2. Run the complete web unit-test suite.
3. Run web type checking and linting.
4. Run the production web build.
5. Run targeted desktop, mobile portrait, and mobile landscape Playwright
   flows.
6. Run `compile:check` and confirm generated story output has no drift.
7. Recompute fixture release IDs, exact manifest checksums, asset checksums,
   byte lengths, and dimensions independently of constants supplied to the
   validators.
8. Review the finished implementation against the live HPA-228 issue and its
   current comments before declaring acceptance.

## Non-goals

- Cloudflare R2 provisioning or production hosting
- Production asset conversion, optimization, upload, or activation
- Full-story artwork coverage
- Production pointer changes
- Multi-character staging
- Animated portraits or Live2D
- Dynamic story-code import changes
- Progression, URL, bookmark, or browser-history precedence changes
- Cross-scene or persisted backlog history
- Cross-device synchronization
- Pixel-perfect screenshot baselines
