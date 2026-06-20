# Per-Story Character Enums Design

## Problem

The global `packages/stories/src/characters/CharacterId.ts` is a 645-line monolith containing ALL characters from ALL stories — the enum (123 members), the name/alias table, and the `CharacterDirectory` lookup class. When writing a new story, the skill instructs agents to edit this global file, which is error-prone and couples stories together.

## Decision

Move character definitions into each story's `characters.md`. The compiler parses identity data (ID, display name, aliases) from the markdown and generates a per-story `characters.ts` with the enum and directory. No characters are shared across stories — each story is fully self-contained.

## Design

### 1. characters.md Format

Each character section gains two inline metadata bullets after the heading:

```markdown
## 1. 顧言（Gu Yan）

- **ID**: `gu_yan`
- **Aliases**: 小顧, 顧言同學

### Portrait Prompts
- **base**: anime visual-novel portrait...
```

Generic/role characters get minimal entries (no prose or portraits required):

```markdown
## 12. 旁白（Narrator）

- **ID**: `narrator`

## 13. 學生（Student）

- **ID**: `student`
- **Aliases**: 同學, 隔壁同學
```

**Parsing rules:**
- Display name: extracted from the `## N. Name（Romaji/Role）` heading (existing `HEADING_RE` pattern)
- ID: from `- **ID**: \`xxx\`` bullet (required — compiler throws if missing)
- Aliases: from `- **Aliases**: a, b, c` bullet (optional, comma-separated)
- Portrait prompts: from existing `### Portrait Prompts` section (unchanged)

### 2. Compiler Pipeline

**New parser: `parse-characters.ts`**

Replaces `parse-portraits.ts`. Single pass through characters.md extracts ID, display name, aliases, AND portrait prompts:

```typescript
interface ParsedCharacter {
    id: string;
    name: string;
    aliases: string[];
    portraits: Record<string, string>;
}

interface ParsedCharacterDirectory {
    characters: ParsedCharacter[];
    getIdByName(name: string): string | undefined;
    getById(id: string): ParsedCharacter | undefined;
}

function parseCharacters(markdown: string): ParsedCharacterDirectory
```

**StoryCompilerConfig — simplified to pure data:**

```typescript
interface StoryCompilerConfig {
    storyId: string;
    canonicalize?: Record<string, string>;
    rolePatterns?: { pattern: RegExp; id: string }[];
    defaultSpeakerId?: string;
    charactersDocPath?: string;
    suffixRegex?: RegExp;
}
```

The hand-written `resolveCharacter()` function is removed from config. The compiler builds it internally from the parsed directory + config data. The resolution algorithm (canonicalize -> exact lookup -> suffix strip -> retry -> role patterns) lives once in the compiler.

**compile.ts flow:**
1. Read characters.md -> `parseCharacters()` -> directory
2. Build `resolveCharacter` from directory + config's canonicalize/rolePatterns/suffixRegex
3. Parse scenes (same as before)
4. Resolve assets (portrait map comes from the same parse pass)
5. Generate `characters.ts` (enum + name/alias table + CharacterDirectory class)
6. Generate scene files (import from `../characters` instead of `../../../characters`)

**Generated `characters.ts`** per story:

```typescript
export enum CharacterId {
    Narrator = "narrator",
    GuYan = "gu_yan",
    ShaoQiming = "shao_qiming",
}

export interface CharacterInfo {
    id: string;
    name: string;
    aliases: string[];
}

export const characterTable: Record<string, CharacterInfo> = { ... };

export class CharacterDirectory {
    static getById(id: string): CharacterInfo | undefined { ... }
    static getIdByName(name: string): string | undefined { ... }
    static getAll(): CharacterInfo[] { ... }
}
```

Scene files reference `CharacterId.GuYan` (enum member), not raw strings. The runtime `DialogueEntry.characterId` is `string`, so any story's enum is assignable.

**IR change:** `DialogueEntryIR.characterId` and `ResolvedCharacter.id` change from `CharacterId` (enum) to `string`.

### 3. Runtime Changes

The generated `DialogueEntry` already carries `character: "顧言"` (display name) inline. The `CharacterDirectory` lookups in runtime code are redundant fallbacks.

**`types.ts`** — `characterId` becomes `string`:
```typescript
export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    background?: string;
    portrait?: string;
};
```

**`BaseScene.ts` (line 322-325)** — remove `CharacterDirectory` fallback:
```typescript
let speaker = character?.info?.name ?? current.character ?? charId;
```

**`NovelReader.svelte` (line 70)** — use `entry.character` as fallback instead of global `CharacterDirectory`.

**`Character.ts`** — takes `name` in constructor instead of directory lookup:
```typescript
export class Character {
    readonly id: string;
    readonly name: string;
    constructor(id: string, name: string) { ... }
}
```

**`instances.ts`** — imports `CharacterId` from generated trainAdventure `characters.ts`.

**Global `CharacterId.ts`** — deleted. Each story's generated `characters.ts` provides its own enum + `CharacterDirectory`.

### 4. Migration Plan

**dontSaveMeBeforeMidnight** — characters.md already exists with rich bios and portrait prompts. Add ID + aliases bullets to each section.

Characters to define (18 total):
- Named (11): `gu_yan`, `xu_xingtang`, `shao_qiming`, `han_yue`, `lin_zhuren`, `gu_ze`, `xu_mother`, `black_raincoat`, `roommate`, `female_voice`, `zhang_hao`
- Generic roles (7): `narrator`, `student`, `police_officer`, `message`, `announcement`, `voice`, `unknown`

**trainAdventure** — no characters.md exists. Create a minimal one with just headings + ID + aliases bullets (mechanically extracted from the current global `CharacterId.ts`). No prose or portrait prompts.

**Global `CharacterId.ts`** — deleted after both stories are self-contained.

**Execution order:**
1. Build `parse-characters.ts` + update compiler pipeline (config interface, resolution logic, emit)
2. Add ID/aliases metadata to dontSaveMeBeforeMidnight's `characters.md`
3. Create minimal `characters.md` for trainAdventure
4. Rewrite both `compiler.config.ts` to new data-only format
5. Compile both stories -> generates per-story `characters.ts`
6. Update runtime: `types.ts`, `BaseScene.ts`, `NovelReader.svelte`, `Character.ts`, `instances.ts`
7. Delete global `CharacterId.ts` + update barrel exports
8. Update tests
9. Update `orchestrating-stories` skill docs
