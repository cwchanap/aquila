# HPA-1132 — Mysteries tab and in-reader note notifications

**Status:** Proposed design and implementation plan only. This draft PR changes documentation, not application behavior.

- **Linear:** https://linear.app/cwchanap/issue/HPA-1132/add-a-mysteries-tab-and-in-reader-note-toasts-pilot-platform-acts-1-3
- **Baseline:** originally planned against `991316c7d76c312995682af5494bcc289e5cc364`; rechecked `main` at `9cb0329517bd29b178c39175e3d91c1427288b80` (2026-11-23, Vancouver). The five intervening commits do not change the reader, notes compiler, pilot source or Playwright specs; dependency/voice changes do not require redesign. Refresh the branch from `main` before implementation.
- **Design review:** [Round 1](https://github.com/cwchanap/aquila/pull/157#pullrequestreview-6032264469). All ten findings addressed below; committed CI tests and geometry checks complement, rather than replace, the required MCP end-to-end and mockup visual acceptance.
- **Prerequisite:** HPA-1131 is Done; the Characters/story-notes foundation is already on `main`.
- **Design source:** HPA-1132's desktop Mysteries, phone Mysteries, and VN desktop/phone toast mockups, plus its attached interactive **Characters & Mysteries** HTML mockup. The issue's visuals govern layout and placement.
- **Delivery:** Exactly **one PR for HPA-1132**. Implement the code, pilot notes, tests, screenshots and valid review fixes **in this same draft PR**; do not open a second implementation PR. The PR remains draft until implemented and verified.
- **Why this task next:** The foundation is complete and HPA-1132 unblocks HPA-1133, HPA-1134, HPA-1135 and HPA-1136. HPA-1130 is an independent ending-gallery track. No new artwork or SFX is required.

## Goal and scope

Extend the existing story-notes feature from Characters to Mysteries. Readers see unrevealed mysteries as anonymous slots, collect clues as they reach their lines, see answers only once revealed, and receive a four-second, non-blocking toast when **new** notes unlock during active reading. The Notes button shows a dot and individual opened items lose their New marker. This works on desktop text, phone text, and Visual Novel readers, plus the standalone Notes page.

**In:** authored/compiled mysteries with zh source and optional en/ja text mirrors; a compact mystery icon enum; the Mysteries tab and detail views; the My Progress Mysteries chip; the reader toast, dot and New state; pilot mysteries from `train_adventure` Acts 1–3; en/zh/ja UI strings; unit, component, E2E and MCP-browser visual evidence.

**Out:** content beyond Acts 1–3 or for other stories (HPA-1133–1136 and HPA-1119); achievements, synced opened status, cross-route hinting, new data service/database/API, general-purpose notes CMS, avatar art, audio and story rewrites. Do not modify the independent ending gallery HPA-1130. **No separate art task**: mystery icons come from existing in-code icons.

## Current code seams (verified on baseline)

| Concern | Existing location | Minimal extension |
| --- | --- | --- |
| Typed runtime notes | `packages/stories/src/notes-types.ts` | Add mystery records/events and the shared closed icon enum alongside character records/events. Preserve the small lazy payload. |
| Authoring and validation | `packages/stories/src/compiler/parse-notes.ts`, `build-notes.ts`, `parse-scene.ts`, `ir.ts` | Extend the existing Markdown and `unlock` fence parser; do not introduce another compiler or YAML format. |
| Story source | `packages/stories/raw/trainAdventure/notes/{zh,en,ja}.md`, `act1.md`, `act2.md`, `act3.md` | Pilot mystery definitions, source-language markers at evidenced dialogue lines, text mirrors. |
| Lazy loading | `@aquila/stories/async` and existing `loadStoryNotes` | Reuse current notes + flow importer, requested as soon as the reader's story is ready. No eager dialogue imports. |
| Spoiler-safe views | `apps/web/src/lib/character-notes.ts` and `story-map.ts` | Extract both `isReached` and `byDepth` from `selectCharacterNotes`; keep the existing `passedSceneIds` proof-of-passage rule. Add pure mystery view. |
| Notification state | new `apps/web/src/lib/note-notifications.ts`, existing `reader-mode.ts` `getBrowserStorage()` | Pure view-derived reveal-key projection and set operations; tiny injectable localStorage adapter, no navigation classifier. |
| Notes UI | `apps/web/src/components/Characters.svelte`, `NotesPage.svelte` | Add a tab host and separate Mysteries presentation; retain existing responsive Characters UI. |
| Reader integration | `apps/web/src/components/ReaderShell.svelte`, `MobileNovelReader.svelte` | Extend the single existing Notes sheet, route View to target, add notification/dot to the existing triggers; do not mount a second reader. |
| Progress entry point | `apps/web/src/components/MyProgress.svelte`, `apps/web/src/pages/[locale]/notes.astro` | Add a conditional Mysteries sibling chip and optional initial tab; use already loaded lightweight notes and progress. |
| Translations | `packages/stories/src/translations/{en,zh,ja}.json` | Tabs, mystery states, toast copy, New/solved/locked/accessibility labels. |
| Regression tests | `packages/e2e/tests/character-notes.spec.ts`, `reader-layout.spec.ts`, `.github/workflows/e2e-tests.yml` | Add committed `story-mysteries.spec.ts` using existing helpers, Playwright clock and layout assertions; normal non-draft CI executes it. |

## Minimal authoring contract

Keep character sections and character fences valid as they are. Extend the same `notes/*.md` files with **namespaced mystery sections**. Within a mystery every list item is a clue, so reuse the existing fact-line parser (`FACT_LINE_RE`), not a second list syntax:

```md
## mystery:long_tunnel
icon: hourglass
title: 無盡隧道
question: 為甚麼這段隧道沒有盡頭？
- elapsed_time: 列車已在通常只需五分鐘的隧道內行駛了二十分鐘。
- no_signal: 乘客的手機都無法傳送訊息。
```

- Only zh can declare mystery IDs, icon, clue IDs, presence of an answer, and order. En/ja sections may override `title`, `question`, the text of matching clue IDs and `answer` when present; missing translations fall back to zh **per field**.
- Mystery IDs and clue IDs are lowercase snake_case, unique in their scope; validate against the existing unsafe/reserved plain-object names policy. Reserve `open` and `answer` as clue IDs, just as character facts reserve `met` and `name`.
- Define and export `MYSTERY_ICONS = ['orbit', 'tornado', 'moon', 'moon-star', 'eclipse', 'hourglass', 'map-pin'] as const` and `MysteryIcon` in `packages/stories/src/notes-types.ts` (export through the package if needed). Use that single list for compiler validation and a typed, exhaustive `Record<MysteryIcon, Component>` mapping to the corresponding installed lucide-svelte components (verify component export names against the installed version). No nonexistent Spiral icon, external assets or second list.
- A mystery has a question, zero or more clues, and **optional** answer. No invented answers just to demonstrate a solved state. An undiscovered mystery contributes to count but exposes no name, icon, text, act, aria-label or tooltip before any of its events is reached.
- Extend **only zh dialogue source** `unlock` fences with the disjoint three-segment namespace below. A marker attaches to the next dialogue entry exactly as it does for characters. Existing two-segment `li_jie.age` / `li_jie.met` syntax is unaffected. The terminal segment is `open`, `answer`, or a clue ID.

~~~~md
```unlock
mystery.long_tunnel.open
```

```unlock
mystery.long_tunnel.elapsed_time
```

```unlock
mystery.long_tunnel.answer
```
~~~~

The last example is allowed **only** when an answer exists in the authored section. An explicit `open` marker is optional: any reached clue or answer also opens the mystery. Use `open` for a question-only reveal, not a redundant prerequisite.

Compiler rules: reject unknown/duplicate mystery or clue IDs, invalid icons, reserved IDs, missing required title/question, orphan mirror IDs, mirrors changing structural fields, malformed/dangling markers, clue/answer markers without a corresponding definition, mysteries with no event at all and authored clues/answers with no marker on any route. Do **not** require an explicit open marker or route-by-route open-before-clue/answer validation. Repeated markers for the **same ID on alternative routes are valid**. No marker changes a dialogue entry count, mirror alignment, background/audio cues or branching graph. Compiler diagnostics include source path/line where available.

**Runtime:** keep `StoryNotes.characters` + `events` unchanged in intent; add `mysteries` and `mysteryEvents` arrays rather than forcing mystery events through a fake `characterId`. Each mystery event records `sceneId`, zero-based `entryIndex`, `mysteryId`, `kind: open | clue | answer` and `clueId` for clue events. Generated payloads contain compiled localized strings and compact events, **not source paths or story dialogue**. Reuse existing story notes importer and cache.

## Spoiler-safe derived views

- Extract one small shared `reachedEvents(flow, progress, live)` helper from `character-notes.ts`, exposing `isReached` and `byDepth` for events with `sceneId`/`entryIndex`. **Passed** strict-ancestor scenes or completed endings unlock all their events; only events up to the displayed dialogue index unlock in the **currently active unfinished** scene. A visited-but-unfinished **non-active** scene is not proof of seeing its later lines. Honor the ReaderShell live position over the saved progress; use saved position on the standalone page. Preserve existing character identity/spoiler behavior.
- `selectMysteryNotes`: **undiscovered** when no event has been reached (count and anonymous slot only); **open** when *any* open/clue/answer event has been reached but no answer is reached (safe title, question, unlocked clue pips and act labels; no answer); **solved** when the answer event is reached (answer plus its act). A clue-first or answer-first branch must immediately expose the mystery; an explicit open event is not required. Never reveal unreached clues even when solved. For authored zero-clue mysteries, render no forced clue slots. An unanswered mystery remains open.
- Clues and answers can unlock on different routes through repeated same-ID markers. Reuse the shared `byDepth` comparator: flow depth, current-route preference, entry index and scene ID for deterministic act provenance. Do not infer chronological ordering from `visited`.
- Provide `revealKeys(storyId, characterView, mysteryView)` in `note-notifications.ts` **from the already filtered views, never raw events**: character `met`, `nameKnown` and `facts[].id`; mystery state != undiscovered, `clues[].id` and solved. Stable keys: `storyId/c/<id>/met`, `storyId/c/<id>/name`, `storyId/c/<id>/fact/<factId>`, `storyId/m/<id>/open`, `storyId/m/<id>/clue/<clueId>`, `storyId/m/<id>/answer`. A clue-first/answer-first discovery contributes the implied open key plus the reached clue/answer. The set deduplicates repeated events; no second spoiler filter for notifications.
- Reaching a later event must **not** expose spoiler text through the toast, selected object, URLs, labels, alt text or accessible names before its own unlock marker. Avoid passing raw unfiltered compiled mystery objects to UI components.

## UI design, mockup parity and navigation

1. **Single Notes host.** A small `NotesContent.svelte` (or equivalent) owns tabs, selected kind/id and opened callbacks and renders the existing `Characters` view or a new `Mysteries` view. Do not clone the reader sheet. Default to Characters for ordinary Notes links; **hide both Mysteries tab and chip entirely** when `notes.mysteries.length === 0`. Support optional `?tab=mysteries` on the standalone Notes route and a programmatic target for toast View.
2. **Desktop Mysteries:** follow ticket mockup: scrollable list with fixed icon on discovered rows, clue pips, solved check, and dashed anonymous slots; detail shows safe question, clue placeholders / discovered clue text and localized act labels, plus locked or revealed answer. Keep the existing sky-glass sheet sizing and layout.
3. **Phone Mysteries:** compact tile grid, full-screen detail sheet with safe-area padding, Back, focus trap/restoration and at least 44px interactive targets. Preserve the existing `Characters` phone behavior when switching tabs. No horizontal overflow, clipped text or secret labels.
4. **My Progress:** render separate *sibling* Characters and Mysteries anchors below the full-row Continue/Read again link. The Mysteries chip appears only when **authored** mysteries exist; its count uses the same spoiler-filtered model and same owner-scoped progress already loaded. Do not load story dialogue or attach new APIs.
5. **Reader:** retain the single ReaderShell sheet. View from an individual toast opens the appropriate tab and selects that item. Grouped View opens Notes on the first newly unlocked item's tab and selects that item; only the opened item's reached keys clear, and other items stay New; Close returns to the **identical story, scene, dialogue index, URL, progress record and reader audio state**. Keep scrim, Escape, keyboard trap and inert-background behavior.
6. **Visual status collision:** the existing `[data-testid="visual-status"]` pill occupies the top-right area below Notes/Settings. Anchor the toast below the Notes affordance on desktop/VN and relative to existing chrome on phone text mode; when a visual status is present, stack/shift the pill instead of overlapping or hiding either. Do not place toast over faces or the dialogue box. Keep pointer interaction scoped to View/close and let other reader input through.

## Toast and unread lifecycle

**Use persistent set difference, not a forward-transition classifier.** The small `apps/web/src/lib/note-notifications.ts` module owns pure `revealKeys`, `seed`, `diff`, `markOpened` and `unopened` operations. It is unit-testable with injected sets/storage; a tiny persistence adapter uses the existing `getBrowserStorage()` from `reader-mode.ts`. Keep ReaderShell limited to loading/snapshot coordination, wiring the module to state and rendering the toast/dot. No per-mode notification code.

- Required per-device sets: **announced** (reveal keys already observed/seeded, including notes silently restored) and **opened** (keys for details actually viewed). Persist them as one versioned localStorage record under a namespaced key, e.g. `aquila:note-notifications:v1`; stable keys already scope by story. Treat opened as announced too. Both sets are monotonic; neither may be used to unlock story text. Catch parse/read/write failures; fall back to the same in-memory sets for this session. No new server API, account sync or progress schema.

```ts
// Pseudocode: all reached keys come from the spoiler-filtered views.
seed(reached): announced = union(announced, reached) // silent
diff(reached): fresh = difference(reached, announced)
               announced = union(announced, fresh)
               return fresh
markOpened(itemReached): opened = union(opened, itemReached)
                         announced = union(announced, itemReached)
unopened(reached): return difference(reached, opened)
```

- **Load before opening Notes:** today `openNotes()` initiates `loadStoryNotes` and `notesModel` is null until the sheet opens. Move the existing cached lazy load to the supported, active/ready story lifecycle. Take one owner-scoped progress snapshot at activation, build the view at the current live position once the notes resolve, and silently seed it. Do not fire a toast for anything already unlocked at initialization, even if notes arrive late. Keep reader input nonblocking; reject stale story/load completions, retry on explicit Notes open or next ready activation, and retain the existing loading/error surfaces.
- Once seeded, reactive changes to the **set of reached keys** produce `fresh = reached − announced`. A nonempty fresh set produces one localized toast and persists announced immediately. No classifier for index direction, scene adjacency, mode, locale or rereading. Receding visibility does not remove announced/opened IDs: a formerly reached note from a partially read scene may relock under HPA-1131, but it cannot replay on return.
- Keep intentional **non-reading jumps** silent with the same seed operation, not a new transition system: use the existing explicit `onNavigate`/`handleStoryMapJump` seam (act drawer, map, ending jump) and the ready/load restoration boundary for browser history/initial/resume/deep-link navigation. Seed the **destination** reached view before its first diff (after the destination is applied, not the old view); do not seed the normal `onNext`/`onChoice` path. A normal next-line or next-scene/choice change still notifies for new keys. Loading, reopening the sheet, changing locale/mode or restoring saved progress never emits a toast for historical discoveries. Unit/E2E tests cover a jump to previously unannounced keys, not only rereading keys already in the set.
- **Avoid per-line snapshot flushes.** `getCurrentStoryProgressSnapshot` in `reader-manager.ts:886-895` flushes URL/persist debounce. Use the activation snapshot plus live position for normal forward reading (strict ancestors are already inferred); reuse the existing scene-boundary `storyMapProgress` snapshot path or refresh only at explicit scene jumps/scene boundaries and sheet open to retain explored branches/completed endings. Never call it from the dialogue-index notification effect. When a snapshot refresh adds previously saved progress unrelated to active reading, silently seed those historical keys; do not silently consume genuine next-line/next-scene reveals.
- Group all fresh keys from one reached-set change into **one toast** (e.g. “3 new notes”), using safe localized copy and visible portrait/initials or mystery icon for a single key. This includes simultaneous met/name/fact and mystery open/clue. No per-key queue; a new group replaces the active toast and resets its timer. Do not announce hidden canonical names.
- Show for **4 seconds** with timer bar; View opens the existing sheet at the target and dismisses the toast; timeout leaves the dot. Cancel prior timers on replacement/unmount/story change, respect `prefers-reduced-motion` and clear stale toasts if their targets become inaccessible after navigation. No auto-focus or blocking reading.
- Mark the **currently unlocked** keys on a character/mystery when its detail is actually visible (including via View and standalone Notes; merely opening a phone tile list or switching tabs does not mark unviewed details). Later facts/clues can become New again. Dot = any reached but unopened key; New tags are view-derived per row/fact/clue and survive reload. Announcing or silently seeding is not opening. The shared state must update both the reader and standalone Notes view, with persistence across page navigation.

**ReaderShell stays a coordinator:** a small stateful toast/timer view and the existing sheet/controls consume the pure module's results. Keep the progress-snapshot seam and reader/audio lifecycle intact. `page.clock` and Vitest fake timers verify timing without sleeps.

## The Platform Acts 1–3 pilot (content grounding)

Use the **actual Chinese script** as the source of truth; attach fences directly before the first line that reveals each question/clue, then mirror only note prose to en/ja.

| Candidate mystery | Evidence already in source | Allowed pilot state |
| --- | --- | --- |
| The endless tunnel | Act 2: the expected ~5-minute passage stretches to 20 minutes, with no signal | Open with reached clues; no speculative answer |
| The sketchbook spiral | Act 2: Emi's strange spiral/angular symbol is explicitly described | Open; later meaning remains unknown |
| The two violet moons | Act 3: two purple crescent moons over the alien coast | Open; no explanation implied |
| The deserted 寂海 station | Act 3: train stops, sign reads 寂海, platform is deserted | Open; any later resolution belongs to content tickets |

Use the ticket's placeholder mystery names/images **for layout only**, not as facts. Where a line also unlocks an existing character fact (Emi's drawing, Ren's tunnel excuse, Tomoko's phone), phrase mystery clues as evidence for the story-level question rather than duplicating the character observation; keep both unlocks if each adds distinct information. Group coincident reveals into one toast. Use a label such as “the quiet girl's drawing,” not Emi's unrevealed canonical name. If one candidate lacks a genuinely supported question or unlock boundary, leave it out rather than manufacture lore. Avoid editing Chinese prose except for the metadata fences. **Solved state must be tested with a tiny compiler/test fixture**; do not give an unresolved pilot question a fake answer merely to make the UI show its solved card.

## One-PR implementation sequence

Each step is an independently testable commit on **this same PR**, keeping existing tests green. Do not defer the riskiest tests to the end.

1. **Compiler, payload and one real mystery:** implement the shared icon enum, simple list grammar and fence variants; emit bounded mystery/event arrays; land the long-tunnel (or another supported) pilot mystery, zh markers and en/ja note overrides immediately, with compiler validation and source-boundary fixtures. Preserve character tests, lazy-loading boundary, dialogue counts and locale alignment.
2. **Pure selectors and notification module:** extract `isReached` / `byDepth`, implement clue-first/answer-first mystery states, view-derived keys, required announced/opened sets and local persistence. Add Vitest coverage for silent seeding, difference, grouped keys, relocking/revisiting, per-item clearing, reload and storage fallback alongside selector tests.
3. **Shared Notes UI:** add tabs, desktop/phone Mysteries presentation and selected-detail/New callbacks; extend standalone route and My Progress chip using the already available real pilot content. Land component tests and initial `packages/e2e/tests/story-mysteries.spec.ts` coverage for tabs, locked/open states, detail navigation and responsive geometry.
4. **Reader notification + E2E:** move lightweight notes loading to active/ready story, reuse initial/scene-boundary progress snapshots, wire the notification module and explicit silent navigation seeds into the single ReaderShell sheet and mode-specific trigger. Land the notification Playwright regressions **in the same commit** (timer, grouped events, View, reload/jumps/no replay, unread persistence, all three reader surfaces, status collision).
5. **Remaining pilot + localization:** author remaining supported Acts 1–3 questions/clues and zh markers with en/ja overrides; add all localized UI strings as their components land. Validate each real boundary and cross-locale rendering; no invented solved pilot answer.
6. **Final verification:** run compile/lint/unit/component/committed Playwright specs, then execute the same user journeys through the available Browser/Playwright MCP on one supported web platform, using desktop and phone viewports. Capture actual screenshots and compare the rendered layout with HPA-1132 mockups using the checklist below (not a pixel diff of placeholder text/art). Attach screenshots, measured layout assertions and MCP run results to this PR; address valid reviews here.

## Automated acceptance criteria (implementation PR)

**Durable regression suite — required in the repository:** the following behavior and geometry assertions live in `packages/e2e/tests/story-mysteries.spec.ts` (reuse helpers and coverage patterns from `character-notes.spec.ts`) and run under existing `.github/workflows/e2e-tests.yml` for non-draft PRs. Run the focused spec explicitly on the draft branch too. Use `page.clock.install()` and clock advancement, as in `reader-layout.spec.ts`, rather than a real four-second wait.

- [ ] `bun compile:stories` succeeds; compiler tests reject bad/reserved IDs, bad icons, structural mirrors and invalid/undefined markers; validate clue-only and answer-only paths without explicit open, all authored clues/answers unlockable, and no change in dialogue counts, scene IDs, media cues or branch flow. Existing character-note tests remain green.
- [ ] Selector/unit tests cover undiscovered/open/solved, no optional clues/answer, clue-first/answer-first, repeated route unlocks, deterministic act attribution, language fallback and no exposure from visited-but-unfinished non-active scenes. Notification module tests prove view-derived keys, silent initialization, one fresh set per change, persistence, partial-scene relock/revisit, per-item opening, malformed/unavailable storage fallback and no replay after reload. Test the solved state with a tiny synthetic compiler/selector and component fixture; keep the production pilot genuinely unresolved.
- [ ] Committed Playwright: start before a real character/fact/clue marker without opening Notes; advance normally in desktop VN, assert a single toast, timer visible before 4,000 ms and dismissed at 4,000 ms using `page.clock`, dot remains, and a visual status pill can coexist without intersection.
- [ ] Committed Playwright: exercise desktop text and phone text/VN; same-line multiple unlocks produce one grouped count, View opens the right tab/item (phone detail), closing retains exact line, URL and saved progress. Assert no reader remount/audio restart using existing reader/component test seams.
- [ ] Committed Playwright: resume mid-scene, reload, reread/backtrack, change mode/locale, jump via Story Map and browser history; no old toast or surprise toast on non-reading jump to newly reachable keys, while a genuinely fresh next line/choice still notifies. Verify late note-load seeding and no snapshot call per line in component/unit tests.
- [ ] Committed Playwright: dot and New tags survive reload; viewing one item's detail clears only its reached keys, not other items or later facts/clues; a later fact/clue makes the item New again. Exercise the standalone Notes page and My Progress chip. Use signed-out browser storage for this feature-specific E2E; existing `StoryProgressView` owner-scoped/auth regression coverage remains in place. No extra signed-in session or native platform acceptance is necessary because this feature adds no backend/auth/platform-specific behavior.
- [ ] Committed Playwright: no Mysteries tab/chip on stories with none; all-undiscovered state renders only anonymous rows (no hidden content in DOM/accessible names). A real pilot mystery opens/clues appear only at their markers; the fixture/unit/component suite proves the solved answer boundary without fabricating a pilot solution. Confirm en/zh/ja strings and fallback.
- [ ] **Committed mockup-derived layout assertions** at 1440×900 and 390×844 using `boundingBox` / `getBoundingClientRect` and scroll measurements: desktop rail and detail appear side by side, phone tile list opens a full-screen detail with Back, toast lies below the Notes trigger (phone text relative to its existing toolbar), toast/status/dialogue do not intersect, interactive targets are at least 44px, and `scrollWidth <= clientWidth` for cards and the viewport. Exercise the status-present case, not only an absent pill. Check safe-area/keyboard focus behavior and no overflow in en/zh/ja where applicable.
- [ ] **MCP end-to-end acceptance on one web platform:** use the real running app via Browser/Playwright MCP to exercise the notification, View/return, unread/reload and conditional-tab journeys above in desktop and phone viewport modes. Record pass/fail and evidence. This is in addition to the reusable committed Playwright regressions, not a substitute. If the MCP cannot run a required journey, do not mark acceptance complete.
- [ ] **MCP screenshot visual-parity acceptance against Linear's actual mockups:** capture desktop Mysteries rail/detail, phone tiles/detail, and desktop/phone VN and phone text toast states (including the Chinese mockup state where applicable) at comparable viewport sizes. Compare layout hierarchy, spacing, card/icon/pip/locked/solved treatment, toast placement, timer bar, status coexistence and readability against the ticket images/interactive mockup; use the committed geometry/overflow/target checks as objective pass conditions. Actual story copy/icons may differ from placeholder mockup data; do not pixel-diff the placeholder mockup or require identical content. Record the automated/agent visual comparison result and screenshots in PR comments or CI artifacts, not generated screenshots in Git. A fixture screenshot may demonstrate the solved layout without fake pilot content. No human sign-off or manual acceptance step.
- [ ] `bun compile:stories`, `bun --filter @aquila/stories test`, `bun --filter web test`, `bun --filter e2e test:e2e story-mysteries.spec.ts` and repo lint/type checks pass; preserve existing character-note regression and coverage gate. Run the full existing E2E workflow when ready.
- [ ] Changes remain scoped to **one feature PR**; no new database, API, generated assets, SFX, art subtask or backward-compatibility layer.

## Notes for implementation/review

- The visual assets cited in HPA-1132 are **mockups**, not runtime artwork; use built-in icon components.
- A stored `visited` scene does not imply its whole dialogue was read. Reuse the HPA-1131 rule exactly; changing it can leak mysteries before their lines.
- The existing UI uses a floating Notes button in desktop/VN and an auto-hiding toolbar button in mobile text mode. Do not create a second floating mobile control.
- This initial PR contains only a proposed design document. **Implementation tests and screenshots have not been run yet**; they are implementation acceptance work, not claims about this plan-only commit.
