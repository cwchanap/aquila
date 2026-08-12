# HPA-604 Dialogue-Triggered SFX

Date: 2026-08-12  
Status: Accepted in Linear; refined against current `main`

## Goal

Add Aquila's first narrow visual-novel audio slice: a story author can attach one logical SFX cue to the next dialogue entry, and the web visual-novel reader plays that cue once when the active line genuinely changes.

This is intentionally a local-fixture foundation. It proves authoring, compiler propagation, reader lifecycle ownership, native browser playback, and a persisted on/off preference without introducing production audio delivery or a general audio engine.

## Why HPA-604 Is the Next Actionable Ticket

HPA-604 has no blockers and is the foundation for HPA-605 (persistent BGM), HPA-606 (audio authoring workflow), and HPA-610 (R2 audio resolution). Implementing a downstream ticket first would either duplicate this lifecycle work or force a broader abstraction before the one-shot SFX behavior is proven.

## Current Code Evidence

- `packages/stories/src/compiler/parse-scene.ts` already supports a fenced `bg` block with "pending metadata for the next emitted dialogue" semantics. SFX can reuse that simple parser shape.
- `packages/stories/src/compiler/ir.ts`, `packages/stories/src/types.ts`, and `packages/stories/src/compiler/emit.ts` form the existing IR -> runtime `DialogueEntry` -> generated-scene path.
- `apps/web/src/components/ReaderShell.svelte` already owns stable `storyId + sceneId + dialogueIndex` identity across responsive leaf remounts and owns the Text/Visual mode transition.
- `ReaderShell` already performs story-runtime cleanup on replacement and component destruction, so it is the correct lifecycle owner for one-shot audio too.
- `apps/web/src/components/ReaderSettingsMenu.svelte` is the existing shared settings surface in Visual mode.
- `apps/web/src/lib/reader-mode.ts` demonstrates the project's deliberately small, failure-tolerant localStorage preference pattern.
- There is no existing web `HTMLAudioElement` abstraction to reuse. The Phaser/game audio path is a separate runtime and is out of scope.

## Considered Approaches

### 1. Shell-owned one-shot player — chosen

`ReaderShell` observes stable line identity and delegates logical cue keys to a tiny injectable SFX player. This directly solves replay safety across typewriter updates, settings/history overlays, visual-runtime status updates, and responsive leaf remounts.

Advantages:

- reuses the lifecycle boundary already proven by the visual reader;
- requires no new global store or event bus;
- keeps browser audio concerns out of story/compiler packages;
- gives HPA-605 a concrete lifecycle seam to build on later.

### 2. Play inside `VisualNovelReader` — rejected

The visual leaf is remounted at responsive boundaries and is deliberately not the stable progression owner. Tying audio to its mount/reactivity would make duplicate playback prevention harder and couple audio to presentation details.

### 3. General audio manager/event bus — rejected

A mixer/channel/event architecture would anticipate BGM, ambience, voice, volume, ducking, and production delivery before those requirements are implemented. HPA-604 only needs one one-shot channel and three local fixture cues.

## Authoring Contract

A fenced `sfx` block applies to exactly the next emitted dialogue entry:

````markdown
```sfx
door-open
```

**旁白**：澪推開悠真的房門。
````

The compiler stores only the trimmed logical cue key.

Rules:

- the value is not a URL, path, prompt, provider/model identifier, volume, delay, or channel;
- the compiler does not validate the cue against the web catalog, because authoring and runtime asset availability are separate concerns;
- the key must be non-empty after trimming;
- the pending key is consumed by the next emitted dialogue entry, including default-speaker narration, then cleared;
- an entry without an `sfx` block emits no `sfx` property, preserving existing generated output shape;
- no compatibility alias or alternative syntax is added.

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

The default implementation uses native `HTMLAudioElement`/`Audio` and a static local catalog. It owns at most one current audio element.

`play(cueKey)` behavior:

1. stop and rewind any currently owned effect;
2. resolve `cueKey` from the local catalog;
3. if the cue is unknown, return quietly;
4. create/start the native audio element;
5. catch both synchronous playback errors and rejected `play()` promises so reading never fails because audio failed.

`stop()` pauses and rewinds the current element and releases the current reference. `dispose()` performs the same cleanup and makes the player inert for the destroyed shell.

The public player contract remains logical-key based. `ReaderShell` never sees file paths or future R2 URLs.

## Local Catalog and Fixture Audio

Keep the first catalog static and explicit, for example under `apps/web/src/lib/audio/sfx-catalog.ts`, with three logical keys:

- `door-open`
- `notification-beep`
- `impact`

Map them to three small checked-in fixture audio files under `apps/web/public/assets/vn/audio/sfx/`. These files are development/demo fixtures, not production content and not an ElevenLabs output contract.

Use ordinary browser-supported files and keep them small. Do not add an asset manifest, preload system, service worker policy, cache abstraction, or R2 resolution in this ticket.

For a manual end-to-end demonstration, annotate a few early story beats rather than broadly sound-designing the story. The existing Seventh Mirror chapter 1 already contains a natural door-open beat in `chapter_1/act1.md` and a phone-ring/notification beat in `chapter_1/act4.md`. Add only the minimum authored lines needed to demonstrate the three catalog cues; the broader story-wide audio audit belongs to HPA-607.

## ReaderShell Playback State Machine

Keep SFX progression state in `ReaderShell`, separate from the visual leaf.

Track the last observed story and line identity. On the first active payload, prime the identity and stay silent. This also covers a restored/bookmarked initial line.

On later changes:

- **same story, scene/index changed, Visual mode, SFX enabled:** if the new entry has `sfx`, call `player.play(cueKey)` exactly once;
- **same story, scene/index changed, Text mode:** update the remembered identity but do not play;
- **story replacement:** stop the current effect, prime the replacement story's current line, and do not autoplay that first replacement line;
- **Visual -> Text:** stop immediately;
- **Text -> Visual:** do not replay the current line;
- **disable SFX:** persist the preference and stop immediately;
- **re-enable SFX:** do not replay the current line; the next real line transition may play;
- **responsive remount, typewriter completion, visual-status change, settings/history open/close, ordinary rerender:** no line-identity change, therefore no playback;
- **shell destroy:** dispose the player.

A line without an SFX cue does not stop an already-playing one-shot merely because dialogue advanced. A later cue replaces it, and the explicit lifecycle transitions above stop it. This follows the accepted "new cue replaces the previous one-shot" behavior without turning line advancement into a hidden global stop rule.

## Preference and Settings

Add one failure-tolerant persisted boolean, following `reader-mode.ts` rather than adding a preference store.

Recommended semantics:

- key: `aquila:sfx-enabled:v1`;
- default: enabled when no value exists;
- storage read/write exceptions are swallowed;
- `ReaderShell` owns the reactive `sfxEnabled` value;
- `ReaderSettingsMenu` receives the current value and one change callback;
- render one translated toggle/button with `aria-pressed` or equivalent accessible checked state.

Because SFX is Visual-mode-only and the shared settings menu is present at every Visual breakpoint, this ticket does not modify the separate mobile Text hamburger merely to expose an audio control while audio is inactive.

Add English and Traditional Chinese reader translation strings for the SFX control/status.

## Error Handling

Audio is strictly best-effort:

- unknown cue: no playback, no reader error;
- missing/broken fixture URL: native playback/load failure is contained by the player;
- autoplay rejection: contained by the player;
- stop/rewind failure: contained by the player;
- localStorage unavailable: default preference remains usable for the session.

Do not surface toast/banner/error UI for SFX failures in HPA-604. Reading, choices, navigation, bookmarks, and visual assets continue unaffected.

## Testing Strategy

### Story compiler

Extend existing compiler tests to prove:

- `sfx` applies to exactly the next dialogue entry;
- it is consumed for both explicit-speaker and default-speaker narration;
- existing entries without SFX remain unchanged;
- empty keys are rejected;
- generated scene output includes `sfx` only when authored.

### Web unit tests

Add focused SFX player/preference tests for:

- catalog hit starts one native element;
- a second cue pauses/rewinds/replaces the first;
- unknown cue is quiet;
- rejected `play()` does not escape;
- stop/dispose cleanup;
- preference default/read/write and storage-failure behavior.

### ReaderShell component tests

Extend the existing `ReaderShell.test.ts` harness with an injectable fake player and cover:

- initial/restored line stays silent;
- Visual line advancement plays one authored cue once;
- typewriter/rerender/overlay activity does not replay;
- responsive remount does not replay;
- Text mode never plays;
- Visual -> Text stops;
- disabled -> enabled does not replay the current line;
- story replacement stops and primes the new story silently;
- destroy disposes the player.

Keep these assertions at the shell boundary; do not add audio behavior tests to `VisualNovelReader` because it does not own playback.

## Verification

Automated:

```bash
bun --filter @aquila/stories test
bun --filter web test
bun run compile:check
bun run lint
bun run build
```

Manual smoke in the web reader:

1. load a fixture scene in Visual mode and confirm the initial line is silent;
2. advance to door, notification/beep, and impact cues and hear each once;
3. open/close settings/history and cross the responsive breakpoint without replay;
4. disable SFX during playback and confirm it stops immediately;
5. reload and confirm the muted preference persists;
6. re-enable and confirm the current line does not replay;
7. switch to Text and confirm later authored cues remain silent.

## Non-Goals

- BGM, ambience, voice, crossfades, mixers, ducking, spatial audio, overlap, per-cue volume, delay, or channels
- ElevenLabs/API generation or credentials
- R2 audio manifests, release pointers, publishing, CDN resolution, or production activation
- Phaser/game-runtime parity
- generic timeline/event infrastructure
- story-wide SFX direction or authoring-skill updates
- analytics or telemetry for audio playback

## Follow-On Boundary

HPA-605 may add a persistent BGM channel and BGM preferences beside this proven SFX seam. HPA-606 may formalize authoring guidance. HPA-610 may replace the local catalog's URL-resolution source with validated per-story R2 audio releases. None of those later concerns need to be represented in HPA-604 beyond keeping the shell-to-player API logical-key based.
