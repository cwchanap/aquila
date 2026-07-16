# The Seventh Mirror Lead Portraits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and verify all authored portrait expressions for Asakura Mio and Asakura Yuma in `theSeventhMirror`.

**Architecture:** Keep the story compiler and generated story output unchanged. Generate each portrait as an independent opaque PNG from the source prompt in `packages/stories/raw/theSeventhMirror/docs/characters.md`, then store it at the asset path already emitted by the story manifest.

**Tech Stack:** Built-in Codex image generation, PNG raster assets, Bun monorepo, Git.

## Global Constraints

- Generate 11 independent PNGs: 7 Mio expressions and 4 Yuma expressions.
- Use the authored prompts in `packages/stories/raw/theSeventhMirror/docs/characters.md` as the source of truth.
- Store assets under `packages/assets/media/the_seventh_mirror/characters/<character>/<expression>.png`.
- Preserve anime visual-novel style, upper-body framing, clean background treatment, and character identity across expressions.
- Do not add text, logos, watermarks, unrelated props, or new narrative details.
- Use opaque PNGs; native transparency is not part of this story's current asset contract.
- Do not modify `packages/stories/src/generated` or any compiler/source story file.

---

### Task 1: Prepare and confirm the asset destination

**Files:**
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/`

**Interfaces:**
- Consumes: the 11 paths listed in the approved design spec.
- Produces: empty destination directories ready for generated PNGs.

- [ ] **Step 1: Create the two character directories**

Run:

```bash
rtk mkdir -p packages/assets/media/the_seventh_mirror/characters/asakura_mio packages/assets/media/the_seventh_mirror/characters/asakura_yuma
```

Expected: the command succeeds and creates only the two destination directories.

- [ ] **Step 2: Confirm no existing target files will be overwritten**

Run:

```bash
rtk rg --files packages/assets/media/the_seventh_mirror/characters/asakura_mio packages/assets/media/the_seventh_mirror/characters/asakura_yuma
```

Expected: no output before generation. If any target PNG exists, preserve it and stop before replacing it.

### Task 2: Generate all Asakura Mio expressions

**Files:**
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/angry.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/scared.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/sad.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/determined.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/shocked.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_mio/exhausted.png`

**Interfaces:**
- Consumes: the seven Mio prompts below and the output destination from Task 1.
- Produces: seven independently generated portrait PNGs with stable Mio identity.

Use one built-in image-generation call per expression. Add this shared constraint to every call: `single character only, portrait-oriented upper-body composition, clean unobtrusive background, no text, no logo, no watermark, no unrelated props; keep Asakura Mio's age, shoulder-length dark brown hair, and dark jacket consistent across the set.`

| Output | Source prompt |
| --- | --- |
| `asakura_mio/base.png` | `anime visual-novel portrait, 19-year-old Japanese woman, shoulder-length dark brown hair with loose strands framing face, sharp analytical eyes, casual street clothes (dark jacket over plain top), faint dark circles from poor sleep, guarded but alert expression, soft overcast Tokyo light, muted cool grey-blue palette, upper-body shot, clean background` |
| `asakura_mio/angry.png` | `anime visual-novel portrait, 19-year-old woman, jaw set firm, eyes sharp with cold fury, brows lowered, leaning slightly forward, dark jacket, tense shoulders, harsh directional light, upper-body shot` |
| `asakura_mio/scared.png` | `anime visual-novel portrait, 19-year-old woman, eyes wide with whites showing, breath held, body rigid, loose strands of hair stuck to forehead with cold sweat, dark jacket, cold blue-grey lighting, upper-body shot` |
| `asakura_mio/sad.png` | `anime visual-novel portrait, 19-year-old woman, downcast eyes, lips pressed thin, shoulders dropped, hair falling forward to partially hide face, dark jacket, soft desaturated lighting, upper-body shot` |
| `asakura_mio/determined.png` | `anime visual-novel portrait, 19-year-old woman, jaw clenched, eyes bright with resolve, chin slightly raised, dark jacket, strong directional light cutting across face, upper-body shot` |
| `asakura_mio/shocked.png` | `anime visual-novel portrait, 19-year-old woman, eyes blown wide, mouth slightly parted, face drained of color, dark jacket, stark lighting, upper-body shot` |
| `asakura_mio/exhausted.png` | `anime visual-novel portrait, 19-year-old woman, heavy-lidded eyes with deep dark circles, pale skin, hair disheveled, hand partially covering face, dark jacket wrinkled, dim cold lighting, upper-body shot` |

For each result, inspect the image before accepting it. Copy the accepted output into the exact path in the **Files** list; do not rename expressions or place them under `packages/stories/src/generated`.

### Task 3: Generate all Asakura Yuma expressions

**Files:**
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/scared.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/sad.png`
- Create: `packages/assets/media/the_seventh_mirror/characters/asakura_yuma/determined.png`

**Interfaces:**
- Consumes: the four Yuma prompts below and the output destination from Task 1.
- Produces: four independently generated portrait PNGs with stable Yuma identity.

Use one built-in image-generation call per expression. Add this shared constraint to every call: `single character only, portrait-oriented upper-body composition, clean unobtrusive background, no text, no logo, no watermark, no unrelated props; keep Asakura Yuma's age, slightly messy medium-length black hair, youthful round face, and school uniform consistent across the set.`

| Output | Source prompt |
| --- | --- |
| `asakura_yuma/base.png` | `anime visual-novel portrait, 15-year-old Japanese boy, slightly messy medium-length black hair, youthful round face, middle school uniform (dark blazer), quiet observant expression, large dark eyes, soft natural light, muted palette, upper-body shot, clean background` |
| `asakura_yuma/scared.png` | `anime visual-novel portrait, 15-year-old boy, eyes wide, shoulders hunched, school uniform, cold blue lighting, upper-body shot` |
| `asakura_yuma/sad.png` | `anime visual-novel portrait, 15-year-old boy, downcast eyes, lips trembling slightly, school uniform, dim lighting, upper-body shot` |
| `asakura_yuma/determined.png` | `anime visual-novel portrait, 15-year-old boy, jaw set, eyes sharp with unexpected resolve for his age, school uniform, strong light, upper-body shot` |

For each result, inspect the image before accepting it. Copy the accepted output into the exact path in the **Files** list. Do not update the generated manifest for Yuma's currently unreferenced expressions.

### Task 4: Validate the complete asset set

**Files:**
- Test: all 11 generated PNG files under `packages/assets/media/the_seventh_mirror/characters/`
- Verify: `packages/stories/src/generated/theSeventhMirror/image-assets.json` remains unchanged

**Interfaces:**
- Consumes: the 11 accepted PNGs from Tasks 2 and 3.
- Produces: a filesystem and visual validation result suitable for handoff.

- [ ] **Step 1: Confirm the exact 11 files exist**

Run:

```bash
rtk rg --files packages/assets/media/the_seventh_mirror/characters | rtk sort
```

Expected output contains exactly these paths:

```text
packages/assets/media/the_seventh_mirror/characters/asakura_mio/angry.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/base.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/determined.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/exhausted.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/sad.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/scared.png
packages/assets/media/the_seventh_mirror/characters/asakura_mio/shocked.png
packages/assets/media/the_seventh_mirror/characters/asakura_yuma/base.png
packages/assets/media/the_seventh_mirror/characters/asakura_yuma/determined.png
packages/assets/media/the_seventh_mirror/characters/asakura_yuma/sad.png
packages/assets/media/the_seventh_mirror/characters/asakura_yuma/scared.png
```

- [ ] **Step 2: Confirm each file is a readable PNG and inspect dimensions**

Run:

```bash
rtk file packages/assets/media/the_seventh_mirror/characters/asakura_mio/*.png packages/assets/media/the_seventh_mirror/characters/asakura_yuma/*.png
```

Expected: every file reports `PNG image data`; dimensions are portrait-oriented or otherwise suitable for the reader, with no corrupted files.

- [ ] **Step 3: Re-inspect the set for identity and expression consistency**

Use the local image viewer on all 11 files. Confirm Mio remains the same 19-year-old woman with dark brown hair and dark jacket, Yuma remains the same 15-year-old boy with black hair and blazer, and each expression matches its authored prompt.

- [ ] **Step 4: Confirm generated story output did not drift**

Run:

```bash
rtk git diff -- packages/stories/src/generated packages/stories/raw/theSeventhMirror
```

Expected: no output.

- [ ] **Step 5: Run repository whitespace validation**

Run:

```bash
rtk git diff --check
```

Expected: no output and exit status 0.

- [ ] **Step 6: Commit the verified assets**

Run:

```bash
rtk git add packages/assets/media/the_seventh_mirror/characters
rtk git commit -m "feat(assets): add seventh mirror lead portraits"
```

Expected: one commit containing only the 11 portrait PNGs.
