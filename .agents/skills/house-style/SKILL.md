---
name: house-style
description: The Aquila house style guide for story prose (New Adult 18-25). Loaded by writing subagents (via writing-story-acts) and review subagents (via reviewing-written-stories) to calibrate voice, pacing, POV, tone, and references. Single source of truth — do not duplicate inline in other skills.
---

# Aquila House Style Guide (New Adult 18-25)

Stories target **New Adult readers (18-25)** — college/early-career protagonists, adult themes, contemporary Taiwanese setting. The existing canon (`dontSaveMeBeforeMidnight`, `trainAdventure`) defines the house style; mimic it.

This guide is the single source of truth for prose style. It is loaded by:
- **`writing-story-acts`** — writing subagents follow it when drafting act markdown
- **`reviewing-written-stories`** — Agent C checks adherence to the dimensions below

Do not duplicate this content inline in other skills — reference this skill instead to prevent drift.

## Voice — mixed register

- ✅ **Narrator** may use sensory metaphors and elevated imagery (`像一具剛解凍的木偶`, `像沒充飽電的手機`)
- ✅ **Protagonist inner voice** is clipped, fragmentary, blunt (`又是校慶。` / `做夢了吧。` / `帥。`)
- ❌ Not YA-earnest, not adult-literary-remote. Aim for "smart enough to be lyrical, insecure enough to mock itself"
- ❌ No authorial exposition — reveal only what the POV character perceives

## Pacing — mobile-reading rhythm

- ✅ **Standalone one-line paragraphs for emphasis** (`07:05。` / `鐘樓。` / `然後是一隻手。`)
- ✅ Long sensory accumulations in narrator beats, broken by short inner-monologue punches
- ✅ One beat per paragraph — never pack multiple ideas into one `**旁白**：` block
- ❌ No purple prose blocks; no wall-of-text inner monologue

## POV — third-person close

- ✅ Locked to one POV character's perception per scene
- ✅ Filter every description through their sensory/emotional state
- ❌ Never reveal information the POV character can't perceive (no omniscient cuts to other characters' thoughts)

## Tone — dry, melancholic, self-aware

- ✅ Deadpan humor at protagonist's expense (the canon's `帥。` after describing a haggard reflection)
- ✅ Melancholic undertone permitted; maudlin is not
- ❌ No slapstick, no meme humor, no dad-joke tone

## References — modern but timeless

- ✅ Taiwanese school/campus texture (宿舍、食堂、校慶、關東煮、豆漿、騎樓)
- ✅ Generic modern devices (手機、簡訊、螢幕) — no brand names or app names unless diegetically required
- ❌ No internet slang, no memes, no trend-of-the-moment references (they date the text)

## Reference examples

Read one of these to calibrate the house voice before writing or reviewing:
- `packages/stories/raw/dontSaveMeBeforeMidnight/chapter_1/act1.md` (narrator + inner voice balance)
- `packages/stories/raw/dontSaveMeBeforeMidnight/chapter_3/act2.md` (sustained inner-monologue investigation)

If neither canon act is available (e.g. the story was renamed or removed), use any existing act from a shipped story as the calibration reference and note the substitution.
