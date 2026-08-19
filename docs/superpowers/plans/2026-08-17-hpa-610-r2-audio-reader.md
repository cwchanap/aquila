# HPA-610 R2 Audio Reader Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve merged HPA-609 audio releases in the Aquila web visual-novel reader and feed direct immutable MP3 URLs into the existing SFX/BGM lifecycle without changing reader progression semantics. SFX queued during the initial release load is dropped (not replayed) on completion, and BGM is not started from release completion — both wait for the next eligible user gesture (Safari/WebKit fix).

**Architecture:** Extract one web-only validated release loader shared by visual and audio runtimes, then keep audio state session-local. Reuse one runtime identity shape, append URL resolvers to the existing native player constructors, keep the one first-load SFX suppression rule in `sfx-transition.ts` (`pendingSfxAfterTransition`), and let `ReaderShell.svelte` execute that decision under its existing lifecycle generation. `bgm-transition.ts` is unchanged. Extend the existing deployed release gate, but unit-test its pure audio-anchor selection so Task 4 is runnable without preview credentials.

**Tech Stack:** Bun, TypeScript, Svelte 5, Vitest, Playwright, browser `fetch`, native `HTMLAudioElement`, `@aquila/stories/runtime-assets`.

**Spec:** `docs/superpowers/specs/2026-08-17-hpa-610-r2-audio-reader-design.md`

## Global Constraints

- HPA-609 is merged on `main` as `b35e53c13f11eb25f5a691509e62aed003a78fc0`; implementation starts from current `main`.
- Reuse `PUBLIC_ASSET_BASE_URL`, `PUBLIC_ASSET_ENVIRONMENT`, and `PUBLIC_ASSET_PREVIEW_ID`; add no audio-specific source environment variables.
- Keep browser release loading in `apps/web`; `@aquila/stories/runtime-assets` remains the contract/policy layer.
- Share the complete pointer → manifest → exact checksum → pair validation → canonical release-id chain between visual and audio.
- Reuse `RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer` (5s) and `.manifest` (10s).
- Reuse one exported remote `the_seventh_mirror` story constant for visual + remote audio. Local audio fixtures remain story-agnostic.
- Accept valid `assets: []` audio releases and expose their release identity while resolving no cues.
- Keep one session-local accepted audio release and one `publishedAt` downgrade guard; no persisted audio release store.
- Feed direct custom-domain MP3 URLs to native `Audio`; do not fetch MP3 bytes into application memory.
- `nextSfxCommand` remains the SFX progression authority; initial/restored SFX stays silent.
- `nextBgmSelection` remains the BGM selection authority; restored BGM stays gesture-gated.
- First-load completion drops any SFX queued during the load and does not start BGM; both wait for the next eligible user gesture. Replaying on release completion would call `HTMLAudioElement.play()` outside the user gesture that caused the transition, which WebKit rejects (Safari fix). Soft revalidation never directly calls `play()`.
- Do not revalidate audio on ordinary dialogue progression.
- If both channels are disabled before runtime creation, make no remote audio pointer/manifest request.
- Use one shell story-replacement generation/transition path for visual + audio runtimes.
- Missing audio remains silent/non-blocking, but diagnostics must distinguish runtime unavailable, release not loaded, cue absent from validated release, and local fixture missing.
- Do not add an AudioManager, mixer, persisted audio cache/store, graph prefetcher, new R2 verifier, second release-gate suite, or HPA-609 schema change.
- Safe preview credentials/fixture are a post-merge acceptance dependency. Code may merge after all repository checks pass, but Linear HPA-610 remains In Progress until live acceptance passes.

---

### Task 1: Share validated browser release loading and add the audio runtime

**Files:**
- Create: `apps/web/src/lib/runtime-assets/release-loader.ts`
- Create: `apps/web/src/lib/runtime-assets/__tests__/release-loader.test.ts`
- Modify: `apps/web/src/lib/visual-assets/web-asset-resolver.ts`
- Modify: `apps/web/src/lib/visual-assets/source-factory.ts`
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Create: `apps/web/src/lib/audio/audio-runtime.ts`
- Create: `apps/web/src/lib/__tests__/audio-runtime.test.ts`
- Test existing: `apps/web/src/lib/visual-assets/__tests__/web-asset-resolver.test.ts`

**Interfaces:**

The shared web loader:

```ts
export type RuntimeReleaseCodecs<
    M extends { storyId: string; releaseId: string },
> = {
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

One identity shape:

```ts
export type RuntimeReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

export type VisualReleaseIdentity = RuntimeReleaseIdentity;
```

Audio resolution:

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

- [ ] **Step 1: Write failing shared-loader tests**

Create `apps/web/src/lib/runtime-assets/__tests__/release-loader.test.ts` using the existing web Vitest conventions.

Prove the manifest checksum is compared **before** manifest parsing:

```ts
it('rejects a manifest checksum mismatch before parsing the manifest', async () => {
    const parseManifest = vi.fn();
    const fixture = makeLoaderFixture({
        pointerManifestSha256: 'a'.repeat(64),
        manifestText: '{"schemaVersion":1}',
    });

    await expect(
        loadValidatedRelease({
            fetchImpl: fixture.fetch,
            source: fixture.source,
            codecs: {
                getCurrentPointerPath: fixture.getCurrentPointerPath,
                parsePointer: fixture.parsePointer,
                parseManifest,
                canonicalReleaseContent: vi.fn(),
            },
        })
    ).rejects.toMatchObject({ code: 'integrity' });

    expect(parseManifest).not.toHaveBeenCalled();
});
```

Add a timeout test with fake timers and an abort-aware never-resolving fetch. Assert the pointer request aborts at `RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer`.

Add a test proving `assertPointerAcceptable` runs after pointer parse but before the manifest request.

- [ ] **Step 2: Run shared-loader tests and verify red state**

```bash
bun --filter web test -- src/lib/runtime-assets/__tests__/release-loader.test.ts
```

Expected: FAIL because `release-loader.ts` does not exist.

- [ ] **Step 3: Extract the complete validated release chain from `WebAssetResolver`**

Create `apps/web/src/lib/runtime-assets/release-loader.ts`.

Keep these private inside the module:

```ts
async function fetchWithTimeout(...) { /* move existing behavior */ }
async function readResponseText(...) { /* move existing behavior */ }
function parseJson(text: string, contractName: string): unknown { /* existing behavior */ }
async function sha256Utf8Text(text: string): Promise<string> { /* existing behavior */ }
```

Implement `loadValidatedRelease` with this exact ordering:

```ts
const pointerText = await readResponseText(
    fetchImpl,
    resolveAssetUrl(
        source.baseUrl,
        codecs.getCurrentPointerPath(source.storyId, source.target)
    ),
    RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer,
    'no-cache',
    signal
);
const pointer = codecs.parsePointer(
    parseJson(pointerText, 'active-release pointer'),
    source.target,
    source.storyId
);
options.assertPointerAcceptable?.(pointer);

const manifestText = await readResponseText(
    fetchImpl,
    resolveAssetUrl(source.baseUrl, pointer.manifestPath),
    RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
    'force-cache',
    signal
);
const manifestSha256 = assertSha256<'manifest-bytes'>(
    await sha256Utf8Text(manifestText)
);
if (manifestSha256 !== pointer.manifestSha256) {
    throw new AssetResolverError('integrity', 'Manifest checksum mismatch');
}
const manifest = codecs.parseManifest(
    parseJson(manifestText, 'runtime asset manifest')
);
validatePointerManifestPair(pointer, manifest, manifestSha256);
const canonicalDigest = assertSha256<'release-content'>(
    await sha256Utf8Text(codecs.canonicalReleaseContent(manifest))
);
assertReleaseIdMatchesContentSha256(manifest, canonicalDigest);

return {
    pointer,
    manifest,
    manifestSha256,
    pointerText,
    manifestText,
};
```

No persistence or acceptance state belongs in this module.

- [ ] **Step 4: Retarget `WebAssetResolver.loadFromNetwork()` to the shared loader**

Define visual codecs in `web-asset-resolver.ts`:

```ts
const VISUAL_RELEASE_CODECS = {
    getCurrentPointerPath,
    parsePointer: parseActiveReleasePointer,
    parseManifest: parseRuntimeAssetManifest,
    canonicalReleaseContent,
} satisfies RuntimeReleaseCodecs<RuntimeAssetManifestV1>;
```

Replace the duplicated fetch/parse/hash/validate sequence with:

```ts
const loaded = await loadValidatedRelease({
    fetchImpl: this.fetchImpl,
    source: this.source,
    codecs: VISUAL_RELEASE_CODECS,
    signal,
    assertPointerAcceptable: pointer => this.assertNotOlder(pointer),
});
```

Keep existing visual-only behavior after it returns: lifecycle-current check, `ValidatedReleaseRecord`, persistence, `acceptRelease`, fallback handling, cache state.

- [ ] **Step 5: Export the remote story id and one release identity shape**

In `source-factory.ts`:

```ts
export const REMOTE_ASSET_STORY_ID = 'the_seventh_mirror';

export function getAssetResolverSource(...) {
    if (storyId !== REMOTE_ASSET_STORY_ID) return null;
    return resolveAssetSource(storyId, origin, config);
}
```

In `visual-assets/types.ts`:

```ts
export type RuntimeReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

export type VisualReleaseIdentity = RuntimeReleaseIdentity;
```

Do not rename existing visual consumers in this task unless needed; the alias avoids churn.

- [ ] **Step 6: Write audio-runtime source, zero-asset, reason, and stale tests**

Create `apps/web/src/lib/__tests__/audio-runtime.test.ts`.

Required cases:

```ts
it('uses local fixtures without a release fetch', async () => {
    const fetchImpl = vi.fn();
    const runtime = createAudioRuntime(
        'train_adventure',
        'http://localhost:5090',
        {},
        { fetchImpl: fetchImpl as unknown as typeof fetch }
    )!;

    await expect(runtime.loadActiveRelease()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
        status: 'resolved',
        asset: null,
    });
});

it('accepts a valid zero-asset release', async () => {
    const fixture = makeEmptyAudioReleaseFixture();
    const runtime = createRemoteAudioRuntime(fixture);

    await expect(runtime.loadActiveRelease()).resolves.toMatchObject({
        releaseId: fixture.releaseId,
        manifestSha256: fixture.manifestSha256,
    });
    expect(runtime.resolve('sfx', 'door-open')).toEqual({
        status: 'unavailable',
        reason: 'cue-not-in-release',
    });
});
```

Also test:

- remote allowlist accepts `the_seventh_mirror` and rejects another story;
- before an accepted release, remote `resolve()` returns `release-not-loaded`;
- local missing key returns `local-cue-missing`;
- same logical key under SFX/BGM resolves distinct objects;
- newer revalidation swaps future resolution;
- older `publishedAt` keeps the accepted release;
- failed soft revalidation keeps the accepted release;
- completion after `dispose()` cannot reactivate state.

- [ ] **Step 7: Implement `AudioReaderRuntime` through `loadValidatedRelease()`**

Use audio codecs:

```ts
const AUDIO_RELEASE_CODECS = {
    getCurrentPointerPath: getAudioCurrentPointerPath,
    parsePointer: parseAudioActiveReleasePointer,
    parseManifest: parseRuntimeAudioManifest,
    canonicalReleaseContent: canonicalAudioReleaseContent,
} satisfies RuntimeReleaseCodecs<RuntimeAudioManifestV1>;
```

For remote loads:

```ts
const loaded = await loadValidatedRelease({
    fetchImpl: this.fetchImpl,
    source: this.source,
    codecs: AUDIO_RELEASE_CODECS,
    signal: controller.signal,
    assertPointerAcceptable: pointer => this.assertNotOlder(pointer),
});
if (!this.isCurrent(generation, controller.signal)) return null;
this.assertNotOlder(loaded.pointer);
this.accept(loaded);
return this.identity();
```

`accept()` rebuilds the type-qualified map only after full validation.

- [ ] **Step 8: Run focused runtime and visual resolver regression tests**

```bash
bun --filter web test -- src/lib/runtime-assets/__tests__/release-loader.test.ts
bun --filter web test -- src/lib/__tests__/audio-runtime.test.ts
bun --filter web test -- src/lib/visual-assets/__tests__/web-asset-resolver.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add \
  apps/web/src/lib/runtime-assets/release-loader.ts \
  apps/web/src/lib/runtime-assets/__tests__/release-loader.test.ts \
  apps/web/src/lib/visual-assets/web-asset-resolver.ts \
  apps/web/src/lib/visual-assets/source-factory.ts \
  apps/web/src/lib/visual-assets/types.ts \
  apps/web/src/lib/audio/audio-runtime.ts \
  apps/web/src/lib/__tests__/audio-runtime.test.ts
git commit -m "feat(web): share validated audio release loading"
```

---

### Task 2: Inject runtime URLs without player-test churn

**Files:**
- Modify: `apps/web/src/lib/audio/sfx-player.ts`
- Modify: `apps/web/src/lib/audio/bgm-player.ts`
- Modify: `apps/web/src/lib/__tests__/sfx-player.test.ts`
- Modify: `apps/web/src/lib/__tests__/bgm-player.test.ts`

**Interfaces:**

```ts
export type ResolveSfxUrl = (cueKey: string) => string | undefined;
export type ResolveBgmUrl = (cueKey: string) => string | undefined;

export function createSfxPlayer(
    createAudio?: CreateAudio,
    resolveUrl?: ResolveSfxUrl
): SfxPlayer;

export function createBgmPlayer(
    createAudio?: CreateAudio,
    resolveUrl?: ResolveBgmUrl
): BgmPlayer;
```

- [ ] **Step 1: Add resolver-injection tests without changing existing createAudio-only calls**

SFX:

```ts
it('passes an injected resolved URL to native audio', () => {
    const audio = fakeAudio();
    const createAudio = vi.fn(() => audio);
    const resolveUrl = vi.fn(() =>
        'https://assets.example/vn/objects/sfx.mp3'
    );

    createSfxPlayer(createAudio, resolveUrl).play('door-open');

    expect(resolveUrl).toHaveBeenCalledWith('door-open');
    expect(createAudio).toHaveBeenCalledWith(
        'https://assets.example/vn/objects/sfx.mp3'
    );
});
```

Add the parallel BGM test.

Add a BGM case where `resolveUrl` changes URL for the same logical key; the current key must still suppress restart.

Do **not** rewrite existing tests that already call `createSfxPlayer(createAudio)` / `createBgmPlayer(createAudio)`.

- [ ] **Step 2: Run player tests and verify red state**

```bash
bun --filter web test -- \
  src/lib/__tests__/sfx-player.test.ts \
  src/lib/__tests__/bgm-player.test.ts
```

Expected: injected-resolver assertions fail until the second parameter is supported.

- [ ] **Step 3: Append the resolver parameter**

SFX:

```ts
export function createSfxPlayer(
    createAudio: CreateAudio = src => new Audio(src),
    resolveUrl: ResolveSfxUrl = resolveLocalSfxUrl
): SfxPlayer {
    // existing lifecycle; replace resolveLocalSfxUrl(cueKey) with resolveUrl(cueKey)
}
```

BGM mirrors it and continues suppressing by `currentKey`.

Change the missing-URL player diagnostic from “Unknown ... cue” to a generic “... cue unavailable”; Task 3's shell resolver supplies the specific remote reason.

- [ ] **Step 4: Run focused player tests**

```bash
bun --filter web test -- \
  src/lib/__tests__/sfx-player.test.ts \
  src/lib/__tests__/bgm-player.test.ts
```

Expected: PASS with existing createAudio-only tests unchanged.

- [ ] **Step 5: Commit Task 2**

```bash
git add \
  apps/web/src/lib/audio/sfx-player.ts \
  apps/web/src/lib/audio/bgm-player.ts \
  apps/web/src/lib/__tests__/sfx-player.test.ts \
  apps/web/src/lib/__tests__/bgm-player.test.ts
git commit -m "refactor(web): inject audio cue URLs"
```

---

### Task 3: Put first-load SFX suppression in a pure transition and integrate ReaderShell

**Files:**
- Modify: `apps/web/src/lib/audio/sfx-transition.ts`
- Modify: `apps/web/src/lib/__tests__/sfx-transition.test.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Reuse unchanged: `apps/web/src/lib/audio/bgm-transition.ts`
- Reuse unchanged: `apps/web/src/lib/__tests__/bgm-transition.test.ts`

**Interfaces:**

SFX:

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

BGM: `bgm-transition.ts` is unchanged. There is no `bgmKeyOnInitialRelease` completion predicate; BGM is started by the next eligible reader gesture (`activateBgm()`) after `audioInitialLoadPending` becomes false, not by release completion.

- [ ] **Step 1: Write pure initial-load SFX suppression tests**

In `sfx-transition.test.ts`:

```ts
it('retains only an eligible play command while first load is pending', () => {
    const position = { storyId: 's', sceneId: 'a', index: 1 };
    expect(
        pendingSfxAfterTransition(
            { type: 'play', cueKey: 'door-open' },
            position,
            true
        )
    ).toEqual({ position, cueKey: 'door-open' });
    expect(
        pendingSfxAfterTransition({ type: 'noop' }, position, true)
    ).toBeNull();
});
```

Add negative cases for:

- `initialLoadPending === false` (returns `null` so the shell plays normally);
- `{type:'stop'}` command (returns `null`).

The descriptor is consumed only to suppress the immediate `sfxPlayer.play()`; it is never stored and never replayed on release completion. There is no `sfxCommandOnInitialRelease` helper to test.

Keep existing test proving `nextSfxCommand(null, ...)` is `noop`.

- [ ] **Step 2: No new pure BGM transition tests**

`bgm-transition.ts` is unchanged in this task. BGM first-load behavior is owned by `ReaderShell` (do not start BGM on release completion; wait for the next eligible `activateBgm()` gesture) and is covered by the ReaderShell lifecycle tests in Step 6. Do not add a `bgmKeyOnInitialRelease` helper or tests for it.

- [ ] **Step 3: Run transition tests and verify red state**

```bash
bun --filter web test -- \
  src/lib/__tests__/sfx-transition.test.ts \
  src/lib/__tests__/bgm-transition.test.ts
```

Expected: `sfx-transition.test.ts` FAILs because `pendingSfxAfterTransition` does not exist. `bgm-transition.test.ts` should already PASS (no changes).

- [ ] **Step 4: Implement the pure helper**

`pendingSfxAfterTransition`:

```ts
export function pendingSfxAfterTransition(
    command: SfxCommand,
    next: LinePosition,
    initialLoadPending: boolean
): PendingSfxPlayback | null {
    return initialLoadPending && command.type === 'play'
        ? { position: next, cueKey: command.cueKey }
        : null;
}
```

Do not implement `sfxCommandOnInitialRelease` or `bgmKeyOnInitialRelease`. The shell drops the descriptor after using it to suppress the immediate play; nothing is replayed on release completion.

Do not change `nextSfxCommand`, `isForwardAdjacent`, `activeBgmAt`, or `nextBgmSelection` semantics.

- [ ] **Step 5: Add ReaderShell runtime and real-player harnesses**

In `ReaderShell.test.ts`, add a delayed runtime harness with controllable `loadActiveRelease()` and reasoned `resolve()` results.

For the real-player wiring test:

```ts
const createAudio = vi.fn(src => fakeAudio(src));
render(ReaderShell, {
    props: {
        createSfxPlayer: (_create, resolve) =>
            createDefaultSfxPlayer(createAudio, resolve),
        createBgmPlayer: (_create, resolve) =>
            createDefaultBgmPlayer(createAudio, resolve),
        createAudioRuntime: () => harness.runtime,
    },
});
```

Return different URLs for SFX/BGM and assert both exact URLs reach `createAudio` after their normal eligible actions. Swapping the shell's type closures must make the test fail.

- [ ] **Step 6: Add ReaderShell lifecycle tests**

Prove:

- both channels disabled -> no audio runtime attempt;
- local runtime exists before a user-driven playback transition;
- first accepted release identity appears as `data-audio-*`;
- initial/restored SFX stays silent;
- a forward SFX during first load is suppressed (not played) while `audioInitialLoadPending` is true;
- on release completion the suppressed SFX is dropped, not replayed (Safari fix — `play()` must stay within the user gesture);
- the next eligible forward transition after release completion plays its own SFX normally;
- a BGM gesture during first load does not autoplay on release completion; the next eligible reader gesture (`activateBgm()`) starts it once `audioInitialLoadPending` is false;
- first load without gesture does not autoplay;
- soft revalidation never calls either player's `play()`;
- ordinary dialogue progression does not call audio `softRevalidate()`;
- visual + audio story replacement shares one `runtimeGeneration` / transition guard and detaches both runtime references before disposal;
- responsive remount does not recreate players/runtime or duplicate playback.

- [ ] **Step 7: Run ReaderShell tests and verify red state**

```bash
bun --filter web test -- src/components/__tests__/ReaderShell.test.ts
```

Expected: FAIL because ReaderShell does not yet own the audio runtime.

- [ ] **Step 8: Add the audio runtime and reasoned resolver helpers to ReaderShell**

Keep only:

```ts
let audioRuntime: AudioReaderRuntime | null = $state(null);
let audioReleaseIdentity: RuntimeReleaseIdentity | null = $state(null);
let audioRuntimeStoryId: string | null = $state(null);
let audioRuntimeAttempted = $state(false);
let audioInitialLoadPending = $state(false);
```

Do not add a `pendingInitialSfx` variable. The `PendingSfxPlayback` descriptor returned by `pendingSfxAfterTransition` is consumed inline to decide whether to call `sfxPlayer.play()` and then discarded; nothing is retained across the release-load boundary.

Use shell resolver helpers:

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

Construct players with the appended resolver parameter:

```ts
const sfxPlayer = createSfxPlayer(
    undefined,
    cueKey => resolveAudioPlayerUrl('sfx', cueKey)
);
const bgmPlayer = createBgmPlayer(
    undefined,
    cueKey => resolveAudioPlayerUrl('bgm', cueKey)
);
```

- [ ] **Step 9: Extend the existing ensure/dispose lifecycle instead of adding another generation**

Rename the current story disposer to `disposeRuntimesForStoryChange` and detach both runtimes before disposal:

```ts
async function disposeRuntimesForStoryChange(
    nextStoryId: string
): Promise<void> {
    const generation = ++runtimeGeneration;
    const visual = visualRuntime;
    const audio = audioRuntime;

    visualRuntime = null;
    audioRuntime = null;
    visualIdentity = null;
    audioReleaseIdentity = null;
    visualRuntimeStoryId = nextStoryId;
    audioRuntimeStoryId = nextStoryId;
    visualRuntimeAttempted = false;
    audioRuntimeAttempted = false;
    audioInitialLoadPending = false;
    runtimeTransitioning = true;

    audio?.dispose();
    try {
        await visual?.dispose();
    } finally {
        if (!destroyed && generation === runtimeGeneration) {
            runtimeTransitioning = false;
        }
    }
}
```

Extend the existing runtime ensure effect **before** the line-position effect. Mirror the visual story-aware attempted guard:

```ts
if (
    audioRuntimeAttempted &&
    audioRuntimeStoryId === activeStoryId
) return;
```

Create/load audio only in Visual mode with at least one enabled channel.

- [ ] **Step 10: Suppress immediate SFX during first load; drop on completion**

When a normal position transition returns an SFX command, use `pendingSfxAfterTransition` only to decide whether to suppress the immediate `play()`:

```ts
const delayed = pendingSfxAfterTransition(
    command,
    nextPosition,
    audioInitialLoadPending
);
if (!delayed) {
    if (command.type === 'play') {
        sfxPlayer.play(command.cueKey);
    } else if (command.type === 'stop') {
        sfxPlayer.stop();
    }
}
// `delayed` is NOT stored. There is no pendingInitialSfx state.
```

On first successful load, do **not** replay any suppressed SFX and do **not** start BGM. Just clear the pending flag and render identity:

```ts
audioReleaseIdentity = identity;
audioInitialLoadPending = false;
// Drop any SFX that was queued while the release was loading — replaying
// it here would call HTMLAudioElement.play() outside the user gesture that
// caused the transition, which WebKit rejects (and the players swallow the
// rejection). BGM is not replayed either; the next eligible reader
// interaction (pointerdown on the reader-ready host) calls activateBgm(),
// which starts armed BGM now that audioInitialLoadPending is false.
```

The next eligible forward transition after release completion plays its own SFX normally (the `pendingSfxAfterTransition` call now returns `null` because `audioInitialLoadPending` is false), and the next `activateBgm()` gesture starts armed BGM.

Soft revalidation updates identity/map only and never calls either player's `play()`.

- [ ] **Step 11: Wire mode/settings/visibility/evidence/destroy**

- Text mode: stop channels, reset BGM activation.
- Text → Visual: soft-revalidate retained runtime once; otherwise ensure one if a channel is enabled.
- SFX disable: stop.
- BGM disable: stop + reset activation.
- visible tab + Visual: one audio soft revalidation beside the visual one.
- normal line changes: no audio revalidation.
- `reader-ready`: render `data-audio-*` from `audioReleaseIdentity`.
- destroy: detach audio runtime before player resolver closures can use it, then dispose players/audio and existing visual runtime.

- [ ] **Step 12: Run transition, ReaderShell, and full web tests**

```bash
bun --filter web test -- \
  src/lib/__tests__/sfx-transition.test.ts \
  src/lib/__tests__/bgm-transition.test.ts \
  src/components/__tests__/ReaderShell.test.ts
bun --filter web test
```

Expected: PASS.

- [ ] **Step 13: Commit Task 3**

```bash
git add \
  apps/web/src/lib/audio/sfx-transition.ts \
  apps/web/src/lib/__tests__/sfx-transition.test.ts \
  apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat(web): resolve R2 audio in reader shell"
```

---

### Task 4: Make the existing deployed audio gate locally testable

**Files:**
- Create: `packages/e2e/tests/support/audio-gate-anchors.ts`
- Create: `packages/e2e/tests/support/audio-gate-anchors.test.ts`
- Modify: `packages/e2e/tests/visual-novel-deployed.spec.ts`
- Modify: `packages/e2e/package.json`
- Reuse unchanged: `packages/e2e/tests/support/r2-browser-probe.ts`
- Reuse unchanged: `packages/infra-cloudflare/src/verify.ts`

**Interfaces:**

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

export function findAudioGateAnchors(
    dialogue: DialogueMap,
    flow: StoryFlowConfig,
    manifest: RuntimeAudioManifestV1
): AudioGateAnchors;
```

- [ ] **Step 1: Write pure audio-anchor selection tests**

Create `packages/e2e/tests/support/audio-gate-anchors.test.ts` with `bun:test`.

Build a tiny story fixture:

```ts
const dialogue = {
    act1: [
        { dialogue: 'landing', bgm: 'dawn-apartment' },
        { dialogue: 'middle' },
        { dialogue: 'effect', sfx: 'door-open' },
    ],
};

const flow = {
    start: 'act1',
    nodes: [{ kind: 'scene', sceneId: 'act1' }],
} as unknown as StoryFlowConfig;
```

Build a parsed audio manifest containing `bgm:dawn-apartment` and `sfx:door-open`.

Assert:

```ts
expect(findAudioGateAnchors(dialogue, flow, manifest)).toEqual({
    bgm: {
        sceneId: 'act1',
        page: 1,
        key: 'dawn-apartment',
    },
    sfx: {
        sceneId: 'act1',
        fromPage: 2,
        toPage: 3,
        key: 'door-open',
    },
});
```

Add failures for:

- manifest has no BGM;
- manifest has no SFX;
- authored key is absent from manifest;
- SFX exists only on page 1 and therefore has no immediate forward predecessor.

- [ ] **Step 2: Run the new anchor test and verify red state**

```bash
bun test packages/e2e/tests/support/audio-gate-anchors.test.ts
```

Expected: FAIL because `audio-gate-anchors.ts` does not exist.

- [ ] **Step 3: Implement `findAudioGateAnchors` as a pure helper**

Build included SFX/BGM key sets from the manifest and scan the story's scene nodes in flow order.

For BGM, require an entry whose own `bgm` field is a string included in the manifest. This deliberately chooses an explicitly authored landing line and avoids importing `apps/web` transition code into the E2E package.

For SFX, require an entry whose `sfx` key is included in the manifest and whose index is greater than zero. Return `fromPage = index` and `toPage = index + 1` because gate page numbers are one-based.

Throw a clear prerequisite error when both anchors cannot be found.

- [ ] **Step 4: Add the anchor test to the runnable release-gate config script**

Change `packages/e2e/package.json`:

```json
"test:release-gate-config": "bun test ./release-gate-automation.test.ts ./tests/support/audio-gate-anchors.test.ts"
```

Run:

```bash
bun --filter e2e test:release-gate-config
```

Expected: PASS and explicitly execute the new anchor-selection tests.

- [ ] **Step 5: Parameterize the existing release identity assertion by prefix**

In `visual-novel-deployed.spec.ts`, make `EXPECTED_IDENTITY` use the shared property name `assetEnvironment` instead of the current local `environment` alias, then replace separate visual/audio identity helpers with one helper:

```ts
async function expectReleaseIdentity(
    page: Page,
    prefix: 'asset' | 'audio',
    expected: RuntimeReleaseIdentity
): Promise<void> {
    const host = new ReaderPage(page).ready;
    await expect(host).toHaveAttribute(
        `data-${prefix}-environment`,
        expected.assetEnvironment
    );
    if (expected.previewId !== null) {
        await expect(host).toHaveAttribute(
            `data-${prefix}-preview-id`,
            expected.previewId
        );
    } else {
        await expect(host).not.toHaveAttribute(
            `data-${prefix}-preview-id`
        );
    }
    await expect(host).toHaveAttribute(
        `data-${prefix}-release-id`,
        expected.releaseId
    );
    await expect(host).toHaveAttribute(
        `data-${prefix}-manifest-sha256`,
        expected.manifestSha256
    );
}
```

Use `prefix='asset'` for existing visual assertions and `prefix='audio'` when paired audio env variables are enabled.

- [ ] **Step 6: Add optional audio env parsing and load the exact audio manifest**

Add paired optional inputs:

```text
RELEASE_GATE_AUDIO_RELEASE_ID
RELEASE_GATE_AUDIO_MANIFEST_SHA256
```

Both absent -> existing visual-only behavior. Exactly one -> configuration error.

When enabled:

1. fetch the immutable audio manifest for the pinned release with the existing browser probe;
2. parse it with `parseRuntimeAudioManifest`;
3. call `findAudioGateAnchors(dialogue, flow, manifest)`.

Do not embed a second anchor algorithm in the Playwright spec.

- [ ] **Step 7: Add deployed BGM and SFX evidence**

BGM:

1. navigate directly to the returned BGM page;
2. wait for visual readiness and audio identity;
3. verify no media response occurs solely from landing;
4. register `page.waitForResponse` for the exact BGM manifest URL;
5. perform the normal eligible reader gesture;
6. require success, `audio/mpeg`, and immutable cache header.

SFX:

1. navigate to `fromPage`;
2. wait for audio identity;
3. register the exact SFX response wait;
4. advance normally to `toPage`;
5. require success, `audio/mpeg`, immutable cache header, and canonical destination position.

Retain missing-cue, Text/Visual, responsive-remount, and no-duplicate evidence.

- [ ] **Step 8: Run all credential-free Task 4 verification**

```bash
bun --filter e2e test:release-gate-config
bun --filter e2e test:e2e
```

Expected:

- `test:release-gate-config` executes the new Task 4 anchor logic and passes;
- `test:e2e` remains a broad local reader regression and passes, but it intentionally ignores `visual-novel-deployed.spec.ts`.

Do not describe `test:e2e` as coverage of the deployed-gate branch.

- [ ] **Step 9: Run full repository verification**

```bash
bun --filter @aquila/stories test
bun --filter web test
bun --filter e2e test:release-gate-config
bun --filter e2e test:e2e
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 10: Commit Task 4**

```bash
git add \
  packages/e2e/tests/support/audio-gate-anchors.ts \
  packages/e2e/tests/support/audio-gate-anchors.test.ts \
  packages/e2e/tests/visual-novel-deployed.spec.ts \
  packages/e2e/package.json
git commit -m "test(e2e): add R2 audio release gate"
```

---

## Post-merge live acceptance gate

This is intentionally **not** an implementation task because the required safe preview credentials/fixture do not currently exist.

After the implementation PR merges, keep Linear HPA-610 **In Progress** until this checklist passes:

1. publish and explicitly activate a non-empty preview audio release containing the SFX/BGM anchors used by the gate;
2. record the exact private source and receipt archive keys for those two cues;
3. run:

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id "$RELEASE_GATE_PREVIEW_ID" \
  --expect-manifest-sha256 "$AUDIO_MANIFEST_SHA256" \
  --archive-probe-key "$AUDIO_SFX_SOURCE_ARCHIVE_KEY" \
  --archive-probe-key "$AUDIO_SFX_RECEIPT_ARCHIVE_KEY" \
  --archive-probe-key "$AUDIO_BGM_SOURCE_ARCHIVE_KEY" \
  --archive-probe-key "$AUDIO_BGM_RECEIPT_ARCHIVE_KEY"
```

4. run the deployed browser gate:

```bash
RELEASE_GATE_AUDIO_RELEASE_ID="$AUDIO_RELEASE_ID" \
RELEASE_GATE_AUDIO_MANIFEST_SHA256="$AUDIO_MANIFEST_SHA256" \
bun --filter e2e test:release-gate
```

5. record the verifier + Playwright evidence in Linear and only then mark HPA-610 Done.

A zero-asset/all-omitted release is valid runtime input but cannot satisfy this playback acceptance gate.

## Review disposition

The latest review was verified against current `main` and the prior HPA-610 plan.

- **F1 shared validated-release chain:** accepted with a boundary correction. The full integrity chain is shared, but the loader lives under `apps/web` because browser fetch/cache/timeout orchestration is not a stories-contract concern.
- **F2 Task 4 has no runnable verification:** accepted. `playwright.config.ts` ignores `visual-novel-deployed.spec.ts`; the new pure anchor helper is added to `test:release-gate-config`, while `test:e2e` is explicitly only broad regression coverage.
- **F3 first-load rules belong in pure helpers:** accepted, then narrowed by the Safari fix. Only `pendingSfxAfterTransition` (suppress immediate playback while first load is pending) was added to `sfx-transition.ts`; `bgm-transition.ts` is unchanged. The originally proposed `sfxCommandOnInitialRelease` / `bgmKeyOnInitialRelease` completion helpers were removed because replaying on release completion calls `HTMLAudioElement.play()` outside the user gesture that caused the transition, which WebKit rejects. ReaderShell drops queued SFX and does not start BGM on release completion.
- **F4 duplicate identity shape:** accepted. `RuntimeReleaseIdentity` backs both visual and audio; `VisualReleaseIdentity` remains an alias to avoid churn.
- **F5 resolver-first constructor order:** accepted. Players keep `createAudio` first and append `resolveUrl`, preserving existing tests.
- **F6 ambiguous unavailable warning:** accepted. `AudioCueResolution` carries a reason and the shell logs it; the player warning becomes generic rather than incorrectly calling every miss unknown.

The prior correction remains unchanged and has been widened: HPA-604 initial/restored SFX remains a no-op and is never replayed merely because the first release load completed, and the first accepted release no longer replays any SFX queued during the load or starts armed BGM. Both were dropped after the Safari/WebKit fix — replaying on release completion calls `HTMLAudioElement.play()` outside the user gesture, which WebKit rejects. The reader proceeds silently; the next eligible user gesture plays SFX/BGM normally once `audioInitialLoadPending` is false.

## Self-review checklist

Before merging implementation:

- [ ] Visual and audio both call the same web `loadValidatedRelease` integrity chain.
- [ ] Manifest checksum comparison occurs before manifest parsing for both media.
- [ ] `@aquila/stories/runtime-assets` contains no new browser fetch orchestration.
- [ ] Only one remote story-id constant exists.
- [ ] One `RuntimeReleaseIdentity` shape backs visual + audio evidence.
- [ ] Valid zero-asset audio release exposes identity and resolves cues as absent.
- [ ] Audio unavailable reasons distinguish release-not-loaded, cue-not-in-release, local-cue-missing, and shell runtime-unavailable.
- [ ] Existing createAudio-only player tests do not gain `undefined` resolver churn.
- [ ] Initial/restored SFX remains silent.
- [ ] First-load completion drops queued SFX and does not start BGM (Safari fix — no `play()` outside the user gesture).
- [ ] Pure transition test covers `pendingSfxAfterTransition` initial-load SFX suppression.
- [ ] ReaderShell holds no `pendingInitialSfx` state across the release-load boundary.
- [ ] ReaderShell holds no second runtime generation counter.
- [ ] A real-player shell test proves type-qualified runtime URLs reach `createAudio`.
- [ ] Soft revalidation never directly plays audio.
- [ ] Normal dialogue progression does not revalidate audio.
- [ ] Both-disabled initial state makes no remote audio load.
- [ ] `test:release-gate-config` executes new Task 4 code.
- [ ] `test:e2e` is not misrepresented as deployed-gate coverage.
- [ ] No cross-package import from `packages/e2e` into `apps/web` is introduced.
- [ ] No AudioManager, persisted audio store/cache, graph prefetcher, new verifier, or second gate suite is added.
- [ ] Linear HPA-610 remains In Progress after merge until live preview verifier + deployed gate evidence passes.