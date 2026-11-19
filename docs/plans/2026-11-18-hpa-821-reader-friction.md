# HPA-821 — Reader friction: design specification and implementation plan

**Status:** Planning-only draft. This document and the eventual implementation, tests, and review fixes belong to **one PR on this branch**. Do not open a second implementation PR.

- Linear: https://linear.app/cwchanap/issue/HPA-821/reader-friction-main-menu-settings-does-nothing-first-choice-is-hidden
- Repository baseline reviewed: cwchanap/aquila main at 0aee6d24cf44520039b6b016fada88d4691764b3 (2026-11-18). Re-check touched files against main before implementation.
- Relevant completed work: HPA-961, merged in PR #125 on 2026-11-16; HPA-911, merged in PR #128 on 2026-11-17.
- No HPA-821-specific visual mockup is attached. For Crossroads regression only, use HPA-961's selected Option B mockup. For all other changed screens, use automated screenshots of before/after behavior and inspect layout/overflow in Playwright MCP.

## Goal and user experience

A signed-out first-time reader can launch a story, read the **entire current passage**, reveal animated text immediately, see an honest loading state, access their local bookmarks while cloud state is pending, revisit previously read dialogue, and navigate without dead controls or misleading affordances. Keep all three locales and the distinct visual / desktop text / mobile reading layouts.

No changes to plot, story compiler data, route choices, artwork, audio assets, database, cloud bookmark API, or storage schema are necessary.

## Reconciliation with current main (do not duplicate fixes)

| HPA-821 observation | Verified on current main | Decision |
| --- | --- | --- |
| 1. Main-menu Settings does nothing | HPA-911/PR #128 replaced that button with a real **My Progress** link in MainMenu.svelte | **Already addressed.** Regression-test the working route; do not revive a second settings UI. Reader gear settings remain reader-only. |
| 2. First decision hidden below dialogue | HPA-961/PR #125 moved choices to one shared Crossroads dialog, with a visible Choose action | **Already addressed.** Preserve and regression-test the first choice and its focus/route behavior. |
| 3. Long dialogue and bilingual text clipped | VisualNovelReader.svelte uses fixed 14.4rem / 18rem boxes (32dvh / 40dvh on phone) and an internally scrolling dialogue body. MobileNovelReader.svelte uses fixed h-52/h-64; NovelReader.svelte caps its transcript at 70vh. | **Open UX gap.** Allow more readable height and make any unavoidable overflow obvious; keep progression controls visible. |
| 4. Slow typewriter, apparently unskippable | Shared getReaderAdvanceDecision already supports 'skip', and all three leaves use it; visual/mobile taps or Enter can trigger it. The visible progression button appears only after typing, desktop text has no text-click-to-skip, and no speed preference exists. | **Partly addressed.** Expose an explicit Reveal action during typing and a small speed preference; reuse current advance/skip code. |
| 5. Blank white screen on story navigation | ReaderShell already renders localized loading/retry after mounting, but reader.astro initially emits an empty reader-container while JavaScript, auth, and story payload load. Session lookup has a 1.5s timeout. | **Open pre-hydration gap.** Render an immediate server-side loading surface and hand off to the existing shell. Measure network/TTFB separately before attributing all latency to client JS. |
| 6. Bookmarks falsely says login while loading | BookmarksManager now uses a neutral loading message after initializeUI; it waits for cloud fetch before displaying already-known local bookmarks. bookmarks.astro initially emits an empty loading-text node. | **Partly addressed.** Add nonempty SSR loading copy and show local bookmarks without waiting for the optional cloud request; never render a login-only empty state before authentication resolves. |
| 7. Acts, History, language selector, book emoji | Acts uses visibleSceneIds (ancestor/visited and spoiler-safe); visual/mobile History derives only current-scene lines; MainMenu always displays three language links; menu.bookmarks translations contain an emoji. | **Mixed.** Test real act visibility before changing it; provide session-local cross-act History; collapse the language switcher; use an existing Lucide book icon with text, not an emoji glyph. |

The original ticket predates HPA-961 and HPA-911; don't interpret all seven observations as seven unfixed bugs.

## Minimal design

### A. Passage layout (text first, controls never lost)

- Visual reader: replace rigid one-height-fits-all dialogue with content-driven height that expands for longer primary/secondary passages, bounded by the safe viewport. Keep the **progression footer pinned and reachable** outside any scrollable text region; do not let a larger box obscure the settings/Acts controls. Preserve existing background and portrait layers. Prefer CSS grid and viewport bounds over a text-size measurement framework.
- Mobile text reader: allow the text panel to grow beyond its current 13rem / 16rem baseline when room exists, accounting for top chrome, safe areas and second-language lines. Keep the terminal action visible. Long passages on short viewports cannot always fit: provide a visibly discoverable scroll affordance **only when text actually overflows**. A tiny ResizeObserver-based check is permissible if CSS alone cannot express this; do not install a new layout library.
- Desktop text: preserve its scrollable transcript but don't bury Continue/Choose below a long scroll region. Ensure the current sentence, second language and action are reachable without discovering an invisible nested scroll.
- Typewriter growth must not hide the current last sentence. When overflow is unavoidable, follow incoming text within the scrollable text body until the reader manually scrolls; do not hijack intentional reader scrolling. Layout must survive font scaling, orientation changes, and reduced-motion settings.
- No hard guarantee that arbitrary-length bilingual passages fit on a 320px-wide short landscape viewport; the hard guarantee is **no inaccessible text or actions** and an obvious overflow path. In standard desktop and phone portrait screenshots, the ticket's named passages should fit when practicable.

### B. Visible typewriter control, speed, and skip

- Retain the current getReaderAdvanceDecision, typeText, sceneVersion cancellation, and reader-manager progression contracts.
- Add a single lightweight, locally persisted typewriter speed preference shared by ReaderShell and all three leaves: **Instant**, **Fast** (10 ms/character), **Normal** (30 ms/character). Default to Fast; respect reduced-motion by showing text instantly unless the reader explicitly selects an animated setting. No database, account sync, or migration.
- Add a clearly labeled **Reveal text** button in the normal progression-control position **while typing**. It calls the existing skip branch; the first press reveals the complete line, and only a subsequent advance moves the index or opens Crossroads. Do not let the same pointer/keyboard gesture both reveal and advance.
- In Instant mode show full primary and secondary text (and ruby) immediately; avoid scheduling per-character timers. Changing speed while a line is in flight reveals it immediately rather than restarting or leaving a stalled cursor. Preserve voice, BGM and SFX triggers.
- Add localized speed labels and Reveal text strings to en / zh / ja reader translations and the existing ReaderSettingsMenu; don't add a new settings route. Reader menu settings remain available in both reader modes where appropriate.

### C. Loading and local bookmarks

- In apps/web/src/pages/[locale]/reader.astro, put a localized, screen-reader-announced loading surface in the server-rendered reader-container (with a stable dark background). ReaderManager already replaces server placeholders when ReaderShell mounts; preserve that handoff, its retry/error UI, deep-link URL, and active-payload overlay during subsequent loads.
- Confirm whether the remaining delay is server TTFB, auth lookup, script import, or story payload using a **measured Playwright trace** with throttled/delayed requests. Fix a demonstrated delay only at its smallest existing seam; no preloading-all-stories, SPA rewrite, hydration framework, or new endpoint.
- In bookmarks.astro, server-render localized neutral loading text instead of an empty node. In BookmarksManager, render previously persisted local bookmarks immediately, then merge cloud results when auth/fetch completes. While auth is unknown, do not render a misleading login prompt; after a genuine 401, preserve the signed-out empty state and the local-bookmark + log-in-to-sync explanation.
- A slow or failed cloud request must not hide local bookmarks. Reuse the existing cloud error banner and tests.

### D. History, Acts, and small menu corrections

- Keep StoryProgressStore, Story Map, URLs, and existing route/choice semantics as the source of truth. Acts uses the shared visibleSceneIds helper so unopened branches stay hidden.
- Add an **in-memory, session-local, bounded recent-line history** to ReaderShell (a few hundred entries maximum) based on actual displayed positions as the player advances. Include scene/act labels, speaker, primary text, optional second language and furigana. Pass one unified history view to VisualBacklog and MobileBacklogSheet. It may include earlier acts visited **during this session**, but must never invent/read future branch lines or imply that unrelated replay branches were read. No backend history schema or permanent event log. Reset on story/primary locale changes; keep history on visual/text/mobile mode switches. Current-scene backlogs on restored deep links retain their existing behavior.
- For the Acts panel, add a regression using The Elevator Game Act 2 and The Platform branch/act transitions. If previous *visited* acts are missing, repair the existing visibility/buildChapterData seam only; don't expose all future acts or redesign the Story Map.
- Replace MainMenu's permanently expanded three-link language list with a compact keyboard-accessible selector that shows only the active language until opened; retain locale routing and language preference storage.
- Replace the book emoji in shared en / zh / ja menu and reader labels with plain translated text and a Lucide icon in relevant rendered controls. Verify desktop consumers of shared translation keys; no new art asset or art-generation task.

## Implementation sequence — one branch / one PR

1. **Baseline and repro:** Run the current targeted unit/E2E suites and capture desktop, mobile and bilingual screenshots for the ticket's named passages. Check the merged Crossroads/My Progress regression, signed-out Bookmarks with delayed /api/bookmarks, first-load SSR, Acts visibility and History. Record any observation already fixed; avoid changing code for a non-repro.
2. **Presentation fix:** Make visual and mobile dialogue content-responsive with pinned progression controls and a scroll cue on genuinely overflowing viewports. Keep desktop text transcript's action reachable. Add focused component/layout tests for long bilingual lines, safe areas and orientation.
3. **Reading controls:** Add the small reader speed preference helper, reuse typeText/advance decisions across three leaves, expose Reveal and speed options in the current settings panel, update translations, and add skip/timing/reduced-motion regressions. No second typewriter implementation.
4. **Loading/bookmarks:** Add server-rendered localized loading placeholders and immediate local-bookmark display. Reuse existing shell loading and cloud error handling; add delayed-response tests and track first meaningful UI from initial HTML.
5. **Navigation/history/menu:** Add bounded shell session history and reuse existing backlog presentation; verify or narrowly fix the Acts visibility rule; collapse MainMenu language selector and replace emoji with existing icons. Update tests/selectors and shared strings together.
6. **Verification and review:** Rebase/recheck against latest main, run lint, unit tests, web build, story compile, and committed Playwright suites; execute the E2E acceptance via **Playwright MCP**; inspect screenshot captures and network traces; respond to review comments **on this same PR** before marking ready.

Likely touched paths: apps/web/src/components/{VisualNovelReader,MobileNovelReader,NovelReader,ReaderShell,ReaderSettingsMenu,VisualBacklog,MobileBacklogSheet,MainMenu}.svelte; apps/web/src/pages/[locale]/{reader.astro,bookmarks.astro}; apps/web/src/lib/{typewriter.ts,bookmarks-manager.ts} and a small preference/history helper if necessary; packages/stories/src/translations/{en,zh,ja}.json; existing component tests and packages/e2e/tests/{reader-visual,reader-mobile,reader-crossroads,reader-lazy-loading,bookmarks,story-select}.spec.ts. Modify act-navigation/story-map only if the failing repro shows the gap.

## End-to-end acceptance criteria (automatic; no manual sign-off)

All criteria must be demonstrated by committed tests and the **MCP-driven browser E2E run**. A planning-only document does **not** claim that tests or screenshots already passed.

- [ ] **Completed-fix regressions:** Landing-page My Progress opens in en / zh / ja; the first Platform Act 3 decision shows Choose and an accessible Crossroads dialog, with both routes selectable. Its layout still matches HPA-961's selected **Option B** mockup. No dead Settings button or inline hidden choice returns.
- [ ] **Long-text visibility:** At the named Platform Acts 1/3, branch b1b Act 4 and Elevator Act 2 passages, the entire primary and (when enabled) secondary sentence is readable, the active end of text stays discoverable, and Reveal/Continue/Choose remains clickable. Verify desktop 1440×900 and phone portrait 390×844, plus a short landscape viewport. Test with second language off/on, with reduced motion, and check no UI overlays trap scrolling.
- [ ] **Typing:** With animated speed, a single click/tap/Enter on Reveal shows the full current text **without** changing scene/index or opening Crossroads; a second advance does. Instant displays full text without a typing delay. Switching speed works, persists across reloads, and does not cause duplicate navigation/audio callbacks. Keyboard and pointer interaction work in text, visual and mobile modes.
- [ ] **Loading before hydration:** First navigation, direct deep link, reload, slow story-module request and failed module request show localized loading/error/retry UI instead of an unexplained blank reader container. Assert the server HTML already contains its loading status **before client JS executes**; after hydration no duplicate status remains. Deep links and retry preserve URL and reader position. Use a throttled request/trace to distinguish TTFB from hydration.
- [ ] **Bookmarks:** With /api/bookmarks delayed for several seconds and local bookmarks seeded, local cards appear promptly without a login warning; after actual signed-out 401, the correct log-in-to-sync hint appears. Empty signed-out and cloud 500 cases keep their existing behavior. Initial server HTML contains truthful loading text.
- [ ] **History/Acts:** After reading from one act into the next, visual and mobile History include actually visited lines from both acts in correct order; a direct-link fresh session does not fabricate previous acts or unseen branches. Previously visited Acts can be reopened while future branches stay hidden. Verify keyboard/focus restoration when closing History.
- [ ] **Menu polish:** Main-menu language control starts collapsed, opens on demand, changes locale/URL and persists the selection. Bookmark links and buttons use readable translated text with a working icon (no missing-glyph tofu) in all three locales; accessibility names remain readable.
- [ ] **Visual evidence:** Playwright MCP captures screenshots in the relevant desktop, phone, long-passage bilingual, loading, History, menu and choice states. Compare against the HPA-961 mockup where applicable and against baseline captures elsewhere. Check visually for text clipping, keyboard focus, content/controls overlap and unindicated scroll; attach automated evidence to this PR.
- [ ] **Automated gate:** Existing reader, bookmarks, progress, choice and story-map tests, workspace unit tests, lint, web build and compiled stories pass. Run relevant committed Playwright specs through MCP for the desktop and mobile layouts (separate layout behavior warrants both). Do not treat one platform's emulation as proof of a native-platform result. If implementation unexpectedly changes backend behavior, add and pass a real backend E2E test through MCP before acceptance.

## Non-goals and constraints

No new artwork or sound effects; if genuinely new art/SFX becomes necessary, create a **separate task** rather than folding generation into this coding ticket. No new frontend UI toolkit, complex resize engine, database migration, cloud sync, account settings, global state layer, background monitoring, cross-session event-log persistence, legacy compatibility layer or speculative performance optimization. Preserve all existing story authored content, Crossroads choice contract, accessible focus handling and Story Map spoiler gating. Development scope remains one coherent PR for HPA-821.
