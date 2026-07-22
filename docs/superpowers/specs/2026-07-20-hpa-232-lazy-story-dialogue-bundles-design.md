# Lazy-load Aquila story dialogue bundles

Linear: [HPA-232](https://linear.app/cwchanap/issue/HPA-232/lazy-load-aquila-story-dialogue-bundles)
Date: 2026-07-20
Status: Approved; amended after technical review

## Goal

Stop the web reader from downloading every registered story's dialogue while
preserving the canonical reader-session behavior established by HPA-234 and the
existing synchronous story API used by Phaser and desktop consumers.

The web reader will load one story payload at a time through an asynchronous,
typed entry point. Story progression remains owned by the HPA-234 session
model; loading status and loaded content are runtime-only state.

## Current state and baseline

`packages/stories/src/stories/index.ts` eagerly imports all three registered
story modules. Each story module eagerly imports its generated dialogue scenes,
flow, and choice text. Any browser import of the package's synchronous story
registry therefore makes every story eligible for the same initial client
bundle.

`ReaderManager` currently calls `getStoryContent()` and `getStoryFlow()` during
construction and initialization. URL, persisted-session, scene, and dialogue
bounds are all resolved synchronously before the reader mounts. Phaser's
`PreloadScene` also calls the synchronous API and expects the data immediately.

The clean baseline command is:

```sh
bun --filter web build
```

On 2026-07-20, that command produced a shared client chunk of 9,524,129 bytes
raw and 2,045.24 kB gzip. Vite warned that the chunk exceeded its 500 kB
post-minification warning threshold. Generated story source accounts for about
11.4 MB before bundling. The implementation report will repeat this exact build
and add browser-network and performance evidence before and after the change.

## Considered approaches

### 1. Web-specific asynchronous entry point (chosen)

Keep the existing synchronous root API for Phaser, desktop, compiler tests, and
other shared consumers. Add a browser-oriented entry point containing only
metadata, loader types, errors, caching, and explicit per-story dynamic imports.

This minimizes compatibility risk and creates a bundler-visible boundary
without changing the compiler or story authoring model.

### 2. Make the shared story API asynchronous

Change `getStoryContent()` and possibly `getStoryFlow()` to return promises and
migrate Phaser, desktop, web, and tests together. This provides one API but
forces an unrelated asynchronous lifecycle into Phaser preload and increases
the blast radius substantially.

### 3. Fetch emitted JSON dialogue manifests

Move dialogue out of TypeScript modules and fetch story JSON at runtime. This
could produce strong delivery isolation, but it changes compiler output,
offline behavior, deployment, and error semantics. It exceeds HPA-232's scope.

## Package architecture

`@aquila/stories` keeps its existing root entry and synchronous exports:

```ts
getStoryContent(storyId, locale): StoryLoaderResult;
getStoryFlow(storyId): StoryFlowConfig | undefined;
```

A new export such as `@aquila/stories/async` provides the browser path:

```ts
loadStoryContent(
  storyId: string,
  locale: StoryLocaleInput
): Promise<AsyncStoryLoaderResult>;
```

`AsyncStoryLoaderResult` contains `dialogue`, `choices`, and
`flow: StoryFlowConfig`, plus the normalized `locale: Locale`, using existing
concrete types rather than untyped or duplicated shapes. `StoryLocaleInput` is
a runtime string input because JavaScript callers and regional language tags
are not constrained by the compile-time `Locale` union. Flow stays with the
dynamically loaded story even if its measured size is small. Keeping it there
prevents the web reader from reaching story modules through a synchronous flow
registry and accidentally pulling generated dialogue into the initial bundle.

The async entry contains:

- A lightweight metadata registry for registered IDs and supported locales.
  It deliberately contains no default-scene copy; the authoritative start
  scene comes from the flow after that story loads.
- One statically analyzable dynamic import function per story. The imports must
  remain explicit so Vite emits independently fetchable story chunks.
- Loader result and error types.
- In-flight request deduplication and successful-result caching.

A separate lightweight `@aquila/stories/translations` export exposes
`translations`, `getTranslations`, and their types without traversing the eager
story registry. All web runtime translation consumers use this subpath,
including shared modules such as `apps/web/src/lib/utils.ts` and
`bookmarks-manager.ts`, not only files whose names contain `reader`.

`packages/stories/package.json` explicitly exports `./async`,
`./async/testing`, and `./translations` in addition to its existing public
paths. Web tests resolve these workspace-package exports normally. A separate
Vitest alias is added only if implementation verification demonstrates that the
resolver cannot consume the package exports; it is not a second source of
subpath truth by default.

The web reader must not import the eager root story registry anywhere in its
runtime dependency graph. Type-only imports must use `import type`. Targeted
`no-restricted-imports` rules ban value imports from the eager
`@aquila/stories` root throughout `apps/web/src`; type-only imports remain
allowed. A complete web import audit migrates existing value imports to the
translations or async subpath. A production-build manifest assertion
additionally catches transitive runtime imports that ESLint cannot see.

The package does not add a package-wide `"sideEffects": false` declaration for
this task. Once web runtime imports use explicit lightweight subpaths, bundle
correctness does not depend on tree-shaking the eager root barrel. The targeted
import rule and manifest proof enforce the boundary without making a broader
side-effect contract for every module in `@aquila/stories`.

`apps/web/src/lib/story-types.ts` remains the repository's canonical web
`StoryId` contract. The package necessarily owns the loader-registry keys it can
resolve without importing from the application. The package exports its
registered ID list, async and synchronous loader maps use typed completeness
checks against that list, and a parity test compares it with the web `StoryId`
values. A registry mismatch therefore fails tests instead of drifting silently.

The synchronous registry remains the compatibility path. HPA-232 does not
claim that Phaser or desktop use lazy loading; it only verifies that their
existing builds and tests still work.

## Loader contract and errors

The cache key is the canonical registered story ID plus normalized locale.
Runtime input is lowercased before validation, lookup, and caching. `zh` and
`zh-*` language tags normalize to `zh`; `en` and `en-*` normalize to `en`; all
other languages produce `unsupported-locale`. This preserves the synchronous
loaders' useful `zh-TW` behavior while keeping one canonical cache key per
supported language and rejecting unrelated fallback languages explicitly.
Routes currently supply only exact `en` or `zh`. Existing story behavior, in
which not-yet-authored English content resolves to the Chinese generated
content, remains inside each story module and is not treated as a loading
error.

The loader follows these rules:

1. Validate the locale and story ID against lightweight metadata before import.
2. Return a cached successful result when available.
3. Return the same in-flight promise for simultaneous requests sharing a key.
4. Dynamically import only the requested story module.
5. Cache the successful result for the current browser/module session.
6. Remove rejected in-flight entries so application state does not permanently
   retain a rejected promise.

Failures use explicit typed codes:

- `unknown-story`: the requested ID is not registered.
- `unsupported-locale`: the locale is outside the supported set.
- `load-failed`: the dynamic import or module evaluation failed. The original
  cause is retained for diagnostics but is not rendered directly to users.

A test-only cache reset hook is exported from
`@aquila/stories/async/testing`, backed by the same internal cache module as the
production loader. No production consumer receives general cache mutation
APIs.

The successful-result cache is intentionally unbounded for the module session.
Its key space is bounded by the small explicit registry (currently three
stories and two locales), so an eviction policy would add complexity without a
meaningful memory benefit.

Removing an application-level rejected promise does not guarantee that a
second native `import()` for the same URL will fetch again. Browser module maps
are URL-keyed and can retain failed module fetches for the lifetime of the
document. Therefore the user-visible Retry action for `load-failed` performs a
full-page `location.reload()` while leaving the requested story/scene/dialogue
URL intact. The new document receives a fresh module map and re-resolves the
preserved intent against the current deployment. HPA-232 does not add
cache-busting/versioned dynamic imports, which would weaken Vite's static
chunk graph and request deduplication.

## Reader state and ownership

HPA-234's `ReaderSessionState` remains unchanged:

```ts
interface ReaderSessionState {
  storyId: string;
  sceneId: string;
  dialogueIndex: number;
  locale: Locale;
}
```

Those progression fields remain the only reader values serialized to the URL
and local storage. Loading state is runtime-only. `readerState` gains a status
model equivalent to:

```ts
type ReaderLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ReaderLoadState {
  status: ReaderLoadStatus;
  error: StoryLoadError | null;
  hasActivePayload: boolean;
}
```

The loaded dialogue, choices, and flow remain runtime payload. They are never
persisted. The active flow is stored with the loaded payload so scene
navigation does not consult the eager synchronous registry.

Initial loading has an explicitly empty runtime shape:

```ts
currentSceneId = '';
dialogue = [];
choice = null;
activeFlow = null;
canGoNext = false;
```

Navigation helpers are gated on `status === 'ready'` and a non-null active
flow for initial loading. During replacement loading,
`hasActivePayload === true` keeps the existing reader leaf mounted with its
ready session and payload frozen beneath a loading or error overlay. A separate
`pendingIntent` records the requested story, scene, dialogue, and locale. The
pending intent is not a second progression owner: it is discarded on success
or cancellation, retained through a retryable error, and never persisted as
the active session.

Reader-mode preference and responsive desktop/mobile presentation remain
separate from both progression and loading. Switching presentation consumes
the loaded store payload and does not call the story loader.

## Asynchronous reader lifecycle

`ReaderManager.initialize()` becomes asynchronous and separates requested
intent from validated active session:

1. Parse explicit URL state, persisted state, and default intent without
   validating scene/dialogue bounds against unloaded content.
2. Validate the requested story ID and locale against lightweight metadata.
3. Preserve that requested intent while setting the runtime status to
   `loading`.
4. Load the requested story payload.
5. Validate scene and dialogue bounds against the returned flow and dialogue.
6. Atomically apply the validated canonical session and complete runtime
   payload.
7. Normalize the URL, persist the validated session, and enter `ready`.

This requires decomposing the current `resolveInitialState`, which interleaves
precedence selection with synchronous flow/dialogue validation:

- A new pure, metadata-only selector chooses URL, persisted, or default intent
  without reading `flow.start`, checking scene existence, or reading dialogue.
- After the selected payload loads, a per-payload validator applies
  `flow.start`, scene existence, dialogue bounds, and the existing
  `validateSessionState`/`clampIndex` semantics.

`ReaderManager` then constructs `ResolveDeps.flow` and `ResolveDeps.dialogue`
over the loaded payload for ready-state helpers. The constructor,
`getSceneNode()`, and `getSceneData()` currently bypass `ResolveDeps`; they must
be refactored to use that active payload. Once ready, `applySession`,
`goToScene`, and navigation helpers remain synchronous over it. The old combined
`resolveInitialState` is not presented as reusable unchanged; its pure parsing
and validation primitives are retained where their contracts still fit.

If a known persisted story loads but its persisted session fails final
validation, HPA-234's precedence requires falling through to the default story.
When those are different stories, the manager starts a generation-guarded load
of the default payload before applying anything. A valid explicit URL story
continues to lock its tier: an invalid or missing scene resolves to that loaded
story's start rather than triggering a second-story fallback.

An unregistered story ID found only in persisted local storage is stale state,
not an `unknown-story` user error. The metadata-only selector discards that
persisted candidate and proceeds directly to the default-story tier. Explicit
URL and `popstate` story IDs remain user intent and retain the visible
`unknown-story` behavior.

The HPA-234 precedence remains: valid explicit URL intent, then persisted
session, then story default. An explicit but unknown URL story is an error, not
permission to fall through to a persisted or default story.

The manager increments a generation token for every initial load, `popstate`,
or in-document story change. Only the latest generation may
modify the store, URL, persistence, or visible error. A superseded promise may
finish, but its result is classified as stale and ignored deterministically.
Locale is fixed for a manager instance by the `/[locale]/reader` Astro route;
switching locale performs a full-page route navigation and does not add a
speculative in-place generation path.

Initialization mounts `ReaderShell`, registers `popstate`, `pagehide`, and
`visibilitychange` listeners, marks the manager initialized, and allocates the
first generation before starting the first awaited load. Back/Forward events
during initial loading therefore supersede that generation instead of being
lost. `destroy()` removes listeners, marks the manager destroyed, and increments
the generation so every pending completion becomes stale. Page-hide and
visibility persistence are guarded by `hasActivePayload`; initial empty loading
state is never written over the last valid persisted session.

`popstate` to a known story always enters the asynchronous load path when that
story/locale payload is not active. A previously successful story normally
resolves immediately from the session cache; an uncached story shows the
loading overlay. After loading, its scene and dialogue index are validated and
applied atomically. The current synchronous `onPopState` call to
`applySession()` is replaced by this generation-guarded path.

Unknown-story behavior is consistent across initial load and `popstate`: the
requested URL remains visible and the reader enters `unknown-story` rather
than falling through or reconverging to the previous story. For a known story,
a stale scene or malformed dialogue parameter reached through `popstate`
retains HPA-234's soft-rejection contract: keep the active session and replace
the URL with its canonical values after any required story payload has loaded.

When a `popstate` soft-rejection occurs and the reader has no active payload
(e.g. the initial load itself was soft-rejected, or a prior load failed and
left no ready session), there is no active session to preserve. In that case
the manager re-validates the same intent with initial-phase semantics against
the loaded payload: if the start scene and index 0 produce an applyable state,
that state is applied, the URL is canonicalized, and the session is persisted;
if even that fallback cannot produce an applyable state, the manager falls
back to the default intent so the reader reaches a working surface instead of
stalling on `loading` with no payload and no URL canonicalization.

If a known-story chunk fails transiently during `popstate`, the browser keeps
the history destination URL and the manager keeps that destination as
`pendingIntent`. The prior ready payload remains frozen beneath a
`load-failed` overlay, and Retry reloads the document at that exact `popstate`
destination. A later Back/Forward event increments the generation, supersedes
the failed pending intent, and begins resolving the newer history destination.
Failed content never updates the canonical store or persistence.

Retry reloads the page with the preserved requested intent. It does not
substitute another story or discard a requested scene/dialogue position.
Successful cache entries are reused within a document; application-level
failures are not retained, while the document reload is what resets the native
module-map failure.

For an explicit in-reader story navigation, the browser URL changes to the
requested intent when loading begins. The canonical active session and
persistence change only after successful loading and validation. Refreshing
during loading or after a transient error therefore retries the intended URL,
while failed content never overwrites the last valid persisted session.

Scene navigation within a ready story is synchronous because all scenes for
that story are already loaded. Existing controlled-reader index behavior,
choices, URL history, bookmarks, and exact dialogue-index restoration remain
unchanged after the initial payload is ready.

## Reader presentation

`ReaderManager` mounts `ReaderShell` before starting the first asynchronous
load, reversing today's populate-then-mount ordering so the loading state is
actually visible. `initialize(): Promise<void>` converts expected loader
failures into reader error state and does not reject for normal loading errors;
the `reader.astro` call site invokes it explicitly as a handled asynchronous
operation so unexpected failures cannot become unhandled promise rejections.

`ReaderShell` remains mounted as the stable reactive bridge. Load status and
`hasActivePayload` are independent rendering signals:

- Without an active payload, `idle`/`loading`/`error` render standalone
  initialization surfaces and no reader leaf.
- With an active payload, the existing controlled desktop or mobile reader
  remains mounted for `ready`, replacement `loading`, and replacement `error`.
  Loading uses an accessible `role="status"` overlay; errors use an accessible
  alert overlay. Both make the underlying reader inert.

Transient `load-failed` errors show Retry, implemented as a full document
reload of the preserved URL. `unknown-story` and
`unsupported-locale` errors retain the requested URL and offer navigation back
to the story list rather than retrying an impossible lookup. Both translation
files reuse the existing `reader.retry` key and add the reviewable keys
`reader.loadingStory`, `reader.storyLoadFailed`, `reader.unknownStory`,
`reader.unsupportedLocale`, and `reader.backToStories`. The existing generic
`reader.loadError` remains available for non-story reader failures.

When replacing an already-ready story, the prior payload remains rendered
under the overlay until the new payload succeeds. The reader leaf is not
unmounted and must remain inert: the pending request cannot mutate its
progression, and stale completion cannot replace the newer request. Initial
page load renders only the loading state, never the default story as a
placeholder.

## Compatibility audit

The implementation accounts for these import sites:

- Astro/Svelte reader: moves to the async entry point.
- Every web value import of translations moves to
  `@aquila/stories/translations`, including generic shared utilities reachable
  from reader components. Web type-only imports may continue to use the root.
- `apps/web/src/lib/act-navigation.ts`: `buildChapterData` receives the loaded
  `FlowConfig` as a parameter and removes its `getStoryFlow` value import. The
  desktop and mobile act panels receive the active flow through the ready
  reader component props/store bridge.
- Phaser `PreloadScene`: remains on the synchronous API.
- `packages/game` re-export: remains synchronous for compatibility.
- Tauri desktop: audited through its direct and transitive imports; no async
  migration is claimed unless an actual call site is changed.
- Compiler-generated story loaders and package tests: synchronous behavior
  remains covered, while the new async registry receives focused tests.

Desktop bundle size and story-loading behavior are unchanged by design. Its
synchronous imports continue to inline story modules; HPA-232 reports that
fact rather than claiming a desktop bundle reduction.

## Testing

### Unit and package tests

- Async loader: success, normalized locale, supported fallback behavior,
  unknown story, unsupported locale, simultaneous-request deduplication,
  successful cache reuse, rejected-promise cleanup, and cache isolation by key.
- Reader intent/session helpers: pure synchronous tests cover intent parsing
  before content is loaded and final validation after payload arrival.
- `ReaderManager`: initial loading, exact direct-link restoration, persisted
  restoration, atomic payload application, transient error and retry,
  explicit unknown-story handling, stale persisted-story fallback,
  stale-generation suppression, `popstate` during initial loading,
  transient-failure `popstate`, destroy-time invalidation, page-hide persistence
  guards, and no extra load during responsive/presentation swaps. Existing
  `reader-manager.test.ts` and `reader-manager-ssr.test.ts` migrate to async
  initialization and injected loader fixtures; they are not expected to remain
  unchanged.
- Reader components: accessible loading and error states and existing ready
  behavior, including `hasActivePayload` coverage proving replacement overlays
  do not unmount the reader leaf.
- `ActPanel`, `MobileActDrawer`, and `act-navigation` tests stop mocking
  `getStoryFlow` and instead pass explicit loaded-flow fixtures through the new
  component/helper contract.
- Registry parity: the package's registered story ID list matches the web
  `StoryId` values, and both synchronous and asynchronous loader maps are
  complete for every registered package ID.
- Existing `@aquila/stories` synchronous registry tests, `packages/game`, and
  desktop tests remain green on the compatibility path.

### Browser and network coverage

Playwright verifies:

- A direct link waits for content and restores its exact scene/dialogue line.
- Opening one story requests its story chunk but no unselected story chunk.
- Navigating among scenes does not request the story chunk again.
- Switching stories loads each selected chunk once.
- Aborting the selected dynamic-module request exposes Retry, and the next
  document reload succeeds without losing URL intent. The route abort is
  applied once so the post-reload request can complete.
- Rapid story navigation cannot display an earlier response.

Development-server request paths may be used for deterministic failure
injection in Playwright; production-build output is the authority for final
chunk measurements.

### Build-graph enforcement

`apps/web/astro.config.mjs` sets `vite.build.manifest: true`. The web build
script runs a post-build assertion after `astro build`, reading the emitted
client `.vite/manifest.json`; absence of the manifest is itself a failure. The
production build therefore emits a Vite manifest used by a deterministic
assertion.
The assertion follows module/import relationships rather than hashed filenames
or an exact chunk count, because Vite may legitimately extract shared helper
chunks. It verifies:

- The initial reader entry's static dependency graph contains no generated
  dialogue modules or synchronous story-registry module.
- Every registered story has a distinct dynamic entry rooted at its explicit
  loader import.
- One story entry's static graph contains no other story's generated dialogue.

This complements Playwright's network proof: the manifest verifies structural
split boundaries, while the browser verifies which chunks are actually
requested.

## Measurement report

A report under `docs/performance/` records the exact commands and environment.
Before and after measurements use the same:

- `bun --filter web build` command.
- Raw and gzip byte-count method over `apps/web/dist/client/_astro`.
- Reader URLs and cold-cache browser runs.
- Desktop profile and mobile CPU/network-throttling profile.
- Number of repeated runs and median load, parse, and scripting values.

The report includes:

- Initial reader JavaScript before and after.
- Shared and reader-entry chunks.
- Raw and compressed size for each selected story chunk.
- Network requests for selected and unselected story modules.
- The Seventh Mirror load and parse behavior on desktop and mobile.
- Confirmation that presentation switching and scene navigation do not
  redownload content.
- A separately labeled invalid-persisted-session cold run when it requires a
  first candidate load followed by a default-story load. This exceptional
  recovery path is not mixed into the normal first-story baseline or median.

## Chapter-splitting decision

HPA-232 does not implement chapter-level splitting. A follow-up issue is
created only when the post-change The Seventh Mirror story chunk remains
materially expensive, defined as either:

- more than 500 kB gzip, used here as an explicit Aquila delivery budget rather
  than as a reference to Vite's uncompressed/minified warning threshold; or
- more than 200 ms median story-chunk scripting/parse work on the documented
  mobile profile across repeated cold runs.

If neither threshold is reached, the performance report explicitly documents
that chapter splitting is unnecessary. If either threshold is reached, the
follow-up issue links the report and includes chunk sizes, timing evidence, and
the observed chapter boundaries; it does not expand HPA-232's implementation.

## Non-goals

- Image asset loading or prefetching.
- R2 setup or asset publishing.
- Chapter-level splitting without measurement evidence.
- Rewriting the story compiler or moving dialogue to network JSON.
- Replacing HPA-234's session, URL, history, or persistence ownership.
- Migrating Phaser or desktop to asynchronous story loading.

## Acceptance criteria

- Opening one story requests no other story's dialogue/choice module.
- The selected story is emitted as an independently fetchable chunk.
- The web reader's synchronous metadata path has no generated dialogue runtime
  import.
- Direct links and persisted sessions validate only after content loads and
  restore the exact intended active line.
- Unknown story and unsupported locale errors are explicit and recoverable.
- Transient load failure can be retried.
- Simultaneous identical requests share one load, while successful content is
  cached for the session and failed content is not.
- Stale loads cannot replace newer story or history intent.
- Presentation switching and scene navigation do not redownload content.
- Choices, scene progression, browser history, and bookmarks behave identically
  after content is ready.
- Phaser and desktop retain a verified synchronous compatibility path.
- Before/after evidence uses the same measurement method.
- The chapter-splitting decision follows the documented evidence thresholds.
