# HPA-911 — My Progress: implementation plan
Implementation checklist · 2026-11-15 · **single draft PR**

**Issue:** [HPA-911](https://linear.app/cwchanap/issue/HPA-911/replace-character-setup-with-a-my-progress-page)  
**Design:** [HPA-911 design specification](../specs/2026-11-15-hpa-911-my-progress-design.md)  
**UI reference:** HPA-911 attachments **UI mockup (HTML): My Progress page, menus, Acts slider Home** and **UI mockup (PNG, all frames)**.  
**Prerequisite:** HPA-703 merged in PR #117.  
**Baseline:** HPA-961 / PR #125 (Crossroads) is merged into `main`; preserve its reader-shell/choice logic.  
**Delivery rule:** Add all implementation commits to this same HPA-911 draft PR. No separate coding PR or art/SFX task is needed.

## Work sequence

### 1. Retire obsolete character setup (same PR)

- [ ] Search the **current** main/branch for all references to `characterSetups`, `CharacterSetupRepository`, `CharacterSetupSchema`, `local-characters`, `character-setup`, `/characters`, `/story/setup`, `/story/train_adventure`, and `CHAR_` to catch uses outside the ticket's initial list.
- [ ] Remove the three Astro pages and `apps/web/src/pages/api/character-setup.ts`. Remove the web-only character setup manager, local-character helper and its unused localStorage keys, the repository methods, schema types and validation, and dead translations/error IDs. Retain unrelated `lib/character-name.ts` and desktop code.
- [ ] Delete the `characterSetups` branch of `StoryRepository.deleteWithDependents` without changing bookmark cleanup or user ownership.
- [ ] Remove the Drizzle `characterSetups` declaration and exports; run `bun drizzle:generate` and inspect emitted SQL/snapshots for a targeted `DROP TABLE "character_setups"`. Do not write a migration for old names or touch `reading_progress` / `bookmarks`.
- [ ] Remove obsolete character setup unit tests. In `apps/web/src/lib/drizzle/__tests__/progress-db.test.ts`, replace the `CharacterSetupRepository` cases with checks for `to_regclass('public.character_setups') IS NULL` and `StoryRepository.deleteWithDependents` bookmark behavior: unauthorized delete is a no-op; authorized delete removes bookmarks for that story **across owners**, while unrelated-story bookmarks remain. Reuse CI's existing migrated PostgreSQL job; do not seed a special legacy DB or build a new harness. Update the outdated bookmark/character test comment in `.github/workflows/e2e-tests.yml`.

### 2. Share the existing progress lifecycle, not the UI

- [ ] Extract `StorySelect.svelte`'s `refresh`, account claim, `runSync`, auth revalidation, pageshow handling and failure mapping to one per-instance helper (suggested `lib/story-progress-view.svelte.ts`). No global singleton and no new storage.
- [ ] Keep validated account checks, overlapping sync coalescing, restore generation counters, `importSavedSessions`, and current SSR degraded-state behavior. Both components call the same init/dispose lifecycle.
- [ ] Change `StorySelect.svelte` to consume the helper, keeping its existing cards and sync status text visually and behaviorally unchanged. Continue to use `buildCards` and `pickContinueCard`.
- [ ] Make the extraction its own commit, then run existing `apps/web/src/components/__tests__/StorySelect.test.ts` **without rewriting its behavioral cases**. It already covers signed-out no-fetch, auth recovery, anonymous claim, account switches, bfcache/stale responses, request overlap, and local storage failures. Add helper-specific tests only for genuinely new behavior, not duplicate cases.
- [ ] Move `StorySelect.svelte`'s existing `ICONS` and `ACCENTS` mappings into one small shared `lib/story-presentation.ts` module used by StorySelect and My Progress. Keep `Sparkles` fallback; do not create a generic card framework.

### 3. Add My Progress route and responsive view

- [ ] Create `apps/web/src/pages/[locale]/progress.astro` using the same `getSessionUser`, `authStateFromSession`, `OceanBackground`, `AuthDegradedBanner`, back pill and `UserStatus` pattern as `stories/index.astro`.
- [ ] Create `apps/web/src/components/MyProgress.svelte`, a view over the shared progress lifecycle + `buildCards`. Render save-card state, three dynamic counts, sorted started-story rows, Browse stories count, and the empty state. Match the attached mockups at desktop and phone widths.
- [ ] Add small **pure** summary functions next to `lib/story-select.ts`, operating on `StoryCardModel[]`: started = cards with progress, finished = cards with `endingsFound > 0` (persistent across re-reads), and total endings = sum of capped `card.endingsFound`. Sort by `card.progress.updatedAt` with catalog-order tie-break. Format last read using `Intl.RelativeTimeFormat(locale)`; omit it for `updatedAt === 0` seeded/imported records. Reuse `card.status`/`card.href`/`card.startOverHref` unchanged.
- [ ] Add localized `progress.*` page copy in `packages/stories/src/translations/en.json`, `zh.json` and `ja.json`; reuse built-in `Intl.RelativeTimeFormat` for durations (no separate per-unit translation keys). Do not hardcode story counts or visible strings.
- [ ] Include accessible headings, link/button names, readable failure states and dynamic status announcements. Unit/component-test signed-in syncing/synced/failed, signed-out/empty/unavailable save cards, counters, stable sorting, timestamps including 0, and a signed-out zero-`/api/progress` assertion; no duplicate account-session harness.

### 4. Wire menus and independent Home control

- [ ] Replace the Settings control with a **My Progress** link in `MainMenu.svelte`. Preserve Start Game and Bookmarks and remove obsolete Settings copy/handler.
- [ ] Point `UserStatus.svelte`'s Story Config link to `/[locale]/progress` with the new label; leave Profile/Logout and signed-out login behavior as is.
- [ ] In `ActPanel.svelte`, split the always-visible rail into independent Home link and Acts toggle; do not nest interactive elements. `ReaderShell` already passes its localized `backUrl` to `NovelReader`/`VisualNovelReader`; forward it from those leaf readers to the new `ActPanel` prop. Use existing `t.common.backToHome` as the accessible label (no new translation). Verify rail operation open/closed and unchanged Story Map and Crossroads behavior.
- [ ] Do **not** duplicate Mobile Text's existing Home control. Check mobile Visual's Acts rail against `main`, which already includes PR #125; do not edit Crossroads logic.
- [ ] Update existing `MainMenu`, `UserStatus`, and `ActPanel` component tests to cover the changed links, label, and independent Home rail. Remove outdated links from web content/tests; generated zh/ja proxy pages remain generator-owned.

### 5. Committed regression tests and MCP-driven acceptance

- [ ] **Reuse the existing CI gates:** `bun run compile:stories`, `bun --cwd apps/web lint`, `bun --cwd apps/web test:coverage`, `bun --cwd apps/web build`, and `bun test:e2e`. Preserve existing StorySelect regression cases before introducing any new suite.
- [ ] **Add persistent Playwright coverage** in `packages/e2e/tests/my-progress.spec.ts` for signed-out empty/populated browser progress (seed `localStorage` as `story-select.spec.ts` does), counts, sorting, timestamps, Continue/Read Again, Browse stories, en/zh/ja routes, and one removed-route 404. Extend existing `story-select.spec.ts` / `reader-visual.spec.ts` for main-menu navigation and the Acts rail. If new tests must run as mobile Playwright projects, update `packages/e2e/playwright.config.ts`'s mobile `testMatch` (it currently excludes `my-progress.spec.ts`), or explicitly exercise mobile viewports in the new spec.
- [ ] **Cover authenticated flows without inventing browser login:** the app uses Google OAuth only; existing Playwright has no signed-in fixture. Preserve `StorySelect.test.ts`'s mocked-`authClient` session recovery, account switch, anonymous claim, concurrency and bfcache cases. Add focused MyProgress component state tests with mocked auth; keep `pages/api/__tests__/progress.test.ts` for request-level merge and `progress-db.test.ts` for real-Postgres merge. Do **not** build a hand-seeded OAuth cookie/session harness or require a live signed-in browser flow.
- [ ] **Reuse real-PostgreSQL CI:** `.github/workflows/e2e-tests.yml` already migrates Postgres 16 and runs `src/lib/drizzle/__tests__/progress-db.test.ts` before Playwright. Add `to_regclass` drop verification and scoped bookmark deletion checks to that suite; inspect `bun drizzle:generate`'s targeted `DROP TABLE "character_setups"` and verify no schema drift. No custom seeded legacy DB, no production DB writes.
- [ ] **Run end-to-end acceptance through MCP:** use MCP to invoke/inspect the **committed** Playwright tests and the existing CI-backed PostgreSQL suite, record execution results and relevant network/route assertions in this PR. MCP is the acceptance executor; committed tests remain the repeatable regression gates. One browser platform is sufficient for non-platform-specific behavior, with desktop/phone viewport checks for responsive UI.
- [ ] **Visual check through MCP:** capture and compare desktop and phone screenshots to HPA-911's attached HTML/PNG mockups: signed-in save-card variants (via controlled mocked-auth/component preview, *not* live OAuth), signed-out/empty, Chinese phone, start/account menus, and Acts rail open/closed. Record comparison and screenshot artifacts in this PR; yellow/red annotation callouts from mockups must not ship in product UI. Keep any test-only preview fixture minimal and non-production.
- [ ] Post CI links, MCP E2E execution evidence and screenshot comparisons into this **same** draft PR before marking implementation ready. No manual visual-approval acceptance step.

## End-to-end acceptance criteria (MCP-executed, committed test coverage)

1. **Removal + real DB:** The removed web routes/API produce 404 (one representative browser test plus reference search); no old links remain. The *existing* CI PostgreSQL migration + `progress-db.test.ts` prove `character_setups` does not exist, progress data remains operable, and authorized story deletion removes that story's bookmarks across users without deleting unrelated-story bookmarks. Unauthorized deletion remains a no-op. MCP records the committed E2E/DB results.
2. **Menus:** Playwright verifies the start menu order **Start Game → My Progress → Bookmarks**, no inert Settings, and navigation to `/[locale]/progress`. Component tests verify authenticated dropdown **Profile → My Progress → Logout** in en/zh/ja. All tests are executed/verified through MCP.
3. **Browser-only progress:** In Playwright, signed-out visitors see the correct populated/empty local view, login tip even with zero progress, and no `/api/progress` calls. A mocked-auth component case verifies unavailable auth shows local progress but no sign-in tip or network request.
4. **Cloud behavior:** Existing `StorySelect.test.ts` and new MyProgress component tests use mocked `authClient` to verify load sync, account-scoped claims, account switch, bfcache restoration, overlapping sync, distinct syncing/synced/failed/local-error states, and local data preservation. Progress API tests plus real-Postgres tests verify server-side merging. No Google OAuth browser harness is required; MCP executes the tests as E2E acceptance evidence.
5. **Per-story actions and counts:** Committed unit/Playwright coverage verifies catalog-derived started/finished/endings counts, stable recent-first rows, **finished stays counted after restart** when an ending was previously discovered, no epoch relative date for `updatedAt === 0`, and status/links identical to story-select cards. Continue deep-links to the saved line, Read Again restarts, Browse stories opens story selection.
6. **Reader Home:** Desktop Text and Visual Acts rails show an independent Home control when open/closed; it returns to the localized main menu, and Continue still restores the saved place. Mobile Text keeps its existing Home without duplication; mobile Visual shares the rail. Playwright and component regression tests cover the navigation; visual checks cover responsive layouts.
7. **Localization + visual fidelity:** en/zh/ja page copy and navigation work. MCP-driven screenshots show the implemented page, save-card states, menus, and Acts rail compared with **the attached Linear HTML/PNG mockups** at desktop and phone widths; all observed differences and artifacts are documented. No mockup annotations in released UI.
8. **Regression gates:** MCP execution confirms committed component/unit tests, Playwright and CI's real-Postgres step pass, together with web lint/build and coverage thresholds. No acceptance criterion depends on a human inspection.


## Deployment sequencing (after merge, not part of this planning-only PR)

Because the old deployed web app reads `character_setups`, the production database migration must **not** run before the new web deployment. Deploy app code first, verify new routes and that legacy character-setup traffic is gone, then run `bun drizzle:migrate` for production after the ticket owner's authorization. Record the migration result and automated smoke evidence. The old names are intentionally discarded; no backward-compatibility endpoint is added.

## Out of scope

Other HPA-821 friction items, HPA-819 translation coverage, HPA-820 missing image/background content, HPA-961 Crossroads behavior, changes to the desktop app, new art/SFX, resetting reading progress, progress schema redesign, and nonessential generalization.
