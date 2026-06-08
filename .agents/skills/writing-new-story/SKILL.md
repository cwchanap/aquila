---
name: writing-new-story
description: Use when creating a new branching story, adding a new chapter to an existing story, adding new characters, or extending the branching tree of an existing story. Also use when the task involves `packages/stories/raw/` markdown dialogue or `bun compile:stories`.
---

# Writing a New Story

## Overview

Stories are authored as **Chinese markdown** under `packages/stories/raw/<storyName>/`. A deterministic compiler (`bun compile:stories`) turns the markdown + folder structure into runtime TypeScript (dialogue maps, flow graphs, choice scaffolds). You then wire the generated output into the game and web app.

The **directory structure IS the branching graph**: `branch_*` subdirectories become player choices. The compiler is generic — any story with a `compiler.config.ts` is discovered automatically.

## Prerequisites

- All speakers in markdown must resolve to a character defined in `raw/<storyName>/docs/characters.md`
- Bun runtime (runs TS directly)

## Workflow

```
Plan structure → Add characters → Plan act breakdown → Delegate writing to subagents → Create compiler config → Compile → Review & fix → Fill choice text → Wire to game → Verify
```

**Important:** The main agent should focus on planning the act breakdown (mapping scenes to acts, deciding batch sizes). The actual writing of each act's markdown dialogue should be **delegated to subagents** using the Task tool (see Step 3b).

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

Characters are defined per-story in `raw/<storyName>/docs/characters.md`. Each character is a `##`-level heading with metadata bullets. The compiler parses this file to generate a per-story `characters.ts` (enum + directory + portrait prompts).

1. Add a character heading with ID and aliases:
   ```markdown
   ## 1. 李杰（Li Jie）

   - **ID**: `li_jie`
   - **Aliases**: 男主角

   Optional bio prose here.
   ```

2. For characters that appear on screen, add portrait prompts in a `### Portrait Prompts` subsection:
   ```markdown
   ### Portrait Prompts

   - **base**: 17yo boy, short black hair, school uniform, guarded expression
   - **angry**: clenched jaw, narrowed eyes, fists balled at sides
   - **sad**: downcast eyes, trembling lips, shoulders hunched
   ```

3. For generic/role speakers (narrator, crowd, unnamed NPCs), add minimal entries with just an ID:
   ```markdown
   ## N. 旁白（Narrator）

   - **ID**: `narrator`
   ```

**Rules:**
- The heading must follow the pattern `## N. DisplayName（Romaji）` with full-width parens.
- The `- **ID**: \`snake_case_id\`` bullet is required for every character.
- The `- **Aliases**: name1, name2` bullet is optional (comma-separated).
- The `### Portrait Prompts` section is optional (only for characters with portraits).
- Characters must exist in `characters.md` before the compiler can parse your markdown.

#### Portrait Prompts

- The section heading must appear exactly as `### Portrait Prompts`.
- Each prompt is `- **<key>**: <prompt>`. The `**base**` prompt is required — every other expression falls back to it.
- Expression keys are **case-insensitive**: written as `Angry` or `ANGRY`, they normalize to lowercase `angry`.
- **Multi-line prompts** are supported: continuation lines must be indented with **2 spaces**, and the compiler joins them into a single prompt string.
- Any other `###` subsection ends the portrait block.

### Step 3a: Plan the Act Breakdown

Before writing any markdown, create a mapping from the story plan's scenes to act files:

1. **Read the story plan** (e.g. `docs/chapter_2_plan.md`) to understand each scene's content, time, and location.
2. **Map scenes 1:1 to acts** — typically one act per scene. If a scene is very long, consider splitting into two acts. Keep the mapping explicit (e.g. scene 1 → act1, scene 2 → act2).
3. **Identify character needs** — list any new characters or speaker roles that appear in the planned scenes and aren't yet in `docs/characters.md`.
4. **Group acts into batches** for parallel subagent dispatch (typically 3-4 acts per batch). Batch by narrative arc when possible (e.g. morning scenes together, evening scenes together).
5. **Note key constraints** per batch: POV character, time of day, specific plot beats that must land, items/props introduced, foreshadowing to plant.

Output: A table like:

| Act | Scene | Time | Location | Key beats |
|---|---|---|---|---|
| act1 | Awakening | 07:05 | Dorm | Wakes remembering death, loop confirmed |
| act2 | ... | ... | ... | ... |

### Step 3b: Delegate Writing to Subagents

Dispatch parallel subagents to write the actual markdown. Each subagent handles a batch of acts (typically 3-4).

**Dispatch pattern:**
- Use the Task tool with `subagent_type: "general"` for each batch, sent in parallel
- Each subagent must load this skill (`writing-new-story`) to learn the markdown format
- Provide the preceding act's content for continuity across batch boundaries

**Each subagent prompt must include:**
1. Which acts to write (filenames + brief scene descriptions)
2. Reference files to read first (characters.md, chapter plan, previous act, compiler.config.ts)
3. Key constraints (Traditional Chinese, POV rules, story-specific rules from the plan)
4. Instructions to report back: files written, characters added, deviations from plan

See `subagent-prompt-template.md` in this skill's directory for the full prompt template.

**Post-writing review:**
After all subagents complete, run a review pass:
1. `bun compile:stories` — fix missing characters and format errors
2. Check for POV violations across batch boundaries
3. Check consistency of props/descriptions across acts by different subagents
4. Check for simplified Chinese characters
5. Optionally dispatch a dedicated review subagent for continuity checking

### Step 3c: Markdown Format Reference

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

**Important:** The character name in bold must resolve to a character ID defined in `docs/characters.md`. If it doesn't, the compiler will throw an error with the file and the unknown name.

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
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'my_story',
    // Optional: makes non-dialogue paragraphs render as Narrator lines
    defaultSpeakerId: 'narrator',
};

export default config;
```

**Optional config fields:**
- **`canonicalize`**: A map of misspelled/verbose source labels → clean canonical name. Example: `{ '齋藤大輔': '斎藤大輔' }`
- **`rolePatterns`**: Array of `{ pattern: RegExp, id: string }` for anonymous/role speakers that collapse to one character ID. Example: `{ pattern: /^路人[甲乙]?$/, id: 'passerby' }`
- **`suffixRegex`**: Override the default suffix-stripping regex for inner-thought/voice markers. Default: strips `（內心）`, `的聲音`, punctuation, etc.
- **`charactersDocPath`**: Override path to characters.md (default: `'docs/characters.md'`).
- **`defaultSpeakerId`**: Set this if your markdown has non-dialogue paragraphs (forum posts, news articles, markers like `**<完>**`). The ID must exist in `characters.md`.

The compiler builds character resolution internally from `characters.md` + these config fields. You never write a `resolveCharacter` function — the data drives everything.

### Step 5: Run the Compiler

```bash
bun compile:stories
```

This discovers all `raw/<story>/compiler.config.ts` entries and generates:

| Output file | Purpose |
|---|---|
| `src/generated/<story>/characters.ts` | Per-story `CharacterId` enum, `CharacterInfo` interface, `characterTable`, and `CharacterDirectory` class |
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

**If the compiler throws `unknown character`**: Add the missing character to `raw/<storyName>/docs/characters.md` with an `- **ID**: \`...\`` bullet and re-run.

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

- Portrait paths use the character's **ID** (snake_case from `characters.md`, e.g. `gu_yan`), **not** the display name. The expression key defaults to `base` when no `[override]` is given.
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
| `raw/<story>/docs/characters.md` | Define characters (ID, aliases, portrait prompts) |
| `raw/<story>/chapter_<N>/act*.md` | Write markdown dialogue (inside chapter folders) |
| `raw/<story>/act*.md` | Or write at root level for chapterless stories |
| `raw/<story>/compiler.config.ts` | Create compiler config |
| `src/stories/<story>/choices.zh.ts` | Fill choice prompts + labels |
| `src/stories/<story>/index.ts` | Create story loader |
| `src/stories/index.ts` | Register in dictionaries |
| `apps/web/src/lib/story-types.ts` | Add to `StoryId` enum |

## Common Mistakes

- **Writing acts yourself instead of delegating**: Plan the act breakdown, then delegate writing to subagents. Writing directly causes context overflow for chapters with 6+ acts.
- **Unknown character error**: Every `**name**` in markdown must resolve. Add the character to `characters.md` with an `- **ID**:` bullet. For misspellings, use the `canonicalize` map in `compiler.config.ts`.
- **Forgetting to register**: After compiling, the story won't appear in the game until you add it to `stories/index.ts` AND `story-types.ts`.
- **Editing generated files**: Everything under `src/generated/` is compiler-owned. Re-run `bun compile:stories` after any markdown change.
