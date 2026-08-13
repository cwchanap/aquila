# HPA-605 Persistent Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add strict line-authored persistent BGM commands, one native looping browser channel, independent persisted BGM settings, deterministic local fixtures, and three narrow Seventh Mirror demonstration beats.

**Architecture:** Keep BGM parallel to HPA-604 SFX rather than introducing a shared audio manager. The compiler emits `bgm?: string | null` (`undefined` keep, string select, `null` stop); `ReaderShell` owns selected-track and user-activation state across responsive remounts, while a tiny `BgmPlayer` owns one native looping element and suppresses duplicate-key restarts.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Svelte 5, Vitest, native `HTMLAudioElement`, existing `@aquila/stories` compiler and translations.

## Global Constraints

- Native browser audio only; add no audio framework, Web Audio graph, mixer, channel registry, crossfade, ducking, volume slider, or adaptive-music system.
- Keep SFX and BGM independently controllable and independently testable.
- Story Markdown contains logical keys only; `stop` is reserved BGM syntax and compiles to `null`.
- HPA-605 uses exactly two bootstrap BGM keys: `dawn-apartment` and `tension-pulse`.
- HPA-606 will replace bootstrap cue membership with per-story `audio-plan.json`; do not add compatibility layers for that future contract.
- HPA-610 will replace local URL resolution; do not generalize the visual asset resolver or add R2 logic here.
- Initial/restored content must never autoplay. Playback begins only after an eligible Visual-reader/settings user gesture.
- Do not reconstruct historical BGM state by traversing browser history or the story graph.
- Exactly three existing early Seventh Mirror beats demonstrate calm start, tension change, and explicit stop; HPA-607 owns the full story audio pass.
- Final web verification uses `bun --filter web test:coverage` because patch/project coverage gates are 95%.

---

### Task 1: Add the strict BGM authoring and generated-payload contract

**Files:**
- Modify: `packages/stories/src/audio-cues.ts`
- Modify: `packages/stories/src/compiler/ir.ts`
- Modify: `packages/stories/src/types.ts`
- Modify: `packages/stories/src/compiler/parse-scene.ts`
- Modify: `packages/stories/src/compiler/emit.ts`
- Modify: `packages/stories/src/index.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

**Interfaces:**
- Produces: `BGM_CUE_KEYS`, `BgmCueKey`, `isBgmCueKey(value: string): value is BgmCueKey`
- Produces: `DialogueEntryIR.bgm?: string | null`
- Produces: `DialogueEntry.bgm?: string | null`
- Authoring: fenced `bgm` body is one bootstrap key or `stop`; it applies to the next dialogue entry only.

- [ ] **Step 1: Add failing parser tests for start/change/stop and next-entry consumption**

Add focused cases beside the existing SFX parser tests. Use representative source such as:

```ts
const markdown = `# Scene

\`\`\`bgm
dawn-apartment
\`\`\`

**旁白**：First.

**旁白**：Second.

\`\`\`bgm
stop
\`\`\`

**旁白**：Third.`;

expect(result.entries).toMatchObject([
  { dialogue: 'First.', bgm: 'dawn-apartment' },
  { dialogue: 'Second.' },
  { dialogue: 'Third.', bgm: null },
]);
```

Also add one test proving `bg`, `sfx`, and `bgm` can all be pending for the same next entry.

- [ ] **Step 2: Add failing validation tests**

Cover all strict failures explicitly:

```ts
expect(() => parse('```bgm\n\n```')).toThrow(/invalid bgm block/);
expect(() => parse('```bgm\nunknown-track\n```\n\n**旁白**：x')).toThrow(/unknown bgm cue/);
expect(() => parse('```bgm\ndawn-apartment\n```\n\n```bgm\ntension-pulse\n```\n\n**旁白**：x')).toThrow(/pending bgm/);
expect(() => parse('```bgm\ndawn-apartment\n```')).toThrow(/unconsumed bgm/);
```

Include malformed/multi-token/capitalized bodies so the syntax remains one lowercase hyphenated key or `stop`.

- [ ] **Step 3: Run the focused parser tests and confirm RED**

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: FAIL because BGM metadata and validation do not exist yet.

- [ ] **Step 4: Add the bootstrap BGM cue authority**

Extend `audio-cues.ts` without changing SFX semantics:

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

Export these from `packages/stories/src/index.ts` in the same style as the SFX exports.

- [ ] **Step 5: Add the IR/runtime field**

Add exactly:

```ts
bgm?: string | null;
```

to both `DialogueEntryIR` and runtime `DialogueEntry`. Do not introduce a BGM command object or enum.

- [ ] **Step 6: Implement strict pending BGM parsing**

Use a nullable pending value whose `undefined` state remains distinct from explicit stop:

```ts
const BGM_BLOCK_RE =
  /^```bgm[ \t]*\n[ \t]*(stop|[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;

let pendingBgm: string | null | undefined;
```

When a BGM block matches:

```ts
if (pendingBgm !== undefined) {
  throw new Error(
    `[story-compiler] ${sourcePath}: pending bgm was not consumed before another bgm block`
  );
}
const token = bgmMatch[1];
if (token === 'stop') pendingBgm = null;
else {
  if (!isBgmCueKey(token)) {
    throw new Error(`[story-compiler] ${sourcePath}: unknown bgm cue "${token}"`);
  }
  pendingBgm = token;
}
```

If a block starts with `````bgm`` but does not match, throw an `invalid bgm block` error. When emitting either explicit or default-speaker narration, consume with an `!== undefined` check so `null` survives:

```ts
if (pendingBgm !== undefined) {
  entry.bgm = pendingBgm;
  pendingBgm = undefined;
}
```

At EOF, fail when `pendingBgm !== undefined`.

- [ ] **Step 7: Run parser tests and confirm GREEN**

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add failing emitter tests for string/null/omission**

Extend `emit.test.ts` with entries that contain:

```ts
{ bgm: 'dawn-apartment' }
{ bgm: null }
{}
```

Assert generated output contains `bgm: "dawn-apartment"`, contains `bgm: null`, and does not add BGM to unauthored entries.

- [ ] **Step 9: Run emitter tests and confirm RED**

Run:

```bash
bun --filter @aquila/stories test -- emit.test.ts
```

Expected: FAIL because emitter ignores BGM.

- [ ] **Step 10: Emit BGM with an explicit undefined check**

In `emitSceneFile`, add:

```ts
if (e.bgm !== undefined) {
  parts.push(`bgm: ${e.bgm === null ? 'null' : q(e.bgm)}`);
}
```

Do not use `if (e.bgm)` because that drops the explicit stop command.

- [ ] **Step 11: Run focused and package tests**

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts emit.test.ts
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 12: Commit the compiler slice**

```bash
git add packages/stories/src/audio-cues.ts \
  packages/stories/src/compiler/ir.ts \
  packages/stories/src/types.ts \
  packages/stories/src/compiler/parse-scene.ts \
  packages/stories/src/compiler/emit.ts \
  packages/stories/src/index.ts \
  packages/stories/src/compiler/__tests__/parse-scene.test.ts \
  packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat: add background music authoring"
```

---

### Task 2: Add the local BGM catalog, native looping player, and preference

**Files:**
- Create: `apps/web/src/lib/audio/bgm-catalog.ts`
- Create: `apps/web/src/lib/audio/bgm-player.ts`
- Create: `apps/web/src/lib/audio/bgm-preference.ts`
- Test: `apps/web/src/lib/__tests__/bgm-player.test.ts`
- Test: `apps/web/src/lib/__tests__/bgm-preference.test.ts`

**Interfaces:**
- Produces: `resolveLocalBgmUrl(cueKey: string): string | null`
- Produces: `BgmPlayer { play(cueKey: string): void; stop(): void; dispose(): void }`
- Produces: `createBgmPlayer(createAudio?)`
- Produces: `readBgmEnabled(storage?): boolean`, `writeBgmEnabled(enabled, storage?): void`

- [ ] **Step 1: Write failing catalog/player tests**

Cover these behaviors with an injected fake audio factory:

```ts
const first = fakeAudio();
const second = fakeAudio();
const createAudio = vi.fn()
  .mockReturnValueOnce(first)
  .mockReturnValueOnce(second);
const player = createBgmPlayer(createAudio);

player.play('dawn-apartment');
expect(first.loop).toBe(true);
expect(first.play).toHaveBeenCalledTimes(1);

player.play('dawn-apartment');
expect(createAudio).toHaveBeenCalledTimes(1);
expect(first.play).toHaveBeenCalledTimes(1);

player.play('tension-pulse');
expect(first.pause).toHaveBeenCalledTimes(1);
expect(first.currentTime).toBe(0);
expect(second.play).toHaveBeenCalledTimes(1);
```

Also test unknown runtime key logging, `stop()`, idempotent `dispose()`, synchronous `play()` throw, rejected `play()` promise, and retry after rejection.

- [ ] **Step 2: Write failing preference tests**

Mirror the SFX preference contract:

```ts
expect(readBgmEnabled(emptyStorage)).toBe(true);
writeBgmEnabled(false, storage);
expect(storage.getItem(BGM_ENABLED_KEY)).toBe('false');
expect(readBgmEnabled(storage)).toBe(false);
```

Include throwing `getItem`/`setItem` storage and `null` storage.

- [ ] **Step 3: Run both new tests and confirm RED**

Run:

```bash
bun --filter web test -- bgm-player.test.ts bgm-preference.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement the type-linked local BGM catalog**

Create:

```ts
import type { BgmCueKey } from '@aquila/stories';

export const LOCAL_BGM_CATALOG = {
  'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
  'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} satisfies Record<BgmCueKey, string>;

export function resolveLocalBgmUrl(cueKey: string): string | null {
  return (LOCAL_BGM_CATALOG as Record<string, string>)[cueKey] ?? null;
}
```

Do not reuse the visual `WebAssetResolver`.

- [ ] **Step 5: Implement the native BGM player**

Use the same error-containment style as `sfx-player.ts`, plus duplicate-key suppression and `loop = true`:

```ts
export interface BgmPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}
```

A minimal internal state is enough:

```ts
let current: AudioLike | null = null;
let currentKey: string | null = null;
let disposed = false;
```

Before a new key, pause/reset/clear the previous element. On a rejected `play()` promise, clear `current` and `currentKey` only if they still refer to that request, so a later user gesture can retry. Do not show a toast or mutate reader state.

- [ ] **Step 6: Implement the BGM preference**

Create a direct parallel of SFX preference:

```ts
export const BGM_ENABLED_KEY = 'aquila:bgm-enabled:v1';

export function readBgmEnabled(
  storage: Storage | null = getBrowserStorage()
): boolean {
  try {
    return storage?.getItem(BGM_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeBgmEnabled(
  enabled: boolean,
  storage: Storage | null = getBrowserStorage()
): void {
  try {
    storage?.setItem(BGM_ENABLED_KEY, String(enabled));
  } catch {
    return;
  }
}
```

Do not create a generic preference store for two booleans.

- [ ] **Step 7: Run the BGM unit tests and confirm GREEN**

Run:

```bash
bun --filter web test -- bgm-player.test.ts bgm-preference.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the local runtime seam**

```bash
git add apps/web/src/lib/audio/bgm-catalog.ts \
  apps/web/src/lib/audio/bgm-player.ts \
  apps/web/src/lib/audio/bgm-preference.ts \
  apps/web/src/lib/__tests__/bgm-player.test.ts \
  apps/web/src/lib/__tests__/bgm-preference.test.ts
git commit -m "feat: add local background music player"
```

---

### Task 3: Share deterministic WAV helpers and add two BGM loop fixtures

**Files:**
- Create: `apps/web/scripts/audio-fixture.ts`
- Modify: `apps/web/scripts/build-sfx-fixtures.ts`
- Create: `apps/web/scripts/build-bgm-fixtures.ts`
- Modify: `apps/web/scripts/__tests__/build-sfx-fixtures.test.ts`
- Create: `apps/web/scripts/__tests__/build-bgm-fixtures.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/build-and-lint.yml`
- Create: `apps/web/public/assets/vn/audio/bgm/dawn-apartment.wav`
- Create: `apps/web/public/assets/vn/audio/bgm/tension-pulse.wav`

**Interfaces:**
- Produces: shared deterministic PCM helper used by both fixture scripts.
- Produces commands: `bun --filter web build:bgm-fixtures`, `bun --filter web verify:bgm-fixtures`.
- Preserves existing SFX fixture bytes and `build:sfx-fixtures` / `verify:sfx-fixtures` commands.

- [ ] **Step 1: Strengthen the existing SFX fixture test before refactoring**

Record/retain the expectation that verify mode rejects byte drift and build mode reproduces the committed deterministic bytes. Do not change expected SFX output bytes.

- [ ] **Step 2: Add failing BGM fixture tests**

Test that build output contains exactly:

```ts
[
  'dawn-apartment.wav',
  'tension-pulse.wav',
]
```

and verify mode checks structural PCM properties plus byte-for-byte deterministic equality.

- [ ] **Step 3: Run fixture tests and confirm RED for BGM**

Run:

```bash
bun --filter web test -- build-sfx-fixtures.test.ts build-bgm-fixtures.test.ts
```

Expected: existing SFX test passes; new BGM test fails because the generator does not exist.

- [ ] **Step 4: Extract only the reusable PCM helper**

Move the shared constants and functions out of `build-sfx-fixtures.ts`:

```ts
export const AUDIO_FIXTURE_SAMPLE_RATE = 8_000;
export function synthPcm16Wav(
  durationMs: number,
  sampleAt: (timeSeconds: number, progress: number) => number
): Buffer;
export function verifyPcm16Wav(name: string, bytes: Buffer): void;
```

`verifyPcm16Wav` keeps the current checks for RIFF, WAVE, `fmt `, PCM format 1, mono, PCM-16, `data`, and exact data length.

Modify `build-sfx-fixtures.ts` to import these helpers and otherwise keep its fixture definitions/output paths unchanged.

- [ ] **Step 5: Run the existing SFX fixture test immediately after extraction**

Run:

```bash
bun --filter web test -- build-sfx-fixtures.test.ts
bun --filter web verify:sfx-fixtures
```

Expected: PASS and no SFX binary diff.

- [ ] **Step 6: Implement two short deterministic BGM loops**

Create `build-bgm-fixtures.ts` using integer-cycle tones. Keep clips short enough for repository fixtures; for example 2,000 ms at 8 kHz mono PCM-16.

Use distinct formulas such as:

```ts
'dawn-apartment.wav': synthPcm16Wav(
  2_000,
  t => 0.18 * Math.sin(2 * Math.PI * 220 * t)
       + 0.08 * Math.sin(2 * Math.PI * 330 * t)
),

'tension-pulse.wav': synthPcm16Wav(
  2_000,
  t => 0.20 * Math.sin(2 * Math.PI * 110 * t)
       + 0.10 * Math.sin(2 * Math.PI * 165 * t)
),
```

Both frequencies complete an integer number of cycles in two seconds, limiting the loop seam without adding DSP or fade logic.

- [ ] **Step 7: Add build/verify package commands**

Add:

```json
"build:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts",
"verify:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts --verify"
```

Keep the existing SFX commands.

- [ ] **Step 8: Generate and verify the committed BGM WAV files**

Run:

```bash
bun --filter web build:bgm-fixtures
bun --filter web verify:bgm-fixtures
```

Expected: PASS and exactly two new BGM WAV files under `public/assets/vn/audio/bgm/`.

- [ ] **Step 9: Add BGM verification to CI beside SFX fixture verification**

In `.github/workflows/build-and-lint.yml`, place:

```bash
bun --filter web verify:bgm-fixtures
```

next to the existing visual/SFX fixture verification commands. Do not add a second workflow.

- [ ] **Step 10: Run all fixture tests and verifiers**

Run:

```bash
bun --filter web test -- build-sfx-fixtures.test.ts build-bgm-fixtures.test.ts
bun --filter web verify:sfx-fixtures
bun --filter web verify:bgm-fixtures
```

Expected: PASS.

- [ ] **Step 11: Commit the fixture slice**

```bash
git add apps/web/scripts/audio-fixture.ts \
  apps/web/scripts/build-sfx-fixtures.ts \
  apps/web/scripts/build-bgm-fixtures.ts \
  apps/web/scripts/__tests__/build-sfx-fixtures.test.ts \
  apps/web/scripts/__tests__/build-bgm-fixtures.test.ts \
  apps/web/package.json \
  .github/workflows/build-and-lint.yml \
  apps/web/public/assets/vn/audio/bgm/dawn-apartment.wav \
  apps/web/public/assets/vn/audio/bgm/tension-pulse.wav
git commit -m "test: add deterministic bgm fixtures"
```

---

### Task 4: Add the independent Visual-mode Background Music setting

**Files:**
- Modify: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`

**Interfaces:**
- Consumes: `bgmEnabled: boolean`
- Consumes: `onBgmEnabledChange(enabled: boolean): void`
- Produces: a second Visual-only accessible toggle independent of SFX.

- [ ] **Step 1: Update the settings test render helper with required BGM props**

Add defaults equivalent to:

```ts
bgmEnabled: true,
onBgmEnabledChange: vi.fn(),
```

Do not make the new component props optional merely to avoid updating tests/callers.

- [ ] **Step 2: Add failing Visual/Text settings tests**

Assert:

```ts
expect(screen.getByRole('button', { name: /background music/i }))
  .toHaveAttribute('aria-pressed', 'true');
```

Clicking the BGM control must call `onBgmEnabledChange(false)` without calling the SFX callback. Rendering `mode="text"` must omit both Sound Effects and Background Music controls.

- [ ] **Step 3: Run settings tests and confirm RED**

Run:

```bash
bun --filter web test -- ReaderSettingsMenu.test.ts
```

Expected: FAIL because BGM props/UI/translation keys do not exist.

- [ ] **Step 4: Add translation keys**

Add equivalent reader keys to both translation files:

```json
"backgroundMusic": "Background Music",
"backgroundMusicOn": "On",
"backgroundMusicOff": "Off"
```

Use natural Traditional Chinese equivalents in `zh.json`. Keep SFX copy unchanged.

- [ ] **Step 5: Add required BGM props and a second Visual-only toggle**

Extend the component prop shape with:

```ts
bgmEnabled: boolean;
onBgmEnabledChange: (enabled: boolean) => void;
```

Inside the existing `{#if mode === 'visual'}` block, render the BGM button in the same accessible style as SFX:

```svelte
<button
  type="button"
  aria-pressed={bgmEnabled}
  aria-label={t.reader.backgroundMusic}
  onclick={() => onBgmEnabledChange(!bgmEnabled)}
>
  <span>{t.reader.backgroundMusic}</span>
  <span>
    {bgmEnabled ? t.reader.backgroundMusicOn : t.reader.backgroundMusicOff}
  </span>
</button>
```

Do not add a slider, audio section component, or Text-mode control.

- [ ] **Step 6: Run settings tests and confirm GREEN**

Run:

```bash
bun --filter web test -- ReaderSettingsMenu.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the settings slice**

```bash
git add apps/web/src/components/ReaderSettingsMenu.svelte \
  apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts \
  packages/stories/src/translations/en.json \
  packages/stories/src/translations/zh.json
git commit -m "feat: add background music setting"
```

---

### Task 5: Integrate persistent BGM selection and autoplay-safe lifecycle into ReaderShell

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: `createBgmPlayer?: () => BgmPlayer`
- Consumes: `readBgmEnabled`, `writeBgmEnabled`
- Consumes: current `DialogueEntry.bgm?: string | null`
- Produces: shell-owned `selectedBgmKey`, `bgmActivated`, lifecycle and activation handling.

- [ ] **Step 1: Extend the ReaderShell test harness with an injected BGM player**

Use a fake like:

```ts
const bgmPlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
};
```

Pass `createBgmPlayer={() => bgmPlayer}` so component tests assert commands without invoking browser media.

- [ ] **Step 2: Add failing initial-arm and user-activation tests**

Cover an initial payload whose current line has `bgm: 'dawn-apartment'`:

```ts
expect(bgmPlayer.play).not.toHaveBeenCalled();
fireEvent.pointerDown(screen.getByTestId('reader-ready'));
expect(bgmPlayer.play).toHaveBeenCalledWith('dawn-apartment');
```

Add Enter/Space keyboard activation coverage. A non-activation key such as ArrowDown must not start BGM.

- [ ] **Step 3: Add failing persistence/change/stop tests**

Build a small dialogue sequence:

```ts
[
  { dialogue: 'a', bgm: 'dawn-apartment' },
  { dialogue: 'b' },
  { dialogue: 'c', bgm: 'dawn-apartment' },
  { dialogue: 'd', bgm: 'tension-pulse' },
  { dialogue: 'e', bgm: null },
]
```

After activation assert:

- advancing onto `b` makes no BGM call;
- same-key command on `c` is allowed to call `play('dawn-apartment')`, with duplicate restart suppression owned by `BgmPlayer`;
- `d` calls `play('tension-pulse')` once;
- `e` calls `stop()` and clears selection.

Also cover a scene transition with no destination command retaining the selected track.

- [ ] **Step 4: Add failing mode/preference/remount/story lifecycle tests**

Cover:

- Visual -> Text stops and resets activation;
- Text -> Visual does not call `play()` automatically;
- next eligible Visual pointerdown resumes selected BGM;
- disabling BGM stops immediately;
- re-enabling in Visual mode resumes selected BGM from that explicit toggle gesture;
- responsive leaf remount does not restart BGM;
- story replacement stops, clears selected key, resets activation, and may arm a new story's current-line command without autoplay;
- shell destroy calls `bgmPlayer.dispose()` exactly once;
- SFX still receives its own command while BGM is selected.

- [ ] **Step 5: Run ReaderShell tests and confirm RED**

Run:

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL because ReaderShell does not know BGM yet.

- [ ] **Step 6: Inject and initialize the BGM player/preference**

Add imports and the optional factory prop parallel to SFX:

```ts
import {
  createBgmPlayer as createDefaultBgmPlayer,
  type BgmPlayer,
} from '@/lib/audio/bgm-player';
import { readBgmEnabled, writeBgmEnabled } from '@/lib/audio/bgm-preference';
```

Props/state:

```ts
createBgmPlayer = createDefaultBgmPlayer,
const bgmPlayer = createBgmPlayer();
let bgmEnabled = $state(readBgmEnabled());
let selectedBgmKey: string | null = $state(null);
let bgmActivated = $state(false);
```

- [ ] **Step 7: Add the stable Visual activation handler**

Add:

```ts
function activateBgm(): void {
  if (readerMode !== 'visual' || leafDisabled) return;
  bgmActivated = true;
  if (bgmEnabled && selectedBgmKey) {
    bgmPlayer.play(selectedBgmKey);
  }
}

function handleBgmActivationKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') activateBgm();
}
```

Attach to the stable `data-testid="reader-ready"` element:

```svelte
onpointerdown={activateBgm}
onkeydown={handleBgmActivationKey}
```

Keep the guards in `ReaderShell`; do not add audio-specific callbacks to `VisualNovelReader`.

- [ ] **Step 8: Apply BGM commands inside the existing position-change effect**

After `lastActivePosition` is updated and SFX handling runs, add logic equivalent to:

```ts
if (previous !== null && previous.storyId !== nextPosition.storyId) {
  selectedBgmKey = null;
  bgmActivated = false;
  bgmPlayer.stop();
}

const bgmCommand = dialogue[dialogueIndex]?.bgm;
if (bgmCommand !== undefined) {
  selectedBgmKey = bgmCommand;
  if (bgmCommand === null) {
    bgmPlayer.stop();
  } else if (readerMode === 'visual' && bgmEnabled && bgmActivated) {
    bgmPlayer.play(bgmCommand);
  }
}
```

Unlike SFX, do not require forward adjacency for explicit BGM commands and do not add another transition helper.

- [ ] **Step 9: Add mode and preference lifecycle**

When entering Text mode:

```ts
bgmPlayer.stop();
bgmActivated = false;
```

Do not clear `selectedBgmKey` on mode switch.

Add:

```ts
function setBgmEnabled(enabled: boolean): void {
  if (bgmEnabled === enabled) return;
  bgmEnabled = enabled;
  writeBgmEnabled(enabled);
  if (!enabled) {
    bgmActivated = false;
    bgmPlayer.stop();
    return;
  }
  if (readerMode === 'visual' && selectedBgmKey) {
    bgmActivated = true;
    bgmPlayer.play(selectedBgmKey);
  }
}
```

Pass `bgmEnabled` / `onBgmEnabledChange={setBgmEnabled}` to `ReaderSettingsMenu`.

On destroy call `bgmPlayer.dispose()` beside SFX disposal.

- [ ] **Step 10: Run ReaderShell tests and confirm GREEN**

Run:

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: PASS.

- [ ] **Step 11: Run the focused audio/settings suite together**

Run:

```bash
bun --filter web test -- \
  bgm-player.test.ts \
  bgm-preference.test.ts \
  ReaderSettingsMenu.test.ts \
  ReaderShell.test.ts \
  sfx-player.test.ts \
  sfx-preference.test.ts \
  sfx-transition.test.ts
```

Expected: PASS; existing SFX behavior remains unchanged.

- [ ] **Step 12: Commit the ReaderShell lifecycle slice**

```bash
git add apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat: play persistent background music"
```

---

### Task 6: Add exactly three Seventh Mirror BGM demonstration commands and regenerate output

**Files:**
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Modify generated scenes under: `packages/stories/src/generated/theSeventhMirror/scenes/`

**Interfaces:**
- Demonstrates: `dawn-apartment` start, `tension-pulse` change, explicit `stop`.
- Does not attempt full story audio direction.

- [ ] **Step 1: Add the calm opening command in Act 1**

Place exactly before the existing opening narration:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

Do not add more Act 1 BGM commands.

- [ ] **Step 2: Add the tension change in Act 4**

Place `tension-pulse` at the first sustained suspicious/tension turn around the sleep-program timeline or phone-call beat, not on a throwaway sentence:

````markdown
```bgm
tension-pulse
```
````

The command should precede the chosen dialogue entry and remain the only BGM change in that short demonstration section.

- [ ] **Step 3: Add one explicit stop in Act 4**

When that demonstration beat resolves or immediately before the next major location transition, add:

````markdown
```bgm
stop
```
````

Do not author a fourth BGM command.

- [ ] **Step 4: Compile generated stories**

Run:

```bash
bun run compile:stories
```

Expected: generated Act 1/Act 4 scene files carry a string BGM command for the two start/change beats and `bgm: null` for stop.

- [ ] **Step 5: Inspect the generated diff before proceeding**

Run:

```bash
git diff -- packages/stories/raw/theSeventhMirror \
  packages/stories/src/generated/theSeventhMirror
```

Confirm exactly three raw `bgm` blocks were added and only corresponding generated scene payloads changed. No story-wide formatting churn is acceptable.

- [ ] **Step 6: Run stories tests and generated-drift check**

Run:

```bash
bun --filter @aquila/stories test
bun run compile:check
```

Expected: PASS with no generated drift.

- [ ] **Step 7: Commit the narrow story demonstration**

```bash
git add packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror/scenes
git commit -m "feat: demonstrate background music cues"
```

---

### Task 7: Full verification, manual smoke, and final YAGNI audit

**Files:**
- No planned production-file changes. If verification reveals a concrete defect, fix only that defect with its focused test before repeating the checks.

**Interfaces:**
- Verifies the entire HPA-605 contract and confirms deferred roadmap work did not leak into this branch.

- [ ] **Step 1: Run the required stories suite**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 2: Run the web suite with coverage**

```bash
bun --filter web test:coverage
```

Expected: PASS and repository/patch coverage remains at or above the configured 95% gates.

- [ ] **Step 3: Verify both audio fixture families**

```bash
bun --filter web verify:sfx-fixtures
bun --filter web verify:bgm-fixtures
```

Expected: PASS.

- [ ] **Step 4: Verify generated stories, lint, and build**

```bash
bun run compile:check
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 5: Perform the manual Visual-reader audio smoke**

With headphones and the local web reader:

1. Fresh Visual load on the opening BGM line is silent.
2. First pointer/Enter/Space interaction starts `dawn-apartment`.
3. Several cue-less dialogue advances do not restart it.
4. A scene transition without a BGM command retains it.
5. The Act 4 tension command switches once to `tension-pulse`.
6. The authored `stop` becomes silent.
7. HPA-604 SFX still plays independently over BGM.
8. SFX and BGM toggles persist independently.
9. BGM disable stops immediately; re-enable from the explicit settings click may resume the selected track.
10. Visual -> Text stops BGM; Text -> Visual does not autoplay; the next eligible Visual interaction resumes.
11. Crossing the responsive breakpoint does not restart the current track.
12. Reloading on a cue-less line remains silent rather than reconstructing history.

Record only concrete failures; do not broaden the feature while smoking it.

- [ ] **Step 6: Run the final YAGNI boundary audit**

Confirm the diff contains none of the following:

```text
AudioManager / channel registry / mixer
Web Audio API graph
crossfade / fade scheduler / ducking
volume slider or per-line volume metadata
route/history BGM reconstruction
persisted selected-track session state
R2/audio manifest resolver
ElevenLabs/provider calls
per-story audio-plan schema
Phaser audio changes
story-wide BGM/SFX pass
```

If any appears without being required by a failing acceptance test, remove it and rerun the affected test/check.

- [ ] **Step 7: Review the final diff for accidental scope**

Run:

```bash
git status --short
git diff main...HEAD --stat
git diff --check
```

Expected: only HPA-605 compiler, local web audio/settings/lifecycle, deterministic fixtures, three story commands, generated output, tests, and the design/plan documents.
