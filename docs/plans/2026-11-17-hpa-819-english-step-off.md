# HPA-819 — English translation after the first “Step off” choice

**Status:** Design specification and implementation plan only. This draft PR is the **single PR for HPA-819**; implement, verify, and address review feedback on this branch rather than opening a second PR.

- Linear: https://linear.app/cwchanap/issue/HPA-819/first-choice-in-the-platform-at-the-end-of-the-world-leads-to-a-branch
- Baseline: Aquila `main` at `bbf3e079f94bc0a53e816f12a9d453039b1ee469` (2026-11-17); re-check against latest main before implementation.
- Related but out of scope: HPA-820 (art), HPA-821 (reader UX). No image art or SFX generation.

## Goal and user experience

At the first Crossroads choice in *The Platform at the End of the World*, clicking **Step off onto the platform** enters `b1a_act4` with Chinese dialogue and Chinese speaker names on the English website. With Chinese as a second language, the Chinese fallback can appear twice.

Translate the **complete first segment** of this route, from `b1a_act4` through the next choice at the end of `b1a_act6`. Preserve the zh story, scene IDs, progress, choice destinations, and all authored visual/audio cues. The main line must read as English, and optional Chinese secondary text must show Chinese once beneath it.

**Deliberate boundary:** deeper branches (`branch_1a/branch_2a`, `branch_1a/branch_2b` and descendants) also lack English mirrors, and are not in this PR. Do not claim the entire story is English-localized. If full downstream route translation becomes a priority, track it separately rather than adding hundreds of acts to this one bug fix.

## Existing implementation and decisions

| Surface | Confirmed from main | Change |
| --- | --- | --- |
| `packages/stories/raw/trainAdventure/en/` | Has Acts 1–3 and `branch_1b/`; **no** `en/branch_1a/` folder | Add three English mirror Markdown files |
| `packages/stories/raw/trainAdventure/branch_1a/act4.md` through `act6.md` | Zh source contains dialogue plus background cues and reuses | Author text-only English entries aligned one-to-one with zh |
| `packages/stories/src/compiler/localize.ts` | Requires exact entry count and matching character IDs; copies background, portrait, SFX and BGM from zh; missing mirror scenes fall back to zh | Reuse unchanged, no new localization schema |
| `docs/translation-glossary.md` and `docs/characters.md` under the story root | Define English names, descriptive labels, terms and character aliases | Follow existing conventions; add alias only if compiler reveals a missing one |
| `packages/stories/src/stories/trainAdventure/choices.en.ts` | English `choice_act3` and `choice_b1a_act6` already exist | Reuse; no change to choice graph |
| `apps/web/src/components/ReaderShell.svelte` and `reader-second-language.ts` | Main and second language lines align by dialogue index | Mirror translations address the reported duplicate for these scenes without a reader/UI rewrite |
| `packages/stories/src/__tests__/locales.test.ts` and `packages/e2e/tests/reader-crossroads.spec.ts` | Existing locale and branching test infrastructure | Extend in place, not a new framework |

The golden train-adventure compiler test confirms that `choice_act3` goes to `b1a_act4` or `b1b_act4`. Source Acts 4–6 contain roughly 175 speaker-labelled dialogue blocks; derive the authoritative entry counts from the compiler, not line counts, because background blocks are not dialogue.

## Implementation sequence (one PR)

### 1. Prepare the translation

- Rebase on current main and read the full zh text for Acts 4–6, the closing lines of `en/act3.md`, and the English `en/branch_1b/act4.md` for voice.
- Follow `.agents/skills/translating-stories/SKILL.md` and the established glossary. Preserve names and recurring terms such as Li Jie, Emi, Jakkai Station, and the two violet crescents.
- For each zh narration/speaker entry, produce exactly one translated English entry in the same order. Keep ambiguity, dialogue register, and scene beats intact.

### 2. Author only the required files

Create:
- `packages/stories/raw/trainAdventure/en/branch_1a/act4.md` — first step-off scene and the quiet girl joining Li Jie.
- `packages/stories/raw/trainAdventure/en/branch_1a/act5.md` — arrival and the departing train.
- `packages/stories/raw/trainAdventure/en/branch_1a/act6.md` — survivors divide; reaches the already-translated next choice.

Every file needs an English heading and speaker blocks in the `**Speaker**: text` format with ASCII colon. The translated speaker must map to the **same character ID** as in zh, using aliases from `characters.md` and terms from `translation-glossary.md`. Use idiomatic English, preserve one-block-per-block alignment, and do not alter original zh Markdown.

**Translations contain no fenced background/audio cue blocks, expression tags, new illustrations or new sounds**: the existing compiler inherits all visual/audio fields from the zh scene automatically. Add aliases/glossary entries only if necessary for compilation.

### 3. Automated local validation

- Run `bun compile:stories`. Fix any entry-count/speaker mapping errors in English source, **never** by changing zh to satisfy the translation.
- Extend `packages/stories/src/__tests__/locales.test.ts` with a focused `train_adventure` regression for the exact scene IDs `b1a_act4`, `b1a_act5` and `b1a_act6`. Assert all three now use English mirror text, entry counts and `characterId` sequences match zh, and existing backgrounds/portraits/SFX/BGM still match.
- Assert the existing English first and next Crossroads labels remain present. Avoid a brittle broad “ban all Chinese code points” test; use actual localized text assertions and the compiler's alignment checks.
- Run `bun --filter @aquila/stories test src/__tests__/locales.test.ts`, the relevant compiler tests, and `bun --filter web build` plus touched workspace lint checks.

### 4. End-to-end and visual checks

Extend the **existing** `packages/e2e/tests/reader-crossroads.spec.ts` with one focused desktop Chromium scenario:
1. Use the English signed-out reader at the end of `act3` with second language **Off**.
2. Open Crossroads, select **Step off onto the platform**, assert navigation to `b1a_act4` at dialogue 1 with English speaker and English narrative text.
3. Verify representative first/mid/final lines in Acts 4, 5 and 6 via canonical URLs. The next choice at Act 6 must show the existing English prompt/options.
4. With Chinese secondary enabled on a translated Act 4 line, verify English primary vs Chinese secondary; no duplicate source-Chinese line, and turning secondary Off does not replace the English main text.
5. Switch text/visual modes at the same position and ensure text, scene ID, and dialogue index do not change.

Run the E2E flow through **Playwright MCP**, not only unit tests; capture screenshots in English text mode, visual mode, and bilingual mode. No Linear mock-up exists for this content task, so the screenshot visual check should assess English speaker labels, complete legible dialogue, distinct bilingual line, and lack of clipping/overflow. Use one desktop browser platform; no native device farm, new release gate or new Playwright runner.

## End-to-end acceptance criteria

- [ ] All dialogue entries in `b1a_act4`, `b1a_act5` and `b1a_act6` have aligned English mirror text and correct speaker names; no Chinese fallback in these three scenes.
- [ ] `bun compile:stories` succeeds with one-to-one scene alignment; `characterId`, background, portrait, audio, and scene flow are unchanged.
- [ ] Focused locale/compiler tests pass and fail if any of the three translation files are removed.
- [ ] **Playwright MCP E2E:** signed-out English reader takes `act3` → **Step off** → `b1a_act4`, reads representative lines in Acts 4–6, reaches the English choice at the end of Act 6, and preserves URL/progress.
- [ ] **Playwright MCP E2E:** English-primary + Chinese-secondary renders distinct language lines, and second language Off leaves English content visible.
- [ ] **Automated visual screenshot check (no mock-up):** one English text-mode, one visual-mode, and one bilingual screenshot are inspected for readable English labels, layout, no clipped dialogue, and distinct secondary translation; link evidence in this PR without human sign-off.
- [ ] Existing Crossroads regression and relevant unit/compiler/build/lint checks pass. No artwork, SFX, backend, or reader-architecture changes. **One PR for ticket HPA-819.**

## Risks / explicit non-goals

- **Partial mirror:** the English language setting does not guarantee all downstream branches are translated. Do not quietly expand the PR to deeper storylines or call the entire route localized.
- **Speaker aliases:** English descriptive labels must map to the correct existing character, not just visually resemble the zh label.
- **Source cue blocks:** zh art prompts can be very long; they are **not dialogue entries** and must not appear in translated Markdown.
- **Reader UX:** unrelated HPA-821 issues, including clipped long bilingual text, are not redesigned here; regression screenshots can identify issues to track separately.
