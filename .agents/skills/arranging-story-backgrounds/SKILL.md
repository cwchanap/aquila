---
name: arranging-story-backgrounds
description: Use when planning or generating visual-novel backgrounds that contain characters (a shared set such as a train carriage, with several named passengers), when a story's backgrounds look inconsistent or repetitive, when writing or editing an `art-bible.md`, ` ```bg ` blocks or portrait prompts in raw story files, or `image-assets.json`, or when generating background PNGs with Codex or another image agent using reference images.
---

# Arranging Story Backgrounds

## Overview

Some stories need backgrounds **with the cast in them** (a fixed set, a closed cast, many scenes in one place), unlike the older character-free backgrounds. Image models drift on three things: the set's design, who sits where, and the camera. This skill fixes all three with one shared art bible, empty reference images of the set, and a shot list that varies camera and distance on purpose.

It was worked out on the train carriage in `train_adventure` (16 passengers, 14 backgrounds, acts 1-3). The same method fits any one-location ensemble.

## Where things live

- **Prompts**: ` ```bg ` blocks in the act markdown and `### Portrait Prompts` in `docs/characters.md`. Put each `bg` block right before the first line of the beat it shows; keys are `<dir>/<sceneId>_sK`, numbered by block order within the scene file (`_root/act1_s0` for a root act, `branch_1b/b1b_act4_s0` for a scene in a subdirectory), so inserting a block renumbers the ones after it. `bun compile:stories` extracts them into `packages/stories/src/generated/<rawDir>/image-assets.json` (`portraits[]` and `backgrounds[]`, each with a `key`, a `path` and a `prompt`). Edit the raw source and recompile. Don't edit only the generated JSON: the next compile overwrites it. See the `orchestrating-stories` skill.
- **Art bible**: `packages/stories/raw/<rawDir>/docs/art-bible.md`. One file that is the single source of truth for the set, the seating plan, the camera angles, the window views and the shot list. Every prompt must agree with it.
- **Files**: save each image at the `path` its manifest entry gives, under `packages/assets/media/` (for example `<storyId>/backgrounds/_root/act1_s0.png` or `<storyId>/backgrounds/branch_1b/b1b_act4_s0.png`). Portraits are `.../characters/<id>/base.png` (transparent), and the empty set reference images go in `.../backgrounds/_reference/`.
- **Delivery**: media under `packages/assets/media/` is gitignored, so commit it with `git add -f`. Publishing to R2 and wiring it into the reader is separate work (see Generated Asset Delivery in `CLAUDE.md`). The reader still draws the speaker's portrait (`entry.portrait`) over every background, so a story whose backgrounds include the cast shows speakers twice until the reader skips portraits for it; make that change in the same task that turns on the story's visuals.

## Workflow

### 1. Write the art bible first

It needs five parts:

1. **Cast**: the exact count and names. "Exactly N passengers, no extras anywhere" stops the model inventing commuters.
2. **The set**: one paragraph that every prompt reuses word for word (materials, colours, fixtures, doors, no ads or text).
3. **Seating plan**: who sits where, group by group (see Seating below).
4. **Camera angles**: a small fixed set, each with its own empty reference image, plus the seat order as it appears on screen from each angle (a view from the far end flips left and right).
5. **Window views per act**: what shows outside, per act, so the same window never changes meaning.

### 2. Make the empty references and get them approved

Generate the set with **no people** from each fixed angle, first one from the master, then the others with the master as a reference so the design is identical. Check every one against the master (seat fabric, poles, straps, ceiling, floor, doors, end walls) before any scene is generated. Get the person who owns the look to approve them. A wrong reference poisons every scene.

### 3. Write the shot list

A table of beat, framing, and who is in view, for each background.

- **Vary the camera and the distance on purpose.** Never run the same framing twice in a row. Repeating one wide eye-level view down the carriage made every scene feel like the same picture. Use a ladder of distance (extreme wide, wide, medium, close-up, detail insert) and of angle (down the length, reverse, across the aisle, three-quarter diagonal, low, high or tilted, over-the-shoulder, window-level).
- **Show only the people the beat needs.** Not every scene needs the whole cast. Use the full cast only for establishing and group-panic shots. Keep a character who belongs in one spot (such as a loner in a corner) out of shots where that spot isn't in frame.
- **Don't draw the outside of the set** if it never matched the interior. Show the outside through windows and open doors.
- **Match the story**: read the act text around each block before staging it: who is present, awake, standing or moving, and what the windows show at that moment. The first station shot had passengers at the open door before the story moves anyone.

### 4. Seat people in groups, with empty seats between

A near-empty last train is the model that works. People in a group sit side by side and touch. **Groups are separated by at least two or three empty seats.** Packing sixteen people shoulder to shoulder along the benches reads as a group photo, makes faces tiny, and kills the lonely mood.

- A pair that matters (a protagonist and the character they bond with) sits together in the end seat against the partition, in the same order in every shot.
- Write the order **near to far from each camera**, and also "on screen from the right edge going left". Models reverse orders constantly, so say it twice, two ways.

### 5. Write each prompt

Same skeleton every time, in this order: the set sentence from the art bible, the camera and distance, the window view for the act, the people with a one-line look each (hair, outfit, props) in order of position, what each is doing, the empty-seat statement, and the closing "only the people named here are in view, no other passengers, no text, no logo, 16:9". The look lines must match the portraits.

### 6. Generate

Generate with Codex (`codex exec` and its built-in image tool) on the machine that has it, never with Python or PIL placeholders; the `generating-images-with-cli` skill covers the mechanics where it is installed. For backgrounds:

- **References**: attach the empty set reference **first** and only the portraits of the people named in that shot. Tell the model the reference fixes the set's **design only**, and that the camera angle and distance must follow the prompt, not the reference. Without that line a "close-up" comes back as another wide shot.
- **Prepare references**: flatten transparent portraits onto a neutral grey, resize portraits to about 384x576 and set references to about 836x470. Smaller references keep runs fast and stable.
- **Output**: opaque 16:9 PNG (Codex returned 1672x941), the same size for the whole set.
- **Parallelism**: three or four runs at once. The image tool may refuse more than about five referenced images in one call and then retry with fewer, so a crowded shot can silently lose references. If faces drift, check the log.
- **Quota**: the image allowance is limited and varies. We hit it after about ten images in one session and ran about twenty in another without hitting it. The error carries `resets_at` (and `usage_limit_reached`). Stop, push what passed, and say when it resets. Don't retry in a loop, and stop any runs already queued so they don't keep failing.

### 7. Review every image, zoomed in

Open each image, then crop and enlarge the parts that matter. A contact sheet of the whole set at the end shows drift in design, colour and style.

Per shot:

- the **framing** matches the prompt (angle and distance, not just the people);
- **exactly the named people**, no extras, including reflections in black windows;
- every face and outfit matches its portrait, and similar characters stay distinct (two dark-haired young men; make sure the one with glasses has them);
- the **order** along each bench is as written, and each group is separated by clear empty seats;
- the set matches the reference (fabric, poles, straps, ceiling, doors, end wall);
- the **window view** is right for the act and no window shows the wrong world;
- moons or other sky details match the rest of the act;
- no readable text, except signs the story wants (a station sign with the exact characters).

Across the set, on the contact sheet:

- follow each character through every scene they appear in and check their markers (glasses, hood, hairstyle, props); a drift often shows only next to another scene;
- check each group's order against the approved wide shot, and check mirrored layouts (which side the partition or door is on);
- if the frame shows a group's seats, the group should be in them, small and out of focus is enough.

### 8. Fix, don't re-roll

Pass the **current image first** and say "recreate image 1 exactly, change only X", then list X. Name positions as they appear on screen. Allow two retries per defect, then accept it and record it. A full re-roll changes everything you had already approved.

## Failure modes we hit

| Symptom                                                                    | Fix                                                                                                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Group order reversed (students, couple, family)                            | State the order near to far **and** on-screen left to right, with each person's look. Recreate with the current image first. |
| People packed together, groups touching                                    | Add "at least three empty cushions between every pair of groups" and say it once more at the end of the prompt.              |
| A named person missing, or a duplicate                                     | Spell out the headcount per bench and name the missing person with their look.                                               |
| Ghost figures in window reflections                                        | Say "reflections show only these same people, no extra figures".                                                             |
| City skyline in a tunnel or fantasy window                                 | Say what the window shows and also what it must not show ("no city, no buildings, no lights").                               |
| Full moon where the story has crescents, or a moon in a forest-only window | Describe the moon as a thin sickle, say the disc is dark, and say "no moon" for windows that shouldn't have one.             |
| Close-up comes back as a wide shot                                         | Add "the camera angle and distance follow the prompt, not the reference".                                                    |
| A support character who looks like the lead                                | Give each a clear marker (glasses, hairstyle) and put both portraits in the references.                                      |
| The set's end wall or doors drift                                          | Describe the end wall in the set sentence and in the check list.                                                             |
| Outside view of the vehicle never matches                                  | Don't draw one. Use windows and open doors.                                                                                  |

## Delivery

- Commit images with `git add -f`. Push in batches (for example every four images) so a reviewer can look as you go.
- Keep the art bible and the shot list in step with the final images. If a prompt change was needed to get a good result, put it back into the raw source so a regenerate gives the same result.
- Portraits are generated on a plain backdrop and cut out to transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model; `isnet-anime` leaves dark clothing semi-transparent.
