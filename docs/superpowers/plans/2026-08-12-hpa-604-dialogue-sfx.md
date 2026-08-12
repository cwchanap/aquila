# HPA-604 Dialogue-Triggered SFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let story authors attach one logical SFX cue to a dialogue line and have Visual mode play that cue once on a genuine line transition, with a persisted on/off setting and three local fixture cues.

**Architecture:** Extend the existing story compiler pipeline with one optional `sfx` string, then keep playback at the stable `ReaderShell` boundary instead of in responsive reader leaves. A tiny web-only native-audio adapter resolves logical keys from a static local catalog; no audio manager, event bus, manifest, or production delivery abstraction is introduced.

**Tech Stack:** Bun 1.3.1, TypeScript, Svelte 5, Astro web app, Vitest + Testing Library, native `HTMLAudioElement`, existing Aquila story compiler.

## Global Constraints

- SFX authoring uses a fenced `sfx` block that applies to exactly the next emitted dialogue entry.
- Runtime/compiler payload is only `sfx?: string`; it must not encode URLs, providers, volume, delay, or channel metadata.
- Playback is Visual-mode-only and owned by `ReaderShell` using stable story/scene/dialogue identity.
- Initial/restored lines are silent; Text -> Visual, re-enable, rerender, overlays, and responsive remounts must not replay the current line.
- A new cue replaces the currently playing one-shot; a cue-less line does not implicitly stop it.
- Visual -> Text, disabling SFX, story replacement, and shell destruction stop/clean up audio.
- Playback/storage failures are best-effort and must never block reading or navigation.
- SFX preference key is `aquila:sfx-enabled:v1`, default enabled.
- The only local fixture keys in this slice are `door-open`, `notification-beep`, and `impact`.
- Do not add BGM, ambience, voice, volume controls, an audio framework, a generic event/timeline layer, R2 audio delivery, ElevenLabs runtime integration, Phaser parity, preload/cache infrastructure, or analytics.

---

## File Map

### Story/compiler contract

- Modify `packages/stories/src/compiler/parse-scene.ts` — parse fenced `sfx` blocks and consume them on the next emitted entry.
- Modify `packages/stories/src/compiler/ir.ts` — add `sfx?: string` to `DialogueEntryIR`.
- Modify `packages/stories/src/types.ts` — add `sfx?: string` to runtime `DialogueEntry`.
- Modify `packages/stories/src/compiler/emit.ts` — emit `sfx` only when authored.
- Modify `packages/stories/src/compiler/__tests__/parse-scene.test.ts` — parser contract tests.
- Modify `packages/stories/src/compiler/__tests__/emit.test.ts` — generated-output contract tests.

### Web audio boundary

- Create `apps/web/src/lib/audio/sfx-catalog.ts` — logical cue -> local public URL mapping.
- Create `apps/web/src/lib/audio/sfx-player.ts` — one-shot native audio adapter and injectable audio factory.
- Create `apps/web/src/lib/audio/sfx-preference.ts` — failure-tolerant persisted boolean.
- Create `apps/web/src/lib/audio/__tests__/sfx-player.test.ts` — replacement/error/cleanup tests.
- Create `apps/web/src/lib/audio/__tests__/sfx-preference.test.ts` — preference tests.
- Create `apps/web/public/assets/vn/audio/sfx/door-open.wav` — local demo fixture.
- Create `apps/web/public/assets/vn/audio/sfx/notification-beep.wav` — local demo fixture.
- Create `apps/web/public/assets/vn/audio/sfx/impact.wav` — local demo fixture.

### Reader integration

- Modify `apps/web/src/components/ReaderShell.svelte` — own SFX preference, stable transition detection, stop/dispose lifecycle, and player injection.
- Modify `apps/web/src/components/ReaderSettingsMenu.svelte` — add the SFX toggle to the existing shared settings dialog.
- Modify `apps/web/src/components/__tests__/ReaderShell.test.ts` — shell-level playback/remount/mode/preference tests.
- Modify `packages/stories/src/translations/en.json` — English SFX settings labels.
- Modify `packages/stories/src/translations/zh.json` — Traditional Chinese SFX settings labels.

### Minimal authored demo

- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act1.md` — annotate one foot-to-floor impact and one bedroom-door opening.
- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act4.md` — annotate the existing phone-ringing beat.
- Regenerate the affected `packages/stories/src/generated/theSeventhMirror/**` output with the existing compiler; do not hand-edit generated files.

---

### Task 1: Carry one SFX key through the story compiler

**Files:**
- Modify: `packages/stories/src/compiler/parse-scene.ts`
- Modify: `packages/stories/src/compiler/ir.ts`
- Modify: `packages/stories/src/types.ts`
- Modify: `packages/stories/src/compiler/emit.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

**Interfaces:**
- Consumes authoring syntax:

````markdown
```sfx
door-open
```

**旁白**：澪推開悠真的房門。
````

- Produces:

```ts
export interface DialogueEntryIR {
  // existing fields...
  sfx?: string;
}

export type DialogueEntry = {
  // existing fields...
  sfx?: string;
};
```

- [ ] **Step 1: Add failing parser tests for exact-next-entry consumption**

Append focused cases to `parse-scene.test.ts`:

```ts
it('applies an sfx block to exactly the next dialogue entry', () => {
    const md = [
        '```sfx',
        'door-open',
        '```',
        '',
        '**旁白**：門開了。',
        '',
        '**李杰**：進來吧。',
    ].join('\n');

    const result = parseScene(md, resolve, 'act1.md');

    expect(result.entries[0]).toMatchObject({
        dialogue: '門開了。',
        sfx: 'door-open',
    });
    expect(result.entries[1].sfx).toBeUndefined();
});

it('applies an sfx block to default-speaker narration', () => {
    const narrator = { id: 'narrator', displayName: '旁白' };
    const md = ['```sfx', 'impact', '```', '', '門砰地關上。'].join('\n');

    const result = parseScene(md, resolve, 'act1.md', narrator);

    expect(result.entries[0]).toMatchObject({
        dialogue: '門砰地關上。',
        sfx: 'impact',
    });
});

it('rejects an empty sfx cue key', () => {
    const md = ['```sfx', '   ', '```', '', '**旁白**：hello'].join('\n');

    expect(() => parseScene(md, resolve, 'act1.md')).toThrow(
        /empty sfx cue/i
    );
});
```

- [ ] **Step 2: Run the parser tests and confirm they fail before implementation**

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: the new cases fail because `sfx` blocks are currently unrecognized and `DialogueEntryIR` has no `sfx` field.

- [ ] **Step 3: Add the minimal parser and IR/runtime fields**

In `ir.ts` and `types.ts`, add only:

```ts
sfx?: string;
```

In `parse-scene.ts`, add a dedicated block matcher beside `BG_BLOCK_RE`:

```ts
const SFX_BLOCK_RE = /^```sfx\s*\n([\s\S]*?)\n```$/;
```

Track pending state beside `pendingBg`:

```ts
let pendingSfx: string | undefined;
```

Before normal dialogue parsing, consume an SFX block without emitting an entry:

```ts
const sfxMatch = SFX_BLOCK_RE.exec(block);
if (sfxMatch) {
    const cueKey = sfxMatch[1].trim();
    if (!cueKey) {
        throw new Error(
            `[story-compiler] ${sourcePath}: empty sfx cue key`
        );
    }
    pendingSfx = cueKey;
    continue;
}
```

When either an explicit-speaker or default-speaker entry is constructed, spread and clear the pending cue exactly like one-shot metadata:

```ts
...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
```

Immediately after pushing that entry:

```ts
pendingSfx = undefined;
```

Do not validate the cue against the web catalog and do not add another authoring syntax.

- [ ] **Step 4: Make emitter output conditional and add failing/passing output assertions**

In `emitSceneFile`, after the required `dialogue` part, emit the logical key only when present:

```ts
if (e.sfx) {
    parts.push(`sfx: ${q(e.sfx)}`);
}
```

Extend `emit.test.ts` with a story entry containing `sfx: 'door-open'` and assert both positive and omission behavior:

```ts
expect(scene).toContain('sfx: "door-open"');
```

For a no-SFX fixture:

```ts
expect(scene).not.toContain('sfx:');
```

- [ ] **Step 5: Run the story compiler unit tests**

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts emit.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the compiler contract**

```bash
git add packages/stories/src/compiler/parse-scene.ts \
  packages/stories/src/compiler/ir.ts \
  packages/stories/src/types.ts \
  packages/stories/src/compiler/emit.ts \
  packages/stories/src/compiler/__tests__/parse-scene.test.ts \
  packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat(stories): add dialogue sfx cues"
```

---

### Task 2: Add the tiny native SFX player and persisted preference

**Files:**
- Create: `apps/web/src/lib/audio/sfx-catalog.ts`
- Create: `apps/web/src/lib/audio/sfx-player.ts`
- Create: `apps/web/src/lib/audio/sfx-preference.ts`
- Test: `apps/web/src/lib/audio/__tests__/sfx-player.test.ts`
- Test: `apps/web/src/lib/audio/__tests__/sfx-preference.test.ts`

**Interfaces:**
- Produces:

```ts
export type SfxCatalog = Readonly<Record<string, string>>;

export interface SfxAudio {
  currentTime: number;
  pause(): void;
  play(): Promise<void>;
}

export type SfxAudioFactory = (url: string) => SfxAudio;

export interface SfxPlayer {
  play(cueKey: string): void;
  stop(): void;
  dispose(): void;
}

export function createSfxPlayer(
  catalog?: SfxCatalog,
  createAudio?: SfxAudioFactory
): SfxPlayer;

export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';
export function readSfxEnabled(storage?: Storage | null): boolean;
export function writeSfxEnabled(enabled: boolean, storage?: Storage | null): void;
```

- [ ] **Step 1: Write the player tests first**

Create `sfx-player.test.ts` around an injected fake audio factory so tests never depend on jsdom media support:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSfxPlayer, type SfxAudio } from '../sfx-player';

function fakeAudio() {
    const audio: SfxAudio = {
        currentTime: 4,
        pause: vi.fn(),
        play: vi.fn(async () => {}),
    };
    return audio;
}

describe('createSfxPlayer', () => {
    it('resolves a catalog cue and starts it', () => {
        const audio = fakeAudio();
        const factory = vi.fn(() => audio);
        const player = createSfxPlayer(
            { 'door-open': '/door.wav' },
            factory
        );

        player.play('door-open');

        expect(factory).toHaveBeenCalledWith('/door.wav');
        expect(audio.play).toHaveBeenCalledOnce();
    });

    it('stops and rewinds the previous cue before a replacement', () => {
        const first = fakeAudio();
        const second = fakeAudio();
        const factory = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createSfxPlayer(
            { a: '/a.wav', b: '/b.wav' },
            factory
        );

        player.play('a');
        player.play('b');

        expect(first.pause).toHaveBeenCalledOnce();
        expect(first.currentTime).toBe(0);
        expect(second.play).toHaveBeenCalledOnce();
    });

    it('ignores unknown cues', () => {
        const factory = vi.fn();
        const player = createSfxPlayer({}, factory);

        player.play('missing');

        expect(factory).not.toHaveBeenCalled();
    });

    it('contains rejected play promises', async () => {
        const audio = fakeAudio();
        audio.play = vi.fn(async () => {
            throw new Error('autoplay rejected');
        });
        const player = createSfxPlayer({ a: '/a.wav' }, () => audio);

        expect(() => player.play('a')).not.toThrow();
        await Promise.resolve();
    });

    it('stops on dispose and becomes inert', () => {
        const audio = fakeAudio();
        const factory = vi.fn(() => audio);
        const player = createSfxPlayer({ a: '/a.wav' }, factory);

        player.play('a');
        player.dispose();
        player.play('a');

        expect(audio.pause).toHaveBeenCalledOnce();
        expect(audio.currentTime).toBe(0);
        expect(factory).toHaveBeenCalledOnce();
    });
});
```

Also add one test where `pause`, assigning `currentTime`, or the factory throws; the public method must still not throw.

- [ ] **Step 2: Write preference tests first**

Create `sfx-preference.test.ts` with a tiny `Storage` stub and cover:

```ts
expect(readSfxEnabled(storageWithNoValue)).toBe(true);
expect(readSfxEnabled(storageWithFalse)).toBe(false);
writeSfxEnabled(false, storage);
expect(storage.getItem(SFX_ENABLED_KEY)).toBe('false');
writeSfxEnabled(true, storage);
expect(storage.getItem(SFX_ENABLED_KEY)).toBe('true');
```

Add a throwing storage stub and assert reads return `true` while writes do not throw.

- [ ] **Step 3: Run the new web tests and confirm they fail because modules do not exist**

```bash
bun --filter web test -- sfx-player.test.ts sfx-preference.test.ts
```

Expected: FAIL with unresolved modules.

- [ ] **Step 4: Implement the static catalog**

Create `sfx-catalog.ts`:

```ts
export type SfxCatalog = Readonly<Record<string, string>>;

export const LOCAL_SFX_CATALOG: SfxCatalog = {
    'door-open': '/assets/vn/audio/sfx/door-open.wav',
    'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
    impact: '/assets/vn/audio/sfx/impact.wav',
};
```

Keep this as a literal mapping; do not introduce manifests, loaders, classes, or async resolution.

- [ ] **Step 5: Implement the one-shot native player**

Create `sfx-player.ts`:

```ts
import {
    LOCAL_SFX_CATALOG,
    type SfxCatalog,
} from './sfx-catalog';

export interface SfxAudio {
    currentTime: number;
    pause(): void;
    play(): Promise<void>;
}

export type SfxAudioFactory = (url: string) => SfxAudio;

export interface SfxPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

export function createSfxPlayer(
    catalog: SfxCatalog = LOCAL_SFX_CATALOG,
    createAudio: SfxAudioFactory = url => new Audio(url)
): SfxPlayer {
    let current: SfxAudio | null = null;
    let disposed = false;

    const stopCurrent = (): void => {
        const audio = current;
        current = null;
        if (!audio) return;
        try {
            audio.pause();
        } catch {
            // Audio is best-effort.
        }
        try {
            audio.currentTime = 0;
        } catch {
            // Some media implementations reject seeking.
        }
    };

    return {
        play(cueKey) {
            if (disposed) return;
            stopCurrent();
            const url = catalog[cueKey];
            if (!url) return;

            try {
                const audio = createAudio(url);
                current = audio;
                void audio.play().catch(() => {
                    if (current === audio) current = null;
                });
            } catch {
                current = null;
            }
        },
        stop() {
            stopCurrent();
        },
        dispose() {
            disposed = true;
            stopCurrent();
        },
    };
}
```

- [ ] **Step 6: Implement the persisted boolean without a new settings store**

Create `sfx-preference.ts`:

```ts
export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';

function getStorage(): Storage | null {
    try {
        const storage = globalThis.localStorage;
        return typeof storage === 'undefined' ? null : storage;
    } catch {
        return null;
    }
}

export function readSfxEnabled(
    storage: Storage | null = getStorage()
): boolean {
    try {
        return storage?.getItem(SFX_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function writeSfxEnabled(
    enabled: boolean,
    storage: Storage | null = getStorage()
): void {
    try {
        storage?.setItem(SFX_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch {
        return;
    }
}
```

Do not refactor `reader-mode.ts` or create a generic preference framework for two small keys.

- [ ] **Step 7: Run the focused tests**

```bash
bun --filter web test -- sfx-player.test.ts sfx-preference.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the web audio primitives**

```bash
git add apps/web/src/lib/audio
git commit -m "feat(web): add native visual novel sfx player"
```

---

### Task 3: Make ReaderShell the single playback lifecycle owner

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`

**Interfaces:**
- Consumes from Task 2:

```ts
createSfxPlayer(): SfxPlayer
readSfxEnabled(): boolean
writeSfxEnabled(enabled: boolean): void
```

- Adds optional shell injection for tests:

```ts
createSfxPlayer?: () => SfxPlayer;
```

- Adds settings props:

```ts
sfxEnabled: boolean;
onSfxEnabledChange: (enabled: boolean) => void;
```

- [ ] **Step 1: Add an injectable fake-player harness and failing ReaderShell tests**

In `ReaderShell.test.ts`, import `SfxPlayer` and use:

```ts
function createSfxHarness(): SfxPlayer & {
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
} {
    return {
        play: vi.fn(),
        stop: vi.fn(),
        dispose: vi.fn(),
    };
}
```

For SFX-specific tests, seed explicit cues without changing the shared `mockDialogue` used by unrelated tests:

```ts
readerState.dialogue = [
    { dialogue: 'Initial line.' },
    { dialogue: 'Door line.', sfx: 'door-open' },
    { dialogue: 'No cue.' },
    { dialogue: 'Impact line.', sfx: 'impact' },
];
```

Add separate tests proving:

1. persisted Visual mode plus an initial/restored cued line stays silent;
2. advancing from index 0 -> 1 in Visual calls `play('door-open')` exactly once;
3. extra `tick()` calls, settings open/close, and a desktop/mobile breakpoint change do not increase the call count;
4. advancing in Text updates progression but never calls `play`;
5. Visual -> Text calls `stop`;
6. disabling SFX calls `stop`, persists false, and re-enabling does not replay the current line;
7. changing `storyId` calls `stop` and primes the replacement line silently even when scene/index are the same;
8. unmount calls `dispose`.

Keep these in `ReaderShell.test.ts`; do not add playback behavior to `VisualNovelReader.test.ts`.

- [ ] **Step 2: Run the ReaderShell test and confirm the new cases fail**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL because the shell has no SFX player/preference integration yet.

- [ ] **Step 3: Add shell-owned preference and player injection**

Alias the default factory so the prop can keep the clear `createSfxPlayer` name:

```ts
import {
    createSfxPlayer as createDefaultSfxPlayer,
    type SfxPlayer,
} from '@/lib/audio/sfx-player';
import {
    readSfxEnabled,
    writeSfxEnabled,
} from '@/lib/audio/sfx-preference';
```

Add to `$props()`:

```ts
createSfxPlayer = createDefaultSfxPlayer,
```

and its type:

```ts
createSfxPlayer?: () => SfxPlayer;
```

Create shell state once, beside the other shell-owned preferences/lifecycles:

```ts
let sfxEnabled = $state(readSfxEnabled());
const sfxPlayer = createSfxPlayer();
```

Add the settings callback:

```ts
function setSfxEnabled(enabled: boolean): void {
    if (sfxEnabled === enabled) return;
    sfxEnabled = enabled;
    writeSfxEnabled(enabled);
    if (!enabled) sfxPlayer.stop();
}
```

When `setReaderMode` transitions to Text, stop before returning control to the Text leaf:

```ts
if (mode === 'text') sfxPlayer.stop();
```

- [ ] **Step 4: Add a separate line-transition effect with silent priming**

Do not merge this responsibility into the existing visual-runtime revalidation effect. Add state and an effect whose only inputs are story/line identity, active payload, cue, mode, and SFX enabled:

```ts
let sfxStoryId: string | null = $state(null);
let sfxLineKey: string | null = $state(null);

$effect(() => {
    const activeStoryId = storyId;
    const activeLineKey = `${currentSceneId}\u0000${dialogueIndex}`;
    const cueKey = dialogue[dialogueIndex]?.sfx;

    if (sfxStoryId !== null && sfxStoryId !== activeStoryId) {
        sfxPlayer.stop();
        sfxStoryId = activeStoryId;
        sfxLineKey = hasActivePayload && activeFlow ? activeLineKey : null;
        return;
    }

    if (!hasActivePayload || !activeFlow) return;

    if (sfxStoryId === null || sfxLineKey === null) {
        sfxStoryId = activeStoryId;
        sfxLineKey = activeLineKey;
        return;
    }

    if (activeLineKey === sfxLineKey) return;
    sfxLineKey = activeLineKey;

    if (readerMode === 'visual' && sfxEnabled && cueKey) {
        sfxPlayer.play(cueKey);
    }
});
```

This ordering is important: mode/preference changes rerun the effect, but the unchanged line key returns before playback; a story replacement stops even if its payload is not ready yet; the first payload-backed line is always primed silently.

In `onDestroy`, add synchronous SFX cleanup alongside the existing visual-runtime cleanup:

```ts
sfxPlayer.dispose();
```

- [ ] **Step 5: Add the existing-settings-surface toggle and translations**

Pass from `ReaderShell` to `ReaderSettingsMenu`:

```svelte
{sfxEnabled}
onSfxEnabledChange={setSfxEnabled}
```

Add these props to `ReaderSettingsMenu.svelte`:

```ts
sfxEnabled: boolean;
onSfxEnabledChange: (enabled: boolean) => void;
```

Render one button after the Text/Visual mode selector:

```svelte
<button
  type="button"
  class="flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
  aria-pressed={sfxEnabled}
  onclick={() => onSfxEnabledChange(!sfxEnabled)}
>
  <span>{t.reader.soundEffects}</span>
  <span>{sfxEnabled ? t.reader.soundEffectsOn : t.reader.soundEffectsOff}</span>
</button>
```

Add translation parity:

`en.json`:

```json
"soundEffects": "Sound effects",
"soundEffectsOn": "On",
"soundEffectsOff": "Off"
```

`zh.json`:

```json
"soundEffects": "音效",
"soundEffectsOn": "開啟",
"soundEffectsOff": "關閉"
```

Update the mocked reader translations in `ReaderShell.test.ts` with the same three keys.

Do not add this control to the mobile Text hamburger; SFX is inactive in Text, while Visual mode already has the shared settings dialog at every breakpoint.

- [ ] **Step 6: Run ReaderShell and translation-sensitive web tests**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: PASS, including the existing mode/breakpoint lifecycle suite.

- [ ] **Step 7: Commit shell/settings integration**

```bash
git add apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/ReaderSettingsMenu.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts \
  packages/stories/src/translations/en.json \
  packages/stories/src/translations/zh.json
git commit -m "feat(web): play dialogue sfx from reader shell"
```

---

### Task 4: Add three local fixtures and three early authored cues

**Files:**
- Create: `apps/web/public/assets/vn/audio/sfx/door-open.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/impact.wav`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Regenerate: affected `packages/stories/src/generated/theSeventhMirror/**`

**Interfaces:**
- Catalog keys and authored keys must match exactly:
  - `door-open`
  - `notification-beep`
  - `impact`

- [ ] **Step 1: Add three small browser-decodable WAV fixture files**

Place the three files at the exact paths already referenced by `LOCAL_SFX_CATALOG`. Keep each clip short and small enough for source control. These are local demonstration assets, so fidelity is secondary; they must be audibly distinct and recognizable as door/open, notification/beep, and impact-like one-shots.

Verify the files exist and are non-empty:

```bash
test -s apps/web/public/assets/vn/audio/sfx/door-open.wav
test -s apps/web/public/assets/vn/audio/sfx/notification-beep.wav
test -s apps/web/public/assets/vn/audio/sfx/impact.wav
```

- [ ] **Step 2: Annotate only three existing early Seventh Mirror beats**

In `chapter_1/act1.md`, insert:

````markdown
```sfx
impact
```
````

immediately before the existing narration beginning with:

```text
**旁白**：她坐起來的動作很慢，像一具沒上緊發條的東西。腳踩到地板的時候...
```

Also insert:

````markdown
```sfx
door-open
```
````

immediately before:

```text
**旁白**：澪推開悠真的房門。
```

In `chapter_1/act4.md`, insert:

````markdown
```sfx
notification-beep
```
````

immediately before:

```text
**旁白**：這時候，澪的手機響了。螢幕亮起來——編輯組的來電。
```

Do not annotate additional lines in this ticket; story-wide sound direction belongs to HPA-607.

- [ ] **Step 3: Regenerate story output through the existing compiler**

```bash
bun run compile:stories
```

Inspect the three affected generated entries and confirm they contain exactly the expected `sfx` key while adjacent lines do not.

- [ ] **Step 4: Verify generated output is clean**

```bash
bun run compile:check
```

Expected: PASS with no uncommitted compiler-generated drift after the explicit regeneration.

- [ ] **Step 5: Commit fixtures and authored demo**

```bash
git add apps/web/public/assets/vn/audio/sfx \
  packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror
git commit -m "feat(stories): add early dialogue sfx fixtures"
```

---

### Task 5: Run full regression and manual lifecycle smoke

**Files:**
- No new architecture files.
- Fix only regressions directly caused by Tasks 1-4; do not broaden scope during cleanup.

**Interfaces:**
- Verifies the complete authoring -> compiler -> `DialogueEntry.sfx` -> `ReaderShell` -> native player path.

- [ ] **Step 1: Run the story package suite**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 2: Run the web suite**

```bash
bun --filter web test
```

Expected: PASS, including all pre-existing ReaderShell mode/remount tests and the new SFX lifecycle tests.

- [ ] **Step 3: Verify generated stories**

```bash
bun run compile:check
```

Expected: PASS.

- [ ] **Step 4: Run lint and production build**

```bash
bun run lint
bun run build
```

Expected: both PASS.

- [ ] **Step 5: Perform the manual Visual-mode smoke**

Run the existing web dev command:

```bash
bun run dev:web
```

In The Seventh Mirror reader:

1. Start/reload on an authored line and confirm the initial/restored line is silent.
2. Advance normally to the Chapter 1 foot-to-floor `impact` cue and hear it once.
3. Advance to `door-open` and hear it once; while on that same line, open/close Settings and History and cross the 1023px responsive breakpoint; confirm no replay.
4. Reach the Chapter 1 act 4 `notification-beep` cue and hear it once.
5. While a cue is playing, turn Sound effects Off; confirm playback stops immediately.
6. Reload; confirm Sound effects remains Off.
7. Turn it On while still on the same line; confirm that line does not replay, then advance to a later cue to confirm playback resumes.
8. Switch to Text before a cued line; confirm the cue stays silent. Switch back to Visual on the same line; confirm it still does not replay.

- [ ] **Step 6: Commit only if verification required a direct regression fix**

If Tasks 1-4 already pass unchanged, do not create an empty cleanup commit. If a direct regression fix was necessary:

```bash
git add <only-the-files-fixed-for-this-regression>
git commit -m "fix: complete dialogue sfx regression coverage"
```

---

## Self-Review

### Spec coverage

- Authoring syntax + exact-next-entry semantics: Task 1.
- `sfx?: string` in IR/runtime + conditional generated output: Task 1.
- Native browser playback + local logical-key catalog: Task 2.
- Replacement, unknown cue, rejected `play()`, and cleanup behavior: Task 2.
- Stable shell ownership, initial silence, no rerender/remount replay, Text-mode silence: Task 3.
- Disable/reenable/mode/story/destroy cleanup: Task 3.
- Existing settings surface + persisted default-on preference: Task 3.
- Door, beep, and impact local fixture demonstration: Task 4.
- Full automated and manual verification: Task 5.
- BGM, R2, ElevenLabs, generic audio architecture, volume, and story-wide sound design remain out of scope throughout.

### Type consistency

- Authoring/compiler/runtime property is `sfx?: string` everywhere.
- Player public methods are `play(cueKey: string)`, `stop()`, and `dispose()` everywhere.
- Shell injection is `createSfxPlayer?: () => SfxPlayer` everywhere.
- Preference names are `readSfxEnabled`, `writeSfxEnabled`, and `SFX_ENABLED_KEY` everywhere.
- Settings props are `sfxEnabled` and `onSfxEnabledChange` everywhere.
- Fixture/catalog keys are exactly `door-open`, `notification-beep`, and `impact` everywhere.

### YAGNI/KISS check

This plan adds only the seams HPA-604 must prove. It intentionally does not create an `AudioManager`, context/provider, event bus, generic media store, channel model, manifest, preload/cache layer, or production asset resolver. HPA-605/HPA-610 can extend the proven logical-key/player boundary when their actual requirements are implemented.
