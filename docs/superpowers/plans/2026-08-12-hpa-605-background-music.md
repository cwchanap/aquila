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

Add one case with pending `bg`, `sfx`, and `bgm` blocks immediately before one dialogue and assert all three fields land on that entry.

- [ ] **Step 2: Add failing strict-validation tests**

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
expect(() =>
  parse('```bgm\nDawn-Apartment\n```\n\n**旁白**：x')
).toThrow(/invalid bgm block/);
expect(() =>
  parse('```bgm\ndawn apartment\n```\n\n**旁白**：x')
).toThrow(/invalid bgm block/);
```

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

Export these from `packages/stories/src/index.ts` beside the SFX exports.

- [ ] **Step 5: Add the IR/runtime field**

Add exactly:

```ts
bgm?: string | null;
```

to `DialogueEntryIR` and runtime `DialogueEntry`.

- [ ] **Step 6: Implement strict pending BGM parsing**

Add:

```ts
const BGM_BLOCK_RE =
  /^```bgm[ \t]*\n[ \t]*(stop|[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;
```

Import `isBgmCueKey`, then add:

```ts
let pendingBgm: string | null | undefined;
```

Inside the block loop, after `sfx` handling and before dialogue parsing:

```ts
const bgmMatch = BGM_BLOCK_RE.exec(block);
if (bgmMatch) {
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
  continue;
}
if (block.startsWith('```bgm')) {
  throw new Error(
    `[story-compiler] ${sourcePath}: invalid bgm block; expected one lowercase hyphenated cue key or stop`
  );
}
```

When emitting either default-speaker narration or a named-speaker entry:

```ts
if (pendingBgm !== undefined) {
  entry.bgm = pendingBgm;
  pendingBgm = undefined;
}
```

After the loop:

```ts
if (pendingBgm !== undefined) {
  throw new Error(
    `[story-compiler] ${sourcePath}: unconsumed bgm at end of scene`
  );
}
```

- [ ] **Step 7: Run parser tests and confirm GREEN**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add failing emitter tests for string/null/omission**

Create IR entries carrying `bgm: 'dawn-apartment'`, `bgm: null`, and no BGM. Assert generated output contains:

```text
bgm: "dawn-apartment"
bgm: null
```

and omits BGM on the third entry.

- [ ] **Step 9: Run emitter tests and confirm RED**

```bash
bun --filter @aquila/stories test -- emit.test.ts
```

Expected: FAIL because emitter ignores BGM.

- [ ] **Step 10: Emit BGM with an explicit undefined check**

In `emitSceneFile`:

```ts
if (e.bgm !== undefined) {
  parts.push(`bgm: ${e.bgm === null ? 'null' : q(e.bgm)}`);
}
```

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

Use two fake audio elements with `play`, `pause`, writable `currentTime`, and writable `loop`.

```ts
expect(resolveLocalBgmUrl('unknown')).toBeUndefined();

const first = fakeAudio();
const second = fakeAudio();
const createAudio = vi
  .fn()
  .mockReturnValueOnce(first)
  .mockReturnValueOnce(second);
const player = createBgmPlayer(createAudio);

player.play('dawn-apartment');
expect(first.loop).toBe(true);
expect(first.play).toHaveBeenCalledTimes(1);

player.play('dawn-apartment');
expect(createAudio).toHaveBeenCalledTimes(1);

player.play('tension-pulse');
expect(first.pause).toHaveBeenCalledTimes(1);
expect(first.currentTime).toBe(0);
expect(second.play).toHaveBeenCalledTimes(1);
```

Add cases for unknown runtime key logging, `stop()`, idempotent `dispose()`, synchronous `play()` throw, rejected `play()` promise, and same-key retry after rejection.

- [ ] **Step 2: Write failing preference tests**

```ts
expect(readBgmEnabled(emptyStorage)).toBe(true);
writeBgmEnabled(false, storage);
expect(storage.getItem(BGM_ENABLED_KEY)).toBe('false');
expect(readBgmEnabled(storage)).toBe(false);
expect(readBgmEnabled(null)).toBe(true);
```

Use fake storages whose `getItem` and `setItem` throw and assert reads default true/writes do not throw.

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

- [ ] **Step 5: Implement the native looping player**

Create `bgm-player.ts`:

```ts
import { logger } from '@/lib/logger';
import { resolveLocalBgmUrl } from './bgm-catalog';

export interface BgmPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}

type AudioLike = Pick<
  HTMLAudioElement,
  'play' | 'pause' | 'currentTime' | 'loop'
>;
type CreateAudio = (src: string) => AudioLike;

export function createBgmPlayer(
  createAudio: CreateAudio = src => new Audio(src)
): BgmPlayer {
  let current: AudioLike | null = null;
  let currentKey: string | null = null;
  let disposed = false;

  function stopCurrent(): void {
    const audio = current;
    current = null;
    currentKey = null;
    if (!audio) return;
    try {
      audio.pause();
    } catch {
      // Best-effort loop cleanup.
    }
    try {
      audio.currentTime = 0;
    } catch {
      // Best-effort loop cleanup.
    }
  }

  return {
    play(cueKey: string): void {
      if (disposed) return;
      const src = resolveLocalBgmUrl(cueKey);
      if (!src) {
        logger.warn('Unknown visual-novel BGM cue', { cueKey });
        return;
      }
      if (current && currentKey === cueKey) return;

      stopCurrent();
      try {
        const audio = createAudio(src);
        audio.loop = true;
        current = audio;
        currentKey = cueKey;
        const result = audio.play();
        void result.catch(() => {
          if (current === audio) {
            current = null;
            currentKey = null;
          }
        });
      } catch {
        current = null;
        currentKey = null;
      }
    },
    stop(): void {
      stopCurrent();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopCurrent();
    },
  };
}
```

- [ ] **Step 6: Implement the direct BGM preference**

Create `bgm-preference.ts`:

```ts
import { getBrowserStorage } from '@/lib/reader-mode';

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

Add/retain a test that snapshots the committed SFX fixture bytes, runs `buildSfxFixtures()`, rereads those files, and asserts byte equality. Keep the existing verify-mode drift rejection test.

- [ ] **Step 2: Add failing generic-helper and BGM tests**

Use a temporary directory:

```ts
const fixtureBytes = {
  'a.wav': Buffer.from('a'),
  'b.wav': Buffer.from('b'),
};
await buildAudioFixtures(tmpDir, fixtureBytes);
expect(await readFile(resolve(tmpDir, 'a.wav'))).toEqual(fixtureBytes['a.wav']);
expect(await readFile(resolve(tmpDir, 'b.wav'))).toEqual(fixtureBytes['b.wav']);
```

For BGM, assert generated file names equal:

```ts
['dawn-apartment.wav', 'tension-pulse.wav']
```

and verify mode rejects byte drift.

- [ ] **Step 3: Run fixture tests and confirm RED**

```bash
bun --filter web test -- build-sfx-fixtures.test.ts build-bgm-fixtures.test.ts
```

Expected: BGM/generic-helper tests fail.

- [ ] **Step 4: Extract the full PCM and file-loop helper**

Create `audio-fixture.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const AUDIO_FIXTURE_SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function pcm16Wav(samples: Int16Array): Buffer {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(AUDIO_FIXTURE_SAMPLE_RATE, 24);
  buffer.writeUInt32LE(AUDIO_FIXTURE_SAMPLE_RATE * CHANNELS * 2, 28);
  buffer.writeUInt16LE(CHANNELS * 2, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buffer;
}

export function synthPcm16Wav(
  durationMs: number,
  sampleAt: (timeSeconds: number, progress: number) => number
): Buffer {
  const count = Math.round(
    (AUDIO_FIXTURE_SAMPLE_RATE * durationMs) / 1000
  );
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / AUDIO_FIXTURE_SAMPLE_RATE;
    const progress = i / Math.max(1, count - 1);
    const value = Math.max(-1, Math.min(1, sampleAt(t, progress)));
    samples[i] = Math.round(value * 0x7fff);
  }
  return pcm16Wav(samples);
}

export function verifyPcm16Wav(name: string, bytes: Buffer): void {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF')
    throw new Error(`${name}: RIFF`);
  if (bytes.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error(`${name}: WAVE`);
  if (bytes.toString('ascii', 12, 16) !== 'fmt ')
    throw new Error(`${name}: fmt`);
  if (bytes.readUInt16LE(20) !== 1) throw new Error(`${name}: not PCM`);
  if (bytes.readUInt16LE(22) !== 1) throw new Error(`${name}: not mono`);
  if (bytes.readUInt16LE(34) !== 16) throw new Error(`${name}: not PCM-16`);
  if (bytes.toString('ascii', 36, 40) !== 'data')
    throw new Error(`${name}: data`);
  const dataBytes = bytes.readUInt32LE(40);
  if (dataBytes <= 0 || bytes.length !== 44 + dataBytes) {
    throw new Error(`${name}: invalid data length`);
  }
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

- [ ] **Step 5: Refactor SFX to shared helpers and verify bytes immediately**

Keep the current SFX `fixtures()` formulas and output path. Replace synthesis calls with `synthPcm16Wav`, then define:

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
git diff --exit-code -- apps/web/public/assets/vn/audio/sfx
```

Expected: PASS and no SFX binary diff.

- [ ] **Step 6: Implement the BGM fixture script**

Create `build-bgm-fixtures.ts`:

```ts
import { resolve } from 'node:path';
import {
  buildAudioFixtures,
  runAudioFixtureCli,
  synthPcm16Wav,
  verifyAudioFixtures,
} from './audio-fixture';

const outputRoot = resolve(process.cwd(), 'public/assets/vn/audio/bgm');

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

export async function buildBgmFixtures(): Promise<void> {
  await buildAudioFixtures(outputRoot, fixtures());
}

export async function verifyBgmFixtures(): Promise<void> {
  await verifyAudioFixtures(outputRoot, fixtures());
}

if (import.meta.main) {
  await runAudioFixtureCli(buildBgmFixtures, verifyBgmFixtures);
}
```

- [ ] **Step 7: Add package commands and CI verification**

Add to `apps/web/package.json`:

```json
"build:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts",
"verify:bgm-fixtures": "bun scripts/build-bgm-fixtures.ts --verify"
```

Add beside the existing fixture verification in `.github/workflows/build-and-lint.yml`:

```bash
bun --filter web verify:bgm-fixtures
```

- [ ] **Step 8: Generate and verify BGM fixtures**

```bash
bun --filter web build:bgm-fixtures
bun --filter web verify:bgm-fixtures
bun --filter web test -- build-sfx-fixtures.test.ts build-bgm-fixtures.test.ts
```

Expected: PASS and exactly two new WAVs under `public/assets/vn/audio/bgm/`.

- [ ] **Step 9: Commit the fixture slice**

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

Add:

```ts
bgmEnabled: true,
onBgmEnabledChange: vi.fn(),
```

- [ ] **Step 2: Add failing Visual/Text settings tests**

```ts
expect(
  screen.getByRole('button', { name: /background music/i })
).toHaveAttribute('aria-pressed', 'true');
```

Click the BGM button and assert `onBgmEnabledChange(false)` fires while the SFX callback does not.

Render `mode="text"` and assert both audio toggle labels are absent.

- [ ] **Step 3: Run settings tests and confirm RED**

```bash
bun --filter web test -- ReaderSettingsMenu.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Add exact translations**

English:

```json
"backgroundMusic": "Background Music",
"backgroundMusicOn": "On",
"backgroundMusicOff": "Off"
```

Traditional Chinese:

```json
"backgroundMusic": "背景音樂",
"backgroundMusicOn": "開啟",
"backgroundMusicOff": "關閉"
```

- [ ] **Step 5: Add required props and the Visual-only toggle**

Props:

```ts
bgmEnabled: boolean;
onBgmEnabledChange: (enabled: boolean) => void;
```

Inside the existing `{#if mode === 'visual'}` block, add a button with the same classes as the SFX toggle:

```svelte
<button
  type="button"
  class="flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
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
- Reuses/exports: `isForwardAdjacent(previous, next, flow)` from `sfx-transition.ts`; body unchanged.
- Produces: `activeBgmAt(entries, index): string | null | undefined`.
- Produces: `nextBgmSelection(previous, next, entries, selectedKey, flow): string | null`.
- Consumes: `createBgmPlayer?: () => BgmPlayer`, `readBgmEnabled`, `writeBgmEnabled`.
- Produces: plain shell-local `selectedBgmKey` and `bgmActivated`, plus reactive `bgmEnabled`.

- [ ] **Step 1: Write failing pure selection tests**

Create `bgm-transition.test.ts` with:

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
expect(activeBgmAt([], 0)).toBeUndefined();
```

Build minimal `LinePosition` fixtures and direct-linear/direct-choice/jump flows, then assert:

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

Add assertions for:

- direct choice edge retains inherited selection;
- same-scene backward and `+2` jump with no local answer return `null`;
- non-forward destination with local `tension-pulse` returns that key;
- non-forward destination with local `null` returns `null`;
- fresh cue-less scene returns `null`;
- story replacement cue-less scene returns `null`;
- story replacement with local command returns that command.

- [ ] **Step 2: Run selection tests and confirm RED**

```bash
bun --filter web test -- bgm-transition.test.ts
```

Expected: FAIL because helpers do not exist and `isForwardAdjacent` is private.

- [ ] **Step 3: Export the existing structural helper and implement BGM selection**

In `sfx-transition.ts`, only add `export`:

```ts
export function isForwardAdjacent(
  previous: LinePosition,
  next: LinePosition,
  flow: StoryFlowConfig | null
): boolean {
  if (previous.storyId !== next.storyId) return false;
  if (previous.sceneId === next.sceneId) {
    return next.index === previous.index + 1;
  }
  return (
    next.index === 0 &&
    isDirectFlowEdge(flow, previous.sceneId, next.sceneId)
  );
}
```

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

- [ ] **Step 4: Run selection + SFX transition tests and confirm GREEN**

```bash
bun --filter web test -- bgm-transition.test.ts sfx-transition.test.ts
```

Expected: PASS.

- [ ] **Step 5: Extend the ReaderShell harness and add failing real-path activation tests**

Inject:

```ts
const bgmPlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
};
```

Use a scene where line 0 has `dawn-apartment` and initial `dialogueIndex = 1`. Assert initial render does not play, then:

```ts
await fireEvent.pointerDown(screen.getByTestId('reader-ready'));
expect(bgmPlayer.play).toHaveBeenCalledWith('dawn-apartment');
```

For keyboard, rerender/reset the harness and dispatch from `document.body`:

```ts
await fireEvent.keyDown(document.body, { key: 'Enter' });
expect(bgmPlayer.play).toHaveBeenCalledWith('dawn-apartment');
```

Repeat for Space. Assert ArrowDown, Ctrl+Enter, and Enter on the Settings button do not activate.

- [ ] **Step 6: Add failing selection/jump/lifecycle wiring tests**

Cover:

- forward cue-less line: no extra play/stop;
- local same-key result: no restart;
- local `tension-pulse`: one `play('tension-pulse')` when activated;
- local `null`: one stop;
- existing `jumpFlow` to cue-less non-adjacent `act3`: stop/clear, then another activation does not replay stale `dawn-apartment`;
- non-forward destination whose local scan finds `tension-pulse`: select/play that local key;
- Visual -> Text stops/resets activation but retains selection;
- Text -> Visual no autoplay, next eligible gesture resumes;
- disable stops/resets activation, Visual re-enable from Settings resumes selection;
- responsive remount no restart;
- story replacement stops old audio, resets activation, scans new scene, arms local key without autoplay;
- SFX plays independently while BGM active;
- destroy disposes once.

- [ ] **Step 7: Run ReaderShell tests and confirm RED**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL.

- [ ] **Step 8: Add BGM state/factory to ReaderShell**

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

Add `createBgmPlayer = createDefaultBgmPlayer` to props and type it as `() => BgmPlayer`/`typeof createDefaultBgmPlayer` in the same style as SFX.

Initialize:

```ts
const bgmPlayer = createBgmPlayer();
let bgmEnabled = $state(readBgmEnabled());
let selectedBgmKey: string | null = null;
let bgmActivated = false;
```

- [ ] **Step 9: Add scoped pointer activation and window keyboard activation**

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

Add at shell level:

```svelte
<svelte:window onkeydown={handleBgmActivationKey} />
```

Add `onpointerdown={activateBgm}` to the existing `data-testid="reader-ready"` div. Do not register pointer activation on `window`.

- [ ] **Step 10: Apply selection diffs in the existing position effect**

After existing visual/SFX handling:

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

`selectedBgmKey` and `bgmActivated` are plain variables, so this does not add reactive self-dependencies to the effect.

- [ ] **Step 11: Add mode/preference lifecycle and Settings props**

When switching to Text inside `setReaderMode`:

```ts
if (mode === 'text') {
  sfxPlayer.stop();
  bgmPlayer.stop();
  bgmActivated = false;
}
```

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

Pass:

```svelte
{bgmEnabled}
onBgmEnabledChange={setBgmEnabled}
```

to `ReaderSettingsMenu`.

In `onDestroy`, call:

```ts
bgmPlayer.dispose();
```

beside `sfxPlayer.dispose()`.

- [ ] **Step 12: Run ReaderShell and focused audio tests and confirm GREEN**

```bash
bun --filter web test -- ReaderShell.test.ts
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

Expected: PASS.

- [ ] **Step 13: Commit the selection/lifecycle slice**

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

- [ ] **Step 1: Add the pinned calm opening command in Act 1**

````markdown
```bgm
dawn-apartment
```

**旁白**：手機螢幕亮了。
````

- [ ] **Step 2: Add the pinned tension change in Act 4**

````markdown
```bgm
tension-pulse
```

**朝倉澪**：兩週前。悠真收到學校轉發的「關東青少年睡眠支援計畫」通知。
````

- [ ] **Step 3: Add the pinned stop in Act 4**

````markdown
```bgm
stop
```

**旁白**：澪點頭。琴音走出咖啡店的時候，下午的陽光從門口斜進來，把她的影子拉得很長，像一條安靜的尾巴。
````

Do not add a fourth BGM block and do not move/change the existing `notification-beep` SFX block.

- [ ] **Step 4: Compile generated stories**

```bash
bun run compile:stories
```

Expected: generated Act 1/Act 4 scenes update.

- [ ] **Step 5: Assert the real generated payloads literally exist**

```bash
grep -F 'bgm: "dawn-apartment"' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts
grep -F 'bgm: "tension-pulse"' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
grep -F 'bgm: null' \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
```

Expected: three matching generated lines.

- [ ] **Step 6: Inspect raw/generated scope**

```bash
git diff -- packages/stories/raw/theSeventhMirror \
  packages/stories/src/generated/theSeventhMirror
```

Confirm exactly three raw BGM blocks, unchanged `notification-beep`, and only corresponding generated payload changes.

- [ ] **Step 7: Run stories tests and drift check**

```bash
bun --filter @aquila/stories test
bun run compile:check
```

Expected: PASS.

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
- No planned production-file changes. A verification failure must be fixed with the smallest focused regression test and corresponding code change before rerunning the affected checks.

**Interfaces:**
- Verifies the complete HPA-605 contract and deferred-boundary discipline.

- [ ] **Step 1: Run the full stories suite**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 2: Run web tests with coverage**

```bash
bun --filter web test:coverage
```

Expected: PASS with configured project/patch coverage at or above 95%.

- [ ] **Step 3: Verify audio fixtures**

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

With headphones/local reader:

1. Fresh Visual load at Act 1 line 0 is silent.
2. Pointer interaction on reader content starts `dawn-apartment`.
3. Reload a later Act 1 line; no autoplay, then first pointer/Enter/Space gesture starts `dawn-apartment` from current-scene scan.
4. Keyboard-only Enter/Space from normal body focus activates BGM while reader keyboard navigation continues.
5. Forward cue-less lines do not restart.
6. Direct linear/choice scene progression without a local destination command retains inherited BGM.
7. Cue-less non-adjacent Act-panel jump to a scene with no local command stops/clears stale BGM; another gesture does not resurrect it.
8. Jump/backward movement to a destination with an earlier local BGM command uses that local command.
9. Act 4 tension line switches once to `tension-pulse`.
10. Existing `notification-beep` SFX overlays independently.
11. Pinned `stop` becomes silent.
12. SFX/BGM toggles persist independently; BGM disable stops immediately and Visual re-enable may resume from the settings click.
13. Visual -> Text stops; Text -> Visual does not autoplay; next eligible Visual gesture resumes retained selection.
14. Responsive remount does not restart.
15. Fresh restore in a scene with no local BGM command stays silent rather than traversing prior scenes/history.

- [ ] **Step 6: Run the final YAGNI audit**

Reject/remove any diff introducing:

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
- Visual-only BGM setting;
- current-scene BGM selection helper + minimal SFX helper export;
- `ReaderShell` playback/activation lifecycle/tests;
- exactly three raw BGM commands plus generated payloads;
- design/plan docs.
