---
name: reviewing-written-stories
description: Use when reviewing written story acts for character consistency, plot alignment against design documents, and orphaned hooks (attention-grabbing elements never resolved). Spawns parallel subagents — one for character voice/personality review, one for plot consistency review, and one for dialogue naturalness review. Supports both per-act and chapter-level review modes.
---

# Reviewing Written Stories

## Overview

Review written story acts (`actN.md`) in parallel by spawning subagents that check character dialogue against `characters.md`, plot consistency against `high-level-plan.md` and chapter plans, and dialogue naturalness for modern Chinese readers. Results are aggregated into a consolidated review report.

Supports two review modes:
- **Per-act mode**: Spawn 3 agents per act (or small batch of 2-3 acts) — Agent A (character), Agent B (plot), Agent C (dialogue naturalness). Best for targeted reviews of specific acts.
- **Chapter-level mode**: Spawn 1 agent for the entire chapter (all acts) — Agent B (plot only). Best when the user says "review chapter N" or "review all acts". The agent reads all acts and reports issues organized by act number.

## When to Use

- User asks to review story acts (e.g. "review act 1-12")
- User asks to review a whole chapter (e.g. "review chapter 1", "review all acts in chapter 1")
- User wants character consistency or plot alignment feedback on written stories
- User says "check the dialogue" or "review the story" in context of `packages/stories/raw/`

## Workflow

```
Identify acts/docs → Choose review mode → Spawn agents → Aggregate results → Report
```

### Step 1: Identify Target Acts and Docs

Locate the story's raw directory:

```
packages/stories/raw/<storyName>/
  chapter_1/
    act1.md ... act11.md
  chapter_2/
    act1.md ... actN.md
  docs/
    characters.md
    high-level-plan.md
    chapter_N_plan.md   (may not exist for every chapter)
```

Determine which acts/chapters to review based on user request.

### Step 2: Choose Review Mode

| Mode | When | Agents |
|---|---|---|
| **Chapter-level** | User says "review chapter N" or "review all acts" | Agent B only (1 agent total — plot consistency) |
| **Per-act** | User says "review act 3" or "review act 5-8" | Agent A + Agent B + Agent C (3 agents per act or per batch) |

**Prefer chapter-level mode** when reviewing more than 3-4 acts — Agent B gets cross-act context and produces more cohesive findings (especially for cross-act contradictions). Agent A (character) and Agent C (dialogue naturalness) are only available in per-act mode for detailed line-level analysis.

### Step 3: Identify Reference Document Paths

Before spawning agents, identify the file paths for:

| Document | Purpose |
|---|---|
| `docs/characters.md` | Character personalities, speech patterns, representative lines |
| `docs/high-level-plan.md` | Overall plot structure, loop rules, character arcs, reveals schedule |
| `docs/chapter_N_plan.md` | Specific chapter plan (if exists for the chapter being reviewed) |

Agents will read these files directly themselves — do NOT copy file contents into prompts.

### Step 4: Spawn Parallel Review Agents

Agents read reference docs and act files directly from disk.

#### Chapter-Level Mode (Preferred for full chapters)

Spawn **1 agent** — Agent B reads ALL acts in the chapter.

**Agent B: Plot Consistency Review (All Acts)**

```
You are reviewing written story acts for PLOT CONSISTENCY.

## Step 1: Read reference documents

Read these files first:
- [FULL PATH to high-level-plan.md]
- [FULL PATH to chapter_N_plan.md] (omit if none exists)

## Step 2: Read the acts to review

Read ALL acts in order:
- [FULL PATH to each act file in the chapter]

## Review Priority: Internal Consistency > Plan Adherence

The plan is a guide, not a contract. Creative deviations from the plan are OK.
What is NOT OK is internal contradiction — things that break the story's own logic.

**Flag as issues ONLY if the story:**
- Contradicts itself across acts (e.g. a deleted message reappearing, a character in two places at once)
- Violates its own established rules (e.g. loop mechanics stated in one act but broken in another)
- Has characters acting against their defined personality in ways that break reader trust
- Reveals information the plan explicitly forbids for this stage (check "本章不能揭露的事情" and "本章不要做的事")
- Creates timeline impossibilities (e.g. timestamps that don't add up)
- Introduces logic holes (e.g. a locked door opens with no explanation, evidence appears from nowhere)
- Introduces attention-grabbing plot elements, settings, or details NOT mentioned in the chapter plan or high-level plan that are never explained or resolved within the reviewed acts (orphaned hooks)

**Do NOT flag as issues:**
- Creative additions not in the plan (new scenes, extra characters, enriched details)
- Missing planned beats that the author may have intentionally cut or rearranged
- Foreshadowing planted differently than the plan suggested
- Minor timeline approximations (e.g. "twelve hours" when it's 12h52m)
- Style or pacing choices that differ from the plan
- Atmospheric or background details that don't demand explanation (a painting on a wall, weather description)

## Your Task
Check all acts for internal consistency and logic integrity:

1. **Cross-act consistency**: Does any act contradict anything established in earlier acts?
2. **Rule compliance**: Does it violate the story's own rules?
3. **Information reveal timing**: Is anything revealed that the plan says must stay hidden at this stage?
4. **Timeline logic**: Do timestamps and time-durations make sense?
5. **Character positioning**: Are characters where the story previously established them to be?
6. **Evidence chain integrity**: Are physical objects in consistent states across acts?
7. **Orphaned hooks**: Are there plot points, mysterious objects, unusual settings, or striking details introduced that draw reader attention but are never explained or paid off by the end of the reviewed acts? Ask: "Would a reader remember this and expect it to matter?" If yes and it goes nowhere, flag it.

## Output Format

For each issue found, organize BY ACT:
- **Act**: Which act number
- **Category**: Cross-act contradiction / Rule violation / Premature reveal / Timeline / Logic hole / Orphaned hook
- **Description**: What the issue is
- **Severity**: HIGH (breaks story logic) / MEDIUM (noticeable on close reading) / LOW (nitpick)

If no issues for an act, say "PASS".

End with a summary: most critical issues first, grouped by category.

IMPORTANT: This is a read-only review. Do NOT modify any files.
```

#### Per-Act Mode (For targeted reviews)

For **each act** (or small batch of 2-3 acts), spawn **3 agents in parallel** using the Task tool. This mode is best when reviewing 1-3 specific acts rather than an entire chapter.

**Agent A: Character Review (Per-Act)**

```
You are reviewing written story acts for CHARACTER CONSISTENCY.

## Step 1: Read reference documents

Read this file first to understand each character's voice:
- [FULL PATH to characters.md]

## Step 2: Read the acts to review

- [FULL PATH to specific act file(s)]

## Your Task

Check EVERY line of dialogue against the character definitions you read from characters.md. For each character who speaks, verify:

1. **Speech length**: Does the dialogue match the character's typical sentence length?
2. **Tone/register**: Does the emotional register match?
3. **Personality markers**: Are specific habits present?
4. **Vocabulary range**: Does the character use words consistent with their background?

Pay special attention to:
- The Voice Comparison Table (角色聲音對照表) near the end of characters.md
- Each character's 代表性台詞 (representative lines) section
- Each character's 說話風格 (speech style) section

## Output Format

For each issue found per act:
- **Act**: Which act number
- **Line reference**: Quote the problematic line
- **Character**: Who is speaking
- **Issue**: What's inconsistent
- **Expected**: What it should be like based on the character doc
- **Severity**: HIGH (breaks character completely) / MEDIUM (noticeable deviation) / LOW (minor inconsistency)

If no issues found for a character, say "PASS" for that character.

End with a summary: total issues by severity, and which characters are most consistent.

IMPORTANT: This is a read-only review. Do NOT modify any files.
```

**Agent B: Plot Consistency Review (Per-Act)**

```
You are reviewing written story acts for PLOT CONSISTENCY.

## Step 1: Read reference documents

Read these files first:
- [FULL PATH to high-level-plan.md]
- [FULL PATH to chapter_N_plan.md] (omit if none exists)

## Step 2: Read the acts to review

- [FULL PATH to specific act file(s)]

## Review Priority: Internal Consistency > Plan Adherence

The plan is a guide, not a contract. Creative deviations from the plan are OK.
What is NOT OK is internal contradiction — things that break the story's own logic.

**Flag as issues ONLY if the story:**
- Contradicts itself across acts (e.g. a deleted message reappearing, a character in two places at once)
- Violates its own established rules (e.g. loop mechanics stated in one act but broken in another)
- Has characters acting against their defined personality in ways that break reader trust
- Reveals information the plan explicitly forbids for this stage (check "本章不能揭露的事情" and "本章不要做的事")
- Creates timeline impossibilities (e.g. timestamps that don't add up)
- Introduces logic holes (e.g. a locked door opens with no explanation, evidence appears from nowhere)
- Introduces attention-grabbing plot elements, settings, or details NOT mentioned in the chapter plan or high-level plan that are never explained or resolved within the reviewed acts (orphaned hooks)

**Do NOT flag as issues:**
- Creative additions not in the plan (new scenes, extra characters, enriched details)
- Missing planned beats that the author may have intentionally cut or rearranged
- Foreshadowing planted differently than the plan suggested
- Minor timeline approximations (e.g. "twelve hours" when it's 12h52m)
- Style or pacing choices that differ from the plan
- Atmospheric or background details that don't demand explanation (a painting on a wall, weather description)

## Your Task
Check the act for internal consistency and logic integrity:

1. **Cross-act consistency**: Does this act contradict anything established in earlier acts?
2. **Rule compliance**: Does it violate the story's own rules?
3. **Information reveal timing**: Is anything revealed that the plan says must stay hidden at this stage?
4. **Timeline logic**: Do timestamps and time-durations make sense?
5. **Character positioning**: Are characters where the story previously established them to be?
6. **Evidence chain integrity**: Are physical objects in consistent states across acts?
7. **Orphaned hooks**: Are there plot points, mysterious objects, unusual settings, or striking details introduced that draw reader attention but are never explained or paid off? Ask: "Would a reader remember this and expect it to matter?" If yes and it goes nowhere, flag it.

## Output Format

For each issue found per act:
- **Act**: Which act number
- **Category**: Cross-act contradiction / Rule violation / Premature reveal / Timeline / Logic hole / Orphaned hook
- **Description**: What the issue is
- **Severity**: HIGH (breaks story logic) / MEDIUM (noticeable on close reading) / LOW (nitpick)

If no issues, say "PASS".

End with a summary: most critical issues first, grouped by category.

IMPORTANT: This is a read-only review. Do NOT modify any files.
```

**Agent C: Dialogue Naturalness Review (Per-Act)**

```
You are reviewing written story acts for DIALOGUE NATURALNESS and SMOOTHNESS, with special attention to modern Chinese reader expectations.

## Step 1: Read the acts to review

- [FULL PATH to specific act file(s)]

## Your Task

Read every line of dialogue and narration in Chinese. Evaluate whether the language sounds natural and fluent to a modern Chinese reader. Flag anything that feels:

1. **Awkward phrasing**: Sentences that are grammatically correct but feel stiff, overly formal, or unnatural in spoken context
2. **Unnatural wordings**: Expressions that native Chinese speakers would rarely use, or that sound translated/awkward
3. **Tonal mismatch**: Dialogue that doesn't match the emotional situation (e.g. overly casual during a tense moment, or stiff during an intimate scene)
4. **Anachronistic or out-of-place vocabulary**: Words or expressions that feel wrong for the character's age, background, or the story's setting
5. **Clunky transitions**: Lines where the flow between consecutive dialogue lines or between narration and dialogue feels jarring or disjointed
6. **Repetitive sentence structures**: Overuse of the same sentence pattern within a short span that makes dialogue feel monotonous

Pay special attention to:
- Spoken Chinese vs written Chinese — dialogue should sound like how people actually talk
- Modern colloquialisms and whether they're used correctly
- Regional or slang expressions — are they authentic or forced?
- Formality level matching the social relationship between speakers
- Whether the emotional beats land naturally or feel manufactured

## Output Format

For each issue found per act:
- **Act**: Which act number
- **Line reference**: Quote the problematic line
- **Issue category**: Awkward phrasing / Unnatural wording / Tonal mismatch / Anachronistic vocabulary / Clunky transition / Repetitive structure
- **Why it's unnatural**: Explain what sounds wrong and why a modern Chinese reader would find it jarring
- **Suggested rephrase**: Provide a more natural alternative (optional but encouraged)
- **Severity**: HIGH (breaks immersion completely) / MEDIUM (noticeable, pulls reader out) / LOW (minor awkwardness)

If no issues for an act, say "PASS".

End with a summary: total issues by severity and category, and which acts have the most natural vs most awkward dialogue.

IMPORTANT: This is a read-only review. Do NOT modify any files.
```

### Step 5: Aggregate and Report

After all agents complete, combine results into a consolidated report:

```markdown
# Story Review Report: <storyName>

## Summary
- **Review mode**: Per-act / Chapter-level
- **Acts reviewed**: act1 - act12
- **Total character issues**: X (HIGH: Y, MEDIUM: Z, LOW: W)
- **Total plot issues**: X (HIGH: Y, MEDIUM: Z, LOW: W)
- **Total dialogue naturalness issues**: X (HIGH: Y, MEDIUM: Z, LOW: W)
- **Most consistent characters**: [list]
- **Most problematic acts**: [list]

## Character Consistency Issues

### Act 1
[Agent A findings — per-act mode only, omit in chapter-level mode]

### Act 2
[Agent A findings — per-act mode only, omit in chapter-level mode]
...

## Plot Consistency Issues

### Act 1
[Agent B findings]

### Act 2
[Agent B findings]
...

## Dialogue Naturalness Issues

### Act 1
[Agent C findings — per-act mode only, omit in chapter-level mode]

### Act 2
[Agent C findings — per-act mode only, omit in chapter-level mode]
...

## Critical Fixes Required
[All HIGH severity issues across all acts, sorted by act number]

## Recommendations
[Suggestions for improvement]
```

## Important Rules

- **Prefer chapter-level mode** for full chapter reviews — Agent B gets cross-act context and catches cross-act contradictions more reliably than per-act batches. Chapter-level mode only spawns Agent B (plot).
- **Per-act mode spawns all 3 agents** — Agent A (character), Agent B (plot), and Agent C (dialogue naturalness) run in parallel. This is the only mode that includes character and naturalness reviews.
- **Internal consistency over plan adherence** — Flag contradictions and logic breaks. Don't flag creative deviations from the plan.
- **Always spawn agents in parallel** — all agents for a given batch should run concurrently, never sequentially
- **Tell agents to read files directly** — provide full file paths in prompts; agents read reference docs and act files from disk themselves. This avoids context-window waste and ensures agents see the complete documents.
- **Don't modify story files** — this is a read-only review, not an editing pass (unless the user explicitly asks to fix issues afterward)
- **If no chapter plan exists for a chapter**, the plot reviewer should only check against the high-level plan
- **Respect the "do not reveal" lists** — premature reveals are real issues because they break the planned reader experience
- **Cross-act contradictions are the highest priority** — a message that says one thing in act 1 and another in act 4 is worse than a missing scene from the plan

## Common Mistakes

- **Forgetting to provide file paths**: If you don't give agents the paths to characters.md and the plan docs, they can't check consistency
- **Sequential reviews**: Always use parallel Task tool calls — all agents for a batch must run concurrently
- **Editing during review**: Review only. Never modify act files based on findings unless the user explicitly asks
- **Missing chapter plans**: Some chapters may not have dedicated plans. Check `docs/` for available plans before starting
- **Wrong review mode**: Don't spawn per-act agents when the user asks to review a whole chapter — use chapter-level mode (Agent B only) instead to get better cross-act analysis
- **Spawning Agent A or C in chapter-level mode**: These agents are per-act only. Chapter-level reviews only use Agent B
