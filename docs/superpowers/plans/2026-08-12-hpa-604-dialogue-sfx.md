# HPA-604 Dialogue-Triggered SFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compile-validated one-shot SFX cues to Aquila story dialogue and play them exactly once from the stable web `ReaderShell` lifecycle using native browser audio and three local fixtures.

**Architecture:** Story Markdown carries one logical `sfx` key for the next dialogue entry. `@aquila/stories` owns a temporary three-key HPA-604 allowlist plus parser/emitter propagation; `apps/web` owns URL resolution, native `HTMLAudioElement` playback, one persisted boolean, and a pure transition helper. `ReaderShell` reuses its existing active-line key as the only line-identity machine and delegates side effects to an injected player.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Svelte 5, Vitest, Testing Library, native `HTMLAudioElement`, static PCM WAV fixtures.

## Global Constraints

- Keep runtime `DialogueEntry.sfx` as `string`, not a closed runtime union.
- HPA-604's `SFX_CUE_KEYS` is a bootstrap allowlist only; HPA-606 replaces semantic key validation with per-story `audio-plan.json`.
- Story Markdown contains logical cue keys only: no URLs, paths, provider/model IDs, prompts, volume, delay, or channels.
- Playback belongs to `ReaderShell`, never `VisualNovelReader` or typewriter/render effects.
- Reuse `ReaderShell`'s existing `${storyId}\u0000${currentSceneId}\u0000${dialogueIndex}` identity; do not add `sfxStoryId`/`sfxLineKey` state.
- Use native browser audio only; no audio framework, manager, mixer, event bus, generic timeline, or global preference store.
- Runtime playback failures stay silent from the player's perspective.
- SFX is Visual-mode-only. Do not add the setting to the mobile Text hamburger.
- Generate exactly three local fixtures and annotate exactly three existing early Seventh Mirror beats.
- Do not implement BGM, ElevenLabs integration, R2 audio delivery, Phaser parity, story-wide sound design, or authoring-skill changes.

---

## File Structure

**Stories package**

- Create `packages/stories/src/audio-cues.ts` — temporary HPA-604 logical cue allowlist/type guard.
- Modify `packages/stories/src/index.ts` — export bootstrap cue contract.
- Modify `packages/stories/src/compiler/parse-scene.ts` — parse, validate, consume, and reject dropped `sfx` blocks.
- Modify `packages/stories/src/compiler/ir.ts` — add optional SFX field.
- Modify `packages/stories/src/types.ts` — add optional runtime SFX field.
- Modify `packages/stories/src/compiler/emit.ts` — emit SFX only when present.
- Modify `packages/stories/src/compiler/__tests__/parse-scene.test.ts` — strict authoring cases.
- Modify `packages/stories/src/compiler/__tests__/emit.test.ts` — generated output contract.

**Web audio**

- Create `apps/web/src/lib/audio/sfx-catalog.ts` — map bootstrap logical keys to local fixture URLs.
- Create `apps/web/src/lib/audio/sfx-player.ts` — one-element native player.
- Create `apps/web/src/lib/audio/sfx-preference.ts` — persisted boolean reusing `getBrowserStorage()`.
- Create `apps/web/src/lib/audio/sfx-transition.ts` — pure line-transition command classifier.
- Create `apps/web/src/lib/__tests__/sfx-player.test.ts`.
- Create `apps/web/src/lib/__tests__/sfx-preference.test.ts`.
- Create `apps/web/src/lib/__tests__/sfx-transition.test.ts`.

**Reader integration**

- Modify `apps/web/src/components/ReaderShell.svelte`.
- Modify `apps/web/src/components/ReaderSettingsMenu.svelte`.
- Modify `apps/web/src/components/__tests__/ReaderShell.test.ts`.
- Modify `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts`.
- Modify `packages/stories/src/translations/en.json`.
- Modify `packages/stories/src/translations/zh.json`.

**Fixtures/content**

- Create `apps/web/public/assets/vn/audio/sfx/door-open.wav`.
- Create `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`.
- Create `apps/web/public/assets/vn/audio/sfx/impact.wav`.
- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`.
- Modify `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`.
- Regenerate `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts`.
- Regenerate `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts`.

---

### Task 1: Make SFX a strict compiler contract

**Files:**
- Create: `packages/stories/src/audio-cues.ts`
- Modify: `packages/stories/src/index.ts`
- Modify: `packages/stories/src/compiler/parse-scene.ts`
- Modify: `packages/stories/src/compiler/ir.ts`
- Modify: `packages/stories/src/types.ts`
- Modify: `packages/stories/src/compiler/emit.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

**Interfaces:**
- Produces: `SFX_CUE_KEYS`, `SfxCueKey`, `isSfxCueKey(value: string): value is SfxCueKey`.
- Produces: `DialogueEntryIR.sfx?: string` and `DialogueEntry.sfx?: string`.
- Contract: valid HPA-604 Markdown keys are exactly `door-open`, `notification-beep`, `impact`.

- [ ] **Step 1: Add failing parser tests for valid next-entry consumption and `bg` coexistence**

Append focused cases to `parse-scene.test.ts`:

```ts
it('applies sfx to exactly the next dialogue entry', () => {
    const md = [
        '```sfx',
        'door-open',
        '```',
        '',
        '**旁白**：第一段。',
        '',
        '**旁白**：第二段。',
    ].join('\n');

    const result = parseScene(md, resolve, 'act1.md');

    expect(result.entries[0].sfx).toBe('door-open');
    expect(result.entries[1].sfx).toBeUndefined();
});

it('applies pending bg and sfx to the same next entry', () => {
    const md = [
        '```bg',
        '月台夜景',
        '```',
        '',
        '```sfx',
        'notification-beep',
        '```',
        '',
        '**李杰**：手機亮了。',
    ].join('\n');

    const result = parseScene(md, resolve, 'act1.md');

    expect(result.entries[0]).toMatchObject({
        backgroundPrompt: '月台夜景',
        sfx: 'notification-beep',
    });
});

it('consumes sfx on default-speaker narration', () => {
    const narrator = { id: 'narrator', displayName: '旁白' };
    const md = [
        '```sfx',
        'impact',
        '```',
        '',
        '腳落在地板上。',
    ].join('\n');

    const result = parseScene(md, resolve, 'act1.md', narrator);

    expect(result.entries[0]).toMatchObject({
        characterId: 'narrator',
        dialogue: '腳落在地板上。',
        sfx: 'impact',
    });
});
```

- [ ] **Step 2: Add failing parser tests for the authoring failures that must not become silence**

```ts
it.each([
    ['empty', ['```sfx', '', '```'].join('\n')],
    ['multi-token', ['```sfx', 'door open', '```'].join('\n')],
    ['unknown', ['```sfx', 'door-opne', '```'].join('\n')],
])('rejects %s sfx blocks', (_label, block) => {
    const md = [block, '', '**旁白**：hello'].join('\n');
    expect(() => parseScene(md, resolve, 'act1.md')).toThrow(/sfx/i);
});

it('rejects a second sfx block while one is still pending', () => {
    const md = [
        '```sfx',
        'door-open',
        '```',
        '',
        '```sfx',
        'impact',
        '```',
        '',
        '**旁白**：hello',
    ].join('\n');

    expect(() => parseScene(md, resolve, 'act1.md')).toThrow(/pending sfx/i);
});

it('rejects an unconsumed sfx block at end of scene', () => {
    const md = [
        '**旁白**：hello',
        '',
        '```sfx',
        'door-open',
        '```',
    ].join('\n');

    expect(() => parseScene(md, resolve, 'act1.md')).toThrow(/unconsumed sfx/i);
});
```

Run:

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: FAIL because `sfx` is not parsed/validated yet.

- [ ] **Step 3: Add the temporary three-key stories-package allowlist**

Create `packages/stories/src/audio-cues.ts`:

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

Modify `packages/stories/src/index.ts`:

```ts
export { SFX_CUE_KEYS, isSfxCueKey } from './audio-cues';
export type { SfxCueKey } from './audio-cues';
```

Do not make `DialogueEntry.sfx` use `SfxCueKey`; this allowlist is compile/bootstrap authority only and HPA-606 will replace it with per-story audio-plan validation.

- [ ] **Step 4: Extend compiler/runtime types**

In `DialogueEntryIR` add:

```ts
sfx?: string;
```

In runtime `DialogueEntry` add:

```ts
sfx?: string;
```

- [ ] **Step 5: Implement strict pending-SFX parsing without changing `bg` semantics**

In `parse-scene.ts`, import the type guard and add a strict one-line fence regex:

```ts
import { isSfxCueKey } from '../audio-cues';

const SFX_BLOCK_RE =
    /^```sfx[ \t]*\n[ \t]*([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;
```

Add state beside `pendingBg`:

```ts
let pendingSfx: string | undefined;
```

Handle a valid SFX block before dialogue parsing:

```ts
const sfxMatch = SFX_BLOCK_RE.exec(block);
if (sfxMatch) {
    if (pendingSfx !== undefined) {
        throw new Error(
            `[story-compiler] ${sourcePath}: pending sfx "${pendingSfx}" was not consumed before another sfx block`
        );
    }
    const cueKey = sfxMatch[1];
    if (!isSfxCueKey(cueKey)) {
        throw new Error(
            `[story-compiler] ${sourcePath}: unknown sfx cue "${cueKey}"`
        );
    }
    pendingSfx = cueKey;
    continue;
}
if (block.startsWith('```sfx')) {
    throw new Error(
        `[story-compiler] ${sourcePath}: invalid sfx block; expected one lowercase hyphenated cue key`
    );
}
```

When emitting a default-speaker entry, include and consume SFX independently from background:

```ts
entries.push({
    characterId: defaultSpeaker.id,
    displayName: defaultSpeaker.displayName,
    dialogue: (wrapped ? wrapped[1] : oneLine).trim(),
    ...(pendingBg !== undefined
        ? { backgroundPrompt: pendingBg }
        : {}),
    ...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
});
pendingBg = undefined;
pendingSfx = undefined;
```

For explicit speaker entries:

```ts
if (pendingSfx !== undefined) {
    entry.sfx = pendingSfx;
    pendingSfx = undefined;
}
```

After the loop, reject a dropped one-shot:

```ts
if (pendingSfx !== undefined) {
    throw new Error(
        `[story-compiler] ${sourcePath}: unconsumed sfx "${pendingSfx}" at end of scene`
    );
}
```

Do not add equivalent duplicate/EOF failures for `bg` in this ticket.

- [ ] **Step 6: Run parser tests and verify green**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: PASS.

- [ ] **Step 7: Add failing emitter coverage**

In `emit.test.ts`, add an SFX-bearing entry and assert both presence and omission:

```ts
it('emits sfx only on authored entries', () => {
    const storyWithSfx: StoryIR = {
        storyId: 'demo_story',
        name: 'demoStory',
        start: 'act1',
        scenes: [
            {
                id: 'act1',
                entries: [
                    {
                        characterId: 'narrator',
                        displayName: '旁白',
                        dialogue: 'door',
                        sfx: 'door-open',
                    },
                    {
                        characterId: 'narrator',
                        displayName: '旁白',
                        dialogue: 'quiet',
                    },
                ],
                next: null,
                sourcePath: 'act1.md',
            },
        ],
        choices: [],
    };

    emitStory(storyWithSfx, dir, mockCharDir);
    const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');

    expect(scene).toContain('sfx: "door-open"');
    expect(scene.match(/sfx:/g)).toHaveLength(1);
});
```

Run:

```bash
bun --filter @aquila/stories test -- emit.test.ts
```

Expected: FAIL until emitter propagation is added.

- [ ] **Step 8: Emit `sfx` only when present**

In `emitSceneFile`, after dialogue and before/after visual fields:

```ts
if (e.sfx) {
    parts.push(`sfx: ${q(e.sfx)}`);
}
```

- [ ] **Step 9: Run focused stories tests**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts emit.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit the compiler contract**

```bash
git add packages/stories/src/audio-cues.ts \
  packages/stories/src/index.ts \
  packages/stories/src/compiler/parse-scene.ts \
  packages/stories/src/compiler/ir.ts \
  packages/stories/src/types.ts \
  packages/stories/src/compiler/emit.ts \
  packages/stories/src/compiler/__tests__/parse-scene.test.ts \
  packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat(stories): add dialogue sfx contract"
```

---

### Task 2: Build the tiny web audio seam and pure transition logic

**Files:**
- Create: `apps/web/src/lib/audio/sfx-catalog.ts`
- Create: `apps/web/src/lib/audio/sfx-player.ts`
- Create: `apps/web/src/lib/audio/sfx-preference.ts`
- Create: `apps/web/src/lib/audio/sfx-transition.ts`
- Create: `apps/web/src/lib/__tests__/sfx-player.test.ts`
- Create: `apps/web/src/lib/__tests__/sfx-preference.test.ts`
- Create: `apps/web/src/lib/__tests__/sfx-transition.test.ts`

**Interfaces:**
- Consumes: `SfxCueKey` from `@aquila/stories` for catalog completeness only.
- Produces: `SfxPlayer { play(string), stop(), dispose() }`.
- Produces: `createSfxPlayer(audioFactory?)`.
- Produces: `readSfxEnabled`, `writeSfxEnabled`, `SFX_ENABLED_KEY`.
- Produces: `nextSfxCommand(previousLineKey, nextLineKey, cueKey, options)`.

- [ ] **Step 1: Write the pure transition table first**

Create `apps/web/src/lib/__tests__/sfx-transition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextSfxCommand } from '@/lib/audio/sfx-transition';

const key = (story: string, scene: string, index: number) =>
    `${story}\u0000${scene}\u0000${index}`;

describe('nextSfxCommand', () => {
    it.each([
        [
            'first observation primes',
            null,
            key('story-a', 'act1', 0),
            'door-open',
            { mode: 'visual' as const, enabled: true },
            { type: 'prime' },
        ],
        [
            'same line is a noop',
            key('story-a', 'act1', 0),
            key('story-a', 'act1', 0),
            'door-open',
            { mode: 'visual' as const, enabled: true },
            { type: 'noop' },
        ],
        [
            'same-story line change plays',
            key('story-a', 'act1', 0),
            key('story-a', 'act1', 1),
            'door-open',
            { mode: 'visual' as const, enabled: true },
            { type: 'play', cueKey: 'door-open' },
        ],
        [
            'same-story scene change plays',
            key('story-a', 'act1', 3),
            key('story-a', 'act2', 0),
            'impact',
            { mode: 'visual' as const, enabled: true },
            { type: 'play', cueKey: 'impact' },
        ],
        [
            'cue-less line is a noop',
            key('story-a', 'act1', 0),
            key('story-a', 'act1', 1),
            undefined,
            { mode: 'visual' as const, enabled: true },
            { type: 'noop' },
        ],
        [
            'text mode is a noop',
            key('story-a', 'act1', 0),
            key('story-a', 'act1', 1),
            'door-open',
            { mode: 'text' as const, enabled: true },
            { type: 'noop' },
        ],
        [
            'disabled sfx is a noop',
            key('story-a', 'act1', 0),
            key('story-a', 'act1', 1),
            'door-open',
            { mode: 'visual' as const, enabled: false },
            { type: 'noop' },
        ],
        [
            'story replacement stops instead of playing replacement cue',
            key('story-a', 'act9', 4),
            key('story-b', 'act1', 0),
            'door-open',
            { mode: 'visual' as const, enabled: true },
            { type: 'stop' },
        ],
    ])('%s', (_label, previous, next, cue, options, expected) => {
        expect(nextSfxCommand(previous, next, cue, options)).toEqual(expected);
    });
});
```

Run:

```bash
bun --filter web test -- sfx-transition.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 2: Implement the pure helper using the story prefix already embedded in the shell key**

Create `apps/web/src/lib/audio/sfx-transition.ts`:

```ts
import type { ReaderMode } from '@/lib/reader-mode';

export type SfxCommand =
    | { type: 'prime' }
    | { type: 'play'; cueKey: string }
    | { type: 'stop' }
    | { type: 'noop' };

function storyIdFromLineKey(lineKey: string): string {
    const separator = lineKey.indexOf('\u0000');
    return separator === -1 ? lineKey : lineKey.slice(0, separator);
}

export function nextSfxCommand(
    previousLineKey: string | null,
    nextLineKey: string,
    cueKey: string | undefined,
    options: { mode: ReaderMode; enabled: boolean }
): SfxCommand {
    if (previousLineKey === null) return { type: 'prime' };
    if (previousLineKey === nextLineKey) return { type: 'noop' };
    if (
        storyIdFromLineKey(previousLineKey) !== storyIdFromLineKey(nextLineKey)
    ) {
        return { type: 'stop' };
    }
    if (options.mode === 'visual' && options.enabled && cueKey) {
        return { type: 'play', cueKey };
    }
    return { type: 'noop' };
}
```

Run the focused test again; expected PASS.

- [ ] **Step 3: Add the typed local catalog**

Create `apps/web/src/lib/audio/sfx-catalog.ts`:

```ts
import type { SfxCueKey } from '@aquila/stories';

export const LOCAL_SFX_CATALOG = {
    'door-open': '/assets/vn/audio/sfx/door-open.wav',
    'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
    impact: '/assets/vn/audio/sfx/impact.wav',
} satisfies Record<SfxCueKey, string>;
```

Do not export URLs into the stories package.

- [ ] **Step 4: Write player tests before implementation**

Create `apps/web/src/lib/__tests__/sfx-player.test.ts` with a minimal fake audio object:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSfxPlayer } from '@/lib/audio/sfx-player';

function fakeAudio(playImpl: () => Promise<void> = async () => {}) {
    return {
        pause: vi.fn(),
        play: vi.fn(playImpl),
        currentTime: 7,
    } as unknown as HTMLAudioElement;
}

describe('createSfxPlayer', () => {
    it('plays a catalog cue and replaces the previous element', () => {
        const first = fakeAudio();
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');
        player.play('impact');

        expect(createAudio).toHaveBeenNthCalledWith(
            1,
            '/assets/vn/audio/sfx/door-open.wav'
        );
        expect(first.pause).toHaveBeenCalledOnce();
        expect(first.currentTime).toBe(0);
        expect(second.play).toHaveBeenCalledOnce();
    });

    it('stops the current cue before quietly ignoring an unknown runtime key', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');
        player.play('not-in-runtime-catalog');

        expect(audio.pause).toHaveBeenCalledOnce();
        expect(createAudio).toHaveBeenCalledOnce();
    });

    it('contains a rejected play promise', async () => {
        const audio = fakeAudio(async () => {
            throw new Error('autoplay blocked');
        });
        const player = createSfxPlayer(() => audio);

        expect(() => player.play('door-open')).not.toThrow();
        await Promise.resolve();
    });

    it('stop and dispose pause/rewind and dispose makes the player inert', () => {
        const first = fakeAudio();
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');
        player.stop();
        expect(first.pause).toHaveBeenCalledOnce();
        expect(first.currentTime).toBe(0);

        player.play('impact');
        player.dispose();
        expect(second.pause).toHaveBeenCalledOnce();
        expect(second.currentTime).toBe(0);

        player.play('door-open');
        expect(createAudio).toHaveBeenCalledTimes(2);
    });
});
```

Run:

```bash
bun --filter web test -- sfx-player.test.ts
```

Expected: FAIL because player module does not exist.

- [ ] **Step 5: Implement one-current-element native playback**

Create `apps/web/src/lib/audio/sfx-player.ts`:

```ts
import { LOCAL_SFX_CATALOG } from './sfx-catalog';

export interface SfxPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

type AudioFactory = (src: string) => HTMLAudioElement;

export function createSfxPlayer(
    createAudio: AudioFactory = src => new Audio(src)
): SfxPlayer {
    let current: HTMLAudioElement | null = null;
    let disposed = false;

    function stopCurrent(): void {
        const audio = current;
        current = null;
        if (!audio) return;
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch {
            // Playback cleanup is best-effort.
        }
    }

    return {
        play(cueKey: string): void {
            if (disposed) return;
            stopCurrent();
            const src = (
                LOCAL_SFX_CATALOG as Readonly<Record<string, string>>
            )[cueKey];
            if (!src) return;

            const audio = createAudio(src);
            current = audio;
            try {
                void audio.play().catch(() => {});
            } catch {
                // Native play can also throw synchronously in test/non-browser shims.
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

Run the focused player test; expected PASS.

- [ ] **Step 6: Write preference tests that prove shared storage semantics**

Create `apps/web/src/lib/__tests__/sfx-preference.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    readSfxEnabled,
    SFX_ENABLED_KEY,
    writeSfxEnabled,
} from '@/lib/audio/sfx-preference';

function storage(initial: string | null = null): Storage {
    let value = initial;
    return {
        getItem: () => value,
        setItem: (_key, next) => {
            value = next;
        },
    } as Storage;
}

describe('sfx preference', () => {
    it('defaults enabled and round-trips explicit values', () => {
        const s = storage();
        expect(readSfxEnabled(s)).toBe(true);
        writeSfxEnabled(false, s);
        expect(readSfxEnabled(s)).toBe(false);
        writeSfxEnabled(true, s);
        expect(readSfxEnabled(s)).toBe(true);
    });

    it('uses the expected key and tolerates storage failures', () => {
        expect(SFX_ENABLED_KEY).toBe('aquila:sfx-enabled:v1');
        const broken = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
        } as unknown as Storage;

        expect(readSfxEnabled(broken)).toBe(true);
        expect(() => writeSfxEnabled(false, broken)).not.toThrow();
    });
});
```

- [ ] **Step 7: Implement preference helpers by reusing `getBrowserStorage()`**

Create `apps/web/src/lib/audio/sfx-preference.ts`:

```ts
import { getBrowserStorage } from '@/lib/reader-mode';

export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';

export function readSfxEnabled(
    storage: Storage | null = getBrowserStorage()
): boolean {
    try {
        return storage?.getItem(SFX_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function writeSfxEnabled(
    enabled: boolean,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(SFX_ENABLED_KEY, String(enabled));
    } catch {
        return;
    }
}
```

Do not copy the `globalThis.localStorage` try/catch from `reader-mode.ts`.

- [ ] **Step 8: Run all focused web-audio tests**

```bash
bun --filter web test -- \
  sfx-transition.test.ts \
  sfx-player.test.ts \
  sfx-preference.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the web audio seam**

```bash
git add apps/web/src/lib/audio/sfx-catalog.ts \
  apps/web/src/lib/audio/sfx-player.ts \
  apps/web/src/lib/audio/sfx-preference.ts \
  apps/web/src/lib/audio/sfx-transition.ts \
  apps/web/src/lib/__tests__/sfx-player.test.ts \
  apps/web/src/lib/__tests__/sfx-preference.test.ts \
  apps/web/src/lib/__tests__/sfx-transition.test.ts
git commit -m "feat(web): add native sfx player"
```

---

### Task 3: Wire the existing ReaderShell identity and settings surface

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`

**Interfaces:**
- Consumes: `createSfxPlayer(): SfxPlayer`, `nextSfxCommand(...)`, `readSfxEnabled()`, `writeSfxEnabled()`.
- Extends `ReaderShell` props with injectable `createSfxPlayer?: () => SfxPlayer`.
- Extends `ReaderSettingsMenu` required props with `sfxEnabled` and `onSfxEnabledChange`.

- [ ] **Step 1: Add the SFX fake and minimal integration cases to `ReaderShell.test.ts`**

Add a harness:

```ts
function createSfxHarness() {
    return {
        player: {
            play: vi.fn(),
            stop: vi.fn(),
            dispose: vi.fn(),
        },
    };
}
```

Give the second existing mock line one cue:

```ts
const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First dialogue line.' },
    {
        characterId: 'narrator',
        dialogue: 'Second dialogue line.',
        sfx: 'door-open',
    },
    { characterId: 'narrator', dialogue: 'Third dialogue line.' },
];
```

Add focused shell wiring tests:

```ts
it('primes silently then delegates one cue for a real Visual line change', async () => {
    stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    const { player } = createSfxHarness();
    render(ReaderShell, { props: { createSfxPlayer: () => player } });

    expect(player.play).not.toHaveBeenCalled();

    readerState.dialogueIndex = 1;
    await tick();

    expect(player.play).toHaveBeenCalledOnce();
    expect(player.play).toHaveBeenCalledWith('door-open');
});

it('does not recreate or replay sfx across a responsive remount', async () => {
    const mm = stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    readerState.dialogueIndex = 1;
    const { player } = createSfxHarness();
    const createPlayer = vi.fn(() => player);
    render(ReaderShell, { props: { createSfxPlayer: createPlayer } });

    mm.setMatches(true);
    await tick();
    mm.setMatches(false);
    await tick();

    expect(createPlayer).toHaveBeenCalledOnce();
    expect(player.play).not.toHaveBeenCalled();
});

it('stops on story replacement without autoplaying the replacement line', async () => {
    stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    const { player } = createSfxHarness();
    render(ReaderShell, { props: { createSfxPlayer: () => player } });

    readerState.storyId = 'replacement_story';
    readerState.currentSceneId = 'act1';
    readerState.dialogueIndex = 0;
    readerState.dialogue = [
        { dialogue: 'Replacement first line', sfx: 'door-open' },
    ];
    await tick();

    expect(player.stop).toHaveBeenCalledOnce();
    expect(player.play).not.toHaveBeenCalled();
});

it('disposes the injected player with the shell', () => {
    stubMatchMedia(false);
    const { player } = createSfxHarness();
    const view = render(ReaderShell, {
        props: { createSfxPlayer: () => player },
    });

    view.unmount();

    expect(player.dispose).toHaveBeenCalledOnce();
});
```

Run:

```bash
bun --filter web test -- ReaderShell.test.ts
```

Expected: FAIL because the shell does not accept/use the player yet.

- [ ] **Step 2: Replace the existing line effect with one shared progression observer**

Add imports in `ReaderShell.svelte`:

```ts
import {
  createSfxPlayer as createDefaultSfxPlayer,
  type SfxPlayer,
} from '@/lib/audio/sfx-player';
import { nextSfxCommand } from '@/lib/audio/sfx-transition';
import {
  readSfxEnabled,
  writeSfxEnabled,
} from '@/lib/audio/sfx-preference';
```

Add the injectable prop beside `createVisualRuntime`:

```ts
createSfxPlayer = createDefaultSfxPlayer,
```

with type:

```ts
createSfxPlayer?: () => SfxPlayer;
```

Create shell-owned instances once:

```ts
let sfxEnabled = $state(readSfxEnabled());
const sfxPlayer = createSfxPlayer();
```

Replace the current `lastActiveLineKey` effect with one observer that preserves visual revalidation and adds SFX commands without another identity tracker:

```ts
let lastActiveLineKey: string | null = $state(null);
$effect(() => {
    const activeLineKey =
        `${storyId}\u0000${currentSceneId}\u0000${dialogueIndex}`;
    const previousLineKey = lastActiveLineKey;
    const lineChanged =
        previousLineKey !== null && previousLineKey !== activeLineKey;
    const command = nextSfxCommand(
        previousLineKey,
        activeLineKey,
        dialogue[dialogueIndex]?.sfx,
        { mode: readerMode, enabled: sfxEnabled }
    );

    lastActiveLineKey = activeLineKey;

    if (
        lineChanged &&
        readerMode === 'visual' &&
        visualRuntime &&
        visualRuntimeStoryId === storyId
    ) {
        void visualRuntime.softRevalidate();
    }

    if (command.type === 'play') sfxPlayer.play(command.cueKey);
    else if (command.type === 'stop') sfxPlayer.stop();
});
```

Do not call `softRevalidate()` on the initial `prime`; the existing behavior is retained by `previousLineKey !== null`.

- [ ] **Step 3: Add explicit mode/preference/destroy cleanup**

In `setReaderMode`:

```ts
if (mode === 'text') sfxPlayer.stop();
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

In `onDestroy`:

```ts
sfxPlayer.dispose();
```

Because changing mode/preference does not change `activeLineKey`, the shared effect returns `noop` for the current line and re-enable/Text->Visual cannot replay it.

- [ ] **Step 4: Update the settings component test helper before changing required props**

In `ReaderSettingsMenu.test.ts`, extend `renderSettings()`:

```ts
sfxEnabled: true,
onSfxEnabledChange: vi.fn(),
```

Add a direct settings contract test:

```ts
it('exposes and toggles the sound-effects preference', async () => {
    const onSfxEnabledChange = vi.fn();
    const view = renderSettings({ onSfxEnabledChange, sfxEnabled: true });

    const enabled = screen.getByRole('button', { name: /Sound effects/i });
    expect(enabled).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(enabled);
    expect(onSfxEnabledChange).toHaveBeenCalledWith(false);

    view.unmount();
    renderSettings({ sfxEnabled: false });
    expect(
        screen.getByRole('button', { name: /Sound effects/i })
    ).toHaveAttribute('aria-pressed', 'false');
});
```

Run `ReaderSettingsMenu.test.ts`; expected FAIL until props/UI/translations exist.

- [ ] **Step 5: Add settings props, UI, and translation parity**

Pass from `ReaderShell`:

```svelte
{sfxEnabled}
onSfxEnabledChange={setSfxEnabled}
```

Add required props in `ReaderSettingsMenu.svelte`:

```ts
sfxEnabled: boolean;
onSfxEnabledChange: (enabled: boolean) => void;
```

Render after the Text/Visual selector:

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

Add to `packages/stories/src/translations/en.json` under `reader`:

```json
"soundEffects": "Sound effects",
"soundEffectsOn": "On",
"soundEffectsOff": "Off"
```

Add to `zh.json`:

```json
"soundEffects": "音效",
"soundEffectsOn": "開啟",
"soundEffectsOff": "關閉"
```

Update the mocked `reader` translation object in `ReaderShell.test.ts` with the same three English keys.

Do not modify `MobileNovelReader` for this setting.

- [ ] **Step 6: Add one shell settings-wiring assertion**

Extend `ReaderShell.test.ts` with a small test that opens settings, starts from enabled, clicks Sound effects, and checks `player.stop()` plus persistence:

```ts
it('stops immediately and persists when sfx is disabled', async () => {
    stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    const { player } = createSfxHarness();
    render(ReaderShell, { props: { createSfxPlayer: () => player } });

    await fireEvent.click(
        screen.getByRole('button', { name: 'Open reader settings' })
    );
    await fireEvent.click(
        screen.getByRole('button', { name: /Sound effects/i })
    );

    expect(player.stop).toHaveBeenCalledOnce();
    expect(localStorage.getItem('aquila:sfx-enabled:v1')).toBe('false');
});
```

- [ ] **Step 7: Run the focused reader/settings suite**

```bash
bun --filter web test -- \
  ReaderSettingsMenu.test.ts \
  ReaderShell.test.ts \
  sfx-transition.test.ts \
  sfx-player.test.ts \
  sfx-preference.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit ReaderShell/settings integration**

```bash
git add apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/ReaderSettingsMenu.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts \
  apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts \
  packages/stories/src/translations/en.json \
  packages/stories/src/translations/zh.json
git commit -m "feat(web): play dialogue sfx from reader shell"
```

---

### Task 4: Generate valid local WAV fixtures and annotate three existing beats

**Files:**
- Create: `apps/web/public/assets/vn/audio/sfx/door-open.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/impact.wav`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Regenerate: `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts`
- Regenerate: `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts`

**Interfaces:**
- Authored keys must exactly match the bootstrap allowlist and web catalog.
- WAVs are 8 kHz, mono, 16-bit PCM RIFF/WAVE files generated from synthetic samples.

- [ ] **Step 1: Generate three deterministic, license-free PCM WAV fixtures**

Run this one-off Bun script from the repository root; do not commit the script itself:

```bash
mkdir -p /tmp/aquila-hpa604
cat >/tmp/aquila-hpa604/generate-wav.ts <<'EOF'
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const sampleRate = 8000;

function writeWav(
    path: string,
    durationSeconds: number,
    sample: (t: number) => number
): void {
    const sampleCount = Math.floor(sampleRate * durationSeconds);
    const data = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const value = Math.max(-1, Math.min(1, sample(t)));
        data.writeInt16LE(Math.round(value * 32767), i * 2);
    }

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.concat([header, data]));
}

const out = 'apps/web/public/assets/vn/audio/sfx';

writeWav(`${out}/notification-beep.wav`, 0.18, t => {
    const envelope = Math.min(1, t / 0.01) * Math.exp(-5 * t);
    return 0.45 * Math.sin(2 * Math.PI * 880 * t) * envelope;
});

writeWav(`${out}/impact.wav`, 0.22, t => {
    const envelope = Math.exp(-18 * t);
    return (
        0.7 * Math.sin(2 * Math.PI * 90 * t) +
        0.25 * Math.sin(2 * Math.PI * 180 * t)
    ) * envelope;
});

writeWav(`${out}/door-open.wav`, 0.35, t => {
    const frequency = 140 + 180 * t;
    const envelope = Math.min(1, t / 0.02) * Math.exp(-5 * t);
    return (
        0.38 * Math.sin(2 * Math.PI * frequency * t) +
        0.12 * Math.sin(2 * Math.PI * 60 * t)
    ) * envelope;
});
EOF
bun /tmp/aquila-hpa604/generate-wav.ts
```

Verify file structure, not just non-empty bytes:

```bash
file apps/web/public/assets/vn/audio/sfx/*.wav
```

Expected for each file: RIFF/WAVE, Microsoft PCM, 16-bit mono, 8000 Hz (wording varies by `file` version).

- [ ] **Step 2: Add only the three approved authoring cues**

In `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`, immediately before the existing foot-floor line:

````markdown
```sfx
impact
```
````

Immediately before the existing line:

```markdown
**旁白**：澪推開悠真的房門。
```

add:

````markdown
```sfx
door-open
```
````

In `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`, immediately before the existing line where Mio's phone rings (`澪的手機響了`), add:

````markdown
```sfx
notification-beep
```
````

Do not add any other audio direction.

- [ ] **Step 3: Compile stories and inspect the exact generated fields**

```bash
bun run compile:stories
```

Inspect:

```bash
git diff -- \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
```

Expected:

- exactly one `sfx: "impact"` and one `sfx: "door-open"` in `ch1_act1.ts`;
- exactly one `sfx: "notification-beep"` in `ch1_act4.ts`;
- uncued generated entries remain structurally unchanged.

- [ ] **Step 4: Run stories tests after real source compilation**

```bash
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 5: Commit fixtures and authored/generated cues with explicit paths**

```bash
git add apps/web/public/assets/vn/audio/sfx/door-open.wav \
  apps/web/public/assets/vn/audio/sfx/notification-beep.wav \
  apps/web/public/assets/vn/audio/sfx/impact.wav \
  packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
git commit -m "feat(story): add local dialogue sfx fixtures"
```

Do not use `git add -p` or `git add -A` for this task.

---

### Task 5: Run full verification and manual lifecycle smoke

**Files:**
- No planned source changes. If a verification command changes generated output, stop and reconcile that drift with the task that owns the file before proceeding.

**Interfaces:**
- Verifies the complete HPA-604 acceptance contract.

- [ ] **Step 1: Run the complete automated verification set from repository root**

```bash
bun --filter @aquila/stories test
bun --filter web test
bun run compile:check
bun run lint
bun run build
```

Expected: every command exits 0. `compile:check` must leave no diff in generated story output.

- [ ] **Step 2: Confirm the implementation diff stayed inside the planned surface**

```bash
git status --short
git diff main...HEAD --name-only
```

Expected implementation paths are limited to:

```text
packages/stories/src/audio-cues.ts
packages/stories/src/index.ts
packages/stories/src/compiler/parse-scene.ts
packages/stories/src/compiler/ir.ts
packages/stories/src/types.ts
packages/stories/src/compiler/emit.ts
packages/stories/src/compiler/__tests__/parse-scene.test.ts
packages/stories/src/compiler/__tests__/emit.test.ts
apps/web/src/lib/audio/sfx-catalog.ts
apps/web/src/lib/audio/sfx-player.ts
apps/web/src/lib/audio/sfx-preference.ts
apps/web/src/lib/audio/sfx-transition.ts
apps/web/src/lib/__tests__/sfx-player.test.ts
apps/web/src/lib/__tests__/sfx-preference.test.ts
apps/web/src/lib/__tests__/sfx-transition.test.ts
apps/web/src/components/ReaderShell.svelte
apps/web/src/components/ReaderSettingsMenu.svelte
apps/web/src/components/__tests__/ReaderShell.test.ts
apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts
packages/stories/src/translations/en.json
packages/stories/src/translations/zh.json
apps/web/public/assets/vn/audio/sfx/door-open.wav
apps/web/public/assets/vn/audio/sfx/notification-beep.wav
apps/web/public/assets/vn/audio/sfx/impact.wav
packages/stories/raw/theSeventhMirror/chapter_1/act1.md
packages/stories/raw/theSeventhMirror/chapter_1/act4.md
packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts
packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
```

Documentation-plan files may also be present if implementation is performed on this planning branch. Any other source path requires an explicit scope explanation before merge.

- [ ] **Step 3: Run the manual web-reader smoke**

Start the web app with the project's existing development command and exercise a Seventh Mirror path containing the three annotated lines.

Verify, in order:

1. initial/restored Visual line stays silent;
2. foot-floor `impact` plays once on entering that line;
3. bedroom `door-open` plays once;
4. phone `notification-beep` plays once;
5. open/close Settings and History while on a cued line — no replay;
6. cross the `1023px` responsive breakpoint — no replay;
7. disable Sound effects while a fixture is playing — it stops immediately;
8. reload — disabled state persists;
9. re-enable — current line does not replay;
10. advance to a later cue — playback resumes;
11. switch to Text — current effect stops and later cues remain silent;
12. switch back to Visual — current line does not replay.

- [ ] **Step 4: Record verification evidence in the implementation PR description**

Record the five automated commands and the manual smoke result. Do not claim passing status for any command that was not freshly run.

---

## Review Resolution Embedded in This Plan

- **Compiler contract:** accepted. HPA-604 now has a tiny shared three-key bootstrap allowlist, strict malformed/unknown/pending/EOF failures, and `Record<SfxCueKey, string>` catalog completeness. HPA-606 still owns the real per-story audio-plan authority.
- **Line identity:** accepted. No SFX-specific identity state; `nextSfxCommand` is pure and consumes the existing shell line key.
- **Storage reuse:** accepted. `sfx-preference.ts` imports `getBrowserStorage()`.
- **Settings tests:** accepted. `ReaderSettingsMenu.test.ts` is explicitly in the file map and owns direct toggle semantics.
- **Fixtures:** accepted. WAVs are generated as valid deterministic PCM, then checked with `file`.
- **Agentic staging:** accepted. Every commit step names exact paths; no `git add -p` or `git add -A`.
- **Non-goals:** unchanged.
