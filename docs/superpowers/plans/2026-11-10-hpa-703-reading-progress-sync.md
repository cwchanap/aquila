# HPA-703 — Reading Progress Sync and Bookmarks Implementation Plan

> **Planning-stage PR:** This PR initially contains only the design and plan. After review, implement HPA-703 **in this same PR/branch**. Do not create a second implementation PR.

**Linear:** https://linear.app/cwchanap/issue/HPA-703/sync-reading-progress-to-the-account-and-fix-cloud-bookmarks

**Design:** [2026-11-10-hpa-703-reading-progress-sync-design.md](../specs/2026-11-10-hpa-703-reading-progress-sync-design.md)

**Goal:** Signed-in web readers share Continue position and reached endings across browsers; compiled-story cloud bookmarks can be created again. Signed-out/offline reading retains existing behavior.

**Stack:** Bun, TypeScript, Astro server pages, Svelte 5, Better Auth, Drizzle/Postgres, Zod, Vitest and existing Playwright E2E suite.

## Constraints and decisions

- One Linear ticket, one PR, no separate branch or PR for coding after this design is approved.
- Reuse `aquila:storyProgress:v1` as the local working copy and the current `StoryProgress` record; no new client store or service layer.
- One per-user JSONB row; one authenticated `POST /api/progress`; one small shared pure merge module; one lightweight fetch helper.
- No images, portrait generation, BGM/SFX, story-writing changes, desktop integration, realtime updates, background queues, or general settings synchronization.
- Do not execute production database migrations automatically. Obtain explicit owner approval and run the documented migration **before merging** code that depends on the new table.
- Every task's tests are part of this **same** implementation PR. Keep changes tightly scoped to the issue.

## Task 1 — Shared progress model, validation, and local write

**Touch:** `apps/web/src/lib/story-progress-store.ts`; new `apps/web/src/lib/story-progress.ts` (or equivalent); `apps/web/src/lib/__tests__/story-progress-store.test.ts`; new focused merge tests.

- [ ] Move/extract `StoryProgress`/`StoryProgressMap`, the current `isProgress` checks and optional-`visited` sanitization into a pure browser/server-safe module. Keep the store's public behavior and `STORY_PROGRESS_KEY` unchanged.
- [ ] Implement `normalizeStoryProgressMap(unknown)`: accept a non-array object; drop invalid story records; preserve a valid record when its `visited` alone is malformed.
- [ ] Implement `mergeStoryProgressMaps(local, stored)`: retain latest `updatedAt` position, stored side wins ties, preserve one-sided stories, and merge `endings`/`visited` as stable, deduplicated unions.
- [ ] Add a minimal store method to commit a merged map using the existing localStorage key; keep unavailable-storage and quota failures nonfatal.
- [ ] Cover empty/tied/newer/one-sided/stale cases, malformed data, malformed `visited`, order, repeated merges, and preserving legacy-imported `updatedAt: 0` records. Existing store tests must continue passing.

**Done when:** Local behavior is unchanged and the same pure functions can be imported by both API and browser code.

## Task 2 — Database schema, migration and atomic repository

**Touch:** `apps/web/src/lib/drizzle/schema.ts`; generated `apps/web/src/lib/drizzle/migrations/*`; `apps/web/src/lib/drizzle/repositories.ts` or a small adjacent repository; repository/schema tests.

- [ ] Add `readingProgress` table: `userId` as user-FK primary key, `data` JSONB map, and `updatedAt`.
- [ ] Remove **only** the `bookmarks.storyId` → `stories.id` and `bookmarks.sceneId` → `scenes.id` references. Preserve bookmark text columns, user FK, uniqueness, and indexes.
- [ ] Run `bun --cwd apps/web drizzle:generate` and commit exactly the generated migration and its metadata. Inspect resulting SQL for one table creation and two FK drops; reject unrelated schema drift.
- [ ] Add one repository method `mergeForUser(userId, localMap)`: transaction -> lock `users` row `FOR UPDATE` -> read optional progress row -> merge -> insert/update -> return the map. Locking a guaranteed user row also serializes two first-time requests that would otherwise race on a missing progress row.
- [ ] Add focused repository tests for existing row, first row, union preservation, and transaction error propagation. Keep existing bookmark repository code unchanged unless evidence requires otherwise.

**Done when:** The migration matches the schema diff, and a user-scoped merge is atomic without a new infrastructure component.

## Task 3 — Authenticated POST sync endpoint

**Touch:** new `apps/web/src/pages/api/progress.ts` or `apps/web/src/pages/api/progress/index.ts`; `apps/web/src/lib/schemas.ts`; new `apps/web/src/pages/api/__tests__/progress.test.ts`.

- [ ] Define a Zod-validated `{ progress: ... }` request envelope and `{ progress: ... }` response. Reuse existing `requireAuth` and `jsonResponse` helpers, not a new auth path.
- [ ] Bound raw request size to the 48 KiB design cap (including when `Content-Length` is missing), return 413 on overflow and 400 on malformed JSON/body shape. Delegate record-level sanitation to Task 1.
- [ ] Read the authenticated user ID from the Better Auth session only; call `mergeForUser` and return the resulting map. Never trust a client-supplied user ID.
- [ ] Use existing logging/error conventions. Confirm 401 anonymous / 503 auth-degraded, 400 malformed, 413 oversized, 200 success, and 500 repository failures in route tests.
- [ ] Verify the endpoint requires no new environment variables and does not couple itself to Story Writer `stories` or `scenes`.

**Done when:** The API has the single pull+push contract with correct session isolation and bounded input.

## Task 4 — Browser sync helper and story-select status

**Touch:** new `apps/web/src/lib/story-progress-sync.ts`; `apps/web/src/pages/[locale]/stories/index.astro`; `apps/web/src/components/StorySelect.svelte`; `packages/stories/src/translations/{en,zh,ja}.json`; corresponding component/helper tests.

- [ ] Add small `syncStoryProgress` helper: read current local map; POST; validate/sanitize server result; **re-read and re-merge the freshest local map before committing** to avoid late responses erasing new local progress; return a simple success/error result. Allow a short timeout and `keepalive` call options, without a stateful global sync manager.
- [ ] Pass server-known auth state (`signed-in` / `signed-out` / `unavailable`) to `StorySelect`. Do not add a second client auth request.
- [ ] Keep initial local Continue cards immediate. On mount, import legacy sessions and refresh; if signed in, sync and refresh again. Repeat on restored `pageshow`; avoid unbounded duplicate requests if mount and return events overlap.
- [ ] Add the localized line between Continue and shelves: syncing, synced, signed-out-with-local-progress (with locale-correct login link), or sync failed. Show nothing for a new signed-out visitor or when auth is unavailable (the existing degraded banner applies).
- [ ] Test signed-in success/failure states, signed-out/no-progress and signed-out/with-progress states, no anonymous API requests, a cloud-only Continue card, and an in-flight local update preserved by response merging.

**Done when:** Cross-device progress appears in Continue after a normal signed-in story-select load, while signed-out behavior stays local and quiet.

## Task 5 — Reader initialization and bounded background sync

**Touch:** `apps/web/src/pages/[locale]/reader.astro`; `apps/web/src/lib/reader-manager.ts`; its existing Vitest suites and any focused sync-helper tests.

- [ ] Resolve `getSessionUser` in reader Astro frontmatter and pass auth state into the manager. Do not block signed-out reading or start sync for an unavailable session.
- [ ] In `ReaderManager.initialize()`, import existing legacy sessions as today, then, for signed-in users only, attempt one time-bounded sync **before** `selectInitialIntent()`. On failure/timeout, select from local immediately.
- [ ] Preserve explicit `?story=...&scene=...&dialogue=...` and `restart=1` precedence. A late network reply must never redirect or reset an already-mounted reader.
- [ ] Keep existing local `persist()` timing; schedule cloud writes at most once per minute while actively reading (not on every line).
- [ ] Reuse the current `onPageHide` and `onVisibilityChange` local flush before issuing one best-effort `keepalive` upload. Ensure `destroy()` removes listeners and timers. Failed/aborted cloud writes must never clear the browser copy.
- [ ] Add manager tests for signed-out no-op, signed-in startup resume, explicit deep-link precedence, short-timeout fallback, throttled writes, pagehide best effort, in-flight progress changes, and teardown.

**Done when:** Signed-in reader resume can use cloud progress without introducing a hard online dependency or per-line network traffic.

## Task 6 — Verification and release gate

**Automated checks** (after code lands on this same PR):

- [ ] `bun --cwd apps/web test:run`, including new merge, repository, API, story-select, and reader tests.
- [ ] `bun --cwd apps/web test:coverage`; satisfy existing coverage gate rather than excluding new code.
- [ ] `bun --cwd apps/web lint`, `bun run compile:stories`, and `bun --cwd apps/web build`.
- [ ] Run relevant existing Playwright tests for story selection/reader/bookmarks; new E2E should be added only if needed to cover a real gap, not as a replacement for a DB-backed bookmark smoke test.
- [ ] Inspect the generated SQL; confirm no unrelated foreign-key/index changes and no unexpected migration side effects.

**Manual / deployment acceptance:**

- [ ] Get Hapadona's approval to apply the Drizzle migration to production **before merge**. The PR must not claim this is done until the command and result have been verified.
- [ ] On a migrated deployment, sign in and save a bookmark against a **compiled** story ID (e.g. `train_adventure`); confirm it appears from the real `GET /api/bookmarks` path (not an API mock).
- [ ] In browser A, read a story and reach an ending; sign in on browser B and confirm the Continue strip and ending history are retained. Make different ending/visited discoveries on both; sync again and check the union.
- [ ] Verify signed-out mode makes **zero** `/api/progress` calls; disconnect the network while reading, resume locally, reconnect and confirm next-visit sync.
- [ ] Confirm labels and links render sensibly for English, Chinese and Japanese; verify no regressions to Story Writer bookmarks.

**Release ordering:** merged code depends on the new table. Generate/review migration in the PR -> obtain owner go-ahead -> apply migration -> verify DB schema/bookmark smoke -> merge/deploy code -> perform cross-browser acceptance. If migration approval or execution is unavailable, leave the PR **draft/unmerged**; do not silently deploy code ahead of the table.

## Not included in HPA-703

No reader settings sync, account selector/merge prompt, reset progress, local bookmark migration, desktop changes, generated visuals/audio, or unrelated reader UX bugs (HPA-819/HPA-820/HPA-821). Track those in their existing tickets, not in this PR.

## Reviewer checklist

- [ ] Design and API response shape match the Linear ticket.
- [ ] No server response can clobber newer local progress; discovered endings and visited scenes are monotonic.
- [ ] First-write as well as update concurrency is serialized by the transaction.
- [ ] No signed-out API traffic; reader remains usable offline.
- [ ] Migration drops only the two problematic bookmark FKs and runs before merge with approval.
- [ ] All implementation changes and tests remain in **this PR**.
