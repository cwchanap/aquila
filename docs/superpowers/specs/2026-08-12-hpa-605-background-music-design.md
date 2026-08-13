# HPA-605 Persistent Background Music and Audio Settings

Date: 2026-08-12
Status: Proposed planning refinement of the accepted Linear scope

## Goal

Extend Aquila's just-landed visual-novel audio foundation with one persistent looping background-music channel and one independent persisted Background Music on/off preference.

The implementation stays local-fixture only. It proves authoring, compiler propagation, browser autoplay handling, persistent track selection across dialogue/scene changes, independent SFX/BGM controls, and clean reader lifecycle ownership without introducing production audio delivery or a general audio engine.

## Why HPA-605 Is the Next Actionable Ticket

HPA-604 is complete and merged in PR #53. HPA-605 is High priority, its only blocker was HPA-604, and it now directly unlocks HPA-606 (per-story audio plans) and contributes to HPA-610 (R2 audio resolution).

The other open audio tickets are downstream:

- HPA-606 is blocked by HPA-605.
- HPA-607 and HPA-608 are blocked by HPA-606.
- HPA-609 is downstream of the per-story plan contract.
- HPA-610 is blocked by HPA-605 and the publishing contract.
- HPA-611 is the final production-content execution ticket.

Implementing any of those first would either duplicate temporary cue authority or design production delivery before the local reader lifecycle is proven.

## Current Code Evidence

- `packages/stories/src/compiler/parse-scene.ts` already has a strict pending-metadata pattern for `sfx`: one fenced block is consumed by the next dialogue entry, duplicate pending metadata fails, and EOF-unconsumed metadata fails.
- `packages/stories/src/audio-cues.ts` is the temporary HPA-604 cue authority and is already documented as a bootstrap seam to be replaced by HPA-606.
- `packages/stories/src/compiler/ir.ts`, `packages/stories/src/types.ts`, and `packages/stories/src/compiler/emit.ts` are the existing IR -> runtime payload -> generated-scene path.
- `apps/web/src/components/ReaderShell.svelte` already owns stable story/scene/index state, Visual/Text mode transitions, SFX playback, and visual-runtime lifecycle across responsive leaf remounts.
- `ReaderShell` retains one structured `LinePosition`, so BGM command application can share the same position-change effect instead of introducing a second navigation tracker.
- `apps/web/src/lib/audio/sfx-player.ts`, `sfx-catalog.ts`, and `sfx-preference.ts` establish small native-browser, local-catalog, and persisted-preference seams. BGM can stay parallel without generalizing them into an audio framework.
- `ReaderSettingsMenu.svelte` already renders a Visual-only SFX toggle and receives state/callbacks from `ReaderShell`.
- `apps/web/scripts/build-sfx-fixtures.ts` already provides deterministic PCM-16 fixture generation and verification. HPA-605 is the second audio-fixture consumer, which is enough justification to extract only the WAV synthesis/verification helper while keeping SFX and BGM fixture definitions separate.
- The web workspace already has `test:coverage`, and repository Codecov policy requires at least 95% project and patch coverage.

## Design Options

### Option A — Parallel BGM seam on the existing ReaderShell lifecycle (recommended)

Add strict `bgm` authoring, one `bgm?: string | null` runtime command field, a small local BGM catalog/player/preference, and BGM selection state in `ReaderShell`.

Pros:

- directly reuses the proven HPA-604 ownership boundary;
- minimum new concepts;
- keeps SFX and BGM behavior independently testable;
- HPA-610 can later replace only URL resolution;
- HPA-606 can later replace only bootstrap cue validation.

Cons:

- SFX and BGM remain separate small modules rather than sharing a generalized channel abstraction.

This is the right trade-off for two channels with meaningfully different behavior.

### Option B — Generalize SFX and BGM behind an `AudioManager`

Create a channel registry/mixer that owns SFX and BGM together.

Rejected for HPA-605. With one one-shot channel and one looping channel, the manager would mostly wrap two already-small implementations while forcing common lifecycle vocabulary before voice/ambience/mixing requirements exist.

### Option C — Scene-level BGM metadata

Attach BGM directly to scene definitions rather than line-level commands.

Rejected. It cannot express an in-scene music change or explicit silence at a precise dialogue beat, and it makes choice-driven flow boundaries less natural than the accepted next-dialogue command syntax.

## Product Decisions

| Concern | Decision |
| --- | --- |
| Playback owner | `ReaderShell`, never `VisualNovelReader` |
| Browser API | Native `HTMLAudioElement` only |
| Runtime concurrency | One looping BGM element, independent from one-shot SFX |
| Story payload | `bgm?: string | null` |
| `undefined` | No command; retain selected track |
| `string` | Select/start that logical BGM key |
| `null` | Explicit stop; clear selected track |
| Authoring stop token | Reserved literal `stop`, compiled to `null` |
| HPA-605 cue authority | Temporary two-key `@aquila/stories` allowlist |
| Long-term cue authority | HPA-606 per-story `audio-plan.json` |
| Runtime URL resolution | One local web BGM catalog module |
| Preference | Independent persisted BGM boolean using `getBrowserStorage()` |
| Settings visibility | SFX and BGM toggles appear only while Settings is in Visual mode |
| Autoplay | Initial commands arm only; playback starts after an eligible user gesture |
| Track persistence | Shell remembers the selected key across dialogue/scene changes |
| History reconstruction | None; only explicit commands mutate the remembered track |
| Fixtures | Two deterministic local PCM-16 loops: calm and tension |
| Story demonstration | Exactly three early commands: calm start, tension change, explicit stop |
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

`stop` is reserved syntax and is not an asset key.

Export the BGM values/type from `@aquila/stories` so the compiler and local web catalog share the same bootstrap authority.

As with SFX, this allowlist is intentionally temporary. HPA-606 replaces membership checks with each story's `docs/audio-plan.json`; no compatibility layer is required.

Keep runtime `DialogueEntry.bgm` open as `string | null | undefined`, not `BgmCueKey`, so runtime/test payloads remain tolerant while generated content is compile-validated.

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

- body is exactly one lowercase hyphenated logical key or the reserved `stop` token;
- no URL, file path, prompt, provider/model identifier, volume, duration, fade, or channel metadata is allowed;
- non-`stop` keys must be in `BGM_CUE_KEYS`;
- only one BGM block may be pending; a second pending block fails rather than overwriting the first;
- pending BGM at EOF fails rather than being silently dropped;
- `bg`, `sfx`, and `bgm` may all be pending and may all apply to the same next dialogue entry;
- pending BGM is consumed by the next emitted dialogue entry, including default-speaker narration;
- entries without a BGM command emit no `bgm` field;
- a `stop` command emits `bgm: null` explicitly.

Add `bgm?: string | null` to `DialogueEntryIR` and runtime `DialogueEntry`. `emitSceneFile` must test `e.bgm !== undefined` so explicit `null` is not accidentally omitted.

Do not change the unrelated visual `bg` authoring behavior.

## BGM Playback Boundary

Add two focused web modules under `apps/web/src/lib/audio/`:

```ts
export interface BgmPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}
```

and:

```ts
export const LOCAL_BGM_CATALOG = {
  'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
  'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} satisfies Record<BgmCueKey, string>;
```

The player owns one native audio element at a time and keeps its own current logical key only to suppress duplicate restarts.

`play(cueKey)`:

1. resolve the key through the local BGM catalog;
2. unknown runtime keys log one concise diagnostic and return;
3. if the same key is already playing/requested, return without restarting;
4. otherwise stop/reset the previous element;
5. create the native audio element, set `loop = true`, and request playback;
6. contain synchronous throws and rejected `play()` promises;
7. on rejected playback, clear the current element/key so a later eligible user gesture can retry.

`stop()` pauses and rewinds best-effort, clears the current element/key, and never changes reader state.

`dispose()` stops once and makes the player inert.

Do not add crossfade, fade timers, a channel registry, a mixer, Web Audio API nodes, or shared media-framework types.

## ReaderShell BGM State

`ReaderShell` owns:

```ts
const bgmPlayer = createBgmPlayer();
let bgmEnabled = $state(readBgmEnabled());
let selectedBgmKey: string | null = $state(null);
let bgmActivated = $state(false);
```

Use the existing position-change effect. After the shell updates `lastActivePosition` and handles SFX:

1. if the story changed, stop BGM, clear `selectedBgmKey`, and reset `bgmActivated`;
2. read the destination entry's `bgm` property;
3. if it is `undefined`, do nothing;
4. if it is `null`, clear `selectedBgmKey` and stop immediately;
5. if it is a string, set `selectedBgmKey` to that key;
6. if Visual mode, BGM enabled, and `bgmActivated` are all true, call `bgmPlayer.play(key)`.

This intentionally differs from SFX transition classification. SFX is a one-shot event and must distinguish genuine forward progression. BGM is persistent state: an explicit destination command may select/stop a track regardless of how that destination was reached, while destinations with no command leave the current track untouched.

### No history reconstruction

HPA-605 does not reconstruct historical BGM state by traversing the story graph, browser history, or previous scenes.

On a fresh/restored shell:

- a BGM command on the current line is armed but not autoplayed;
- a current line with no BGM command starts silent until a later authored command;
- ordinary in-session dialogue and scene transitions persist the selected track correctly.

This is the smallest deterministic behavior that satisfies the accepted local-runtime scope without introducing route-state reconstruction for branching stories.

## User Activation and Autoplay

Do not call `play()` during initial shell observation.

Treat these as eligible activation gestures while Visual mode is active and the reader is not blocked:

- pointer down inside the stable `reader-ready` subtree;
- Enter/Space keydown inside that subtree;
- explicitly enabling BGM from the settings toggle.

Attach the Visual reader activation handler at the stable shell-owned `reader-ready` element instead of adding audio-specific props to `VisualNovelReader`. This catches the first tap that merely skips typewriter text as well as normal Continue/choice/Act-panel interactions, and it survives responsive leaf remounts.

On eligible activation:

1. set `bgmActivated = true`;
2. if BGM is enabled and `selectedBgmKey` exists, call `bgmPlayer.play(selectedBgmKey)`.

Entering Text mode stops BGM and resets `bgmActivated`; the selected key remains armed. Returning to Visual mode does not autoplay. The next eligible Visual interaction resumes the selected track.

Disabling BGM stops immediately and resets `bgmActivated`. Re-enabling BGM is itself an explicit user gesture, so it may set `bgmActivated = true` and resume the selected key immediately when Visual mode is active.

Story replacement stops, clears selection, and resets activation. Shell destroy disposes the player.

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

- default enabled when absent;
- read/write exceptions are swallowed;
- no generic preference store;
- `ReaderShell` owns reactive `bgmEnabled`;
- `ReaderSettingsMenu` receives `bgmEnabled` and `onBgmEnabledChange`.

Keep both audio controls inside the existing `mode === 'visual'` block. Add no audio controls to the mobile Text hamburger.

Add English and Traditional Chinese strings for Background Music, On, and Off.

## Deterministic Local BGM Fixtures

HPA-605 is the second consumer of deterministic WAV synthesis, so extract only the reusable PCM helper from `build-sfx-fixtures.ts` into:

```text
apps/web/scripts/audio-fixture.ts
```

It owns:

- 8 kHz mono PCM-16 WAV encoding;
- deterministic sample synthesis;
- structural RIFF/WAVE verification.

Keep the existing SFX fixture definition in `build-sfx-fixtures.ts` and verify its committed bytes remain unchanged.

Add:

```text
apps/web/scripts/build-bgm-fixtures.ts
```

with exactly two short deterministic loop fixtures:

- `public/assets/vn/audio/bgm/dawn-apartment.wav`
- `public/assets/vn/audio/bgm/tension-pulse.wav`

Use simple integer-cycle synthetic tones so the clips are tiny and loop without a large endpoint discontinuity. Audio fidelity is not the goal; they only need to be distinct, deterministic, structurally valid, and browser-decodable.

Add `build:bgm-fixtures` and `verify:bgm-fixtures` scripts and run `verify:bgm-fixtures` beside the existing SFX/visual fixture verification in CI.

## Narrow Story Demonstration

Annotate exactly three existing early Seventh Mirror beats and no more:

1. `chapter_1/act1.md`: start `dawn-apartment` before the opening phone-screen narration.
2. `chapter_1/act4.md`: switch to `tension-pulse` at the first sustained suspicious/tension beat around the sleep-program timeline/phone-call turn.
3. `chapter_1/act4.md`: author `stop` when that short tension demonstration resolves or before the next major location transition.

This is fixture proof, not a complete sound-direction pass. HPA-607 owns the full story audit.

## Error Handling

### Compile-time authoring failures

Compilation fails for:

- empty/malformed/multi-token BGM blocks;
- keys outside `BGM_CUE_KEYS`;
- a second BGM block while another is pending;
- pending BGM left unconsumed at EOF.

### Runtime playback failures

Runtime remains best-effort:

- unknown runtime key: concise logger diagnostic, no reader error;
- broken/missing local URL: contained;
- synchronous `play()` throw: contained;
- rejected `play()` promise: contained and retryable on a later activation;
- pause/rewind failure: contained;
- localStorage unavailable: default preference keeps the reader usable.

No user-facing audio error UI is added.

## Testing Strategy

### Story compiler

Cover:

- start/change/stop command consumption;
- explicit/default-speaker narration;
- `bg + sfx + bgm` on the same next entry;
- omission when unauthored;
- explicit `bgm: null` emission for stop;
- empty/malformed/multi-token/unknown key failures;
- duplicate pending failure;
- EOF pending failure.

### BGM player

Cover:

- catalog hit creates/starts a looping element;
- same key does not restart;
- new key pauses/rewinds/replaces the previous element;
- stop clears the active element;
- unknown runtime key logs and returns;
- synchronous and rejected `play()` failures are contained;
- rejected playback can retry later;
- dispose is idempotent and makes the player inert.

### Preference/settings

Cover:

- BGM defaults enabled;
- persisted false/true round-trips;
- unavailable/throwing storage falls back safely;
- Visual settings show independent SFX/BGM toggles with correct `aria-pressed`;
- BGM click calls `onBgmEnabledChange` with the inverse value;
- Text settings show neither audio toggle.

### ReaderShell lifecycle

Cover:

- initial line BGM command arms without calling `play()`;
- first eligible Visual pointer/keyboard activation starts the selected track;
- ordinary cue-less line advancement does not restart;
- same-key authored command does not restart;
- a new key switches once;
- explicit stop clears once;
- scene transition with no BGM command retains the selected track;
- responsive remount does not restart;
- Text mode stops and requires fresh Visual activation;
- disabling stops immediately;
- re-enabling from the Visual settings gesture may resume selected BGM;
- SFX remains independent while BGM plays;
- story replacement clears/stops;
- destroy disposes once;
- playback failures do not block navigation.

### Fixture verification

Cover:

- existing SFX committed bytes stay deterministic after helper extraction;
- both BGM files pass RIFF/WAVE, PCM-16, mono, non-empty data verification;
- committed BGM bytes equal generated bytes.

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

1. fresh Visual load with an opening BGM cue stays silent;
2. first reader interaction starts the calm loop;
3. advance through several cue-less lines and a scene transition without restart;
4. reach the tension command and hear one direct track switch;
5. reach `stop` and hear silence;
6. verify SFX still plays independently;
7. disable/enable BGM and SFX independently;
8. switch Visual -> Text -> Visual and confirm no automatic replay before the next eligible Visual interaction;
9. cross the responsive breakpoint and confirm the current track does not restart;
10. reload on a non-command line and confirm the reader remains silent rather than inventing historical BGM state.

## YAGNI / KISS Boundaries

Do not add:

- a generic audio manager, channel registry, mixer, or event/timeline system;
- Web Audio API graphs;
- crossfades, fades, ducking, stems, ambience, or voice channels;
- volume sliders or per-line audio metadata;
- route/history-based BGM reconstruction;
- persisted current-track/session audio state;
- R2/audio-manifest resolution;
- ElevenLabs/provider integration;
- per-story audio-plan schema;
- Phaser desktop parity;
- a story-wide audio pass;
- compatibility aliases for future HPA-606/HPA-610 contracts.

## Follow-on Boundaries

- HPA-606 replaces bootstrap SFX/BGM cue membership with per-story `audio-plan.json` validation and authoring/review guidance.
- HPA-607 performs the complete Seventh Mirror audio audit.
- HPA-608 generates candidate audio offline.
- HPA-609 publishes immutable audio releases.
- HPA-610 replaces local catalog URL resolution with the R2 runtime audio release resolver.
- HPA-611 performs the production content release workflow.
