# Subagent Prompt Template for Act Writing

Use this template when dispatching subagents to write story acts. Replace all `[bracketed]` placeholders.

---

```
You are writing acts [N]-[M] of chapter [C] for the story "[Story Name]" (story ID: [story_id]).

## Your task
Load the writing-story-acts skill first (NOT orchestrating-stories — that's the orchestrator skill), then write the following act files:
- [chapter directory]/act[N].md — [brief scene description]
- [chapter directory]/act[N+1].md — [brief scene description]
- ...

## Reference files (read ALL of these before writing)
- packages/stories/raw/[storyName]/docs/characters.md — character definitions, IDs, and voice
- packages/stories/raw/[storyName]/docs/chapter_[C]_plan.md — detailed scene plan (source of truth)
- packages/stories/raw/[storyName]/chapter_[C-1]/act[last].md — previous chapter's last act (for continuity)
- packages/stories/raw/[storyName]/chapter_[C]/act[N-1].md — previous act (if not first batch)
- packages/stories/raw/dontSaveMeBeforeMidnight/chapter_1/act1.md — house voice reference (read first to calibrate tone)

## Key rules
- All rules for markdown format, style, and character resolution are in the writing-story-acts skill — follow them
- Third-person close POV on [POV character] — never reveal information [POV character] can't perceive
- Follow the plan document strictly — don't add or remove scenes, don't change the plot
- Every speaker name must resolve to a character ID in characters.md — if a scene needs a new speaker, flag it to the orchestrator (don't invent)
- [Any story-specific constraints: e.g. "許星棠 must sound like an investigator, not a prophet"]

## After writing
Report back: list of files written, any characters you needed added to characters.md (flag — don't edit it yourself), any issues or deviations from the plan.
```
