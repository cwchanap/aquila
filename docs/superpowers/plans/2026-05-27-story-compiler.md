# Story Compiler (markdown → runtime asset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic, deterministic compiler inside `@aquila/stories` that turns the Chinese-only markdown under `packages/stories/raw/<story>/` into the runtime game asset (zh `DialogueMap` + `FlowConfig` with choice transitions + scaffolded choice text), then regenerate Train Adventure and retire the old hand-authored runtime.

**Architecture:** Pipeline `parse → in-memory Story IR → emit TypeScript`. Folder structure drives the flow graph (a directory's last act becomes a `choice:` node when it has child `branch_*` dirs). Scene ids encode the branch path (`b1b_b2c_act14`). Flow owns transitions; a hand-maintained `choices.zh.ts` owns prompt/label text; the per-story `index.ts` merges them into the existing `ChoiceMap` shape so the public API is unchanged.

**Tech Stack:** Bun (runs TS directly, fs APIs), TypeScript, Vitest.

**Prerequisite:** Plan 1 (`2026-05-27-content-package-consolidation.md`) is complete — `@aquila/stories` is the content package and `@aquila/dialogue` is gone.

**Convention note (deviation from spec, allowed by "best fit"):**
- Generated dialogue uses **flat per-scene files** `generated/scenes/<sceneId>.ts` (constant relative-import depth, clean diffs) plus a `generated/dialogue.zh.ts` index — not nested-by-branch files.
- **No `dialogue.en.ts` is generated.** English is out of scope; the per-story `index.ts` aliases `en → zh` content with a `TODO` so the default-locale (`en`) reader stays functional (shows zh placeholder) until a real English source exists. This avoids a broken/blank default-locale reader and any clobber concerns.

---

## File Structure (created/modified)

**Created — compiler (build-time only, never re-exported from `src/index.ts`):**
- `packages/stories/src/compiler/ir.ts` — IR types
- `packages/stories/src/compiler/config.ts` — `StoryCompilerConfig` type
- `packages/stories/src/compiler/ids.ts` — `makeSceneId`, `optionIdFromDirRel`, `actSortKey`
- `packages/stories/src/compiler/parse-scene.ts` — markdown → entries
- `packages/stories/src/compiler/scan-story.ts` — fs walk → `DirNode` tree
- `packages/stories/src/compiler/build-graph.ts` — `DirNode` tree → graph (scenes + choices)
- `packages/stories/src/compiler/validate.ts` — integrity checks
- `packages/stories/src/compiler/emit.ts` — Story IR → generated TS
- `packages/stories/src/compiler/compile.ts` — orchestrates one story
- `packages/stories/src/compiler/cli.ts` — discovers `raw/<story>/`, compiles each
- `packages/stories/src/compiler/__tests__/*.test.ts` — unit tests + a fixture tree

**Created — runtime support:**
- `packages/stories/src/stories/choice-utils.ts` — `ChoiceText` type + `buildChoiceMap`
- `packages/stories/raw/trainAdventure/compiler.config.ts` — per-story config

**Created — generated (by running the compiler):**
- `packages/stories/src/stories/trainAdventure/generated/scenes/<sceneId>.ts`
- `packages/stories/src/stories/trainAdventure/generated/dialogue.zh.ts`
- `packages/stories/src/stories/trainAdventure/generated/flow.ts`
- `packages/stories/src/stories/trainAdventure/generated/choices.todo.zh.ts` (reference stub)

**Modified:**
- `packages/stories/src/stories/trainAdventure/index.ts` — rewired to generated + choices
- `packages/stories/src/stories/trainAdventure/choices.zh.ts` — scaffolded once, then hand-edited
- `packages/stories/package.json` — add `compile` script
- `package.json` (root) — add `compile:stories` script
- `apps/web/src/lib/reader-manager.ts` — flow-graph navigation

**Deleted (old hand-authored runtime):**
- `packages/stories/src/stories/trainAdventure/{en.ts, zh.ts, flow.ts}` and `.../zh/**`

---

## Task 1: Compiler IR, config type, and runtime choice-merge util

**Files:**
- Create: `packages/stories/src/compiler/ir.ts`
- Create: `packages/stories/src/compiler/config.ts`
- Create: `packages/stories/src/stories/choice-utils.ts`
- Test: `packages/stories/src/compiler/__tests__/choice-utils.test.ts`

- [ ] **Step 1: Create the IR types**

`packages/stories/src/compiler/ir.ts`:

```ts
import type { CharacterId } from '../characters';

export interface DialogueEntryIR {
    characterId: CharacterId;
    dialogue: string;
}

export interface SceneIR {
    id: string; // e.g. 'b1b_b2c_act14'
    title?: string; // from the leading "# ..." H1
    entries: DialogueEntryIR[];
    next: string | null; // scene id, 'choice:<choiceId>', or null (terminal)
    sourcePath: string; // md path relative to the story root (diagnostics)
}

export interface ChoiceOptionIR {
    optionId: string; // e.g. 'b2a'
    nextScene: string; // first scene id of the child branch
}

export interface ChoiceIR {
    choiceId: string; // e.g. 'choice_b1b_act8'
    fromSceneId: string; // the choice-point scene id
    options: ChoiceOptionIR[];
}

export interface StoryIR {
    storyId: string; // registry id, e.g. 'train_adventure'
    name: string; // raw dir name / export prefix, e.g. 'trainAdventure'
    start: string;
    scenes: SceneIR[];
    choices: ChoiceIR[];
}
```

- [ ] **Step 2: Create the per-story config type**

`packages/stories/src/compiler/config.ts`:

```ts
import type { CharacterId } from '../characters';

export interface StoryCompilerConfig {
    /** Registry id used by getStoryContent/getStoryFlow, e.g. 'train_adventure'. */
    storyId: string;
    /** Resolve a markdown character header (real name OR alias) to a CharacterId. */
    resolveCharacter: (name: string) => CharacterId | undefined;
}
```

- [ ] **Step 3: Create the runtime choice-merge util**

`packages/stories/src/stories/choice-utils.ts`:

```ts
import type { ChoiceMap } from '../types';
import type { FlowConfig } from '../flow-types';

export interface ChoiceText {
    [choiceId: string]: {
        prompt: string;
        labels: Record<string, string>; // optionId -> label
    };
}

/**
 * Merge generated flow transitions (which option leads to which scene) with
 * hand-maintained choice text (prompt + labels) into the runtime ChoiceMap.
 * Missing text falls back to a visible TODO marker.
 */
export function buildChoiceMap(flow: FlowConfig, text: ChoiceText): ChoiceMap {
    const map: ChoiceMap = {};
    for (const node of flow.nodes) {
        if (node.kind !== 'choice') continue;
        const t = text[node.choiceId] ?? { prompt: '', labels: {} };
        map[node.choiceId] = {
            prompt: t.prompt || `TODO: prompt for ${node.choiceId}`,
            options: Object.entries(node.nextByOption).map(
                ([optionId, nextScene]) => ({
                    id: optionId,
                    label: t.labels[optionId] || `TODO: ${optionId}`,
                    nextScene,
                })
            ),
        };
    }
    return map;
}
```

- [ ] **Step 4: Write the failing test for `buildChoiceMap`**

`packages/stories/src/compiler/__tests__/choice-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildChoiceMap } from '../../stories/choice-utils';
import type { FlowConfig } from '../../flow-types';

const flow: FlowConfig = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'choice:choice_act1' },
        {
            kind: 'choice',
            id: 'choice:choice_act1',
            choiceId: 'choice_act1',
            nextByOption: { b1a: 'b1a_act2', b1b: 'b1b_act2' },
        },
        { kind: 'scene', id: 'b1a_act2', sceneId: 'b1a_act2', next: null },
        { kind: 'scene', id: 'b1b_act2', sceneId: 'b1b_act2', next: null },
    ],
};

describe('buildChoiceMap', () => {
    it('merges flow transitions with provided text', () => {
        const map = buildChoiceMap(flow, {
            choice_act1: {
                prompt: 'Pick a path',
                labels: { b1a: 'Left', b1b: 'Right' },
            },
        });
        expect(map.choice_act1.prompt).toBe('Pick a path');
        expect(map.choice_act1.options).toEqual([
            { id: 'b1a', label: 'Left', nextScene: 'b1a_act2' },
            { id: 'b1b', label: 'Right', nextScene: 'b1b_act2' },
        ]);
    });

    it('falls back to TODO markers when text is missing', () => {
        const map = buildChoiceMap(flow, {});
        expect(map.choice_act1.prompt).toContain('TODO');
        expect(map.choice_act1.options[0].label).toContain('TODO');
        expect(map.choice_act1.options[0].nextScene).toBe('b1a_act2');
    });
});
```

- [ ] **Step 5: Run the test**

Run: `bun --filter @aquila/stories test choice-utils`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stories/src/compiler/ir.ts packages/stories/src/compiler/config.ts packages/stories/src/stories/choice-utils.ts packages/stories/src/compiler/__tests__/choice-utils.test.ts
git commit -m "feat(stories): add compiler IR types and runtime choice-merge util"
```

---

## Task 2: Id and ordering helpers

**Files:**
- Create: `packages/stories/src/compiler/ids.ts`
- Test: `packages/stories/src/compiler/__tests__/ids.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/stories/src/compiler/__tests__/ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeSceneId, optionIdFromDirRel, actSortKey } from '../ids';

describe('makeSceneId', () => {
    it('handles root acts', () => {
        expect(makeSceneId('', 'act1')).toBe('act1');
    });
    it('encodes the branch path', () => {
        expect(makeSceneId('branch_1b', 'act8')).toBe('b1b_act8');
        expect(makeSceneId('branch_1b/branch_2c', 'act14')).toBe('b1b_b2c_act14');
        expect(makeSceneId('branch_1b/branch_2c', 'actFinal')).toBe('b1b_b2c_actFinal');
    });
});

describe('optionIdFromDirRel', () => {
    it('uses the last branch segment', () => {
        expect(optionIdFromDirRel('branch_1b/branch_2c')).toBe('b2c');
        expect(optionIdFromDirRel('branch_1a')).toBe('b1a');
    });
});

describe('actSortKey', () => {
    it('orders numeric acts then final then epilogue', () => {
        const ordered = ['actEpilogue', 'act10', 'act2', 'actFinal', 'act1'].sort(
            (a, b) => actSortKey(a) - actSortKey(b)
        );
        expect(ordered).toEqual(['act1', 'act2', 'act10', 'actFinal', 'actEpilogue']);
    });
    it('throws on unexpected names', () => {
        expect(() => actSortKey('readme')).toThrow();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --filter @aquila/stories test ids`
Expected: FAIL — `Cannot find module '../ids'`.

- [ ] **Step 3: Implement `ids.ts`**

`packages/stories/src/compiler/ids.ts`:

```ts
/** 'branch_1b/branch_2c' + 'act14' -> 'b1b_b2c_act14'; '' + 'act1' -> 'act1'. */
export function makeSceneId(dirRel: string, act: string): string {
    const branchParts = dirRel
        ? dirRel.split('/').map((s) => s.replace(/^branch_/, 'b'))
        : [];
    return [...branchParts, act].join('_');
}

/** 'branch_1b/branch_2c' -> 'b2c' (option id from the child's own last segment). */
export function optionIdFromDirRel(dirRel: string): string {
    const last = dirRel.split('/').pop() ?? '';
    return last.replace(/^branch_/, 'b');
}

/** Sort key: numeric actN ascending, then actFinal, then actEpilogue. */
export function actSortKey(actBasename: string): number {
    if (actBasename === 'actFinal') return 1_000_000;
    if (actBasename === 'actEpilogue') return 1_000_001;
    const m = /^act(\d+)$/.exec(actBasename);
    if (!m) {
        throw new Error(`[story-compiler] unexpected act file name: ${actBasename}`);
    }
    return parseInt(m[1], 10);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun --filter @aquila/stories test ids`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stories/src/compiler/ids.ts packages/stories/src/compiler/__tests__/ids.test.ts
git commit -m "feat(stories): add scene-id and act-ordering helpers"
```

---

## Task 3: Markdown scene parser

**Files:**
- Create: `packages/stories/src/compiler/parse-scene.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/stories/src/compiler/__tests__/parse-scene.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseScene } from '../parse-scene';
import { CharacterId } from '../../characters';

const resolve = (name: string) =>
    name === '旁白'
        ? CharacterId.Narrator
        : name === '李杰'
          ? CharacterId.LiJie
          : undefined;

describe('parseScene', () => {
    it('extracts title and entries, keeping parentheticals verbatim', () => {
        const md = [
            '# 第一幕：月台',
            '',
            '**旁白**：深夜的月台。',
            '',
            '**李杰**：(內心)又是一個夜晚。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.title).toBe('第一幕：月台');
        expect(result.entries).toEqual([
            { characterId: CharacterId.Narrator, dialogue: '深夜的月台。' },
            { characterId: CharacterId.LiJie, dialogue: '(內心)又是一個夜晚。' },
        ]);
    });

    it('accepts a half-width colon', () => {
        const result = parseScene('**旁白**:hello', resolve, 'x.md');
        expect(result.entries[0]).toEqual({
            characterId: CharacterId.Narrator,
            dialogue: 'hello',
        });
    });

    it('throws on an unknown character', () => {
        expect(() => parseScene('**陌生人**：hi', resolve, 'x.md')).toThrow(/unknown character/);
    });

    it('throws on a non-header paragraph', () => {
        expect(() => parseScene('just some prose', resolve, 'x.md')).toThrow(/unrecognized paragraph/);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --filter @aquila/stories test parse-scene`
Expected: FAIL — `Cannot find module '../parse-scene'`.

- [ ] **Step 3: Implement `parse-scene.ts`**

`packages/stories/src/compiler/parse-scene.ts`:

```ts
import type { CharacterId } from '../characters';
import type { DialogueEntryIR } from './ir';

const HEADER_RE = /^\*\*(.+?)\*\*[：:]\s*([\s\S]*)$/;

export interface ParseSceneResult {
    title?: string;
    entries: DialogueEntryIR[];
}

export function parseScene(
    markdown: string,
    resolveCharacter: (name: string) => CharacterId | undefined,
    sourcePath: string
): ParseSceneResult {
    const text = markdown.replace(/\r\n/g, '\n');
    const blocks = text
        .split(/\n\s*\n/)
        .map((b) => b.trim())
        .filter(Boolean);

    let title: string | undefined;
    const entries: DialogueEntryIR[] = [];

    for (const block of blocks) {
        if (block.startsWith('# ')) {
            title = block.slice(2).trim();
            continue;
        }
        const oneLine = block.replace(/\n+/g, ' ').trim();
        const m = HEADER_RE.exec(oneLine);
        if (!m) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unrecognized paragraph (no "**name**：" header):\n${block}`
            );
        }
        const name = m[1].trim();
        const dialogue = m[2].trim();
        const characterId = resolveCharacter(name);
        if (!characterId) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        entries.push({ characterId, dialogue });
    }

    return { title, entries };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun --filter @aquila/stories test parse-scene`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stories/src/compiler/parse-scene.ts packages/stories/src/compiler/__tests__/parse-scene.test.ts
git commit -m "feat(stories): add markdown scene parser"
```

---

## Task 4: Story scan (fs) and graph builder

**Files:**
- Create: `packages/stories/src/compiler/scan-story.ts`
- Create: `packages/stories/src/compiler/build-graph.ts`
- Test: `packages/stories/src/compiler/__tests__/build-graph.test.ts`

- [ ] **Step 1: Implement the fs scanner**

`packages/stories/src/compiler/scan-story.ts`:

```ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** A directory in the story tree: its act files and child branch directories. */
export interface DirNode {
    rel: string; // '' for root, else e.g. 'branch_1b/branch_2c'
    acts: string[]; // act basenames present (no extension), e.g. ['act9','actFinal']
    children: DirNode[]; // child branch_* directories
}

export function scanStory(rootDir: string): DirNode {
    function walk(absDir: string, rel: string): DirNode {
        const dirents = readdirSync(absDir, { withFileTypes: true });
        const acts = dirents
            .filter((d) => d.isFile() && d.name.endsWith('.md'))
            .map((d) => d.name.replace(/\.md$/, ''));
        const children = dirents
            .filter((d) => d.isDirectory() && d.name.startsWith('branch_'))
            .map((d) =>
                walk(join(absDir, d.name), rel ? `${rel}/${d.name}` : d.name)
            );
        return { rel, acts, children };
    }
    return walk(rootDir, '');
}
```

- [ ] **Step 2: Write the failing test for the graph builder**

`packages/stories/src/compiler/__tests__/build-graph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildStoryGraph } from '../build-graph';
import type { DirNode } from '../scan-story';

// act1 -> act2 -> act3 -(choice)-> {b1a/act4 (terminal), b1b/act4 -> b1b/actFinal}
const tree: DirNode = {
    rel: '',
    acts: ['act1', 'act2', 'act3'],
    children: [
        { rel: 'branch_1a', acts: ['act4'], children: [] },
        { rel: 'branch_1b', acts: ['act4', 'actFinal'], children: [] },
    ],
};

describe('buildStoryGraph', () => {
    it('chains linear scenes and starts at the first root act', () => {
        const g = buildStoryGraph(tree);
        expect(g.start).toBe('act1');
        const byId = Object.fromEntries(g.scenes.map((s) => [s.id, s]));
        expect(byId.act1.next).toBe('act2');
        expect(byId.act2.next).toBe('act3');
    });

    it('makes the last act of a branching dir a choice node', () => {
        const g = buildStoryGraph(tree);
        const byId = Object.fromEntries(g.scenes.map((s) => [s.id, s]));
        expect(byId.act3.next).toBe('choice:choice_act3');
        expect(g.choices).toEqual([
            {
                choiceId: 'choice_act3',
                fromSceneId: 'act3',
                options: [
                    { optionId: 'b1a', nextScene: 'b1a_act4' },
                    { optionId: 'b1b', nextScene: 'b1b_act4' },
                ],
            },
        ]);
    });

    it('terminates leaves and orders actFinal last', () => {
        const g = buildStoryGraph(tree);
        const byId = Object.fromEntries(g.scenes.map((s) => [s.id, s]));
        expect(byId.b1a_act4.next).toBeNull();
        expect(byId.b1b_act4.next).toBe('b1b_actFinal');
        expect(byId.b1b_actFinal.next).toBeNull();
    });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun --filter @aquila/stories test build-graph`
Expected: FAIL — `Cannot find module '../build-graph'`.

- [ ] **Step 4: Implement the graph builder**

`packages/stories/src/compiler/build-graph.ts`:

```ts
import type { DirNode } from './scan-story';
import { actSortKey, makeSceneId, optionIdFromDirRel } from './ids';
import type { ChoiceIR } from './ir';

export interface GraphScene {
    id: string;
    sourcePath: string; // md path relative to story root
    next: string | null;
}

export interface StoryGraph {
    start: string;
    scenes: GraphScene[];
    choices: ChoiceIR[];
}

function orderedActs(node: DirNode): string[] {
    if (node.acts.length === 0) {
        throw new Error(
            `[story-compiler] directory "${node.rel || '<root>'}" has no .md scenes`
        );
    }
    return [...node.acts].sort((a, b) => actSortKey(a) - actSortKey(b));
}

function sourcePathFor(dirRel: string, act: string): string {
    return dirRel ? `${dirRel}/${act}.md` : `${act}.md`;
}

export function buildStoryGraph(root: DirNode): StoryGraph {
    const scenes: GraphScene[] = [];
    const choices: ChoiceIR[] = [];

    function process(node: DirNode): void {
        const acts = orderedActs(node);
        acts.forEach((act, i) => {
            const id = makeSceneId(node.rel, act);
            const sourcePath = sourcePathFor(node.rel, act);
            let next: string | null;
            if (i < acts.length - 1) {
                next = makeSceneId(node.rel, acts[i + 1]);
            } else if (node.children.length > 0) {
                const choiceId = `choice_${id}`;
                const sortedChildren = [...node.children].sort((a, b) =>
                    a.rel.localeCompare(b.rel)
                );
                choices.push({
                    choiceId,
                    fromSceneId: id,
                    options: sortedChildren.map((child) => ({
                        optionId: optionIdFromDirRel(child.rel),
                        nextScene: makeSceneId(child.rel, orderedActs(child)[0]),
                    })),
                });
                next = `choice:${choiceId}`;
            } else {
                next = null;
            }
            scenes.push({ id, sourcePath, next });
        });
        for (const child of [...node.children].sort((a, b) =>
            a.rel.localeCompare(b.rel)
        )) {
            process(child);
        }
    }

    process(root);
    return { start: makeSceneId('', orderedActs(root)[0]), scenes, choices };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun --filter @aquila/stories test build-graph`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stories/src/compiler/scan-story.ts packages/stories/src/compiler/build-graph.ts packages/stories/src/compiler/__tests__/build-graph.test.ts
git commit -m "feat(stories): add fs story scanner and flow graph builder"
```

---

## Task 5: Validation

**Files:**
- Create: `packages/stories/src/compiler/validate.ts`
- Test: `packages/stories/src/compiler/__tests__/validate.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/stories/src/compiler/__tests__/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateStory } from '../validate';
import { CharacterId } from '../../characters';
import type { StoryIR } from '../ir';

function baseStory(): StoryIR {
    return {
        storyId: 'x',
        name: 'x',
        start: 'act1',
        scenes: [
            {
                id: 'act1',
                entries: [{ characterId: CharacterId.Narrator, dialogue: 'hi' }],
                next: 'act2',
                sourcePath: 'act1.md',
            },
            {
                id: 'act2',
                entries: [{ characterId: CharacterId.Narrator, dialogue: 'bye' }],
                next: null,
                sourcePath: 'act2.md',
            },
        ],
        choices: [],
    };
}

describe('validateStory', () => {
    it('passes a well-formed story', () => {
        expect(() => validateStory(baseStory())).not.toThrow();
    });

    it('rejects a dangling next', () => {
        const s = baseStory();
        s.scenes[0].next = 'nope';
        expect(() => validateStory(s)).toThrow(/dangling next/);
    });

    it('rejects an unreachable scene', () => {
        const s = baseStory();
        s.scenes[0].next = null; // act2 now orphaned
        expect(() => validateStory(s)).toThrow(/unreachable/);
    });

    it('rejects a choice option pointing at a missing scene', () => {
        const s = baseStory();
        s.scenes[0].next = 'choice:c1';
        s.choices.push({
            choiceId: 'c1',
            fromSceneId: 'act1',
            options: [{ optionId: 'a', nextScene: 'ghost' }],
        });
        expect(() => validateStory(s)).toThrow(/missing scene/);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --filter @aquila/stories test validate`
Expected: FAIL — `Cannot find module '../validate'`.

- [ ] **Step 3: Implement `validate.ts`**

`packages/stories/src/compiler/validate.ts`:

```ts
import type { StoryIR } from './ir';

export function validateStory(story: StoryIR): void {
    const sceneIds = new Set(story.scenes.map((s) => s.id));
    const choiceById = new Map(story.choices.map((c) => [c.choiceId, c]));

    if (!sceneIds.has(story.start)) {
        throw new Error(`[story-compiler] start scene "${story.start}" does not exist`);
    }

    // Every next target resolves to a scene or a known choice node.
    for (const scene of story.scenes) {
        if (scene.next === null) continue;
        if (scene.next.startsWith('choice:')) {
            const choiceId = scene.next.slice('choice:'.length);
            if (!choiceById.has(choiceId)) {
                throw new Error(
                    `[story-compiler] scene "${scene.id}" has dangling next -> unknown choice "${choiceId}"`
                );
            }
        } else if (!sceneIds.has(scene.next)) {
            throw new Error(
                `[story-compiler] scene "${scene.id}" has dangling next -> "${scene.next}"`
            );
        }
    }

    // Every choice option points at a real scene.
    for (const choice of story.choices) {
        for (const opt of choice.options) {
            if (!sceneIds.has(opt.nextScene)) {
                throw new Error(
                    `[story-compiler] choice "${choice.choiceId}" option "${opt.optionId}" -> missing scene "${opt.nextScene}"`
                );
            }
        }
    }

    // Reachability from start.
    const adjacency = new Map<string, string[]>();
    for (const scene of story.scenes) {
        const outs: string[] = [];
        if (scene.next && scene.next.startsWith('choice:')) {
            const c = choiceById.get(scene.next.slice('choice:'.length));
            if (c) outs.push(...c.options.map((o) => o.nextScene));
        } else if (scene.next) {
            outs.push(scene.next);
        }
        adjacency.set(scene.id, outs);
    }
    const seen = new Set<string>();
    const stack = [story.start];
    while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const n of adjacency.get(id) ?? []) stack.push(n);
    }
    for (const scene of story.scenes) {
        if (!seen.has(scene.id)) {
            throw new Error(
                `[story-compiler] scene "${scene.id}" is unreachable from start`
            );
        }
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun --filter @aquila/stories test validate`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stories/src/compiler/validate.ts packages/stories/src/compiler/__tests__/validate.test.ts
git commit -m "feat(stories): add story-graph validation"
```

---

## Task 6: Emitter

**Files:**
- Create: `packages/stories/src/compiler/emit.ts`
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

The emitter writes, under `<outDir>` (= `src/stories/<name>/generated`):
`scenes/<sceneId>.ts` (one per scene), `dialogue.zh.ts` (index), `flow.ts`, and
`choices.todo.zh.ts` (reference stub). Per-scene files sit at a constant depth
(`generated/scenes/`), so imports are always `../../../../characters` and
`../../../../types`.

- [ ] **Step 1: Write the failing test (emit to a temp dir, then import the result)**

`packages/stories/src/compiler/__tests__/emit.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitStory } from '../emit';
import { CharacterId } from '../../characters';
import type { StoryIR } from '../ir';

const dir = mkdtempSync(join(tmpdir(), 'emit-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const story: StoryIR = {
    storyId: 'demo_story',
    name: 'demoStory',
    start: 'act1',
    scenes: [
        {
            id: 'act1',
            title: '第一幕',
            entries: [
                { characterId: CharacterId.Narrator, dialogue: "It's night." },
                { characterId: CharacterId.LiJie, dialogue: '(內心)hm.' },
            ],
            next: 'choice:choice_act1',
            sourcePath: 'act1.md',
        },
        { id: 'b1a_act2', entries: [{ characterId: CharacterId.Narrator, dialogue: 'a' }], next: null, sourcePath: 'branch_1a/act2.md' },
        { id: 'b1b_act2', entries: [{ characterId: CharacterId.Narrator, dialogue: 'b' }], next: null, sourcePath: 'branch_1b/act2.md' },
    ],
    choices: [
        {
            choiceId: 'choice_act1',
            fromSceneId: 'act1',
            options: [
                { optionId: 'b1a', nextScene: 'b1a_act2' },
                { optionId: 'b1b', nextScene: 'b1b_act2' },
            ],
        },
    ],
};

describe('emitStory', () => {
    it('writes scene files, dialogue index, flow, and choice stub', () => {
        emitStory(story, dir);
        expect(existsSync(join(dir, 'scenes', 'act1.ts'))).toBe(true);
        expect(existsSync(join(dir, 'dialogue.zh.ts'))).toBe(true);
        expect(existsSync(join(dir, 'flow.ts'))).toBe(true);
        expect(existsSync(join(dir, 'choices.todo.zh.ts'))).toBe(true);

        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).toContain('../../../../characters');
        expect(scene).toContain('CharacterId.Narrator');
        // string is JSON-escaped, so apostrophes survive safely
        expect(scene).toContain(JSON.stringify("It's night."));

        const flow = readFileSync(join(dir, 'flow.ts'), 'utf8');
        expect(flow).toContain('start: "act1"');
        expect(flow).toContain('id: "choice:choice_act1"');
        expect(flow).toContain('choiceId: "choice_act1"');
        expect(flow).toContain('export const demoStoryFlow');

        const idx = readFileSync(join(dir, 'dialogue.zh.ts'), 'utf8');
        expect(idx).toContain('export const demoStoryZhDialogue');
        expect(idx).toContain('"b1b_act2": s_b1b_act2');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --filter @aquila/stories test emit`
Expected: FAIL — `Cannot find module '../emit'`.

- [ ] **Step 3: Implement `emit.ts`**

`packages/stories/src/compiler/emit.ts`:

```ts
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryIR } from './ir';
import { CharacterId } from '../characters';

const HEADER = '// AUTO-GENERATED by @aquila/stories compiler. Do not edit by hand.\n\n';

function q(s: string): string {
    return JSON.stringify(s);
}

function emitSceneFile(story: StoryIR, sceneId: string): string {
    const scene = story.scenes.find((s) => s.id === sceneId)!;
    const lines = scene.entries
        .map(
            (e) =>
                `    { characterId: CharacterId.${charKey(e.characterId)}, dialogue: ${q(e.dialogue)} },`
        )
        .join('\n');
    return (
        HEADER +
        `import type { DialogueEntry } from '../../../../types';\n` +
        `import { CharacterId } from '../../../../characters';\n\n` +
        `export const scene: DialogueEntry[] = [\n${lines}\n];\n`
    );
}

// Map the CharacterId *value* (e.g. 'li_jie') back to its enum *key* (e.g. 'LiJie').
const VALUE_TO_KEY: Record<string, string> = Object.fromEntries(
    Object.entries(CharacterId).map(([k, v]) => [v as string, k])
);
function charKey(value: string): string {
    const key = VALUE_TO_KEY[value];
    if (!key) throw new Error(`[story-compiler] no CharacterId key for "${value}"`);
    return key;
}

function emitDialogueIndex(story: StoryIR): string {
    const imports = story.scenes
        .map((s) => `import { scene as s_${s.id} } from './scenes/${s.id}';`)
        .join('\n');
    const entries = story.scenes.map((s) => `    ${q(s.id)}: s_${s.id},`).join('\n');
    return (
        HEADER +
        `import type { DialogueMap } from '../../../types';\n${imports}\n\n` +
        `export const ${story.name}ZhDialogue: DialogueMap = {\n${entries}\n};\n`
    );
}

function emitFlow(story: StoryIR): string {
    const sceneNodes = story.scenes.map((s) => {
        const next = s.next === null ? 'null' : q(s.next);
        return `    { kind: 'scene', id: ${q(s.id)}, sceneId: ${q(s.id)}, next: ${next} },`;
    });
    const choiceNodes = story.choices.map((c) => {
        const opts = c.options
            .map((o) => `${q(o.optionId)}: ${q(o.nextScene)}`)
            .join(', ');
        return `    { kind: 'choice', id: ${q('choice:' + c.choiceId)}, choiceId: ${q(c.choiceId)}, nextByOption: { ${opts} } },`;
    });
    const union =
        story.scenes.map((s) => `    | ${q(s.id)}`).join('\n') || '    | never';
    return (
        HEADER +
        `import type { FlowConfig } from '../../../flow-types';\n\n` +
        `export type ${cap(story.name)}SceneId =\n${union};\n\n` +
        `export const ${story.name}Flow: FlowConfig<${cap(story.name)}SceneId> = {\n` +
        `  start: ${q(story.start)},\n  nodes: [\n${[...sceneNodes, ...choiceNodes].join('\n')}\n  ],\n};\n`
    );
}

function emitChoiceTodo(story: StoryIR): string {
    const entries = story.choices
        .map((c) => {
            const labels = c.options
                .map((o) => `      ${q(o.optionId)}: 'TODO: ${o.optionId}',`)
                .join('\n');
            return `  ${q(c.choiceId)}: {\n    prompt: 'TODO: prompt for ${c.choiceId}',\n    labels: {\n${labels}\n    },\n  },`;
        })
        .join('\n');
    return (
        HEADER +
        `import type { ChoiceText } from '../../choice-utils';\n\n` +
        `// Reference stub. Copy entries you need into choices.zh.ts and fill in real text.\n` +
        `export const ${story.name}ChoiceTextStub: ChoiceText = {\n${entries}\n};\n`
    );
}

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function emitStory(story: StoryIR, outDir: string): void {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    mkdirSync(join(outDir, 'scenes'), { recursive: true });
    for (const scene of story.scenes) {
        writeFileSync(
            join(outDir, 'scenes', `${scene.id}.ts`),
            emitSceneFile(story, scene.id)
        );
    }
    writeFileSync(join(outDir, 'dialogue.zh.ts'), emitDialogueIndex(story));
    writeFileSync(join(outDir, 'flow.ts'), emitFlow(story));
    writeFileSync(join(outDir, 'choices.todo.zh.ts'), emitChoiceTodo(story));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun --filter @aquila/stories test emit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stories/src/compiler/emit.ts packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat(stories): add runtime-asset emitter"
```

---

## Task 7: Compile orchestrator, CLI, and Train Adventure config

**Files:**
- Create: `packages/stories/src/compiler/compile.ts`
- Create: `packages/stories/src/compiler/cli.ts`
- Create: `packages/stories/raw/trainAdventure/compiler.config.ts`
- Modify: `packages/stories/package.json` (add `compile` script)
- Modify: `package.json` (root, add `compile:stories` script)

- [ ] **Step 1: Implement the orchestrator**

`packages/stories/src/compiler/compile.ts`:

```ts
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryCompilerConfig } from './config';
import type { StoryIR } from './ir';
import { scanStory } from './scan-story';
import { buildStoryGraph } from './build-graph';
import { parseScene } from './parse-scene';
import { validateStory } from './validate';
import { emitStory } from './emit';

export interface CompileOptions {
    rawDir: string; // packages/stories/raw/<name>
    name: string; // 'trainAdventure'
    outDir: string; // packages/stories/src/stories/<name>/generated
    choicesPath: string; // packages/stories/src/stories/<name>/choices.zh.ts
    config: StoryCompilerConfig;
}

export function compileStory(opts: CompileOptions): StoryIR {
    const graph = buildStoryGraph(scanStory(opts.rawDir));
    const scenes = graph.scenes.map((s) => {
        const md = readFileSync(join(opts.rawDir, s.sourcePath), 'utf8');
        const parsed = parseScene(md, opts.config.resolveCharacter, s.sourcePath);
        return {
            id: s.id,
            title: parsed.title,
            entries: parsed.entries,
            next: s.next,
            sourcePath: s.sourcePath,
        };
    });
    const story: StoryIR = {
        storyId: opts.config.storyId,
        name: opts.name,
        start: graph.start,
        scenes,
        choices: graph.choices,
    };
    validateStory(story);
    emitStory(story, opts.outDir);
    scaffoldChoices(story, opts.choicesPath);
    return story;
}

/** Create choices.zh.ts on first run; otherwise warn about drift, never overwrite. */
function scaffoldChoices(story: StoryIR, choicesPath: string): void {
    if (!existsSync(choicesPath)) {
        const entries = story.choices
            .map((c) => {
                const labels = c.options
                    .map((o) => `      ${JSON.stringify(o.optionId)}: '',`)
                    .join('\n');
                return `  ${JSON.stringify(c.choiceId)}: {\n    prompt: '',\n    labels: {\n${labels}\n    },\n  },`;
            })
            .join('\n');
        writeFileSync(
            choicesPath,
            `import type { ChoiceText } from '../choice-utils';\n\n` +
                `// Hand-maintained choice text (prompt + labels). Fill in the blanks.\n` +
                `export const ${story.name}ChoiceText: ChoiceText = {\n${entries}\n};\n`
        );
        console.log(`[story-compiler] scaffolded ${choicesPath} (fill in prompts/labels)`);
        return;
    }
    console.log(
        `[story-compiler] ${choicesPath} exists; left untouched. ` +
            `Required choiceIds: ${story.choices.map((c) => c.choiceId).join(', ') || '(none)'}`
    );
}
```

- [ ] **Step 2: Implement the CLI (discovers every `raw/<story>/compiler.config.ts`)**

`packages/stories/src/compiler/cli.ts`:

```ts
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileStory } from './compile';
import type { StoryCompilerConfig } from './config';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/compiler
const srcDir = resolve(here, '..'); // .../src
const pkgDir = resolve(srcDir, '..'); // .../stories
const rawRoot = join(pkgDir, 'raw');

async function main(): Promise<void> {
    const names = readdirSync(rawRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((name) => existsSync(join(rawRoot, name, 'compiler.config.ts')));

    if (names.length === 0) {
        console.warn('[story-compiler] no stories found under raw/');
        return;
    }

    for (const name of names) {
        const configMod = await import(
            join(rawRoot, name, 'compiler.config.ts')
        );
        const config: StoryCompilerConfig = configMod.default;
        const story = compileStory({
            rawDir: join(rawRoot, name),
            name,
            outDir: join(srcDir, 'stories', name, 'generated'),
            choicesPath: join(srcDir, 'stories', name, 'choices.zh.ts'),
            config,
        });
        console.log(
            `[story-compiler] ${name}: ${story.scenes.length} scenes, ${story.choices.length} choices`
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 3: Create the Train Adventure compiler config**

`packages/stories/raw/trainAdventure/compiler.config.ts`:

```ts
import { CharacterDirectory } from '../../src/characters';
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'train_adventure',
    resolveCharacter: (name) => CharacterDirectory.getIdByName(name),
};

export default config;
```

- [ ] **Step 4: Add the `compile` script to `packages/stories/package.json`**

In the `"scripts"` block add:

```json
    "compile": "bun src/compiler/cli.ts",
```

- [ ] **Step 5: Add the root `compile:stories` script to `package.json`**

In the root `"scripts"` block add:

```json
    "compile:stories": "bun --filter @aquila/stories compile",
```

- [ ] **Step 6: Commit (compiler is complete; not yet run against real content)**

```bash
git add packages/stories/src/compiler/compile.ts packages/stories/src/compiler/cli.ts packages/stories/raw/trainAdventure/compiler.config.ts packages/stories/package.json package.json
git commit -m "feat(stories): add compile orchestrator, CLI, and trainAdventure config"
```

---

## Task 8: Regenerate Train Adventure and retire the old runtime

**Files:**
- Delete: `packages/stories/src/stories/trainAdventure/{en.ts, zh.ts, flow.ts}`, `.../zh/**`
- Generated: `.../trainAdventure/generated/**`, scaffolded `.../trainAdventure/choices.zh.ts`
- Modify: `packages/stories/src/stories/trainAdventure/index.ts`
- Modify: `packages/stories/src/stories/index.ts` (only if symbol names changed)

- [ ] **Step 1: Run the compiler against the real markdown**

```bash
cd /Users/chanwaichan/workspace/Aquila
bun run compile:stories
```

Expected: prints `trainAdventure: <N> scenes, <M> choices` with no thrown error. (If it throws `unknown character "X"`, add `X` to the character table in `packages/stories/src/characters/CharacterId.ts` and re-run.) Creates `.../trainAdventure/generated/**` and scaffolds `.../trainAdventure/choices.zh.ts`.

- [ ] **Step 2: Delete the old hand-authored runtime**

```bash
git rm packages/stories/src/stories/trainAdventure/en.ts \
       packages/stories/src/stories/trainAdventure/zh.ts \
       packages/stories/src/stories/trainAdventure/flow.ts
git rm -r packages/stories/src/stories/trainAdventure/zh
```

- [ ] **Step 3: Rewrite the per-story `index.ts`**

`packages/stories/src/stories/trainAdventure/index.ts` (full replacement):

```ts
import type { ChoiceMap, DialogueMap } from '../../types';
import { buildChoiceMap } from '../choice-utils';
import { trainAdventureZhDialogue } from './generated/dialogue.zh';
import { trainAdventureFlow } from './generated/flow';
import { trainAdventureChoiceText } from './choices.zh';

export { trainAdventureFlow } from './generated/flow';
export type { TrainAdventureSceneId } from './generated/flow';

export type TrainAdventureLocale = 'en' | 'zh';

// English is not yet authored; fall back to zh content as a visible placeholder
// so the default-locale ('en') reader stays functional. TODO: real en source.
const dialogueByLocale: Record<TrainAdventureLocale, DialogueMap> = {
    zh: trainAdventureZhDialogue,
    en: trainAdventureZhDialogue,
};

const choices: ChoiceMap = buildChoiceMap(
    trainAdventureFlow,
    trainAdventureChoiceText
);

export function getTrainAdventureStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: TrainAdventureLocale = locale.startsWith('zh')
        ? 'zh'
        : 'en';
    return { dialogue: dialogueByLocale[normalized], choices };
}
```

- [ ] **Step 4: Verify the registry still resolves (no edit expected)**

`packages/stories/src/stories/index.ts` already imports `{ getTrainAdventureStory, trainAdventureFlow }` from `./trainAdventure` and re-exports them — these names are unchanged, so no edit is needed. Confirm:

```bash
grep -n "getTrainAdventureStory\|trainAdventureFlow" packages/stories/src/stories/index.ts
```

Expected: both symbols referenced; if the import path/symbols differ, update them to match Step 3's exports.

- [ ] **Step 5: Typecheck and run the stories tests**

```bash
bun --filter @aquila/stories typecheck
bun --filter @aquila/stories test
```

Expected: `typecheck` exits 0 (generated `SceneId` union + flow + scene modules all resolve). `test` PASSES, including the migrated `stories.test.ts` (it asserts the loader returns a non-empty dialogue map — confirm it does not hard-code the old `scene_*` ids; if it does, update those expectations to the new ids, e.g. `act1`).

- [ ] **Step 6: Commit**

```bash
git add packages/stories/src/stories/trainAdventure
git commit -m "feat(stories): regenerate trainAdventure from markdown; retire hand-authored runtime"
```

---

## Task 9: Switch the web reader to flow-graph navigation

**Files:**
- Modify: `apps/web/src/lib/reader-manager.ts`

The old `parseSceneNumber` / `hasNextScene` assume `scene_<n>` ids and integer
increments. The new ids (`act1`, `b1b_b2c_act14`) break that, and branching makes
linear "next" meaningless. Derive "has next" from the flow graph instead.

- [ ] **Step 1: Find every use of `parseSceneNumber`**

```bash
cd /Users/chanwaichan/workspace/Aquila
grep -n "parseSceneNumber\|hasNextScene\|getStoryFlow" apps/web/src/lib/reader-manager.ts
```

Note each call site (there is at least one: `hasNextScene`).

- [ ] **Step 2: Replace `parseSceneNumber` + `hasNextScene` with flow-based logic**

In `apps/web/src/lib/reader-manager.ts`:

1. Ensure `getStoryFlow` is imported from `@aquila/stories` (add it to the existing import if absent):

```ts
import { getStoryContent, getStoryFlow } from '@aquila/stories';
```

2. Delete the `parseSceneNumber` method entirely.

3. Replace the `hasNextScene` method body with:

```ts
    private hasNextScene(sceneId: string): boolean {
        const flow = getStoryFlow(this.currentState.storyId);
        if (!flow) return false;
        const node = flow.nodes.find(
            (n) => n.kind === 'scene' && n.sceneId === sceneId
        );
        return !!node && node.next != null;
    }
```

If `grep` in Step 1 reported `parseSceneNumber` used anywhere other than inside
the old `hasNextScene`, replace those call sites with the flow lookup above as
well (none are expected).

- [ ] **Step 3: Typecheck and run web unit tests**

```bash
bun --filter web test:run
```

Expected: PASS. If a reader-manager test mocked `getStoryContent` only and now needs `getStoryFlow`, extend that test's `vi.mock('@aquila/stories', ...)` to also return a minimal `getStoryFlow` (a flow with the scenes under test). Show of the mock shape:

```ts
vi.mock('@aquila/stories', () => ({
    getStoryContent: () => ({ dialogue: { act1: [{ characterId: 'narrator', dialogue: 'x' }] }, choices: {} }),
    getStoryFlow: () => ({ start: 'act1', nodes: [{ kind: 'scene', id: 'act1', sceneId: 'act1', next: null }] }),
}));
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__
git commit -m "refactor(web): navigate scenes via flow graph instead of scene-number parsing"
```

---

## Task 10: Golden test, CI no-diff guard, and full verification

**Files:**
- Create: `packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts`
- Modify: `package.json` (root, add `compile:check`)

- [ ] **Step 1: Write a golden test that compiles the real markdown in-memory**

`packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { scanStory } from '../scan-story';
import { buildStoryGraph } from '../build-graph';
import { validateStory } from '../validate';
import { parseScene } from '../parse-scene';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CharacterDirectory } from '../../characters';

const rawDir = resolve(__dirname, '../../../raw/trainAdventure');

describe('trainAdventure golden compile', () => {
    const graph = buildStoryGraph(scanStory(rawDir));

    it('starts at act1 and produces the full scene set', () => {
        expect(graph.start).toBe('act1');
        expect(graph.scenes.length).toBeGreaterThan(400);
    });

    it('has the first choice after act3 leading to branch 1a/1b', () => {
        const act3 = graph.scenes.find((s) => s.id === 'act3')!;
        expect(act3.next).toBe('choice:choice_act3');
        const c = graph.choices.find((x) => x.choiceId === 'choice_act3')!;
        expect(c.options.map((o) => o.optionId).sort()).toEqual(['b1a', 'b1b']);
        expect(c.options.map((o) => o.nextScene).sort()).toEqual([
            'b1a_act4',
            'b1b_act4',
        ]);
    });

    it('parses and validates the entire story (all characters resolve)', () => {
        const scenes = graph.scenes.map((s) => {
            const md = readFileSync(join(rawDir, s.sourcePath), 'utf8');
            const { entries } = parseScene(
                md,
                (n) => CharacterDirectory.getIdByName(n),
                s.sourcePath
            );
            return { id: s.id, entries, next: s.next, sourcePath: s.sourcePath };
        });
        expect(() =>
            validateStory({
                storyId: 'train_adventure',
                name: 'trainAdventure',
                start: graph.start,
                scenes,
                choices: graph.choices,
            })
        ).not.toThrow();
    });
});
```

- [ ] **Step 2: Run the golden test**

Run: `bun --filter @aquila/stories test golden`
Expected: 3 tests PASS. (If "all characters resolve" fails, the error names the missing character + file — add it to `CharacterId.ts` and re-run.)

- [ ] **Step 3: Add a CI no-diff guard script (root `package.json`)**

In the root `"scripts"` block add:

```json
    "compile:check": "bun run compile:stories && git diff --exit-code -- packages/stories/src/stories",
```

This regenerates and fails if committed output drifts from source.

- [ ] **Step 4: Verify the guard passes on freshly generated output**

```bash
bun run compile:check
```

Expected: exit 0 (no diff — Task 8 already committed the generated output, and re-running is deterministic).

- [ ] **Step 5: Full monorepo verification**

```bash
bun run lint
bun run build
bun test
```

Expected: lint passes; every workspace builds; all unit suites PASS.

Contingency: if `bun run lint` flags the generated files (e.g. stylistic/quote rules), add `'**/generated/**'` to the `ignores` of the repo's ESLint flat config (locate it with `ls eslint.config.* packages/stories/eslint.config.* 2>/dev/null`). Generated output stays covered by `tsc` (typecheck), so excluding it from ESLint is safe. Re-run `bun run lint`.

- [ ] **Step 6: Commit**

```bash
git add packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts package.json
git commit -m "test(stories): golden trainAdventure compile + compile:check CI guard"
```

---

## Self-Review notes (spec coverage)

- **Generic compiler reading `raw/<story>/`** → Tasks 1–7 (CLI discovers any `raw/<story>/compiler.config.ts`).
- **Deterministic, zh-only parse** → Task 3; no translation anywhere.
- **Dialogue + flow generated, choices stubbed** → Tasks 4 (graph), 6 (emit), 7/8 (scaffold `choices.zh.ts`, never clobber).
- **Scene-id scheme + folder-driven flow + terminals/choice points** → Tasks 2, 4; golden test in Task 10 asserts `act3 → choice → b1a/b1b`.
- **Choice structure/text split + merge into ChoiceMap** → Task 1 (`buildChoiceMap`), Task 8 (`index.ts`).
- **Validation (dangling next, orphan, missing scene, unresolved character)** → Tasks 3 + 5.
- **Public API unchanged** → Task 8 keeps `getTrainAdventureStory`/`trainAdventureFlow` names; registry untouched.
- **reader-manager flow navigation** → Task 9.
- **English handling** → Task 8 `index.ts` aliases `en → zh` (documented deviation: simpler than a blank skeleton, keeps the default-locale reader working).
- **Manual run + committed output + CI no-diff guard** → Task 7 (`compile:stories`), Task 10 (`compile:check`).

**Known intentional deviations from the spec:** flat per-scene files (constant import depth) instead of nested-by-branch; no `dialogue.en.ts` (en aliases zh in `index.ts`). Both noted at the top of this plan.
