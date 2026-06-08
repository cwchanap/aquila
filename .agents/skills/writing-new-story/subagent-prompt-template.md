# Subagent Prompt Template for Act Writing

Use this template when dispatching subagents to write story acts. Replace all `[bracketed]` placeholders.

---

```
You are writing acts [N]-[M] of chapter [C] for the story "[Story Name]" (story ID: [story_id]).

## Your task
Load the writing-new-story skill first, then write the following act files:
- [chapter directory]/act[N].md — [brief scene description]
- [chapter directory]/act[N+1].md — [brief scene description]
- ...

## Reference files (read ALL of these before writing)
- packages/stories/raw/[storyName]/docs/characters.md — character definitions, IDs, and voice
- packages/stories/raw/[storyName]/docs/chapter_[C]_plan.md — detailed scene plan (source of truth)
- packages/stories/raw/[storyName]/chapter_[C-1]/act[last].md — previous chapter's last act (for continuity)
- packages/stories/raw/[storyName]/chapter_[C]/act[N-1].md — previous act (if not first batch)
- packages/stories/raw/[storyName]/compiler.config.ts — speaker config (rolePatterns, canonicalize)

## Key rules
- Write in Traditional Chinese (繁體中文) — NO simplified characters
- Follow the markdown format from the skill: **SpeakerName**：dialogue with full-width colon
- Use ` ```bg ` blocks for scene/location changes
- Use `[expression]` tags for portrait overrides
- Third-person close POV on [POV character] — never reveal information [POV character] can't perceive
- Follow the plan document strictly — don't add or remove scenes, don't change the plot
- Every speaker name must resolve to a character ID in characters.md
- [Any story-specific constraints: e.g. "許星棠 must sound like an investigator, not a prophet"]

## After writing
Report back: list of files written, any characters you needed to add to characters.md, any issues or deviations from the plan.
```
