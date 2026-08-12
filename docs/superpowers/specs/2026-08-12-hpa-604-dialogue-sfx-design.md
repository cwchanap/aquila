# HPA-604 Dialogue-Triggered SFX

Date: 2026-08-12  
Status: Accepted in Linear; revised after planning review

## Goal

Add Aquila's first narrow visual-novel audio slice: a story author can attach one logical SFX cue to the next dialogue entry, the compiler rejects malformed or unknown HPA-604 cue keys, and the web visual-novel reader plays the cue once when the active line genuinely changes.

This remains a local-fixture foundation. It proves authoring, compiler propagation, stable reader lifecycle ownership, native browser playback, and one persisted on/off preference without introducing production audio delivery or a general audio engine.

## Why HPA-604 Is the Next Actionable Ticket

HPA-604 has no blockers and is the foundation for HPA-605 (persistent BGM), HPA-606 (per-story audio plans and authoring workflow), and HPA-610 (R2 audio resolution). Implementing a downstream ticket first would either duplicate this lifecycle work or force a broader abstraction before the one-shot behavior is proven.

## Current Code Evidence

- `packages/stories/src/compiler/parse-scene.ts` already supports a fenced `bg` block with pending metadata consumed by the next emitted dialogue entry.
- Unknown speakers already fail compilation in `parse-scene.ts`; malformed SFX authoring should follow that fail-loud authoring contract.
- `packages/stories/src/compiler/validate.ts` warns for unknown expressions because a base portrait fallback exists. SFX has no equivalent authoring fallback, so an HPA-604 cue typo should not silently compile.
- `packages/stories/src/compiler/ir.ts`, `packages/stories/src/types.ts`, and `packages/stories/src/compiler/emit.ts` form the existing IR -> runtime `DialogueEntry` -> generated-scene path.
- `apps/web/src/components/ReaderShell.svelte` already owns one stable `${storyId}\u0000${currentSceneId}\u0000${dialogueIndex}` identity across responsive leaf remounts. HPA-604 must reuse that identity rather than create a second SFX-specific line tracker.
- `ReaderShell` already owns Text/Visual mode changes, story-runtime replacement, and destruction cleanup.
- `apps/web/src/components/ReaderSettingsMenu.svelte` is the existing shared Visual settings surface, and `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts` has a required-prop render helper that must evolve with the component contract.
- `apps/web/src/lib/reader-mode.ts` exports `getBrowserStorage()`. The visual asset runtime already reuses it, so SFX preference code should do the same instead of duplicating browser-storage access.
- There is no existing web `HTMLAudioElement` abstraction to reuse. Phaser `AudioContext` usage is a separate runtime and remains out of scope.

## Considered Approaches

### 1. Shell-owned one-shot player with a pure transition helper — chosen

`ReaderShell` continues to own the single active-line identity it already tracks. A pure helper classifies the transition and returns an SFX command; the shell performs the side effect through an injected player.

Advantages:

- one line-identity machine instead of parallel visual/SFX trackers;
- transition combinatorics are table-testable without a large Svelte component matrix;
- the visual leaf remains presentation-only;
- browser audio stays out of story/compiler packages;
- no global store, event bus, mixer, or generic timeline is introduced.

### 2. Play inside `VisualNovelReader` — rejected

The visual leaf remounts at responsive boundaries and is deliberately not the stable progression owner. Playback there would make replay safety depend on component mount behavior.

### 3. General audio manager/event bus — rejected

A mixer/channel/event architecture anticipates BGM, ambience, voice, volume, ducking, and production delivery. HPA-604 only needs one one-shot channel and three local fixtures.

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

Export the values/type from `@aquila/stories` so both the compiler and web catalog depend on the same bootstrap key set.

This is intentionally **not** the long-term authoring source of truth. HPA-606 explicitly introduces per-story `docs/audio-plan.json` files and compiler validation against those plans. At that point the parser-level three-key membership check can be removed/replaced without compatibility work. HPA-604 does not implement any part of the audio-plan schema.

Keep runtime `DialogueEntry.sfx` typed as `string`, not `SfxCueKey`. Generated HPA-604 output will only contain validated keys, but the runtime boundary stays tolerant so HPA-610 can change URL resolution in one place and hand-built/test payloads with unknown keys still fail quietly.

## Authoring Contract

A fenced `sfx` block applies to exactly the next emitted dialogue entry:

````markdown
```sfx
door-open
```

**旁白**：澪推開悠真的房門。
````

Rules:

- the body is one logical key, never a URL, file path, prompt, provider/model identifier, volume, delay, or channel;
- the key must be one of `SFX_CUE_KEYS`;
- empty bodies, whitespace-separated/multi-token bodies, unknown keys, malformed `sfx` fences, and unsupported capitalization fail compilation;
- only one `sfx` block may be pending at a time; a second arrives before a dialogue entry is an authoring error rather than silently overwriting a lost cue;
- a pending SFX at end-of-file is an authoring error rather than a silently dropped cue;
- `bg` and `sfx` may both be pending and both apply to the same next dialogue entry;
- the pending SFX is consumed by the next emitted dialogue entry, including default-speaker narration, then cleared;
- an entry without an `sfx` block emits no `sfx` property;
- no compatibility alias or alternate syntax is added.

`bg` keeps its current behavior. This ticket does not retroactively tighten duplicate/unconsumed background blocks because background metadata has different semantics and doing so would be unrelated scope.

Add `sfx?: string` to `DialogueEntryIR` and runtime `DialogueEntry`. `emitSceneFile` emits `sfx: "..."` only when present.

## Web Audio Boundary

Add a small web-only module under `apps/web/src/lib/audio/`:

```ts
export interface SfxPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}
```

The default implementation uses native `HTMLAudioElement`/`Audio` and owns at most one current element.

`play(cueKey)` behavior:

1. stop and rewind any currently owned effect;
2. resolve `cueKey` from the local catalog;
3. if the runtime key is unknown, return quietly;
4. create/start the native audio element;
5. contain synchronous playback failures and rejected `play()` promises.

`stop()` pauses and rewinds the current element and releases the reference. `dispose()` performs the same cleanup and makes the player inert for the destroyed shell.

The shell-to-player contract remains logical-key based. `ReaderShell` never sees paths, future R2 URLs, or provider metadata.

## Local Catalog and Fixtures

Keep the web catalog static and explicit:

```ts
import type { SfxCueKey } from '@aquila/stories';

export const LOCAL_SFX_CATALOG = {
  'door-open': '/assets/vn/audio/sfx/door-open.wav',
  'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
  impact: '/assets/vn/audio/sfx/impact.wav',
} satisfies Record<SfxCueKey, string>;
```

The shared type makes a missing bootstrap catalog mapping a TypeScript error without making the compiler depend on `apps/web`.

Generate three tiny synthetic PCM WAV fixtures in the implementation task. They must contain valid RIFF/WAVE headers and 16-bit mono PCM samples, not merely non-empty bytes. Synthetic generation keeps licensing/provenance trivial and makes the fixtures reproducible.

Do not add an asset manifest, preload system, service worker policy, cache abstraction, or R2 resolver.

For the manual demonstration, annotate only three existing Seventh Mirror chapter-1 beats:

- foot-to-floor impact in `chapter_1/act1.md` -> `impact`;
- Yuma bedroom door opening in `chapter_1/act1.md` -> `door-open`;
- phone ringing in `chapter_1/act4.md` -> `notification-beep`.

Broader story-wide sound direction belongs to HPA-607.

## One Shared Line-Identity Machine

Do not add `sfxStoryId`, `sfxLineKey`, or another shell effect that independently primes and diffs line identity.

Keep the existing shell-owned key:

```ts
const activeLineKey =
  `${storyId}\u0000${currentSceneId}\u0000${dialogueIndex}`;
```

Extract the SFX decision into a pure helper:

```ts
export type SfxCommand =
  | { type: 'prime' }
  | { type: 'play'; cueKey: string }
  | { type: 'stop' }
  | { type: 'noop' };

export function nextSfxCommand(
  previousLineKey: string | null,
  nextLineKey: string,
  cueKey: string | undefined,
  options: { mode: ReaderMode; enabled: boolean }
): SfxCommand;
```

The helper uses the story-id prefix already embedded in the shell key:

- `previousLineKey === null` -> `prime`;
- identical key -> `noop`;
- different story-id prefix -> `stop` (the replacement story's first line is primed silently by the shell update);
- same story + changed line + Visual + enabled + cue -> `play`;
- otherwise -> `noop`.

`ReaderManager.applySession()` updates `storyId`, scene, index, and dialogue together when a replacement payload is applied, while replacement loading preserves the previous active payload. Therefore the existing shell key changes directly from old-story line to new-story line, allowing the helper to distinguish replacement from an in-story scene transition without another state machine.

The existing `ReaderShell` effect becomes the single progression observer:

1. compute `activeLineKey`;
2. retain the previous value;
3. update `lastActiveLineKey` once;
4. preserve the existing visual `softRevalidate()` behavior for a real line change;
5. obtain `nextSfxCommand(previous, active, currentCue, options)`;
6. call `player.play()` or `player.stop()` only for side-effect commands.

Mode/preference lifecycle remains explicit:

- Visual -> Text calls `player.stop()` immediately;
- Text -> Visual does not change line identity and therefore does not replay;
- disabling SFX persists `false` and calls `player.stop()` immediately;
- re-enabling does not change identity and therefore does not replay;
- shell destroy calls `player.dispose()`.

A cue-less in-story line does not automatically stop a currently playing one-shot. A later cue replaces it. This preserves the accepted one-shot replacement behavior.

## Preference and Settings

Add one small preference module that reuses browser storage:

```ts
import { getBrowserStorage } from '@/lib/reader-mode';
```

Recommended contract:

```ts
export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';
export function readSfxEnabled(storage: Storage | null = getBrowserStorage()): boolean;
export function writeSfxEnabled(
  enabled: boolean,
  storage: Storage | null = getBrowserStorage()
): void;
```

Semantics:

- default enabled when no value exists;
- read/write exceptions are swallowed;
- no generic preference store;
- `ReaderShell` owns reactive `sfxEnabled`;
- `ReaderSettingsMenu` receives `sfxEnabled` and `onSfxEnabledChange`;
- render one translated toggle/button with `aria-pressed`.

Update `ReaderSettingsMenu.test.ts`'s `renderSettings()` helper with the new required props and assert the toggle state/callback there. Keep only integration-level settings assertions in `ReaderShell.test.ts`.

Because SFX is Visual-only and the shared settings menu exists at every Visual breakpoint, do not add the control to the mobile Text hamburger.

## Error Handling

### Compile-time authoring failures

Compilation fails for:

- empty/malformed/multi-token `sfx` blocks;
- keys not in the HPA-604 bootstrap `SFX_CUE_KEYS`;
- a second `sfx` block while another is pending;
- pending SFX left unconsumed at EOF.

### Runtime playback failures

Runtime remains strictly best-effort:

- unknown runtime key: no playback, no reader error;
- missing/broken WAV URL: contained by the player/native element;
- autoplay rejection: contained by the player;
- stop/rewind failure: contained by the player;
- localStorage unavailable: default preference remains usable for the session.

Do not surface toast/banner/error UI for SFX failures.

## Testing Strategy

### Story compiler

Extend parser/emitter tests to prove:

- valid cue applies to exactly the next dialogue entry;
- explicit-speaker and default-speaker narration both consume it;
- `sfx` and `bg` both apply to the same next entry;
- entries without SFX remain unchanged;
- empty/malformed/multi-token keys fail;
- unknown key fails;
- consecutive unconsumed `sfx` blocks fail;
- pending SFX at EOF fails;
- generated scene output includes `sfx` only when authored.

### Pure transition helper

Use table-driven tests for:

- first observation -> `prime`;
- identical key -> `noop`;
- same-story line/scene transition with Visual+enabled cue -> `play`;
- same transition without cue -> `noop`;
- Text or disabled -> `noop`;
- story replacement -> `stop` even if the new line has a cue.

These tests own the progression combinatorics.

### Web player/preference

Focused tests cover:

- catalog hit starts one native element;
- second cue pauses/rewinds/replaces the first;
- unknown runtime key is quiet;
- rejected `play()` does not escape;
- stop/dispose cleanup;
- preference default/read/write/storage-failure behavior using the shared `getBrowserStorage()` default.

### Reader settings

`ReaderSettingsMenu.test.ts` covers:

- required SFX props in its render helper;
- `aria-pressed` reflects enabled/disabled state;
- click calls `onSfxEnabledChange` with the toggled value.

### ReaderShell integration

Keep the component matrix small. Cover only wiring that pure tests cannot prove:

- initial line does not call `play`, then a real Visual line advancement delegates one cue;
- injected player is not recreated by responsive remounts and unchanged identity does not replay;
- Visual -> Text and disabling SFX call `stop`;
- destroy calls `dispose`;
- story replacement integrates with the helper and stays silent for the replacement line.

Do not add audio tests to `VisualNovelReader`.

## Verification

Automated:

```bash
bun --filter @aquila/stories test
bun --filter web test
bun run compile:check
bun run lint
bun run build
```

Manual smoke:

1. load the fixture path in Visual mode and confirm the initial/restored line is silent;
2. advance to the three authored cues and hear each once;
3. open/close settings/history and cross the responsive breakpoint without replay;
4. disable SFX during playback and confirm it stops immediately;
5. reload and confirm the muted preference persists;
6. re-enable and confirm the current line does not replay;
7. switch to Text and confirm later authored cues remain silent.

## Non-Goals

- BGM, ambience, voice, crossfades, mixers, ducking, spatial audio, overlap, per-cue volume, delay, or channels
- ElevenLabs/API generation or credentials
- per-story `audio-plan.json` schema or usage reporting (HPA-606)
- R2 audio manifests, release pointers, publishing, CDN resolution, or production activation
- Phaser/game-runtime parity
- generic timeline/event infrastructure
- story-wide SFX direction or authoring-skill updates
- analytics or telemetry for audio playback

## Follow-On Boundary

HPA-605 may add a persistent BGM channel beside this one-shot seam. HPA-606 replaces the bootstrap three-key compiler membership check with provider-neutral per-story `audio-plan.json` validation and usage reporting. HPA-610 may replace the local catalog's URL-resolution source with validated per-story R2 audio releases. HPA-604 keeps those later concerns out of the implementation while leaving the shell-to-player runtime API as logical-key `string`.
