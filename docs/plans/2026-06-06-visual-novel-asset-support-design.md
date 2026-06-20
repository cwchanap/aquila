# Visual Novel Asset Support — Compiler & Writing Skill

**Date:** 2026-06-06
**Status:** Approved
**Scope:** Story compiler extensions + orchestrating-stories skill updates

## Problem

The game currently has no visual novel image support driven by authored content. Backgrounds are 3 hardcoded legacy entries in `PreloadScene.ts` (not wired to compiler scene IDs). Character portraits don't exist at all. We need writers to specify AI image generation prompts for backgrounds and portraits during story writing, with the compiler producing both an asset manifest (for image generation) and runtime asset references (for the game).

## Design Decisions

| Decision | Choice |
|---|---|
| Prompt type | AI image generation text prompts |
| Background granularity | Per section within a scene (writer decides boundaries) |
| Portrait granularity | Base per character + per-entry expression overrides |
| Base portrait location | `characters.md` under story's `docs/` folder |
| Background format in markdown | ` ```bg ` fenced metadata block (with closing ` ``` `) |
| Expression override format | `**Name** [key]: dialogue` |
| Expression key resolution | Key maps to named prompt in `characters.md` |
| Compiled output approach | Optional `background?` and `portrait?` asset keys on every `DialogueEntry` |
| Asset path scheme | Auto-derived from character name / raw directory name |
| Missing asset behavior | Warning (not error) |
| Manifest format | JSON (`image-assets.json`) |

## Section 1: Markdown Format Changes

### 1.1 Background Sections

A scene (act file) can be divided into visual sections using ` ```bg ` fenced code blocks. Each block starts a new section and provides the background image prompt for all entries until the next ` ```bg ` block or end of file.

Example:

```md
# 第五幕：意外的同行者

**旁白**：寂海車站的月台上，李杰剛踏上冰冷的水泥地面...

**李杰**：(語氣疑惑)妳...為什麼要跟下來？

**文靜少女**：(低著頭)我...我不知道...

```bg
車站內部，日光燈閃爍，冷色調，空無一人
```

**李杰**：這裡不太對勁...

**文靜少女**：我們快走...
```

Rules:

- The ` ```bg ` block content (between opening ` ```bg ` and closing ` ``` `) is the full prompt. Can be multi-line.
- Entries before the first ` ```bg ` block have no `background` key (consumer uses default/fallback).
- Each ` ```bg ` block applies to all subsequent entries until the next one or end of file.
- Multiple ` ```bg ` blocks in one file = multiple sections with background transitions.
- The closing ` ``` ` tag is required. The parser reads from ` ```bg ` until the closing ` ``` `.

### 1.2 Portrait Expression Overrides

A bracketed expression key can appear immediately after the bold speaker name, before the colon:

```md
**李杰** [angry]：妳到底在做什麼！

**文靜少女** [scared]：我...我不知道...
```

Rules:

- The expression key (e.g. `angry`, `scared`) must match a named expression defined for that character in `characters.md`.
- If the key is not found, the compiler **warns** and falls back to the character's `base` portrait.
- Lines without an override use the character's `base` portrait.
- Expression keys are case-insensitive (normalized to lowercase).
- Parser regex changes from `/^\*\*(.+?)\*\*[:]\s*([\s\S]*)$/` to `/^\*\*(.+?)\*\*(?:\s*\[([^\]]+)\])?[:]\s*([\s\S]*)$/`

## Section 2: `characters.md` Portrait Prompt Format

### 2.1 New Section Per Character

Each character in `characters.md` gets a new `### Portrait Prompts` subsection. The compiler parses this to build a lookup table: `{ [CharacterId]: { [expressionKey]: promptString } }`.

```md
## 1. 顧言（Gu Yan）

### 基本資料
（existing content...）

### Portrait Prompts

- **base**: 17-year-old Chinese boy, short messy black hair, pale skin, dark school uniform with collar up, guarded and emotionally flat expression, muted earth tones, semi-realistic anime style, upper body portrait
- **angry**: same character, clenched jaw, narrowed eyes, tense shoulders, fists clenched at sides
- **scared**: wide eyes, pale, lips slightly parted, shoulders drawn up, leaning back
- **sad**: downcast eyes, slightly trembling lips, slumped posture

### 說話風格
（existing content...）
```

### 2.2 Parser Rules

1. Find each `## N. Name（English Name）` heading.
2. Under each character, look for a `### Portrait Prompts` heading.
3. Parse the `- **key**: prompt text` list items.
4. Resolve the character name from the heading to a `CharacterId` via the story's `resolveCharacter` function (from `compiler.config.ts`).
5. Result: `PortraitPromptMap` — `Record<CharacterId, Record<string, string>>`.

### 2.3 Requirements

- Every character that appears in act markdown should have at least a `base` prompt.
- If a character has no `### Portrait Prompts` section, the compiler **warns** (not errors).
- Expression keys are case-insensitive (normalized to lowercase).
- Prompts can be in any language (English recommended for AI image generation compatibility).
- The `### Portrait Prompts` heading is always in English so the parser can find it regardless of document language.

## Section 3: Compiler Pipeline & Output

### 3.1 Asset Path Conventions

**Portraits**: `<storyId>/characters/<characterName>/<expression>.png`
```
train_adventure/characters/李杰/base.png
train_adventure/characters/李杰/angry.png
train_adventure/characters/李杰/scared.png
```

**Backgrounds**: `<storyId>/backgrounds/<rawDirName>/<sceneId>_s<section>.png`
```
train_adventure/backgrounds/_root/act5_s0.png
train_adventure/backgrounds/branch_1a/b1a_act4_s0.png
train_adventure/backgrounds/branch_1b/branch_2c/b1b_b2c_act9_s0.png
```

- `rawDirName` is the immediate parent directory name from the raw source tree.
- Root-level `.md` files use `_root` as the directory name.
- Nested directories use their full relative path (e.g. `branch_1b/branch_2c`).

### 3.2 Asset Keys in DialogueEntry

Keys are path-relative-to-asset-type:

```ts
export type DialogueEntry = {
    character?: string;
    characterId?: CharacterId;
    dialogue: string;
    background?: string;    // e.g. "branch_1a/b1a_act4_s0"
    portrait?: string;       // e.g. "李杰/angry"
};
```

Consumer resolves:
- `entry.background` → `/assets/<storyId>/backgrounds/<key>.png`
- `entry.portrait` → `/assets/<storyId>/characters/<key>.png`

**Every entry** carries its active background and portrait key (not just transition entries). Consumer detects changes by comparing to the previous entry's key.

### 3.3 Asset Manifest: `generated/<story>/image-assets.json`

```json
{
  "storyId": "train_adventure",
  "backgrounds": [
    { "key": "_root/act5_s0", "path": "train_adventure/backgrounds/_root/act5_s0.png", "prompt": "車站月台，冷色調" },
    { "key": "branch_1a/b1a_act4_s0", "path": "train_adventure/backgrounds/branch_1a/b1a_act4_s0.png", "prompt": "車站內部，日光燈閃爍" }
  ],
  "portraits": [
    { "key": "李杰/base", "path": "train_adventure/characters/李杰/base.png", "prompt": "17yo Chinese boy, short black hair..." },
    { "key": "李杰/angry", "path": "train_adventure/characters/李杰/angry.png", "prompt": "same character, clenched jaw, narrowed eyes..." }
  ]
}
```

This manifest is consumed by an image generation agent to produce the actual PNG files at the listed paths.

### 3.4 Compiler Pipeline

```
raw/<story>/*.md + docs/characters.md + compiler.config.ts
        |
        v  parse-portraits.ts   -> PortraitPromptMap (CharacterId -> { expression -> prompt })
        v  parse-scene.ts       -> DialogueEntryIR[] (with bg sections + expression tags parsed)
        v  resolve-assets.ts    -> Assign bg/portrait keys to EVERY entry, build manifest
        v  build-graph.ts       -> StoryGraph (unchanged)
        v  validate.ts          -> Integrity checks + missing asset warnings
        v  emit.ts              -> generated/<story>/{scenes/*.ts, dialogue.zh.ts, flow.ts, image-assets.json}
```

### 3.5 New Module: `parse-portraits.ts`

Parses `raw/<story>/docs/characters.md` into a `PortraitPromptMap`.

```ts
export type PortraitPromptMap = Record<CharacterId, Record<string, string>>;

export function parsePortraits(
    charactersMdPath: string,
    resolveCharacter: (name: string) => ResolvedCharacter | undefined
): PortraitPromptMap;
```

- Finds `## N. Name（English）` headings, resolves via `resolveCharacter`.
- Finds `### Portrait Prompts` section, parses `- **key**: prompt` items.
- Returns the lookup table.
- Called once per story at the start of `compileStory()`, passed to `parseScene()`.

### 3.6 New Module: `resolve-assets.ts`

Takes parsed IR + portrait map, produces two things:

1. **Enriched entries**: Every `DialogueEntryIR` gets `background` and `portrait` keys assigned.
   - `background`: The section's bg key (e.g., `"branch_1a/b1a_act4_s0"`). Entries before the first ` ```bg ` block get `undefined`.
   - `portrait`: `"<characterName>/<expression>"` — `base` by default, override when `[expression]` is specified. Narrator or characters without portrait definitions get `undefined`.

2. **Asset manifest data**: Deduplicated list of all unique `{ key, path, prompt }` entries for backgrounds and portraits.

### 3.7 Changes to `parse-scene.ts`

1. **` ```bg ` blocks**: When a fenced code block with language `bg` is encountered (from opening ` ```bg ` to closing ` ``` `), its content becomes the `backgroundPrompt` for the next section. The parser carries a `pendingBg` state — subsequent dialogue entries are associated with this background.

2. **Expression override in speaker header**: The regex expands to capture an optional `[expression]` tag. The parser stores the expression key for later resolution in `resolve-assets.ts`.

### 3.8 IR Changes (`ir.ts`)

```ts
export interface DialogueEntryIR {
    characterId: CharacterId;
    displayName: string;
    dialogue: string;
    background?: string;       // asset key, resolved in resolve-assets.ts
    portrait?: string;          // asset key, resolved in resolve-assets.ts
    expressionKey?: string;     // raw [key] from markdown, before resolution (internal only)
}
```

No changes to `SceneIR`, `ChoiceIR`, or `StoryIR`.

### 3.9 Config Changes (`config.ts`)

```ts
export interface StoryCompilerConfig {
    storyId: string;
    resolveCharacter: (name: string) => ResolvedCharacter | undefined;
    defaultSpeaker?: ResolvedCharacter;
    charactersDocPath?: string; // NEW — defaults to 'docs/characters.md'
}
```

### 3.10 Emitter Changes (`emit.ts`)

- Per-scene `.ts` files now include `background` and `portrait` fields when present.
- New output: `generated/<story>/image-assets.json` manifest file.
- Omitted when `undefined` — existing stories without prompts produce identical scene output.

### 3.11 Validation Changes (`validate.ts`)

- **Warning**: If a character appears in the story but has no `### Portrait Prompts` section.
- **Warning**: If an expression key `[xyz]` is used but `xyz` is not defined for that character.
- **Warning**: If a referenced image file doesn't exist in `packages/assets/media/<storyId>/`.

All warnings, not errors — existing stories without visual novel support continue to compile cleanly.

### 3.12 Generated Scene Example

```ts
export const scene: DialogueEntry[] = [
    { characterId: CharacterId.Narrator, character: "旁白", dialogue: "...",
      background: "branch_1a/b1a_act4_s0" },
    { characterId: CharacterId.LiJie, character: "李杰", dialogue: "...",
      background: "branch_1a/b1a_act4_s0", portrait: "李杰/base" },
    { characterId: CharacterId.LiJie, character: "李杰", dialogue: "...",
      background: "branch_1a/b1a_act4_s0", portrait: "李杰/angry" },
    { characterId: CharacterId.LiJie, character: "李杰", dialogue: "...",
      background: "branch_1a/b1a_act4_s1", portrait: "李杰/base" },
];
```

## Section 4: Runtime Type Changes

### 4.1 `DialogueEntry` Extension

`packages/stories/src/types.ts`:

```ts
export type DialogueEntry = {
    character?: string;
    characterId?: CharacterId;
    dialogue: string;
    background?: string;    // asset key for background image
    portrait?: string;       // asset key for character portrait image
};
```

Both fields are optional. All existing code that destructures `DialogueEntry` continues to work unchanged.

### 4.2 Consumer Behavior (Future — Not In Scope)

- **Backgrounds**: Consumer compares `entry.background` to previous entry's value. When different, triggers a background image transition.
- **Portraits**: Consumer compares `entry.portrait` to previous. When different, swaps the displayed portrait.
- Resolution: `entry.background` → `/assets/<storyId>/backgrounds/<key>.png`, `entry.portrait` → `/assets/<storyId>/characters/<key>.png`.

### 4.3 Out of Scope

- Actual image generation from prompts
- Phaser/Svelte rendering of backgrounds and portraits
- Asset file management / loading pipeline
- Changes to `SceneDirectory`, `PreloadScene`, `BaseScene`, `ReaderManager`, or `NovelReader.svelte`

## Section 5: Writing Skill Updates

### 5.1 Implementation Note

**Load the `writing-skills` skill before editing `orchestrating-stories/SKILL.md`.** This ensures proper skill authoring conventions are followed.

### 5.2 Step 2 (Add Characters) — Extended

After adding the character to `CharacterId.ts`, the writer must also add a `### Portrait Prompts` section to `docs/characters.md`:

```md
## N. 角色名（English Name）

（existing sections...）

### Portrait Prompts

- **base**: [English AI image gen prompt for the character's default portrait]
- **angry**: [prompt for angry expression, if used in the story]
- **sad**: [prompt for sad expression, if used in the story]
```

Instruction: "Add at minimum a `base` portrait. Add expression variants only for emotions that appear in the story with `[expression]` tags."

### 5.3 Step 3 (Write Markdown) — Extended

Two new format elements documented:

1. **Background sections** — ` ```bg ` fenced blocks (with closing ` ``` `) divide a scene into visual sections:

```md
**旁白**：第一段...

```bg
月台夜景，冷色調
```

**旁白**：第二段（背景切換）...
```

2. **Expression overrides** — `[key]` after speaker name:

```md
**李杰** [angry]：妳到底在做什麼！
```

Key must match a named expression in that character's Portrait Prompts in `characters.md`.

### 5.4 Step 5 (Run Compiler) — Extended

Document the new `image-assets.json` output:
- After compilation, `generated/<story>/image-assets.json` lists all images needed.
- The compiler prints warnings for missing image files in `packages/assets/media/<storyId>/`.
- These missing images should be generated by an image generation agent using the prompts from the manifest.

### 5.5 New Section: Image Asset Workflow

```md
## Image Asset Workflow

Write prompts in markdown + characters.md
    -> Compile: compiler extracts prompts, assigns paths, emits image-assets.json
    -> Generate: image generation agent reads manifest, creates PNGs at expected paths
    -> Verify: re-run compiler, warnings clear when all assets exist
```

### 5.6 Out of Scope for Skill Updates

- No changes to `reviewing-written-stories` skill.
- No changes to `notion-story-export` skill (Notion source doesn't have image directives; prompts are added after export).
