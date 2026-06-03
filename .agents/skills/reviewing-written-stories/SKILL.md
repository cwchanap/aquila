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

### Step 2: Read Reference Documents

Read these files **once** before spawning any agents:

| Document | Purpose |
|---|---|
| `docs/characters.md` | Character personalities, speech patterns, representative lines |
| `docs/high-level-plan.md` | Overall plot structure, loop rules, character arcs, reveals schedule |
| `docs/chapter_N_plan.md` | Specific chapter plan (if exists for the act being reviewed) |

These are shared context — include the **full content** of relevant docs in each subagent prompt so agents don't need to read files themselves.

### Step 3: Spawn Parallel Review Agents

For **each act**, spawn **2 agents in parallel** using the Task tool:

**Agent A: Character Review**

Prompt template:

```
You are reviewing a written story act for CHARACTER CONSISTENCY.

## Reference: Character Definitions
[INSERT full characters.md content]

## Act to Review
Read file: [act file path]

## Your Task
Check EVERY line of dialogue against the character definitions. For each character who speaks, verify:

1. **Speech length**: Does the dialogue match the character's typical sentence length? (e.g. 顧言 should be 1-3 characters max, 許星棠 should be short declarative statements)
2. **Tone/register**: Does the emotional register match? (e.g. 邵叔 should be warm/daily-life concern on surface, not cold or robotic)
3. **Personality markers**: Are specific habits present? (e.g. 顧言 uses 內心 monologue far more than speech, 許星棠 uses statements not questions)
4. **Vocabulary range**: Does the character use words consistent with their background? (e.g. 林主任 uses bureaucratic language, 韓越 uses commands not explanations)

## Output Format
For each issue found:
- **Line reference**: Quote the problematic line
- **Character**: Who is speaking
- **Issue**: What's inconsistent
- **Expected**: What it should be like based on character doc
- **Severity**: HIGH (breaks character completely) / MEDIUM (noticeable deviation) / LOW (minor inconsistency)

If no issues found for a character, say "PASS" for that character.

End with a summary: total issues by severity, and which characters are most consistent.
```

**Agent B: Plot Consistency Review**

Prompt template:

```
You are reviewing a written story act for PLOT CONSISTENCY.

## Reference: High-Level Plan
[INSERT high-level-plan.md content]

## Reference: Chapter Plan (if exists)
[INSERT chapter_N_plan.md content, or "No chapter-specific plan found"]

## Act to Review
Read file: [act file path]

## Review Priority: Internal Consistency > Plan Adherence

The plan is a guide, not a contract. Creative deviations from the plan are OK.
What is NOT OK is internal contradiction — things that break the story's own logic.

**Flag as issues ONLY if the story:**
- Contradicts itself across acts (e.g. a deleted message reappearing, a character in two places at once)
- Violates its own established rules (e.g. loop mechanics stated in one act but broken in another)
- Has characters acting against their defined personality in ways that break reader trust
- Reveals information the plan explicitly forbids for this stage (check "本章不能揭露的事情")
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

1. **Cross-act consistency**: Does this act contradict anything established in earlier acts? (facts, character knowledge, item states, physical descriptions)
2. **Rule compliance**: Does it violate the story's own rules? (loop mechanics, evidence chain, character capabilities)
3. **Information reveal timing**: Is anything revealed that the plan says must stay hidden at this stage?
4. **Timeline logic**: Do timestamps and time-durations make sense?
5. **Character positioning**: Are characters where the story previously established them to be?
6. **Evidence chain integrity**: Are physical objects (photos, messages, cameras) in consistent states across acts?

## Output Format
For each issue found:
- **Category**: Cross-act contradiction / Rule violation / Premature reveal / Timeline / Character position / Evidence chain
- **Story says (earlier)**: What was previously established
- **Story says (this act)**: What this act now claims
- **Contradiction**: Why these don't match
- **Severity**: HIGH (breaks story logic, reader will notice) / MEDIUM (noticeable on close reading) / LOW (nitpick)

If no chapter plan exists, only check against high-level plan rules.

End with a summary: most critical issues first, grouped by category.
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
- **Include full doc content in prompts** — don't make agents read files; pass the content directly
- **Don't modify story files** — this is a read-only review, not an editing pass
- **If no chapter plan exists for an act**, the plot reviewer should only check against the high-level plan
- **Respect the "do not reveal" lists** — premature reveals are real issues because they break the planned reader experience
- **Cross-act contradictions are the highest priority** — a message that says one thing in act 1 and another in act 4 is worse than a missing scene from the plan

## Common Mistakes

- **Forgetting to read docs first**: If you don't include character definitions in the prompt, agents can't check consistency
- **Sequential reviews**: Always use parallel Task tool calls — reviewing 12 acts means 24 parallel agents
- **Editing during review**: Review only. Never modify act files based on findings unless the user explicitly asks
- **Missing chapter plans**: Some chapters may not have dedicated plans. Check `docs/` for available plans before starting
