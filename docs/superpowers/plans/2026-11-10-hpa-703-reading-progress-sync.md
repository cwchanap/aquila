# HPA-703 — Reading Progress Sync and Bookmarks Implementation Plan

> **Planning-stage PR:** This PR initially contains only the design and plan. After review, implement HPA-703 **in this same PR/branch**. Do not create a second implementation PR.

**Linear:** https://linear.app/cwchanap/issue/HPA-703/sync-reading-progress-to-the-account-and-fix-cloud-bookmarks

**Design:** [2026-11-10-hpa-703-reading-progress-sync-design.md](../specs/2026-11-10-hpa-703-reading-progress-sync-design.md)

**Goal:** Signed-in web readers share Continue position and reached endings across browsers; compiled-story cloud bookmarks and existing character setups no longer fail on Story Writer-only foreign keys. Signed-out/offline reading retains existing behavior.

**Stack:** Bun, TypeScript, Astro server pages, Svelte 5, Better Auth, Drizzle/Postgres, Zod, Vitest and existing Playwright E2E suite.

## Constraints and decisions

- One Linear ticket, one PR, no separate branch or PR for coding after this design is approved.
- Reuse `aquila:storyProgress:v1` as the local working copy and the current `StoryProgress` record; no new client store or service layer.
- One per-user JSONB row; one authenticated `POST /api/progress`; one small shared pure merge module; one lightweight fetch helper. Prefer existing helpers over adding readers, throttling timers or services.
- No images, portrait generation, BGM/SFX, story-writing changes, desktop integration, realtime updates, background queues, or general settings synchronization.
- Do not execute production database migrations automatically. Obtain explicit owner approval and run the documented migration **before merging** code that depends on the new table.
- Every task's tests are part of this **same** implementation PR. Keep changes tightly scoped to the issue.

## Task 1 — Shared progress model, validation, and local write

**Touch:** `apps/web/src/lib/story-progress-store.ts`; new `apps/web/src/lib/story-progress.ts` (or equivalent); `apps/web/src/lib/__tests__/story-progress-store.test.ts`; new focused merge tests.

- [ ] Move/extract `StoryProgress`/`StoryProgressMap`, the current `isProgress` checks and optional-`visited` sanitization into a pure browser/server-safe module. Keep the store's public behavior and `STORY_PROGRESS_KEY` unchanged.
- [ ] Implement `normalizeStoryProgressMap(unknown)`: accept a non-array object; drop invalid story records; preserve a valid record when its `visited` alone is malformed.
- [ ] Implement `mergeStoryProgressMaps(local, stored)`: retain latest `updatedAt` position, stored side wins ties, preserve one-sided stories, and merge `endings`/`visited` as stable, deduplicated unions.
- [ ] Add a minimal store method to commit a merged map using the existing localStorage key; keep unavailable-storage and quota failures nonfatal.
- [ ] Cover empty/tied/newer/one-sided/stale cases, including a **newer but earlier** reading position winning while `visited` and `endings` still union; malformed data/`visited`, stable order, idempotent merges, and preserving legacy-imported `updatedAt: 0` records. Existing store tests must continue passing.

**Done when:** Local behavior is unchanged and the same pure functions can be imported by both API and browser code.

## Task 2 — Database schema, migration and atomic repository

**Touch:** `apps/web/src/lib/drizzle/schema.ts`; generated `apps/web/src/lib/drizzle/migrations/*`; `apps/web/src/lib/drizzle/repositories.ts` or a small adjacent repository; repository/schema tests.

- [ ] Add `readingProgress` table: `userId` as user-FK primary key, `data` JSONB map, and `updatedAt`.
- [ ] Remove **three** compiled-ID FKs: `bookmarks.storyId` → `stories.id`, `bookmarks.sceneId` → `scenes.id`, and `characterSetups.storyId` → `stories.id`. Preserve text columns, both user FKs, indexes, and bookmark uniqueness. Character-name sync is still out of scope.
- [ ] Run `bun --cwd apps/web drizzle:generate` and commit exactly the generated migration/metadata. Inspect SQL for **one table creation plus three FK drops**; reject unrelated schema drift.
- [ ] Add one repository method `mergeForUser(userId, localMap)`: transaction -> lock `users` row `FOR NO KEY UPDATE` via Drizzle `.for('no key update')` -> read optional progress row -> merge -> insert/update -> return map. This serializes simultaneous first writes without unnecessarily blocking FK-checked session/bookmark/character inserts.
- [ ] Test the first-insert race against **real PostgreSQL**, not just the mock-chain repository. Reuse the `postgres:16` service and migration step in `.github/workflows/e2e-tests.yml`: create a test user, run two different first-time `mergeForUser` calls in `Promise.all`, then verify both discoveries in the stored row. Also verify a compiled-story bookmark and character setup can be inserted and read. Clean up that user. No new database service or separate CI workflow.

**Done when:** The migration matches the three-FK schema diff and a user-scoped merge passes a real-Postgres concurrent-first-write test.

## Task 3 — Authenticated POST sync endpoint

**Touch:** new `apps/web/src/pages/api/progress.ts` or `apps/web/src/pages/api/progress/index.ts`; `apps/web/src/lib/schemas.ts`; new `apps/web/src/pages/api/__tests__/progress.test.ts`.

- [ ] Define a Zod-validated `{ progress: ... }` request envelope and `{ progress: ... }` response. Reuse existing `requireAuth` and `jsonResponse` helpers, not a new auth path.
- [ ] Extend the shared `parseBody` helper with an **optional** `maxBytes` argument. For limited calls, read `request.text()` once, count UTF-8 bytes (not JS characters), return 413 when over **48 KiB**, then parse JSON and apply Zod. Keep existing callers unchanged; no bespoke stream reader. Check 400 on malformed JSON/body shape and 413 even without `Content-Length`; delegate per-record sanitation to Task 1.
- [ ] Read the authenticated user ID from the Better Auth session only; call `mergeForUser` and return the resulting map. Never trust a client-supplied user ID.
- [ ] Use existing logging/error conventions. Confirm 401 anonymous / 503 auth-degraded, 400 malformed, 413 oversized, 200 success, and 500 repository failures in route tests.
- [ ] Verify the endpoint requires no new environment variables and does not couple itself to Story Writer `stories` or `scenes`.

**Done when:** The API has the single pull+push contract with correct session isolation, a reusable optional request cap, and bounded input.

## Task 4 — Browser sync helper and story-select status

**Touch:** new `apps/web/src/lib/story-progress-sync.ts`; `apps/web/src/pages/[locale]/stories/index.astro`; `apps/web/src/components/StorySelect.svelte`; `packages/stories/src/translations/{en,zh,ja}.json`; corresponding component/helper tests.

- [ ] Add small `syncStoryProgress` helper: read current local map; POST; validate/sanitize server result; **re-read and re-merge the freshest local map before committing** to avoid late responses erasing new progress; return success/error. Support optional **1,500 ms** reader-start timeout and `keepalive`, catching fetch rejection if the browser's keepalive budget is exceeded. No global sync manager.
- [ ] Derive server-known auth state (`signed-in` / `signed-out` / `unavailable`) through one small `SessionResult` helper reused by story-select and reader Astro pages. Pass it to `StorySelect`; do not add a second client auth request.
- [ ] Keep initial local Continue cards immediate. On mount, import legacy sessions and refresh; if signed in, sync and refresh again. Repeat on restored `pageshow`; avoid unbounded duplicate requests if mount and return events overlap.
- [ ] Add the localized line between Continue and shelves: syncing, synced, signed-out-with-local-progress (with locale-correct login link), or sync failed. Show nothing for a new signed-out visitor or when auth is unavailable (the existing degraded banner applies).
- [ ] Test signed-in success/failure states, signed-out/no-progress and signed-out/with-progress states, no anonymous API requests, a cloud-only Continue card, and an in-flight local update preserved by response merging.

**Done when:** Cross-device progress appears in Continue after a normal signed-in story-select load, while signed-out behavior stays local and quiet.

## Task 5 — Reader initialization and bounded background sync

**Touch:** `apps/web/src/pages/[locale]/reader.astro`; `apps/web/src/lib/reader-manager.ts`; its existing Vitest suites and any focused sync-helper tests.

- [ ] Resolve `getSessionUser` in reader Astro frontmatter and pass auth state into the manager. Do not block signed-out reading or start sync for an unavailable session.
- [ ] In `ReaderManager.initialize()`, after existing legacy-session import, **await at most 1,500 ms of sync only when the URL includes `story` and omits `scene`, `dialogue` and `restart=1`**: this is the only link shape where `selectInitialIntent()` can use the merged position. On failure/timeout, start locally. For explicit deep links, restart links, and absent-`story` URLs, start immediately; the first eligible push will sync.
- [ ] Preserve explicit `?story=...&scene=...&dialogue=...` and `restart=1` precedence. Never redirect/reset an already-mounted reader from a late response.
- [ ] Keep existing local `persist()` timing; add a **leading-edge** `Date.now() - lastPushAt >= 60_000` check inside `persist()` to trigger at most one normal cloud push per minute. No trailing timer or per-line POST. Account for successful initial sync in `lastPushAt`.
- [ ] Reuse `onPageHide` / `onVisibilityChange`: flush local storage before one best-effort `keepalive` push, avoid duplicate send from the ordinary persist check or repeated lifecycle events. No new throttle timer in `destroy()`; existing listeners/timers are cleaned up. Failed/late requests must not clear progress or change reader position.
- [ ] Add manager tests for signed-out no-op, conditional signed-in startup resume, explicit-link skip, **1,500 ms** fallback, leading-edge throttling, pagehide/deduplication, in-flight progress changes, and teardown.

**Done when:** Signed-in reader resume can use cloud progress without introducing a hard online dependency or per-line network traffic.

## Task 6 — Verification and release gate

**Automated checks** (after code lands on this same PR):

- [ ] `bun --cwd apps/web test:run`, including new merge, repository, API, story-select, and reader tests.
- [ ] `bun --cwd apps/web test:coverage`; satisfy existing coverage gate rather than excluding new code.
- [ ] `bun --cwd apps/web lint`, `bun run compile:stories`, and `bun --cwd apps/web build`.
- [ ] In `.github/workflows/e2e-tests.yml`, immediately after its existing `Run database migrations` step, add a focused Vitest step (working dir `apps/web`, e.g. `bun run test:run src/lib/drizzle/__tests__/progress-db.test.ts`) with a dedicated `AQUILA_PROGRESS_DB_TEST=1` flag. Gate the DB test file on that flag; it must use the job's real `DATABASE_URL`. Include concurrent first-write union plus compiled-ID bookmark/character writes, as specified in Task 2.
- [ ] The E2E job currently **skips draft PRs** (`if: ... draft == false`). Ensure the real-DB gate runs when the implementation is marked ready for review or via an explicitly dispatched workflow **before any production migration**; do not report draft CI as having executed it.
- [ ] Run relevant existing Playwright tests for story selection/reader/bookmarks; avoid Google-only signed-in Playwright as a substitute for the repository-level DB check. Add new E2E only if it fills a real gap.
- [ ] Inspect generated SQL; confirm exactly the intended table and **three** FK drops, without unrelated index changes or migration drift.

**Manual / deployment acceptance:**

- [ ] Get Hapadona's approval to apply the Drizzle migration to production **before merge**. The PR must not claim this is done until the command and result have been verified.
- [ ] On a migrated deployment, sign in and save a bookmark against a **compiled** story ID (e.g. `train_adventure`) and verify it via real `GET /api/bookmarks`; also save and read back the existing character setup for a compiled story. Neither check may rely on an API mock.
- [ ] In browser A, read a story and reach an ending; sign in on browser B and confirm the Continue strip and ending history are retained. Make different ending/visited discoveries on both; sync again and check the union.
- [ ] Verify signed-out mode makes **zero** `/api/progress` calls; disconnect the network while reading, resume locally, reconnect and confirm next-visit sync.
- [ ] Confirm labels and links render sensibly for English, Chinese and Japanese; verify no regressions to Story Writer bookmarks.

**Release ordering:** generate/review migration in this PR -> run **real-Postgres CI** (not skipped draft CI) -> obtain owner go-ahead -> apply production migration -> verify DB schema/bookmark/character smoke -> merge/deploy implementation -> perform cross-browser acceptance. If CI, migration approval, or execution is unavailable, leave the PR **unmerged**; do not deploy code ahead of its table.

## Not included in HPA-703

No reader settings sync, account selector/merge prompt, reset progress, local bookmark migration, desktop changes, generated visuals/audio, or unrelated reader UX bugs (HPA-819/HPA-820/HPA-821). Track those in their existing tickets, not in this PR.

## Reviewer checklist

- [ ] Design and API response shape match the Linear ticket.
- [ ] No server response can clobber newer local progress; discovered endings and visited scenes are monotonic.
- [ ] First-write as well as update concurrency is serialized with `FOR NO KEY UPDATE` and proven in real-Postgres CI.
- [ ] No signed-out API traffic, unnecessary reader startup wait, or new throttle timer; reader stays usable offline.
- [ ] Migration drops exactly three compiled-story FKs (including `character_setups.story_id`) and runs before merge with approval.
- [ ] All implementation changes and tests remain in **this PR**.
