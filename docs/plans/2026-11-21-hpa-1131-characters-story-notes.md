# HPA-1131 — Characters page and story-notes foundation

**Status:** Proposed design and implementation plan only. This draft PR does not implement the feature.

- **Linear:** https://linear.app/cwchanap/issue/HPA-1131/add-a-characters-page-built-on-story-notes-pilot-platform-acts-1-3
- **Baseline inspected:** cwchanap/aquila main at a7b473ba2056f4c9d0463fe7046fd0df84876629 (2026-11-21). Refresh main and the ticket before implementation.
- **Source of visual truth:** HPA-1131's attached **Characters & Mysteries mock-up (open in a browser)**, especially the desktop Characters layout, phone cards/detail, entry points, in-reader sheet and spoiler states. Implement only the Characters portions in this ticket.
- **Delivery:** **One PR per ticket.** Extend this draft PR with the implementation, unit tests, MCP end-to-end evidence, screenshots and review fixes; do not create a second implementation PR.
- **Dependency:** None. This task unlocks HPA-1132 and four follow-on character/mystery content tickets. It is independent of the current art PR #148 and does not generate images or SFX.

## Outcome and strict scope

Readers can open **Characters** while reading or from **My Progress**, see only people and information they have reached, and return to the same story line. The notes feature is compiled from authored story files, not a new service or mutable achievement store.

**In this PR:** one character-notes authoring contract; compiler markers and validation; generated per-story notes and a small pure unlock helper; the Characters UI; reader Notes button/sheet; one localized page and My Progress chips; Chinese pilot notes for The Platform at the End of the World Acts 1–3 and English/Japanese mirrors where appropriate; unit, component, and web E2E tests.

**Out:** Mysteries tab, toasts, Notes dot, “New” tags, notes for later acts/other stories, external note editing, account data-model changes, new API/database, new asset-art pipeline or SFX, and unrelated reader refactoring. The future HPA-1132 should reuse the same note IDs, unlock locations and presentation host; this task does **not** implement its features.

## Repository seams (verified against the baseline)

| Concern | Existing location | Smallest change |
| --- | --- | --- |
| Authoring and compile | packages/stories/raw/trainAdventure; packages/stories/src/compiler/parse-scene.ts, compile.ts, ir.ts, emit.ts | Read a sibling notes folder and gather per-line unlock locations while parsing Chinese scripts |
| Localized story discovery | packages/stories/src/compiler/scan-story.ts and localize.ts | Keep notes/zh.md, notes/en.md and notes/ja.md together outside the story-act scans; add a regression test proving neither scanner treats these as acts/mirrors |
| Story content packaging | packages/stories/src/generated (gitignored), packages/stories/src/async/registry.ts and package exports | Generate small notes data independently of heavyweight dialogue; add a narrow lazy story-notes import for page and sheet |
| Saved progress | apps/web/src/lib/story-progress.ts, story-progress-store.ts and story-progress-view.svelte.ts | Read current saved visited/sceneId/dialogueIndex and live reader position; do not add any stored fields |
| Reader host | apps/web/src/components/ReaderShell.svelte, ReaderSettingsMenu.svelte and StoryMapSheet.svelte | ReaderShell owns a separate Notes overlay; trigger immediately left of the fixed 44px Settings button |
| Progress host | apps/web/src/components/MyProgress.svelte and pages/[locale]/progress.astro | Add Characters count and separately clickable chip per started story |
| New page | apps/web/src/pages/[locale]/ | Add notes.astro, e.g. /en/notes?story=train_adventure&tab=characters, with the same hydrated Characters view |
| Translations | packages/stories/src/translations/en.json, zh.json, ja.json | Localize headings, unknown/locked/empty states, page and button labels; preserve existing locale routing |
| Visuals | packages/stories/src/runtime-assets/paths.ts and existing web visual resolver | Reuse a current character base portrait where available; otherwise initials. Unknown rows use CSS silhouette, no generated art |

The entire My Progress row is currently an anchor. **Do not nest another link inside it.** Make the Characters chip a sibling clickable element inside a non-anchor row wrapper, preserving the existing Continue/Read again navigation and keyboard behavior.

## Minimal authoring and compiler contract

1. Store source notes at **raw/&lt;story&gt;/notes/zh.md**, and optional note text mirrors at **raw/&lt;story&gt;/notes/en.md** and **raw/&lt;story&gt;/notes/ja.md**, exactly as the Linear issue specifies. These files live outside the existing localized act trees, so neither scan-story.ts nor localize.ts should require a production change. Add a regression test asserting that they are not treated as story acts or stray translated scenes.
2. Keep a deliberately simple Markdown grammar, implemented by a small parser in the compiler, not a new CMS or generic Markdown schema. Use an explicit, minimal grammar: each section starts with “## &lt;character_id&gt;”, followed by “name: &lt;display text&gt;”, optional “known-as: &lt;initial display label&gt;”, optional “hidden: true” (otherwise false), and zero or more “- &lt;fact_id&gt;: &lt;fact text&gt;” lines. Example section: heading “## li_jie”, field “name: 李杰”, fact line “- age: 李杰今年二十八歲。” A fact ID is a lowercase snake_case key unique within its character. zh declares structural fields and the canonical IDs; en/ja sections may replace name/known-as/fact text for existing IDs but cannot add or alter hidden flags or introduce new IDs. A missing localized field falls back to the matching zh field. Lock this grammar with parser fixtures, not a YAML or full-Markdown dependency.
3. Reference the canonical speaker IDs in docs/characters.md (e.g. li_jie, tanaka_kenta, suzuki_asuka); preserve the existing locale glossary for names and Japanese forms. Narrator does not become a character card. The character ID and fact IDs must be stable across all locales, so per-field missing translations fall back to zh.
4. In Chinese dialogue scripts only, support the same fenced-block placement pattern as existing SFX/BGM. One block has one target, e.g. the target “li_jie.age” within an unlock fence, placed immediately before the revealing dialogue entry. Multiple adjacent unlock fences are allowed. Also allow “li_jie.name” and “li_jie.met” for an earlier visual introduction. No unlock fences are required or allowed in en/ja dialogue mirrors; markers do **not** count as dialogue or change dialogue indexes, speakers, backgrounds, audio cues, or flow.
5. For character notes, the first *spoken* dialogue entry of a declared character implicitly marks that character as met; an explicit met marker can reveal someone seen before speaking. A known-as label is shown until the name marker is passed; the real name and portrait must not appear in the UI before that point. Unmet non-hidden characters render as anonymous secret placeholders; hidden twist characters are omitted from rows and totals until met.
6. Produce small typed generated data per story: character definitions, fact IDs/text per locale, and unlock events keyed by **sceneId + zero-based dialogueIndex**. Name/alias reveal events and automatic first-speech introductions use the same event shape. Multiple occurrences of the same target on different routes are legal (logical OR). Preserve the authoring source location for compiler errors and the scene ID for the act label.
7. The build fails for duplicate/unknown character or fact IDs, invalid targets, trailing unconsumed unlock fences, a fact or explicitly unlockable name without any trigger, and orphan en/ja note IDs not in zh. Confirm all translated dialogue aligns exactly with zh before and after inserting markers. The existing scan of raw story acts must never parse notes/*.md as scenes. Do not add a dependency or modify generated files by hand.
8. Lazy-load only the selected story's small generated note module on the page; do not import every dialogue bundle to show cards/counts. Stories without authored notes return an empty notes result and a localized empty state, not a missing-module crash. Keep a thin, character-only model now; HPA-1132 can extend it with mystery entries later.

## Unlock evaluation, no new persisted state

Define one pure helper, conceptually **selectUnlockedCharacterNotes(notes, progress, flow, livePosition?)**. It accepts authored note events, the existing StoryProgress record, the lightweight story flow graph, and optionally the live position from ReaderShell.

- Non-active scenes in the **visited** ledger are treated as explored and fully unlock their note events. For the **active scene**, permit full unlock only with evidence that the reader already passed its end: a subsequently reached descendant scene in the existing flow graph, or a reached ending for that scene. Otherwise reveal only events with dialogueIndex less than or equal to the current on-screen index.
- This supports jumping back to Act 1 after visiting Act 3 (Act 3 is a visited descendant) while preventing future-line spoilers on the first visit to Act 3. Use the existing scene graph; no new high-water storage is required.
- **Do not use visited-array order as completion evidence.** Cloud progress merges union arrays from different devices, so the last array element is not reliably the newest scene. The visited array also contains the currently active scene immediately after record(), which by itself is not permission to reveal future events.
- The record has only one current dialogue index, **not a per-scene high-water index**. When evidence of prior completion of the active scene is unavailable, cap that scene at its current position rather than guessing; spoiler-safe conservative behavior takes precedence. Document this limitation rather than introducing a new progress schema.
- A record lacking visited (old seed, trimmed map or failed read) reveals only facts supported by the currently known position, never all future notes. Missing/no-progress stories show locked or secret states. Reuse existing account-scoped progress and cloud union behavior unchanged.
- Compute displayed card states, counts and localized fact rows from the same helper on the reader sheet, standalone page and My Progress. Notes counters count revealed facts and met non-hidden characters only. Branches union unlock events by note target.

This is a view over the current progress contract, **not** an event store. No migration, background sync, new storage key or new API route.

## Reader and page UI specification

**Desktop (mock-up reference):** one vertically scrollable cast rail with circular avatar, display label and revealed-fact count; a wide selected-detail panel with the full portrait at roughly 40% of its content area, revealed facts plus act provenance, and generic blank bars for locked facts. Unknown non-hidden people are anonymous “?” rows at the bottom. Hidden characters do not occupy space. Only a Characters tab is visible; do not render a dead Mysteries tab.

**Phone (mock-up reference):** a three-column character-card grid; tapping a character opens a full-screen detail with portrait on top and a clear Back/Close action. Preserve minimum 44px touch targets, scroll containment, meaningful alt/aria labels, and safe-area insets. Avoid horizontal page overflow and clipping in translated names.

**Reader sheet:** add a matching circular **Notes** button left of Settings in text mode, Visual Novel mode and on phones. Host the same Characters view in a modal/sheet owned by **ReaderShell**, not a second reader instance. Use the existing focus trap, Escape/scrim/close and focus restoration patterns. While open, block underlying keyboard/click progression, choices and conflicting overlays. Closing returns to the **exact** story/scene/index without touching URL or persisted progress. Keep the active audio runtime, voice and BGM playing; do not pause/recreate them when toggling Notes. Do not add rows to Reader Settings or a notification dot in this ticket.

**Standalone page:** /[locale]/notes?story=&lt;registered-story-id&gt;&tab=characters. Validate story input against the catalog; show an appropriate selection/empty state when missing/unsupported instead of silently falling back to a different story. Read the same owner-scoped progress view as My Progress. Use the app's existing page shell and locale routing.

**My Progress:** each started row gains a distinct Characters chip and discovered-character count that opens the notes page. Refactor only the row wrapper needed to make **two sibling interactive destinations** valid and keyboard accessible; preserve original row styling and Continue action. Do not show leaked names in a tooltip, alt text, screen-reader label or hidden DOM node.

**Images:** reuse the base portrait resolver from current runtime assets where possible. Missing/undelivered portraits render initials, while locked/secret rows use one CSS silhouette. Never add an external image generator, art task, binary in apps/web/public, or a new R2 path.

**Locales:** add the required en/zh/ja UI strings and pilot note mirrors. A missing en/ja fact or label uses zh text for that same stable ID; do not fallback by index or leak full names when unknown. Existing story dialogue localization stays unchanged.

## One-PR implementation sequence

All steps and subsequent review corrections are commits on **this same PR**. Keep intermediate commits testable rather than leaving intentionally broken tests.

1. **Compiler and fixtures.** Implement small notes parser, zh unlock fence support and compiled per-line events. Integrate with compile.ts/emit.ts and a narrow generated-notes entry point; keep generated outputs ignored. Add failure/success fixtures and prove scenes' line counts and mirror speaker alignment are unchanged.
2. **Pure progression selector.** Add types and one helper for event union, met/known-as/hidden/secret/fact states, per-field locale fallback, visited history and current line cutoff. Unit-test with synthetic progress and with pre-existing signed-out and account-scoped progress shapes; no persistence changes.
3. **Pilot content.** Write the Act 1–3 character notes and zh markers according to those exact scene lines; translate note text where corresponding acts have en/ja coverage. Verify every fact against the original act and current character glossary. Do not add story text for Acts 4+ or invent mysteries.
4. **Shared Svelte UI.** Implement a single Characters view, responsive cast grid/list and detail, initials/portrait fallback and empty states. Add [locale]/notes page and locale strings. Reuse components for the reader sheet rather than duplicating markup.
5. **Entry points and modal behavior.** Add the Notes trigger and modal lifecycle to ReaderShell; keep Settings, Crossroads and StoryMapSheet mutually non-conflicting. Refactor My Progress row minimally for the chip and count without nested anchors. Add focused component tests.
6. **E2E and visual evidence.** Extend packages/e2e with the flows below; perform **browser/Playwright MCP** acceptance on the web platform. Capture desktop and phone screenshots and compare to the attached Linear HTML mock-up and spoiler-state frames. Include the screenshots/results in this PR's evidence, not as new image-art assets.
7. **Final quality gate on the same PR.** Run the story compiler, stories/web unit tests and coverage report, lint, build, existing reader regressions and focused Playwright tests. If draft PR workflows skip E2E CI, run browser MCP acceptance explicitly and report CI as unverified until triggered; do not claim draft CI is green without runs.

## End-to-end acceptance criteria

- [ ] **Compiler integration:** bun compile:stories succeeds for pilot content; compiled scene IDs, entry counts, speaker identities, flow, choices, existing bg/sfx/bgm positions and translated-scene provenance remain unchanged.
- [ ] **Compiler negative tests:** an unknown unlock target, duplicate fact ID, orphan localized ID, dangling unlock block and authored fact with no unlock fail with actionable source paths. Valid repeated unlocks on alternative routes succeed. Notes files are never picked up as story acts.
- [ ] **Spoiler checks:** on a first reading of Platform Act 3, opening Notes before a later marker shows only earlier facts; advancing exactly to the marker reveals its fact; hidden names/portraits/facts do not appear in DOM, accessibility text or totals prematurely.
- [ ] **Visited/replay:** after reaching the end of Act 3, revisiting Act 1 preserves previously revealed facts at line 1. A legacy/trimmed progress record lacking visited does not reveal later notes. Alternative-route marker events combine without overwriting one another.
- [ ] **Known-as behavior:** a character met under a descriptive alias displays that alias plus “Name ???” until the explicit name marker; hidden characters do not appear in the cast count before met. Cover mechanics with unit/component fixtures if the pilot Acts 1–3 do not exercise all states.
- [ ] **Reader MCP E2E:** on a supported desktop web browser, read Platform to a pilot marker, open Notes from text mode and Visual Novel mode, inspect a card, close with Close/Escape, and confirm the exact story/scene/line, URL, progress and playable BGM/voice stay intact. Underlying keyboard progression does not fire while the sheet is open.
- [ ] **Progress-to-page MCP E2E:** start as signed-out, visit My Progress, open the separate Characters chip, return and continue reading; assert valid sibling links, counts and no nested interactive elements. Exercise supported account-scoped progress via existing fixtures; no extra sync request or migration.
- [ ] **Localization:** en/zh/ja UI labels render, localized note text wins where authored, fallback is zh for missing texts, and unsupported story IDs show a safe empty/selection state rather than another story's notes.
- [ ] **Visual acceptance with Linear mock-up:** use browser/Playwright MCP screenshots at approximately 1440×900 and 390×844 to compare desktop rail/detail, phone 3-column cards/detail, note sheet position and secret/locked states against HPA-1131's attached HTML. Verify no horizontal overflow, clipped portraits/text, blocked close buttons or obstructed reader dialogue. Add visual findings and screenshots to the PR.
- [ ] **Automated checks:** bun --filter @aquila/stories test; bun --filter web test; bun --filter web test:coverage; bun lint; bun build; targeted packages/e2e Playwright checks. Report actual results, without inventing a numeric coverage threshold.
- [ ] **Delivery boundary:** one PR contains implementation and all automated/MCP acceptance evidence; no new artwork, audio, database, storage keys, API or native-platform acceptance is required for this web-only change. **No human sign-off** is an acceptance criterion.

## Review focus and known trade-offs

- **Highest risk:** a first-visit current scene is already in visited; do not equate membership with permission to reveal its future lines.
- **Known limitation:** replaying the most recently reached, unfinished scene at an earlier line has no stored per-scene high-water mark or visited descendant. Conservatively reveal only up to the present line. Preserve the progress contract rather than overengineering a migration.
- **Accessibility:** secret values must be absent from rendered text and accessible names, not merely visually blurred. Test modal keyboard interception and focus restoration.
- **Performance:** no eager import of all story dialogues or story assets for the notes page/counts.
- **No speculative generalization:** keep the parser and notes API small; extend to mystery notes in HPA-1132 after this character pilot works.
