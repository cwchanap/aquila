# HPA-610 R2 Audio Reader Runtime Design

## Status and baseline

This design plans Linear **HPA-610 — Resolve and stream R2 audio in the Aquila web visual-novel reader**.

HPA-609 / PR #60 is merged to `main` at `b35e53c13f11eb25f5a691509e62aed003a78fc0`. The merged audio contract is available through `@aquila/stories/runtime-assets`, including the audio pointer/manifest parsers, canonical release content, shared pointer/manifest validation, content-addressed release validation, URL/path helpers, and the existing runtime timeout policy.

HPA-610 implementation is unblocked. The only remaining external dependency is live preview-R2 acceptance: HPA-609 merged without a safe preview credential pair/fixture, so deployed verification still requires that setup later.

## Goal

Replace the local production audio catalog seam with validated R2 audio releases while preserving the existing HPA-604/HPA-605 behavior:

- `nextSfxCommand` remains the only SFX progression authority;
- `nextBgmSelection` remains the only BGM selection authority;
- initial/restored SFX remains silent;
- restored/current BGM is armed but gesture-gated;
- the first accepted release does not replay SFX queued during the load or start BGM — both wait for the next eligible user gesture (Safari/WebKit fix, since `HTMLAudioElement.play()` outside the gesture is rejected);
- responsive remounts do not recreate players;
- missing audio never blocks reader progression.

The runtime stays deliberately small: one session-local validated manifest map feeding direct immutable MP3 URLs to the existing native players.

## Keep the asymmetry with visuals

Do **not** clone `WebAssetResolver` wholesale. Audio does not need:

- `ValidatedReleaseStore` persistence;
- `DecodedAssetCache` or object URLs;
- image decode state;
- prefetch queues;
- a persisted stale-release fallback;
- an AudioManager or mixer.

Those visual subsystems solve image-specific persistence/decode problems. Audio hands immutable MP3 URLs directly to `HTMLAudioElement`, so a session-local release map is sufficient.

## Share the validated release-load chain

The previous draft shared only the low-level fetch helper. That still duplicated the trust-sensitive pointer → manifest → checksum → pair → canonical-release sequence between visual and audio.

Extract the common browser release loader into a **web runtime module**, not `@aquila/stories`:

```text
apps/web/src/lib/runtime-assets/release-loader.ts
```

`@aquila/stories/runtime-assets` remains the contract/policy layer. Browser fetch orchestration stays in `apps/web`; moving `fetch`, cache modes, and timeout behavior into the stories package would invert the existing dependency boundary.

Use a narrow media-codec parameter:

```ts
export type RuntimeReleaseCodecs<M extends { storyId: string; releaseId: string }> = {
    getCurrentPointerPath: (
        storyId: string,
        target: PublicationTarget
    ) => string;
    parsePointer: (
        input: unknown,
        target: PublicationTarget,
        storyId: string
    ) => ActiveReleasePointerV1;
    parseManifest: (input: unknown) => M;
    canonicalReleaseContent: (manifest: M) => string;
};

export type LoadedRuntimeRelease<M> = {
    pointer: ActiveReleasePointerV1;
    manifest: M;
    manifestSha256: ManifestByteSha256;
    pointerText: string;
    manifestText: string;
};

export async function loadValidatedRelease<
    M extends { storyId: string; releaseId: string },
>(options: {
    fetchImpl: typeof fetch;
    source: AssetResolverSource;
    codecs: RuntimeReleaseCodecs<M>;
    signal?: AbortSignal;
    assertPointerAcceptable?: (pointer: ActiveReleasePointerV1) => void;
}): Promise<LoadedRuntimeRelease<M>>;
```

The loader owns the current `WebAssetResolver.loadFromNetwork` sequence through release validation:

1. fetch pointer with `cache: 'no-cache'` and `RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer`;
2. reject non-OK response and read exact text;
3. parse JSON and the media-specific pointer;
4. call `assertPointerAcceptable(pointer)` so callers can enforce the session downgrade guard before fetching the manifest;
5. fetch manifest with `cache: 'force-cache'` and `RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest`;
6. hash exact manifest text;
7. compare the digest to `pointer.manifestSha256` **before** manifest parsing, matching the current visual ordering;
8. parse the media-specific manifest;
9. call `validatePointerManifestPair`;
10. hash media-specific canonical release content and call `assertReleaseIdMatchesContentSha256`;
11. return immutable validated data without mutating caller state.

`fetchWithTimeout`, exact response-text reading, JSON parsing, and UTF-8 hashing stay private implementation helpers inside this module.

State mutation remains caller-specific:

- `WebAssetResolver` builds/persists its `ValidatedReleaseRecord`, runs its lifecycle-generation check, then accepts the visual release;
- `AudioReaderRuntime` performs its own generation check, builds its in-memory cue index, then accepts the audio release.

This removes the duplicated integrity chain without importing visual persistence machinery into audio.

## One remote-story allowlist

`apps/web/src/lib/visual-assets/source-factory.ts` already owns the current remote allowlist literal. Export it once:

```ts
export const REMOTE_ASSET_STORY_ID = 'the_seventh_mirror';
```

Both visual and **remote** audio source selection reuse it. Local audio fixtures remain story-agnostic.

## One runtime release identity shape

The current `VisualReleaseIdentity` fields are already media-neutral. Rename the underlying shape in `apps/web/src/lib/visual-assets/types.ts` while preserving the existing visual alias:

```ts
export type RuntimeReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

export type VisualReleaseIdentity = RuntimeReleaseIdentity;
```

Audio uses `RuntimeReleaseIdentity | null` directly. Local audio still returns `null` identity, so the broader environment union does not invent local release metadata.

Keep separate DOM namespaces because they are load-bearing test evidence:

```text
data-asset-*
data-audio-*
```

The deployed gate should parameterize one identity assertion helper by attribute prefix rather than cloning the shape-specific assertion code.

## Audio runtime contract

Add `apps/web/src/lib/audio/audio-runtime.ts`.

```ts
export type AudioCueResolution =
    | {
          status: 'resolved';
          url: string;
          asset: RuntimeAudioAssetV1 | null;
      }
    | {
          status: 'unavailable';
          reason:
              | 'release-not-loaded'
              | 'cue-not-in-release'
              | 'local-cue-missing';
      };

export interface AudioReaderRuntime {
    loadActiveRelease(): Promise<RuntimeReleaseIdentity | null>;
    softRevalidate(): Promise<RuntimeReleaseIdentity | null>;
    resolve(type: AudioAssetType, key: string): AudioCueResolution;
    dispose(): void;
}
```

The reasoned result is intentional. Silent playback is correct, but diagnostics must distinguish:

- no accepted release yet;
- a validated release that intentionally/actually lacks the cue;
- a missing local fixture key.

A `null` runtime at the shell boundary remains a fourth, distinct `runtime-unavailable` condition caused by unsupported remote story or bad asset configuration.

### Source behavior

Reuse `readAssetSourceConfigFromEnv` and `resolveAssetSource`.

- **local**: no pointer/manifest request; resolve current WAV catalogs; identity is `null`;
- **preview**: load the preview audio pointer and immutable manifest;
- **production**: load the production audio pointer and immutable manifest;
- **remote unsupported story**: no runtime;
- **bad source configuration**: one concise diagnostic and no runtime.

### Remote load

Use `loadValidatedRelease(...)` with audio codecs:

```ts
const AUDIO_RELEASE_CODECS = {
    getCurrentPointerPath: getAudioCurrentPointerPath,
    parsePointer: parseAudioActiveReleasePointer,
    parseManifest: parseRuntimeAudioManifest,
    canonicalReleaseContent: canonicalAudioReleaseContent,
} satisfies RuntimeReleaseCodecs<RuntimeAudioManifestV1>;
```

Pass the runtime's `assertNotOlder(pointer)` as `assertPointerAcceptable`.

Only after the loader returns and the runtime generation is still current should audio mutate state and rebuild:

```text
sfx:<key> -> RuntimeAudioAssetV1
bgm:<key> -> RuntimeAudioAssetV1
```

A valid `assets: []` release is fully accepted, exposes release identity, and resolves every cue as `cue-not-in-release`.

### Revalidation

Keep one accepted release plus newest accepted `publishedAt` in memory.

- initial failure: no accepted release;
- same release: retain map/identity;
- newer valid release: atomically swap future resolutions;
- older pointer: retain accepted release;
- other soft-revalidation failure: retain accepted release;
- dispose: abort current load, invalidate stale completion, clear map/identity/timestamp.

Soft revalidation never calls a player.

## Player injection without diff churn

Preserve the current first parameter (`createAudio`) so existing tests do not need `undefined` churn:

```ts
export type ResolveSfxUrl = (cueKey: string) => string | undefined;
export type ResolveBgmUrl = (cueKey: string) => string | undefined;

export function createSfxPlayer(
    createAudio: CreateAudio = src => new Audio(src),
    resolveUrl: ResolveSfxUrl = resolveLocalSfxUrl
): SfxPlayer;

export function createBgmPlayer(
    createAudio: CreateAudio = src => new Audio(src),
    resolveUrl: ResolveBgmUrl = resolveLocalBgmUrl
): BgmPlayer;
```

Existing player tests that inject only `createAudio` remain unchanged. `ReaderShell` is the only caller that needs:

```ts
createSfxPlayer(undefined, resolveSfxUrl)
createBgmPlayer(undefined, resolveBgmUrl)
```

The players should no longer label every missing injected URL as an **unknown** cue. Use a generic unavailable diagnostic at the player boundary; the shell/runtime resolver owns the specific reason.

## Put first-load decisions in pure transition helpers

`ReaderShell.svelte` should execute audio decisions, not define them.

### SFX

Extend `sfx-transition.ts` with the pending first-load contract:

```ts
export type PendingSfxPlayback = {
    position: LinePosition;
    cueKey: string;
};

export function pendingSfxAfterTransition(
    command: SfxCommand,
    next: LinePosition,
    initialLoadPending: boolean
): PendingSfxPlayback | null;
```

Rules:

- initial/restored `nextSfxCommand` remains `noop` and never becomes pending;
- while first load is pending, an already-eligible `{type:'play'}` transition returns a `PendingSfxPlayback` descriptor so the shell can suppress the immediate `sfxPlayer.play()` call;
- the shell does **not** store the descriptor. There is no `pendingInitialSfx` state;
- on release completion the queued SFX is **dropped, not replayed**. Replaying would call `HTMLAudioElement.play()` outside the user gesture that caused the transition, which WebKit rejects (and the players swallow the rejection). The reader simply proceeds; the next eligible forward transition plays its own SFX normally once `audioInitialLoadPending` is false.

This is the deliberate lean solution. An earlier draft retained the pending descriptor and replayed it on release completion via a `sfxCommandOnInitialRelease` helper; that machinery was removed because it reintroduced the WebKit gesture-rejection problem.

### BGM

`bgm-transition.ts` is unchanged. There is no `bgmKeyOnInitialRelease` completion predicate.

BGM is **not** started from release completion. The first accepted release only clears `audioInitialLoadPending`; the next eligible reader interaction (pointerdown on the reader-ready host) calls `activateBgm()`, which starts armed BGM now that `audioInitialLoadPending` is false. An earlier draft replayed armed BGM on release completion via `bgmKeyOnInitialRelease`; that was removed for the same WebKit gesture-rejection reason as the SFX replay.

`nextBgmSelection` remains unchanged.

### Why this split

`pendingSfxAfterTransition` owns the one timing decision that benefits from a cheap deterministic unit test (suppress immediate playback while first load is pending). `ReaderShell` holds only the minimal coordination state:

```text
audioRuntime
audioReleaseIdentity
audioInitialLoadPending
```

The shell calls the transition helper, obeys its output, and performs lifecycle cleanup. It does not duplicate progression policy, and it does not retain any pending-playback state across the release-load boundary.

## ReaderShell lifecycle

Extend the existing visual runtime lifecycle; do not add `audioRuntimeGeneration`.

Use:

- one existing `runtimeGeneration`;
- one shared story-transition guard;
- one `disposeRuntimesForStoryChange(nextStoryId)` that detaches visual + audio references and identities before disposal;
- one ensure path declared before the line-position effect;
- story-aware attempted guards for both runtimes.

Local audio runtime creation is synchronous and occurs before the line-position playback effect, so the injected shell resolver can use local fixture URLs immediately.

### Resolver diagnostics

Use small shell helpers:

```ts
function resolveAudioPlayerUrl(
    type: AudioAssetType,
    cueKey: string
): string | undefined {
    const runtime = audioRuntime;
    if (!runtime) {
        logger.warn('Visual-novel audio unavailable', {
            type,
            cueKey,
            reason: 'runtime-unavailable',
        });
        return undefined;
    }
    const result = runtime.resolve(type, cueKey);
    if (result.status === 'unavailable') {
        logger.warn('Visual-novel audio cue unavailable', {
            type,
            cueKey,
            reason: result.reason,
        });
        return undefined;
    }
    return result.url;
}
```

This keeps playback silent without collapsing configuration, loading, and omission states into the same misleading warning.

### Mode/settings/visibility

- Visual → Text: stop both players, reset BGM activation;
- Text → Visual: soft-revalidate existing audio runtime once, or create one if needed;
- enable first channel in Visual mode: create/load if needed;
- SFX disable: stop;
- BGM disable: stop + reset activation;
- visible-tab return in Visual mode: one audio soft revalidation;
- ordinary dialogue progression: no audio revalidation;
- story replacement/destroy: detach runtime first so resolver closures cannot call a disposed runtime.

## Release evidence

Render the same `RuntimeReleaseIdentity` under two stable namespaces:

```text
data-asset-environment
data-asset-preview-id
data-asset-release-id
data-asset-manifest-sha256

data-audio-environment
data-audio-preview-id
data-audio-release-id
data-audio-manifest-sha256
```

Audio attributes are absent in local/no-release mode.

## Runnable integration coverage

### Runtime/player/shell tests

Add local tests for:

- shared visual/audio validated-release loader ordering and timeouts;
- zero-asset audio release;
- type-qualified audio resolution;
- reasoned unavailable states;
- stale/revalidation/disposal behavior;
- player URL injection with unchanged existing constructor call sites;
- pure initial-load SFX suppression rule (`pendingSfxAfterTransition`);
- ReaderShell real runtime-resolver → player → `createAudio(url)` wiring;
- combined visual/audio story replacement;
- no per-line audio revalidation;
- no duplicate playback on responsive remounts.

These are the primary code-integration proof and require no live R2 credentials.

## Make Task 4 locally verifiable

The normal Playwright config intentionally ignores `visual-novel-deployed.spec.ts`. Therefore `bun --filter e2e test:e2e` is a broad regression check but **does not validate new deployed-gate code**.

Extract the riskiest pure gate selection into:

```text
packages/e2e/tests/support/audio-gate-anchors.ts
packages/e2e/tests/support/audio-gate-anchors.test.ts
```

The helper accepts parsed story dialogue/flow plus `RuntimeAudioManifestV1` and returns:

```ts
export type AudioGateAnchors = {
    bgm: {
        sceneId: string;
        page: number;
        key: string;
    };
    sfx: {
        sceneId: string;
        fromPage: number;
        toPage: number;
        key: string;
    };
};
```

It must require:

- an included BGM that can be active on a direct/restored landing page;
- an included SFX with a reachable immediately previous page so `index + 1` is a genuine forward transition;
- both keys to exist in the pinned audio manifest.

Update `packages/e2e/package.json`:

```json
"test:release-gate-config": "bun test ./release-gate-automation.test.ts ./tests/support/audio-gate-anchors.test.ts"
```

This gives Task 4 a credential-free test that actually executes newly added code.

`visual-novel-deployed.spec.ts` imports the helper instead of embedding anchor-selection logic.

### Deployed gate

Keep optional paired:

```text
RELEASE_GATE_AUDIO_RELEASE_ID
RELEASE_GATE_AUDIO_MANIFEST_SHA256
```

Parameterize the existing release-identity assertion helper by attribute prefix instead of creating a separate shape-specific helper.

When audio variables are present, the deployed gate proves:

1. pinned audio identity is active;
2. restored/landing BGM stays silent until an eligible gesture, then requests the exact manifest MP3;
3. a genuine forward transition requests the exact SFX MP3;
4. responses are successful `audio/mpeg` with immutable cache headers;
5. missing cue is silent/non-blocking;
6. mode/responsive remounts preserve position/identity without duplicate playback.

Do not duplicate HPA-609 Range, checksum, or private-archive verification in Playwright.

## Post-merge live acceptance

The implementation PR may merge after all repository/local integration checks pass even if safe preview credentials are still unavailable. **Linear HPA-610 remains In Progress until live acceptance is completed.**

When the preview fixture exists:

1. publish + explicitly activate a non-empty preview audio release containing representative SFX and BGM;
2. run HPA-609 `verify --media audio` pinned with `--expect-manifest-sha256` and exact source/receipt `--archive-probe-key` values;
3. run `bun --filter e2e test:release-gate` with the paired audio identity variables;
4. record the evidence and only then mark HPA-610 Done.

A valid all-omitted release may omit archive probes, but it cannot satisfy HPA-610 playback acceptance.

## Non-goals

- AudioManager, mixer, Web Audio graph, crossfades, volume automation
- persisted audio release fallback/store
- blob/object-URL/IndexedDB/service-worker audio cache
- full catalog or graph prefetch
- new R2 buckets/domains/cache rules
- publisher/schema changes
- HLS/adaptive bitrate/signed playback/DRM
- second release-gate suite
- runtime generation or audible-quality automation

## Review disposition

The latest review was verified against merged `main`.

- **F1 shared release chain:** accepted, with location adjustment. Share the entire validated browser release-load chain, but keep it in `apps/web`; `@aquila/stories/runtime-assets` remains contract/policy-only.
- **F2 runnable Task 4 verification:** accepted. Add a pure audio-anchor helper/test to `test:release-gate-config`; normal `test:e2e` is explicitly documented as not covering the deployed spec.
- **F3 pure first-load rules:** accepted, then narrowed by the Safari fix. Only `pendingSfxAfterTransition` (suppress immediate playback while first load is pending) remains in `sfx-transition.ts`; `bgm-transition.ts` is unchanged. The originally proposed `sfxCommandOnInitialRelease` / `bgmKeyOnInitialRelease` completion helpers were removed because replaying on release completion calls `HTMLAudioElement.play()` outside the user gesture, which WebKit rejects. ReaderShell drops queued SFX and does not start BGM on release completion.
- **F4 identity duplication:** accepted. One `RuntimeReleaseIdentity` backs visual and audio evidence while preserving separate DOM prefixes.
- **F5 constructor order:** accepted. Append resolver after `createAudio` so existing player tests do not churn.
- **F6 ambiguous warning:** accepted. Audio resolution carries an unavailable reason and the shell logs that reason while playback remains silent.

The earlier correction still stands and has been widened: initial/restored SFX is never replayed merely because the first remote manifest became available, and the first accepted release no longer replays any SFX queued during the load or starts armed BGM. Both were dropped from the design after the Safari/WebKit fix — replaying on release completion calls `HTMLAudioElement.play()` outside the user gesture that caused the transition, which WebKit rejects. The reader proceeds silently; the next eligible user gesture plays SFX/BGM normally once `audioInitialLoadPending` is false.