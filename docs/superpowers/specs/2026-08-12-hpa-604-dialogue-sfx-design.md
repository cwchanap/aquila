# HPA-604 Dialogue-Triggered SFX

Date: 2026-08-12
Status: Accepted in Linear; revised after two planning reviews

## Goal

Add Aquila's first narrow visual-novel audio slice: story Markdown can attach one logical SFX cue to the next dialogue entry, the compiler rejects invalid HPA-604 cue authoring, and the web visual-novel reader plays that cue once on genuine forward progression.

This remains a local-fixture foundation. It proves authoring, compiler propagation, stable reader lifecycle ownership, native browser playback, one persisted on/off preference, and navigation-safe playback without introducing production audio delivery or a general audio engine.

## Why HPA-604 Is the Next Actionable Ticket

HPA-604 has no blockers and is the foundation for HPA-605 (persistent BGM), HPA-606 (per-story audio plans and authoring workflow), and HPA-610 (R2 audio resolution). Implementing a downstream ticket first would duplicate lifecycle work or force broader abstractions before the one-shot behavior is proven.

## Current Code Evidence

- `packages/stories/src/compiler/parse-scene.ts` already supports fenced `bg` blocks with pending metadata consumed by the next emitted dialogue entry.
- Unknown speakers already fail compilation. Unknown expressions only warn because the visual pipeline has a base-portrait fallback. SFX has no equivalent authoring fallback, so invalid cue authoring must fail loudly.
- `packages/stories/src/compiler/ir.ts`, `packages/stories/src/types.ts`, and `packages/stories/src/compiler/emit.ts` are the existing IR -> runtime payload -> generated scene path.
- `apps/web/src/components/ReaderShell.svelte` already owns the stable active story/scene/index lifecycle across responsive leaf remounts and Text/Visual mode changes.
- `ReaderManager.goToScene()` is shared by normal scene navigation, choices, and Act-panel navigation; browser history restores state through `loadIntent(..., 'popstate')`. Therefore a raw position change is not sufficient evidence that the user advanced normally.
- `VisualNovelReader`'s History button opens `VisualBacklog`, which is read-only for the current scene. The navigable scene-jump surface is `ActPanel`.
- `apps/web/src/lib/reader-mode.ts` exports `getBrowserStorage()`. The visual asset runtime already reuses it.
- `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts` owns the required-prop render helper for the shared settings menu.
- `apps/web/scripts/build-visual-fixtures.ts` and `verify-visual-fixtures.ts` establish the repository pattern for reproducible checked-in fixtures plus structural verification.
- `.github/workflows/unit-tests.yml` runs `apps/web` with `bun run test:coverage`, and `codecov.yml` requires 95% project and patch coverage.
- `apps/web/src/lib/logger.ts` is the existing non-user-facing diagnostic seam.
- The Phaser audio path in `packages/game` is a separate runtime and remains out of scope.

## Product Decisions

| Concern | Decision |
| --- | --- |
| Playback owner | `ReaderShell`, never `VisualNovelReader` |
| Browser API | Native `HTMLAudioElement` only |
| Runtime concurrency | One current one-shot element |
| Story payload | `sfx?: string` |
| HPA-604 cue authority | Temporary three-key `@aquila/stories` allowlist |
| Long-term cue authority | HPA-606 per-story `audio-plan.json` |
| Runtime URL resolution | One local web catalog module |
| Preference | One persisted boolean using `getBrowserStorage()` |
| Settings visibility | SFX control appears only while Settings is in Visual mode |
| Forward playback | Same-scene `index + 1`, or direct forward flow edge to destination index 0 |
| Rewinds/jumps | Silent |
| Fixtures | Three deterministic synthetic PCM WAV files |
| Coverage | Final web verification runs `test:coverage` |

## Bootstrap Cue Contract

Add a tiny stories-package cue module for this ticket only:

```ts
export const SFX_CUE_KEYS = [
  'door-open',
  'notification-beep',
  'impact',
] as const;

export type SfxCueKey = (typeof SFX_CUE_KEYS)[number];

export function isSfxCueKey(value: string): value is SfxCueKey {
  return (SFX_CUE_KEYS as readonly string[]).includes(value);
}
```

Export the values/type from `@aquila/stories` so the compiler and local web catalog share the same bootstrap key set.

This is intentionally not the long-term authoring source of truth. HPA-606 introduces per-story `docs/audio-plan.json` and compiler validation against those plans. HPA-606 should replace the bootstrap membership check without compatibility work.

Keep runtime `DialogueEntry.sfx` as `string`, not `SfxCueKey`. Generated HPA-604 content is compile-validated, while hand-built/test/future runtime payloads remain tolerant.

## Authoring Contract

A fenced `sfx` block applies to exactly the next emitted dialogue entry:

````markdown
```sfx
door-open
```

**旁白**：澪推開悠真的房門。
````

Rules:

- body is one logical cue key; never a URL, path, prompt, provider/model identifier, volume, delay, or channel;
- key must be one of `SFX_CUE_KEYS`;
- empty, malformed, whitespace-separated/multi-token, unsupported capitalization, and unknown keys fail compilation;
- only one SFX block may be pending; a second pending block fails rather than overwriting a lost one-shot;
- pending SFX at EOF fails rather than being silently dropped;
- `bg` and `sfx` may both be pending and both apply to the same next dialogue entry;
- pending SFX is consumed by the next emitted dialogue entry, including default-speaker narration;
- entries without SFX emit no `sfx` field;
- no alternate syntax or compatibility alias is added.

`bg` keeps its current behavior. HPA-604 does not retroactively tighten background duplicate/EOF behavior because background prompts have a different IR-to-resolution lifecycle.

Add `sfx?: string` to `DialogueEntryIR` and runtime `DialogueEntry`. `emitSceneFile` emits `sfx` only when present.

## Web Audio Boundary

Add a small web-only player seam under `apps/web/src/lib/audio/`:

```ts
export interface SfxPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}
```

The default implementation owns at most one native audio element.

`play(cueKey)`:

1. stop/rewind the current one-shot;
2. resolve the logical key through the local catalog;
3. if the runtime key is unknown, log one concise diagnostic and return;
4. create the native audio element;
5. call `play()`;
6. contain both synchronous throws and rejected play promises.

`stop()` contains pause/rewind failures, releases the current reference, and never affects reader state. `dispose()` stops once and makes the player inert.

Unknown runtime keys are silent from the player's perspective: no banner, toast, blocked progression, or thrown error. Logging is diagnostic only.

The local catalog is explicit and type-linked:

```ts
import type { SfxCueKey } from '@aquila/stories';

export const LOCAL_SFX_CATALOG = {
  'door-open': '/assets/vn/audio/sfx/door-open.wav',
  'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
  impact: '/assets/vn/audio/sfx/impact.wav',
} satisfies Record<SfxCueKey, string>;
```

HPA-604 does not reuse the image-specific `WebAssetResolver`; that resolver indexes `RuntimeAssetManifestV1` visual assets and owns image-release behavior. HPA-610 already specifies a specialized audio resolver parallel in purpose to the visual resolver. The HPA-604 boundary is simply that all local URL resolution is isolated in this one catalog module, so HPA-610 can replace that seam without changing story Markdown or reader components.

## Reproducible Local SFX Fixtures

Create one committed script:

```text
apps/web/scripts/build-sfx-fixtures.ts
```

It supports both build and verify modes:

```text
bun --filter web build:sfx-fixtures
bun --filter web verify:sfx-fixtures
```

Build mode writes exactly three deterministic synthetic WAV files:

- `door-open.wav`
- `notification-beep.wav`
- `impact.wav`

Use 8 kHz, mono, PCM-16 RIFF/WAVE. The clips are deliberately synthetic and tiny; fidelity is secondary to distinctness and a valid browser-decodable container.

Verify mode reads the committed files and asserts at minimum:

- `RIFF` container marker;
- `WAVE` format marker;
- `fmt ` chunk exists and reports PCM format 1;
- one channel;
- 16 bits per sample;
- `data` chunk exists and has non-zero sample bytes.

Add `build:sfx-fixtures` and `verify:sfx-fixtures` scripts to `apps/web/package.json`. Add `bun --filter web verify:sfx-fixtures` beside the existing visual-fixture verification step in `build-and-lint.yml`.

Annotate only three existing Seventh Mirror beats:

- foot-to-floor impact in `chapter_1/act1.md` -> `impact`;
- Yuma bedroom door opening in `chapter_1/act1.md` -> `door-open`;
- phone ringing in `chapter_1/act4.md` -> `notification-beep`.

Broader sound direction belongs to HPA-607.

## One Structured Line-Position Tracker

Do not keep the opaque NUL-joined line key for one subsystem and introduce a second SFX tracker for another. Replace the shell's current `lastActiveLineKey` representation with one structured position:

```ts
export type LinePosition = {
  storyId: string;
  sceneId: string;
  index: number;
};
```

`ReaderShell` retains exactly one previous `LinePosition | null`. Both visual revalidation and SFX transition classification consume that same previous/current pair.

Use a pure helper:

```ts
export type SfxCommand =
  | { type: 'play'; cueKey: string }
  | { type: 'stop' }
  | { type: 'noop' };

export function nextSfxCommand(
  previous: LinePosition | null,
  next: LinePosition,
  cueKey: string | undefined,
  options: {
    mode: ReaderMode;
    enabled: boolean;
    flow: StoryFlowConfig | null;
  }
): SfxCommand;
```

No `prime` command is needed. The first observation returns `noop`; the shell stores it as the baseline.

### Forward-progression rule

A cue is eligible to play only when all of these hold:

- previous and next belong to the same story;
- Visual mode is active;
- SFX is enabled;
- the destination line has a cue;
- the transition is a genuine forward adjacency.

Forward adjacency is either:

1. same scene and `next.index === previous.index + 1`; or
2. different scene, `next.index === 0`, and the active flow contains a direct edge from `previous.sceneId` to `next.sceneId`.

The direct flow-edge check supports both:

- a scene node whose `next` is the destination scene; and
- a scene node whose `next` is a choice node with `nextByOption` containing the destination scene.

Therefore normal linear scene progression and an actual user choice remain legitimate forward scene transitions and may play the destination cue. This preserves HPA-604's accepted "later real line or scene transition" behavior.

The following are silent:

- initial/restored line;
- unchanged position;
- same-scene backward movement;
- same-scene index jumps greater than one;
- reverse browser-history movement;
- non-adjacent Act-panel scene jumps;
- arbitrary same-story scene jumps not connected by a direct flow edge.

A story replacement returns `stop` and primes the replacement position silently through the shell's normal state update.

The current History backlog does not navigate, so opening/closing it is an unchanged-position `noop`. Act-panel navigation is the scene-jump case that requires explicit coverage.

This structural rule intentionally does not add a second transition-reason store to `ReaderManager` or `readerState`. A direct Act-panel jump to the immediately adjacent flow node is structurally indistinguishable from normal progression and may play; distinguishing identical destination transitions by UI origin would require new orchestration state that is not justified for HPA-604.

## ReaderShell Integration

The single shell progression effect should:

1. construct `nextPosition` from `storyId`, `currentSceneId`, and `dialogueIndex`;
2. compare it with `lastActivePosition`;
3. return immediately when unchanged;
4. store the new position exactly once;
5. preserve existing visual `softRevalidate()` behavior for real line/scene position changes while Visual runtime is active;
6. call `nextSfxCommand(previous, next, dialogue[dialogueIndex]?.sfx, { mode, enabled, flow })`;
7. execute only `play` or `stop` side effects.

Mode/preference lifecycle stays explicit:

- Visual -> Text stops immediately;
- Text -> Visual does not replay the current position;
- disabling SFX persists `false` and stops immediately;
- re-enabling does not replay the current position;
- shell destroy disposes the player.

A cue-less forward line does not automatically stop the current one-shot. A later cue replaces it.

Inject `createSfxPlayer` through `ReaderShell` in the same style as `createVisualRuntime`; do not introduce a global audio singleton.

## Preference and Settings

Add one small preference module that imports the existing storage helper:

```ts
import { getBrowserStorage } from '@/lib/reader-mode';
```

Contract:

```ts
export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';
export function readSfxEnabled(
  storage: Storage | null = getBrowserStorage()
): boolean;
export function writeSfxEnabled(
  enabled: boolean,
  storage: Storage | null = getBrowserStorage()
): void;
```

Semantics:

- default enabled when absent;
- read/write exceptions are swallowed;
- no generic preference store;
- `ReaderShell` owns reactive `sfxEnabled`;
- `ReaderSettingsMenu` receives `sfxEnabled` and `onSfxEnabledChange`.

The shared settings component exists in desktop Text mode too, but SFX playback is Visual-only. Therefore render the SFX control only when `mode === 'visual'`:

```svelte
{#if mode === 'visual'}
  <!-- Sound Effects toggle -->
{/if}
```

Do not add the control to the mobile Text hamburger.

`ReaderSettingsMenu.test.ts` directly owns toggle semantics and visibility:

- Visual mode shows the toggle with correct `aria-pressed`;
- click calls `onSfxEnabledChange` with the inverse value;
- Text mode omits the toggle.

Add English and Traditional Chinese translation strings.

## Error Handling

### Compile-time authoring failures

Compilation fails for:

- empty/malformed/multi-token SFX blocks;
- keys outside `SFX_CUE_KEYS`;
- a second SFX block while another is pending;
- pending SFX left unconsumed at EOF.

### Runtime playback failures

Runtime remains best-effort:

- unknown runtime key: concise logger diagnostic, no playback, no reader error;
- broken/missing URL: contained;
- synchronous `play()` throw: contained;
- rejected `play()` promise: contained;
- pause/rewind failure: contained;
- localStorage unavailable: session remains usable with the default preference.

No user-facing audio error UI is added.

## Testing Strategy

### Story compiler

Cover:

- next-entry consumption;
- explicit/default-speaker narration;
- `bg + sfx` on the same next entry;
- omission when unauthored;
- empty/malformed/multi-token/unknown key failures;
- duplicate pending failure;
- EOF pending failure;
- emitter presence/omission.

### Pure transition helper

Table-test:

- first observation -> `noop`;
- identical position -> `noop`;
- same-scene `+1` Visual/enabled/cued -> `play`;
- same-scene backward -> `noop`;
- same-scene forward jump `+2` or more -> `noop`;
- same-story direct linear flow edge to index 0 -> `play`;
- same-story direct choice flow edge to index 0 -> `play`;
- non-adjacent Act-panel scene jump -> `noop`;
- reverse scene transition -> `noop`;
- Text/disabled/uncued forward transition -> `noop`;
- story replacement -> `stop`.

### Player/preference

Cover:

- catalog hit creates and starts one element;
- second cue pauses/rewinds/replaces the first;
- unknown runtime key logs and returns;
- rejected `play()` promise is contained;
- synchronous `play()` throw is contained;
- pause throwing during stop/replacement is contained;
- stop/dispose cleanup;
- preference default/read/write/storage failures.

### ReaderSettingsMenu

Cover new required props, Visual-only rendering, `aria-pressed`, and callback behavior.

### ReaderShell

Keep integration coverage small:

- initial observation does not play; one real forward line delegates one cue;
- responsive remount keeps one injected player and does not replay;
- a non-adjacent Act-panel jump does not play;
- Visual -> Text stops;
- disabling SFX stops;
- story replacement stops and replacement line stays silent;
- destroy disposes.

Pure helper tests own the transition matrix.

## Verification

Focused tests are run during implementation tasks. Final verification must include the same coverage mode CI uses:

```bash
bun --filter @aquila/stories test
bun --filter web test:coverage
bun --filter web verify:sfx-fixtures
bun run compile:check
bun run lint
bun run build
```

`test:coverage` replaces a redundant final plain `web test` run and directly exercises the repository's 95% Codecov project/patch gate.

Manual smoke:

1. load the fixture path in Visual mode; initial/restored line is silent;
2. advance normally to the three authored cues and hear each once;
3. move backward within a scene and confirm no cue replays;
4. use browser Back to return to an earlier position and confirm no cue replays;
5. use the Act panel to jump to a non-adjacent previously read scene and confirm no cue replays;
6. make a real choice/linear scene advance and confirm an authored destination cue can play;
7. open/close History/settings and cross the responsive breakpoint without replay;
8. disable SFX during playback and confirm it stops immediately;
9. reload and confirm muted preference persists;
10. re-enable and confirm current line does not replay;
11. switch to Text and confirm the SFX control is absent and later cues remain silent.

## Non-Goals

- BGM, ambience, voice, crossfades, mixers, ducking, spatial audio, overlap, per-cue volume, delay, or channels
- ElevenLabs/API generation or credentials
- per-story `audio-plan.json` schema or usage reporting (HPA-606)
- R2 audio manifests, release pointers, publishing, CDN resolution, or production activation
- modifying the visual `WebAssetResolver` into a generic media resolver
- Phaser/game-runtime parity
- generic timeline/event infrastructure
- new reader navigation-reason state solely for audio
- story-wide SFX direction or authoring-skill updates
- user-facing audio diagnostics, analytics, or telemetry

## Follow-On Boundary

HPA-605 may add a persistent BGM channel beside this one-shot seam. HPA-606 replaces the bootstrap three-key compiler membership check with provider-neutral per-story `audio-plan.json` validation and usage reporting. HPA-610 replaces the local URL-resolution seam with its dedicated validated audio-release resolver while preserving shell-owned playback. None of those later concerns need broader abstractions in HPA-604.
