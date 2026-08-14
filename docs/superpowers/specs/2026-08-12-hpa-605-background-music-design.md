# HPA-605 Persistent Background Music and Audio Settings

Date: 2026-08-12
Status: Revised after review; ready for implementation-plan review

## Goal

Extend Aquila's HPA-604 visual-novel audio foundation with one persistent looping background-music channel and one independent persisted Background Music on/off preference.

The implementation remains local-fixture only. It proves strict line-authored BGM commands, compiler propagation, deterministic in-session selection, useful current-scene restore behavior, browser autoplay handling, independent SFX/BGM controls, and stable `ReaderShell` ownership without introducing production audio delivery or a general audio engine.

## Why HPA-605 Is the Next Actionable Ticket

HPA-604 is complete and merged in PR #53. HPA-605 is High priority, its only blocker was HPA-604, and it directly unlocks HPA-606 while also being a prerequisite for HPA-610.

The remaining audio roadmap stays downstream:

- HPA-606 replaces bootstrap cue allowlists with per-story audio plans.
- HPA-607 performs the complete Seventh Mirror audio-direction pass.
- HPA-608 generates reviewable candidates offline.
- HPA-609 publishes immutable audio releases.
- HPA-610 replaces local catalog URLs with the production runtime resolver.
- HPA-611 performs the production content release workflow.

## Current Code Evidence

- `packages/stories/src/compiler/parse-scene.ts` already has the exact strict pending-metadata shape needed for `bgm`: fenced SFX metadata is consumed by the next dialogue entry, duplicate pending SFX fails, and EOF-unconsumed SFX fails.
- `packages/stories/src/audio-cues.ts` is the existing temporary compile-time cue authority and is intentionally replaced by HPA-606 later.
- `packages/stories/src/compiler/ir.ts`, `packages/stories/src/types.ts`, and `packages/stories/src/compiler/emit.ts` are the existing IR -> runtime payload -> generated-scene path.
- `apps/web/src/components/ReaderShell.svelte` already owns stable story/scene/index state, Visual/Text mode transitions, SFX playback, and visual-runtime lifecycle across responsive leaf remounts.
- `apps/web/src/lib/audio/sfx-transition.ts` already defines `LinePosition`, `sameLinePosition`, and the structural `isForwardAdjacent` rule used to distinguish normal progression from jumps.
- `apps/web/src/lib/reader-state.svelte.ts` confirms `readerState.dialogue` is the runtime payload for the currently loaded scene, so scanning backward inside that already-loaded array is local state inspection, not story-graph/history reconstruction.
- `VisualNovelReader.svelte` handles its primary Enter/Space path from `<svelte:window onkeydown={handleKeydown}>`; a keydown targeted at `document.body` never bubbles through the `reader-ready` subtree.
- `apps/web/src/lib/audio/sfx-player.ts`, `sfx-catalog.ts`, and `sfx-preference.ts` establish the small native-player, `string | undefined` catalog, and persisted-boolean seams BGM should mirror.
- `apps/web/scripts/build-sfx-fixtures.ts` contains reusable PCM encoding/verification plus generic build/verify loops that would otherwise be duplicated by a second fixture family.
- The web workspace already has `test:coverage`, and Codecov requires 95% project and patch coverage.

## Design Direction

Keep the original Option A: BGM remains parallel to SFX rather than generalized behind an audio manager.

The second review identified one useful simplification: separate **which BGM should be selected at this position** from **whether the browser is currently allowed to make sound**. Adopt that separation, but do not adopt the review's proposed rule that a cue-less destination always keeps the old selection. That would reintroduce stale looping music on non-adjacent cross-scene jumps—the defect the prior review correctly prevented.

The resulting model is smaller than the previous five-rule playback-action matrix:

1. scan the destination scene backward to find the latest local BGM command at or before the current index;
2. when the destination scene itself answers with a key or stop, use that answer regardless of navigation origin;
3. when the destination scene has no local answer, retain an inherited selection only across genuine forward adjacency;
4. otherwise clear the inherited selection on non-forward movement because the correct cross-scene history is unknowable without graph/history reconstruction;
5. keep autoplay activation as separate shell-owned imperative state.

This preserves both important properties:

- reload/backward/jump behavior can recover a track when the current scene itself contains enough information;
- a cue-less non-adjacent jump cannot blindly leak an unrelated old loop into another scene/chapter.

## Product Decisions

| Concern | Decision |
| --- | --- |
| Playback owner | `ReaderShell`, never `VisualNovelReader` |
| Browser API | Native `HTMLAudioElement` only |
| Runtime concurrency | One looping BGM element, independent from one-shot SFX |
| Story payload | `bgm?: string \| null` |
| `undefined` in dialogue | No authored command on that dialogue entry |
| `string` in dialogue | Select/start that logical BGM key |
| `null` in dialogue | Explicit stop; clear selected track |
| Catalog miss | `undefined`, matching SFX; `null` is reserved for authored stop semantics |
| Authoring stop token | Reserved literal `stop`, compiled to `null` |
| HPA-605 cue authority | Temporary two-key `@aquila/stories` allowlist |
| Long-term cue authority | HPA-606 per-story `audio-plan.json` |
| Runtime URL resolution | One local BGM catalog module |
| Preference | Independent persisted BGM boolean using `getBrowserStorage()` |
| Settings visibility | SFX and BGM toggles appear only while Settings is in Visual mode |
| Autoplay | Initial/restored selection arms only; sound begins after an eligible user gesture |
| Local restore | Scan only the current loaded scene backward to the current line |
| Forward inheritance | Cue-less genuine forward adjacency keeps the inherited selected key |
| Non-forward fallback | If current-scene scan finds no answer, cue-less non-forward movement clears the inherited selection |
| Historical reconstruction | No traversal of browser history or prior story scenes; no persisted selected-track session state |
| Pointer activation | `reader-ready` subtree only |
| Keyboard activation | Window-level Enter/Space path, matching the existing visual reader's keyboard routing |
| Fixtures | Two deterministic local PCM-16 loops: calm and tension |
| Story demonstration | Exactly three pinned early commands: calm start, tension change, explicit stop |
| Coverage | Final web verification uses `test:coverage` |

## Bootstrap Cue Contract

Extend `packages/stories/src/audio-cues.ts` with a second small bootstrap allowlist:

```ts
export const BGM_CUE_KEYS = [
  'dawn-apartment',
  'tension-pulse',
] as const;

export type BgmCueKey = (typeof BGM_CUE_KEYS)[number];

export function isBgmCueKey(value: string): value is BgmCueKey {
  return (BGM_CUE_KEYS as readonly string[]).includes(value);
}
```

`stop` is reserved syntax, not an asset key.

Export the BGM values/type from `@aquila/stories` so the compiler and local web catalog share the same temporary authority.

HPA-606 later replaces this membership check directly; no compatibility layer is required.

Keep runtime `DialogueEntry.bgm` open as `string | null | undefined`, not `BgmCueKey`, just as runtime `DialogueEntry.sfx` remains open while generated content is compile-validated.

## Authoring Contract

A fenced `bgm` block applies to exactly the next emitted dialogue entry:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

A stop command uses the reserved token:

````markdown
```bgm
stop
```

**旁白**：房間重新安靜下來。
````

Rules:

- body is exactly one lowercase hyphenated logical key or `stop`;
- URLs, file paths, prompts, provider/model identifiers, volume, duration, fade, and channel metadata are invalid;
- non-`stop` keys must be in `BGM_CUE_KEYS`;
- only one BGM block may be pending; a second pending block fails;
- pending BGM at EOF fails rather than being silently dropped;
- `bg`, `sfx`, and `bgm` may all be pending and apply to the same next dialogue entry;
- pending BGM is consumed by the next emitted dialogue entry, including default-speaker narration;
- entries without a BGM command emit no `bgm` field;
- `stop` emits `bgm: null` explicitly.

Add `bgm?: string | null` to `DialogueEntryIR` and runtime `DialogueEntry`.

`emitSceneFile` must use an explicit undefined check:

```ts
if (e.bgm !== undefined) {
  parts.push(`bgm: ${e.bgm === null ? 'null' : q(e.bgm)}`);
}
```

Do not use a truthiness check because it would drop the explicit `null` stop command.

Do not change unrelated visual `bg` behavior.

## Local BGM Catalog and Player

Add `apps/web/src/lib/audio/bgm-catalog.ts`:

```ts
import type { BgmCueKey } from '@aquila/stories';

export const LOCAL_BGM_CATALOG = {
  'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
  'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} satisfies Record<BgmCueKey, string>;

export function resolveLocalBgmUrl(cueKey: string): string | undefined {
  return (LOCAL_BGM_CATALOG as Readonly<Record<string, string>>)[cueKey];
}
```

Keep the absent encoding identical to `resolveLocalSfxUrl`. `null` exists only in the authored dialogue contract where it means stop.

Add `apps/web/src/lib/audio/bgm-player.ts`:

```ts
export interface BgmPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}
```

The player owns one native audio element and one internal current key.

`play(cueKey)`:

1. resolve through the local catalog;
2. unknown runtime key logs one concise diagnostic and returns;
3. same key already playing/requested returns without restart;
4. new key stops/resets the previous element;
5. create native audio, set `loop = true`, request playback;
6. contain synchronous throws and rejected promises;
7. rejected playback clears the player's current element/key so a later user gesture can retry.

`stop()` pauses/rewinds best-effort and clears the player's internal key.

`dispose()` is idempotent, stops once, and makes the player inert.

Do not add crossfades, fade timers, Web Audio nodes, a mixer, channel registry, or shared media framework.

## Pure BGM Selection

Create `apps/web/src/lib/audio/bgm-transition.ts`, but make it a **selection helper**, not a playback/action matrix.

### 1. Current-scene scan

```ts
export function activeBgmAt(
  entries: readonly DialogueEntry[],
  index: number
): string | null | undefined {
  for (let i = Math.min(index, entries.length - 1); i >= 0; i -= 1) {
    const command = entries[i]?.bgm;
    if (command !== undefined) return command;
  }
  return undefined;
}
```

This is intentionally limited to the already-loaded current scene. It does not traverse predecessor scenes, choice history, browser history, or persisted navigation.

It immediately improves several real cases:

- restore on a later Act 1 line finds the opening `dawn-apartment` command and arms it;
- moving backward within Act 4 to a line after `tension-pulse` restores that local selection;
- moving to a line after the local `stop` returns `null` and remains silent;
- a jump into a scene/index that already contains a local command uses that local command rather than the source scene's old music.

### 2. Safe inherited-selection fallback

Export the existing `isForwardAdjacent` from `sfx-transition.ts` without changing its implementation.

Add:

```ts
export function nextBgmSelection(
  previous: LinePosition | null,
  next: LinePosition,
  entries: readonly DialogueEntry[],
  selectedKey: string | null,
  flow: StoryFlowConfig | null
): string | null {
  const local = activeBgmAt(entries, next.index);
  if (local !== undefined) return local;

  if (!previous) return null;
  if (previous.storyId !== next.storyId) return null;
  if (isForwardAdjacent(previous, next, flow)) return selectedKey;
  return null;
}
```

Why retain the final structural fallback instead of adopting `undefined => keep` universally:

- a cue-less non-adjacent Act-panel jump provides no evidence that the old scene's loop is correct for the destination;
- a backward jump before the first local command cannot reconstruct whatever track was inherited from a prior scene;
- keeping the old key in those cases would be deterministic but can be deterministically wrong;
- clearing is the safer YAGNI behavior until a future requirement justifies persisted audio session state or graph/history reconstruction.

Direct linear/choice progression remains forward adjacency and keeps inherited music when the destination scene has no local command.

The helper does **not** receive `mode`, `enabled`, or `activated`; those are playback-permission concerns, not selection concerns.

## ReaderShell State and Playback Diff

`ReaderShell` owns one player and one persisted preference:

```ts
const bgmPlayer = createBgmPlayer();
let bgmEnabled = $state(readBgmEnabled());
```

The selected key and autoplay activation do not render UI and do not need to be reactive runes:

```ts
let selectedBgmKey: string | null = null;
let bgmActivated = false;
```

Keeping them as plain component-local variables prevents the position effect from subscribing to values it writes through.

Use the existing position-change effect and existing `lastActivePosition` tracker.

For each genuine position change:

1. build `nextPosition`;
2. preserve the existing visual revalidation and SFX behavior;
3. detect story replacement; stop old BGM, clear selection, and reset `bgmActivated` before evaluating the new story;
4. compute `nextSelected = nextBgmSelection(previous, nextPosition, dialogue, selectedBgmKey, activeFlow)`;
5. compare old selection with `nextSelected`;
6. assign the plain `selectedBgmKey` variable;
7. if selection changed from a key to `null`, stop;
8. if selection changed to a key and `bgmActivated` is true, call `bgmPlayer.play(nextSelected)`;
9. otherwise do nothing; the existing element continues.

The player itself still suppresses duplicate-key restarts as defense in depth.

No mode/enabled/activated values participate in selection calculation.

### Story replacement

Story replacement is a lifecycle boundary, not a navigation-shape case:

- stop the old BGM immediately;
- clear old selection;
- reset `bgmActivated`;
- scan the new story's current loaded scene;
- a local string may arm the new key, but it cannot autoplay until a new eligible gesture;
- a cue-less new scene remains silent.

## User Activation and Autoplay

Never call `play()` during initial/restored observation.

### Pointer

Keep pointer activation scoped to the stable `reader-ready` subtree:

```svelte
<div
  data-testid="reader-ready"
  onpointerdown={activateBgm}
>
```

This activates only from the actual reader surface, not from unrelated window controls such as opening Settings.

### Keyboard

The reader's normal Enter/Space path is window-level, so BGM keyboard activation must also be window-level:

```svelte
<svelte:window onkeydown={handleBgmActivationKey} />
```

Do **not** attach `onkeydown` only to `reader-ready`; a keydown targeted at `document.body` reaches `window` but never bubbles through that subtree.

`handleBgmActivationKey` should match the meaningful reader keyboard shape:

- Visual mode only;
- reader not blocked;
- key is Enter or Space;
- no Alt/Ctrl/Meta/Shift modifiers;
- skip buttons, links, choices, Settings controls, and other targets recognized by `isReaderInteractiveTarget`.

A Space press in a non-interactive scroll region is still a genuine user gesture and may unlock audio even if that particular Space is consumed for native scrolling; this is harmless and avoids duplicating child-private dialogue-body state.

`activateBgm()`:

1. sets plain `bgmActivated = true`;
2. if BGM is enabled and `selectedBgmKey` exists, calls `bgmPlayer.play(selectedBgmKey)`.

### Mode and preference lifecycle

Entering Text mode:

- stop BGM;
- set `bgmActivated = false`;
- retain `selectedBgmKey`.

Returning to Visual mode does not autoplay; the next eligible Visual gesture resumes the retained selection.

Disabling BGM:

- persist false;
- stop immediately;
- set `bgmActivated = false`;
- retain selection.

Re-enabling BGM from the Visual Settings toggle is itself an explicit user gesture and may:

- persist true;
- set `bgmActivated = true`;
- play the retained selected key immediately.

Shell destroy disposes the player.

## Preference and Settings

Add `apps/web/src/lib/audio/bgm-preference.ts` parallel to SFX:

```ts
export const BGM_ENABLED_KEY = 'aquila:bgm-enabled:v1';

export function readBgmEnabled(
  storage: Storage | null = getBrowserStorage()
): boolean;

export function writeBgmEnabled(
  enabled: boolean,
  storage: Storage | null = getBrowserStorage()
): void;
```

Semantics:

- default enabled;
- read/write exceptions swallowed;
- no generic preference registry;
- `ReaderShell` owns reactive `bgmEnabled`;
- `ReaderSettingsMenu` receives required `bgmEnabled` and `onBgmEnabledChange` props.

Keep SFX and BGM controls in the existing Visual-only Settings block. Add no audio controls to the mobile Text hamburger.

Add English and Traditional Chinese copy for Background Music / On / Off.

## Deterministic Local Audio Fixtures

HPA-605 is the second deterministic WAV consumer, so extract the reusable fixture mechanics from `build-sfx-fixtures.ts` into:

```text
apps/web/scripts/audio-fixture.ts
```

The helper owns both the PCM mechanics and the now-duplicated file loops:

```ts
export const AUDIO_FIXTURE_SAMPLE_RATE = 8_000;

export function synthPcm16Wav(
  durationMs: number,
  sampleAt: (timeSeconds: number, progress: number) => number
): Buffer;

export function verifyPcm16Wav(name: string, bytes: Buffer): void;

export async function buildAudioFixtures(
  outputRoot: string,
  fixtures: Readonly<Record<string, Buffer>>
): Promise<void>;

export async function verifyAudioFixtures(
  outputRoot: string,
  fixtures: Readonly<Record<string, Buffer>>
): Promise<void>;

export async function runAudioFixtureCli(
  build: () => Promise<void>,
  verify: () => Promise<void>
): Promise<void>;
```

`runAudioFixtureCli` only selects build vs `--verify`; each script still owns its own `if (import.meta.main)` entrypoint.

Refactor `build-sfx-fixtures.ts` to use these helpers without changing any SFX bytes.

Add `build-bgm-fixtures.ts` with exactly two 2-second, 8 kHz, mono PCM-16 loops:

- `dawn-apartment.wav`: 220 Hz + 330 Hz components;
- `tension-pulse.wav`: 110 Hz + 165 Hz components.

These frequencies complete integer cycle counts in two seconds, giving deterministic test loops without introducing DSP/crossfade machinery.

Add `build:bgm-fixtures` and `verify:bgm-fixtures` package scripts and run BGM verification beside the existing visual/SFX fixture verification in CI.

## Narrow Seventh Mirror Demonstration

Add exactly three BGM commands and no story-wide pass.

### Act 1 calm start

Immediately before the existing opening line:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

### Act 4 tension change

Immediately before the existing line:

````markdown
```bgm
tension-pulse
```

**朝倉澪**：兩週前。悠真收到學校轉發的「關東青少年睡眠支援計畫」通知。
````

### Act 4 stop

Immediately before the exact current source line:

````markdown
```bgm
stop
```

**旁白**：澪點頭。琴音走出咖啡店的時候，下午的陽光從門口斜進來，把她的影子拉得很長，像一條安靜的尾巴。
````

Leave the existing Act 4 `notification-beep` SFX untouched so this content also demonstrates SFX/BGM independence.

HPA-607 owns complete sound direction.

## Error Handling

### Compile time

Fail for:

- empty/malformed/multi-token BGM blocks;
- unknown BGM keys;
- duplicate pending BGM;
- EOF-unconsumed BGM.

### Runtime

Best-effort and non-blocking:

- unknown runtime key: concise logger diagnostic;
- broken/missing local URL: contained;
- synchronous `play()` throw: contained;
- rejected `play()` promise: contained and retryable on later activation;
- pause/rewind failure: contained;
- localStorage unavailable: default preference keeps reader usable.

No user-facing audio error UI.

## Testing Strategy

### Compiler

Cover:

- start/change/stop next-entry consumption;
- explicit/default-speaker narration;
- `bg + sfx + bgm` together;
- omission when unauthored;
- literal `bgm: null` emission;
- malformed/unknown/duplicate/EOF failures.

### BGM player/catalog/preference

Cover:

- catalog miss returns `undefined`;
- loop flag;
- duplicate-key suppression;
- key replacement;
- stop/dispose;
- unknown key logging;
- synchronous/rejected `play()` containment;
- retry after rejection;
- persisted preference and throwing/null storage.

### Pure BGM selection

Keep this smaller than the previous action matrix. Test selection only:

- `activeBgmAt` returns nearest prior string;
- `activeBgmAt` returns nearest prior `null` stop;
- `activeBgmAt` returns `undefined` before any local command;
- restored later line with local prior command selects that command;
- cue-less same-scene/direct-scene forward adjacency retains inherited selection;
- direct choice edge retains inherited selection;
- non-forward cue-less jump with no local answer clears;
- non-forward jump with a local destination answer uses that local answer;
- story replacement with no local answer clears;
- story replacement with a local answer arms that answer.

No mode/enabled/activation cases belong in this pure helper.

### ReaderShell wiring/lifecycle

Cover:

- initial local selection arms without playback;
- pointerdown on `reader-ready` activates;
- **keyboard Enter/Space dispatched from `document.body`** activates through the window handler;
- ArrowDown/modifier/interactive-target keyboard events do not activate;
- ordinary forward movement does not restart same selection;
- local selection change plays once when activated;
- local stop stops;
- non-forward cue-less jump clears and later activation cannot resurrect stale key;
- non-forward destination with a local prior command selects that local key;
- Text mode stop/resume-on-new-gesture;
- disable/re-enable semantics;
- responsive remount does not restart;
- story replacement stops and rearms without autoplay;
- SFX remains independent;
- destroy disposes once.

### Fixtures

Cover:

- SFX bytes unchanged after helper extraction;
- generic build/verify helpers write/verify all provided files;
- both BGM files are deterministic RIFF/WAVE PCM-16 mono with non-empty data.

### Real generated output

After adding the three real story commands, compile and assert the committed generated scenes literally contain:

```text
bgm: "dawn-apartment"
bgm: "tension-pulse"
bgm: null
```

This is a cheap end-to-end compiler -> generated-payload assertion before the final manual smoke.

## Verification

```bash
bun --filter @aquila/stories test
bun --filter web test:coverage
bun --filter web verify:sfx-fixtures
bun --filter web verify:bgm-fixtures
bun run compile:check
bun run lint
bun run build
```

Manual smoke with headphones:

1. fresh Visual load at Act 1 line 0 stays silent;
2. pointer interaction starts `dawn-apartment`;
3. reload on a later Act 1 line: current-scene scan arms `dawn-apartment`, then the first eligible gesture starts it;
4. Enter/Space from normal keyboard focus starts/resumes BGM through the window-level handler;
5. ordinary forward lines/direct scene edge keep the loop without restart;
6. cue-less non-adjacent jump to a scene with no local answer stops/clears stale BGM;
7. a destination with an earlier local command selects that local command rather than the source scene's old key;
8. Act 4 tension line switches once to `tension-pulse`;
9. the existing `notification-beep` SFX overlays independently;
10. the pinned `stop` line becomes silent;
11. BGM/SFX toggles persist independently;
12. Visual -> Text stops; Text -> Visual does not autoplay; next eligible Visual gesture resumes retained selection;
13. responsive breakpoint remount does not restart;
14. fresh restore in a scene with no local BGM command remains silent rather than traversing earlier scenes/history.

## YAGNI / KISS Boundaries

Do not add:

- generic `AudioManager`, channel registry, mixer, or event/timeline framework;
- new navigation-reason state solely for audio;
- Web Audio graph;
- crossfades, fades, ducking, stems, ambience, or voice;
- volume sliders or per-line volume metadata;
- graph/history-based BGM reconstruction;
- persisted current-track/session audio state;
- R2/audio-manifest resolution;
- ElevenLabs/provider integration;
- per-story audio-plan schema;
- Phaser desktop parity;
- story-wide BGM/SFX direction;
- compatibility aliases for HPA-606/HPA-610.

## Review Disposition

The second review is addressed as follows:

- **F1 partially accepted:** adopt `activeBgmAt` current-scene scanning and separate selection from autoplay permission; reject `undefined => keep` for all navigation because it reintroduces stale-loop leakage on non-forward cue-less cross-scene jumps.
- **F2 accepted with narrower pointer scope:** keyboard activation moves to `window`; pointer activation stays on `reader-ready` so opening unrelated Settings controls does not start music.
- **F3 accepted:** keyboard test dispatches Enter/Space from `document.body`, matching the real visual-reader route.
- **F4 accepted:** selected key and activation become plain local variables; mode/enabled/activated leave the selection helper.
- **F5 accepted:** extract generic fixture build/verify loops and the tiny CLI selector alongside PCM helpers.
- **F6 accepted:** Task 6 includes literal assertions against generated Act 1/Act 4 payloads before final manual smoke.
