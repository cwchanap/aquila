# HPA-604 Dialogue-Triggered SFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let story authors attach one logical SFX cue to a dialogue line and have Visual mode play that cue once on a genuine line transition, with a persisted on/off setting and three local fixture cues.

**Architecture:** Extend the existing story compiler with one optional `sfx` string, then keep playback at the stable `ReaderShell` boundary rather than responsive reader leaves. A tiny web-only native-audio adapter resolves logical keys from a static local catalog; no audio manager, event bus, manifest, or production delivery abstraction is introduced.

**Tech Stack:** Bun 1.3.1, TypeScript, Svelte 5, Astro, Vitest + Testing Library, native `HTMLAudioElement`, existing Aquila story compiler.

## Global Constraints

- Authoring uses a fenced `sfx` block applying to exactly the next emitted dialogue entry.
- Compiler/runtime payload is only `sfx?: string`; no URLs, provider metadata, volume, delay, or channel fields.
- Playback is Visual-mode-only and owned by `ReaderShell` using stable story/scene/dialogue identity.
- Initial/restored lines are silent. Text -> Visual, re-enable, rerenders, overlays, and responsive remounts do not replay the current line.
- A new cue replaces the current one-shot. A cue-less line does not implicitly stop it.
- Visual -> Text, disabling SFX, story replacement, and shell destruction stop/clean up audio.
- Playback and storage failures never block reading or navigation.
- Preference key: `aquila:sfx-enabled:v1`; default enabled.
- Local fixture keys: `door-open`, `notification-beep`, `impact`.
- Do not add BGM, ambience, voice, volume controls, an audio framework, generic timeline/events, R2 audio, ElevenLabs runtime integration, Phaser parity, preload/cache infrastructure, or analytics.

---

## File Map

### Story/compiler contract
- Modify `packages/stories/src/compiler/parse-scene.ts`
- Modify `packages/stories/src/compiler/ir.ts`
- Modify `packages/stories/src/types.ts`
- Modify `packages/stories/src/compiler/emit.ts`
- Test `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- Test `packages/stories/src/compiler/__tests__/emit.test.ts`

### Web audio boundary
- Create `apps/web/src/lib/audio/sfx-catalog.ts`
- Create `apps/web/src/lib/audio/sfx-player.ts`
- Create `apps/web/src/lib/audio/sfx-preference.ts`
- Create `apps/web/src/lib/audio/__tests__/sfx-player.test.ts`
- Create `apps/web/src/lib/audio/__tests__/sfx-preference.test.ts`
- Create `apps/web/public/assets/vn/audio/sfx/door-open.wav`
- Create `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`
- Create `apps/web/public/assets/vn/audio/sfx/impact.wav`

### Reader integration
- Modify `apps/web/src/components/ReaderShell.svelte`
- Modify `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify `packages/stories/src/translations/en.json`
- Modify `packages/stories/src/translations/zh.json`

### Minimal authored demo
- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Regenerate affected `packages/stories/src/generated/theSeventhMirror/**` output through the compiler.

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

Consumes:

````markdown
```sfx
door-open
```

**旁白**：澪推開悠真的房門。
````

Produces:

```ts
export interface DialogueEntryIR {
    // existing fields
    sfx?: string;
}

export type DialogueEntry = {
    // existing fields
    sfx?: string;
};
```

- [ ] **Step 1: Write failing parser tests**

Add to `parse-scene.test.ts`:

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

- [ ] **Step 2: Verify the new parser tests fail**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: FAIL because the syntax/property does not exist yet.

- [ ] **Step 3: Add the minimal parser and type fields**

Add to both `DialogueEntryIR` and `DialogueEntry`:

```ts
sfx?: string;
```

In `parse-scene.ts` add:

```ts
const SFX_BLOCK_RE = /^```sfx\s*\n([\s\S]*?)\n```$/;
```

Track pending state:

```ts
let pendingSfx: string | undefined;
```

Handle the block before normal dialogue parsing:

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

For both explicit-speaker and default-speaker entries, include:

```ts
...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
```

and clear after the entry is pushed:

```ts
pendingSfx = undefined;
```

Do not validate cue keys against the web catalog.

- [ ] **Step 4: Add emitter coverage and implementation**

In `emit.test.ts`, add one fixture entry with:

```ts
sfx: 'door-open',
```

Then assert:

```ts
expect(scene).toContain('sfx: "door-open"');
```

For the existing no-asset/no-SFX fixture also assert:

```ts
expect(scene).not.toContain('sfx:');
```

In `emitSceneFile`, append:

```ts
if (e.sfx) {
    parts.push(`sfx: ${q(e.sfx)}`);
}
```

- [ ] **Step 5: Run focused story tests**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts emit.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

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

### Task 2: Add a native one-shot player and persisted preference

**Files:**
- Create: `apps/web/src/lib/audio/sfx-catalog.ts`
- Create: `apps/web/src/lib/audio/sfx-player.ts`
- Create: `apps/web/src/lib/audio/sfx-preference.ts`
- Test: `apps/web/src/lib/audio/__tests__/sfx-player.test.ts`
- Test: `apps/web/src/lib/audio/__tests__/sfx-preference.test.ts`

**Interfaces:**

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

- [ ] **Step 1: Write failing native-player tests**

Create `sfx-player.test.ts` with an injected fake media object:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSfxPlayer, type SfxAudio } from '../sfx-player';

function fakeAudio(): SfxAudio {
    return {
        currentTime: 4,
        pause: vi.fn(),
        play: vi.fn(async () => {}),
    };
}

it('resolves a catalog cue and starts it', () => {
    const audio = fakeAudio();
    const factory = vi.fn(() => audio);
    const player = createSfxPlayer({ 'door-open': '/door.wav' }, factory);

    player.play('door-open');

    expect(factory).toHaveBeenCalledWith('/door.wav');
    expect(audio.play).toHaveBeenCalledOnce();
});

it('stops and rewinds the previous cue before replacement', () => {
    const first = fakeAudio();
    const second = fakeAudio();
    const factory = vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second);
    const player = createSfxPlayer({ a: '/a.wav', b: '/b.wav' }, factory);

    player.play('a');
    player.play('b');

    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.currentTime).toBe(0);
    expect(second.play).toHaveBeenCalledOnce();
});
```

Add cases for unknown cue, rejected `play()`, factory failure, `stop()`, and `dispose()` becoming inert.

- [ ] **Step 2: Write failing preference tests**

Create `sfx-preference.test.ts` covering:

```ts
expect(readSfxEnabled(storageWithNoValue)).toBe(true);
expect(readSfxEnabled(storageWithFalse)).toBe(false);
writeSfxEnabled(false, storage);
expect(storage.getItem(SFX_ENABLED_KEY)).toBe('false');
writeSfxEnabled(true, storage);
expect(storage.getItem(SFX_ENABLED_KEY)).toBe('true');
```

Use a throwing `Storage` stub to prove reads fall back to `true` and writes do not throw.

- [ ] **Step 3: Verify both test files fail before implementation**

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

- [ ] **Step 5: Implement the player**

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

- [ ] **Step 6: Implement the persisted boolean**

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

Do not refactor `reader-mode.ts` or add a generic preference store.

- [ ] **Step 7: Run focused web tests**

```bash
bun --filter web test -- sfx-player.test.ts sfx-preference.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/audio
git commit -m "feat(web): add native visual novel sfx player"
```

---

### Task 3: Make ReaderShell the sole playback lifecycle owner

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`

**Interfaces:**

Shell test injection:

```ts
createSfxPlayer?: () => SfxPlayer;
```

Settings props:

```ts
sfxEnabled: boolean;
onSfxEnabledChange: (enabled: boolean) => void;
```

- [ ] **Step 1: Add failing ReaderShell lifecycle tests**

In `ReaderShell.test.ts`, add:

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

Seed SFX-specific dialogue inside those tests only:

```ts
readerState.dialogue = [
    { dialogue: 'Initial line.' },
    { dialogue: 'Door line.', sfx: 'door-open' },
    { dialogue: 'No cue.' },
    { dialogue: 'Impact line.', sfx: 'impact' },
];
```

Cover all of these as separate assertions/tests:

1. persisted Visual mode + initial/restored cued line stays silent;
2. index 0 -> 1 in Visual calls `play('door-open')` once;
3. extra `tick()`, settings open/close, and desktop/mobile breakpoint changes do not increase the call count;
4. Text-mode advancement never plays;
5. Visual -> Text calls `stop`;
6. disabling SFX calls `stop`, persists false, and re-enabling does not replay the current line;
7. changing `storyId` calls `stop` and silently primes the replacement line even when scene/index match;
8. unmount calls `dispose`.

- [ ] **Step 2: Verify ReaderShell tests fail**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL because shell SFX integration does not exist.

- [ ] **Step 3: Add shell preference/player ownership**

In `ReaderShell.svelte` import:

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

with type:

```ts
createSfxPlayer?: () => SfxPlayer;
```

Create state once:

```ts
let sfxEnabled = $state(readSfxEnabled());
const sfxPlayer = createSfxPlayer();
```

Add:

```ts
function setSfxEnabled(enabled: boolean): void {
    if (sfxEnabled === enabled) return;
    sfxEnabled = enabled;
    writeSfxEnabled(enabled);
    if (!enabled) sfxPlayer.stop();
}
```

When `setReaderMode` changes to Text:

```ts
if (mode === 'text') sfxPlayer.stop();
```

- [ ] **Step 4: Add a separate stable line-transition effect**

Keep this separate from visual-runtime revalidation:

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

The unchanged line key must be checked before playback so mode/preference/rerender changes cannot replay the line.

In `onDestroy` add:

```ts
sfxPlayer.dispose();
```

- [ ] **Step 5: Add the SFX toggle to the existing settings dialog**

Pass from `ReaderShell`:

```svelte
{sfxEnabled}
onSfxEnabledChange={setSfxEnabled}
```

Add corresponding props to `ReaderSettingsMenu.svelte`, then add this button after the Text/Visual selector:

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

Add translation parity.

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

Add the same three fields to the `ReaderShell.test.ts` mocked translations.

Do not modify the mobile Text hamburger just to expose an inactive audio setting.

- [ ] **Step 6: Run ReaderShell tests**

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: PASS, including pre-existing mode/remount coverage.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/ReaderSettingsMenu.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts \
  packages/stories/src/translations/en.json \
  packages/stories/src/translations/zh.json
git commit -m "feat(web): play dialogue sfx from reader shell"
```

---

### Task 4: Add three local fixtures and exactly three early authored cues

**Files:**
- Create: `apps/web/public/assets/vn/audio/sfx/door-open.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/impact.wav`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Regenerate: affected `packages/stories/src/generated/theSeventhMirror/**`

**Interfaces:** Catalog and authored keys must match exactly: `door-open`, `notification-beep`, `impact`.

- [ ] **Step 1: Add the three local WAV fixtures**

Put short, small, browser-decodable, audibly distinct fixture clips at the exact catalog paths. These are demo fixtures rather than production audio; no generation metadata or runtime provider integration is required.

Verify all three are non-empty:

```bash
test -s apps/web/public/assets/vn/audio/sfx/door-open.wav
test -s apps/web/public/assets/vn/audio/sfx/notification-beep.wav
test -s apps/web/public/assets/vn/audio/sfx/impact.wav
```

- [ ] **Step 2: Annotate only three existing Chapter 1 beats**

In `chapter_1/act1.md`, insert:

````markdown
```sfx
impact
```
````

immediately before the existing narration beginning:

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

Do not annotate more story content in HPA-604; the broad audio audit belongs to HPA-607.

- [ ] **Step 3: Regenerate story output**

```bash
bun run compile:stories
```

Inspect the three generated entries and confirm each has its expected `sfx` property and neighboring entries do not.

- [ ] **Step 4: Verify no generated drift remains**

```bash
bun run compile:check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/assets/vn/audio/sfx \
  packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror
git commit -m "feat(stories): add early dialogue sfx fixtures"
```

---

### Task 5: Run the full regression and manual lifecycle smoke

**Files:** No new architecture files. Fix only regressions directly caused by Tasks 1-4.

- [ ] **Step 1: Run story tests**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 2: Run web tests**

```bash
bun --filter web test
```

Expected: PASS.

- [ ] **Step 3: Verify generated stories**

```bash
bun run compile:check
```

Expected: PASS.

- [ ] **Step 4: Run lint and build**

```bash
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 5: Perform the manual Visual-mode smoke**

```bash
bun run dev:web
```

In The Seventh Mirror reader:

1. Start/reload on an authored line; the initial/restored line stays silent.
2. Advance to the Chapter 1 foot-to-floor `impact` cue; hear it once.
3. Advance to `door-open`; hear it once. Open/close Settings and History and cross the 1023px breakpoint on that same line; hear no replay.
4. Reach the Chapter 1 act 4 `notification-beep`; hear it once.
5. Turn Sound effects Off during playback; playback stops immediately.
6. Reload; Sound effects remains Off.
7. Turn it On on the same line; the current line does not replay. A later cue can play normally.
8. Switch to Text before a cued line; it remains silent. Switch back to Visual on that same line; it still does not replay.

- [ ] **Step 6: Commit only a direct regression fix if verification exposed one**

Use interactive staging so unrelated cleanup cannot leak into the feature:

```bash
git add -p
git commit -m "fix: complete dialogue sfx regression coverage"
```

Skip this commit when Tasks 1-4 pass unchanged.

---

## Self-Review

### Spec coverage
- Exact-next-entry authoring: Task 1.
- `sfx?: string` IR/runtime/emission: Task 1.
- Native playback, logical-key catalog, replacement/error cleanup: Task 2.
- Persisted default-on setting: Task 2 + Task 3.
- Stable shell ownership, initial silence, remount/rerender safety, Text silence: Task 3.
- Mode/disable/story/destroy cleanup: Task 3.
- Door, notification/beep, impact fixtures and early demo: Task 4.
- Full automated/manual verification: Task 5.
- BGM, R2, ElevenLabs, generic audio architecture, volume, and story-wide sound design stay out of scope.

### Type consistency
- Authoring/compiler/runtime property: `sfx?: string`.
- Player methods: `play(cueKey: string)`, `stop()`, `dispose()`.
- Shell injection: `createSfxPlayer?: () => SfxPlayer`.
- Preference API: `readSfxEnabled`, `writeSfxEnabled`, `SFX_ENABLED_KEY`.
- Settings props: `sfxEnabled`, `onSfxEnabledChange`.
- Fixture/catalog keys: `door-open`, `notification-beep`, `impact`.

### Placeholder scan
- No `TBD`, `TODO`, unspecified implementation step, or placeholder path remains.
- Every code-facing step names exact files, signatures, commands, and expected behavior.

### YAGNI/KISS check

The plan adds only the seams HPA-604 must prove. It intentionally does not create an `AudioManager`, context/provider, event bus, generic media store, channel model, manifest, preload/cache layer, or production asset resolver. HPA-605 and HPA-610 can extend the proven logical-key/player boundary when their requirements are implemented.
