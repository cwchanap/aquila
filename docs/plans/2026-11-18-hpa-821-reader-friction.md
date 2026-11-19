# HPA-821 — Reader friction design specification and implementation plan

**Status:** Revised after [design review on PR #140](https://github.com/cwchanap/aquila/pull/140#pullrequestreview-5970679599). **Single PR for design, implementation, tests, evidence and review fixes:** https://github.com/cwchanap/aquila/pull/140.

- Linear: https://linear.app/cwchanap/issue/HPA-821/reader-friction-main-menu-settings-does-nothing-first-choice-is-hidden
- Baseline checked: `main` at `0aee6d24cf44520039b6b016fada88d4691764b3`. Recheck the touched seams before implementation.
- Existing fixes: HPA-961 / PR #125 (Crossroads) and HPA-911 / PR #128 (My Progress).
- Visual reference: HPA-961's chosen **Option B** mockup is authoritative for Crossroads only; HPA-821 has no attached UI mockup. Other views get automated screenshot checks via Playwright MCP.

## Goal and reconciliation with current main

A signed-out first-time player can see the entire passage and action, reveal typing without waiting, find a speed setting in every reader mode, see honest loading and local bookmarks, revisit read scenes, and use menu controls. Preserve existing story graph, UI locale, assets, audio, URL, progress, and route choice semantics.

| Report | Current state | Decision |
| --- | --- | --- |
| Dead main-menu Settings | HPA-911 replaced it with working My Progress. | **Done; regression only**, no new landing-page settings. |
| First choice below fold | HPA-961 replaced inline choices with Crossroads. | **Done; regression only**, match Option B. |
| Text clipped | Visual box has fixed 14.4/18rem height (32/40dvh phone), mobile text h-52/h-64; desktop transcript's Continue is inside max-h-[70vh] scroller. | Responsive, non-jittering boxes with reachable footer and CSS-only scroll cues. |
| Slow/unskippable typewriter | Shared `skip` decision exists but is not a visible action; 30ms is hardcoded in each leaf. | Visible Reveal and shared local speed preference. |
| White first-load screen | ReaderShell loading UI appears after mounting; `reader.astro` emits an empty SSR container beforehand. | Nonblank localized SSR placeholder using existing handoff. |
| Bookmarks auth confusion/delay | Client has neutral loading copy but waits for cloud before showing local cards; server HTML has empty loading text; server session wait is unbounded. | Server-known auth, bounded lookup, immediate local cards and honest cloud status. |
| Acts/History/menu/icon | Acts hides unseen branches by design; both backlogs only include current scene; menu language links are always expanded; bookmark/title strings contain 📖. | Verify Acts first; add session scene history; native language picker; plain labels with Lucide. |

## Architecture and UX decisions

### A. Shared typewriter speed and Reveal control

- Keep the existing two-signal index/scene state machines in `NovelReader.svelte`, `VisualNovelReader.svelte` and `MobileNovelReader.svelte`. Do not extract/rewrite them. Retain `getReaderAdvanceDecision`'s `skip`, sceneVersion cancellation and existing audio/navigation effects.
- Update only shared `apps/web/src/lib/typewriter.ts` from constant `speed` to `delay: () => number`. Read delay each tick; 0 emits the full text and completes **without timers**. Check cancellation and skip first. Changing speed mid-line affects the next tick; Instant finishes then, with no separate reveal/restart-on-setting-change logic.
- Add `apps/web/src/lib/reader-typing-speed.ts` with browser-local read/write and pure `resolveTypingDelay(pref, prefersReducedMotion)`, matching `reader-furigana.ts`. Unset is a real preference value: normal-motion unset = **Fast 10ms**, reduced-motion unset = **Instant 0ms**; explicit Instant = 0ms, Fast = 10ms, Normal = 30ms. Explicit selection overrides the reduced-motion default. Storage failures act as unset. No account sync/schema.
- `ReaderShell` owns speed preference plus the already available reduced-motion media query and passes one reactive `typingDelay` prop into all three leaves. Each leaf passes `() => typingDelay` to `typeText`. During typing, show a labeled **Reveal text** button in the established progression slot, using the existing skip branch. A first gesture reveals the complete passage, not the next line or a route choice; a subsequent gesture advances. Ensure ruby/secondary line appears on completion and audio/SFX do not duplicate.
- Build one compact-capable `TypewriterSpeedPicker.svelte` (parallel to `SecondLanguagePicker`), with localized labels and native pressed buttons. Mount in `ReaderSettingsMenu` AND in phone text-mode `MobileNovelReader`'s existing options panel. **Do not gate phone options on secondLanguageChoices.length > 0**; render the speed picker even for text-only stories. The phone button's accessible label must describe general *reading settings*, rather than only second language. Keep second-language/furigana subcontrols conditional. Use en/zh/ja reader translations.

### B. Stable dialogue geometry, without JS resize/scroll state

- **Visual:** keep `--dialogue-box-height` as the **minimum** feeding portrait bottom/height CSS; change box to `height:auto; min-height:var(--dialogue-box-height)` with a safe-viewport `max-height`. Long boxes can overlay portraits, not reposition them while typing. Preserve the existing footer grid row outside the scroll body.
- Prevent animation-induced growth: reserve the **full primary and secondary line** (including ruby) invisibly in the same grid cell during typing, using `visibility:hidden`, `aria-hidden="true"` and no pointer events. Overlay visible typing text; switch to actual full text at completion without height jump. Hidden reserve is never announced or interactive.
- **Mobile text:** change h-52/h-64 to equivalent `min-height` plus safe-viewport `max-height`, accounting for chrome and safe areas; use the same full-text reserve so bilingual reveal does not shift the panel. Keep last-line action outside text scroller.
- **Desktop text:** move Continue/Choose/Reveal **outside** its existing max-h-[70vh] transcript scroller. Do not create another footer system.
- Add a themeable CSS-only scroll-shadow utility in `apps/web/src/styles/global.css`, e.g. background-attachment:local gradients, applied to all three scroll regions. No ResizeObserver or manual scroll-follow tracking. When content exceeds the viewport cap, text must remain scrollable and cue must be perceptible; when it fits, cue must not suggest hidden text.
- Layout is a **real browser** concern, not a Vitest measurement: one committed Playwright spec checks representative long Latin/CJK bilingual passages at 1440×900, 390×844, and 844×390. Assert actions visible/clickable, no overlay collisions, no jitter during typing/reveal, and either no overflow (`scrollHeight <= clientHeight`) or a visible shadow cue.

### C. SSR loading and bookmark state

- `apps/web/src/pages/[locale]/reader.astro` should put localized `reader.loadingStory` in server-rendered `#reader-container`, using the same dark status block / `role="status"` as `ReaderShell.loadSurface`. `ReaderManager` already replaces server children on mount; preserve loading/error/retry, active-reader overlay, URL and deep-link behavior. **Do not add an open-ended TTFB/network trace investigation**; if the initial HTML itself is still slow, file a separate measured performance issue.
- `apps/web/src/pages/[locale]/bookmarks.astro` calls `getSessionUser` with `SESSION_LOOKUP_TIMEOUT_MS` (1500ms) and derives `authStateFromSession`, like reader.astro. Embed `data-auth-state` in bookmarks container; render localized `bookmarks.loading` in the initial server HTML instead of an empty element. Retain existing degraded-auth banner.
- `BookmarksManager` accepts `signed-in | signed-out | unavailable` from server; initialize local bookmarks **before** any optional cloud call. For known signed-out, **skip `/api/bookmarks`** entirely and render local cards with login-to-sync (or existing real empty/login state). For signed-in, immediately show local cards plus cloud loading, then cloud results/error. For unavailable, retain the fetch/recovery path; do not claim signed out before a real 401. Preserve local cards on 500/timeouts. Remove redundant `initializeUI`.
- Tests cover SSR before hydration, replacement on mount, direct-link retry, signed-out no-fetch, delayed signed-in cloud and degraded/failed cloud. No cloud API or backend change.

### D. Session History recorded as scene segments

- Add pure `apps/web/src/lib/reader-history.ts` to capture **only** `{sceneId,lastIndex}` when leaving a scene **within the same story**, retaining at most **50 segments**. The view adds the current scene's existing `dialogue.slice(0,dialogueIndex+1)`. No copied text/ruby/secondary language, no permanent save/events. Maintain correct order when revisiting scenes and when reloading a deep link; avoid fabricated future-branch records.
- Build display lines on demand from `ReaderShell.getSceneDialogue` and current `secondContent.dialogue[sceneId]` via `alignSecondDialogue`, `resolveCharacterName` and `actLabel(extractActName(...))`. Drop segments for missing scenes. The current second language, furigana and translated story payload determine display, so toggles do not leave stale snapshots. **Clear on story change**, not on mode switch or primary-locale change.
- Pass one shared `lines` shape (from `MobileBacklogSheet`), with optional act/scene separator, to both phone and visual backlogs; `VisualBacklog` no longer slices only current scene. Keep the current-scene lines when opening a fresh deep link, and existing focus return. Pure Vitest coverage for transitions, segment bounds, revisits, story change, missing payload and locale update; one end-to-end visited-act scenario.

### E. Small menu fixes; Acts guarded by regression

- Move the three existing MainMenu locale links into native `<details><summary>` showing the active endonym. Keep links and `handleLanguageClick` local persistence unchanged; no extra state, outside-click handler or picker library.
- Remove 📖 from **nine** shared translation values: `menu.bookmarks`, `bookmarks.title` and `reader.bookmark` in en/zh/ja. This corrects aria-labels and HTML title too. Add an existing Lucide book icon next to plain text at the three rendered entry points: `MainMenu.svelte`, `ReaderSettingsMenu.svelte`, `bookmarks.astro`. Update tests that asserted emoji labels. No new art/fonts; leave unrelated desktop-used translations alone.
- Add an Acts navigation regression for an actually visited previous act and an unread branch. Repair `buildChapterData` / `visibleSceneIds` only if it fails; never reveal future branches by default.

## Single-PR implementation order

Each step is a small **commit with its tests**, not another PR. Recheck latest main before starting.

1. Run current targeted tests and write the **Acts regression** first. Keep existing Crossroads/My Progress checks; skip a large baseline screenshot survey.
2. **Menu/emoji**: native details and plain accessible labels/icons; UI/translation tests.
3. **Loading/bookmarks**: bounded auth + immediate local render + truthful SSR placeholders; unit/E2E cases.
4. **Typing**: shared dynamic delay, preference helper, shell prop, Reveal controls and shared picker (including phone text mode without translations); unit/component/E2E.
5. **History**: pure segment helper, both sheets, visited-act E2E.
6. **Layout**: stable visual/mobile boxes, hidden full-line reserve, desktop action outside scroller, CSS scroll cue; browser geometry checks and focused screenshots.
7. **Final gate**: lint, story compilation, web build, workspace unit tests, committed relevant Playwright specs, then execute targeted **committed end-to-end tests via Playwright MCP**. Add screenshot evidence to **PR #140**, address reviewer feedback here, and only then mark ready. No new implementation PR.

## Automated end-to-end acceptance

The **committed specs are the repeatable gate**, and their E2E acceptance run is performed through MCP. No human acceptance/sign-off criteria. Desktop+phone are necessary because layout differs; no separate native OS/device matrix for browser-only changes.

- [ ] Regression: menu My Progress works, and first choice shows Choose -> Crossroads with route selection matching HPA-961's approved Option B mockup. No dead Settings or inline choice return.
- [ ] One component/unit suite proves unset/reduced-motion defaults, 10/30/0 ms, mid-line speed change, skip and cancellation, local persistence and only-one-gesture Reveal behavior. One committed reader E2E covers Reveal and subsequent advance in the affected modes, and **phone text mode with no translations exposes speed**.
- [ ] One committed Playwright **layout** spec at 1440×900, 390×844 and 844×390 with long Latin/CJK bilingual lines asserts readable/reachable primary and secondary content, visible clickable controls, truthful scroll shadow when needed, and stable portrait/box position during typing/reveal. Run it through MCP.
- [ ] Initial reader **server HTML before hydration** contains localized loading status and the hydrated shell replaces it cleanly; direct link, reload, failed story import and Retry preserve URL/position. Bookmarks SSR has loading text; known signed-out local bookmark appears immediately with **no cloud request**, while delayed signed-in / unavailable/failure flows retain cards and correct status.
- [ ] After crossing two acts in one session, visual and phone History include both visited segments in order, not unread branch text; fresh direct link uses existing current-scene backlog. Previously visited Acts stay navigable, unread branches stay hidden, and focus returns on History close.
- [ ] Locale selector starts collapsed, opens with keyboard, navigates and persists selection. Bookmark headings, titles and controls are readable without emoji glyphs (en/zh/ja unit translations; one browser menu journey).
- [ ] **MCP visual check:** four focused screenshots (visual desktop and phone text, each with long English and CJK/bilingual line), plus a changed menu/loading/bookmark capture only when needed for its UI regression. Verify no clipping, overlap, missing glyph or hidden progression control. Crossroads is compared to its attached Option B mockup; other screens have no mockup. Attach automated screenshots or report to the same PR.
- [ ] Existing reader, choice, story-map and bookmark tests, web lint/build and story compilation pass. This is a frontend-only ticket. **No backend/schema changes are in scope**; if needed later, revise scope separately and include a backend E2E through MCP.

## Risks and safeguards

1. **Portrait geometry:** the visual box height variable also positions portraits. Keep it as minimum; test portrait and short landscape.
2. **Unreachable phone control:** the phone text reader has no ReaderSettingsMenu, and its old language options disappear for unilingual stories. Always make speed reachable there.
3. **Duplicated timing:** centralize delay in `typeText` and pass one shell prop; retain already-tested leaf lifecycle state machines.
4. **Fast-default behavior:** changing global default from 30 to 10ms may surprise readers; make 10/30/Instant explicit, honor reduced-motion unset, and test.
5. **SSR async handoff and local privacy:** no blank or duplicate placeholder and no cloud-only block of local bookmarks.
6. **History/spoilers:** record exited scenes only, no unseen branch traversal or persistent per-line event log.

## Non-goals

No new art/SFX (if ever needed, create a separate art-generation ticket), no backend/API/storage migration, no TTFB project, no compiler/story edits, no extra UI/layout library, no complex scroll tracker, no compatibility layer and no global state framework. Keep the solution small and maintainable.
