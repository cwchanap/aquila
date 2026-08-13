# HPA-605 Persistent Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add strict line-authored persistent BGM commands, one native looping browser channel, independent persisted BGM settings, useful current-scene restore/jump selection, deterministic local fixtures, and three narrow Seventh Mirror demonstration beats.

**Architecture:** Keep BGM parallel to HPA-604 SFX rather than introducing an audio manager. The compiler emits `bgm?: string | null`; a pure current-scene selection helper finds the latest local command and only falls back to HPA-604's forward-adjacency rule when the destination scene has no local answer. `ReaderShell` owns a plain selected key plus a plain autoplay-activation flag, while `BgmPlayer` owns one native looping element and suppresses duplicate-key restarts.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Svelte 5, Vitest, native `HTMLAudioElement`, existing `@aquila/stories` compiler/translations.

## Global Constraints

- Native browser audio only; add no audio framework, Web Audio graph, mixer, channel registry, crossfade, ducking, volume slider, or adaptive-music system.
- Keep SFX and BGM independently controllable and independently testable.
- Story Markdown contains logical keys only; `stop` is reserved BGM syntax and compiles to `null`.
- HPA-605 uses exactly two bootstrap BGM keys: `dawn-apartment` and `tension-pulse`.
- Catalog misses use `undefined`, matching SFX. Reserve `null` for authored BGM stop semantics.
- HPA-606 replaces bootstrap cue membership with per-story `audio-plan.json`; add no compatibility layer.
- HPA-610 replaces local URL resolution; add no R2/audio-manifest logic and do not generalize the visual resolver.
- Initial/restored content never autoplays. Playback begins only after an eligible Visual-reader/settings gesture.
- Restore/jump recovery may scan only the currently loaded scene's `dialogue` array; do not traverse predecessor scenes, browser history, or choice history and do not persist selected-track session state.
- If the current scene has no local BGM answer, retain inherited music only across genuine forward adjacency; cue-less non-forward movement clears it rather than leaking a stale loop.
- Pointer activation stays scoped to `reader-ready`; keyboard Enter/Space activation listens at `window`, matching the existing visual reader keyboard route.
- Exactly three existing Seventh Mirror beats demonstrate calm start, tension change, and explicit stop; HPA-607 owns the full story audio pass.
- Final web verification uses `bun --filter web test:coverage` because project/patch gates are 95%.

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
- Produces: `BGM_CUE_KEYS`, `BgmCueKey`, `isBgmCueKey(value: string): value is BgmCueKey`.
- Produces: `DialogueEntryIR.bgm?: string | null`.
- Produces: `DialogueEntry.bgm?: string | null`.
- Authoring: fenced `bgm` body is one bootstrap key or `stop`; it applies to the next dialogue entry only.

- [ ] **Step 1: Add failing parser tests for start/change/stop and next-entry consumption**

Add focused cases beside the existing SFX tests:

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

const result = parseScene(markdown, resolveCharacter, 'fixture.md', narrator);
expect(result.entries).toMatchObject([
  { dialogue: 'First.', bgm: 'dawn-apartment' },
  { dialogue: 'Second.' },
  { dialogue: 'Third.', bgm: null },
]);
```

Add a case proving `bg`, `sfx`, and `bgm` can all be pending and consumed by the same next entry.

- [ ] **Step 2: Add failing strict-validation tests**

Cover:

```ts
expect(() => parse('```bgm\n\n```')).toThrow(/invalid bgm block/);
expect(() =>
  parse('```bgm\nunknown-track\n```\n\n**旁白**：x')
).toThrow(/unknown bgm cue/);
expect(() =>
  parse(
    '```bgm\ndawn-apartment\n```\n\n```bgm\ntension-pulse\n```\n\n**旁白**：x'
  )
).toThrow(/pending bgm/);
expect(() => parse('```bgm\ndawn-apartment\n```')).toThrow(/unconsumed bgm/);
```

Also cover multi-token and capitalized bodies. The only valid body forms are one lowercase hyphenated key or `stop`.

- [ ] **Step 3: Run the parser tests and confirm RED**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: FAIL because BGM authoring does not exist.

- [ ] **Step 4: Extend the bootstrap cue authority**

Add to `audio-cues.ts`:

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

Export them from `packages/stories/src/index.ts` in the same style as the SFX symbols.

- [ ] **Step 5: Add the IR/runtime field**

Add exactly:

```ts
bgm?: string | null;
```

to `DialogueEntryIR` and runtime `DialogueEntry`. Do not create a command object or enum.

- [ ] **Step 6: Implement strict pending BGM parsing**

Use:

```ts
const BGM_BLOCK_RE =
  /^```bgm[ \t]*\n[ \t]*(stop|[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;

let pendingBgm: string | null | undefined;
```

On a matched block:

```ts
if (pendingBgm !== undefined) {
  throw new Error(
    `[story-compiler] ${sourcePath}: pending bgm was not consumed before another bgm block`
  );
}

const token = bgmMatch[1];
if (token === 'stop') {
  pendingBgm = null;
} else {
  if (!isBgmCueKey(token)) {
    throw new Error(
      `[story-compiler] ${sourcePath}: unknown bgm cue "${token}"`
    );
  }
  pendingBgm = token;
}
```

If a block begins with `````bgm`` but fails `BGM_BLOCK_RE`, throw `invalid bgm block`.

Consume with an explicit undefined test for both normal and default-speaker entries:

```ts
if (pendingBgm !== undefined) {
  entry.bgm = pendingBgm;
  pendingBgm = undefined;
}
```

At EOF, throw when `pendingBgm !== undefined`.

- [ ] **Step 7: Run parser tests and confirm GREEN**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add failing emitter tests for string/null/omission**

Create entries with:

```ts
{ bgm: 'dawn-apartment' }
{ bgm: null }
{}
```

Assert the generated scene contains:

```text
bgm: "dawn-apartment"
bgm: null
```

and does not emit BGM for the unauthored entry.

- [ ] **Step 9: Run emitter tests and confirm RED**

```bash
bun --filter @aquila/stories test -- emit.test.ts
```

Expected: FAIL because emitter ignores BGM.

- [ ] **Step 10: Emit BGM with `!== undefined`**

In `emitSceneFile`:

```ts
if (e.bgm !== undefined) {
  parts.push(`bgm: ${e.bgm === null ? 'null' : q(e.bgm)}`);
}
```

Do not use `if (e.bgm)`.

- [ ] **Step 11: Run focused and full stories tests**

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
- Produces: `resolveLocalBgmUrl(cueKey: string): string | undefined`.
- Produces: `BgmPlayer { play(cueKey: string): void; stop(): void; dispose(): void }`.
- Produces: `createBgmPlayer(createAudio?)`.
- Produces: `readBgmEnabled(storage?): boolean`, `writeBgmEnabled(enabled, storage?): void`.

- [ ] **Step 1: Write failing catalog/player tests**

Use an injected fake audio factory:

```ts
const first = fakeAudio();
const second = fakeAudio();
const createAudio = vi
  .fn()
  .mockReturnValueOnce(first)
  .mockReturnValueOnce(second);
const player = createBgmPlayer(createAudio);

expect(resolveLocalBgmUrl('unknown')).toBeUndefined();

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

Also test:

- unknown runtime key logs and creates no audio;
- `stop()` pauses/rewinds/clears;
- `dispose()` is idempotent and makes later `play()` inert;
- synchronous `play()` throw is contained;
- rejected `play()` promise is contained;
- after rejection, a later `play(sameKey)` retries by creating/playing again.

- [ ] **Step 2: Write failing preference tests**

```ts
expect(readBgmEnabled(emptyStorage)).toBe(true);
writeBgmEnabled(false, storage);
expect(storage.getItem(BGM_ENABLED_KEY)).toBe('false');
expect(readBgmEnabled(storage)).toBe(false);
```

Include `null` storage and throwing `getItem`/`setItem` storage.

- [ ] **Step 3: Run the new tests and confirm RED**

```bash
bun --filter web test -- bgm-player.test.ts bgm-preference.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the type-linked catalog**

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

Do not use `null` for catalog absence and do not reuse the visual asset resolver.

- [ ] **Step 5: Implement the native looping player**

Use the same containment pattern as `sfx-player.ts`:

```ts
export interface BgmPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}

type AudioLike = Pick<
  HTMLAudioElement,
  'play' | 'pause' | 'currentTime' | 'loop'
>;
```

Minimal state:

```ts
let current: AudioLike | null = null;
let currentKey: string | null = null;
let disposed = false;
```

Rules:

```ts
const src = resolveLocalBgmUrl(cueKey);
if (!src) {
  logger.warn('Unknown visual-novel BGM cue', { cueKey });
  return;
}
if (current && currentKey === cueKey) return;
```

Before a new key, pause/reset the previous element. Set `audio.loop = true` before `play()`.

If `play()` rejects, clear `current/currentKey` only if they still identify that request so a later activation can retry.

- [ ] **Step 6: Implement the direct BGM preference**

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

Do not create a generic preference store.

- [ ] **Step 7: Run BGM unit tests and confirm GREEN**

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

### Task 3: Share deterministic audio-fixture mechanics and add two BGM loops

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
- Produces: `synthPcm16Wav`, `verifyPcm16Wav`.
- Produces: `buildAudioFixtures(outputRoot, fixtures)`, `verifyAudioFixtures(outputRoot, fixtures)`.
- Produces: `runAudioFixtureCli(build, verify)`.
- Produces commands: `build:bgm-fixtures`, `verify:bgm-fixtures`.
- Preserves existing SFX fixture bytes and scripts.

- [ ] **Step 1: Strengthen the existing SFX fixture test before refactoring**

Keep an assertion that build mode reproduces the committed SFX bytes and verify mode rejects byte drift. Do not change the expected SFX output.

- [ ] **Step 2: Add failing generic-helper and BGM fixture tests**

Test the generic file loops with a temporary output directory:

```ts
const fixtureBytes = {
  'a.wav': Buffer.from('a'),
  'b.wav': Buffer.from('b'),
};
await buildAudioFixtures(tmpDir, fixtureBytes);
expect(await readFile(resolve(tmpDir, 'a.wav'))).toEqual(fixtureBytes['a.wav']);
expect(await readFile(resolve(tmpDir, 'b.wav'))).toEqual(fixtureBytes['b.wav']);
```

For BGM, assert the fixture set is exactly:

```ts
['dawn-apartment.wav', 'tension-pulse.wav']
```

and verify mode checks deterministic byte equality plus PCM structure.

- [ ] **Step 3: Run fixture tests and confirm RED**

```bash
bun --filter web test -- build-sfx-fixtures.test.ts build-bgm-fixtures.test.ts
```

Expected: BGM/generic-helper tests fail because the helper/generator do not exist.

- [ ] **Step 4: Extract PCM and file-loop helpers**

Create `audio-fixture.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const AUDIO_FIXTURE_SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

export function synthPcm16Wav(
  durationMs: number,
  sampleAt: (timeSeconds: number, progress: number) => number
): Buffer {
  // Move the current deterministic synthesis/PCM-16 encoding here unchanged.
}

export function verifyPcm16Wav(name: string, bytes: Buffer): void {
  // Move the current RIFF/WAVE/fmt/PCM/mono/16-bit/data-length checks here unchanged.
}

export async function buildAudioFixtures(
  outputRoot: string,
  fixtures: Readonly<Record<string, Buffer>>
): Promise<void> {
  for (const [name, bytes] of Object.entries(fixtures)) {
    const path = resolve(outputRoot, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
}

export async function verifyAudioFixtures(
  outputRoot: string,
  fixtures: Readonly<Record<string, Buffer>>
): Promise<void> {
  for (const [name, expected] of Object.entries(fixtures)) {
    const actual = await readFile(resolve(outputRoot, name));
    verifyPcm16Wav(name, actual);
    if (!actual.equals(expected)) {
      throw new Error(
        `${name}: committed bytes differ from deterministic generator`
      );
    }
  }
}

export async function runAudioFixtureCli(
  build: () => Promise<void>,
  verify: () => Promise<void>
): Promise<void> {
  if (process.argv.includes('--verify')) await verify();
  else await build();
}
```

The bodies of `synthPcm16Wav` and `verifyPcm16Wav` are direct moves of the current logic, not new DSP behavior.

- [ ] **Step 5: Refactor SFX to the shared helper and verify bytes immediately**

Keep the SFX fixture formulas/output root unchanged. Replace its build/verify loops with:

```ts
export async function buildSfxFixtures(): Promise<void> {
  await buildAudioFixtures(outputRoot, fixtures());
}

export async function verifySfxFixtures(): Promise<void> {
  await verifyAudioFixtures(outputRoot, fixtures());
}

if (import.meta.main) {
  await runAudioFixtureCli(buildSfxFixtures, verifySfxFixtures);
}
```

Run:

```bash
bun --filter web test -- build-sfx-fixtures.test.ts
bun --filter web verify:sfx-fixtures
```

Expected: PASS with no SFX binary diff.

- [ ] **Step 6: Implement two deterministic BGM loops**

Create `build-bgm-fixtures.ts` with:

```ts
function fixtures(): Record<string, Buffer> {
  return {
    'dawn-apartment.wav': synthPcm16Wav(
      2_000,
      t =>
        0.18 * Math.sin(2 * Math.PI * 220 * t) +
        0.08 * Math.sin(2 * Math.PI * 330 * t)
    ),
    'tension-pulse.wav': synthPcm16Wav(
      2_000,
      t =>
        0.2 * Math.sin(2 * Math.PI * 110 * t) +
        0.1 * Math.sin(2 * Math.PI * 165 * t)
    ),
  };
}
```

Use the same shared `buildAudioFixtures`, `verifyAudioFixtures`, and `runAudioFixtureCli` wrappers as SFX.

The four frequencies complete integer cycle counts in two seconds; add no fade/crossfade logic.

- [ ] **Step 7: Add package commands**

Add to `apps/web/package.json`:

```json
"build:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts",
"verify:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts --verify"
```

Keep the existing SFX commands unchanged.

- [ ] **Step 8: Generate and verify committed BGM fixtures**

```bash
bun --filter web build:bgm-fixtures
bun --filter web verify:bgm-fixtures
```

Expected: PASS and exactly two files under `public/assets/vn/audio/bgm/`.

- [ ] **Step 9: Add BGM verification to the existing CI workflow**

In `.github/workflows/build-and-lint.yml`, add:

```bash
bun --filter web verify:bgm-fixtures
```

beside the existing visual/SFX fixture verification. Do not add another workflow.

- [ ] **Step 10: Run all fixture tests/verifiers**

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
- Consumes: `bgmEnabled: boolean`.
- Consumes: `onBgmEnabledChange(enabled: boolean): void`.
- Produces: a second Visual-only accessible toggle independent of SFX.

- [ ] **Step 1: Update the settings test helper with required BGM props**

Add defaults:

```ts
bgmEnabled: true,
onBgmEnabledChange: vi.fn(),
```

Do not make the props optional just to avoid updating callers/tests.

- [ ] **Step 2: Add failing Visual/Text settings tests**

Visual mode:

```ts
expect(
  screen.getByRole('button', { name: /background music/i })
).toHaveAttribute('aria-pressed', 'true');
```

Click the button and assert `onBgmEnabledChange(false)` fires without invoking the SFX callback.

Text mode must omit both audio toggles.

- [ ] **Step 3: Run settings tests and confirm RED**

```bash
bun --filter web test -- ReaderSettingsMenu.test.ts
```

Expected: FAIL because BGM props/copy/UI do not exist.

- [ ] **Step 4: Add translation keys**

English:

```json
"backgroundMusic": "Background Music",
"backgroundMusicOn": "On",
"backgroundMusicOff": "Off"
```

Add natural Traditional Chinese equivalents in `zh.json`. Keep SFX copy unchanged.

- [ ] **Step 5: Add required props and the Visual-only BGM toggle**

Props:

```ts
bgmEnabled: boolean;
onBgmEnabledChange: (enabled: boolean) => void;
```

Inside the existing `mode === 'visual'` block:

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

Use the same styling as SFX. Add no slider or new settings component.

- [ ] **Step 6: Run settings tests and confirm GREEN**

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

### Task 5: Resolve current-scene BGM selection and wire autoplay-safe ReaderShell playback

**Files:**
- Modify: `apps/web/src/lib/audio/sfx-transition.ts`
- Create: `apps/web/src/lib/audio/bgm-transition.ts`
- Test: `apps/web/src/lib/__tests__/bgm-transition.test.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Reuses/exports: `isForwardAdjacent(previous, next, flow)` from `sfx-transition.ts`; implementation unchanged.
- Produces: `activeBgmAt(entries, index): string | null | undefined`.
- Produces: `nextBgmSelection(previous, next, entries, selectedKey, flow): string | null`.
- Consumes: `createBgmPlayer?: () => BgmPlayer`, `readBgmEnabled`, `writeBgmEnabled`.
- Produces: plain shell-local `selectedBgmKey` and `bgmActivated`, plus reactive `bgmEnabled`.

- [ ] **Step 1: Write failing tests for `activeBgmAt`**

Create `bgm-transition.test.ts`:

```ts
const entries: DialogueEntry[] = [
  { dialogue: 'a', bgm: 'dawn-apartment' },
  { dialogue: 'b' },
  { dialogue: 'c', bgm: 'tension-pulse' },
  { dialogue: 'd' },
  { dialogue: 'e', bgm: null },
  { dialogue: 'f' },
];

expect(activeBgmAt(entries, 0)).toBe('dawn-apartment');
expect(activeBgmAt(entries, 1)).toBe('dawn-apartment');
expect(activeBgmAt(entries, 3)).toBe('tension-pulse');
expect(activeBgmAt(entries, 5)).toBeNull();
expect(activeBgmAt([{ dialogue: 'x' }], 0)).toBeUndefined();
```

Also cover out-of-range high index clamping to `entries.length - 1` and empty entries returning `undefined`.

- [ ] **Step 2: Write failing tests for safe inherited-selection fallback**

Use positions/flows equivalent to existing SFX transition fixtures:

```ts
expect(
  nextBgmSelection(null, act1Line3, act1Entries, null, flow)
).toBe('dawn-apartment');

expect(
  nextBgmSelection(act1Line0, act1Line1, cueLessEntries, 'dawn-apartment', flow)
).toBe('dawn-apartment');

expect(
  nextBgmSelection(act1Last, act2Line0, cueLessAct2, 'dawn-apartment', linearFlow)
).toBe('dawn-apartment');

expect(
  nextBgmSelection(act1Last, act3Line0, cueLessAct3, 'dawn-apartment', jumpFlow)
).toBeNull();
```

Cover these additional cases:

- direct choice edge + cue-less destination retains inherited selection;
- same-scene backward/index jump with no local answer clears;
- non-forward destination whose local scan finds `tension-pulse` returns `tension-pulse`;
- non-forward destination whose local scan finds `null` returns `null`;
- fresh/restored cue-less scene returns `null`;
- story replacement cue-less scene returns `null`;
- story replacement with local command returns that local command.

Do **not** add mode/enabled/activation cases; those are not selection inputs.

- [ ] **Step 3: Run selection tests and confirm RED**

```bash
bun --filter web test -- bgm-transition.test.ts
```

Expected: FAIL because BGM selection helpers do not exist and `isForwardAdjacent` is private.

- [ ] **Step 4: Export the existing HPA-604 structural helper**

Change only visibility in `sfx-transition.ts`:

```ts
export function isForwardAdjacent(
  previous: LinePosition,
  next: LinePosition,
  flow: StoryFlowConfig | null
): boolean {
  // Existing body unchanged.
}
```

Do not move it to a generic navigation module.

- [ ] **Step 5: Implement `activeBgmAt` and `nextBgmSelection`**

Create `bgm-transition.ts`:

```ts
import type { DialogueEntry, StoryFlowConfig } from '@aquila/stories';
import {
  isForwardAdjacent,
  type LinePosition,
} from './sfx-transition';

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

This is the complete pure policy. Add no playback actions, mode, preference, activation, history walk, or navigation-reason enum.

- [ ] **Step 6: Run selection + existing SFX transition tests and confirm GREEN**

```bash
bun --filter web test -- bgm-transition.test.ts sfx-transition.test.ts
```

Expected: PASS and unchanged SFX behavior.

- [ ] **Step 7: Extend the ReaderShell test harness with an injected BGM player**

Use:

```ts
const bgmPlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
};
```

Pass `createBgmPlayer={() => bgmPlayer}`.

- [ ] **Step 8: Add failing initial/current-scene and pointer activation tests**

Use a scene with:

```ts
[
  { dialogue: 'a', bgm: 'dawn-apartment' },
  { dialogue: 'b' },
]
```

Start at index `1` and assert current-scene scanning arms but does not autoplay:

```ts
expect(bgmPlayer.play).not.toHaveBeenCalled();
await fireEvent.pointerDown(screen.getByTestId('reader-ready'));
expect(bgmPlayer.play).toHaveBeenCalledWith('dawn-apartment');
```

This specifically proves restore on a later line uses the local earlier command.

- [ ] **Step 9: Add failing keyboard activation tests using the real event path**

Dispatch Enter/Space from `document.body`, not the `reader-ready` div:

```ts
await fireEvent.keyDown(document.body, { key: 'Enter' });
expect(bgmPlayer.play).toHaveBeenCalledWith('dawn-apartment');
```

Repeat for Space.

Assert no activation for:

```ts
await fireEvent.keyDown(document.body, { key: 'ArrowDown' });
await fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
await fireEvent.keyDown(screen.getByRole('button', { name: /settings/i }), {
  key: 'Enter',
});
```

The last case must not count as the reader keyboard activation path.

- [ ] **Step 10: Add failing selection-change/jump wiring tests**

Keep component coverage focused on shell integration:

1. Forward cue-less line retains the active loop with no extra play/stop call.
2. Local same-key result does not restart.
3. Local `tension-pulse` result calls `play('tension-pulse')` once when activated.
4. Local `null` result calls `stop()`.
5. Reuse the existing `jumpFlow`: after activating `dawn-apartment`, jump to cue-less non-adjacent `act3`; assert one stop and then another eligible activation does **not** replay `dawn-apartment` because selection was cleared.
6. Jump to a destination scene/index whose local scan finds `tension-pulse`; assert that local key is selected/played instead of keeping source music.

- [ ] **Step 11: Add failing mode/preference/remount/story lifecycle tests**

Cover:

- Visual -> Text stops and resets activation but retains selection;
- Text -> Visual does not autoplay;
- next eligible Visual pointer/key gesture resumes retained selection;
- disabling BGM stops immediately and resets activation;
- re-enabling from the Visual Settings toggle resumes selected BGM because that click is an explicit user gesture;
- responsive leaf remount does not restart;
- story replacement stops old BGM, clears old selection/activation, scans the new current scene, and may arm a new local key without autoplay;
- SFX still receives its own command while BGM is active;
- shell destroy calls `bgmPlayer.dispose()` exactly once.

- [ ] **Step 12: Run ReaderShell tests and confirm RED**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL because ReaderShell does not yet own BGM.

- [ ] **Step 13: Inject BGM player/preference and keep internal lifecycle state non-reactive**

Imports:

```ts
import {
  createBgmPlayer as createDefaultBgmPlayer,
  type BgmPlayer,
} from '@/lib/audio/bgm-player';
import { readBgmEnabled, writeBgmEnabled } from '@/lib/audio/bgm-preference';
import { nextBgmSelection } from '@/lib/audio/bgm-transition';
import { isReaderInteractiveTarget } from '@/lib/reader-interaction';
```

Add factory prop parallel to SFX.

State:

```ts
const bgmPlayer = createBgmPlayer();
let bgmEnabled = $state(readBgmEnabled());
let selectedBgmKey: string | null = null;
let bgmActivated = false;
```

Do not make `selectedBgmKey` or `bgmActivated` `$state`; they are imperative lifecycle state and are not rendered.

- [ ] **Step 14: Add pointer and window-keyboard activation**

```ts
function activateBgm(): void {
  if (readerMode !== 'visual' || leafDisabled) return;
  bgmActivated = true;
  if (bgmEnabled && selectedBgmKey) {
    bgmPlayer.play(selectedBgmKey);
  }
}

function handleBgmActivationKey(event: KeyboardEvent): void {
  if (readerMode !== 'visual' || leafDisabled) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (isReaderInteractiveTarget(event.target ?? document.activeElement)) return;
  activateBgm();
}
```

Attach keyboard at window level:

```svelte
<svelte:window onkeydown={handleBgmActivationKey} />
```

If `ReaderShell` already needs another `<svelte:window>` directive for future edits, combine handlers on the same Svelte special element rather than adding duplicate markup solely for style.

Keep pointer activation on the stable reader subtree:

```svelte
<div
  bind:this={readerReadyElement}
  data-testid="reader-ready"
  onpointerdown={activateBgm}
>
```

Do **not** move pointer activation to `window`; clicking the external Settings trigger should not start BGM.

- [ ] **Step 15: Apply selection diffs in the existing position-change effect**

After existing visual revalidation/SFX handling, use plain local state:

```ts
const storyChanged =
  previous !== null && previous.storyId !== nextPosition.storyId;

if (storyChanged) {
  bgmPlayer.stop();
  selectedBgmKey = null;
  bgmActivated = false;
}

const previousBgmKey = selectedBgmKey;
const nextBgmKey = nextBgmSelection(
  previous,
  nextPosition,
  dialogue,
  selectedBgmKey,
  activeFlow
);
selectedBgmKey = nextBgmKey;

if (!storyChanged && previousBgmKey !== null && nextBgmKey === null) {
  bgmPlayer.stop();
} else if (
  nextBgmKey !== null &&
  nextBgmKey !== previousBgmKey &&
  bgmActivated
) {
  bgmPlayer.play(nextBgmKey);
}
```

This effect reads no reactive BGM selection/activation values that it writes through. `bgmEnabled` also stays out of this effect: disabling sets `bgmActivated = false`, and enabling is handled by the explicit settings callback.

- [ ] **Step 16: Add mode/preference lifecycle**

When entering Text mode:

```ts
bgmPlayer.stop();
bgmActivated = false;
```

Retain `selectedBgmKey`.

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

Pass required BGM props to `ReaderSettingsMenu` and call `bgmPlayer.dispose()` on destroy beside SFX disposal.

- [ ] **Step 17: Run ReaderShell tests and confirm GREEN**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: PASS.

- [ ] **Step 18: Run the focused audio/settings suite together**

```bash
bun --filter web test -- \
  bgm-player.test.ts \
  bgm-preference.test.ts \
  bgm-transition.test.ts \
  ReaderSettingsMenu.test.ts \
  ReaderShell.test.ts \
  sfx-player.test.ts \
  sfx-preference.test.ts \
  sfx-transition.test.ts
```

Expected: PASS; existing SFX behavior remains unchanged.

- [ ] **Step 19: Commit the selection/lifecycle slice**

```bash
git add apps/web/src/lib/audio/sfx-transition.ts \
  apps/web/src/lib/audio/bgm-transition.ts \
  apps/web/src/lib/__tests__/bgm-transition.test.ts \
  apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat: play persistent background music"
```

---

### Task 6: Add exactly three Seventh Mirror BGM commands and verify real generated payloads

**Files:**
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Modify generated scenes under: `packages/stories/src/generated/theSeventhMirror/scenes/`

**Interfaces:**
- Demonstrates: `dawn-apartment` start, `tension-pulse` change, explicit `stop`.
- Leaves existing Act 4 `notification-beep` SFX untouched.
- Provides a real compiler -> generated-payload check before manual runtime smoke.

- [ ] **Step 1: Add the pinned calm opening command in Act 1**

Exactly:

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

Do not add any other Act 1 BGM command.

- [ ] **Step 2: Add the pinned tension change in Act 4**

Exactly:

````markdown
```bgm
tension-pulse
```

**朝倉澪**：兩週前。悠真收到學校轉發的「關東青少年睡眠支援計畫」通知。
````

Do not move it to the later phone SFX beat.

- [ ] **Step 3: Add the pinned stop in Act 4**

Exactly:

````markdown
```bgm
stop
```

**旁白**：澪點頭。琴音走出咖啡店的時候，下午的陽光從門口斜進來，把她的影子拉得很長，像一條安靜的尾巴。
````

Do not author a fourth command.

- [ ] **Step 4: Compile generated stories**

```bash
bun run compile:stories
```

Expected: Act 1/Act 4 generated scenes update.

- [ ] **Step 5: Assert the three real generated BGM payloads literally exist**

Run:

```bash
grep -F 'bgm: "dawn-apartment"' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts
grep -F 'bgm: "tension-pulse"' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
grep -F 'bgm: null' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
```

Expected: each command prints a matching generated line. This is the cheap real-story compiler -> payload assertion; do not build a new E2E harness for it.

- [ ] **Step 6: Inspect the raw/generated diff**

```bash
git diff -- packages/stories/raw/theSeventhMirror \
  packages/stories/src/generated/theSeventhMirror
```

Confirm:

- exactly three raw `bgm` blocks were added at the pinned lines;
- existing `notification-beep` SFX is untouched;
- only corresponding generated scene payloads changed;
- no story-wide formatting churn.

- [ ] **Step 7: Run stories tests and generated-drift check**

```bash
bun --filter @aquila/stories test
bun run compile:check
```

Expected: PASS with no generated drift.

- [ ] **Step 8: Commit the narrow story demonstration**

```bash
git add packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror/scenes
git commit -m "feat: demonstrate background music cues"
```

---

### Task 7: Full verification, manual smoke, and final YAGNI audit

**Files:**
- No planned production-file changes. If verification exposes a concrete defect, add the smallest focused regression test/fix before repeating the relevant checks.

**Interfaces:**
- Verifies the complete HPA-605 contract and confirms deferred roadmap work did not leak into this branch.

- [ ] **Step 1: Run the full stories suite**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 2: Run web tests with coverage**

```bash
bun --filter web test:coverage
```

Expected: PASS and configured project/patch coverage remains at or above 95%.

- [ ] **Step 3: Verify both audio fixture families**

```bash
bun --filter web verify:sfx-fixtures
bun --filter web verify:bgm-fixtures
```

Expected: PASS.

- [ ] **Step 4: Verify generated output, lint, and build**

```bash
bun run compile:check
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 5: Perform the manual Visual-reader audio smoke**

With headphones/local web reader:

1. Fresh Visual load at Act 1 line 0 is silent.
2. Pointer interaction on reader content starts `dawn-apartment`.
3. Reload directly on a later Act 1 line; no autoplay occurs, then first pointer/Enter/Space gesture starts `dawn-apartment` via current-scene scan.
4. Keyboard-only Enter/Space from normal body focus activates BGM while normal reader keyboard navigation continues.
5. Several forward cue-less lines do not restart the loop.
6. Direct linear/choice scene progression with no local destination command retains inherited BGM.
7. Non-adjacent cue-less Act-panel jump to a scene with no local command stops/clears the stale loop; another gesture does not resurrect it.
8. Jump/backward movement to a destination position with an earlier local BGM command uses that local command.
9. The Act 4 pinned tension line switches once to `tension-pulse`.
10. Existing `notification-beep` SFX plays independently over BGM.
11. The pinned `stop` becomes silent.
12. SFX/BGM toggles persist independently; BGM disable stops immediately and Visual re-enable may resume from the settings click.
13. Visual -> Text stops BGM; Text -> Visual does not autoplay; next eligible Visual gesture resumes retained selection.
14. Responsive breakpoint remount does not restart.
15. Fresh restore in a scene with no local BGM command stays silent rather than traversing prior scenes/history.

Record only concrete failures. Do not broaden the feature during smoke testing.

- [ ] **Step 6: Run the final YAGNI boundary audit**

Confirm the diff contains none of:

```text
AudioManager / channel registry / mixer
generic navigation-reason state
Web Audio graph
crossfade / fade scheduler / ducking
volume slider or per-line volume metadata
predecessor-scene/history BGM reconstruction
persisted selected-track session state
R2/audio manifest resolver
ElevenLabs/provider calls
per-story audio-plan schema
Phaser audio changes
story-wide BGM/SFX pass
```

If one appears without a failing HPA-605 acceptance test requiring it, remove it and rerun affected checks.

- [ ] **Step 7: Review final scope and diff hygiene**

```bash
git status --short
git diff main...HEAD --stat
git diff --check
```

Expected scope only:

- BGM compiler contract/tests;
- local BGM catalog/player/preference/tests;
- shared deterministic audio-fixture mechanics plus two BGM WAVs/CI verifier;
- one Visual-mode BGM setting;
- current-scene selection helper + minimal SFX helper export;
- `ReaderShell` playback/activation lifecycle and tests;
- exactly three raw BGM commands plus generated payloads;
- design/plan docs.
