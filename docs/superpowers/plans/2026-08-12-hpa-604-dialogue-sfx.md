# HPA-604 Dialogue-Triggered SFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compile-validated one-shot SFX cues to Aquila story dialogue and play them only on genuine forward visual-reader progression using native browser audio and three reproducible local fixtures.

**Architecture:** Story Markdown carries one logical `sfx` key for the next dialogue entry. `@aquila/stories` owns a temporary three-key HPA-604 bootstrap allowlist and compiler propagation. `apps/web` owns a tiny typed URL catalog, a one-element native player, one persisted boolean, and a pure transition helper. `ReaderShell` keeps one structured previous line position shared by visual revalidation and SFX classification; it does not create a parallel audio identity tracker.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Svelte 5, Vitest, Testing Library, native `HTMLAudioElement`, deterministic PCM WAV fixtures.

## Global Constraints

- Keep runtime `DialogueEntry.sfx` as `string`, not `SfxCueKey`.
- HPA-604's `SFX_CUE_KEYS` is bootstrap authority only; HPA-606 replaces semantic key validation with per-story `audio-plan.json`.
- Story Markdown contains logical keys only: no URLs, paths, prompts, provider/model IDs, volume, delay, or channels.
- Playback belongs to `ReaderShell`, never `VisualNovelReader` or typewriter/render effects.
- Keep exactly one previous `LinePosition` in the shell; do not keep a NUL-string tracker plus an SFX tracker.
- Play only on same-scene `index + 1` or a direct forward flow edge to destination index 0.
- Normal linear and choice-driven forward scene transitions are eligible; backward movement and non-adjacent Act-panel jumps are silent.
- Use native browser audio only; no audio framework, manager, mixer, event bus, generic timeline, or global preference store.
- Runtime playback failures never block reader progression.
- SFX is Visual-mode-only; hide its control in Text settings and do not add it to the mobile Text hamburger.
- Generate exactly three local fixtures and annotate exactly three existing early Seventh Mirror beats.
- Keep local URL resolution in one catalog module. HPA-610 replaces that seam with its dedicated audio resolver; do not generalize the visual `WebAssetResolver` in HPA-604.
- Final web verification must run `test:coverage` because Codecov requires 95% project and patch coverage.
- Do not implement BGM, ElevenLabs, R2 audio delivery, Phaser parity, story-wide sound design, or authoring-skill changes.

---

## File Structure

**Stories package**

- Create `packages/stories/src/audio-cues.ts` — temporary three-key bootstrap allowlist/type guard.
- Modify `packages/stories/src/index.ts` — export bootstrap cue contract.
- Modify `packages/stories/src/compiler/parse-scene.ts` — strict pending-SFX parsing.
- Modify `packages/stories/src/compiler/ir.ts` — add `sfx?: string`.
- Modify `packages/stories/src/types.ts` — add runtime `sfx?: string`.
- Modify `packages/stories/src/compiler/emit.ts` — emit SFX only when authored.
- Modify `packages/stories/src/compiler/__tests__/parse-scene.test.ts`.
- Modify `packages/stories/src/compiler/__tests__/emit.test.ts`.

**Web audio**

- Create `apps/web/src/lib/audio/sfx-catalog.ts` — typed bootstrap logical-key -> local URL map.
- Create `apps/web/src/lib/audio/sfx-player.ts` — one-element native player.
- Create `apps/web/src/lib/audio/sfx-preference.ts` — persisted boolean using `getBrowserStorage()`.
- Create `apps/web/src/lib/audio/sfx-transition.ts` — `LinePosition`, flow-edge check, and pure SFX command classifier.
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

**Reproducible fixtures**

- Create `apps/web/scripts/build-sfx-fixtures.ts` — deterministic builder plus `--verify` mode.
- Modify `apps/web/package.json` — add build/verify scripts.
- Modify `.github/workflows/build-and-lint.yml` — verify SFX fixtures in CI.
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
- Produces `SFX_CUE_KEYS`, `SfxCueKey`, `isSfxCueKey(value)`.
- Produces `DialogueEntryIR.sfx?: string` and `DialogueEntry.sfx?: string`.
- Valid bootstrap keys are exactly `door-open`, `notification-beep`, `impact`.

- [ ] **Step 1: Add failing parser tests for valid consumption and coexistence**

Append to `parse-scene.test.ts`:

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

- [ ] **Step 2: Add failing parser tests for authoring failures**

```ts
it.each([
    ['empty', ['```sfx', '', '```'].join('\n')],
    ['multi-token', ['```sfx', 'door open', '```'].join('\n')],
    ['unknown', ['```sfx', 'door-opne', '```'].join('\n')],
    ['capitalized', ['```sfx', 'Door-Open', '```'].join('\n')],
])('rejects %s sfx blocks', (_label, block) => {
    const md = [block, '', '**旁白**：hello'].join('\n');
    expect(() => parseScene(md, resolve, 'act1.md')).toThrow(/sfx/i);
});

it('rejects a second sfx block while one is pending', () => {
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

it('rejects an unconsumed sfx block at EOF', () => {
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

Expected: FAIL because `sfx` is not parsed yet.

- [ ] **Step 3: Add the bootstrap cue module and exports**

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

Add to `packages/stories/src/index.ts`:

```ts
export { SFX_CUE_KEYS, isSfxCueKey } from './audio-cues';
export type { SfxCueKey } from './audio-cues';
```

Do not type runtime `DialogueEntry.sfx` as `SfxCueKey`.

- [ ] **Step 4: Extend compiler/runtime types**

Add to `DialogueEntryIR` and runtime `DialogueEntry`:

```ts
sfx?: string;
```

- [ ] **Step 5: Implement strict pending-SFX parsing**

In `parse-scene.ts`:

```ts
import { isSfxCueKey } from '../audio-cues';

const SFX_BLOCK_RE =
    /^```sfx[ \t]*\n[ \t]*([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;
```

Add beside `pendingBg`:

```ts
let pendingSfx: string | undefined;
```

Handle SFX before normal paragraph parsing:

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

Consume `pendingSfx` in both default-speaker and explicit-speaker paths, independently of `pendingBg`:

```ts
...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
```

then set:

```ts
pendingSfx = undefined;
```

After the loop:

```ts
if (pendingSfx !== undefined) {
    throw new Error(
        `[story-compiler] ${sourcePath}: unconsumed sfx "${pendingSfx}" at end of scene`
    );
}
```

Do not change `bg` duplicate/EOF behavior.

- [ ] **Step 6: Run parser tests**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts
```

Expected: PASS.

- [ ] **Step 7: Add failing emitter coverage**

Add to `emit.test.ts`:

```ts
it('emits sfx only on authored entries', () => {
    const storyWithSfx: StoryIR = {
        storyId: 'demo_story',
        name: 'demoStory',
        start: 'act1',
        scenes: [{
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
        }],
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

Inside `emitSceneFile`:

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

### Task 2: Build the tiny web audio seam and forward-transition classifier

**Files:**
- Create: `apps/web/src/lib/audio/sfx-catalog.ts`
- Create: `apps/web/src/lib/audio/sfx-player.ts`
- Create: `apps/web/src/lib/audio/sfx-preference.ts`
- Create: `apps/web/src/lib/audio/sfx-transition.ts`
- Test: `apps/web/src/lib/__tests__/sfx-player.test.ts`
- Test: `apps/web/src/lib/__tests__/sfx-preference.test.ts`
- Test: `apps/web/src/lib/__tests__/sfx-transition.test.ts`

**Interfaces:**

```ts
export interface SfxPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

export type LinePosition = {
    storyId: string;
    sceneId: string;
    index: number;
};

export type SfxCommand =
    | { type: 'play'; cueKey: string }
    | { type: 'stop' }
    | { type: 'noop' };
```

- [ ] **Step 1: Add failing transition-table tests**

Create `sfx-transition.test.ts` with a tiny flow containing one linear edge and one choice edge:

```ts
import { describe, expect, it } from 'vitest';
import type { StoryFlowConfig } from '@aquila/stories';
import { nextSfxCommand, type LinePosition } from '@/lib/audio/sfx-transition';

const flow = {
    start: 'a',
    nodes: [
        { kind: 'scene', id: 'a', sceneId: 'a', next: 'b' },
        { kind: 'scene', id: 'b', sceneId: 'b', next: 'choice:fork' },
        {
            kind: 'choice',
            id: 'choice:fork',
            choiceId: 'fork',
            nextByOption: { left: 'c', right: 'd' },
        },
        { kind: 'scene', id: 'c', sceneId: 'c', next: null },
        { kind: 'scene', id: 'd', sceneId: 'd', next: null },
        { kind: 'scene', id: 'old', sceneId: 'old', next: null },
    ],
} satisfies StoryFlowConfig;

const p = (sceneId: string, index: number): LinePosition => ({
    storyId: 'story',
    sceneId,
    index,
});

const visual = { mode: 'visual' as const, enabled: true, flow };

it.each([
    ['initial', null, p('a', 0), 'door-open', 'noop'],
    ['same position', p('a', 0), p('a', 0), 'door-open', 'noop'],
    ['forward line', p('a', 0), p('a', 1), 'door-open', 'play'],
    ['backward line', p('a', 2), p('a', 1), 'door-open', 'noop'],
    ['forward index jump', p('a', 0), p('a', 2), 'door-open', 'noop'],
    ['linear scene edge', p('a', 3), p('b', 0), 'door-open', 'play'],
    ['choice scene edge', p('b', 3), p('c', 0), 'door-open', 'play'],
    ['non-adjacent scene jump', p('c', 1), p('a', 0), 'door-open', 'noop'],
    ['reverse scene edge', p('b', 0), p('a', 0), 'door-open', 'noop'],
] as const)(
    '%s',
    (_label, previous, next, cueKey, expected) => {
        expect(nextSfxCommand(previous, next, cueKey, visual).type).toBe(expected);
    }
);

it('stops on story replacement', () => {
    expect(
        nextSfxCommand(
            p('a', 1),
            { storyId: 'replacement', sceneId: 'start', index: 0 },
            'door-open',
            visual
        )
    ).toEqual({ type: 'stop' });
});

it.each([
    [{ mode: 'text' as const, enabled: true, flow }, 'text'],
    [{ mode: 'visual' as const, enabled: false, flow }, 'disabled'],
])('does not play while %s', (options) => {
    expect(nextSfxCommand(p('a', 0), p('a', 1), 'door-open', options)).toEqual({
        type: 'noop',
    });
});

it('does not play an uncued forward transition', () => {
    expect(nextSfxCommand(p('a', 0), p('a', 1), undefined, visual)).toEqual({
        type: 'noop',
    });
});
```

Run:

```bash
bun --filter web test -- sfx-transition.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement one structured transition helper**

Create `sfx-transition.ts`:

```ts
import type { ReaderMode } from '@/lib/reader-mode';
import type { StoryFlowConfig } from '@aquila/stories';

export type LinePosition = {
    storyId: string;
    sceneId: string;
    index: number;
};

export type SfxCommand =
    | { type: 'play'; cueKey: string }
    | { type: 'stop' }
    | { type: 'noop' };

export function sameLinePosition(
    left: LinePosition | null,
    right: LinePosition
): boolean {
    return (
        left !== null &&
        left.storyId === right.storyId &&
        left.sceneId === right.sceneId &&
        left.index === right.index
    );
}

function isDirectFlowEdge(
    flow: StoryFlowConfig | null,
    fromSceneId: string,
    toSceneId: string
): boolean {
    if (!flow) return false;
    const scene = flow.nodes.find(
        node => node.kind === 'scene' && node.sceneId === fromSceneId
    );
    if (!scene || scene.kind !== 'scene' || !scene.next) return false;
    if (scene.next === toSceneId) return true;
    if (!scene.next.startsWith('choice:')) return false;

    const choice = flow.nodes.find(
        node => node.kind === 'choice' && node.id === scene.next
    );
    return (
        choice?.kind === 'choice' &&
        Object.values(choice.nextByOption).includes(toSceneId)
    );
}

function isForwardAdjacent(
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

export function nextSfxCommand(
    previous: LinePosition | null,
    next: LinePosition,
    cueKey: string | undefined,
    options: {
        mode: ReaderMode;
        enabled: boolean;
        flow: StoryFlowConfig | null;
    }
): SfxCommand {
    if (!previous) return { type: 'noop' };
    if (previous.storyId !== next.storyId) return { type: 'stop' };
    if (!isForwardAdjacent(previous, next, options.flow)) {
        return { type: 'noop' };
    }
    if (options.mode !== 'visual' || !options.enabled || !cueKey) {
        return { type: 'noop' };
    }
    return { type: 'play', cueKey };
}
```

Do not add string parsing or a second line tracker.

- [ ] **Step 3: Run transition tests**

```bash
bun --filter web test -- sfx-transition.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add the typed local catalog**

Create `sfx-catalog.ts`:

```ts
import type { SfxCueKey } from '@aquila/stories';

export const LOCAL_SFX_CATALOG = {
    'door-open': '/assets/vn/audio/sfx/door-open.wav',
    'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
    impact: '/assets/vn/audio/sfx/impact.wav',
} satisfies Record<SfxCueKey, string>;

export function resolveLocalSfxUrl(cueKey: string): string | undefined {
    return (LOCAL_SFX_CATALOG as Readonly<Record<string, string>>)[cueKey];
}
```

- [ ] **Step 5: Add player tests, including both exception paths**

Create `sfx-player.test.ts`. Use injected fake audio objects and mock `@/lib/logger`.

Required cases:

```ts
it('starts a catalog cue', () => { /* assert createAudio URL + play once */ });
it('replaces the current cue and rewinds it', () => { /* pause + currentTime=0 */ });
it('logs and returns for an unknown runtime key', () => { /* logger.warn once */ });
it('contains a rejected play promise', async () => { /* play -> Promise.reject */ });
it('contains a synchronous play throw', () => { /* play throws before returning */ });
it('contains pause/rewind failures during stop', () => { /* pause/currentTime setter throw */ });
it('disposes once and becomes inert', () => { /* later play is ignored */ });
```

Run:

```bash
bun --filter web test -- sfx-player.test.ts
```

Expected: FAIL because the player does not exist.

- [ ] **Step 6: Implement the native one-element player**

Create `sfx-player.ts`:

```ts
import { logger } from '@/lib/logger';
import { resolveLocalSfxUrl } from './sfx-catalog';

export interface SfxPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

type AudioLike = Pick<HTMLAudioElement, 'play' | 'pause' | 'currentTime'>;
type CreateAudio = (src: string) => AudioLike;

export function createSfxPlayer(
    createAudio: CreateAudio = src => new Audio(src)
): SfxPlayer {
    let current: AudioLike | null = null;
    let disposed = false;

    function stopCurrent(): void {
        const audio = current;
        current = null;
        if (!audio) return;
        try {
            audio.pause();
        } catch {
            // Best-effort one-shot cleanup.
        }
        try {
            audio.currentTime = 0;
        } catch {
            // Best-effort one-shot cleanup.
        }
    }

    return {
        play(cueKey: string): void {
            if (disposed) return;
            stopCurrent();
            const src = resolveLocalSfxUrl(cueKey);
            if (!src) {
                logger.warn('Unknown visual-novel SFX cue', { cueKey });
                return;
            }
            try {
                const audio = createAudio(src);
                current = audio;
                const result = audio.play();
                void result.catch(() => {
                    if (current === audio) current = null;
                });
            } catch {
                current = null;
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

If TypeScript rejects `Pick<HTMLAudioElement, 'currentTime'>` assignment semantics, replace the alias with a local interface containing mutable `currentTime: number`; do not broaden the abstraction.

- [ ] **Step 7: Run player tests**

```bash
bun --filter web test -- sfx-player.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add preference tests and implementation using shared storage access**

Create `sfx-preference.test.ts` covering:

- absent value -> enabled;
- stored `false` -> disabled;
- stored `true` -> enabled;
- write stores `true`/`false`;
- throwing storage read/write does not escape.

Create `sfx-preference.ts`:

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

Run:

```bash
bun --filter web test -- sfx-preference.test.ts
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
git commit -m "feat(web): add visual-novel sfx seam"
```

---

### Task 3: Integrate SFX with the single ReaderShell position tracker and Visual-only settings

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/ReaderSettingsMenu.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`

**Interfaces:**
- `ReaderShell` gains injectable `createSfxPlayer?: () => SfxPlayer`.
- `ReaderSettingsMenu` gains required `sfxEnabled: boolean` and `onSfxEnabledChange(enabled: boolean)` props.

- [ ] **Step 1: Extend `ReaderSettingsMenu.test.ts` required props and add Visual-only toggle tests**

Update `renderSettings()` defaults:

```ts
sfxEnabled: true,
onSfxEnabledChange: vi.fn(),
```

Add:

```ts
it('shows and toggles Sound Effects only in Visual mode', async () => {
    const onSfxEnabledChange = vi.fn();
    const view = renderSettings({ onSfxEnabledChange, mode: 'visual' });

    const toggle = screen.getByRole('button', { name: /Sound effects/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(toggle);
    expect(onSfxEnabledChange).toHaveBeenCalledWith(false);

    view.unmount();
    renderSettings({ mode: 'text' });
    expect(
        screen.queryByRole('button', { name: /Sound effects/i })
    ).not.toBeInTheDocument();
});
```

Because this test uses real translations, missing translation keys fail here rather than being hidden by the `ReaderShell` translation mock.

- [ ] **Step 2: Add translations and Visual-only menu UI**

Add reader keys:

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

Add props to `ReaderSettingsMenu.svelte` and render after the mode selector:

```svelte
{#if mode === 'visual'}
  <button
    type="button"
    class="flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
    aria-pressed={sfxEnabled}
    aria-label={t.reader.soundEffects}
    onclick={() => onSfxEnabledChange(!sfxEnabled)}
  >
    <span>{t.reader.soundEffects}</span>
    <span>{sfxEnabled ? t.reader.soundEffectsOn : t.reader.soundEffectsOff}</span>
  </button>
{/if}
```

Run:

```bash
bun --filter web test -- ReaderSettingsMenu.test.ts
```

Expected: PASS.

- [ ] **Step 3: Add a fake SFX player to `ReaderShell.test.ts` and focused integration cases**

Extend mocked reader translations with the three SFX keys. Add a harness:

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

Add only integration cases that pure helper tests cannot prove:

1. initial line is silent, then `dialogueIndex = 1` in Visual mode delegates that line's cue once;
2. responsive remount keeps the same injected player and does not replay an unchanged position;
3. a non-adjacent scene jump updates the shell but does not call `play`;
4. Visual -> Text calls `stop`;
5. disabling SFX calls `stop`, and re-enabling does not replay current line;
6. story replacement calls `stop` and does not play replacement line;
7. unmount calls `dispose` once.

Use SFX-bearing test dialogue only in tests that need it; do not rewrite the entire existing fixture array.

- [ ] **Step 4: Integrate one structured position tracker in `ReaderShell`**

Import:

```ts
import {
  createSfxPlayer as createDefaultSfxPlayer,
  type SfxPlayer,
} from '@/lib/audio/sfx-player';
import { readSfxEnabled, writeSfxEnabled } from '@/lib/audio/sfx-preference';
import {
  nextSfxCommand,
  sameLinePosition,
  type LinePosition,
} from '@/lib/audio/sfx-transition';
```

Add injected prop:

```ts
createSfxPlayer = createDefaultSfxPlayer,
```

with type:

```ts
createSfxPlayer?: () => SfxPlayer;
```

Create shell-owned values once:

```ts
const sfxPlayer = createSfxPlayer();
let sfxEnabled = $state(readSfxEnabled());
let lastActivePosition: LinePosition | null = $state(null);
```

Replace `lastActiveLineKey` with the structured position. The single progression effect becomes:

```ts
$effect(() => {
    const nextPosition: LinePosition = {
        storyId,
        sceneId: currentSceneId,
        index: dialogueIndex,
    };
    const previous = lastActivePosition;
    if (sameLinePosition(previous, nextPosition)) return;
    lastActivePosition = nextPosition;

    if (
        previous !== null &&
        readerMode === 'visual' &&
        visualRuntime &&
        visualRuntimeStoryId === storyId
    ) {
        void visualRuntime.softRevalidate();
    }

    const command = nextSfxCommand(
        previous,
        nextPosition,
        dialogue[dialogueIndex]?.sfx,
        { mode: readerMode, enabled: sfxEnabled, flow: activeFlow }
    );
    if (command.type === 'play') sfxPlayer.play(command.cueKey);
    else if (command.type === 'stop') sfxPlayer.stop();
});
```

This is the only previous-line tracker.

- [ ] **Step 5: Add explicit mode/preference cleanup**

In `setReaderMode`, before/while changing to Text:

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

Pass settings props:

```svelte
{sfxEnabled}
onSfxEnabledChange={setSfxEnabled}
```

- [ ] **Step 6: Run focused shell/settings tests**

```bash
bun --filter web test -- ReaderShell.test.ts ReaderSettingsMenu.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit reader integration**

```bash
git add apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/ReaderSettingsMenu.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts \
  apps/web/src/components/__tests__/ReaderSettingsMenu.test.ts \
  packages/stories/src/translations/en.json \
  packages/stories/src/translations/zh.json
git commit -m "feat(web): play dialogue sfx on forward progression"
```

---

### Task 4: Add reproducible PCM fixtures, CI verification, and three authored beats

**Files:**
- Create: `apps/web/scripts/build-sfx-fixtures.ts`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/build-and-lint.yml`
- Create: `apps/web/public/assets/vn/audio/sfx/door-open.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/notification-beep.wav`
- Create: `apps/web/public/assets/vn/audio/sfx/impact.wav`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act1.md`
- Modify: `packages/stories/raw/theSeventhMirror/chapter_1/act4.md`
- Regenerate: `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts`
- Regenerate: `packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts`

**Interfaces:**
- `bun --filter web build:sfx-fixtures` regenerates all three WAVs deterministically.
- `bun --filter web verify:sfx-fixtures` structurally validates and byte-compares committed fixtures to regenerated expected bytes.

- [ ] **Step 1: Add the committed deterministic fixture builder/verifier**

Create `apps/web/scripts/build-sfx-fixtures.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const webRoot = process.cwd();
const outputRoot = resolve(webRoot, 'public/assets/vn/audio/sfx');

function pcm16Wav(samples: Int16Array): Buffer {
    const dataBytes = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataBytes);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(CHANNELS, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
    buffer.writeUInt16LE(CHANNELS * 2, 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataBytes, 40);
    for (let i = 0; i < samples.length; i += 1) {
        buffer.writeInt16LE(samples[i], 44 + i * 2);
    }
    return buffer;
}

function synth(
    durationMs: number,
    sampleAt: (timeSeconds: number, progress: number) => number
): Buffer {
    const count = Math.round((SAMPLE_RATE * durationMs) / 1000);
    const samples = new Int16Array(count);
    for (let i = 0; i < count; i += 1) {
        const t = i / SAMPLE_RATE;
        const progress = i / Math.max(1, count - 1);
        const value = Math.max(-1, Math.min(1, sampleAt(t, progress)));
        samples[i] = Math.round(value * 0x7fff);
    }
    return pcm16Wav(samples);
}

function fixtures(): Record<string, Buffer> {
    return {
        'notification-beep.wav': synth(180, (t, p) =>
            Math.sin(2 * Math.PI * 880 * t) * Math.sin(Math.PI * p) * 0.5
        ),
        'impact.wav': synth(220, (t, p) =>
            Math.sin(2 * Math.PI * 95 * t) * Math.exp(-7 * p) * 0.9
        ),
        'door-open.wav': synth(450, (t, p) => {
            const frequency = 150 - 70 * p;
            return Math.sin(2 * Math.PI * frequency * t) * (1 - p) * 0.55;
        }),
    };
}

function verifyWav(name: string, bytes: Buffer): void {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${name}: RIFF`);
    if (bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${name}: WAVE`);
    if (bytes.toString('ascii', 12, 16) !== 'fmt ') throw new Error(`${name}: fmt`);
    if (bytes.readUInt16LE(20) !== 1) throw new Error(`${name}: not PCM`);
    if (bytes.readUInt16LE(22) !== 1) throw new Error(`${name}: not mono`);
    if (bytes.readUInt16LE(34) !== 16) throw new Error(`${name}: not PCM-16`);
    if (bytes.toString('ascii', 36, 40) !== 'data') throw new Error(`${name}: data`);
    const dataBytes = bytes.readUInt32LE(40);
    if (dataBytes <= 0 || bytes.length !== 44 + dataBytes) {
        throw new Error(`${name}: invalid data length`);
    }
}

export async function buildSfxFixtures(): Promise<void> {
    for (const [name, bytes] of Object.entries(fixtures())) {
        const path = resolve(outputRoot, name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
    }
}

export async function verifySfxFixtures(): Promise<void> {
    for (const [name, expected] of Object.entries(fixtures())) {
        const actual = await readFile(resolve(outputRoot, name));
        verifyWav(name, actual);
        if (!actual.equals(expected)) {
            throw new Error(`${name}: committed bytes differ from deterministic generator`);
        }
    }
}

if (import.meta.main) {
    if (process.argv.includes('--verify')) await verifySfxFixtures();
    else await buildSfxFixtures();
}
```

- [ ] **Step 2: Wire build/verify scripts and CI verification**

Add to `apps/web/package.json`:

```json
"build:sfx-fixtures": "bun scripts/build-sfx-fixtures.ts",
"verify:sfx-fixtures": "bun scripts/build-sfx-fixtures.ts --verify"
```

In `.github/workflows/build-and-lint.yml`, directly after visual fixture verification:

```yaml
      - name: Verify SFX fixtures
        run: bun --filter web verify:sfx-fixtures
```

- [ ] **Step 3: Generate and verify the WAV files**

```bash
bun --filter web build:sfx-fixtures
bun --filter web verify:sfx-fixtures
```

Expected: both commands exit 0 and the three exact WAV paths exist.

- [ ] **Step 4: Annotate exactly three existing story beats**

In `chapter_1/act1.md`, place:

````markdown
```sfx
impact
```
````

immediately before the existing narration where Mio's feet hit the floor.

Place:

````markdown
```sfx
door-open
```
````

immediately before `**旁白**：澪推開悠真的房門。`.

In `chapter_1/act4.md`, place:

````markdown
```sfx
notification-beep
```
````

immediately before the existing narration where Mio's phone rings.

Do not annotate any additional lines.

- [ ] **Step 5: Regenerate stories and inspect only the intended generated scene files**

```bash
bun run compile:stories
git diff -- packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
```

Expected: exactly three emitted `sfx` properties across those two generated scene files.

- [ ] **Step 6: Run focused compiler and fixture verification**

```bash
bun --filter @aquila/stories test -- parse-scene.test.ts emit.test.ts
bun --filter web verify:sfx-fixtures
```

Expected: PASS.

- [ ] **Step 7: Commit fixtures/content/CI wiring**

```bash
git add apps/web/scripts/build-sfx-fixtures.ts \
  apps/web/package.json \
  .github/workflows/build-and-lint.yml \
  apps/web/public/assets/vn/audio/sfx/door-open.wav \
  apps/web/public/assets/vn/audio/sfx/notification-beep.wav \
  apps/web/public/assets/vn/audio/sfx/impact.wav \
  packages/stories/raw/theSeventhMirror/chapter_1/act1.md \
  packages/stories/raw/theSeventhMirror/chapter_1/act4.md \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act1.ts \
  packages/stories/src/generated/theSeventhMirror/scenes/ch1_act4.ts
git commit -m "feat(story): add local dialogue sfx fixtures"
```

Do not use `git add -p` or `git add -A`.

---

### Task 5: Run full coverage-aware verification and manual lifecycle smoke

**Files:** none unless verification exposes a defect.

**Interfaces:** this task proves the implementation against repository CI gates and HPA-604 lifecycle requirements.

- [ ] **Step 1: Run the full automated verification set**

```bash
bun --filter @aquila/stories test
bun --filter web test:coverage
bun --filter web verify:sfx-fixtures
bun run compile:check
bun run lint
bun run build
```

Expected: every command exits 0. `test:coverage` is mandatory because `.github/workflows/unit-tests.yml` uses it and `codecov.yml` requires 95% project and patch coverage.

If `test:coverage` exposes uncovered new branches, add focused tests rather than exclusions. In particular, confirm coverage exists for:

- unknown runtime cue diagnostic;
- rejected `play()` promise;
- synchronous `play()` throw;
- pause/rewind failure containment;
- first-position `noop`;
- backward index and forward index-jump `noop`;
- non-adjacent scene-jump `noop`;
- Visual -> Text `stop`;
- Visual-only settings toggle branch.

There is no separator-less line-key branch to cover because HPA-604 no longer parses opaque NUL-joined keys.

- [ ] **Step 2: Run manual progression/navigation smoke in Visual mode**

Verify in this order:

1. initial/restored line is silent;
2. normal forward line progression plays an authored cue exactly once;
3. all three local fixtures can be reached and heard;
4. moving backward within a scene does not replay a cue;
5. browser Back to an earlier position does not replay a cue;
6. Act panel jump to a non-adjacent earlier/read scene does not replay a cue;
7. a real linear next-scene transition may play an authored destination cue;
8. a real choice transition may play an authored destination cue;
9. History open/close and responsive breakpoint remount do not replay;
10. disabling SFX during playback stops immediately;
11. re-enabling does not replay the current line;
12. reload preserves the muted preference;
13. switching to Text stops playback, hides the SFX control, and later dialogue remains silent.

- [ ] **Step 3: Confirm the final diff stays within HPA-604 scope**

```bash
git status --short
git diff main...HEAD --stat
```

Expected scope:

- story SFX metadata/compiler/tests;
- web SFX transition/player/preference/settings/tests;
- one deterministic SFX fixture script + package/CI verification wiring;
- three WAV fixtures;
- exactly three Seventh Mirror authoring annotations and regenerated output.

There must be no BGM implementation, audio-plan schema, R2 resolver, visual-resolver generalization, Phaser changes, generic event/audio manager, or story-wide cue pass.

- [ ] **Step 4: Commit only if verification required a follow-up fix**

Stage the exact files changed by that fix and use a narrow commit message describing the defect. Do not create a no-op verification commit.

---

## Self-Review Against Planning Feedback

- **Compiler contract:** strict bootstrap allowlist, malformed/unknown/pending/EOF failures, and typed catalog completeness retained.
- **Navigation:** corrected. The helper uses structured positions and direct flow adjacency, so backward movement and non-adjacent Act-panel jumps do not play. Actual linear/choice progression remains eligible.
- **Identity:** one structured previous position replaces the opaque string tracker; no duplicate line-identity machine.
- **History terminology:** corrected. `VisualBacklog` is read-only; `ActPanel` is the scene-jump surface.
- **Fixture reproducibility:** corrected. A committed deterministic builder has a structural + byte-equality verify mode and CI command.
- **Coverage:** corrected. Final verification uses the same `web test:coverage` mode as CI and explicitly covers exception/navigation branches.
- **Settings:** corrected. Sound Effects renders only in Visual settings; direct menu tests own visibility and `aria-pressed` behavior.
- **Runtime diagnostics:** corrected. Unknown runtime keys use the existing logger while staying invisible to the reader.
- **HPA-610 boundary:** clarified. HPA-604 keeps one local catalog seam; HPA-610 replaces it with its dedicated audio resolver rather than turning the image-specific `WebAssetResolver` into a generic media subsystem.
- **Non-goals:** unchanged.
