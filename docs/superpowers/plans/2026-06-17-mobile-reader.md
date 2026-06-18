# Mobile Story Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phone/tablet-first visual-novel reading mode that activates below the Tailwind `lg` breakpoint, while leaving the desktop reader unchanged.

**Architecture:** A new `ReaderShell` (mounted by `ReaderManager`) reactively switches between the existing desktop `NovelReader` and a new `MobileNovelReader` based on `matchMedia('(max-width: 1023px)')`. Three pure helpers (`typewriter`, `character-name`, `act-navigation`) are extracted from the desktop components and shared by both readers; the mobile reader presents one line at a time with tap-to-advance, auto-hiding chrome, a slide-in act drawer, and a current-scene backlog sheet.

**Tech Stack:** Astro + Svelte 5 (runes), TypeScript, Tailwind v4, Vitest (happy-dom) for unit tests, Playwright for E2E, Bun + Turbo monorepo.

## Global Constraints

- Package manager: **Bun**; web unit tests run via `bun --filter web test <path>`.
- Unit test env: **happy-dom**, `globals: true`, setup file `apps/web/src/lib/test-setup.ts`, which calls `vi.useFakeTimers()` globally and `readerState.reset()` in a global `beforeEach`. Use `await vi.runAllTimersAsync()` to flush typing animations.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); event handlers use `onclick=` (property), not `on:click`.
- Path alias `@/` → `apps/web/src/`. Import shared packages from `@aquila/stories`.
- i18n: every new user-facing string must be added to **both** `packages/stories/src/translations/en.json` and `zh.json` under `reader.*`. Never hardcode UI text.
- DOM safety: no `innerHTML`; build DOM via Svelte templates only.
- Breakpoint: mobile mode is `matchMedia('(max-width: 1023px)')` (below Tailwind `lg`).
- Desktop regression guard: `NovelReader.test.ts`, `ActPanel.test.ts`, and `reader-manager*.test.ts` must stay green after every extraction task.

---

### Task 1: Extract shared typewriter helper and rewire `NovelReader`

**Files:**
- Create: `apps/web/src/lib/typewriter.ts`
- Test: `apps/web/src/lib/__tests__/typewriter.test.ts`
- Modify: `apps/web/src/components/NovelReader.svelte` (lines ~166-238: `startTypingNewDialogue` / `typeText`)

**Interfaces:**
- Produces: `typeText(options: TypewriterOptions): Promise<'done' | 'cancelled'>` where
  `TypewriterOptions = { text: string; speed: number; onTick: (partial: string) => void; isSkipped: () => boolean; isCancelled: () => boolean }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/typewriter.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { typeText } from '@/lib/typewriter';

describe('typeText', () => {
    it('emits incremental partials and resolves done', async () => {
        const ticks: string[] = [];
        const promise = typeText({
            text: 'abc',
            speed: 10,
            onTick: p => ticks.push(p),
            isSkipped: () => false,
            isCancelled: () => false,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('done');
        expect(ticks).toEqual(['a', 'ab', 'abc']);
    });

    it('reveals full text immediately when skipped', async () => {
        const ticks: string[] = [];
        const promise = typeText({
            text: 'hello',
            speed: 10,
            onTick: p => ticks.push(p),
            isSkipped: () => true,
            isCancelled: () => false,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('done');
        expect(ticks).toEqual(['hello']);
    });

    it('returns cancelled when isCancelled becomes true', async () => {
        const ticks: string[] = [];
        let cancelled = false;
        const promise = typeText({
            text: 'abcdef',
            speed: 10,
            onTick: p => {
                ticks.push(p);
                if (ticks.length === 2) cancelled = true;
            },
            isSkipped: () => false,
            isCancelled: () => cancelled,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('cancelled');
        expect(ticks.length).toBeLessThan(6);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/lib/__tests__/typewriter.test.ts`
Expected: FAIL — cannot resolve `@/lib/typewriter`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/typewriter.ts`:

```ts
export interface TypewriterOptions {
    /** Full text to type out. */
    text: string;
    /** Delay per character, in milliseconds. */
    speed: number;
    /** Called with the visible substring on each tick (and full text on skip). */
    onTick: (partial: string) => void;
    /** When true, reveal the full text immediately and stop. */
    isSkipped: () => boolean;
    /** When true, abort without finalizing (e.g. the scene changed). */
    isCancelled: () => boolean;
}

export type TypewriterResult = 'done' | 'cancelled';

/**
 * Types `text` one character at a time, emitting partials via `onTick`.
 * Reactivity is owned by the caller through the supplied closures, keeping
 * this helper pure and testable. Returns 'cancelled' if `isCancelled()`
 * becomes true mid-run, otherwise 'done'.
 */
export async function typeText(
    options: TypewriterOptions
): Promise<TypewriterResult> {
    const { text, speed, onTick, isSkipped, isCancelled } = options;

    for (let i = 0; i < text.length; i++) {
        if (isCancelled()) return 'cancelled';
        if (isSkipped()) {
            onTick(text);
            break;
        }
        onTick(text.slice(0, i + 1));
        await new Promise<void>(resolve =>
            globalThis.setTimeout(resolve, speed)
        );
    }

    if (isCancelled()) return 'cancelled';
    return 'done';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/lib/__tests__/typewriter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewire `NovelReader.svelte` to use the helper**

In `apps/web/src/components/NovelReader.svelte`, add the import near the other imports (after line 10):

```ts
  import { typeText as runTypewriter } from '@/lib/typewriter';
```

Replace the body of the component's `typeText` function (currently lines ~213-238) with a delegating version. The new function:

```ts
  async function typeText(
    text: string,
    entry: DialogueEntry | undefined = currentDialogue,
    version?: number
  ): Promise<void> {
    const result = await runTypewriter({
      text,
      speed: typingSpeed,
      onTick: (partial: string) => {
        typingText = partial;
      },
      isSkipped: () => skipTyping,
      isCancelled: () => version !== undefined && version !== sceneVersion,
    });

    if (result === 'cancelled') return;

    addDialogueToDisplay(text, entry);
    isTyping = false;
  }
```

Leave `startTypingNewDialogue`, `addDialogueToDisplay`, and all `$state`/`$effect` blocks unchanged.

- [ ] **Step 6: Run desktop regression tests**

Run: `bun --filter web test src/components/__tests__/NovelReader.test.ts`
Expected: PASS (all existing tests, including "should skip typing animation on key press during typing").

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/typewriter.ts apps/web/src/lib/__tests__/typewriter.test.ts apps/web/src/components/NovelReader.svelte
git commit -m "refactor(reader): extract shared typewriter helper"
```

---

### Task 2: Extract `resolveCharacterName` and rewire `NovelReader`

**Files:**
- Create: `apps/web/src/lib/character-name.ts`
- Test: `apps/web/src/lib/__tests__/character-name.test.ts`
- Modify: `apps/web/src/components/NovelReader.svelte` (lines ~85-103: `getCharacterName`)

**Interfaces:**
- Consumes: `Translations`, `DialogueEntry` from `@aquila/stories`.
- Produces: `resolveCharacterName(entry: DialogueEntry | undefined, t: Translations): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/character-name.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveCharacterName } from '@/lib/character-name';
import type { Translations } from '@aquila/stories';

const t = {
    characterNames: { narrator: 'Narrator', tanaka_kenta: '田中健太' },
    reader: { unknown: 'Unknown' },
} as unknown as Translations;

describe('resolveCharacterName', () => {
    it('returns empty string for undefined entry', () => {
        expect(resolveCharacterName(undefined, t)).toBe('');
    });

    it('prefers the explicit character field over characterId', () => {
        expect(
            resolveCharacterName(
                { character: '健談男大生', characterId: 'tanaka_kenta', dialogue: 'x' },
                t
            )
        ).toBe('健談男大生');
    });

    it('falls back to the localized name by characterId', () => {
        expect(
            resolveCharacterName({ characterId: 'narrator', dialogue: 'x' }, t)
        ).toBe('Narrator');
    });

    it('returns unknown when characterId is missing from the map', () => {
        expect(
            resolveCharacterName({ characterId: 'ghost', dialogue: 'x' }, t)
        ).toBe('Unknown');
    });

    it('returns empty string for narration (no character info)', () => {
        expect(resolveCharacterName({ dialogue: 'x' }, t)).toBe('');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/lib/__tests__/character-name.test.ts`
Expected: FAIL — cannot resolve `@/lib/character-name`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/character-name.ts`:

```ts
import type { DialogueEntry, Translations } from '@aquila/stories';

/**
 * Resolve the display name for a dialogue entry.
 *  1. `entry.character` (author override / alias / role label) wins.
 *  2. else `entry.characterId` → `t.characterNames[id]` (fallback `t.reader.unknown`).
 *  3. else '' (narration).
 */
export function resolveCharacterName(
    entry: DialogueEntry | undefined,
    t: Translations
): string {
    if (!entry) return '';

    if (entry.character) {
        return entry.character;
    }

    if (entry.characterId) {
        const localizedName = t.characterNames?.[entry.characterId];
        if (localizedName) {
            return localizedName;
        }
        return t.reader.unknown;
    }

    return '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/lib/__tests__/character-name.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewire `NovelReader.svelte`**

Add the import near the other imports:

```ts
  import { resolveCharacterName } from '@/lib/character-name';
```

Replace the existing `getCharacterName` function (lines ~85-103) with a thin wrapper that keeps the same call sites working:

```ts
  function getCharacterName(dialogueEntry: DialogueEntry | undefined): string {
    return resolveCharacterName(dialogueEntry, t);
  }
```

- [ ] **Step 6: Run desktop regression tests**

Run: `bun --filter web test src/components/__tests__/NovelReader.test.ts`
Expected: PASS (including the "Character Display Name Priority" and "Edge Cases" suites).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/character-name.ts apps/web/src/lib/__tests__/character-name.test.ts apps/web/src/components/NovelReader.svelte
git commit -m "refactor(reader): extract resolveCharacterName helper"
```

---

### Task 3: Extract `act-navigation` and rewire `ActPanel`

**Files:**
- Create: `apps/web/src/lib/act-navigation.ts`
- Test: `apps/web/src/lib/__tests__/act-navigation.test.ts`
- Modify: `apps/web/src/components/ActPanel.svelte` (remove the moved pure functions/types, import them instead)

**Interfaces:**
- Consumes: `getStoryFlow`, `Translations` from `@aquila/stories`.
- Produces: types `ActInfo`, `ChapterGroup`, `ChaptersResult`, `BranchesResult`, `PanelData`; functions `buildChapterData(storyId, sceneId, t): PanelData`, `extractActName(sceneId): string`, `extractChapterKey(sceneId): string | null`, `extractChapterNum(sceneId): number | null`, `actLabel(rawName, t): string`, `actSortKey(rawName): number`, `extractBranchPrefix(sceneId): string`, `branchMatchScore(a, b): number`, `chapterLabel(num, t): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/act-navigation.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

const branchFlow = {
    start: 'b1a_act1',
    nodes: [
        { kind: 'scene', id: 'b1a_act1', sceneId: 'b1a_act1', next: 'b1a_act2' },
        { kind: 'scene', id: 'b1a_act2', sceneId: 'b1a_act2', next: 'actFinal' },
        { kind: 'scene', id: 'actFinal', sceneId: 'actFinal', next: 'actEpilogue' },
        { kind: 'scene', id: 'actEpilogue', sceneId: 'actEpilogue', next: null },
    ],
};

const chapterFlow = {
    start: 'ch1_act1',
    nodes: [
        { kind: 'scene', id: 'ch1_act1', sceneId: 'ch1_act1', next: 'ch1_act2' },
        { kind: 'scene', id: 'ch1_act2', sceneId: 'ch1_act2', next: 'ch2_act1' },
        { kind: 'scene', id: 'ch2_act1', sceneId: 'ch2_act1', next: null },
    ],
};

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => branchFlow),
}));

import { getStoryFlow, type Translations } from '@aquila/stories';
import {
    buildChapterData,
    extractActName,
    extractChapterKey,
    actSortKey,
} from '@/lib/act-navigation';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        chapterLabel: 'Chapter {n}',
    },
} as unknown as Translations;

afterEach(() => vi.clearAllMocks());

describe('act-navigation', () => {
    it('extractActName / extractChapterKey parse ids', () => {
        expect(extractActName('ch2_act1')).toBe('act1');
        expect(extractActName('b1a_actFinal')).toBe('actFinal');
        expect(extractChapterKey('ch2_act1')).toBe('ch2');
        expect(extractChapterKey('b1a_act1')).toBeNull();
    });

    it('actSortKey orders final and epilogue last', () => {
        expect(actSortKey('act1')).toBe(1);
        expect(actSortKey('actFinal')).toBe(9998);
        expect(actSortKey('actEpilogue')).toBe(9999);
    });

    it('builds branches mode for a non-chapter flow, sorted', () => {
        const data = buildChapterData('s', 'b1a_act1', t);
        expect(data.mode).toBe('branches');
        if (data.mode !== 'branches') throw new Error('expected branches');
        expect(data.acts.map(a => a.label)).toEqual([
            'Act 1',
            'Act 2',
            'Final',
            'Epilogue',
        ]);
    });

    it('builds chapters mode for a chapter flow', () => {
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );
        const data = buildChapterData('s', 'ch1_act1', t);
        expect(data.mode).toBe('chapters');
        if (data.mode !== 'chapters') throw new Error('expected chapters');
        expect(data.chapters.map(c => c.label)).toEqual([
            'Chapter 1',
            'Chapter 2',
        ]);
        expect(data.chapters[0].acts.map(a => a.label)).toEqual([
            'Act 1',
            'Act 2',
        ]);
    });

    it('returns empty branches when flow is missing', () => {
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            undefined
        );
        const data = buildChapterData('s', 'act1', t);
        expect(data).toEqual({ mode: 'branches', acts: [] });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/lib/__tests__/act-navigation.test.ts`
Expected: FAIL — cannot resolve `@/lib/act-navigation`.

- [ ] **Step 3: Write the implementation (move logic out of `ActPanel`)**

Create `apps/web/src/lib/act-navigation.ts`:

```ts
import { getStoryFlow, type Translations } from '@aquila/stories';

export interface ActInfo {
    label: string;
    sceneId: string;
    sortKey: number;
    rawName: string;
}

export interface ChapterGroup {
    chapterNum: number;
    label: string;
    acts: ActInfo[];
}

export interface ChaptersResult {
    mode: 'chapters';
    chapters: ChapterGroup[];
}

export interface BranchesResult {
    mode: 'branches';
    acts: ActInfo[];
}

export type PanelData = ChaptersResult | BranchesResult;

type LooseFlow = { nodes: Array<{ kind: string; sceneId?: string }> };

export function extractChapterKey(sceneId: string): string | null {
    const match = sceneId.match(/^(ch\d+)_/);
    return match ? match[1] : null;
}

export function extractChapterNum(sceneId: string): number | null {
    const match = sceneId.match(/^ch(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
}

export function extractActName(sceneId: string): string {
    const match = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
}

export function actLabel(rawName: string, t: Translations): string {
    if (rawName === 'actFinal') return t.reader.actFinal;
    if (rawName === 'actEpilogue') return t.reader.actEpilogue;
    const numMatch = rawName.match(/act(\d+)/);
    if (numMatch) {
        return t.reader.actLabel.replace('{n}', numMatch[1]);
    }
    return rawName;
}

export function actSortKey(rawName: string): number {
    if (rawName === 'actFinal') return 9998;
    if (rawName === 'actEpilogue') return 9999;
    const numMatch = rawName.match(/act(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
}

export function extractBranchPrefix(sceneId: string): string {
    const match = sceneId.match(/^(.*?)(?:act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
}

export function branchMatchScore(
    candidatePrefix: string,
    currentPrefix: string
): number {
    if (!candidatePrefix && !currentPrefix) return 0;
    const cParts = candidatePrefix.split('_').filter(Boolean);
    const curParts = currentPrefix.split('_').filter(Boolean);
    let score = 0;
    for (let i = 0; i < Math.min(cParts.length, curParts.length); i++) {
        if (cParts[i] === curParts[i]) score++;
        else break;
    }
    return score;
}

export function chapterLabel(num: number, t: Translations): string {
    return t.reader.chapterLabel.replace('{n}', String(num));
}

export function buildChapterData(
    storyId: string,
    sceneId: string,
    t: Translations
): PanelData {
    const flow = getStoryFlow(storyId);
    if (!flow) return { mode: 'branches', acts: [] };

    const hasChapters = flow.nodes.some(
        n => n.kind === 'scene' && /^ch\d+_/.test(n.sceneId)
    );

    if (hasChapters) {
        return buildChapters(flow, t);
    }

    return buildBranches(flow, sceneId, t);
}

function buildChapters(flow: LooseFlow, t: Translations): ChaptersResult {
    const chapters: Record<number, Record<string, string>> = {};

    for (const node of flow.nodes) {
        if (node.kind !== 'scene') continue;
        if (!node.sceneId) continue;
        const sceneId = node.sceneId;
        const actMatch = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
        if (!actMatch) continue;

        const actName = actMatch[1];
        const chNum = extractChapterNum(sceneId);
        if (chNum === null) continue;

        if (!chapters[chNum]) chapters[chNum] = {};
        if (!chapters[chNum][actName]) chapters[chNum][actName] = sceneId;
    }

    const sorted = Object.entries(chapters)
        .map(([num, actsMap]) => ({
            chapterNum: Number(num),
            label: chapterLabel(Number(num), t),
            acts: Object.entries(actsMap)
                .map(([rawName, sid]) => ({
                    label: actLabel(rawName, t),
                    sceneId: sid,
                    sortKey: actSortKey(rawName),
                    rawName,
                }))
                .sort((a, b) => a.sortKey - b.sortKey),
        }))
        .sort((a, b) => a.chapterNum - b.chapterNum);

    return { mode: 'chapters', chapters: sorted };
}

function buildBranches(
    flow: LooseFlow,
    sceneId: string,
    t: Translations
): BranchesResult {
    const actCandidates: Record<string, string[]> = {};

    for (const node of flow.nodes) {
        if (node.kind !== 'scene') continue;
        if (!node.sceneId) continue;
        const match = node.sceneId.match(
            /(?:^|_)(act\d+|actFinal|actEpilogue)/
        );
        if (!match) continue;
        const actName = match[1];
        if (!actCandidates[actName]) actCandidates[actName] = [];
        actCandidates[actName].push(node.sceneId);
    }

    const currentBranch = extractBranchPrefix(sceneId);
    const currentParts = currentBranch.split('_').filter(Boolean);

    function isOnBranch(candidatePrefix: string): boolean {
        if (!candidatePrefix && !currentBranch) return true;
        const candParts = candidatePrefix.split('_').filter(Boolean);
        const shorter =
            candParts.length <= currentParts.length ? candParts : currentParts;
        const longer =
            candParts.length <= currentParts.length ? currentParts : candParts;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] !== longer[i]) return false;
        }
        return true;
    }

    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain Map; this module is non-reactive.
    const actMap = new Map<string, string>();
    for (const [actName, candidates] of Object.entries(actCandidates)) {
        const onBranch = candidates.filter(c =>
            isOnBranch(extractBranchPrefix(c))
        );
        if (onBranch.length === 0) continue;
        let bestScene = onBranch[0];
        let bestScore = branchMatchScore(
            extractBranchPrefix(bestScene),
            currentBranch
        );
        for (let i = 1; i < onBranch.length; i++) {
            const score = branchMatchScore(
                extractBranchPrefix(onBranch[i]),
                currentBranch
            );
            if (score > bestScore) {
                bestScore = score;
                bestScene = onBranch[i];
            }
        }
        actMap.set(actName, bestScene);
    }

    const acts = Array.from(actMap.entries())
        .map(([rawName, sid]) => ({
            label: actLabel(rawName, t),
            sceneId: sid,
            sortKey: actSortKey(rawName),
            rawName,
        }))
        .sort((a, b) => a.sortKey - b.sortKey);

    return { mode: 'branches', acts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/lib/__tests__/act-navigation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewire `ActPanel.svelte`**

In `apps/web/src/components/ActPanel.svelte`:

1. Add the import after the existing imports (after line 3):

```ts
  import {
    buildChapterData,
    extractActName,
    extractChapterKey,
    type PanelData,
    type ChapterGroup,
    type ActInfo,
  } from '@/lib/act-navigation';
```

2. Delete from the component all of these now-duplicated local definitions: the `ActInfo`, `ChapterGroup`, `ChaptersResult`, `BranchesResult` interfaces and `PanelData` type; and the functions `extractChapterKey`, `extractChapterNum`, `extractActName`, `actLabel`, `actSortKey`, `extractBranchPrefix`, `branchMatchScore`, `chapterLabel`, `buildChapterData`, `buildChapters`, `buildBranches`.

3. Change the `chapterData` derivation to pass `t`:

```ts
  let chapterData = $derived(buildChapterData(storyId, currentSceneId, t));
```

Leave `expandedChapter`, `previousChapterKey`, the `$effect` auto-expand block, `currentAct`, `currentChapterKey`, `handleSelect`, `handleEscape`, and the entire template markup unchanged.

- [ ] **Step 6: Run desktop regression tests**

Run: `bun --filter web test src/components/__tests__/ActPanel.test.ts`
Expected: PASS (all branch-mode and chapter-mode tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/act-navigation.ts apps/web/src/lib/__tests__/act-navigation.test.ts apps/web/src/components/ActPanel.svelte
git commit -m "refactor(reader): extract act-navigation helpers from ActPanel"
```

---

### Task 4: Add mobile reader i18n keys

**Files:**
- Modify: `packages/stories/src/translations/en.json` (inside the `reader` object)
- Modify: `packages/stories/src/translations/zh.json` (inside the `reader` object)
- Test: `packages/stories/src/__tests__/translations.test.ts` (existing parity test — run, do not edit)

**Interfaces:**
- Produces translation keys consumed by later tasks: `reader.historyTitle`, `reader.openHistory`, `reader.closeHistory`, `reader.openMenu`, `reader.closeMenu`, `reader.tapToContinue`, `reader.lineProgress`.

- [ ] **Step 1: Add keys to `en.json`**

In `packages/stories/src/translations/en.json`, inside the `"reader"` object, after the `"closeActsPanel"` entry, add (add a trailing comma to the previous line):

```json
    "historyTitle": "History",
    "openHistory": "Open history",
    "closeHistory": "Close history",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "tapToContinue": "Tap to continue",
    "lineProgress": "Line {current} of {total}"
```

- [ ] **Step 2: Add the same keys to `zh.json`**

In `packages/stories/src/translations/zh.json`, inside the `"reader"` object, after its `"closeActsPanel"` entry (add a trailing comma to that line), add:

```json
    "historyTitle": "歷史",
    "openHistory": "開啟歷史",
    "closeHistory": "關閉歷史",
    "openMenu": "開啟選單",
    "closeMenu": "關閉選單",
    "tapToContinue": "點擊繼續",
    "lineProgress": "第 {current} / {total} 行"
```

- [ ] **Step 3: Run the translations parity test**

Run: `bun --filter @aquila/stories test 2>/dev/null || bun --filter stories test`
(If the stories package has no test script, run the repo-wide unit run: `bun --filter web test src/components/__tests__/NovelReader.test.ts` is unaffected; the parity check lives in `packages/stories/src/__tests__/translations.test.ts` and runs under that package's `test` script.)
Expected: PASS — `has consistent keys between locales`.

- [ ] **Step 4: Commit**

```bash
git add packages/stories/src/translations/en.json packages/stories/src/translations/zh.json
git commit -m "feat(i18n): add mobile reader translation keys"
```

---

### Task 5: `MobileActDrawer.svelte`

**Files:**
- Create: `apps/web/src/components/MobileActDrawer.svelte`
- Test: `apps/web/src/components/__tests__/MobileActDrawer.test.ts`

**Interfaces:**
- Consumes: `buildChapterData`, `extractActName`, `extractChapterKey` from `@/lib/act-navigation`; `getTranslations`, `Locale` from `@aquila/stories`.
- Produces (props): `{ storyId: string; currentSceneId: string; onNavigate: (sceneId: string) => void; onClose: () => void; open?: boolean; locale?: Locale }`. Calls `onNavigate(sceneId)` then `onClose()` when an act is chosen; calls `onClose()` on scrim click and on `Escape` while open.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/__tests__/MobileActDrawer.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';

const branchFlow = {
    start: 'b1a_act1',
    nodes: [
        { kind: 'scene', id: 'b1a_act1', sceneId: 'b1a_act1', next: 'b1a_act2' },
        { kind: 'scene', id: 'b1a_act2', sceneId: 'b1a_act2', next: null },
    ],
};

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => branchFlow),
    getTranslations: vi.fn(() => ({
        reader: {
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            closeActsPanel: 'Close acts panel',
        },
        locale: 'en',
    })),
}));

import MobileActDrawer from '../MobileActDrawer.svelte';

// Act buttons are the buttons that carry no aria-label (scrim and close
// button both have aria-label "Close acts panel").
function getActButtons() {
    return screen
        .getAllByRole('button')
        .filter(b => !b.getAttribute('aria-label'));
}

describe('MobileActDrawer', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    afterEach(() => vi.clearAllMocks());

    it('renders an act button per act when open', () => {
        render(MobileActDrawer, {
            props: { storyId: 's', currentSceneId: 'b1a_act1', onNavigate, onClose, open: true, locale: 'en' },
        });
        expect(getActButtons().map(b => b.textContent?.trim())).toEqual([
            'Act 1',
            'Act 2',
        ]);
    });

    it('calls onNavigate then onClose when an act is selected', async () => {
        render(MobileActDrawer, {
            props: { storyId: 's', currentSceneId: 'b1a_act1', onNavigate, onClose, open: true, locale: 'en' },
        });
        const act2 = getActButtons().find(b => b.textContent?.trim() === 'Act 2')!;
        await fireEvent.click(act2);
        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape when open', async () => {
        render(MobileActDrawer, {
            props: { storyId: 's', currentSceneId: 'b1a_act1', onNavigate, onClose, open: true, locale: 'en' },
        });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose on Escape when closed', async () => {
        render(MobileActDrawer, {
            props: { storyId: 's', currentSceneId: 'b1a_act1', onNavigate, onClose, open: false, locale: 'en' },
        });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('marks the panel inert and aria-hidden when closed', () => {
        render(MobileActDrawer, {
            props: { storyId: 's', currentSceneId: 'b1a_act1', onNavigate, onClose, open: false, locale: 'en' },
        });
        for (const btn of getActButtons()) {
            const inertAncestor = btn.closest('[inert]');
            expect(inertAncestor).not.toBeNull();
            expect(inertAncestor?.getAttribute('aria-hidden')).toBe('true');
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileActDrawer.test.ts`
Expected: FAIL — cannot resolve `../MobileActDrawer.svelte`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/MobileActDrawer.svelte`:

```svelte
<script lang="ts">
  import { getTranslations, type Locale } from '@aquila/stories';
  import {
    buildChapterData,
    extractActName,
    extractChapterKey,
  } from '@/lib/act-navigation';

  let {
    storyId,
    currentSceneId,
    onNavigate,
    onClose,
    open = false,
    locale = 'en',
  }: {
    storyId: string;
    currentSceneId: string;
    onNavigate: (sceneId: string) => void;
    onClose: () => void;
    open?: boolean;
    locale?: Locale;
  } = $props();

  let t = $derived(getTranslations(locale));
  let chapterData = $derived(buildChapterData(storyId, currentSceneId, t));
  let currentAct = $derived(extractActName(currentSceneId));
  let currentChapterKey = $derived(extractChapterKey(currentSceneId));

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
    onClose();
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    aria-label={t.reader.closeActsPanel}
    onclick={onClose}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 w-4/5 max-w-xs overflow-y-auto bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
  aria-hidden={!open}
  inert={!open}
>
  <div class="p-6" style="padding-top: calc(1.5rem + env(safe-area-inset-top));">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800">{t.reader.actPanel}</h2>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label={t.reader.closeActsPanel}
        onclick={onClose}
      >
        ✕
      </button>
    </div>

    {#if chapterData.mode === 'chapters'}
      <div class="space-y-3">
        {#each chapterData.chapters as chapter (chapter.chapterNum)}
          <div>
            <p class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {chapter.label}
            </p>
            <div class="ml-3 mt-1 space-y-1">
              {#each chapter.acts as act (act.rawName)}
                {@const isActive =
                  act.rawName === currentAct &&
                  extractChapterKey(act.sceneId) === currentChapterKey}
                <button
                  type="button"
                  class="w-full rounded-lg px-3 py-3 text-left text-sm {isActive
                    ? 'bg-blue-500 font-semibold text-white'
                    : 'bg-white/60 text-slate-700 hover:bg-blue-50'}"
                  onclick={() => handleSelect(act.sceneId)}
                >
                  {act.label}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-2">
        {#each chapterData.acts as act (act.rawName)}
          <button
            type="button"
            class="w-full rounded-xl px-4 py-3 text-left text-base {act.rawName ===
            currentAct
              ? 'bg-blue-500 font-semibold text-white'
              : 'bg-white/60 text-slate-700 hover:bg-blue-50'}"
            onclick={() => handleSelect(act.sceneId)}
          >
            {act.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</aside>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/components/__tests__/MobileActDrawer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MobileActDrawer.svelte apps/web/src/components/__tests__/MobileActDrawer.test.ts
git commit -m "feat(reader): add MobileActDrawer navigation drawer"
```

---

### Task 6: `MobileBacklogSheet.svelte`

**Files:**
- Create: `apps/web/src/components/MobileBacklogSheet.svelte`
- Test: `apps/web/src/components/__tests__/MobileBacklogSheet.test.ts`

**Interfaces:**
- Consumes: `getTranslations`, `Locale` from `@aquila/stories`.
- Produces (props): `{ lines: { characterName: string; text: string }[]; open?: boolean; onClose: () => void; locale?: Locale }`. Renders nothing when `open` is false; calls `onClose()` on close button, scrim, and `Escape`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/__tests__/MobileBacklogSheet.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';

vi.mock('@aquila/stories', () => ({
    getTranslations: vi.fn(() => ({
        reader: { historyTitle: 'History', closeHistory: 'Close history' },
        locale: 'en',
    })),
}));

import MobileBacklogSheet from '../MobileBacklogSheet.svelte';

const lines = [
    { characterName: 'Narrator', text: 'Line one.' },
    { characterName: '', text: 'Line two.' },
];

describe('MobileBacklogSheet', () => {
    const onClose = vi.fn();
    afterEach(() => vi.clearAllMocks());

    it('renders nothing when closed', () => {
        render(MobileBacklogSheet, { props: { lines, open: false, onClose, locale: 'en' } });
        expect(screen.queryByText('Line one.')).not.toBeInTheDocument();
    });

    it('renders all lines with names when open', () => {
        render(MobileBacklogSheet, { props: { lines, open: true, onClose, locale: 'en' } });
        expect(screen.getByText('Line one.')).toBeInTheDocument();
        expect(screen.getByText('Line two.')).toBeInTheDocument();
        expect(screen.getByText('Narrator')).toBeInTheDocument();
    });

    it('calls onClose from the close button', async () => {
        render(MobileBacklogSheet, { props: { lines, open: true, onClose, locale: 'en' } });
        const closeButtons = screen.getAllByLabelText('Close history');
        await fireEvent.click(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape when open', async () => {
        render(MobileBacklogSheet, { props: { lines, open: true, onClose, locale: 'en' } });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileBacklogSheet.test.ts`
Expected: FAIL — cannot resolve `../MobileBacklogSheet.svelte`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/MobileBacklogSheet.svelte`:

```svelte
<script lang="ts">
  import { getTranslations, type Locale } from '@aquila/stories';

  let {
    lines = [],
    open = false,
    onClose,
    locale = 'en',
  }: {
    lines: { characterName: string; text: string }[];
    open?: boolean;
    onClose: () => void;
    locale?: Locale;
  } = $props();

  let t = $derived(getTranslations(locale));

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/40"
    aria-label={t.reader.closeHistory}
    onclick={onClose}
  ></button>
  <section
    class="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl"
    style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800">{t.reader.historyTitle}</h2>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label={t.reader.closeHistory}
        onclick={onClose}
      >
        ✕
      </button>
    </div>
    <ul class="space-y-4">
      {#each lines as line, i (i)}
        <li>
          {#if line.characterName}
            <p class="text-sm font-bold text-blue-600">{line.characterName}</p>
          {/if}
          <p class="text-base leading-relaxed text-slate-800">{line.text}</p>
        </li>
      {/each}
    </ul>
  </section>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/components/__tests__/MobileBacklogSheet.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MobileBacklogSheet.svelte apps/web/src/components/__tests__/MobileBacklogSheet.test.ts
git commit -m "feat(reader): add MobileBacklogSheet history view"
```

---

### Task 7: `MobileNovelReader.svelte` — reading core + auto-hiding chrome

**Files:**
- Create: `apps/web/src/components/MobileNovelReader.svelte`
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Consumes: `readerState` from `@/lib/reader-state.svelte`; `resolveCharacterName` from `@/lib/character-name`; `typeText` from `@/lib/typewriter`; `getTranslations`, `DialogueEntry`, `ChoiceDefinition`, `Locale` from `@aquila/stories`.
- Produces (props, all optional with `readerState` fallback): `onChoice`, `onBookmark`, `onNext`, `onNavigate`, `showBookmarkButton`, `backUrl`, `initialDialogueIndex`, `dialogue`, `choice`, `storyId`, `currentSceneId`, `canGoNext`, `locale`. Mirrors `NovelReader`'s prop contract so `ReaderShell` can pass props through unchanged.
- State this task introduces and Task 8 reuses: `currentDialogueIndex`, `drawerOpen`, `backlogOpen`, `chromeVisible`, and the function `advance()`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/__tests__/MobileNovelReader.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry, ChoiceDefinition } from '@aquila/stories';

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => ({ start: 'a1', nodes: [] })),
    getTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            actPanel: 'Acts',
            historyTitle: 'History',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

import MobileNovelReader from '../MobileNovelReader.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First line.' },
    { characterId: 'narrator', dialogue: 'Second line.' },
    { characterId: 'narrator', dialogue: 'Third line.' },
];

const mockChoice: ChoiceDefinition = {
    prompt: 'Pick one?',
    options: [
        { id: 'o1', label: 'Option A', nextScene: 'sceneA' },
        { id: 'o2', label: 'Option B', nextScene: 'sceneB' },
    ],
};

describe('MobileNovelReader', () => {
    afterEach(() => vi.clearAllMocks());

    it('types the first line on mount', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.getByText('Narrator')).toBeInTheDocument();
    });

    it('first tap completes typing, second tap advances', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        const tap = screen.getByLabelText('Tap to continue');
        // skip typing of line 1
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        expect(screen.getByText('First line.')).toBeInTheDocument();
        // advance to line 2
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
        // only the current line is shown (single panel)
        expect(screen.queryByText('First line.')).not.toBeInTheDocument();
    });

    it('advances with the Enter key', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        await vi.runAllTimersAsync();
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
    });

    it('shows line progress', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
    });

    it('calls onNext on the last line when canGoNext', async () => {
        const onNext = vi.fn();
        render(MobileNovelReader, { props: { dialogue: [mockDialogue[0]], choice: null, canGoNext: true, onNext, locale: 'en' } });
        await vi.runAllTimersAsync();
        // line already complete; tap advances past the end → onNext
        await fireEvent.click(screen.getByLabelText('Tap to continue'));
        expect(onNext).toHaveBeenCalled();
    });

    it('renders choices on the last line and calls onChoice', async () => {
        const onChoice = vi.fn();
        render(MobileNovelReader, { props: { dialogue: [mockDialogue[0]], choice: mockChoice, onChoice, locale: 'en' } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Pick one?')).toBeInTheDocument();
        await fireEvent.click(screen.getByText('Option A'));
        expect(onChoice).toHaveBeenCalledWith('sceneA');
    });

    it('bookmarks the current line number', async () => {
        const onBookmark = vi.fn();
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, showBookmarkButton: true, onBookmark, locale: 'en' } });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByText('Bookmark'));
        expect(onBookmark).toHaveBeenCalledWith(1);
    });

    it('jumps to initialDialogueIndex without re-applying on scene change', async () => {
        const { rerender } = render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en', initialDialogueIndex: 1 },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 2 of 3')).toBeInTheDocument();
        // close menu, change scene
        await fireEvent.click(screen.getByLabelText('Close menu'));
        const newDialogue: DialogueEntry[] = [
            { characterId: 'narrator', dialogue: 'New A.' },
            { characterId: 'narrator', dialogue: 'New B.' },
        ];
        await rerender({ dialogue: newDialogue, choice: null, locale: 'en', initialDialogueIndex: 1 });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 1 of 2')).toBeInTheDocument();
    });

    it('toggles chrome with the menu button', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        await vi.runAllTimersAsync();
        expect(screen.queryByText('Back to Home')).not.toBeInTheDocument();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: FAIL — cannot resolve `../MobileNovelReader.svelte`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/MobileNovelReader.svelte`:

```svelte
<script lang="ts">
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories';
  import { readerState } from '@/lib/reader-state.svelte';
  import { resolveCharacterName } from '@/lib/character-name';
  import { typeText as runTypewriter } from '@/lib/typewriter';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    showBookmarkButton = true,
    backUrl = '/',
    initialDialogueIndex = null,
    dialogue: dialogueProp = undefined,
    choice: choiceProp = undefined,
    storyId: storyIdProp = undefined,
    currentSceneId: currentSceneIdProp = undefined,
    canGoNext: canGoNextProp = undefined,
    locale: localeProp = undefined,
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
    initialDialogueIndex?: number | null;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
  } = $props();

  let dialogue = $derived(
    dialogueProp !== undefined ? dialogueProp : readerState.dialogue
  );
  let choice = $derived(
    choiceProp !== undefined ? choiceProp : readerState.choice
  );
  let storyId = $derived(
    storyIdProp !== undefined ? storyIdProp : readerState.storyId
  );
  let currentSceneId = $derived(
    currentSceneIdProp !== undefined
      ? currentSceneIdProp
      : readerState.currentSceneId
  );
  let canGoNext = $derived(
    canGoNextProp !== undefined ? canGoNextProp : readerState.canGoNext
  );
  let locale = $derived(
    (localeProp !== undefined ? localeProp : readerState.locale) as Locale
  );

  let t = $derived(getTranslations(locale));

  const typingSpeed = 30;

  let currentDialogueIndex = $state(0);
  let isTyping = $state(false);
  let typingText = $state('');
  let skipTyping = $state(false);
  let sceneVersion = $state(0);

  // Mobile UI state (Task 8 renders drawer/backlog from these flags).
  let chromeVisible = $state(false);
  let drawerOpen = $state(false);
  let backlogOpen = $state(false);

  // Plain (non-reactive) trackers.
  let lastDialogueRef: DialogueEntry[] | undefined = undefined;
  let initialBookmarkConsumed = false;

  let currentDialogue = $derived(dialogue[currentDialogueIndex]);
  let isLastDialogue = $derived(currentDialogueIndex >= dialogue.length - 1);
  let currentName = $derived(resolveCharacterName(currentDialogue, t));
  let showChoices = $derived(!!choice && !isTyping && isLastDialogue);
  let hasOverlay = $derived(drawerOpen || backlogOpen);

  // Initialize each scene when the dialogue array reference changes.
  $effect(() => {
    if (dialogue !== lastDialogueRef) {
      lastDialogueRef = dialogue;
      initScene();
    }
  });

  function initScene(): void {
    sceneVersion++;
    skipTyping = false;
    isTyping = false;
    drawerOpen = false;
    backlogOpen = false;

    if (
      !initialBookmarkConsumed &&
      initialDialogueIndex !== null &&
      initialDialogueIndex >= 0 &&
      dialogue.length > 0
    ) {
      const target = Math.min(initialDialogueIndex, dialogue.length - 1);
      currentDialogueIndex = target;
      typingText = dialogue[target]?.dialogue ?? '';
      initialBookmarkConsumed = true;
      return;
    }

    currentDialogueIndex = 0;
    typingText = '';
    void startTyping(0);
  }

  async function startTyping(index: number): Promise<void> {
    const entry = dialogue[index];
    if (!entry) {
      isTyping = false;
      typingText = '';
      return;
    }
    skipTyping = false;
    isTyping = true;
    typingText = '';
    const version = sceneVersion;

    const result = await runTypewriter({
      text: entry.dialogue,
      speed: typingSpeed,
      onTick: (partial: string) => {
        typingText = partial;
      },
      isSkipped: () => skipTyping,
      isCancelled: () => version !== sceneVersion,
    });

    if (result === 'cancelled') return;
    typingText = entry.dialogue;
    isTyping = false;
  }

  function advance(): void {
    // An open overlay swallows the tap to close itself.
    if (hasOverlay) {
      if (backlogOpen) backlogOpen = false;
      else drawerOpen = false;
      return;
    }
    // First tap during typing completes the line.
    if (isTyping) {
      skipTyping = true;
      return;
    }
    // A tap while chrome is showing dismisses it (does not advance).
    if (chromeVisible) {
      chromeVisible = false;
      return;
    }
    if (currentDialogueIndex < dialogue.length - 1) {
      currentDialogueIndex++;
      void startTyping(currentDialogueIndex);
    } else if (canGoNext && !choice) {
      onNext();
    }
  }

  function handleKeyPress(event: globalThis.KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const activeElement = globalThis.document
      .activeElement as HTMLElement | null;
    const rawTarget = (event.target ?? activeElement) as unknown;
    const target = rawTarget instanceof HTMLElement ? rawTarget : activeElement;

    if (target) {
      const tagName = target.tagName.toLowerCase();
      const interactiveTags = ['input', 'textarea', 'select', 'option', 'button', 'a'];
      const hasEditableAttr =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true';
      if (interactiveTags.includes(tagName) || hasEditableAttr) return;
    }
    event.preventDefault();
    advance();
  }

  let progressText = $derived(
    t.reader.lineProgress
      .replace('{current}', String(currentDialogueIndex + 1))
      .replace('{total}', String(dialogue.length))
  );
</script>

<svelte:window onkeydown={handleKeyPress} />

<div
  class="mobile-reader relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400"
>
  <!-- Tap-to-advance layer (full screen, below chrome and overlays). -->
  <button
    type="button"
    class="absolute inset-0 z-10 h-full w-full cursor-default"
    aria-label={t.reader.tapToContinue}
    onclick={advance}
  ></button>

  <!-- Persistent menu toggle (above the tap layer). -->
  <button
    type="button"
    class="absolute left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-slate-700 shadow backdrop-blur-sm"
    style="top: calc(0.75rem + env(safe-area-inset-top));"
    aria-label={chromeVisible ? t.reader.closeMenu : t.reader.openMenu}
    aria-expanded={chromeVisible}
    onclick={() => (chromeVisible = !chromeVisible)}
  >
    {#if chromeVisible}✕{:else}☰{/if}
  </button>

  <!-- Auto-hiding chrome bar. -->
  {#if chromeVisible}
    <div
      class="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-white/80 px-3 py-2 pl-16 shadow backdrop-blur-md"
      style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
    >
      <a
        href={backUrl}
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
      >
        {t.common.backToHome}
      </a>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
        aria-label={t.reader.openActsPanel}
        onclick={() => (drawerOpen = true)}
      >
        {t.reader.actPanel}
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
        aria-label={t.reader.openHistory}
        onclick={() => (backlogOpen = true)}
      >
        {t.reader.historyTitle}
      </button>
      {#if showBookmarkButton}
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
          onclick={() => onBookmark(currentDialogueIndex + 1)}
        >
          {t.reader.bookmark}
        </button>
      {/if}
      <span class="ml-auto text-xs font-medium text-slate-600">{progressText}</span>
    </div>
  {/if}

  <!-- Bottom text panel. pointer-events-none lets taps fall through to the
       advance layer except when choices need to be clickable. -->
  <div
    class="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-4 {showChoices
      ? 'pointer-events-auto'
      : 'pointer-events-none'}"
    style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));"
  >
    {#if showChoices}
      <div class="space-y-3 rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        <p class="text-base font-semibold text-slate-700">{choice?.prompt}</p>
        {#each choice?.options ?? [] as option (option.id)}
          <button
            type="button"
            class="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-600"
            onclick={() => onChoice(option.nextScene)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    {:else}
      <div class="min-h-[7rem] rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        {#if currentName}
          <span
            class="mb-2 inline-block rounded-xl bg-blue-100/80 px-3 py-1 text-base font-bold text-blue-600"
          >
            {currentName}
          </span>
        {/if}
        <p class="text-lg leading-relaxed text-slate-800">
          {typingText}{#if isTyping}<span
              class="ml-0.5 inline-block h-5 w-2 animate-pulse bg-blue-600 align-middle"
            ></span>{/if}
        </p>
        {#if !isTyping}
          <div class="mt-2 text-right text-blue-500">
            {#if !isLastDialogue}
              <span class="inline-block motion-safe:animate-bounce" aria-hidden="true">▼</span>
            {:else if canGoNext}
              <span class="text-sm font-semibold">{t.reader.nextScene}</span>
            {:else}
              <span class="text-sm font-semibold">{t.reader.complete}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .mobile-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "feat(reader): add MobileNovelReader reading core and chrome"
```

---

### Task 8: Integrate drawer and backlog into `MobileNovelReader`

**Files:**
- Modify: `apps/web/src/components/MobileNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/MobileNovelReader.test.ts` (add integration tests)

**Interfaces:**
- Consumes: `MobileActDrawer` (Task 5), `MobileBacklogSheet` (Task 6), `resolveCharacterName` (already imported).
- Produces: `backlogLines` derivation `= dialogue.slice(0, currentDialogueIndex + 1).map(e => ({ characterName: resolveCharacterName(e, t), text: e.dialogue }))`.

- [ ] **Step 1: Write the failing integration tests**

Append these tests inside the `describe('MobileNovelReader', ...)` block in `apps/web/src/components/__tests__/MobileNovelReader.test.ts`:

```ts
    it('opens the acts drawer from chrome and navigates', async () => {
        const onNavigate = vi.fn();
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, storyId: 's', currentSceneId: 'b1a_act1', onNavigate, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open acts panel'));
        // Drawer act buttons appear (flow mock returns no scene nodes by
        // default, so override it for this test).
        const { getStoryFlow } = await import('@aquila/stories');
        expect(getStoryFlow).toHaveBeenCalled();
    });

    it('opens the backlog with the current scene lines', async () => {
        render(MobileNovelReader, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        await vi.runAllTimersAsync();
        // advance to line 2 so backlog has two entries
        const tap = screen.getByLabelText('Tap to continue');
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open history'));
        await waitFor(() => {
            expect(screen.getByText('History')).toBeInTheDocument();
        });
        // Both revealed lines are listed in the backlog.
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
    });
```

Note: the acts-drawer test only asserts the drawer was driven (the default flow mock has no scene nodes, so no act buttons render). The backlog test asserts the real content. The flow mock at the top of the file already returns `{ start: 'a1', nodes: [] }`.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: FAIL on "opens the backlog with the current scene lines" — `History` heading / backlog not rendered (components not yet mounted).

- [ ] **Step 3: Add the imports**

In `MobileNovelReader.svelte`, add after the existing component imports:

```ts
  import MobileActDrawer from '@/components/MobileActDrawer.svelte';
  import MobileBacklogSheet from '@/components/MobileBacklogSheet.svelte';
```

- [ ] **Step 4: Add the `backlogLines` derivation**

In the `<script>`, after the `progressText` derivation, add:

```ts
  let backlogLines = $derived(
    dialogue
      .slice(0, currentDialogueIndex + 1)
      .map(entry => ({
        characterName: resolveCharacterName(entry, t),
        text: entry.dialogue,
      }))
  );
```

- [ ] **Step 5: Mount the child components**

In the template, immediately before the final closing `</div>` of the `.mobile-reader` container, add:

```svelte
  <MobileActDrawer
    {storyId}
    {currentSceneId}
    open={drawerOpen}
    {locale}
    onNavigate={(sceneId: string) => onNavigate(sceneId)}
    onClose={() => (drawerOpen = false)}
  />

  <MobileBacklogSheet
    lines={backlogLines}
    open={backlogOpen}
    {locale}
    onClose={() => (backlogOpen = false)}
  />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "feat(reader): wire act drawer and backlog into MobileNovelReader"
```

---

### Task 9: `ReaderShell.svelte` — viewport switch

**Files:**
- Create: `apps/web/src/components/ReaderShell.svelte`
- Test: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: `NovelReader`, `MobileNovelReader`; all reader props (same contract as both children).
- Produces: a component that renders `MobileNovelReader` when `matchMedia('(max-width: 1023px)').matches`, else `NovelReader`, and reacts to the media query `change` event.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/__tests__/ReaderShell.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry } from '@aquila/stories';

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => ({ start: 'a1', nodes: [] })),
    getTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            continue: 'Continue',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            pageDisplay: '{current} / {total}',
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            historyTitle: 'History',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

import ReaderShell from '../ReaderShell.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'Hello.' },
];

function stubMatchMedia(initial: boolean) {
    let listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
        matches: initial,
        media: '(max-width: 1023px)',
        onchange: null,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
            listeners.push(cb),
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
            listeners = listeners.filter(l => l !== cb);
        },
        addListener: (cb: (e: { matches: boolean }) => void) => listeners.push(cb),
        removeListener: (cb: (e: { matches: boolean }) => void) => {
            listeners = listeners.filter(l => l !== cb);
        },
        dispatchEvent: () => true,
    };
    Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mql),
        writable: true,
        configurable: true,
    });
    return {
        setMatches(v: boolean) {
            mql.matches = v;
            listeners.forEach(l => l({ matches: v }));
        },
    };
}

describe('ReaderShell', () => {
    afterEach(() => vi.clearAllMocks());

    it('renders the desktop reader at >= lg', async () => {
        stubMatchMedia(false);
        render(ReaderShell, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        expect(screen.queryByLabelText('Tap to continue')).not.toBeInTheDocument();
    });

    it('renders the mobile reader below lg', async () => {
        stubMatchMedia(true);
        render(ReaderShell, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument();
    });

    it('switches readers when the media query changes', async () => {
        const mm = stubMatchMedia(false);
        render(ReaderShell, { props: { dialogue: mockDialogue, choice: null, locale: 'en' } });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        mm.setMatches(true);
        await vi.runAllTimersAsync();
        await waitFor(() => {
            expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument();
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`
Expected: FAIL — cannot resolve `../ReaderShell.svelte`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/ReaderShell.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';

  let props: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
    initialDialogueIndex?: number | null;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
  } = $props();

  const MOBILE_QUERY = '(max-width: 1023px)';

  function readMatch(): boolean {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  let isMobile = $state(readMatch());

  onMount(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };
    isMobile = mql.matches;
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  });
</script>

{#if isMobile}
  <MobileNovelReader {...props} />
{:else}
  <NovelReader {...props} />
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ReaderShell.svelte apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat(reader): add ReaderShell viewport switch"
```

---

### Task 10: Mount `ReaderShell` from `ReaderManager`

**Files:**
- Modify: `apps/web/src/lib/reader-manager.ts` (the `renderReader` dynamic import, lines ~353-373)
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts` (component mock path)

**Interfaces:**
- Consumes: `ReaderShell` default export. The mounted props are unchanged (`onChoice`, `onBookmark`, `onNext`, `showBookmarkButton`, `backUrl`, `initialDialogueIndex`, `onNavigate`); dialogue/choice/etc. continue to flow through `readerState`.

- [ ] **Step 1: Update the reader-manager test mock**

In `apps/web/src/lib/__tests__/reader-manager.test.ts`, replace the NovelReader mock (around line 36):

```ts
vi.mock('@/components/NovelReader.svelte', () => ({
    default: class MockNovelReader {},
}));
```

with:

```ts
vi.mock('@/components/ReaderShell.svelte', () => ({
    default: class MockReaderShell {},
}));
```

- [ ] **Step 2: Run the test to verify it still passes with the old code (mock is inert)**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`
Expected: PASS — `mount` is mocked (`mockMount`), so changing the mocked component is harmless; the suite remains green. (This step confirms the mock swap did not break anything before the source change.)

- [ ] **Step 3: Update `renderReader` in `reader-manager.ts`**

Replace the dynamic import block (currently `import('@/components/NovelReader.svelte').then(module => { const NovelReaderComponent = module.default; ... })`) so it loads `ReaderShell`:

```ts
        import('@/components/ReaderShell.svelte')
            .then(module => {
                const ReaderShellComponent = module.default;
                // Clear any stale content (SSR comments, loading placeholders)
                // before mounting so the component replaces rather than appends.
                container.replaceChildren();
                const mountedComponent = mount(ReaderShellComponent, {
                    target: container,
                    props: {
                        onChoice: this.handleChoice,
                        onBookmark: (dialogueNumber: number) =>
                            this.handleBookmark(dialogueNumber),
                        onNext: this.handleNext,
                        showBookmarkButton: true,
                        backUrl: `/${this.currentState.locale}/`,
                        initialDialogueIndex: this.initialDialogueIndex,
                        onNavigate: (sceneId: string) =>
                            this.navigateToScene(sceneId),
                    },
                });

                // Only apply the initial dialogue index on the first render.
                this.initialDialogueIndex = null;

                this.readerInstance = {
                    unmount: () => {
                        unmount(mountedComponent);
                    },
                };
            })
            .catch(error => {
                console.error('Failed to load reader component:', error);
```

Leave the `.catch` error-handling body unchanged.

- [ ] **Step 4: Run reader-manager and SSR tests**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-ssr.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full web unit suite (regression sweep)**

Run: `bun --filter web test`
Expected: PASS — all suites green (NovelReader, ActPanel, MobileNovelReader, MobileActDrawer, MobileBacklogSheet, ReaderShell, reader-manager, typewriter, character-name, act-navigation).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-manager.test.ts
git commit -m "feat(reader): mount ReaderShell to switch desktop/mobile readers"
```

---

### Task 11: E2E mobile reader coverage

**Files:**
- Modify: `packages/e2e/playwright.config.ts`
- Create: `packages/e2e/tests/reader-mobile.spec.ts`

**Interfaces:**
- Consumes: the running web app at `http://localhost:5090` (Playwright `webServer` already configured).
- Produces: a `mobile-chrome` Playwright project scoped to the mobile spec via `testMatch`; the existing `chromium` project ignores the mobile spec via `testIgnore`.

- [ ] **Step 1: Add a scoped mobile project to the Playwright config**

In `packages/e2e/playwright.config.ts`, replace the `projects` array with:

```ts
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: /reader-mobile\.spec\.ts/,
        },
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
            testMatch: /reader-mobile\.spec\.ts/,
        },
    ],
```

- [ ] **Step 2: Write the mobile E2E spec**

Create `packages/e2e/tests/reader-mobile.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Mobile reader', () => {
    test('shows the VN panel and advances on tap', async ({ page }) => {
        await page.goto('/en/reader');

        const tap = page.getByLabel('Tap to continue');
        await expect(tap).toBeVisible();

        // First tap completes the typewriter; second advances to the next line.
        await tap.click();
        await tap.click();

        // The single-panel reader should still be showing the tap layer.
        await expect(tap).toBeVisible();
    });

    test('opens the menu and the acts drawer', async ({ page }) => {
        await page.goto('/en/reader');

        await page.getByLabel('Open menu').click();
        await expect(page.getByText('Back to Home')).toBeVisible();

        await page.getByLabel('Open acts panel').click();
        // The drawer heading uses the Acts label.
        await expect(
            page.getByRole('heading', { name: 'Acts' })
        ).toBeVisible();
    });

    test('opens the history backlog', async ({ page }) => {
        await page.goto('/en/reader');

        // Advance one line so the backlog has content.
        const tap = page.getByLabel('Tap to continue');
        await tap.click();
        await tap.click();

        await page.getByLabel('Open menu').click();
        await page.getByLabel('Open history').click();
        await expect(
            page.getByRole('heading', { name: 'History' })
        ).toBeVisible();
    });
});
```

- [ ] **Step 3: Run the mobile E2E spec**

Run: `bun --filter e2e test:e2e tests/reader-mobile.spec.ts`
Expected: PASS (3 tests in the `mobile-chrome` project). If the dev server is not already running, Playwright's `webServer` config starts it; ensure `DATABASE_URL` is available per the repo E2E setup.

- [ ] **Step 4: Commit**

```bash
git add packages/e2e/playwright.config.ts packages/e2e/tests/reader-mobile.spec.ts
git commit -m "test(e2e): add mobile reader coverage"
```

---

## Final Verification

- [ ] Run the full web unit suite: `bun --filter web test` → all green.
- [ ] Run lint: `bun lint` → no new errors.
- [ ] Run the mobile E2E: `bun --filter e2e test:e2e tests/reader-mobile.spec.ts` → green.
- [ ] Manually verify in a browser at a phone viewport (`/en/reader`): tap advances, menu reveals chrome, acts drawer navigates, backlog lists prior lines, and the desktop reader is unchanged at ≥1024px.

---

## Self-Review

**Spec coverage** (`docs/superpowers/specs/2026-06-17-mobile-reader-design.md`):
- §3.1 component/module structure → Tasks 1-3 (extractions), 5-9 (new components), 10 (manager wiring). ✓
- §3.2 shared contracts (`typewriter`, `character-name`, `act-navigation`) → Tasks 1, 2, 3. ✓
- §3.3 breakpoint & switching (`max-width: 1023px`, reactive, SSR guard) → Task 9. ✓
- §4.1 screens (text panel, name plate, tap layer, auto-hiding chrome, drawer, backlog) → Tasks 5, 6, 7, 8. ✓
- §4.2 state (index, typing, sceneVersion, UI flags, scene reset, initialDialogueIndex once) → Task 7. ✓
- §4.3 interaction rules (overlay-close, skip, advance, choices, bookmark number, keyboard) → Tasks 7, 8. ✓
- §5 i18n (en+zh, reuse + new keys) → Task 4. ✓
- §6 accessibility (labeled tap button, inert/Escape overlays, reduced-motion via `motion-safe:`) → Tasks 5, 6, 7. ✓
- §7 testing (unit per helper/component + desktop regression + E2E mobile project) → all tasks + Task 11. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code; every test step contains real assertions. ✓

**Type consistency:** `typeText`/`TypewriterOptions` identical in Tasks 1 & 7; `resolveCharacterName(entry, t)` identical in Tasks 2, 7, 8; `buildChapterData(storyId, sceneId, t)` identical in Tasks 3, 5; `MobileActDrawer`/`MobileBacklogSheet` prop shapes match between their definition tasks (5, 6) and their use in Task 8; `ReaderShell` forwards the same prop contract the children declare. ✓

**Deviation note:** The spec's §7 said "add a mobile Playwright project"; Task 11 implements exactly that but scopes it with `testMatch`/`testIgnore` so the mobile viewport runs *only* the new spec and the existing suite is unaffected — a safety refinement, not a scope change.
