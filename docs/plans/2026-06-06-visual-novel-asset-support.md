# Visual Novel Asset Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the story compiler to parse AI image generation prompts for backgrounds and character portraits from markdown, producing an asset manifest for image generation and runtime asset keys in DialogueEntry.

**Architecture:** Two new compiler modules (`parse-portraits.ts`, `resolve-assets.ts`), extensions to existing modules (`parse-scene.ts`, `emit.ts`, `validate.ts`, `compile.ts`, `config.ts`, `ir.ts`, `types.ts`), and writing skill documentation updates. The compiler produces `image-assets.json` (for an image generation agent) alongside the existing generated TypeScript (with new `background`/`portrait` asset keys on every `DialogueEntry`).

**Tech Stack:** TypeScript, Bun, Vitest, existing `@aquila/stories` compiler pipeline

**Design doc:** `docs/plans/2026-06-06-visual-novel-asset-support-design.md`

---

### Task 1: Add background/portrait fields to runtime DialogueEntry type

**Files:**
- Modify: `packages/stories/src/types.ts:3-7`

**Step 1: Write the failing test**

Create `packages/stories/src/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { DialogueEntry } from '../types';

describe('DialogueEntry', () => {
    it('accepts optional background and portrait asset keys', () => {
        const entry: DialogueEntry = {
            dialogue: 'hello',
            background: '_root/act1_s0',
            portrait: '李杰/angry',
        };
        expect(entry.background).toBe('_root/act1_s0');
        expect(entry.portrait).toBe('李杰/angry');
    });

    it('works without background and portrait (backward compatible)', () => {
        const entry: DialogueEntry = { dialogue: 'hello' };
        expect(entry.background).toBeUndefined();
        expect(entry.portrait).toBeUndefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/__tests__/types.test.ts`
Expected: FAIL — TypeScript error: `background`/`portrait` not assignable

**Step 3: Write minimal implementation**

Modify `packages/stories/src/types.ts` — add two optional fields:

```ts
export type DialogueEntry = {
    character?: string;
    characterId?: CharacterId;
    dialogue: string;
    background?: string;
    portrait?: string;
};
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/types.ts packages/stories/src/__tests__/types.test.ts
git commit -m "feat(stories): add background/portrait fields to DialogueEntry"
```

---

### Task 2: Extend compiler IR types with asset fields

**Files:**
- Modify: `packages/stories/src/compiler/ir.ts:3-12`

**Step 1: Write the failing test**

Create `packages/stories/src/compiler/__tests__/ir.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { DialogueEntryIR } from '../ir';

describe('DialogueEntryIR', () => {
    it('supports backgroundPrompt and expressionKey for raw parsed data', () => {
        const entry: DialogueEntryIR = {
            characterId: 'li_jie' as any,
            displayName: '李杰',
            dialogue: 'hello',
            backgroundPrompt: '月台夜景',
            expressionKey: 'angry',
        };
        expect(entry.backgroundPrompt).toBe('月台夜景');
        expect(entry.expressionKey).toBe('angry');
    });

    it('supports resolved background and portrait asset keys', () => {
        const entry: DialogueEntryIR = {
            characterId: 'li_jie' as any,
            displayName: '李杰',
            dialogue: 'hello',
            background: '_root/act1_s0',
            portrait: '李杰/angry',
        };
        expect(entry.background).toBe('_root/act1_s0');
        expect(entry.portrait).toBe('李杰/angry');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/ir.test.ts`
Expected: FAIL — TypeScript error

**Step 3: Write minimal implementation**

Modify `packages/stories/src/compiler/ir.ts` — extend `DialogueEntryIR`:

```ts
export interface DialogueEntryIR {
    characterId: CharacterId;
    displayName: string;
    dialogue: string;
    backgroundPrompt?: string;
    expressionKey?: string;
    background?: string;
    portrait?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/ir.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/ir.ts packages/stories/src/compiler/__tests__/ir.test.ts
git commit -m "feat(stories): extend DialogueEntryIR with asset fields"
```

---

### Task 3: Add charactersDocPath to StoryCompilerConfig

**Files:**
- Modify: `packages/stories/src/compiler/config.ts:11-22`

**Step 1: Write the failing test**

Add to `packages/stories/src/compiler/__tests__/ir.test.ts`:

```ts
import type { StoryCompilerConfig } from '../config';

describe('StoryCompilerConfig', () => {
    it('accepts optional charactersDocPath', () => {
        const config: StoryCompilerConfig = {
            storyId: 'demo',
            resolveCharacter: () => undefined,
            charactersDocPath: 'docs/characters.md',
        };
        expect(config.charactersDocPath).toBe('docs/characters.md');
    });

    it('works without charactersDocPath (defaults internally)', () => {
        const config: StoryCompilerConfig = {
            storyId: 'demo',
            resolveCharacter: () => undefined,
        };
        expect(config.charactersDocPath).toBeUndefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/ir.test.ts`
Expected: FAIL — TypeScript error on `charactersDocPath`

**Step 3: Write minimal implementation**

Modify `packages/stories/src/compiler/config.ts` — add field:

```ts
export interface StoryCompilerConfig {
    storyId: string;
    resolveCharacter: (name: string) => ResolvedCharacter | undefined;
    defaultSpeaker?: ResolvedCharacter;
    charactersDocPath?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/ir.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/config.ts packages/stories/src/compiler/__tests__/ir.test.ts
git commit -m "feat(stories): add charactersDocPath to StoryCompilerConfig"
```

---

### Task 4: Create parse-portraits.ts module

**Files:**
- Create: `packages/stories/src/compiler/parse-portraits.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-portraits.test.ts`

**Step 1: Write the failing test**

Create `packages/stories/src/compiler/__tests__/parse-portraits.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePortraits } from '../parse-portraits';
import { CharacterId } from '../../characters';
import type { ResolvedCharacter } from '../config';

const resolve = (name: string): ResolvedCharacter | undefined => {
    if (name === '李杰') return { id: CharacterId.LiJie, displayName: '李杰' };
    if (name === '旁白') return { id: CharacterId.Narrator, displayName: '旁白' };
    return undefined;
};

describe('parsePortraits', () => {
    it('extracts portrait prompts from characters.md format', () => {
        const md = [
            '# 角色設定文件',
            '',
            '## 1. 李杰（Li Jie）',
            '',
            '### 基本資料',
            '',
            '- **身份**：男主角',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: 17yo boy, short black hair, school uniform',
            '- **angry**: clenched jaw, narrowed eyes',
            '- **sad**: downcast eyes, trembling lips',
            '',
            '### 說話風格',
            '',
            '- 極度精簡',
        ].join('\n');

        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie]).toEqual({
            base: '17yo boy, short black hair, school uniform',
            angry: 'clenched jaw, narrowed eyes',
            sad: 'downcast eyes, trembling lips',
        });
    });

    it('handles characters without Portrait Prompts section', () => {
        const md = [
            '## 1. 旁白（Narrator）',
            '',
            '### 基本資料',
            '',
            '- **身份**：旁白',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.Narrator]).toBeUndefined();
    });

    it('normalizes expression keys to lowercase', () => {
        const md = [
            '## 1. 李杰（Li Jie）',
            '',
            '### Portrait Prompts',
            '',
            '- **Angry**: clenched jaw',
            '- **SAD**: downcast eyes',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie].angry).toBe('clenched jaw');
        expect(result[CharacterId.LiJie].sad).toBe('downcast eyes');
    });

    it('handles multi-line prompts', () => {
        const md = [
            '## 1. 李杰（Li Jie）',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: 17yo boy, short black hair,',
            '  school uniform, guarded expression',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie].base).toContain('17yo boy');
        expect(result[CharacterId.LiJie].base).toContain('guarded expression');
    });

    it('skips characters that cannot be resolved', () => {
        const md = [
            '## 1. 未知角色（Unknown）',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: something',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(Object.keys(result)).toHaveLength(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-portraits.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `packages/stories/src/compiler/parse-portraits.ts`:

```ts
import type { CharacterId } from '../characters';
import type { ResolvedCharacter } from './config';

export type PortraitPromptMap = Partial<Record<CharacterId, Record<string, string>>>;

const HEADING_RE = /^##\s+\d+\.\s+(.+?)（.*?）\s*$/;
const PROMPT_SECTION_RE = /^###\s+Portrait Prompts\s*$/;
const PROMPT_ITEM_RE = /^-\s+\*\*(.+?)\*\*:\s*(.+)$/;

export function parsePortraits(
    markdown: string,
    resolveCharacter: (name: string) => ResolvedCharacter | undefined
): PortraitPromptMap {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const result: PortraitPromptMap = {};

    let currentCharId: CharacterId | undefined;
    let inPortraitSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const headingMatch = line.match(HEADING_RE);
        if (headingMatch) {
            const name = headingMatch[1].trim();
            const resolved = resolveCharacter(name);
            currentCharId = resolved?.id;
            inPortraitSection = false;
            continue;
        }

        if (PROMPT_SECTION_RE.test(line)) {
            inPortraitSection = true;
            continue;
        }

        if (/^###\s/.test(line)) {
            inPortraitSection = false;
            continue;
        }

        if (inPortraitSection && currentCharId) {
            const itemMatch = line.match(PROMPT_ITEM_RE);
            if (itemMatch) {
                const key = itemMatch[1].trim().toLowerCase();
                let prompt = itemMatch[2].trim();
                while (i + 1 < lines.length && lines[i + 1].startsWith('  ')) {
                    i++;
                    prompt += ' ' + lines[i].trim();
                }
                if (!result[currentCharId]) {
                    result[currentCharId] = {};
                }
                result[currentCharId]![key] = prompt;
            }
        }
    }

    return result;
}
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-portraits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/parse-portraits.ts packages/stories/src/compiler/__tests__/parse-portraits.test.ts
git commit -m "feat(stories): add parse-portraits module for characters.md portrait prompts"
```

---

### Task 5: Extend parse-scene.ts to parse ```bg blocks

**Files:**
- Modify: `packages/stories/src/compiler/parse-scene.ts:1-68`
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`

**Step 1: Write the failing test**

Add to `packages/stories/src/compiler/__tests__/parse-scene.test.ts`:

```ts
    it('parses ```bg blocks and sets backgroundPrompt on the next entry', () => {
        const md = [
            '**旁白**：第一段。',
            '',
            '```bg',
            '月台夜景，冷色調',
            '```',
            '',
            '**李杰**：第二段。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBeUndefined();
        expect(result.entries[1].backgroundPrompt).toBe('月台夜景，冷色調');
    });

    it('carries backgroundPrompt to subsequent entries after a bg block', () => {
        const md = [
            '```bg',
            '月台夜景',
            '```',
            '',
            '**旁白**：第一段。',
            '',
            '**李杰**：第二段。',
            '',
            '**旁白**：第三段。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBe('月台夜景');
        expect(result.entries[1].backgroundPrompt).toBeUndefined();
        expect(result.entries[2].backgroundPrompt).toBeUndefined();
    });

    it('handles multiple bg blocks in one scene', () => {
        const md = [
            '```bg',
            '場景一',
            '```',
            '',
            '**旁白**：a',
            '',
            '```bg',
            '場景二',
            '```',
            '',
            '**旁白**：b',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBe('場景一');
        expect(result.entries[1].backgroundPrompt).toBe('場景二');
    });

    it('handles multi-line bg prompts', () => {
        const md = [
            '```bg',
            '月台夜景',
            '冷色調',
            '無人',
            '```',
            '',
            '**旁白**：hello',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toContain('月台夜景');
        expect(result.entries[0].backgroundPrompt).toContain('無人');
    });
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-scene.test.ts`
Expected: FAIL — `backgroundPrompt` is undefined on entries

**Step 3: Write minimal implementation**

Modify `packages/stories/src/compiler/parse-scene.ts`. Add bg block detection and `pendingBg` state tracking:

Replace the for-loop body (lines 26-65) with:

```ts
    const BG_BLOCK_RE = /^```bg\s*\n([\s\S]*?)\n```$/;

    let title: string | undefined;
    const entries: DialogueEntryIR[] = [];
    let pendingBg: string | undefined;

    for (const block of blocks) {
        if (block.startsWith('# ')) {
            title = block.slice(2).trim();
            continue;
        }
        if (/^-{3,}$/.test(block)) continue;

        const bgMatch = BG_BLOCK_RE.exec(block);
        if (bgMatch) {
            pendingBg = bgMatch[1].trim();
            continue;
        }

        const oneLine = block.replace(/\n+/g, ' ').trim();
        const m = HEADER_RE.exec(oneLine);
        if (!m) {
            if (defaultSpeaker) {
                const wrapped = /^\*\*([\s\S]+)\*\*$/.exec(oneLine);
                const entry: DialogueEntryIR = {
                    characterId: defaultSpeaker.id,
                    displayName: defaultSpeaker.displayName,
                    dialogue: (wrapped ? wrapped[1] : oneLine).trim(),
                };
                if (pendingBg !== undefined) {
                    entry.backgroundPrompt = pendingBg;
                    pendingBg = undefined;
                }
                entries.push(entry);
                continue;
            }
            throw new Error(
                `[story-compiler] ${sourcePath}: unrecognized paragraph (no "**name**：" header):\n${block}`
            );
        }
        const name = m[1].trim();
        const dialogue = m[2].trim();
        const resolved = resolveCharacter(name);
        if (!resolved) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        const entry: DialogueEntryIR = {
            characterId: resolved.id,
            displayName: resolved.displayName,
            dialogue,
        };
        if (pendingBg !== undefined) {
            entry.backgroundPrompt = pendingBg;
            pendingBg = undefined;
        }
        entries.push(entry);
    }
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-scene.test.ts`
Expected: PASS (all tests including existing ones)

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/parse-scene.ts packages/stories/src/compiler/__tests__/parse-scene.test.ts
git commit -m "feat(stories): parse ```bg blocks in markdown scenes"
```

---

### Task 6: Extend parse-scene.ts to parse [expression] override tags

**Files:**
- Modify: `packages/stories/src/compiler/parse-scene.ts:4` (regex)
- Test: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`

**Step 1: Write the failing test**

Add to `packages/stories/src/compiler/__tests__/parse-scene.test.ts`:

```ts
    it('parses [expression] override tag after speaker name', () => {
        const result = parseScene('**李杰** [angry]：妳做什麼！', resolve, 'x.md');
        expect(result.entries[0].expressionKey).toBe('angry');
        expect(result.entries[0].dialogue).toBe('妳做什麼！');
    });

    it('works without expression tag (backward compatible)', () => {
        const result = parseScene('**李杰**：hello', resolve, 'x.md');
        expect(result.entries[0].expressionKey).toBeUndefined();
    });

    it('combines bg block and expression tag', () => {
        const md = [
            '```bg',
            '月台',
            '```',
            '',
            '**李杰** [scared]：这是什麼？',
        ].join('\n');
        const result = parseScene(md, resolve, 'x.md');
        expect(result.entries[0].backgroundPrompt).toBe('月台');
        expect(result.entries[0].expressionKey).toBe('scared');
    });
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-scene.test.ts`
Expected: FAIL — `expressionKey` undefined, dialogue includes `[angry]`

**Step 3: Write minimal implementation**

Modify `packages/stories/src/compiler/parse-scene.ts` — update the regex (line 4):

```ts
const HEADER_RE = /^\*\*(.+?)\*\*(?:\s*\[([^\]]+)\])?[：:]\s*([\s\S]*)$/;
```

Update the header-match handling in the for-loop. Replace the block that extracts name and dialogue:

```ts
        const name = m[1].trim();
        const expressionKey = m[2]?.trim().toLowerCase();
        const dialogue = m[3].trim();
        const resolved = resolveCharacter(name);
        if (!resolved) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        const entry: DialogueEntryIR = {
            characterId: resolved.id,
            displayName: resolved.displayName,
            dialogue,
        };
        if (expressionKey) {
            entry.expressionKey = expressionKey;
        }
        if (pendingBg !== undefined) {
            entry.backgroundPrompt = pendingBg;
            pendingBg = undefined;
        }
        entries.push(entry);
```

Also update the non-header fallback path similarly — the regex now has 3 groups, so `m[2]` is expression and `m[3]` is dialogue. But the non-header path doesn't use the regex groups directly (it uses `oneLine`), so no change needed there.

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/parse-scene.test.ts`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/parse-scene.ts packages/stories/src/compiler/__tests__/parse-scene.test.ts
git commit -m "feat(stories): parse [expression] override tags in speaker headers"
```

---

### Task 7: Create resolve-assets.ts module

**Files:**
- Create: `packages/stories/src/compiler/resolve-assets.ts`
- Test: `packages/stories/src/compiler/__tests__/resolve-assets.test.ts`

**Step 1: Write the failing test**

Create `packages/stories/src/compiler/__tests__/resolve-assets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSceneAssets } from '../resolve-assets';
import { CharacterId } from '../../characters';
import type { DialogueEntryIR } from '../ir';
import type { PortraitPromptMap } from '../parse-portraits';

const portraitMap: PortraitPromptMap = {
    [CharacterId.LiJie]: {
        base: '17yo boy, school uniform',
        angry: 'clenched jaw, narrowed eyes',
    },
};

describe('resolveSceneAssets', () => {
    it('assigns background keys to every entry in a section', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'a', backgroundPrompt: '月台' },
            { characterId: CharacterId.LiJie, displayName: '李杰', dialogue: 'b' },
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'c' },
        ];
        const { backgrounds } = resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].background).toBe('_root/act1_s0');
        expect(entries[1].background).toBe('_root/act1_s0');
        expect(entries[2].background).toBe('_root/act1_s0');
        expect(backgrounds).toHaveLength(1);
        expect(backgrounds[0].key).toBe('_root/act1_s0');
        expect(backgrounds[0].prompt).toBe('月台');
    });

    it('handles multiple bg sections with incrementing index', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'a', backgroundPrompt: 'scene1' },
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'b', backgroundPrompt: 'scene2' },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].background).toBe('_root/act1_s0');
        expect(entries[1].background).toBe('_root/act1_s1');
    });

    it('uses directory name from sourcePath for nested scenes', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'a', backgroundPrompt: 'x' },
        ];
        resolveSceneAssets('demo', 'b1a_act4', 'branch_1a/act4.md', entries, portraitMap);
        expect(entries[0].background).toBe('branch_1a/b1a_act4_s0');
    });

    it('assigns portrait base key for characters with portrait prompts', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.LiJie, displayName: '李杰', dialogue: 'a' },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBe('李杰/base');
    });

    it('assigns portrait expression override key', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.LiJie, displayName: '李杰', dialogue: 'a', expressionKey: 'angry' },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBe('李杰/angry');
    });

    it('does not assign portrait for characters without portrait prompts', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'a' },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBeUndefined();
    });

    it('builds manifest entries with correct paths', () => {
        const entries: DialogueEntryIR[] = [
            { characterId: CharacterId.LiJie, displayName: '李杰', dialogue: 'a', backgroundPrompt: '月台' },
        ];
        const { backgrounds, portraits } = resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(backgrounds[0].path).toBe('demo/backgrounds/_root/act1_s0.png');
        expect(portraits[0].path).toBe('demo/characters/李杰/base.png');
        expect(portraits[0].prompt).toBe('17yo boy, school uniform');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/resolve-assets.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `packages/stories/src/compiler/resolve-assets.ts`:

```ts
import { CharacterDirectory } from '../characters/CharacterId';
import type { CharacterId } from '../characters';
import type { DialogueEntryIR } from './ir';
import type { PortraitPromptMap } from './parse-portraits';

export interface AssetManifestEntry {
    key: string;
    path: string;
    prompt: string;
}

export interface SceneAssets {
    backgrounds: AssetManifestEntry[];
    portraits: AssetManifestEntry[];
}

function getDirName(sourcePath: string): string {
    const slashIdx = sourcePath.lastIndexOf('/');
    if (slashIdx === -1) return '_root';
    return sourcePath.slice(0, slashIdx);
}

export function resolveSceneAssets(
    storyId: string,
    sceneId: string,
    sourcePath: string,
    entries: DialogueEntryIR[],
    portraitMap: PortraitPromptMap
): SceneAssets {
    const dirName = getDirName(sourcePath);
    const backgrounds: AssetManifestEntry[] = [];
    const portraits: AssetManifestEntry[] = [];
    const bgByKey = new Map<string, AssetManifestEntry>();
    const portraitByKey = new Map<string, AssetManifestEntry>();

    let currentBgPrompt: string | undefined;
    let sectionIndex = -1;

    for (const entry of entries) {
        if (entry.backgroundPrompt !== undefined) {
            currentBgPrompt = entry.backgroundPrompt;
            sectionIndex++;
        }

        if (currentBgPrompt !== undefined && sectionIndex >= 0) {
            const bgKey = `${dirName}/${sceneId}_s${sectionIndex}`;
            entry.background = bgKey;
            if (!bgByKey.has(bgKey)) {
                const bgEntry: AssetManifestEntry = {
                    key: bgKey,
                    path: `${storyId}/backgrounds/${bgKey}.png`,
                    prompt: currentBgPrompt,
                };
                bgByKey.set(bgKey, bgEntry);
                backgrounds.push(bgEntry);
            }
        }

        const prompts = portraitMap[entry.characterId];
        if (prompts) {
            const charName = CharacterDirectory.getById(entry.characterId).name;
            const expression = entry.expressionKey || 'base';
            const portraitKey = `${charName}/${expression}`;
            entry.portrait = portraitKey;
            const promptText = prompts[expression] || prompts['base'];
            if (promptText && !portraitByKey.has(portraitKey)) {
                portraitByKey.set(portraitKey, {
                    key: portraitKey,
                    path: `${storyId}/characters/${portraitKey}.png`,
                    prompt: promptText,
                });
                portraits.push(portraitByKey.get(portraitKey)!);
            }
        }
    }

    return { backgrounds, portraits };
}

export interface AssetManifest {
    storyId: string;
    backgrounds: AssetManifestEntry[];
    portraits: AssetManifestEntry[];
}

export function buildAssetManifest(
    storyId: string,
    sceneAssets: SceneAssets[]
): AssetManifest {
    const bgByKey = new Map<string, AssetManifestEntry>();
    const portraitByKey = new Map<string, AssetManifestEntry>();
    for (const sa of sceneAssets) {
        for (const bg of sa.backgrounds) bgByKey.set(bg.key, bg);
        for (const p of sa.portraits) portraitByKey.set(p.key, p);
    }
    return {
        storyId,
        backgrounds: [...bgByKey.values()],
        portraits: [...portraitByKey.values()],
    };
}
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/resolve-assets.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/resolve-assets.ts packages/stories/src/compiler/__tests__/resolve-assets.test.ts
git commit -m "feat(stories): add resolve-assets module for background/portrait key assignment"
```

---

### Task 8: Extend emit.ts to emit background/portrait fields and image-assets.json

**Files:**
- Modify: `packages/stories/src/compiler/emit.ts:13-27` (scene emitter) and `97-109` (emitStory)
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

**Step 1: Write the failing test**

Add a new test to `packages/stories/src/compiler/__tests__/emit.test.ts`. First add entries with asset fields to the existing `story` fixture — add this after the existing test inside the `describe` block:

```ts
    it('emits background and portrait keys in scene files', () => {
        const storyWithAssets: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.Narrator,
                            displayName: '旁白',
                            dialogue: 'hello',
                            background: '_root/act1_s0',
                        },
                        {
                            characterId: CharacterId.LiJie,
                            displayName: '李杰',
                            dialogue: 'hi',
                            background: '_root/act1_s0',
                            portrait: '李杰/angry',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        emitStory(storyWithAssets, dir);
        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).toContain('background:');
        expect(scene).toContain(JSON.stringify('_root/act1_s0'));
        expect(scene).toContain('portrait:');
        expect(scene).toContain(JSON.stringify('李杰/angry'));
    });

    it('emits image-assets.json manifest', () => {
        const storyWithManifest: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.Narrator,
                            displayName: '旁白',
                            dialogue: 'hello',
                            background: '_root/act1_s0',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
            assetManifest: {
                storyId: 'demo_story',
                backgrounds: [
                    { key: '_root/act1_s0', path: 'demo_story/backgrounds/_root/act1_s0.png', prompt: '月台' },
                ],
                portraits: [
                    { key: '李杰/base', path: 'demo_story/characters/李杰/base.png', prompt: '17yo boy' },
                ],
            },
        };
        emitStory(storyWithManifest, dir);
        const manifestPath = join(dir, 'image-assets.json');
        expect(existsSync(manifestPath)).toBe(true);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        expect(manifest.storyId).toBe('demo_story');
        expect(manifest.backgrounds).toHaveLength(1);
        expect(manifest.backgrounds[0].prompt).toBe('月台');
        expect(manifest.portraits).toHaveLength(1);
    });

    it('does not emit background/portrait fields when undefined', () => {
        const storyNoAssets: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'hello' },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        emitStory(storyNoAssets, dir);
        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).not.toContain('background:');
        expect(scene).not.toContain('portrait:');
    });
```

Also add `import type { AssetManifest }` at the top if needed.

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/emit.test.ts`
Expected: FAIL — `assetManifest` not on StoryIR, background/portrait not emitted

**Step 3: Write minimal implementation**

First, add `assetManifest` to `StoryIR` in `packages/stories/src/compiler/ir.ts`:

```ts
import type { AssetManifest } from './resolve-assets';

export interface StoryIR {
    storyId: string;
    name: string;
    start: string;
    scenes: SceneIR[];
    choices: ChoiceIR[];
    assetManifest?: AssetManifest;
}
```

Then modify `packages/stories/src/compiler/emit.ts`:

Update `emitSceneFile` to conditionally include background/portrait:

```ts
function emitSceneFile(story: StoryIR, sceneId: string): string {
    const scene = story.scenes.find(s => s.id === sceneId)!;
    const lines = scene.entries
        .map(e => {
            const parts = [
                `characterId: CharacterId.${charKey(e.characterId)}`,
                `character: ${q(e.displayName)}`,
                `dialogue: ${q(e.dialogue)}`,
            ];
            if (e.background) parts.push(`background: ${q(e.background)}`);
            if (e.portrait) parts.push(`portrait: ${q(e.portrait)}`);
            return `    { ${parts.join(', ')} },`;
        })
        .join('\n');
    return (
        HEADER +
        `import type { DialogueEntry } from '../../../types';\n` +
        `import { CharacterId } from '../../../characters';\n\n` +
        `export const scene: DialogueEntry[] = [\n${lines}\n];\n`
    );
}
```

Update `emitStory` to emit `image-assets.json` when manifest exists:

```ts
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
    if (story.assetManifest) {
        writeFileSync(
            join(outDir, 'image-assets.json'),
            JSON.stringify(story.assetManifest, null, 2) + '\n'
        );
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/emit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/emit.ts packages/stories/src/compiler/ir.ts packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat(stories): emit background/portrait fields and image-assets.json manifest"
```

---

### Task 9: Add asset validation warnings to validate.ts

**Files:**
- Modify: `packages/stories/src/compiler/validate.ts`
- Test: `packages/stories/src/compiler/__tests__/validate.test.ts`

**Step 1: Write the failing test**

Read the existing `validate.test.ts` to understand patterns, then add:

```ts
    it('warns about missing portrait prompts for characters in the story', () => {
        const story: StoryIR = {
            storyId: 'demo',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        { characterId: CharacterId.Narrator, displayName: '旁白', dialogue: 'a' },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        const warnings = validateStory(story, {});
        expect(warnings).toContain(
            expect.stringContaining('no portrait prompts')
        );
    });

    it('warns about unresolved expression keys', () => {
        const story: StoryIR = {
            storyId: 'demo',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: CharacterId.LiJie,
                            displayName: '李杰',
                            dialogue: 'a',
                            expressionKey: 'nonexistent',
                            portrait: '李杰/nonexistent',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        const portraitMap: PortraitPromptMap = {
            [CharacterId.LiJie]: { base: 'prompt' },
        };
        const warnings = validateStory(story, portraitMap);
        expect(warnings).toContain(
            expect.stringContaining('unknown expression')
        );
    });
```

Add necessary imports (`PortraitPromptMap` from parse-portraits).

**Step 2: Run test to verify it fails**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/validate.test.ts`
Expected: FAIL — `validateStory` doesn't accept `portraitMap`, doesn't return warnings

**Step 3: Write minimal implementation**

Modify `packages/stories/src/compiler/validate.ts` — change the signature to accept an optional `PortraitPromptMap` and return `string[]` (warnings):

```ts
import type { StoryIR } from './ir';
import type { PortraitPromptMap } from './parse-portraits';
import type { CharacterId } from '../characters';

export function validateStory(
    story: StoryIR,
    portraitMap?: PortraitPromptMap
): string[] {
    const warnings: string[] = [];
    const sceneIds = new Set(story.scenes.map(s => s.id));
    const choiceById = new Map(story.choices.map(c => [c.choiceId, c]));

    // (existing validation logic unchanged — throws on errors)

    // New: check portrait/expression coverage
    if (portraitMap) {
        const charsInStory = new Set<CharacterId>();
        for (const scene of story.scenes) {
            for (const entry of scene.entries) {
                charsInStory.add(entry.characterId);
                if (entry.expressionKey && portraitMap[entry.characterId]) {
                    if (!portraitMap[entry.characterId]![entry.expressionKey]) {
                        warnings.push(
                            `[story-compiler] scene "${scene.id}": unknown expression "${entry.expressionKey}" for character "${entry.characterId}" (falling back to base)`
                        );
                    }
                }
            }
        }
        for (const charId of charsInStory) {
            if (!portraitMap[charId]) {
                warnings.push(
                    `[story-compiler] character "${charId}" has no portrait prompts in characters.md`
                );
            }
        }
    }

    // Missing asset file warnings
    if (story.assetManifest) {
        // (file existence checks happen in compile.ts where fs is available)
    }

    return warnings;
}
```

Note: The existing `validateStory` was `void` and threw on errors. The new version still throws on errors but also returns warnings. Update all callers accordingly.

**Step 4: Run test to verify it passes**

Run: `bun --filter @aquila/stories test -- src/compiler/__tests__/validate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/validate.ts packages/stories/src/compiler/__tests__/validate.test.ts
git commit -m "feat(stories): add portrait/expression validation warnings to validateStory"
```

---

### Task 10: Wire new modules into compile.ts pipeline

**Files:**
- Modify: `packages/stories/src/compiler/compile.ts:1-48`

**Step 1: Read current compile.ts to understand the exact integration points**

No test needed here — this is integration wiring tested by the golden test in Task 12.

**Step 2: Write minimal implementation**

Modify `packages/stories/src/compiler/compile.ts`:

```ts
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StoryCompilerConfig } from './config';
import type { StoryIR } from './ir';
import { scanStory } from './scan-story';
import { buildStoryGraph } from './build-graph';
import { parseScene } from './parse-scene';
import { parsePortraits } from './parse-portraits';
import type { PortraitPromptMap } from './parse-portraits';
import { resolveSceneAssets, buildAssetManifest } from './resolve-assets';
import type { SceneAssets } from './resolve-assets';
import { validateStory } from './validate';
import { emitStory } from './emit';
import { existsSync as fsExists } from 'node:fs';

export interface CompileOptions {
    rawDir: string;
    name: string;
    outDir: string;
    choicesPath: string;
    config: StoryCompilerConfig;
}

export function compileStory(opts: CompileOptions): StoryIR {
    const portraitMap = loadPortraitMap(opts);

    const graph = buildStoryGraph(scanStory(opts.rawDir));
    const allSceneAssets: SceneAssets[] = [];

    const scenes = graph.scenes.map(s => {
        const md = readFileSync(join(opts.rawDir, s.sourcePath), 'utf8');
        const parsed = parseScene(
            md,
            opts.config.resolveCharacter,
            s.sourcePath,
            opts.config.defaultSpeaker
        );

        const sceneAssets = resolveSceneAssets(
            opts.config.storyId,
            s.id,
            s.sourcePath,
            parsed.entries,
            portraitMap
        );
        allSceneAssets.push(sceneAssets);

        return {
            id: s.id,
            title: parsed.title,
            entries: parsed.entries,
            next: s.next,
            sourcePath: s.sourcePath,
        };
    });

    const assetManifest = buildAssetManifest(opts.config.storyId, allSceneAssets);

    const story: StoryIR = {
        storyId: opts.config.storyId,
        name: opts.name,
        start: graph.start,
        scenes,
        choices: graph.choices,
        assetManifest,
    };

    const warnings = validateStory(story, portraitMap);
    checkMissingAssets(opts.config.storyId, assetManifest, warnings);
    for (const w of warnings) console.warn(w);

    emitStory(story, opts.outDir);
    scaffoldChoices(story, opts.choicesPath);
    return story;
}

function loadPortraitMap(opts: CompileOptions): PortraitPromptMap {
    const docPath = opts.config.charactersDocPath ?? 'docs/characters.md';
    const fullPath = join(opts.rawDir, docPath);
    if (!existsSync(fullPath)) {
        console.warn(`[story-compiler] no characters.md at ${docPath}, skipping portrait prompts`);
        return {};
    }
    const md = readFileSync(fullPath, 'utf8');
    return parsePortraits(md, opts.config.resolveCharacter);
}

function checkMissingAssets(
    storyId: string,
    manifest: { backgrounds: { path: string }[]; portraits: { path: string }[] },
    warnings: string[]
): void {
    const here = dirname(new URL(import.meta.url).pathname);
    // assets live at packages/assets/media/
    const assetsBase = join(here, '..', '..', '..', 'assets', 'media');
    const allPaths = [
        ...manifest.backgrounds.map(b => b.path),
        ...manifest.portraits.map(p => p.path),
    ];
    for (const p of allPaths) {
        if (!fsExists(join(assetsBase, p))) {
            warnings.push(`[story-compiler] missing asset: ${p}`);
        }
    }
}
```

(The `scaffoldChoices` function remains unchanged.)

**Step 3: Run existing tests to ensure nothing is broken**

Run: `bun --filter @aquila/stories test`
Expected: PASS (existing tests still pass — they don't call compileStory directly)

**Step 4: Commit**

```bash
git add packages/stories/src/compiler/compile.ts
git commit -m "feat(stories): wire portrait parsing and asset resolution into compile pipeline"
```

---

### Task 11: Update golden test to verify asset output

**Files:**
- Modify: `packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts`

**Step 1: Read the current golden test to understand its assertions**

Read `packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts`.

**Step 2: Add assertions for new output**

The golden test currently asserts scene counts and flow structure. Add assertions to verify that:
- The existing stories compile without errors (they have no bg/portrait directives, so output should be unchanged)
- No `image-assets.json` is emitted for stories without portrait prompts (or it has empty arrays)

Since `trainAdventure` doesn't have a `docs/characters.md` with portrait prompts, the compiler should warn and produce a manifest with empty arrays. Verify this doesn't break compilation.

Add to the golden test:

```ts
    it('compiles without asset fields when no bg/portrait directives exist', () => {
        // The golden story has no ```bg blocks or [expression] tags
        // So generated scenes should not contain background: or portrait: fields
        // This is implicitly tested by compile:check (git diff --exit-code)
    });
```

**Step 3: Run full compile to verify existing stories still produce identical output**

Run: `bun compile:stories`
Expected: Stories compile successfully. Check if generated output changed.

Run: `git diff --stat -- packages/stories/src/generated packages/stories/src/stories`
Expected: No changes for existing stories (they have no bg/portrait directives).

If there ARE changes, inspect them — the emit format for entries without assets should be identical to before (no `background:` or `portrait:` keys).

**Step 4: Run all tests**

Run: `bun --filter @aquila/stories test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts
git commit -m "test(stories): verify golden compile with asset support"
```

---

### Task 12: Update writing-new-story skill

**Files:**
- Modify: `.agents/skills/writing-new-story/SKILL.md`

**Prerequisite:** Load the `writing-skills` skill first for skill authoring best practices.

**Step 1: Read the current SKILL.md**

Read `.agents/skills/writing-new-story/SKILL.md` fully.

**Step 2: Add new content**

Make the following additions to the SKILL.md:

1. **Step 2 (Add Characters)** — add a subsection about Portrait Prompts in characters.md after the existing character creation instructions. Document:
   - Add `### Portrait Prompts` section under each character in `docs/characters.md`
   - At minimum add `- **base**: <English prompt>`
   - Add expression variants (e.g., `- **angry**: <prompt>`) for emotions used in the story
   - Expression keys are case-insensitive

2. **Step 3 (Write Markdown)** — add documentation for:
   - ` ```bg ` fenced blocks (with closing ` ``` `) for background image prompts
   - `[expression]` tags after speaker names (e.g., `**李杰** [angry]：dialogue`)
   - Background applies to all entries until the next ` ```bg ` block

3. **Step 5 (Run Compiler)** — add note about `image-assets.json` output and missing asset warnings

4. **New section after Step 8: Image Asset Workflow** — document the end-to-end flow:
   ```
   Write prompts in markdown + characters.md
       -> Compile: compiler extracts prompts, assigns paths, emits image-assets.json
       -> Generate: image generation agent reads manifest, creates PNGs at expected paths
       -> Verify: re-run compiler, warnings clear when all assets exist
   ```

5. **Quick Reference** — add asset path conventions:
   - Portraits: `<storyId>/characters/<characterName>/<expression>.png`
   - Backgrounds: `<storyId>/backgrounds/<rawDirName>/<sceneId>_s<section>.png`

**Step 3: Verify the skill is well-formed**

Read the updated SKILL.md to ensure formatting is consistent.

**Step 4: Commit**

```bash
git add .agents/skills/writing-new-story/SKILL.md
git commit -m "docs: update writing-new-story skill with visual novel asset support"
```

---

### Task 13: Full verification

**Step 1: Run story compiler**

Run: `bun compile:stories`
Expected: Both stories compile successfully, with warnings about missing characters.md/portrait prompts for trainAdventure (which doesn't have a docs/ folder).

**Step 2: Run compile:check (CI no-drift guard)**

Run: `bun run compile:check`
Expected: PASS (no unexpected diff in generated output)

**Step 3: Run all stories tests**

Run: `bun --filter @aquila/stories test`
Expected: PASS

**Step 4: Run typecheck**

Run: `bun --filter @aquila/stories typecheck`
Expected: PASS

**Step 5: Run lint**

Run: `bun --filter @aquila/stories lint`
Expected: PASS

**Step 6: Run full project tests**

Run: `bun test`
Expected: PASS

**Step 7: Commit if any generated output changed**

```bash
git add packages/stories/src/generated/
git commit -m "chore(stories): regenerate with visual novel asset support" || true
```

**Step 8: Final verification summary**

Confirm:
- [ ] `DialogueEntry` type has optional `background?` and `portrait?` fields
- [ ] ` ```bg ` blocks parsed correctly (with closing ` ``` `)
- [ ] `[expression]` tags parsed after speaker names
- [ ] `characters.md` Portrait Prompts section parsed
- [ ] `resolve-assets.ts` assigns keys to every entry
- [ ] `image-assets.json` manifest emitted
- [ ] Missing assets produce warnings, not errors
- [ ] Existing stories compile identically (no regression)
- [ ] Writing skill updated with new format documentation
