# HPA-1131 — Characters page and story-notes foundation

**Status:** Proposed design and implementation plan only; this draft PR does not implement the feature.

- **Linear:** https://linear.app/cwchanap/issue/HPA-1131/add-a-characters-page-built-on-story-notes-pilot-platform-acts-1-3
- **Review:** https://github.com/cwchanap/aquila/pull/149#pullrequestreview-6009534645 — all seven findings incorporated into the plan below.
- **Baseline rechecked:** cwchanap/aquila main at 64e39975c340177b7bd59b2cd163d0d229548d03 (2026-11-21 local / November 22 UTC). Refresh main and issue before implementation; the review confirmed none of the relevant code seams changed since the original baseline.
- **Visual source of truth:** HPA-1131's attached **Characters & Mysteries mock-up** (desktop Characters view, phone cards/detail, entry points, reader sheet and spoiler states); implement **only Characters** here. Standalone page uses initials in this first slice instead of runtime portraits, as explained below.
- **Delivery:** **one PR for this entire ticket**. Add implementation, tests, screenshots, MCP evidence and review fixes to PR #149, not to a second PR. No art or SFX generation is part of this ticket.
- **Dependencies:** None. This unlocks HPA-1132 (Mysteries/toasts) and the follow-on notes content tickets.

## Goal, in and out

Readers can open a **Characters** page while reading or via **My Progress**, see only character identities and facts supported by completed story progress, and return to the same place in the reader. Notes are static, compiled story content, not a new service or a writeable achievements store.

**In:** simple per-story notes Markdown; Chinese dialogue unlock fences and implicit character-meeting events; compiler-generated small note data; a pure spoiler-safe selector built on the existing story-map ancestor walk; shared responsive Characters UI hosted on a page and in ReaderShell; Notes button, My Progress chip for stories that actually have notes; localizations and The Platform at the End of the World Acts 1–3 pilot; targeted unit/component/browser E2E and visual acceptance.

**Out:** Mysteries tab, toast/dot/New markers, notes for later Acts 4+ or other stories, new storage or progress API, database, sync migration, new voice/audio/art assets, generalized note CMS, and unrelated reader refactors. HPA-1132 extends this foundation later; do not scaffold an unused mystery feature now.

## Current repository seams

| Concern | Location | Minimal proposed change |
| --- | --- | --- |
| Character metadata | packages/stories/src/compiler/parse-characters.ts, resolve-character.ts | Use the existing ParsedCharacterDirectory for canonical zh names and ID validation; derive known-as labels from parsed dialogue headers instead of authoring them repeatedly |
| Chinese scene compilation | packages/stories/src/compiler/parse-scene.ts, compile.ts, ir.ts, emit.ts | Parse “unlock” fences like sfx/bgm; collect scene ID, source path, entry index; emit small notes.ts alongside existing generated outputs |
| Mirror scenes and scanning | packages/stories/src/compiler/localize.ts, scan-story.ts | No scanner or alignment code change needed. notes/ files are outside act and locale roots; existing mirror checks enforce entry/speaker alignment and reject fenced source-only cues. Add a focused regression test |
| Note loading | packages/stories/src/async/registry.ts | Add a **Partial** map of notes importers (only train_adventure in this PR) and a tiny exported hasStoryNotes/story-note loader. Import generated notes data plus small flow metadata independently of dialogue payloads |
| Spoiler selector | apps/web/src/lib/story-map.ts, new apps/web/src/lib/character-notes.ts | Export **passedSceneIds** using existing indexFlow/addAncestorChain; select unlocks with strict ancestors/endings and current-line cutoff |
| Progress | apps/web/src/lib/story-progress.ts, story-progress-store.ts, story-progress-view.svelte.ts | Read visited, endings, sceneId and dialogueIndex; no writes, fields, API or migration |
| Reader host | apps/web/src/components/ReaderShell.svelte, ReaderSettingsMenu.svelte, StoryMapSheet.svelte | One Notes button beside Settings; one sheet owned by ReaderShell, reusing overlay guards, focusTrap, existing audio and reader state |
| Standalone page | apps/web/src/pages/[locale]/notes.astro and shared Characters components | /[locale]/notes?story=... with no tab parameter; use owner-scoped StoryProgressView and an initials avatar |
| My Progress | apps/web/src/components/MyProgress.svelte | Conditional sibling Characters chip/count on started stories **with notes** only; fix the existing full-row anchor without nested interactive elements |
| Localization | packages/stories/src/translations/en.json, zh.json, ja.json | UI labels and empty/locked states; localized names/facts from compiled notes with zh fallback |

**Compilation layout:** raw/&lt;story&gt;/notes/zh.md plus optional raw/&lt;story&gt;/notes/en.md and raw/&lt;story&gt;/notes/ja.md. Do not put notes/ inside en/ or ja/ dialogue roots. Generated files under packages/stories/src/generated/ remain gitignored and are rebuilt by the existing pipeline.

## Authoring and generated data contract (KISS)

1. Use a deliberately small, hand-written Markdown parser; no YAML, schema library, CMS or new dependency. One character section starts with “## &lt;character_id&gt;”, followed by optional “hidden: true” (default false) and “- &lt;fact_id&gt;: &lt;text&gt;” lines. Only zh defines the IDs, hidden flag and facts. zh **does not author name or known-as**.
2. Each character ID must exist in the existing ParsedCharacterDirectory from docs/characters.md; the canonical zh display name comes from its **name** field. Narrator is excluded from character cards. Character IDs/fact IDs are stable, lowercase underscore keys. A fact ID is unique within its character. Missing en/ja fields fall back by ID to zh text (not by position).
3. Optional en/ja notes sections can provide **name: &lt;translated canonical name&gt;** and translated fact text for existing IDs only; they cannot declare a new character/fact, override hidden flags or supply a known-as field. This is the only localized name text not already present in the existing script/registry. Use trainAdventure/docs/translation-glossary.md for correct English and Japanese names.
4. A Chinese-only one-line fenced block “unlock” targets one stable ID (e.g. “li_jie.age”, “li_jie.name” or “li_jie.met”), immediately before the dialogue entry that reveals it. Multiple adjacent fences are legal, and the same key may appear on several routes. A marker is **not** a dialogue entry and does not change line indices, translations, speaker IDs, expressions, backgrounds, SFX/BGM or story flow. Reuse the existing pending-cue parser convention and fail if a marker remains unconsumed at scene end. Existing localize.ts already disallows fences in en/ja mirror dialogue.
5. Meeting is implicit on **every spoken line** of a declared character, so on any route the earliest reached dialogue line for that character counts as met; a .met marker also works for an early appearance before speaking. Any .name or fact marker **implicitly meets** the character at the same line, avoiding facts on anonymous un-met cards. Treat repeated meeting events as idempotent.
6. **Derive known-as labels rather than authoring them.** Capture the triggering spoke-line displayName from parsed zh and mirror scene entries. Normalize suffixes (e.g. inner-thought or “voice” postfix) via the existing stripSuffix logic in resolve-character.ts, exposing only the smallest reusable helper needed. Use the label from the actual first **reached** speaking event on the reader's route, not a globally first source file that could be in an unvisited branch. Localize from the entry at the *same* scene/index in a translated mirror, with zh fallback when that scene is untranslated. Until .name unlocks, show the derived descriptive label and “Name ???”; suppress the canonical name and identifying portrait. If a character never speaks but is met through a .met marker, display a neutral anonymous label until the name is revealed rather than adding an authored known-as field.
7. Store compact compiled character definitions and per-line events (sceneId, sourcePath, zero-based entryIndex, target ID, localized presentation label where relevant) in generated/&lt;story&gt;/notes.ts. Reuse the existing collection-style locations from audio-usage.ts. Provide the **small generated flow** to the selector with the notes loader without importing dialogue bundles for the page or progress list.
8. Fail build with a useful source location for unknown character/fact, duplicate IDs, malformed/dangling markers, facts or explicit names never unlockable on any route, orphan en/ja IDs, and any character that can **never be met** (neither a spoken line on any compiled route nor an explicit .met marker). A valid repeated marker on two branches is not a duplicate definition. Test that zh entries still align with en/ja in entry count and speaker; do not implement a second mirror-alignment checker.
9. Other stories have no notes importer in this ticket. A missing notes story has no Characters chip in My Progress and no Reader Notes trigger; a manually entered notes URL for it shows a localized empty/unsupported state. The importer map is Partial&lt;Record&lt;RegisteredStoryId, NotesImporter&gt;&gt; beside the existing storyImporters.

## Spoiler safety: one shared proof-of-passage rule

**Critical review fix:** Visited means **entered**, not finished. A reader may enter Act 3, stop at line 5, and jump to Act 1; sync can also union an unfinished Act 3 from one device with Act 1 as the current saved position. **No non-active visited scene may unlock its later lines merely because it appears in visited.**

Add **passedSceneIds(flow, progress, currentSceneId)** beside visibleSceneIds in apps/web/src/lib/story-map.ts. Reuse the existing indexed flow/ancestor traversal; do not build a separate graph walker. It identifies:

- **Passed in full:** strict ancestor **scenes** of each reached scene in the union of progress.visited and the current scene. Also include completed progress.endings **and their strict ancestors**. The ending scene itself counts as completed only when recorded in endings.
- **Current in-progress:** events in the active scene with event.entryIndex ≤ its current displayed dialogueIndex; **unless** that scene is already in the fully passed set, in which case all of its events remain unlocked (e.g. jumping back from Act 3 to replay Act 1 at line 1).
- **All other scenes:** locked. In particular, a visited but unfinished **non-active** scene is not passed. Never use visited-array insertion order or freshness timestamps as proof of completion; cloud unioning makes that unreliable.

This selector lives in **apps/web/src/lib/character-notes.ts** and receives notes, the lightweight flow, StoryProgress and optional ReaderShell live position. A standalone page and My Progress use the current saved position and progress. It returns one spoiler-filtered model for counts, met/secret/hidden/known-as/name/fact states and act provenance. An item can unlock through the same target on any completed route; a later unreached marker cannot unlock it.

**No progress migration.** The visited ledger may be absent or trimmed; ancestors of a known current scene and recorded endings still count, while unsupported facts stay locked. Known conservative limitation: facts from an unfinished scene you left and did not complete may disappear until you return or pass that scene. That is preferable to a spoiler leak and can be handled without new storage.

The graph is currently tree-shaped; existing story-map code already warns on merged paths and keeps the first parent link. Reuse that assumption here; merged-graph support is out of scope.

## UI and behavior (per Linear mock-up)

**Desktop:** scrollable cast side rail with round avatar/initials, display label and revealed-fact count; selected detail card with revealed facts and act labels, portrait region roughly 40% when a portrait provider is available, and blank bars for locked facts. Unmet non-hidden characters are anonymous “?” entries. Hidden twist characters are omitted from list/total until met. Do not render a dead Mysteries tab.

**Phone:** three-column character grid; tap an entry to view a full-screen detail with portrait or initials on top, Back/Close, no horizontal overflow, safe-area padding and minimum 44px touch targets. Render only unlocked names and facts in text/alt/aria and DOM; don't merely blur spoilers.

**Shared presentation:** one Characters component with a **portraitUrl(characterId) => string | null** callback. The in-reader sheet uses the already active visual runtime **if available**, otherwise initials. Standalone Notes page and My Progress use **() => null**, showing initials; **do not** initialize createVisualRuntime or fetch a visual release pointer just to show a page/count. This intentionally diverges from the art-heavy mock-up for standalone pages until a later task provides a lightweight portrait provider; do not add art work to this implementation.

**Reader:** the existing ReaderShell renders Settings once for all modes. Add one sibling 44px Notes trigger immediately left of Settings, not three separate buttons or a Settings row. Put notesOpen in the existing leafDisabled, triggerUnavailable and mutually exclusive overlay guards (settings/map/crossroads/endings). Reuse focusTrap and focus restoration; Close/Escape/scrim must not alter reader URL, scene, dialogue index or saved position. Underlying keyboard or pointer input must not advance dialogue while Notes is open. **Do not unmount/recreate reader or dispose/pause/stop the active voice/BGM runtime when opening or closing Notes.** Do not display the trigger for stories without notes.

**Standalone:** /[locale]/notes?story=train_adventure (no tab parameter). Validate story via existing isRegisteredStoryId; if absent/unsupported, show a localized selection/empty state, not the default story's data. Use the same Characters view and owner-aware StoryProgressView as My Progress. HPA-1132 can add a tab parameter when it adds an actual second tab; default remains Characters.

**My Progress:** Only started stories with a notes importer gain a separate Characters chip with an unlocked-character count. Existing rows are one anchor; refactor a row wrapper to contain **sibling** destinations (Continue link and Characters chip), preserving styling, focus and all other behavior. Never nest an anchor within another anchor. Do not import every story's dialogue or visuals for counts.

**Localization:** UI in en/zh/ja, compiled note text with per-field zh fallback, known-as labels from the corresponding compiled translated dialogue header (without loading dialogue at runtime), and generic initials/silhouette for missing/hidden portrait. A descriptive alias, canonical name, or metadata from a hidden character must not leak through accessible names or image URLs before its reveal.

## One-PR implementation sequence

Every implementation and review-fix commit remains in **PR #149**, keeping intermediate tests green.

1. **Compiler and notes importer.** Add the minimal notes grammar, source-only unlock fence, generated note collection and small flow access. Derive character name/known-as and meeting events from existing character registry and scene IR, including mirror labels; no separate alignment checker or scanner changes. Add fixture/negative tests before writing pilot content.
2. **Passed-set and pure selector.** Export passedSceneIds via existing story-map index/ancestor code. Add pure character-notes.ts with event projection, identity/hidden/fact states and per-field zh fallback. Unit-test marker boundaries, completed ancestors, current scene, jumping back from an unfinished scene, cross-device merged visited, missing visited, alternatives, known-as/name and locked content. Do not add persistence fields.
3. **Pilot notes content.** Write zh notes for Platform Acts 1–3 and appropriate English/Japanese mirrors; add zh unlock markers only where the text actually introduces each fact or identity. Review against docs/characters.md, translation glossary and original lines. Keep every post-Act-3 note out of scope.
4. **Shared Characters view + page.** Build responsive cast/detail component, locale/empty/secret states and the standalone /[locale]/notes page. Reuse one character UI with injected portraitUrl; page defaults to initials. Add unit/component tests against known mock-up states.
5. **Reader and progress entry points.** Add one Notes trigger and sheet to ReaderShell, wire overlay focus and input guards, ensure audio runtime is untouched. Add conditional My Progress sibling Characters chip/count. Cover audio no-stop/no-dispose and no reader remount in a ReaderShell component test.
6. **Web E2E and visual acceptance via MCP.** Perform the two browser flows below with Playwright/browser MCP on **one supported web platform**. Capture desktop 1440×900 and phone 390×844 views and visually compare card states/layout against the attached Linear HTML mock-up. Note the approved initials-only page fallback rather than treating it as a missing asset. Attach evidence to PR #149.
7. **Quality gate.** Run bun compile:stories, bun --filter @aquila/stories test, bun --filter web test, bun --filter web test:coverage, bun lint, bun build and the focused Playwright checks. Record actual command/CI evidence. Draft-only CI must not be assumed green: trigger relevant checks when possible and report any unverified gate.

## End-to-end acceptance criteria

- [ ] **Compiler:** bun compile:stories passes with notes enabled, no changed story graph, audio/image cues, dialogue counts, speaker identities, translation provenance or scene indexing. Negative fixture tests catch unknown/duplicate/orphan/dangling/untriggered targets, impossible-to-meet characters, and unexpected note files as acts. Repeated route unlocks are valid; en/ja fences still fail existing mirror validation.
- [ ] **Selector unit matrix:** first-read current scene unlocks exactly at the specified entry; a visited but unfinished Act 3 at line 5 does **not** unlock its later events when the reader jumps back to Act 1; an account sync union with Act 3 visited and Act 1 current also does **not** reveal those later events.
- [ ] **Replay/branches:** strict ancestors and explicit completed endings are fully unlocked; revisiting Act 1 after reaching Act 3 retains earlier notes from its first line. Distinct route markers for one ID union safely. A trimmed/legacy visited list fails closed for unsupported facts. Hidden characters, unknown names, and future facts never appear in rendered DOM, alt text or aria labels.
- [ ] **Compiler and component fixtures:** speaker alias/known-as comes from actual localized first encountered speech in each branch, and is not hardcoded in notes; zh names from the character registry, en/ja canonical names optionally from mirrors; a .name or fact marker implicitly meets its character, and an unreachable/unmet note definition fails compilation.
- [ ] **ReaderShell component:** opening and closing Notes preserves the mounted reader, does not invoke BGM/voice pause, stop or dispose, restores focus and blocks background input. Works in text/VN modes on desktop/phone with one button and sheet.
- [ ] **Browser/Playwright MCP E2E flow A:** read Platform to a pilot marker, open/close Notes in text and VN modes, confirm exact story/scene/line, URL and saved progress unchanged and keyboard progression blocked while open; smoke-test one unlock boundary. Audio isolation is primarily proven by the cheaper component test above.
- [ ] **Browser/Playwright MCP E2E flow B:** start a signed-out Platform session, visit My Progress, select the separate Characters chip, go back, Continue, and verify position/counts. Verify that a started story without a notes importer has no chip and that links are accessible siblings. Use existing account-scoped fixtures in unit/component tests rather than another redundant E2E scenario.
- [ ] **Localization/UI:** en/zh/ja labels and per-ID zh fallback work; unsupported stories/invalid story IDs show their own empty state; no Notes trigger/Characters chip for stories without notes. The reader overlay and standalone page use one shared UI.
- [ ] **Visual acceptance:** browser/Playwright MCP screenshots at 1440×900 and 390×844 compared against HPA-1131's HTML mock-up for cast rail/detail, 3-column phone grid/detail, reader sheet location, locked and secret states, close controls, labels and no overflow. Standalone page initials rather than full runtime portraits are an explicit scope decision. Record visual outcome and screenshot links in the PR.
- [ ] **Automated gate:** stories/web tests + coverage, lint, compile/build and focused E2E pass with evidence on **the same PR**. No human approval criterion, native build or new art/SFX is required for this web-only change.

## Review disposition and trade-offs

The review at https://github.com/cwchanap/aquila/pull/149#pullrequestreview-6009534645 raised seven substantive changes; **all accepted**: (1) strict passed proof to close jump-back/sync spoiler leaks, (2) derive names/aliases rather than triplicate them, (3) injected portrait provider with page initials, (4) impossible-to-meet validation and implicit met at fact/name marker, (5) conditional importer/chip, (6) no placeholder tab parameter, (7) unit/component-first verification with two browser journeys.

**Conservative limitation:** an unfinished scene you exit is not fully unlocked, and its partial facts might disappear until re-entered or a descendant is reached. The existing progress schema cannot express per-scene partial completion; do not add a migration or event store merely to retain those facts.

**Existing tree limitation:** story-map already treats merged graph paths as unsupported; reuse it instead of building a second graph engine.

**No speculative work:** no generic note registry outside the one generated-file format, no new network service, no image/audio generation, and no platform-specific acceptance for a web-only change.
