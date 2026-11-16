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
- [ ] Delete/adjust obsolete character setup tests, including the real-db test that imports `CharacterSetupRepository`. Replace meaningful regressions with tests proving story deletion still scopes bookmarks correctly.

### 2. Share the existing progress lifecycle, not the UI

- [ ] Extract `StorySelect.svelte`'s `refresh`, account claim, `runSync`, auth revalidation, pageshow handling and failure mapping to one per-instance helper (suggested `lib/story-progress-view.svelte.ts`). No global singleton and no new storage.
- [ ] Keep validated account checks, overlapping sync coalescing, restore generation counters, `importSavedSessions`, and current SSR degraded-state behavior. Both components call the same init/dispose lifecycle.
- [ ] Change `StorySelect.svelte` to consume the helper, keeping its existing cards and sync status text visually and behaviorally unchanged. Continue to use `buildCards` and `pickContinueCard`.
- [ ] Unit-test the helper for signed-out no-fetch, authenticated sync, auth-unavailable retry, post-login anonymous claim, account switch, persisted bfcache restore, in-flight sync/restore overlap, and local read/save failure.
- [ ] If row icons/accent styles are needed in both views, move only the current mapping to a tiny shared module, without another generic card component.

### 3. Add My Progress route and responsive view

- [ ] Create `apps/web/src/pages/[locale]/progress.astro` using the same `getSessionUser`, `authStateFromSession`, `OceanBackground`, `AuthDegradedBanner`, back pill and `UserStatus` pattern as `stories/index.astro`.
- [ ] Create `apps/web/src/components/MyProgress.svelte`, a view over the shared progress lifecycle + `buildCards`. Render save-card state, three dynamic counts, sorted started-story rows, Browse stories count, and the empty state. Match the attached mockups at desktop and phone widths.
- [ ] Extract or add small **pure** summary functions near `lib/story-select.ts`: catalog-bound counts, stable sort by `updatedAt`, and locally formatted relative last-read text. Preserve `card.status`/`card.href`/`card.startOverHref` rather than recomputing URLs/status.
- [ ] Add localized `progress.*` text in `packages/stories/src/translations/en.json`, `zh.json` and `ja.json`; use the current translation access pattern. Do not hardcode story counts, dates, or visible strings.
- [ ] Include accessible headings, link/button names, readable failure states and dynamic status announcements. Do not perform a cloud request in the signed-out/unavailable state.

### 4. Wire menus and independent Home control

- [ ] Replace the Settings control with a **My Progress** link in `MainMenu.svelte`. Preserve Start Game and Bookmarks and remove obsolete Settings copy/handler.
- [ ] Point `UserStatus.svelte`'s Story Config link to `/[locale]/progress` with the new label; leave Profile/Logout and signed-out login behavior as is.
- [ ] In `ActPanel.svelte`, split the always-visible rail into independent Home link and Acts toggle; do not nest interactive elements. Add `backUrl` prop with localized accessible label; pass through `NovelReader.svelte` and `VisualNovelReader.svelte`. Verify the rail is clickable closed/open and neither Acts nor Story Map/reader navigation regresses.
- [ ] Do **not** duplicate Mobile Text's existing Home control. Check mobile Visual's Acts rail against `main`, which already includes PR #125; do not edit Crossroads logic.
- [ ] Remove outdated links from tests and web content; generated zh/ja proxy pages remain generator-owned.

### 5. Automated checks and release readiness

- [ ] Run `bun run compile:stories`, `bun --cwd apps/web lint`, `bun --cwd apps/web test:coverage`, `bun --cwd apps/web build` and `bun test:e2e` (or the repository's documented E2E command/CI equivalent). Maintain coverage thresholds.
- [ ] Execute real PostgreSQL migration + query tests through the MCP-driven E2E runner against a disposable database seeded with a user, bookmarks, reading progress and legacy character setup. Verify the character setup relation is absent, bookmarks/progress survive, and story deletion still behaves correctly. Re-run `bun drizzle:generate` and confirm no schema drift. No production DB mutation during planning or code review.
- [ ] Execute browser end-to-end via MCP against a running build: anonymous and authenticated sessions, saved progress from a second browser context, sign-in claiming, sync errors, bfcache restoration, correct Continue/Read Again targets, old URLs returning 404, and navigation in en/zh/ja. Collect screenshots and network/request assertions.
- [ ] Visual comparison **by the agent through MCP**: compare screenshot captures to the HPA-911 HTML/PNG mockups for signed-in desktop, signed-out desktop, phone in Chinese, empty phone, all save-card states, start/account menu, and Acts slider Home open/closed. Record screenshot artifact links in this PR; mockup yellow/red callouts must **not** appear in product UI.
- [ ] Run StorySelect and reader E2E suites against the current main with PR #125 included; a single platform's browser automation is adequate when no platform-specific implementation changed.
- [ ] Produce a final PR checklist with actual command outputs, MCP E2E evidence and screenshot links; keep draft until implementation + CI gates pass.

## End-to-end acceptance criteria (automated, no manual sign-off step)

1. **Removal + database:** All four old web routes/API paths return 404 in en, zh and ja, and no navigation links point to them. Migration on **real PostgreSQL**, run through MCP E2E, drops `character_setups` and preserves reading progress, bookmarks, and story-deletion semantics. No obsolete references or extra cloud progress schema remain.
2. **Menus:** At `/[locale]/`, Start Game, My Progress, and Bookmarks appear in that order; Settings is absent. For a signed-in user, account dropdown shows Profile, My Progress, Logout. Both My Progress entry points navigate to the locale-specific page.
3. **Anonymous progress:** Browser-only data appears without login; empty browser shows the empty state **and** sign-in tip. With auth unavailable, browser progress remains visible with no sign-in tip. Network check proves zero `/api/progress` calls in both cases.
4. **Cloud behavior:** Signed-in progress synchronizes on page load, including changes made from a second browser context. Saving/claiming local progress on sign-in and restoring from the back/forward cache preserve the correct account. Syncing, synced and failure states are visibly distinguishable and failure never erases local progress.
5. **Per-story actions:** Started/finished/endings counts match the catalog, rows sort newest first, and status text is identical to the corresponding story-select card. Continue deep-links to the saved scene/dialogue; Read Again restarts. Browse stories links to story select with the correct remaining count.
6. **Reader Home:** In desktop Text and Visual, Home appears on the always-visible Acts rail both collapsed and expanded; it returns to the main menu. Reader position is still resumable afterward. Mobile Text retains its existing Home without duplication; mobile Visual uses the shared rail.
7. **Localization and visual fidelity:** en, zh and ja strings work on desktop and phone viewport. MCP-driven screenshots visibly match **HPA-911 attached UI mockups** across save-card states, menus, page variants, and Acts rail; diff/deviation findings are captured as artifacts, with no annotations rendered.
8. **Regression:** StorySelect, account progress and reader behavior continue passing automated unit/component/E2E tests; CI coverage and build gates pass. No acceptance criterion requires human inspection.

## Deployment sequencing (after merge, not part of this planning-only PR)

Because the old deployed web app reads `character_setups`, the production database migration must **not** run before the new web deployment. Deploy app code first, verify new routes and that legacy character-setup traffic is gone, then run `bun drizzle:migrate` for production after the ticket owner's authorization. Record the migration result and automated smoke evidence. The old names are intentionally discarded; no backward-compatibility endpoint is added.

## Out of scope

Other HPA-821 friction items, HPA-819 translation coverage, HPA-820 missing image/background content, HPA-961 Crossroads behavior, changes to the desktop app, new art/SFX, resetting reading progress, progress schema redesign, and nonessential generalization.
