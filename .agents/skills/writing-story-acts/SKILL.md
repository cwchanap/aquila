---
name: writing-story-acts
description: Use when writing actual act markdown dialogue for an Aquila story — formatting, style, character resolution. Loaded by writing subagents dispatched by the orchestrator (writing-new-story skill).
---

# Writing Story Acts

## Overview

You are a **writing subagent**. The orchestrator (main agent using the `writing-new-story` skill) has already:
- Created the story directory structure under `packages/stories/raw/<storyName>/`
- Defined all characters in `docs/characters.md`
- Planned the act breakdown (mapping scenes → act files)
- Assigned you specific act files to write

**Your job:** Write the markdown dialogue for your assigned acts. Follow the format, style, and character-resolution rules below. Do NOT create directories, edit `compiler.config.ts`, run the compiler, or wire anything — those are the orchestrator's responsibility.

## Prerequisites

Before writing, the orchestrator must provide:
- The story name and which act files to write (full paths)
- Reference files to read (see Step 1)
- Any story-specific constraints (POV character, plot beats, items/props)

If any prerequisite is missing, ask the orchestrator before proceeding.

## Step 1: Read These First

Read ALL of these before writing any dialogue:

1. **`packages/stories/raw/<storyName>/docs/characters.md`** — every speaker ID, alias, and voice definition. Every `**name**` you write must resolve here.
2. **The chapter/act plan** (e.g. `docs/chapter_N_plan.md`) — the source of truth for scene content, time, location, and required plot beats.
3. **The previous act** (if you're not writing the first in a batch) — for voice/POV/prop continuity across the seam.
4. **One reference act from the canon** — `packages/stories/raw/dontSaveMeBeforeMidnight/chapter_1/act1.md` is the house voice reference. Read it first to calibrate tone.

## Step 2: Markdown Format

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
- All paragraphs must be valid `**name**：text` headers (unless `defaultSpeakerId` is set in the orchestrator's `compiler.config.ts`, which treats non-header paragraphs as narration — ask the orchestrator if unsure)

**Important:** The character name in bold must resolve to a character ID or alias defined in `docs/characters.md`. If it doesn't, the compiler will throw an error. Do NOT invent speaker names — if a scene needs a new speaker, flag it to the orchestrator.

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
- Keys must match entries in the character's Portrait Prompts section in `characters.md` (case-insensitive).
- Unknown keys fall back to `base` (and emit a compiler warning).

**Combining both:**

````markdown
```bg
rooftop at dusk, warm orange light
```

**李杰** [scared]：這是什麼？
````

## Step 3: Style Guide (New Adult 18-25)

Stories target **New Adult readers (18-25)** — college/early-career protagonists, adult themes, contemporary Taiwanese setting. The existing canon (`dontSaveMeBeforeMidnight`, `trainAdventure`) defines the house style; mimic it.

**Voice — mixed register:**
- ✅ **Narrator** may use sensory metaphors and elevated imagery (`像一具剛解凍的木偶`, `像沒充飽電的手機`)
- ✅ **Protagonist inner voice** is clipped, fragmentary, blunt (`又是校慶。` / `做夢了吧。` / `帥。`)
- ❌ Not YA-earnest, not adult-literary-remote. Aim for "smart enough to be lyrical, insecure enough to mock itself"
- ❌ No authorial exposition — reveal only what the POV character perceives

**Pacing — mobile-reading rhythm:**
- ✅ **Standalone one-line paragraphs for emphasis** (`07:05。` / `鐘樓。` / `然後是一隻手。`)
- ✅ Long sensory accumulations in narrator beats, broken by short inner-monologue punches
- ✅ One beat per paragraph — never pack multiple ideas into one `**旁白**：` block
- ❌ No purple prose blocks; no wall-of-text inner monologue

**POV — third-person close:**
- ✅ Locked to one POV character's perception per scene
- ✅ Filter every description through their sensory/emotional state
- ❌ Never reveal information the POV character can't perceive (no omniscient cuts to other characters' thoughts)

**Tone — dry, melancholic, self-aware:**
- ✅ Deadpan humor at protagonist's expense (the canon's `帥。` after describing a haggard reflection)
- ✅ Melancholic undertone permitted; maudlin is not
- ❌ No slapstick, no meme humor, no dad-joke tone

**References — modern but timeless:**
- ✅ Taiwanese school/campus texture (宿舍、食堂、校慶、關東煮、豆漿、騎樓)
- ✅ Generic modern devices (手機、簡訊、螢幕) — no brand names or app names unless diegetically required
- ❌ No internet slang, no memes, no trend-of-the-moment references (they date the text)

**Reference examples:** `packages/stories/raw/dontSaveMeBeforeMidnight/chapter_1/act1.md` (narrator + inner voice balance), `chapter_3/act2.md` (sustained inner-monologue investigation).

## Step 4: Character Resolution

The orchestrator maintains `docs/characters.md` and may configure `canonicalize` / `rolePatterns` in `compiler.config.ts`. As a writer, you only need to know:

- **Use the character's display name or alias exactly as it appears in `characters.md`.** The heading format is `## N. DisplayName（Romaji）` with an optional `- **Aliases**: name1, name2` bullet. Either the display name or any alias works in your `**Name**：` tags.
- **For misspellings or variant spellings**, do NOT fix them yourself — ask the orchestrator to add a `canonicalize` mapping in `compiler.config.ts`. This keeps the source markdown clean.
- **For anonymous/role speakers** (路人甲, 學生A, 神祕女聲), use the label as-is. If the label recurs, the orchestrator may have set up a `rolePatterns` rule to collapse it to a single ID; if you're unsure, ask.
- **Narrator** is always `**旁白**：`. The display name `旁白` must exist in `characters.md` (typically with ID `narrator`).

## Common Mistakes

- **Inventing speaker names**: Every `**name**` must resolve to `characters.md`. If a scene needs a new speaker, flag it to the orchestrator — don't invent.
- **Simplified Chinese characters**: Write in Traditional Chinese (繁體中文) only. NO simplified characters.
- **Drifting from the plan**: Follow the plan document strictly — don't add, remove, or reorder scenes. If the plan seems wrong, flag it; don't silently "fix" it.
- **POV violations**: Stay locked to the assigned POV character. Never reveal information they can't perceive.
- **Purple prose**: The canon uses elevated metaphors sparingly and breaks them with blunt one-line beats. If your narrator blocks run past 3 sentences without a punch, cut.
- **Dated references**: No brand names, no app names, no internet slang, no memes. Use generic modern devices (手機、簡訊) and Taiwanese campus texture instead.
- **Forgetting continuity**: Read the previous act before writing yours. Props, character states, and revealed information must carry forward consistently.
