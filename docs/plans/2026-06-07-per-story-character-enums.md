# Per-Story Character Enums Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move character definitions from the global `CharacterId.ts` into per-story `characters.md` files, with the compiler generating per-story `characters.ts` (enum + directory).

**Architecture:** The compiler parses character identity (ID, name, aliases) and portrait prompts from `characters.md` in a single pass. It builds a resolution function internally from the parsed directory + config data. Each story gets a generated `characters.ts` with its own `CharacterId` enum and `CharacterDirectory` class. The global `CharacterId.ts` is deleted. Runtime `DialogueEntry.characterId` becomes `string`.

**Tech Stack:** TypeScript, Bun, Vitest (unit tests), story compiler pipeline (`packages/stories/src/compiler/`)

**Design doc:** `docs/plans/2026-06-07-per-story-character-enums-design.md`

---

## Task 1: Create `parse-characters.ts` (TDD)

New parser that replaces `parse-portraits.ts`. Parses character identity AND portrait prompts in one pass.

**Files:**
- Create: `packages/stories/src/compiler/parse-characters.ts`
- Test: `packages/stories/src/compiler/__tests__/parse-characters.test.ts`

### Step 1: Write the failing test

```typescript
// packages/stories/src/compiler/__tests__/parse-characters.test.ts
import { describe, it, expect } from 'vitest';
import { parseCharacters } from '../parse-characters';

describe('parseCharacters', () => {
    const sample = `# Characters

## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Aliases**: 小顧, 顧言同學

Some bio prose.

### Portrait Prompts

- **base**: anime portrait of a boy
- **angry**: clenched jaw, narrowed eyes

## 2. 旁白（Narrator）

- **ID**: \`narrator\`

## 3. 學生（Student）

- **ID**: \`student\`
- **Aliases**: 同學, 隔壁同學
`;

    it('parses character IDs from metadata bullets', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')).toBeDefined();
        expect(dir.getById('narrator')).toBeDefined();
        expect(dir.getById('student')).toBeDefined();
    });

    it('extracts display name from heading', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.name).toBe('顧言');
        expect(dir.getById('narrator')?.name).toBe('旁白');
    });

    it('extracts aliases', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.aliases).toEqual(['小顧', '顧言同學']);
        expect(dir.getById('student')?.aliases).toEqual(['同學', '隔壁同學']);
        expect(dir.getById('narrator')?.aliases).toEqual([]);
    });

    it('resolves name to id', () => {
        const dir = parseCharacters(sample);
        expect(dir.getIdByName('顧言')).toBe('gu_yan');
        expect(dir.getIdByName('小顧')).toBe('gu_yan');
        expect(dir.getIdByName('narrator')).toBeUndefined();
        expect(dir.getIdByName('旁白')).toBe('narrator');
    });

    it('parses portrait prompts', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.portraits.base).toBe(
            'anime portrait of a boy'
        );
        expect(dir.getById('gu_yan')?.portraits.angry).toBe(
            'clenched jaw, narrowed eyes'
        );
        expect(dir.getById('narrator')?.portraits).toEqual({});
    });

    it('throws on missing ID', () => {
        const noId = `## 1. 無名（No Name）\n\nNo ID bullet.\n`;
        expect(() => parseCharacters(noId)).toThrow(/missing.*ID/i);
    });

    it('handles characters without aliases bullet', () => {
        const noAliases = `## 1. 張昊（Zhang Hao）\n\n- **ID**: \`zhang_hao\`\n`;
        const dir = parseCharacters(noAliases);
        expect(dir.getById('zhang_hao')?.aliases).toEqual([]);
    });

    it('handles multi-line portrait prompts', () => {
        const multiLine = `## 1. 李杰（Li Jie）

- **ID**: \`li_jie\`

### Portrait Prompts

- **base**: 17yo boy, short black hair,
  school uniform, guarded expression
`;
        const dir = parseCharacters(multiLine);
        expect(dir.getById('li_jie')?.portraits.base).toBe(
            '17yo boy, short black hair, school uniform, guarded expression'
        );
    });

    it('returns all characters in order', () => {
        const dir = parseCharacters(sample);
        expect(dir.characters.map(c => c.id)).toEqual([
            'gu_yan',
            'narrator',
            'student',
        ]);
    });
});
```

### Step 2: Run test to verify it fails

Run: `bun --filter stories vitest run src/compiler/__tests__/parse-characters.test.ts`
Expected: FAIL — module not found

### Step 3: Write the implementation

```typescript
// packages/stories/src/compiler/parse-characters.ts

export interface ParsedCharacter {
    id: string;
    name: string;
    aliases: string[];
    portraits: Record<string, string>;
}

export interface ParsedCharacterDirectory {
    characters: ParsedCharacter[];
    getIdByName(name: string): string | undefined;
    getById(id: string): ParsedCharacter | undefined;
}

interface HeadingMatch {
    name: string;
}

const HEADING_RE = /^##\s+\d+\.\s+(.+?)（.*?）\s*$/;
const ID_RE = /^-\s+\*\*ID\*\*:\s*`([^`]+)`\s*$/;
const ALIASES_RE = /^-\s+\*\*Aliases\*\*:\s*(.+)$/;
const PROMPT_SECTION_RE = /^###\s+Portrait Prompts\s*$/;
const PROMPT_ITEM_RE = /^-\s+\*\*(.+?)\*\*:\s*(.+)$/;

function parseHeading(line: string): HeadingMatch | null {
    const m = line.match(HEADING_RE);
    if (!m) return null;
    return { name: m[1].trim() };
}

function parseId(line: string): string | null {
    const m = line.match(ID_RE);
    return m ? m[1].trim() : null;
}

function parseAliases(line: string): string[] | null {
    const m = line.match(ALIASES_RE);
    if (!m) return null;
    return m[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

export function parseCharacters(markdown: string): ParsedCharacterDirectory {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const characters: ParsedCharacter[] = [];
    const byId = new Map<string, ParsedCharacter>();
    const nameToId = new Map<string, string>();

    let currentName: string | null = null;
    let currentId: string | null = null;
    let currentAliases: string[] = [];
    let currentPortraits: Record<string, string> = {};
    let inPortraitSection = false;

    function flushCharacter(): void {
        if (currentName !== null) {
            if (currentId === null) {
                throw new Error(
                    `[story-compiler] character "${currentName}" is missing **ID** metadata`
                );
            }
            const char: ParsedCharacter = {
                id: currentId,
                name: currentName,
                aliases: currentAliases,
                portraits: currentPortraits,
            };
            characters.push(char);
            byId.set(char.id, char);
            nameToId.set(char.name, char.id);
            for (const a of char.aliases) nameToId.set(a, char.id);
        }
    }

    function resetState(): void {
        currentName = null;
        currentId = null;
        currentAliases = [];
        currentPortraits = {};
        inPortraitSection = false;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const heading = parseHeading(line);
        if (heading) {
            flushCharacter();
            resetState();
            currentName = heading.name;
            continue;
        }

        if (currentName === null) continue;

        const idMatch = parseId(line);
        if (idMatch) {
            currentId = idMatch;
            continue;
        }

        const aliasesMatch = parseAliases(line);
        if (aliasesMatch) {
            currentAliases = aliasesMatch;
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

        if (inPortraitSection) {
            const itemMatch = line.match(PROMPT_ITEM_RE);
            if (itemMatch) {
                const key = itemMatch[1].trim().toLowerCase();
                let prompt = itemMatch[2].trim();
                while (
                    i + 1 < lines.length &&
                    lines[i + 1].startsWith('  ')
                ) {
                    i++;
                    prompt += ' ' + lines[i].trim();
                }
                currentPortraits[key] = prompt;
            }
        }
    }

    flushCharacter();

    return {
        characters,
        getById: (id: string) => byId.get(id),
        getIdByName: (name: string) => nameToId.get(name),
    };
}
```

### Step 4: Run tests to verify they pass

Run: `bun --filter stories vitest run src/compiler/__tests__/parse-characters.test.ts`
Expected: PASS (8 tests)

### Step 5: Commit

```bash
git add packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/__tests__/parse-characters.test.ts
git commit -m "feat(compiler): add parse-characters.ts for per-story character identity parsing"
```

---

## Task 2: Update Config Interface and IR Types

Change `StoryCompilerConfig` to data-only format and update IR types to use `string` instead of `CharacterId`.

**Files:**
- Modify: `packages/stories/src/compiler/config.ts`
- Modify: `packages/stories/src/compiler/ir.ts`

### Step 1: Rewrite config.ts

```typescript
// packages/stories/src/compiler/config.ts

export interface ResolvedCharacter {
    /** Stable unique-character reference id (string, matches generated enum value). */
    id: string;
    /** Label to render for this line — the as-written speaker label, or a
     *  canonicalized one for misspelled/verbose source labels. */
    displayName: string;
}

export interface StoryCompilerConfig {
    /** Registry id used by getStoryContent/getStoryFlow, e.g. 'train_adventure'. */
    storyId: string;
    /** Misspelled / verbose / dual-name source labels -> a clean canonical label.
     *  The canonical form is used both for resolution AND as the per-line displayName. */
    canonicalize?: Record<string, string>;
    /** Anonymous / role speakers collapse to ONE reference id each;
     *  the as-written label is preserved per line via displayName. */
    rolePatterns?: { pattern: RegExp; id: string }[];
    /** Default speaker for non-header paragraphs (narration). ID must exist in characters. */
    defaultSpeakerId?: string;
    /** Override path to characters.md (default: 'docs/characters.md'). */
    charactersDocPath?: string;
    /** Override suffix regex for stripping (內心)/聲音/etc. Default: common pattern. */
    suffixRegex?: RegExp;
}
```

### Step 2: Update ir.ts

Change `characterId: CharacterId` to `characterId: string` in `DialogueEntryIR`:

```typescript
// packages/stories/src/compiler/ir.ts

import type { AssetManifest } from './resolve-assets';

export interface DialogueEntryIR {
    // Always concrete: the parser resolves every "**name**：" line to a character id
    // string (narrator included, via 旁白 → 'narrator') and throws on unknowns,
    // so unlike the runtime DialogueEntry this is never speakerless.
    characterId: string;
    // Speaker label to display for this line: the as-written header, or a
    // canonicalized form for misspelled/verbose source labels.
    displayName: string;
    dialogue: string;
    backgroundPrompt?: string;
    expressionKey?: string;
    background?: string;
    portrait?: string;
}

export interface SceneIR {
    id: string;
    title?: string;
    entries: DialogueEntryIR[];
    next: string | null;
    sourcePath: string;
}

export interface ChoiceOptionIR {
    optionId: string;
    nextScene: string;
}

export interface ChoiceIR {
    choiceId: string;
    fromSceneId: string;
    options: ChoiceOptionIR[];
}

export interface StoryIR {
    storyId: string;
    name: string;
    start: string;
    scenes: SceneIR[];
    choices: ChoiceIR[];
    assetManifest?: AssetManifest;
}
```

(Remove the `import type { CharacterId }` line.)

### Step 3: Commit

```bash
git add packages/stories/src/compiler/config.ts packages/stories/src/compiler/ir.ts
git commit -m "refactor(compiler): update config interface and IR types for string character IDs"
```

---

## Task 3: Build Character Resolution Logic

New `resolve-character.ts` module that builds the `resolveCharacter` function from a parsed directory + config data.

**Files:**
- Create: `packages/stories/src/compiler/resolve-character.ts`
- Test: `packages/stories/src/compiler/__tests__/resolve-character.test.ts`

### Step 1: Write failing test

```typescript
// packages/stories/src/compiler/__tests__/resolve-character.test.ts
import { describe, it, expect } from 'vitest';
import { buildResolveCharacter } from '../resolve-character';
import type { ParsedCharacterDirectory } from '../parse-characters';

function makeDir(
    chars: { id: string; name: string; aliases?: string[] }[]
): ParsedCharacterDirectory {
    const byId = new Map(chars.map(c => [c.id, c]));
    const nameToId = new Map<string, string>();
    for (const c of chars) {
        nameToId.set(c.name, c.id);
        for (const a of c.aliases ?? []) nameToId.set(a, c.id);
    }
    return {
        characters: chars as any,
        getById: (id: string) => byId.get(id) as any,
        getIdByName: (name: string) => nameToId.get(name),
    };
}

describe('buildResolveCharacter', () => {
    const dir = makeDir([
        { id: 'gu_yan', name: '顧言', aliases: ['小顧'] },
        { id: 'narrator', name: '旁白' },
        { id: 'student', name: '學生', aliases: ['同學'] },
    ]);

    it('resolves exact name', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('顧言')).toEqual({ id: 'gu_yan', displayName: '顧言' });
    });

    it('resolves alias', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('小顧')).toEqual({ id: 'gu_yan', displayName: '小顧' });
    });

    it('applies canonicalize map before lookup', () => {
        const resolve = buildResolveCharacter(dir, {
            canonicalize: { '顧言同學': '顧言' },
        });
        expect(resolve('顧言同學')).toEqual({ id: 'gu_yan', displayName: '顧言' });
    });

    it('strips suffixes for resolution', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('顧言（內心）')).toEqual({
            id: 'gu_yan',
            displayName: '顧言（內心）',
        });
    });

    it('matches role patterns', () => {
        const resolve = buildResolveCharacter(dir, {
            rolePatterns: [{ pattern: /^隔壁同學$/, id: 'student' }],
        });
        expect(resolve('隔壁同學')).toEqual({
            id: 'student',
            displayName: '隔壁同學',
        });
    });

    it('returns undefined for unknown names', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('完全不存在')).toBeUndefined();
    });

    it('throws if role pattern references unknown character ID', () => {
        const resolve = buildResolveCharacter(dir, {
            rolePatterns: [{ pattern: /^x$/, id: 'nonexistent' }],
        });
        expect(() => resolve('x')).toThrow(/unknown character ID.*nonexistent/);
    });
});
```

### Step 2: Run test to verify it fails

Run: `bun --filter stories vitest run src/compiler/__tests__/resolve-character.test.ts`
Expected: FAIL — module not found

### Step 3: Write the implementation

```typescript
// packages/stories/src/compiler/resolve-character.ts

import type { ParsedCharacterDirectory } from './parse-characters';
import type { ResolvedCharacter } from './config';

const DEFAULT_SUFFIX_RE =
    /(（內心）|\(內心\)|（内心）|的聲音|的喊聲|的低語|之聲|[?？！!。]+)$/g;

export interface ResolveConfig {
    canonicalize?: Record<string, string>;
    rolePatterns?: { pattern: RegExp; id: string }[];
    suffixRegex?: RegExp;
}

function stripSuffix(label: string, regex: RegExp): string {
    let prev: string;
    let cur = label.trim();
    do {
        prev = cur;
        cur = cur.replace(regex, '').trim();
    } while (cur !== prev);
    return cur;
}

export function buildResolveCharacter(
    dir: ParsedCharacterDirectory,
    config: ResolveConfig
): (name: string) => ResolvedCharacter | undefined {
    const suffixRe = config.suffixRegex ?? DEFAULT_SUFFIX_RE;

    return (name: string): ResolvedCharacter | undefined => {
        const displayName = config.canonicalize?.[name] ?? name;

        // Exact name/alias lookup
        const exact = dir.getIdByName(displayName);
        if (exact) return { id: exact, displayName };

        // Suffix stripping
        const base = stripSuffix(displayName, suffixRe);
        if (base !== displayName) {
            const viaBase = dir.getIdByName(base);
            if (viaBase) return { id: viaBase, displayName };
        }

        // Role patterns
        if (config.rolePatterns) {
            for (const r of config.rolePatterns) {
                if (r.pattern.test(displayName) || r.pattern.test(base)) {
                    if (!dir.getById(r.id)) {
                        throw new Error(
                            `[story-compiler] role pattern references unknown character ID "${r.id}"`
                        );
                    }
                    return { id: r.id, displayName };
                }
            }
        }

        return undefined;
    };
}
```

### Step 4: Run tests to verify they pass

Run: `bun --filter stories vitest run src/compiler/__tests__/resolve-character.test.ts`
Expected: PASS (7 tests)

### Step 5: Commit

```bash
git add packages/stories/src/compiler/resolve-character.ts packages/stories/src/compiler/__tests__/resolve-character.test.ts
git commit -m "feat(compiler): add buildResolveCharacter for data-driven character resolution"
```

---

## Task 4: Update emit.ts — Generate characters.ts

Add `emitCharacters()` function and update scene file imports to use per-story `../characters`.

**Files:**
- Modify: `packages/stories/src/compiler/emit.ts`
- Test: `packages/stories/src/compiler/__tests__/emit.test.ts`

### Step 1: Add emitCharacters function to emit.ts

Add this function (before `emitStory`):

```typescript
function charEnumKey(id: string): string {
    // Convert snake_case id to PascalCase: 'gu_yan' -> 'GuYan'
    return id
        .split('_')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
}

function emitCharacters(
    dir: ParsedCharacterDirectory
): string {
    const enumEntries = dir.characters
        .map(c => `    ${charEnumKey(c.id)} = ${q(c.id)},`)
        .join('\n');

    const tableEntries = dir.characters
        .map(c => {
            const aliases = c.aliases.length > 0
                ? `, aliases: [${c.aliases.map(q).join(', ')}]`
                : ', aliases: []';
            return `    [CharacterId.${charEnumKey(c.id)}]: { id: ${q(c.id)}, name: ${q(c.name)}${aliases} },`;
        })
        .join('\n');

    return (
        HEADER +
        `export enum CharacterId {\n${enumEntries}\n}\n\n` +
        `export interface CharacterInfo {\n` +
        `    id: string;\n` +
        `    name: string;\n` +
        `    aliases: string[];\n` +
        `}\n\n` +
        `export const characterTable: Record<string, CharacterInfo> = {\n${tableEntries}\n};\n\n` +
        `const nameToId = new Map<string, string>();\n` +
        `for (const c of Object.values(characterTable)) {\n` +
        `    nameToId.set(c.name, c.id);\n` +
        `    for (const a of c.aliases) nameToId.set(a, c.id);\n` +
        `}\n\n` +
        `export class CharacterDirectory {\n` +
        `    static getById(id: string): CharacterInfo | undefined {\n` +
        `        return characterTable[id];\n` +
        `    }\n\n` +
        `    static getIdByName(name: string): string | undefined {\n` +
        `        return nameToId.get(name);\n` +
        `    }\n\n` +
        `    static getAll(): CharacterInfo[] {\n` +
        `        return Object.values(characterTable);\n` +
        `    }\n}\n`
    );
}
```

### Step 2: Update emitSceneFile imports

Change the CharacterId import from `'../../../characters'` to `'../characters'`:

```typescript
// In emitSceneFile's imports array, replace:
//   `import { CharacterId } from '../../../characters';`
// with:
    `import { CharacterId } from '../characters';`,
```

### Step 3: Update charKey function

The `charKey` function currently maps CharacterId enum value → key using the global enum. Replace it with a version that uses `charEnumKey`:

```typescript
function charKey(value: string): string {
    return charEnumKey(value);
}
```

Remove the `VALUE_TO_KEY` map and the `import { CharacterId } from '../characters'` at the top of emit.ts.

### Step 4: Update emitStory to accept and use ParsedCharacterDirectory

Add `characterDir` parameter to `emitStory`:

```typescript
import type { ParsedCharacterDirectory } from './parse-characters';

export function emitStory(
    story: StoryIR,
    outDir: string,
    characterDir: ParsedCharacterDirectory
): void {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    mkdirSync(join(outDir, 'scenes'), { recursive: true });

    // Generate characters.ts
    writeFileSync(join(outDir, 'characters.ts'), emitCharacters(characterDir));

    // ... rest of existing emitStory (portraits, backgrounds, scenes, etc.)
}
```

### Step 5: Update existing emit tests

Update `packages/stories/src/compiler/__tests__/emit.test.ts` to pass a mock `ParsedCharacterDirectory` to `emitStory` and verify `characters.ts` output.

### Step 6: Run all compiler tests

Run: `bun --filter stories vitest run src/compiler/`
Expected: PASS

### Step 7: Commit

```bash
git add packages/stories/src/compiler/emit.ts packages/stories/src/compiler/__tests__/emit.test.ts
git commit -m "feat(compiler): generate per-story characters.ts with enum and directory"
```

---

## Task 5: Update compile.ts — Wire Everything Together

Update the compile flow to use `parseCharacters`, `buildResolveCharacter`, and pass directory to `emitStory`.

**Files:**
- Modify: `packages/stories/src/compiler/compile.ts`

### Step 1: Rewrite compile.ts

```typescript
// packages/stories/src/compiler/compile.ts

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StoryCompilerConfig } from './config';
import type { ResolvedCharacter } from './config';
import type { StoryIR } from './ir';
import { scanStory } from './scan-story';
import { buildStoryGraph } from './build-graph';
import { parseScene } from './parse-scene';
import { validateStory } from './validate';
import { emitStory } from './emit';
import { parseCharacters } from './parse-characters';
import type { ParsedCharacterDirectory } from './parse-characters';
import { buildResolveCharacter } from './resolve-character';
import { resolveSceneAssets, buildAssetManifest } from './resolve-assets';
import type { SceneAssets } from './resolve-assets';

export interface CompileOptions {
    rawDir: string;
    name: string;
    outDir: string;
    choicesPath: string;
    config: StoryCompilerConfig;
}

function loadCharacterDir(
    opts: CompileOptions
): ParsedCharacterDirectory {
    const docPath = opts.config.charactersDocPath ?? 'docs/characters.md';
    const fullPath = join(opts.rawDir, docPath);
    if (!existsSync(fullPath)) {
        throw new Error(
            `[story-compiler] no characters.md at ${docPath} for story "${opts.name}"`
        );
    }
    const md = readFileSync(fullPath, 'utf8');
    return parseCharacters(md);
}

export function compileStory(opts: CompileOptions): StoryIR {
    const charDir = loadCharacterDir(opts);
    const resolveCharacter = buildResolveCharacter(charDir, opts.config);

    // Build defaultSpeaker from config
    let defaultSpeaker: ResolvedCharacter | undefined;
    if (opts.config.defaultSpeakerId) {
        const info = charDir.getById(opts.config.defaultSpeakerId);
        if (!info) {
            throw new Error(
                `[story-compiler] defaultSpeakerId "${opts.config.defaultSpeakerId}" not found in characters.md`
            );
        }
        defaultSpeaker = { id: info.id, displayName: info.name };
    }

    const graph = buildStoryGraph(scanStory(opts.rawDir));
    const allSceneAssets: SceneAssets[] = [];

    // Build portrait map for asset resolution
    const portraitMap: Partial<Record<string, Record<string, string>>> = {};
    for (const c of charDir.characters) {
        if (Object.keys(c.portraits).length > 0) {
            portraitMap[c.id] = c.portraits;
        }
    }

    const scenes = graph.scenes.map(s => {
        const md = readFileSync(join(opts.rawDir, s.sourcePath), 'utf8');
        const parsed = parseScene(
            md,
            resolveCharacter,
            s.sourcePath,
            defaultSpeaker
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

    const assetManifest = buildAssetManifest(
        opts.config.storyId,
        allSceneAssets
    );

    const story: StoryIR = {
        storyId: opts.config.storyId,
        name: opts.name,
        start: graph.start,
        scenes,
        choices: graph.choices,
        assetManifest,
    };

    const warnings = validateStory(story, portraitMap);
    for (const w of warnings) console.warn(w);

    emitStory(story, opts.outDir, charDir);
    scaffoldChoices(story, opts.choicesPath);
    return story;
}

/** Create choices.zh.ts on first run; otherwise warn about drift, never overwrite. */
function scaffoldChoices(story: StoryIR, choicesPath: string): void {
    if (!existsSync(choicesPath)) {
        const entries = story.choices
            .map(c => {
                const labels = c.options
                    .map(o => `      ${JSON.stringify(o.optionId)}: '',`)
                    .join('\n');
                return `  ${JSON.stringify(c.choiceId)}: {\n    prompt: '',\n    labels: {\n${labels}\n    },\n  },`;
            })
            .join('\n');
        mkdirSync(dirname(choicesPath), { recursive: true });
        writeFileSync(
            choicesPath,
            `import type { ChoiceText } from '../choice-utils';\n\n` +
                `// Hand-maintained choice text (prompt + labels). Fill in the blanks.\n` +
                `export const ${story.name}ChoiceText: ChoiceText = {\n${entries}\n};\n`
        );
        console.log(
            `[story-compiler] scaffolded ${choicesPath} (fill in prompts/labels)`
        );
        return;
    }
    console.log(
        `[story-compiler] ${choicesPath} exists; left untouched. ` +
            `Required choiceIds: ${story.choices.map(c => c.choiceId).join(', ') || '(none)'}`
    );
}
```

### Step 2: Update parse-portraits.ts references

Delete `parse-portraits.ts` (its functionality is now in `parse-characters.ts`). Update any remaining imports.

Check for imports of `parse-portraits`:
- `compile.ts` — already rewritten above (no longer imports it)
- `resolve-assets.ts` — imports `PortraitPromptMap` type from `parse-portraits`. Change the type to `Partial<Record<string, Record<string, string>>>` (which is what it already is under the hood), or move the type definition.

### Step 3: Update resolve-assets.ts type import

Change in `resolve-assets.ts`:
```typescript
// Remove:
// import type { PortraitPromptMap } from './parse-portraits';
// Replace PortraitPromptMap usage with inline type:
type PortraitPromptMap = Partial<Record<string, Record<string, string>>>;
```

### Step 4: Run all compiler tests

Run: `bun --filter stories vitest run src/compiler/`
Expected: PASS (some tests may need updates for new function signatures)

### Step 5: Commit

```bash
git add packages/stories/src/compiler/
git commit -m "feat(compiler): wire parseCharacters + buildResolveCharacter into compile flow"
```

---

## Task 6: Add ID/Aliases Metadata to dontSaveMeBeforeMidnight characters.md

Add `- **ID**:` and `- **Aliases**:` bullets to every character section. Also add minimal entries for generic/role characters not currently in the file.

**Files:**
- Modify: `packages/stories/raw/dontSaveMeBeforeMidnight/docs/characters.md`

### Step 1: Add metadata to existing character sections

For each `## N. Name（Romaji）` heading, add the ID and aliases bullets right after the heading (before `### 基本資料` or any prose). Use the IDs from the current global `CharacterId.ts`:

| Heading | ID | Aliases |
|---|---|---|
| 顧言 | `gu_yan` | (none) |
| 許星棠 | `xu_xingtang` | (none) |
| 邵啟明 | `shao_qiming` | 邵叔 |
| 韓越 | `han_yue` | (none) |
| 林主任 | `lin_zhuren` | (none) |
| 張昊 | `zhang_hao` | (none) |
| 黑雨衣 | `black_raincoat` | (none) |
| 顧澤（顧言父親） | `gu_ze` | (none) |
| 許星棠母親 | `xu_mother` | (none) |

### Step 2: Add missing generic/role characters

Append these minimal sections (no prose, no portraits) for characters used by role patterns and defaultSpeaker:

```markdown
---

## N. 旁白（Narrator）

- **ID**: `narrator`

---

## N+1. 室友（Roommate）

- **ID**: `roommate`

---

## N+2. 女聲（Female Voice）

- **ID**: `female_voice`

---

## N+3. 學生（Student）

- **ID**: `student`
- **Aliases**: 同學, 隔壁同學

---

## N+4. 警察（Police Officer）

- **ID**: `police_officer`
- **Aliases**: 警員

---

## N+5. 訊息（Message）

- **ID**: `message`
- **Aliases**: 簡訊, 手機螢幕, 匿名訊息

---

## N+6. 廣播（Announcement）

- **ID**: `announcement`
- **Aliases**: 廣播聲

---

## N+7. 聲音（Voice）

- **ID**: `voice`

---

## N+8. ？？？（Unknown）

- **ID**: `unknown`
```

### Step 3: Commit

```bash
git add packages/stories/raw/dontSaveMeBeforeMidnight/docs/characters.md
git commit -m "feat(stories): add character ID and aliases metadata to dontSaveMeBeforeMidnight"
```

---

## Task 7: Create Minimal characters.md for trainAdventure

Create a characters.md with headings + ID + aliases only, mechanically extracted from the current global `CharacterId.ts`. No prose, no portrait prompts.

**Files:**
- Create: `packages/stories/raw/trainAdventure/docs/characters.md`

### Step 1: Generate the file

Write a file that lists every trainAdventure character from the global `CharacterId.ts`. Extract from:
- The "core cast" section (Narrator through LingMo — 17 chars)
- The "extended named cast (trainAdventure)" section (HasegawaMio through Nanao — ~52 chars)
- The "collapsed anonymous / role speakers" section (ElfGuard through Voice — ~30 chars, only those used by trainAdventure)

Each entry:
```markdown
## N. DisplayName（Romaji/Role）

- **ID**: `character_id`
- **Aliases**: alias1, alias2
```

Use the exact `name` and `aliases` from the `characterTable` in the current `CharacterId.ts`.

### Step 2: Commit

```bash
git add packages/stories/raw/trainAdventure/docs/characters.md
git commit -m "feat(stories): add minimal characters.md for trainAdventure (mechanical extraction)"
```

---

## Task 8: Rewrite dontSaveMeBeforeMidnight compiler.config.ts

Convert from function-based to data-only format.

**Files:**
- Modify: `packages/stories/raw/dontSaveMeBeforeMidnight/compiler.config.ts`

### Step 1: Rewrite the file

```typescript
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'dont_save_me_before_midnight',
    defaultSpeakerId: 'narrator',
    suffixRegex:
        /(（內心）|\(內心\)|（内心）|的聲音|[?？！!。]+)$/g,
    rolePatterns: [
        { pattern: /^室友[A-Za-z]?$/, id: 'roommate' },
        { pattern: /^廣播(\u8072)?$/, id: 'announcement' },
        {
            pattern: /^(\u540C\u5B78[A-Za-z]?|\u9694\u58C1\u540C\u5B78)$/,
            id: 'student',
        },
        {
            pattern: /^(\u8B66\u5BDF[A-Za-z]?|\u8B66\u54E1)$/,
            id: 'police_officer',
        },
        {
            pattern:
                /^(\u8A0A\u606F|\u7C21\u8A0A|\u624B\u6A5F\u87A2\u5E55|\u7D19\u689D|\u533F\u540D\u8A0A\u606F)$/,
            id: 'message',
        },
        { pattern: /^.*\u8072\u97F3$/, id: 'voice' },
        { pattern: /^[?\uFF1F]{2,}$/, id: 'unknown' },
    ],
};

export default config;
```

### Step 2: Commit

```bash
git add packages/stories/raw/dontSaveMeBeforeMidnight/compiler.config.ts
git commit -m "refactor(stories): rewrite dontSaveMeBeforeMidnight compiler.config to data-only format"
```

---

## Task 9: Rewrite trainAdventure compiler.config.ts

Same conversion — remove `resolveCharacter` function, use data-only format with string IDs.

**Files:**
- Modify: `packages/stories/raw/trainAdventure/compiler.config.ts`

### Step 1: Rewrite the file

Keep the `canonicalize` map and `rolePatterns` array exactly as they are, but:
- Remove the `import { CharacterId, CharacterDirectory }` line
- Remove the `stripSuffix` function and `resolveCharacter` function
- Remove `SUFFIX_RE` (use default via `suffixRegex` override)
- Change all `id: CharacterId.X` references to `id: 'x'` (string)
- Remove the `resolveCharacter` from the config object

```typescript
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'train_adventure',
    defaultSpeakerId: 'narrator',
    suffixRegex:
        /(（內心）|\(內心\)|（内心）|的聲音|的喊聲|的低語|之聲|[?？！!。]+)$/g,
    canonicalize: {
        齋藤大輔: '斎藤大輔',
        史特林: '納撒尼爾·史特林',
        納撒尼爾史特林: '納撒尼爾·史特林',
        宇佐美警部: '宇佐美誠一郎',
        伊藤奈奈: '伊藤奈々',
        精靈劍士凱蘭: '凱蘭',
        '李明遠/斎藤浩一': '斎藤浩一',
        '林婉如/斎藤美香': '斎藤美香',
        '李杰**': '李杰',
        李杰的回覆: '李杰',
    },
    rolePatterns: [
        // Copy ALL role patterns from current file, changing
        // id: CharacterId.ElfGuard -> id: 'elf_guard', etc.
        // ... (all 30+ patterns from the current file)
    ],
};

export default config;
```

### Step 2: Commit

```bash
git add packages/stories/raw/trainAdventure/compiler.config.ts
git commit -m "refactor(stories): rewrite trainAdventure compiler.config to data-only format"
```

---

## Task 10: Compile Both Stories and Verify

### Step 1: Run the compiler

Run: `bun --filter stories run compile:stories`
Expected: No errors. Both stories compile successfully.

### Step 2: Verify generated output

Check that `packages/stories/src/generated/dontSaveMeBeforeMidnight/characters.ts` exists and contains the `CharacterId` enum with all 18 characters.

Check that `packages/stories/src/generated/trainAdventure/characters.ts` exists and contains all trainAdventure characters.

Check that scene files import from `'../characters'` (not `'../../../characters'`).

### Step 3: Run compile:check

Run: `bun run compile:check`
Expected: No diff (generated output matches committed output).

### Step 4: Commit generated output

```bash
git add packages/stories/src/generated/
git commit -m "feat(stories): generate per-story characters.ts for both stories"
```

---

## Task 11: Update Runtime types.ts

**Files:**
- Modify: `packages/stories/src/types.ts`

### Step 1: Change characterId to string

```typescript
// packages/stories/src/types.ts

export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    background?: string;
    portrait?: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

export type ChoiceOptionDefinition = {
    id: string;
    nextScene: string;
    label: string;
};

export type ChoiceDefinition = {
    prompt: string;
    options: ChoiceOptionDefinition[];
};

export type ChoiceMap = { [choiceId: string]: ChoiceDefinition };
```

Remove the `import type { CharacterId } from './characters'` line.

### Step 2: Commit

```bash
git add packages/stories/src/types.ts
git commit -m "refactor(stories): change DialogueEntry.characterId to string"
```

---

## Task 12: Update Runtime — BaseScene, NovelReader, Character, instances

**Files:**
- Modify: `packages/game/src/BaseScene.ts`
- Modify: `apps/web/src/components/NovelReader.svelte`
- Modify: `packages/game/src/characters/Character.ts`
- Modify: `packages/game/src/characters/instances.ts`
- Modify: `packages/game/src/characters/CharacterDirectory.ts`

### Step 1: Update BaseScene.ts

At line 322-325, remove `CharacterDirectory` fallback:

```typescript
// Before:
const info =
    character?.info ??
    (charId ? CharacterDirectory.getById(charId) : undefined);
let speaker = current.character ?? info?.name ?? charId;

// After:
let speaker = character?.info?.name ?? current.character ?? charId;
```

Remove the `CharacterDirectory` import if no longer used elsewhere in the file.

### Step 2: Update NovelReader.svelte

At the `getCharacterName` function (~line 50-75), remove the `CharacterDirectory.getById()` fallback and use the dialogue entry's `character` field instead:

```typescript
// Pass the entry's character field as an additional parameter or
// check entry.character before falling back to unknown.
// The function signature changes to accept the display name:
getCharacterName(characterId: string | undefined, fallbackName?: string): string {
    if (characterId) {
        const localizedName = ...characterNames?.[characterId];
        if (localizedName) return localizedName;
        if (fallbackName) return fallbackName;
        return t.reader.unknown;
    }
    return '';
}
```

Update the caller to pass `entry.character` as `fallbackName`.

Remove the `CharacterDirectory` import.

### Step 3: Update Character.ts

```typescript
// packages/game/src/characters/Character.ts

export class Character {
    readonly id: string;
    readonly name: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    get alias(): string {
        return this.name;
    }
}
```

Remove `CharacterDirectory` import. Remove `get info()`.

### Step 4: Update instances.ts

Import `CharacterId` and `characterTable` from the generated trainAdventure characters:

```typescript
// packages/game/src/characters/instances.ts
import { Character } from './Character';
import {
    CharacterId,
    characterTable,
} from '@aquila/stories/generated/trainAdventure/characters';

const create = (id: string) => {
    const info = characterTable[id];
    return new Character(id, info?.name ?? id);
};

export const characters = Object.fromEntries(
    Object.values(CharacterId).map(id => [id, create(id)])
) as Record<string, Character>;

export type CharacterMap = typeof characters;

export const narrator = characters[CharacterId.Narrator];
export const liJie = characters[CharacterId.LiJie];
// ... (rest of named exports stay the same)

export function getCharacter(id: string) {
    return characters[id];
}
```

### Step 5: Update CharacterDirectory.ts re-export

```typescript
// packages/game/src/characters/CharacterDirectory.ts
// This file previously re-exported from @aquila/stories global CharacterDirectory.
// Either delete it, or re-export from the generated trainAdventure characters.
export {
    CharacterDirectory,
    CharacterId,
    CharacterInfo,
} from '@aquila/stories/generated/trainAdventure/characters';
```

### Step 6: Run typecheck

Run: `bun --filter game typecheck && bun --filter web typecheck`
Expected: PASS (fix any remaining type errors)

### Step 7: Commit

```bash
git add packages/game/src/ apps/web/src/components/NovelReader.svelte
git commit -m "refactor(runtime): remove global CharacterDirectory dependency from runtime code"
```

---

## Task 13: Delete Global CharacterId.ts + Update Barrel Exports

**Files:**
- Delete: `packages/stories/src/characters/CharacterId.ts`
- Modify: `packages/stories/src/characters/index.ts`
- Modify: `packages/stories/src/index.ts`

### Step 1: Delete the global file

Delete `packages/stories/src/characters/CharacterId.ts`.

### Step 2: Update barrel exports

Update `packages/stories/src/characters/index.ts` — remove the re-export of the deleted file. If the file only re-exports CharacterId.ts, delete it or make it empty.

Update `packages/stories/src/index.ts` — remove `CharacterId`, `CharacterDirectory`, `CharacterInfo` from the barrel if they were re-exported.

### Step 3: Run typecheck across all workspaces

Run: `bun --filter stories typecheck && bun --filter game typecheck && bun --filter web typecheck`
Expected: PASS (fix any remaining import errors)

### Step 4: Commit

```bash
git add -A packages/stories/src/characters/ packages/stories/src/index.ts
git commit -m "refactor(stories): delete global CharacterId.ts, per-story enums replace it"
```

---

## Task 14: Update Tests

Update all tests that reference the global `CharacterId`, `CharacterDirectory`, or the old config interface.

**Files to check and update:**
- `packages/stories/src/__tests__/CharacterDirectory.test.ts` — delete or rewrite to test per-story generated directories
- `packages/stories/src/compiler/__tests__/emit.test.ts` — update for new `emitStory` signature
- `packages/stories/src/compiler/__tests__/resolve-assets.test.ts` — update PortraitPromptMap type
- `packages/stories/src/compiler/__tests__/parse-scene.test.ts` — update if it uses resolveCharacter
- `packages/stories/src/compiler/__tests__/validate.test.ts` — update portrait map type
- `packages/stories/src/compiler/__tests__/golden-trainadventure.test.ts` — update for new config format
- `packages/game/src/__tests__/Character.test.ts` — update Character constructor
- `packages/game/src/__tests__/instances.test.ts` — update for per-story CharacterId
- `packages/game/src/__tests__/CharacterDirectory.test.ts` — update or delete
- `packages/game/src/__tests__/BaseScene.test.ts` — update fixtures
- `apps/web/src/components/__tests__/NovelReader.test.ts` — update CharacterDirectory mock

### Step 1: Fix each test file

Go through each test file. The main changes:
- Replace `import { CharacterId } from '../characters'` with import from generated per-story file
- Replace `CharacterDirectory.getById()` calls with mock data or generated directory
- Update `Character` constructor calls to include name parameter
- Update `emitStory` calls to include `characterDir` parameter
- Update config objects to new data-only format

### Step 2: Run all tests

Run: `bun --filter stories test && bun --filter game test && bun --filter web test`
Expected: ALL PASS

### Step 3: Commit

```bash
git add -A
git commit -m "test: update all tests for per-story character enums"
```

---

## Task 15: Update writing-new-story Skill Docs

**Files:**
- Modify: `.agents/skills/writing-new-story/SKILL.md`

### Step 1: Update Step 2 section

Replace the current "Step 2: Add Characters" section. Characters are now defined in `characters.md`, not `CharacterId.ts`.

Key changes:
- Remove instructions to edit `packages/stories/src/characters/CharacterId.ts`
- Add instructions to add character sections to `raw/<storyName>/docs/characters.md` with `- **ID**:`, `- **Aliases**:`, and `### Portrait Prompts`
- Update compiler.config.ts instructions to the new data-only format
- Update troubleshooting section (unknown character → add to characters.md)
- Update the file reference table

### Step 2: Commit

```bash
git add .agents/skills/writing-new-story/SKILL.md
git commit -m "docs: update writing-new-story skill for per-story character definitions"
```

---

## Task 16: Final Verification

### Step 1: Run full test suite

Run: `bun test`
Expected: ALL PASS

### Step 2: Run lint

Run: `bun lint`
Expected: CLEAN

### Step 3: Run typecheck

Run: `bun --filter stories typecheck && bun --filter game typecheck && bun --filter web typecheck`
Expected: CLEAN

### Step 4: Run compile:check

Run: `bun run compile:check`
Expected: No diff

### Step 5: Final commit (if any fixes needed)

```bash
git add -A
git commit -m "fix: final cleanup for per-story character enums"
```
