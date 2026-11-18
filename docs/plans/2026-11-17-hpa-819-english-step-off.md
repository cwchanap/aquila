# HPA-819 — Translate first step-off segment and suppress duplicate fallback text

**Status:** Revised design specification and implementation plan (review of 2026-11-17). **One draft PR for this ticket**: implement, test, provide evidence, and address all subsequent review feedback on this same PR. Do not open a separate implementation PR.

- Linear: https://linear.app/cwchanap/issue/HPA-819/first-choice-in-the-platform-at-the-end-of-the-world-leads-to-a-branch
- Review addressed: https://github.com/cwchanap/aquila/pull/139#pullrequestreview-5949178708
- Follow-up, outside this PR: [HPA-1142 — translate the next Act 7–8 segments](https://linear.app/cwchanap/issue/HPA-1142/translate-next-step-off-route-segments-act-7-8-into-english).
- Verified baseline: `main` at `bbf3e079f94bc0a53e816f12a9d453039b1ee469` (2026-11-17). Refresh from main before implementation.
- **No new artwork, SFX, voice, media publication, compiler/schema refactor, or new test framework.**

## Goal and narrow scope

On the English site, the first Crossroads option **Step off onto the platform** navigates to `b1a_act4` with untranslated Chinese narration and speaker names. With Chinese as the secondary language, an untranslated fallback also displays identical Chinese text twice.

In **this one PR**:
1. Author English mirror files for **Acts 4–6** of the step-off branch (`b1a_act4`, `b1a_act5`, `b1a_act6`), ending at its next existing choice.
2. Suppress identical whole-scene second-language dialogue across **all partially translated stories**, including future untranslated scenes, using the current shared second-language presentation helper.
3. Add narrow, provenance-based regression coverage and a small extension to the existing route-selection E2E; validate with Playwright MCP and one bilingual screenshot.

The later `branch_1a/branch_2{a,b}` stories are not translated here; **HPA-1142** covers the next three acts, and deeper story localization will be scoped in later small batches. Do not claim that HPA-819 makes the entire route, or the entire 495-scene story, readable in English.

## Confirmed behavior and design constraints

| Seam | What main actually does | Minimal response |
| --- | --- | --- |
| `raw/trainAdventure/en/` | Has Acts 1–3 and `branch_1b/`; lacks `branch_1a/` | Add exactly three mirror Markdown files |
| `raw/trainAdventure/branch_1a/act4–6.md` | Zh source: **73, 56, 46 dialogue entries**; has background cues that must not appear in translations | Preserve each source dialogue entry, speaker and position; do not change zh or image prompts |
| `raw/trainAdventure/ja/branch_1a/act4–6.md` | Existing Japanese mirrors also have **73, 56, 46 entries** | Compare to zh/English to resolve ambiguous beats and names; do not edit ja |
| `compiler/localize.ts` | Enforces one-to-one entry count and resolved character ID, rejects fenced blocks and expression tags, copies visual/audio fields from zh by index | Reuse unchanged; compiler already validates alignment |
| `compiler/emit.ts` | Emits `trainAdventureEnTranslatedScenes` containing **only genuinely authored English mirror scenes**; fallback scenes import zh | Test **provenance** instead of comparing character IDs, entry counts or text to zh |
| `apps/web/src/lib/reader-second-language.ts` | `alignSecondDialogue` accepts any equal-length scenes, even if both render the exact same fallback text | Suppress a duplicate entire second-language scene there, without reader leaf changes |
| `apps/web/src/lib/reader-manager.ts` | `getSceneData` spreads/clones dialogue arrays | Do **not** rely on array reference equality to identify duplicated fallbacks |
| `packages/e2e/tests/reader-crossroads.spec.ts:400` | Already selects `act3` option 0 → `b1a_act4` and verifies URL, progress and story map | Add only an explicit first English line assertion to that existing test |
| `apps/web/src/lib/__tests__/reader-second-language.test.ts` | Tests equal-length alignment and mismatched lengths | Add small same-text suppression and mixed-text preservation cases |

The **language-fallback** problem and the **English translation provenance** problem need different checks: displayed text equality is appropriate only to avoid showing identical second-language text twice. It is *not* proof a scene was translated—legitimate translations can be textually identical. Provenance comes from the compiler's `EnTranslatedScenes` export, not text comparison. The whole-scene equality guard only suppresses a second language when **every** dialogue line is identical, leaving a partially overlapping but genuinely translated scene visible.

## Implementation plan

### 1. Author three text-only English mirror acts

Create:
- `packages/stories/raw/trainAdventure/en/branch_1a/act4.md` — leaving the train and Emi's decision.
- `packages/stories/raw/trainAdventure/en/branch_1a/act5.md` — platform encounters and the departing train.
- `packages/stories/raw/trainAdventure/en/branch_1a/act6.md` — the survivors divide; next choice remains unchanged.

Use the source zh text, the `.agents/skills/translating-stories/SKILL.md` instructions, `docs/characters.md`, `docs/translation-glossary.md`, existing `en/act3.md` and `en/branch_1b/act4.md`. Preserve glossary names (Li Jie, Shimizu Emi, Jakkai Station, etc.), character voice and uncertainty. Use ASCII-colon English speaker blocks, **one per zh entry** with matching resolved speaker ID; include a translated act heading. Never copy fenced `bg`/`sfx`/`bgm` blocks or expression tags; source visuals/audio are inherited automatically.

**Content QA in this same PR:** review **all 175 translated entries** line by line against the original zh scene, consulting the aligned ja mirror when the meaning or speaker reference is ambiguous. Correct mistranslations rather than weakening tests. Record any unresolved ambiguities or suspected zh-source problems in the PR; do not silently change original prose. There is no human sign-off acceptance gate. Add a speaker alias/glossary term only if the compiler exposes a genuinely missing match.

### 2. Fix all-identical secondary-language display at one shared seam

In `apps/web/src/lib/reader-second-language.ts`, after the existing null/length check in `alignSecondDialogue`, return `null` when every corresponding `second[i].dialogue` and `dialogue[i].dialogue` are equal; otherwise preserve the existing return value.

This deliberately **deduplicates display**, and is not used to determine whether translations exist or change the main reading language. Avoid a new locale schema, browser-side provenance registry, or changes to individual leaf renderers. Test:
- Two distinct arrays with all identical lines → no duplicate second scene.
- Equal-length scenes with at least one different line (even if some lines match) → still show the second language.
- Missing/mismatched scenes → keep existing null behavior.

Do not use `second === dialogue`: `ReaderManager.getSceneData` clones arrays, so reference identity is not a reliable fallback signal.

### 3. Prove mirror coverage, without duplicating compiler tests

Run `bun compile:stories`. In `packages/stories/src/__tests__/locales.test.ts`, import the **compiler-emitted** `trainAdventureEnTranslatedScenes` from `../generated/trainAdventure/dialogue.en` and assert it contains `b1a_act4`, `b1a_act5` and `b1a_act6`. This is the same authoritative provenance as `translatedScenesIn` in `packages/stories/src/voice/cli.ts`, but avoids pulling the voice CLI's unrelated Node / ffmpeg dependencies into the locale test.

The check **must fail if any new English mirror file is deleted** and the compiler is rerun. Existing locale tests and the compiler already validate the full character-ID/background alignment, while the mirror compiler already copies portraits/SFX/BGM; **do not re-test those mechanically for every act**. No broad CJK-regex ban or whole-story completeness assumption.

### 4. Reuse current E2E rather than rebuilding it

In the existing `reader-crossroads.spec.ts:400` route-selection test, import generated `scenes/en/b1a_act4` (the build fails if it is not generated) and add a short first-line **English content** assertion immediately after the already-tested navigation to option 0, `b1a_act4`. Continue running the existing URL/progress/story-map assertions, not a parallel route E2E.

Keep existing `reader-crossroads.spec.ts:541` bilingual rendering test and `reader-visual.spec.ts` mode switching tests; do **not** add separate Act 5/6 deep-link loops or redundant visual fallback/404 tests.

For **end-to-end acceptance**, use Playwright MCP to execute the updated existing Crossroads scenario on desktop Chromium and check the bilingual presentation on one `b1a_act4` line. Confirm the English primary and Chinese secondary are different and a next untranslated scene does not show a duplicated secondary line. Capture **one bilingual screenshot** from the rendered reader and visually inspect it for actual English text, correct Chinese secondary, speaker labels and legibility; attach it to this PR as **evidence**, not a new pixel-diff/three-screenshot layout gate. There is no Linear UI mock-up. One platform suffices because neither platform-specific styling nor routing changes.

### 5. Validate and keep this PR small

Run:
- `bun compile:stories`
- `bun --filter @aquila/stories test`
- `bun --filter web test src/lib/__tests__/reader-second-language.test.ts`
- `bun --filter e2e test:e2e tests/reader-crossroads.spec.ts --project=chromium`, invoking the browser E2E via MCP for acceptance
- Relevant workspace lint/build checks; the existing full CI must remain green.

Keep all content/code/test edits and GitHub reviewer responses on **PR #139**. HPA-819 can be completed when this narrow scope is verified; [HPA-1142](https://linear.app/cwchanap/issue/HPA-1142/translate-next-step-off-route-segments-act-7-8-into-english) remains Backlog for the next segments.

## End-to-end acceptance criteria

- [ ] **Three English mirrors:** compiler generates `b1a_act4`, `b1a_act5` and `b1a_act6` with 73/56/46 entries, correct speaker identities and natural English; source zh, ja, art, audio and choice/flow data are unchanged.
- [ ] **Explicit provenance:** generated `trainAdventureEnTranslatedScenes` contains all three IDs. The test fails if any translation file is removed and the story is recompiled; unchanged generic locale/compiler tests pass.
- [ ] **Duplicate protection:** unit tests prove identical fallback scenes suppress the secondary language, but mixed-content translated scenes remain visible; missing/length-mismatched scenes continue to return null.
- [ ] **Content fidelity:** every translated entry is reviewed against zh, with ja as an ambiguity reference; any unresolved source ambiguity is documented in the PR rather than edited silently.
- [ ] **MCP E2E:** signed-out English reader selects **Step off onto the platform**, lands at `b1a_act4` with genuine English first-line text, and the existing automated URL/progress/story-map checks pass.
- [ ] **MCP bilingual acceptance:** one translated scene shows distinct English primary and Chinese secondary text, while a downstream untranslated scene no longer repeats the identical Chinese primary as its secondary.
- [ ] **Automated screenshot visual check:** one bilingual screenshot from the MCP browser is inspected for readable English/Chinese presentation and linked as PR evidence. No mock-up or human sign-off required.
- [ ] `bun compile:stories`, stories/tests, the existing targeted browser suite and relevant lint/build/CI pass. **One PR only**, no art, SFX or framework changes.

## Review disposition and scope boundary

- Accepted: global duplicate-secondary suppression in one helper; explicit translated-scene provenance; full line-by-line content review using existing ja; reuse existing browser tests; only one screenshot; track next segment now.
- Refinement: use the generated provenance constant directly rather than importing the voice CLI in unrelated tests; use dialogue **value equality for UI de-duplication only**, not as a translation-provenance heuristic.
- Deferred: the much larger remaining untranslated `branch_1a` tree. HPA-819 title/scope is intentionally the first segment, not the whole route. HPA-1142 is the immediate follow-up; further branches should be ticketed as similarly limited chunks.
