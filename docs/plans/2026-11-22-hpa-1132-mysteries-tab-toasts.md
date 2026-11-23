# HPA-1132 — Mysteries tab and in-reader note notifications

**Status:** Proposed design and implementation plan only. This draft PR changes documentation, not application behavior.

- **Linear:** https://linear.app/cwchanap/issue/HPA-1132/add-a-mysteries-tab-and-in-reader-note-toasts-pilot-platform-acts-1-3
- **Baseline:** `main` at `991316c7d76c312995682af5494bcc289e5cc364` (2026-11-22, Vancouver). Recheck current `main` before coding.
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
| Typed runtime notes | `packages/stories/src/notes-types.ts` | Add mystery records/events alongside character records/events. Preserve the small lazy payload. |
| Authoring and validation | `packages/stories/src/compiler/parse-notes.ts`, `build-notes.ts`, `parse-scene.ts`, `ir.ts` | Extend the existing Markdown and `unlock` fence parser; do not introduce another compiler or YAML format. |
| Story source | `packages/stories/raw/trainAdventure/notes/{zh,en,ja}.md`, `act1.md`, `act2.md`, `act3.md` | Pilot mystery definitions, source-language markers at evidenced dialogue lines, text mirrors. |
| Lazy loading | `@aquila/stories/async` and existing `loadStoryNotes` | Reuse current notes + flow importer. No eager dialogue imports. |
| Spoiler-safe views | `apps/web/src/lib/character-notes.ts` and `story-map.ts` | Extract a small shared reached-event filter; keep the existing `passedSceneIds` proof-of-passage rule. Add pure mystery view and unlocked-key projection. |
| Notes UI | `apps/web/src/components/Characters.svelte`, `NotesPage.svelte` | Add a tab host and separate Mysteries presentation; retain existing responsive Characters UI. |
| Reader integration | `apps/web/src/components/ReaderShell.svelte`, `MobileNovelReader.svelte` | Extend the single existing Notes sheet, route View to target, add notification/dot to the existing triggers; do not mount a second reader. |
| Progress entry point | `apps/web/src/components/MyProgress.svelte`, `apps/web/src/pages/[locale]/notes.astro` | Add a conditional Mysteries sibling chip and optional initial tab; use already loaded lightweight notes and progress. |
| Translations | `packages/stories/src/translations/{en,zh,ja}.json` | Tabs, mystery states, toast copy, New/solved/locked/accessibility labels. |

## Minimal authoring contract

Keep character sections and character fences valid as they are. Extend the same `notes/*.md` files with **namespaced mystery sections**:

```md
## mystery:long_tunnel
icon: hourglass
title: 無盡隧道
question: 為甚麼這段隧道沒有盡頭？
- clue:elapsed_time: 列車已在通常只需五分鐘的隧道內行駛了二十分鐘。
- clue:no_signal: 乘客的手機都無法傳送訊息。
```

- Only zh can declare mystery IDs, icon, clue IDs, presence of an answer, and order. En/ja sections may override `title`, `question`, the text of matching clue IDs and `answer` when present; missing translations fall back to zh **per field**.
- `id` and clue IDs are lowercase snake_case, unique in their scope; validate against the same unsafe/reserved plain-object names policy used by character facts. The `icon` field is a value from a small fixed set (spiral, moons, hourglass, pin, etc.) rendered by the installed icon library, not an external asset.
- A mystery has a question, zero or more clues, and **optional** answer. No invented answers just to demonstrate a solved state. A hidden mystery contributes to count but exposes no name, icon, text, act, aria-label or tooltip before its first open marker.
- Extend **only zh dialogue source** `unlock` fences with the disjoint namespace below. A marker attaches to the next dialogue entry exactly as it does for characters. Existing `li_jie.age` / `li_jie.met` syntax is unaffected.

~~~~md
```unlock
mystery.long_tunnel.open
```

```unlock
mystery.long_tunnel.clue.elapsed_time
```

```unlock
mystery.long_tunnel.answer
```
~~~~

The last example is allowed **only** when an answer exists in the authored section; it is not required for the pilot's unresolved mysteries.

Compiler rules: reject unknown/duplicate mystery or clue IDs, invalid icons, orphan mirror IDs, mirrors changing structural fields, malformed/dangling markers, a clue/answer marker without a corresponding definition, and any authored open/clue/answer with no marker on any route. Repeated markers for the **same ID on alternative routes are valid**. No marker changes a dialogue entry count, mirror alignment, background/audio cues or branching graph. Compiler diagnostics include source path/line where available.

**Runtime:** keep `StoryNotes.characters` + `events` unchanged in intent; add `mysteries` and `mysteryEvents` arrays rather than forcing mystery events through a fake `characterId`. Each mystery event records `sceneId`, zero-based `entryIndex`, `mysteryId`, `kind: open | clue | answer` and optional `clueId`. Generated payloads contain compiled localized strings and compact events, **not source paths or story dialogue**. Reuse existing story notes importer and cache.

## Spoiler-safe derived views

- Share the existing reached-event filtering implementation between character and mystery selectors. **Passed** strict-ancestor scenes or completed endings unlock all their events; only events up to the displayed dialogue index unlock in the **currently active unfinished** scene. A visited-but-unfinished **non-active** scene is not proof of seeing its later lines. Honor the ReaderShell live position over the saved progress; use saved position on the standalone page.
- Mystery states: **undiscovered** (count and anonymous slot only), **open** (safe title, question, unlocked clue pips and act labels; no answer), **solved** (answer plus the act where the answer marker was reached). For authored zero-clue mysteries, render no forced clue slots. An unanswered mystery remains open.
- Clues and answers can unlock on different routes through repeated same-ID markers. Use a deterministic reached event to attribute an act (existing flow depth/current-route preference and dialogue order); do not infer arbitrary chronological ordering from `visited`.
- Provide one pure projection of currently unlocked **stable reveal keys** shared by badges, New tags, and toast diff: `storyId/c/<id>/met`, `storyId/c/<id>/name`, `storyId/c/<id>/fact/<factId>`, `storyId/m/<id>/open`, `storyId/m/<id>/clue/<clueId>`, `storyId/m/<id>/answer`. Normalize character `speech` and explicit `met` to the same met key; repeated scene events must not create duplicates.
- Reaching a later event must **not** expose spoiler text through the toast, selected object, URLs, labels, alt text or accessible names before its own unlock marker. Avoid passing raw unfiltered compiled mystery objects to UI components.

## UI design, mockup parity and navigation

1. **Single Notes host.** A small `NotesContent.svelte` (or equivalent) owns tabs, selected kind/id and opened callbacks and renders the existing `Characters` view or a new `Mysteries` view. Do not clone the reader sheet. Default to Characters for ordinary Notes links; **hide both Mysteries tab and chip entirely** when `notes.mysteries.length === 0`. Support optional `?tab=mysteries` on the standalone Notes route and a programmatic target for toast View.
2. **Desktop Mysteries:** follow ticket mockup: scrollable list with fixed icon on discovered rows, clue pips, solved check, and dashed anonymous slots; detail shows safe question, clue placeholders / discovered clue text and localized act labels, plus locked or revealed answer. Keep the existing sky-glass sheet sizing and layout.
3. **Phone Mysteries:** compact tile grid, full-screen detail sheet with safe-area padding, Back, focus trap/restoration and at least 44px interactive targets. Preserve the existing `Characters` phone behavior when switching tabs. No horizontal overflow, clipped text or secret labels.
4. **My Progress:** render separate *sibling* Characters and Mysteries anchors below the full-row Continue/Read again link. The Mysteries chip appears only when **authored** mysteries exist; its count uses the same spoiler-filtered model and same owner-scoped progress already loaded. Do not load story dialogue or attach new APIs.
5. **Reader:** retain the single ReaderShell sheet. View from an individual toast opens the appropriate tab and selects that item. Grouped View opens Notes on the first newly unlocked item's tab (all newly unlocked rows remain marked New); Close returns to the **identical story, scene, dialogue index, URL, progress record and reader audio state**. Keep scrim, Escape, keyboard trap and inert-background behavior.
6. **Visual status collision:** the existing `[data-testid="visual-status"]` pill occupies the top-right area below Notes/Settings. Anchor the toast below the Notes affordance on desktop/VN and relative to existing chrome on phone text mode; when a visual status is present, stack/shift the pill instead of overlapping or hiding either. Do not place toast over faces or the dialogue box. Keep pointer interaction scoped to View/close and let other reader input through.

## Toast and unread lifecycle

- Treat the toast as a **forward progression notification**, not a side effect of loading the notes payload. Initialize the baseline of already unlocked keys when notes first load, a story resumes, or the user jumps/scrubs. Fire only when a genuine reader-forward transition crosses a previously locked event (including a valid forward scene transition). No toast on mount, locale/mode switch, scene reload, back navigation, Story Map jump, or previously unlocked event.
- Diff the before/after **spoiler-safe reached-key sets**, filter out keys previously announced on this device, and coalesce all keys unlocked by the same transition into **one** toast (e.g. “3 new notes”). For a single key, show safe short copy and the character's visible portrait/initials or mystery icon; never use a concealed identity. Do not queue one toast per fact.
- Show for **4 seconds** with a timer bar, then dismiss and leave the Notes dot. View immediately opens the Notes sheet and dismisses the toast. Cancel timers on new toast/unmount and avoid stale timers after story changes. Follow `prefers-reduced-motion` for the progress animation.
- Store only local, per-device UI acknowledgment: one namespaced set/list of **opened reveal keys**, optionally a minimal **announced key** set to enforce no replay after partially read scene revisits. Keep opened separate from announced: announcing a toast **does not clear New**. No API, account sync or progress schema change.
- Mark the **currently unlocked** keys on a selected character/mystery as opened when its detail is viewed, not all future keys for that item. A later newly discovered clue/fact can become New again. The dot reflects any reached but unopened key and New tags remain after reload until opened. Handle missing/unavailable localStorage by falling back to an in-memory set without breaking reading.
- On a line with multiple events, combine notifications before starting the timer. Switching among text desktop, phone text and VN keeps consistent behavior through ReaderShell rather than separate notification implementations.

## The Platform Acts 1–3 pilot (content grounding)

Use the **actual Chinese script** as the source of truth; attach fences directly before the first line that reveals each question/clue, then mirror only note prose to en/ja.

| Candidate mystery | Evidence already in source | Allowed pilot state |
| --- | --- | --- |
| The endless tunnel | Act 2: the expected ~5-minute passage stretches to 20 minutes, with no signal | Open with reached clues; no speculative answer |
| The sketchbook spiral | Act 2: Emi's strange spiral/angular symbol is explicitly described | Open; later meaning remains unknown |
| The two violet moons | Act 3: two purple crescent moons over the alien coast | Open; no explanation implied |
| The deserted 寂海 station | Act 3: train stops, sign reads 寂海, platform is deserted | Open; any later resolution belongs to content tickets |

Use the ticket's placeholder mystery names/images **for layout only**, not as facts. If one candidate lacks a genuinely supported question or unlock boundary, leave it out rather than manufacture lore. Avoid editing Chinese prose except for the metadata fences. **Solved state must be tested with a tiny compiler/test fixture**; do not give an unresolved pilot question a fake answer merely to make the UI show its solved card.

## One-PR implementation sequence

1. **Compiler and payload:** add mystery Markdown grammar and fence variants with targeted failures; emit bounded mystery/event arrays; keep the lazy loader intact and preserve character tests. Validate real pilot provenance, immutable dialogue counts and locale mirrors.
2. **Pure selectors and local state:** factor the reached-event helper out of `selectCharacterNotes`, implement mystery state and shared reveal keys, and add a minimal local unread/announced store. Explicitly test partial visited scenes and repeated IDs across routes.
3. **Shared Notes UI:** add tab host, desktop/phone Mysteries presentation and selected-detail/New callbacks; extend the standalone route and the My Progress sibling chip.
4. **Reader notification:** integrate forward-only event diff into ReaderShell and existing mode-specific Notes controls; render a single toast with 4-second timer, View, dot and visual-status coexistence.
5. **Pilot + localization:** author four or fewer supported pilot mysteries, zh scene fences and en/ja overrides. Add new UI strings for all three locales.
6. **Verification in the same PR:** run compile/lint/tests; run Browser/Playwright **MCP-driven end-to-end acceptance** on one supported web platform in desktop/phone viewports, capture screenshots, compare them against HPA-1132 mockups, attach evidence and address review comments on **this** PR.

## Automated acceptance criteria (implementation PR)

- [ ] `bun compile:stories` succeeds; fixture tests reject bad IDs/structural mirrors/invalid markers and show no change in dialogue counts, scene IDs, media cues or branch flow. Existing character-note tests remain green.
- [ ] Selector unit tests cover undiscovered/open/solved, absent optional clues/answer, repeated route unlocks, act attribution, language fallback and no spoiler exposure in visited-but-unfinished non-active scenes.
- [ ] **MCP-driven E2E:** advance **normally** past a character/fact/clue marker in desktop VN mode; exactly one toast appears directly under Notes, the timer expires at 4s, the dot remains, and the status pill + dialogue are unobstructed.
- [ ] **MCP-driven E2E:** repeat notification path on desktop text and phone text/VN; grouped multi-unlocks display one count; View selects the correct mystery/character and closing preserves the exact line, URL and saved progress (and doesn't restart audio).
- [ ] **MCP-driven E2E:** resume mid-scene, reload, reread a completed scene, jump on the story map, switch mode/locale: no old toast is replayed. A genuinely new later clue can still notify.
- [ ] **MCP-driven E2E:** new dot/tags persist across reload, viewing a discovered item clears only its reached New keys, and reopening without new discoveries stays clear. Signed-out and signed-in progress flows both work without server schema changes.
- [ ] **MCP-driven E2E:** no Mysteries tab/chip for a story without authored mysteries; a story with mysteries but no discoveries shows only anonymous rows. Verify mystery open, clue, and solved fixture states; answer remains secret until its actual marker.
- [ ] **Automated screenshot visual-parity check against the issue mockups**: desktop Mysteries rail/detail at 1440×900, phone tiles/detail at 390×844, and VN/phone notifications in en/zh/ja where applicable. Screenshot comparisons check placement, spacing, responsive layout, no overlap with `visual-status`/dialogue, no clipping/overflow, and 44px touch targets. Save before/after screenshot evidence in PR comments or CI artifacts **without committing generated verification screenshots**.
- [ ] `bun --filter @aquila/stories test`, `bun --filter web test`, targeted `bun --filter e2e test:e2e` and repo lint/type checks pass. Maintain the existing coverage gate. **Acceptance is automated; no human approval/manual acceptance step.**
- [ ] Changes remain scoped to **one feature PR**; no new database, API, generated assets, SFX, art subtask or backward-compatibility layer.

## Notes for implementation/review

- The visual assets cited in HPA-1132 are **mockups**, not runtime artwork; use built-in icon components.
- A stored `visited` scene does not imply its whole dialogue was read. Reuse the HPA-1131 rule exactly; changing it can leak mysteries before their lines.
- The existing UI uses a floating Notes button in desktop/VN and an auto-hiding toolbar button in mobile text mode. Do not create a second floating mobile control.
- This initial PR contains only a proposed design document. **Implementation tests and screenshots have not been run yet**; they are implementation acceptance work, not claims about this plan-only commit.
