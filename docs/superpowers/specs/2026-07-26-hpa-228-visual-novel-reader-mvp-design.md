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
| Visual demo | The Seventh Mirror, Chapter 1 `ch1_act2` representative path |
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
bookmarks, or story saves. `ReaderShell` is mounted only in the browser, so it
reads this preference synchronously during component initialization before
rendering its first leaf; no server-rendered Text reader flashes before a
persisted Visual Novel preference is applied. The key is written only when the
user toggles the control, never merely because the first visit defaulted to
Text.

`ReaderShell` remains the only leaf-reader selection point:

- Text mode keeps the existing breakpoint choice between `NovelReader` and
  `MobileNovelReader`.
- Visual mode mounts one responsive `VisualNovelReader` at every breakpoint.
- The mode control is rendered by `ReaderShell` outside both the leaf reader and
  the `reader-ready` inert subtree. It stays above loading/error overlays so it
  remains visible and interactive while the payload is blocked.
- All readers receive the same flow, controlled dialogue index, scene payload,
  choices, navigation callbacks, bookmark callback, retry/loading state,
  `isInitialMount`, and interaction-disabled state.

Switching modes unmounts one presentation and mounts another without changing
`readerState.dialogueIndex`. No initial-index callback is introduced.

The ReaderShell stacking contract is:

```text
z-80  mode control and visual status (always present, outside inert content)
z-60  blocking loading/error overlay
z-50  leaf-owned backlog, drawer, and visual-reader overlays
z-0   active leaf reader or no-payload loading/error surface
```

The mode control renders for both payload and no-payload states. It is a sibling
of `reader-ready`, not its descendant, and remains interactive while a
replacement payload is blocked.

### Runtime story data

`readerState` gains generated `StoryPresentationMetadata | null` as runtime
payload. `ReaderManager` assigns it atomically with the successfully loaded
story payload. Both `readerState.reset()` and `ReaderManager`'s field-by-field
constructor initialization explicitly assign `presentation = null`, parallel
to `activeFlow = null`, so a new manager or story change cannot retain stale
slot metadata from the global store. Presentation metadata is never serialized
or persisted.

Presentation assignment occurs inside the same generation-gated
`applySession()` operation as `activeStory` and `activeFlow`. An initial load
failure leaves it `null`. A failed replacement load intentionally preserves the
previous presentation together with the previous dialogue, flow, and active
story under the blocking error overlay. Clearing only presentation on a
replacement failure would desynchronize the preserved payload.

The visual prefetch planner needs read-only access to dialogue in immediately
reachable scenes. `ReaderManager` supplies a stable
callback to `ReaderShell`:

```ts
getSceneDialogue = (
    storyId: string,
    sceneId: string
): readonly DialogueEntry[] | null;
```

It returns `null` when `storyId !== readerState.storyId`, for an unknown scene,
or when no active story bundle exists. The lookup uses
`Object.hasOwn(story.dialogue, sceneId)` before indexing the generated plain
object, so inherited names such as `constructor` cannot become dialogue. It
never throws, never mutates dialogue, and keeps stable function identity across
renders. Only `VisualStateController` calls it; the Svelte leaf merely passes
controlled inputs into the controller. HPA-232 loads one complete story bundle
per dynamic import rather than loading individual scenes, so this lookup
remains synchronous without duplicating the full dialogue map into reactive
state.

`VisualNovelReader` remains controlled:

- It does not import `readerState`.
- It does not read or write URL state.
- It does not persist story position or reader mode.
- It reports line changes only through `onIndexChange`.
- It reports choices and scene navigation through existing callbacks.

The three readers share narrowly scoped pure helpers from
`apps/web/src/lib/reader-interaction.ts`:

- `getReaderAdvanceDecision()` selects skip, line advance, scene advance, or no
  action from controlled reader state.
- `isReaderInteractiveTarget()` identifies links, controls, editable content,
  overlays, and explicitly marked interactive descendants.

They continue sharing the existing `typeText` runner. The Svelte-specific
two-signal effect bookkeeping remains component-local. Mobile
`interactionDisabled`, open-overlay, and visible-chrome gates remain above the
shared decision helper; in particular, a tap that dismisses mobile chrome
returns before dialogue advancement. HPA-228 does not create a new headless
reader engine or refactor unrelated reader presentation.

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
maps a registered story to its local preview source and returns
`AssetResolver | null`. UI components call the factory but never concatenate
asset paths or construct asset-domain URLs.

The Seventh Mirror local factory source is:

```ts
{
    environment: 'local',
    storyId: 'the_seventh_mirror',
    baseUrl: new URL('/assets/', window.location.origin).href,
    target: { kind: 'preview', previewId: 'hpa-228-local' },
}
```

`baseUrl` is always an absolute, credential-free HTTP(S) URL because HPA-227's
safe URL helper rejects a relative `'/assets/'` value. Tests use an explicit
absolute localhost origin.

When a story has no configured source, the factory returns `null`. The
controller performs no pointer, manifest, or image requests and renders the
story with a neutral background and no portrait. Lines without visual keys are
`omitted`; a compiled visual key encountered without a source becomes a typed
`release-unavailable` fallback. This is the expected Train Adventure choice
flow in the local MVP.

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
AVIF support is detected once per browser session by decoding a tiny known AVIF
probe; user-agent sniffing is not used.

Before revoking a Blob URL, the renderer clears or replaces every associated
image `src` and waits for the DOM update. Revocation occurs on cache eviction,
story change, reader destruction, or explicit `clear()`. A Text / Visual Novel
toggle does not revoke cached objects because the approved runtime remains alive
across mode switches.

HPA-227's optional low-resolution `placeholder` and
`ResolvedAsset.placeholderUrl` fields remain valid resolver output, but this
MVP does not fetch or render them. Replacement continuity comes from retaining
the previous decoded background, and the first background uses the neutral CSS
backdrop until its full object is verified. Placeholder rendering is an
explicit V1 non-goal rather than an unhandled state.

#### `VisualStateController`

Converts controlled reader data into renderable visual state:

- Maps the active line's `background` and `portrait` keys to type-qualified
  identities.
- Distinguishes `omitted` (the line has no logical key) from `missing` (a key
  exists but the active manifest cannot resolve it).
- Tracks release status independently from background and portrait status.
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

## Release and layer state mapping

Release lifecycle and per-image presentation are separate state axes:

```ts
type VisualReleaseState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'stale-but-usable'
    | 'unavailable'
    | 'invalid';

type VisualLayerState =
    | 'omitted'
    | 'loading'
    | 'ready'
    | 'missing'
    | 'failed';
```

| Input/result | Release state | Affected layer state |
| --- | --- | --- |
| Dialogue line has no logical key | unchanged | `omitted` |
| Logical key exists but resolver factory returned `null` | `unavailable` | `failed` |
| Resolver returns `not-found` | `ready` or `stale-but-usable` | `missing` |
| Resolver returns `release-unavailable` | `unavailable` | `failed` |
| Resolver returns `invalid-release` or `integrity-failure` without an eligible cached release | `invalid` | `failed` |
| Verified bytes are loading | unchanged | `loading` |
| Integrity, timeout, network, dimension, or decode failure in the decoded cache | unchanged | `failed` |
| Verified image is decoded | `ready` or `stale-but-usable` | `ready` |

`stale-but-usable` is release-global: a background or portrait served from that
release may still be `ready`. The small status indicator appears when the
release is stale, unavailable, or invalid, or when a keyed current visual is
`missing` or `failed`. An intentionally `omitted` visual does not display a
warning.

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

Stable test hooks are:

- `data-testid="visual-novel-reader"`
- `data-bg-layer="active|staging"`
- `data-bg-state="omitted|loading|ready|missing|failed"`
- `data-portrait-state="omitted|loading|ready|missing|failed"`
- `data-portrait-slot="left|center|right"` when a portrait is ready
- `data-visual-release-state="<VisualReleaseState>"`
- `data-reader-mode="text|visual"` on the mode control

## Portrait state machine

V1 renders at most one active portrait.

- The portrait identity comes from the active dialogue line.
- The slot comes from
  `presentation.portrait.slotsByCharacterId[characterId]`.
- Slot resolution is
  `(characterId ? slotsByCharacterId[characterId] : undefined) ?? presentation?.portrait.defaultSlot ?? "center"`.
  Therefore a missing `characterId` or assignment still honors a story-defined
  default before falling back to HPA-227's center baseline.
- When portrait identity changes, the previous speaker is removed so a slow or
  failed load never shows the wrong speaker.
- The replacement portrait appears only after successful verification and
  decode.
- Missing, omitted, timed-out, invalid, or undecodable portraits render as no
  portrait and never block dialogue.

Slot placement is an anchor, not multi-character staging.

## Prefetch policy

`maxNavigationEdges: 1` is a depth limit, not a breadth limit: prefetch may fan
out to every immediately reachable choice target, but it never follows another
edge from any of those targets. A shared queue limits all edge and image
prefetch work to two concurrent requests.

- Within the current scene, the controller warms the next distinct visual state
  directly through `resolve()` and `DecodedAssetCache.prefetch()`. It does not
  manufacture a same-scene `PrefetchNextEdgeRequest`.
- At a linear scene boundary, it issues one `prefetchNextEdge()` call for the
  first visual state of the immediately reachable scene.
- At a choice with N immediate targets, it issues N singular
  `prefetchNextEdge()` calls, one per `{ fromSceneId, toSceneId }` edge. Calls
  beyond the global concurrency limit wait in the shared queue.
- It never recursively follows a branch's next edge.
- It never preloads a whole scene, chapter, or story.
- Concurrent requests reuse the same cache promise as foreground loads.
- Prefetched entries remain subject to the global count and decoded-byte
  bounds.

The planner uses the active `StoryFlowConfig` plus the read-only
`getSceneDialogue` callback. It does not advance or persist story state.

Prefetch crosses the resolver/cache boundary in two explicit stages:

1. For each immediately reachable story-flow edge, the controller builds one
   `PrefetchNextEdgeRequest` and calls
   `WebAssetResolver.prefetchNextEdge()`. The resolver pre-resolves and
   memoizes each identity's checked URL result. `requested`, `cached`, and
   `failed` in `PrefetchNextEdgeResult` describe this resolver-stage
   identity/URL cache; `failed` therefore contains only `AssetFallback`
   resolution results.
2. For each successful identity, the controller reads the memoized result
   through synchronous `resolve()` and passes the `ResolvedAsset` to
   `DecodedAssetCache.prefetch()`. Byte, integrity, timeout, and decode outcomes
   belong to the decoded cache/controller layer and do not change
   `PrefetchNextEdgeResult`.

This keeps HPA-227's `prefetchNextEdge()` surface active while ensuring all
byte prefetching still goes through the same deduplicated decoded cache as
foreground loads. A decode-prefetch failure is non-blocking and does not
pre-mark a later foreground request as failed.

## Resolver validation and stale-release behavior

`loadActiveRelease()` follows this order:

1. Build `current.json` with HPA-227's safe path helper.
2. Fetch it with the 5-second pointer timeout and
   `fetch(url, { cache: 'no-cache' })`.
3. Parse and validate `ActiveReleasePointerV1`.
4. Reject a story mismatch, unsafe manifest path, or older activation pointer.
   HPA-228 owns a small `publishedAt` comparison against the newest active or
   persisted pointer for the same source; `assertActivationAllowed()` is not
   reused because it checks publication channel, not pointer age.
5. Fetch the manifest's exact bytes with the 10-second manifest timeout.
6. Verify `manifestSha256` before parsing.
7. Parse and validate `RuntimeAssetManifestV1`.
8. Verify story, release, and canonical release-content identity.
9. Activate the candidate atomically only after every check succeeds.

Pointer loading and revalidation follow this lifecycle:

| Event | Action |
| --- | --- |
| First Visual Novel mount for a sourced story | Create the runtime and call `loadActiveRelease()` |
| Story change | Abort and dispose the old runtime, create the new story source, then load its active release |
| Visual Novel → Text | Retain the runtime and cache; do not force a reload or revoke objects |
| Text → Visual Novel | Reuse the runtime and soft-revalidate if the pointer is at least 60 seconds old |
| Active visual line change with pointer age ≥ 60 seconds | Start one background soft revalidation |
| Document becomes visible with visual runtime active and pointer age ≥ 60 seconds | Start one background soft revalidation |
| Candidate validation or network failure | Continue an eligible last-validated release as `stale-but-usable`; otherwise enter fallback |
| Reader destruction or explicit clear | Abort in-flight work and dispose runtime references |

There is no periodic timer. Revalidation is opportunistic at the events above.
Only one pointer/manifest load may be in flight per runtime; concurrent triggers
reuse it. Story-generation tokens and abort signals prevent a late
revalidation from activating after a story change.

At most two fully validated releases are stored in `localStorage` under the
versioned key `aquila:visual-assets:validated-releases:v1`. Each record contains
its complete `AssetResolverSource` identity, pointer, exact manifest text,
`validatedAt`, and `lastUsedAt`. The array is bounded to two records across all
stories and sources. Reading stored data requires an exact source match and
repeats schema, byte-checksum, story, release, and canonical-content
verification; `localStorage` is never trusted merely because this client wrote
it.

The validated release is installed in the in-memory store before persistence.
Every `localStorage` read, write, and cleanup is wrapped defensively. A
`QuotaExceededError`, disabled storage, Safari private-mode exception, or
failed removal never escapes resolver APIs, changes a ready release to failed,
or blocks visual mode. The current page continues with the memory-only release;
only cross-reload stale fallback is lost.

Expired or invalid records are removed first. When a third valid release must
be stored, the record with the oldest `lastUsedAt` is evicted.
`validatedAt`—not `lastUsedAt`—continues to govern the 24-hour stale limit. A
failed revalidation does not remove an otherwise valid, unexpired cached
release.

When the current candidate is unavailable, stale, malformed, or invalid, the
resolver may continue the newest revalidated release for the same source if it
is no more than 24 hours old. The active state becomes `stale-but-usable` and
the UI exposes a small non-blocking status indicator. The HPA-228 comparison
rejects a candidate whose parsed `publishedAt` precedes the newest accepted
pointer, preventing an older pointer from downgrading a cached release. A
deliberate rollback remains valid because it has a newer `publishedAt`.

Without an eligible release, the resolver returns typed fallback state.
Dialogue, choices, and navigation remain usable.

## Local fixture strategy

### User-visible The Seventh Mirror `ch1_act2` preview

The demo uses an isolated local preview target so partial Chapter 1 coverage is
contract-valid and cannot update a production pointer:

```text
apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json
apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/<releaseId>/runtime-manifest.json
apps/web/public/assets/vn/objects/<sha256>.webp
```

The flagship path is deliberately scoped to the 25-line `ch1_act2` scene. Its
four keyed source objects are:

- `chapter_1/ch1_act2_s0`
- `chapter_1/ch1_act2_s1`
- `asakura_mio/base`
- `asakura_yuma/base`

Those objects give every keyed line in the scene a resolvable visual, including
one real background transition and both configured portrait slots. Narrator
lines without portrait keys remain intentionally `omitted`, so the normal demo
does not show a missing-visual warning. Other Chapter 1 scenes are outside the
flagship fixture coverage and continue exercising typed fallback if visited.

The canonical E2E route is
`/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=6`, whose one-based
line 6 is Yuma in the right slot. Advancing once reaches Mio in the left slot
at line 7. The background-transition flow starts at line 10 and advances to
line 11.

Images are downscaled and converted to WebP with aspect ratio preserved. The
fixture manifest records their actual byte length, checksum, width, and height.
AVIF is optional and not required for this local release.

`sharp` is added as a direct web-package development dependency, pinned through
the workspace lockfile. The fixture-only
`apps/web/scripts/build-visual-fixtures.ts` script reads the four explicit PNG
source paths above, applies fixed resize/WebP options, and writes the
content-addressed WebP objects and matching pointer/manifest fixtures. The web
package exposes it as `bun run build:visual-fixtures`. This is a reproducible
test-fixture derivation command, not a generic publisher or production asset
optimization pipeline.

The preview `StoryAssetReleasePlanV1` is checked in at
`apps/web/src/lib/visual-assets/__fixtures__/release-plans/the-seventh-mirror.preview.v1.json`
rather than under `public/`. It marks exactly the four flagship objects above as
included. Preview classification may be incomplete under HPA-227; only that
small included subset is published into the runtime manifest.

### Synthetic resolver fixtures

A separate synthetic fixture set covers:

- A valid CJK, spaces, and nested logical key such as `第一章/鏡 房/夜`
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

`apps/web/scripts/verify-visual-fixtures.ts` imports the direct `sharp`
dependency to decode every checked-in WebP and independently recomputes release
IDs, exact manifest checksums, object checksums, byte lengths, and intrinsic
dimensions. It also:

- Derives an `AuthoringAssetCatalog` by flattening backgrounds and portraits
  from generated `theSeventhMirror/image-assets.json`, mapping each entry's
  type, key, and source path.
- Builds `availableSourcePaths` from the matching files under
  `packages/assets/media/`.
- Calls `validateReleaseCoverage(authoringCatalog, plan, availableSourcePaths)`.
- Calls `validateRuntimeManifestCoverage(manifest, plan)` so the included plan
  entries and runtime-manifest identities correspond exactly.

The web package exposes it as `bun run verify:visual-fixtures`; verification
never relies only on constants fed back into the validators under test.

## Visual reader layout

`VisualNovelReader` is a full-viewport cinematic composition:

- Backgrounds cover the viewport with aspect ratio preserved through cropping.
- The single 3:4 portrait is anchored left, center, or right above the dialogue
  area and constrained by responsive maximum heights.
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

Manifest width and height validate the decoded object and supply its intrinsic
aspect ratio; they are not rendered as raw CSS pixel dimensions. Backgrounds
use that ratio with cover/crop behavior. Portraits use the manifest ratio plus
breakpoint-specific `max-height` and `max-width`, preserving aspect ratio
without obstructing the dialogue or controls.

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
- Reduced-motion users receive no background crossfade; portrait changes render
  immediately at full opacity with no enter or fade animation.
- Touch targets remain usable in mobile portrait and landscape layouts.
- New flat keys are added under `reader` in both English and Chinese:
  `readerMode`, `textMode`, `visualNovelMode`, `visualStaleRelease`,
  `visualAssetFallback`, and `visualUnavailable`. The existing `historyTitle`,
  `openHistory`, and `closeHistory` keys are reused for the backlog.

## Testing strategy

### Resolver and cache unit tests

- Valid pointer, manifest, CJK/nested key, and URL resolution
- Unknown schema versions and validation failures
- Unsafe paths rejected before `fetch`
- Pointer and manifest timeouts
- Network, HTTP, and unavailable responses
- Exact manifest-byte checksum mismatch
- Story, release, and canonical-content mismatch
- First-load and opportunistic 60-second revalidation triggers
- Pointer requests use `cache: 'no-cache'`, and HPA-228's `publishedAt`
  comparison rejects an older pointer without calling `assertActivationAllowed`
- In-flight revalidation deduplication and story-change cancellation
- Cached release revalidation, expiry, tamper rejection, stale pointer,
  `lastUsedAt` updates, and two-release LRU eviction
- Memory-only continuation when validated-release `localStorage` writes or
  cleanup throw
- Image byte-length, content-hash, decoded-dimension, and decode failures
- One-time AVIF probe and capability/failure fallback to required WebP
- Concurrent request deduplication
- Count and decoded-byte eviction
- Image-source clearing before Blob URL revocation, plus `clear()`

### Controller unit tests

- No blank background while staging
- Promotion after successful decode
- Previous background retained on every fallback class
- Neutral background before the first success
- Late async results ignored after line, story, mode, or generation changes
- Portrait left/right/default-center placement
- Old portrait removed before a different speaker finishes loading
- Explicit release-to-layer state mapping and status-indicator scope
- Default slot resolution through character assignment, story default, and
  center fallback
- Linear edge prefetch, direct within-scene warming, and one call per immediate
  choice edge
- No recursive edge traversal and no more than two concurrent requests

### Svelte component tests

- Text default and valid persisted Visual Novel preference
- Synchronous preference hydration without a Text→Visual flash
- Malformed preference fallback and toggle-only persistence writes
- Mode control availability and stacking in payload, no-payload, and blocked
  states
- Exact index preservation across mode and breakpoint swaps
- Controlled `onIndexChange`, `onChoice`, bookmark, and scene navigation
- Backlog contents and focus restoration
- Shared pure advance-decision and interactive-target helpers
- Mobile chrome dismissal before the shared advance decision
- Typewriter skip-before-advance behavior
- Interactive-element keyboard, pointer, and touch safety
- Reduced-motion background and portrait behavior
- Decorative image semantics and accessible status
- Literal safe-area `env()` usage in component/CSS tests and mobile landscape
  layout state

### ReaderManager integration tests

- Presentation assignment alongside `activeStory` and `activeFlow`
- Null presentation after construction, initial failure, and reset
- Preserved presentation alongside the preserved payload after replacement
  failure
- Generation races cannot apply stale presentation metadata
- `getSceneDialogue(storyId, sceneId)` rejects stale story identities,
  inherited property names, and unknown scenes

### Playwright flows

- Desktop Visual Novel mode on the canonical The Seventh Mirror `ch1_act2`
  route
- Mobile Visual Novel mode on the existing mobile Chromium and WebKit projects
- A mobile landscape pass that calls
  `page.setViewportSize({ width: 844, height: 390 })` and verifies a tappable,
  unobscured mode control, one dialogue advance, backlog open/close, and no
  portrait overlap with essential controls. It does not claim to emulate
  nonzero notch insets.
- Text to Visual Novel to Text switching at a nonzero dialogue index
- Exact direct-URL and browser-history restoration
- A real background transition from `ch1_act2` one-based line 10 to line 11
  with DOM layer-state assertions
- Asakura Yuma right-slot rendering at one-based line 6 followed by Asakura Mio
  left-slot rendering at line 7
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
6. Run `bun --filter web build:visual-fixtures` using the locked direct `sharp`
   dependency and review the resulting checked-in fixture diff.
7. Run `bun --filter web verify:visual-fixtures`.
8. Run `compile:check` and confirm generated story output has no drift.
9. Confirm the fixture verification script independently recomputes release
   IDs, exact manifest checksums, asset checksums, byte lengths, and dimensions
   rather than accepting validator-input constants as proof.
10. Review the finished implementation against the live HPA-228 issue and its
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
- Low-resolution placeholder rendering
- Production/static-host response-header configuration; pointer requests still
  use browser `cache: "no-cache"`, while HPA-227's
  `no-cache, max-age=0, must-revalidate` response header belongs to the hosting
  path
