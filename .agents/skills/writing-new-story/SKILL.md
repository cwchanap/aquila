---
name: writing-new-story
description: Use when creating a new branching story for the Aquila game — writing markdown dialogue, setting up the compiler config, running the story compiler, filling in choice text, and wiring the story into the game and web app. Also use when adding new characters for a story or extending the branching tree of an existing story.
---

# Writing a New Story

## Overview

Stories are authored as **Chinese markdown** under `packages/stories/raw/<storyName>/`. A deterministic compiler (`bun compile:stories`) turns the markdown + folder structure into runtime TypeScript (dialogue maps, flow graphs, choice scaffolds). You then wire the generated output into the game and web app.

The **directory structure IS the branching graph**: `branch_*` subdirectories become player choices. The compiler is generic — any story with a `compiler.config.ts` is discovered automatically.

## Prerequisites

- All speakers in markdown must resolve to a `CharacterId` (defined in `packages/stories/src/characters/CharacterId.ts`)
- Bun runtime (runs TS directly)

## Workflow

```
Plan structure → Add characters → Write markdown → Create compiler config → Compile → Fill choice text → Wire to game → Verify
```

### Step 1: Plan the Story Structure

Decide on:
- **Story name**: camelCase directory name (e.g. `spaceOdyssey`)
- **Story ID**: snake_case registry key (e.g. `space_odyssey`)
- **Chapter structure**: how many chapters, how many acts per chapter
- **Branch tree**: how deep the branching goes, where choices happen

Directory layout convention:
```
raw/<storyName>/
  chapter_1/                      # First chapter
    act1.md                       # Opening acts
    act2.md
    act3.md                       # Last act before first choice
    branch_1a/                    # Choice option A
      act4.md
      act5.md
    branch_1b/                    # Choice option B
      act4.md
      actFinal.md                 # Terminal act
  chapter_2/                      # Second chapter (linked after chapter_1's last act)
    act1.md
    act2.md
```

For shorter stories without chapters, acts can live at the root level (backward compatible):
```
raw/<storyName>/
  act1.md                         # Opening acts (shared trunk)
  act2.md
  act3.md                         # Last act before first choice
  branch_1a/                      # Choice option A
    act4.md
    act5.md
    branch_2a/                    # Sub-choice under option A
      act6.md
    branch_2b/                    # Sub-choice under option A
      act6.md
  branch_1b/                      # Choice option B
    act4.md
    act5.md
    actFinal.md                   # Terminal act
```

**Rules:**
- Acts are named `act1.md`, `act2.md`, ..., `act10.md`, ..., `actFinal.md`, `actEpilogue.md`
- Chapter directories are named `chapter_1`, `chapter_2`, etc. — sorted numerically, linked sequentially
- Branch directories are named `branch_<level><letter>` (e.g. `branch_1a`, `branch_1b`, `branch_2c`)
- Letters sort alphabetically (a, b, c, ...) — this determines option order
- When a directory has `branch_*` children, its **last act** becomes a **choice point**
- When a directory has NO `branch_*` children, its last act either links to the next chapter (if present) or is **terminal** (story ends)
- Chapters are linked sequentially: the last act of chapter N points to the first act of chapter N+1
- Act numbers restart within each branch directory (siblings share numbering)
- Acts can also restart within each chapter directory
- Scene IDs are prefixed by chapter: `chapter_1/act1.md` → `ch1_act1`, `chapter_2/act3.md` → `ch2_act3`

### Step 2: Add Characters (if needed)

If your story introduces new characters:

1. Add entries to `packages/stories/src/characters/CharacterId.ts`:
   - Add the enum value: `MyCharacter = 'my_character'`
   - Add to the `CHARACTERS` map with `displayName` and `aliases` array

2. The `CharacterDirectory.getIdByName()` method automatically indexes all entries for reverse lookup.

Characters must exist before the compiler can parse your markdown.

#### Portrait Prompts (`docs/characters.md`)

For each character that appears on screen, define image-generation prompts in a portrait doc. By default this lives at `raw/<storyName>/docs/characters.md` (override the location with the optional `charactersDocPath` field in `compiler.config.ts`). Each character is a numbered `##` heading with a `（role）` suffix, followed by a `### Portrait Prompts` section listing one prompt per expression:

```markdown
## 1. 李杰（高中生）

A guarded teenager who keeps everyone at arm's length.

### Portrait Prompts

- **base**: 17yo boy, short black hair, school uniform, guarded expression
- **angry**: clenched jaw, narrowed eyes, fists balled at sides
- **sad**: downcast eyes, trembling lips, shoulders hunched
```

**Rules:**
- The section heading must appear exactly as `### Portrait Prompts`.
- Each prompt is `- **<key>**: <prompt>`. The `**base**` prompt is required — every other expression falls back to it.
- Expression keys are **case-insensitive**: written as `Angry` or `ANGRY`, they normalize to lowercase `angry`.
- **Multi-line prompts** are supported: continuation lines must be indented with **2 spaces**, and the compiler joins them into a single prompt string.
- Any other `###` subsection ends the portrait block.

### Step 3: Write the Markdown

Each `actN.md` file follows this format:

```markdown
# 第N幕：Scene Title

**旁白**：Narration text here.

**李杰**：(內心)Inner monologue here.

**CharacterName**：Dialogue text here.
```

**Format rules:**
- **H1 title** (`# ...`): First line, becomes scene metadata. Format: `# 第N幕：Title`
- **Separator**: Blank line between every paragraph
- **Dialogue lines**: `**SpeakerName**：Text` — speaker label in bold, followed by a **full-width colon** (`：`) or half-width colon (`:`)
- **Inner thoughts**: Keep parentheticals like `(內心)` or `（內心）` verbatim in the dialogue text — the runtime displays them
- **Narrator**: Use `**旁白**：` for narration
- All paragraphs must be valid `**name**：text` headers (unless `defaultSpeaker` is set in config, which treats non-header paragraphs as narration)

**Important:** The character name in bold must resolve to a `CharacterId`. If it doesn't, the compiler will throw an error with the file and the unknown name.

**Background image prompts** — a ` ```bg ` fenced block sets the background starting from the next dialogue entry. That background **persists** for all subsequent entries until another `bg` block changes it (standard visual-novel behaviour — you only need a new block when the scene/location shifts):

````markdown
```bg
train platform at night, cold blue lighting, empty platform
```

**李杰**：這裡是哪裡？

**旁白**：風很冷。

```bg
train interior, warm fluorescent lighting, empty seats
```

**李杰**：車裡好多了。
````

- A `bg` block applies starting from the **next** dialogue entry.
- The background **carries forward** to all following entries — no need to repeat it.
- Multiple `bg` blocks in one scene create distinct **sections** (indexed `s0`, `s1`, `s2`, …). Each section gets its own background image.
- **Multi-line prompts** are supported: every line inside the fence becomes part of the prompt.

**Expression override tags** — put a `[key]` between the bold name and the colon to override the portrait for that line:

```markdown
**李杰** [angry]：妳做什麼！
```

- The tag sits between `**Name**` and the colon: `**Name** [key]：`.
- It overrides the portrait expression for that specific dialogue entry.
- Keys must match entries in the character's Portrait Prompts section (case-insensitive).
- Unknown keys fall back to `base` (and emit a compiler warning — see Step 5).

**Combining both:**

````markdown
```bg
rooftop at dusk, warm orange light
```

**李杰** [scared]：這是什麼？
````

### Step 4: Create `compiler.config.ts`

Create `packages/stories/raw/<storyName>/compiler.config.ts`:

```typescript
import { CharacterId, CharacterDirectory } from '../../src/characters';
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'my_story',
    resolveCharacter: (name) => CharacterDirectory.getIdByName(name),
    // Optional: makes non-dialogue paragraphs render as Narrator lines
    // defaultSpeaker: { id: CharacterId.Narrator, displayName: '旁白' },
};

export default config;
```

**`resolveCharacter`** options:
- **Simple**: `CharacterDirectory.getIdByName` — resolves by display name or aliases
- **Advanced**: Custom function with canonicalization, suffix stripping, and role-pattern matching (see `raw/trainAdventure/compiler.config.ts` for the full example with 30+ role patterns)

**`defaultSpeaker`**: Set this if your markdown has non-dialogue paragraphs (forum posts, news articles, markers like `**<完>**`). Without it, the compiler fails on any paragraph that isn't a `**name**：text` header.

### Step 5: Run the Compiler

```bash
bun compile:stories
```

This discovers all `raw/<story>/compiler.config.ts` entries and generates:

| Output file | Purpose |
|---|---|
| `src/generated/<story>/scenes/<sceneId>.ts` | One `DialogueEntry[]` per scene — references `Portrait.*` and `Background.*` enums |
| `src/generated/<story>/portraits.ts` | `Portrait` enum mapping every `characterId/expression` key to an enum member (emitted when portrait prompts exist) |
| `src/generated/<story>/backgrounds.ts` | `Background` enum mapping every background key to an enum member (emitted when `bg` blocks exist) |
| `src/generated/<story>/dialogue.zh.ts` | `DialogueMap` index importing all scenes |
| `src/generated/<story>/flow.ts` | `FlowConfig` with scene graph + choice transitions |
| `src/generated/<story>/choices.todo.zh.ts` | Reference stub showing all choice/option IDs with TODO placeholders |
| `src/generated/<story>/image-assets.json` | All background + portrait image-generation prompts with their target file paths (emitted when portrait/background prompts are defined) |

Two choice-related files exist:
- **`choices.todo.zh.ts`** (generated, safe to delete/recreate): Lists every choice ID and option ID with TODO text. Use as a reference when filling in the real file.
- **`choices.zh.ts`** (hand-maintained, scaffolded once, never overwritten by compiler): Where you write the actual choice prompts and labels. The compiler creates this with empty strings on first run and leaves it untouched on subsequent runs.

**Scene IDs** are derived from the path:
- `act1.md` → `act1` (root-level, no chapters)
- `chapter_1/act1.md` → `ch1_act1` (inside a chapter)
- `branch_1b/act4.md` → `b1b_act4` (inside a branch)
- `chapter_1/branch_1a/act3.md` → `ch1_b1a_act3` (chapter + branch)

**If the compiler throws `unknown character`**: Add the missing character to `CharacterId.ts` and re-run.

**Asset warnings** (non-fatal — compilation succeeds regardless, emitted via `console.warn`):
- **Character without portrait prompts**: a character appears in the story but has no entry in `docs/characters.md`. No portrait is assigned for that character.
- **Unknown expression key**: an `[expression]` override doesn't match any key in that character's Portrait Prompts. The entry falls back to `base`.
- **Missing `docs/characters.md`**: if no portrait doc is found at all, the compiler skips portrait prompts entirely.

These warnings clear as you add the missing prompts and assets.

### Step 6: Fill In Choice Text

Edit `packages/stories/src/stories/<story>/choices.zh.ts`. Each choice has a `prompt` (the question) and `labels` (the option display text):

```typescript
export const myStoryChoiceText: ChoiceText = {
    choice_act3: {
        prompt: '你要下車嗎？',
        labels: {
            b1a: '下車探索',
            b1b: '留在車上',
        },
    },
};
```

Unfilled text surfaces as `TODO: ...` markers at runtime. The compiler **never overwrites** this file — it only scaffolds on first run.

### Step 7: Wire to the Game

**7a. Create the story `index.ts`**

Create `packages/stories/src/stories/<story>/index.ts`:

```typescript
import type { ChoiceMap, DialogueMap } from '../../types';
import type { FlowConfig } from '../../flow-types';
import { buildChoiceMap } from '../choice-utils';
import { myStoryZhDialogue } from '../../generated/myStory/dialogue.zh';
import { myStoryFlow, type MyStorySceneId } from '../../generated/myStory/flow';
import { myStoryChoiceText } from './choices.zh';

export { myStoryFlow };
export type { MyStorySceneId };
export type MyStoryFlowConfig = FlowConfig<MyStorySceneId>;

export type MyStoryLocale = 'en' | 'zh';

const dialogueByLocale: Record<MyStoryLocale, DialogueMap> = {
    zh: myStoryZhDialogue,
    en: myStoryZhDialogue, // TODO: real en source
};

const choices: ChoiceMap = buildChoiceMap(myStoryFlow, myStoryChoiceText);

export function getMyStoryStory(locale: string): {
    dialogue: DialogueMap;
    choices: ChoiceMap;
} {
    const normalized: MyStoryLocale = locale.startsWith('zh') ? 'zh' : 'en';
    return { dialogue: dialogueByLocale[normalized], choices };
}
```

Replace `MyStory`/`myStory`/`my_story` with your actual PascalCase/camelCase/snake_case names. The naming convention:
- **story name** (camelCase): `myStory` — used for file/directory names and export prefixes
- **story ID** (snake_case): `my_story` — used in the registry and `StoryId` enum
- **PascalCase**: `MyStory` — used for TypeScript type names

**7b. Register in the story registry**

Edit `packages/stories/src/stories/index.ts`:

1. Import your story:
   ```typescript
   import {
       getMyStoryStory,
       myStoryFlow,
       type MyStoryFlowConfig,
   } from './myStory';
   ```

2. Add to `StoryFlowConfig` type union:
   ```typescript
   export type StoryFlowConfig = TrainAdventureFlowConfig | MyStoryFlowConfig;
   ```

3. Add to both dictionaries:
   ```typescript
   const storyLoaders = {
       train_adventure: getTrainAdventureStory,
       my_story: getMyStoryStory,
   };
   const storyFlows = {
       train_adventure: trainAdventureFlow,
       my_story: myStoryFlow,
   };
   ```

**7c. Add to the `StoryId` enum**

Edit `apps/web/src/lib/story-types.ts`:

```typescript
export enum StoryId {
    TRAIN_ADVENTURE = 'train_adventure',
    MY_STORY = 'my_story',
}

export const STORY_NAMES: Record<StoryId, string> = {
    [StoryId.TRAIN_ADVENTURE]: 'Train Adventure',
    [StoryId.MY_STORY]: 'My Story',
};
```

### Step 8: Verify

```bash
bun compile:stories               # Re-run compiler (deterministic, no diff expected)
bun run compile:check             # CI guard: recompile + assert no diff in generated/ and stories/
bun --filter @aquila/stories test # Run story package tests (includes golden compile test)
bun --filter @aquila/stories typecheck  # Typecheck generated output
bun test                          # Full monorepo test suite
bun run lint                      # Lint check
```

The `compile:check` script is the CI no-diff guard — it recompiles and fails if committed generated output has drifted from source markdown. Run it before committing.

## Image Asset Workflow

Visual-novel images are driven end-to-end by the compiler. The flow is:

```
Write prompts in markdown + docs/characters.md
    -> Compile: compiler extracts prompts, assigns asset paths, emits image-assets.json
    -> Generate: image-generation agent reads the manifest, creates PNGs at the expected paths
    -> Verify: re-run the compiler; asset warnings clear once every referenced asset exists
```

1. **Author** — write ` ```bg ` blocks in scene markdown (Step 3) and `### Portrait Prompts` per character in `docs/characters.md` (Step 2).
2. **Compile** — `bun compile:stories` extracts every background/portrait prompt, dedupes by asset key, assigns a target file path, and writes `src/generated/<story>/image-assets.json` alongside the TypeScript output.
3. **Generate** — an image-generation agent reads `image-assets.json` and produces each PNG at its `path` (see asset conventions in Quick Reference).
4. **Verify** — re-run the compiler. The asset warnings (missing portrait prompts / unknown expressions) guide you toward completeness.

The manifest is a source of truth for both the prompts and where each rendered PNG must land.

## Quick Reference

### Markdown format
```markdown
# 第一幕：Title

**旁白**：Narration。

**李杰**：(內心)Thought。

**健談男大生**：Dialogue with full-width colon。
```

### File naming
| What | Pattern | Example |
|---|---|---|
| Act file | `act<N>.md` | `act1.md`, `act10.md` |
| Terminal act | `actFinal.md` | `actFinal.md` |
| Epilogue | `actEpilogue.md` | `actEpilogue.md` |
| Chapter dir | `chapter_<N>` | `chapter_1`, `chapter_2` |
| Branch dir | `branch_<level><letter>` | `branch_1a`, `branch_2c` |
| Scene ID (root) | `<act>` | `act1` |
| Scene ID (chapter) | `ch<N>_<act>` | `ch1_act1`, `ch2_act3` |
| Scene ID (branch) | `b<level><letter>_<act>` | `b1b_act4` |
| Scene ID (chapter+branch) | `ch<N>_b<level><letter>_<act>` | `ch1_b1a_act3` |
| Choice ID | `choice_<lastSceneId>` | `choice_b1b_act8` |
| Option ID | `b<level><letter>` | `b2a` |

### Asset paths
| What | Pattern | Example |
|---|---|---|
| Portrait | `<storyId>/characters/<characterId>/<expression>.png` | `dont_save_me_before_midnight/characters/gu_yan/determined.png` |
| Background | `<storyId>/backgrounds/<rawDirName>/<sceneId>_s<section>.png` | `dont_save_me_before_midnight/backgrounds/chapter_1/ch1_act4_s0.png` |

- Portrait paths use the character's **ID** (snake_case from `CharacterId` enum, e.g. `gu_yan`), **not** the display name. The expression key defaults to `base` when no `[override]` is given.
- Background paths embed the **raw directory name**: root-level scenes use `_root`, otherwise the source directory (e.g. `chapter_1`, `branch_1a`).
- `<section>` is a **zero-based** index that increments each time a new ` ```bg ` block appears in a scene (`s0` for the first, `s1` for the second, ...).

### Generated enums (`Portrait` / `Background`)

The compiler generates per-story enum files so scene files reference typed enum members instead of raw strings:

**`portraits.ts`** — emitted when any character has portrait prompts:
```typescript
export enum Portrait {
    GuYan_Base = "gu_yan/base",
    GuYan_Determined = "gu_yan/determined",
    // ...
}
```
- Enum key = `${CharacterIdEnumKey}_${CapitalizedExpression}` (e.g. `gu_yan` → `GuYan`, `determined` → `Determined` → `GuYan_Determined`).

**`backgrounds.ts`** — emitted when any scene has `bg` blocks:
```typescript
export enum Background {
    Chapter_1_Ch1_Act4_S0 = "chapter_1/ch1_act4_s0",
    // ...
}
```
- Enum key = each `/`- and `_`-separated segment capitalized and joined with `_` (e.g. `chapter_1/ch1_act4_s0` → `Chapter_1_Ch1_Act4_S0`).

Generated scene files import and reference these enums:
```typescript
import { Portrait } from '../portraits';
import { Background } from '../backgrounds';

export const scene: DialogueEntry[] = [
    { ..., background: Background.Chapter_1_Ch1_Act4_S0, portrait: Portrait.GuYan_Base },
];
```

Both files are compiler-owned — re-run `bun compile:stories` after adding or changing portrait/background prompts.

### Key files to touch when adding a story

| File | Action |
|---|---|
| `raw/<story>/chapter_<N>/act*.md` | Write markdown dialogue (inside chapter folders) |
| `raw/<story>/act*.md` | Or write at root level for chapterless stories |
| `raw/<story>/compiler.config.ts` | Create compiler config |
| `src/characters/CharacterId.ts` | Add new characters (if needed) |
| `src/stories/<story>/choices.zh.ts` | Fill choice prompts + labels |
| `src/stories/<story>/index.ts` | Create story loader |
| `src/stories/index.ts` | Register in dictionaries |
| `apps/web/src/lib/story-types.ts` | Add to `StoryId` enum |

## Common Mistakes

- **Unknown character error**: Every `**name**` in markdown must resolve. Check `CharacterId.ts` and add the character or an alias. Use the `canonicalize` map in `compiler.config.ts` for misspellings.
- **Wrong colon**: The compiler accepts both full-width `：` and half-width `:`, but the convention is full-width for Chinese text.
- **Missing blank lines**: Every dialogue paragraph must be separated by a blank line. Consecutive lines without a blank separator get merged.
- **Branch naming inconsistency**: Directories must be `branch_<number><letter>`. Sorting determines option order (`branch_1a` before `branch_1b`).
- **Forgetting to register**: After compiling, the story won't appear in the game until you add it to `stories/index.ts` AND `story-types.ts`.
- **Editing generated files**: Everything under `src/generated/` is compiler-owned. Re-run `bun compile:stories` after any markdown change. Never edit generated files by hand.
- **Empty choices**: The `choices.zh.ts` file is scaffolded with empty strings. Fill in real prompt/label text — unfilled entries show as `TODO: ...` at runtime.
