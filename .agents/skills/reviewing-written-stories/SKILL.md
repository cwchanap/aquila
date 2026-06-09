---
name: reviewing-written-stories
description: Use when reviewing written story acts for character consistency and plot alignment against design documents. Spawns parallel subagents — one for character voice/personality review and one for plot consistency review — per act file.
---

# Reviewing Written Stories

## Overview

Review written story acts (`actN.md`) in parallel by spawning **2 subagents per act**: one checks character dialogue against `characters.md`, the other checks plot consistency against `high-level-plan.md` and chapter plans. Results are aggregated into a consolidated review report.

## When to Use

- User asks to review story acts (e.g. "review act 1-12")
- User wants character consistency or plot alignment feedback on written stories
- User says "check the dialogue" or "review the story" in context of `packages/stories/raw/`

## Workflow

```
Identify acts → Read docs → Spawn 2 agents per act → Aggregate results → Report
```

### Step 1: Identify Target Acts and Docs

Locate the story's raw directory:

```
packages/stories/raw/<storyName>/
  act1.md ... act12.md
  docs/
    characters.md
    high-level-plan.md
    chapter_N_plan.md   (may not exist for every act)
```

Determine which acts to review based on user request.

### Step 2: Identify Reference Document Paths

Before spawning agents, identify the file paths for:

| Document | Purpose |
|---|---|
| `docs/characters.md` | Character personalities, speech patterns, representative lines |
| `docs/high-level-plan.md` | Overall plot structure, loop rules, character arcs, reveals schedule |
| `docs/chapter_N_plan.md` | Specific chapter plan (if exists for the act being reviewed) |

Agents will read these files directly themselves — do NOT copy file contents into prompts.

### Step 3: Spawn Parallel Review Agents

For **each act** (or small batch of 2-3 acts), spawn **2 agents in parallel** using the Task tool. Agents read reference docs and act files directly from disk.

**Agent A: Character Review**

Prompt template:

```
You are reviewing written story acts for CHARACTER CONSISTENCY.

## Step 1: Read reference documents

Read these files first to understand each character's voice:
- [FULL PATH to characters.md]

## Step 2: Read the acts to review

- [FULL PATH to act file(s)]

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

**Agent B: Plot Consistency Review**

Prompt template:

```
You are reviewing written story acts for PLOT CONSISTENCY.

## Step 1: Read reference documents

Read these files first:
- [FULL PATH to high-level-plan.md]
- [FULL PATH to chapter_N_plan.md] (omit if none exists)

## Step 2: Read the acts to review

- [FULL PATH to act file(s)]

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

**Do NOT flag as issues:**
- Creative additions not in the plan (new scenes, extra characters, enriched details)
- Missing planned beats that the author may have intentionally cut or rearranged
- Foreshadowing planted differently than the plan suggested
- Minor timeline approximations (e.g. "twelve hours" when it's 12h52m)
- Style or pacing choices that differ from the plan

## Your Task
Check the act for internal consistency and logic integrity:

1. **Cross-act consistency**: Does this act contradict anything established in earlier acts?
2. **Rule compliance**: Does it violate the story's own rules?
3. **Information reveal timing**: Is anything revealed that the plan says must stay hidden at this stage?
4. **Timeline logic**: Do timestamps and time-durations make sense?
5. **Character positioning**: Are characters where the story previously established them to be?
6. **Evidence chain integrity**: Are physical objects in consistent states across acts?

## Output Format

For each issue found per act:
- **Act**: Which act number
- **Category**: Cross-act contradiction / Rule violation / Premature reveal / Timeline / Logic hole
- **Description**: What the issue is
- **Severity**: HIGH (breaks story logic) / MEDIUM (noticeable on close reading) / LOW (nitpick)

If no issues, say "PASS".

End with a summary: most critical issues first, grouped by category.

IMPORTANT: This is a read-only review. Do NOT modify any files.
```

### Step 4: Aggregate and Report

After all agents complete, combine results into a consolidated report:

```markdown
# Story Review Report: <storyName>

## Summary
- **Acts reviewed**: act1 - act12
- **Total character issues**: X (HIGH: Y, MEDIUM: Z, LOW: W)
- **Total plot issues**: X (HIGH: Y, MEDIUM: Z, LOW: W)
- **Most consistent characters**: [list]
- **Most problematic acts**: [list]

## Character Consistency Issues

### Act 1
[Agent A findings]

### Act 2
[Agent A findings]
...

## Plot Consistency Issues

### Act 1
[Agent B findings]

### Act 2
[Agent B findings]
...

## Critical Fixes Required
[All HIGH severity issues across all acts, sorted by act number]

## Recommendations
[Suggestions for improvement]
```

## Important Rules

- **Internal consistency over plan adherence** — Flag contradictions and logic breaks. Don't flag creative deviations from the plan.
- **Always spawn agents in parallel** — never review acts sequentially when multiple acts are requested
- **Tell agents to read files directly** — provide full file paths in prompts; agents read reference docs and act files from disk themselves. This avoids context-window waste and ensures agents see the complete documents.
- **Don't modify story files** — this is a read-only review, not an editing pass (unless the user explicitly asks to fix issues afterward)
- **If no chapter plan exists for an act**, the plot reviewer should only check against the high-level plan
- **Respect the "do not reveal" lists** — premature reveals are real issues because they break the planned reader experience
- **Cross-act contradictions are the highest priority** — a message that says one thing in act 1 and another in act 4 is worse than a missing scene from the plan

## Common Mistakes

- **Forgetting to provide file paths**: If you don't give agents the paths to characters.md and the plan docs, they can't check consistency
- **Sequential reviews**: Always use parallel Task tool calls — reviewing 12 acts means 24 parallel agents (or fewer if batching 2-3 acts per agent)
- **Editing during review**: Review only. Never modify act files based on findings unless the user explicitly asks
- **Missing chapter plans**: Some chapters may not have dedicated plans. Check `docs/` for available plans before starting
