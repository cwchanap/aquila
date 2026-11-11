# HPA-703 — Account Reading Progress Sync and Cloud Bookmarks Design

**Status:** Implemented in this branch; CI, Hapadona's approval, the production migration, and deployed acceptance are still pending. Do not merge before the real-Postgres CI gate passes and the production migration is approved and run.

- Linear: https://linear.app/cwchanap/issue/HPA-703/sync-reading-progress-to-the-account-and-fix-cloud-bookmarks
- Implementation checklist: [2026-11-10-hpa-703-reading-progress-sync.md](../plans/2026-11-10-hpa-703-reading-progress-sync.md)
- Scope: Aquila web reader and story selection, the progress API/persistence, and the existing cloud-bookmark foreign-key fix. No image, audio, or story-writing work.

## Problem and verified baseline

Aquila currently persists per-story progress in localStorage under `aquila:storyProgress:v1` via `apps/web/src/lib/story-progress-store.ts`. The record stores `sceneId`, `dialogueIndex`, `updatedAt`, `finished`, `endings`, and optional `visited`; it is shared across reading languages. `StorySelect.svelte` imports legacy reader sessions into this store and builds Continue cards. `ReaderManager` imports the same sessions and selects the opening intent from the URL and stored progress.

There is no account-backed progress API. A signed-in user starting on another browser cannot see their prior Continue position.

Cloud bookmarks have a schema mismatch: `bookmarks.story_id` and `bookmarks.scene_id` reference `stories` and `scenes`, which contain Story Writer rows rather than compiled story IDs. A third field has the same problem: `character_setups.story_id` references `stories.id` even though `POST /api/character-setup` accepts registered compiled story IDs such as `train_adventure`. Their authenticated inserts can violate these constraints. Existing tests mock database repositories, so these are **schema-supported diagnoses, not yet live reproductions**.

Existing seams to reuse:

- `apps/web/src/pages/[locale]/stories/index.astro` already resolves `getSessionUser` and passes `user` to `UserStatus`; `StorySelect` currently receives only `locale`.
- `apps/web/src/pages/[locale]/reader.astro` does not yet resolve the session; it mounts `ReaderManager` on DOMContentLoaded.
- `apps/web/src/pages/api/bookmarks/index.ts` shows `requireAuth`, `parseBody`, `jsonResponse`, and repository patterns.
- Drizzle schema is in `apps/web/src/lib/drizzle/schema.ts`; generated SQL and journal are in `apps/web/src/lib/drizzle/migrations/`.
- Localization lives in `packages/stories/src/translations/{en,zh,ja}.json`.

## Design decisions

1. **Local-first:** localStorage stays the fast/offline working copy. Keep its key and existing per-story record shape; do not migrate reader settings or the separate legacy session key.
2. **One account document:** one `reading_progress` row per authenticated user, holding the same progress map as JSONB. No per-story SQL rows, device IDs, queues, WebSocket channel, or extra sync service.
3. **One endpoint:** `POST /api/progress` both pushes the browser copy and pulls the merged account copy. No separate GET, conflict dialogue, or client-side account cache.
4. **Union discovery, latest position:** for each story retain the newer position and union its reached endings/visited scenes. This preserves discoveries even if the latest device has not visited them.
5. **Explicit reader navigation still wins:** a URL with scene/dialogue parameters or `restart=1` must not be overridden by the remote opening position.
6. **Fix all three compiled-ID FKs in one migration:** removing `character_setups.story_id` → `stories.id` is the same data-integrity correction as the two bookmark drops. This **does not** sync character names or change character-setup UX.

## Data and API contract

Define `readingProgress` in `schema.ts`, backed by table `reading_progress`:

| Column | Type | Rule |
| --- | --- | --- |
| `user_id` | text | primary key; FK `users.id` with cascade delete |
| `data` | jsonb | non-null progress map; default empty object |
| `updated_at` | timestamp | non-null; update on write |

The JSON structure is `Record<string, StoryProgress>`, using existing logical compiled-story IDs as keys. Do **not** add FKs to `stories` or `scenes`, because those tables do not contain compiled story entries.

For `bookmarks`, remove the `story_id` and `scene_id` foreign keys; keep both columns non-null text, the `user_id` user FK, and existing indexes/uniqueness. For `character_setups`, also remove its `story_id` foreign key to `stories.id`, leaving that column non-null text and retaining its `user_id` FK and indexes. No bookmark or character-setup API/repository rewrite is needed for this schema-only correction.

Generate **one** Drizzle migration for these changes using `bun --cwd apps/web drizzle:generate`; expect one table creation and **three** FK drops, with no unrelated drift. Review SQL and metadata; do not edit prior migrations or hand-edit the Drizzle journal.

### Request and response

`POST /api/progress`:

- Request JSON: `{ "progress": { "<story-id>": { /* existing StoryProgress */ } } }`
- Response HTTP 200 JSON: `{ "progress": { "<story-id>": { /* merged StoryProgress */ } } }`
- Signed out: 401; auth system unavailable: existing `requireAuth` 503.
- Malformed envelope or JSON: 400; request exceeding **48 KiB** of UTF-8 request bytes: 413; database failure: 500. Browser `keepalive` requests must handle fetch rejection if the browser's remaining keepalive budget is insufficient.
- Authenticate before processing or storing user data; user ID comes **only** from the session.
- Use Zod for the envelope, and the shared progress sanitizer below for individual records. An invalid individual story record is **dropped** (the current local-store behavior), not a reason to erase unrelated valid stories.

Extend the existing `parseBody(request, schema)` helper with optional `maxBytes`. With a limit, read `request.text()` once, count **UTF-8 bytes** (not JavaScript string characters), return 413 when over budget, otherwise `JSON.parse` and run the existing Zod validation. Without a limit, preserve current behavior. Do not implement a bespoke streaming reader: the existing Vercel request-body limit bounds the read. The cap is independent of `Content-Length`. Continue returning the raw `{ progress }` via `jsonResponse`.

### Merge semantics

Extract pure normalization/merging into `apps/web/src/lib/story-progress.ts` (or an equivalently small web-only module) and use the **same functions** in `StoryProgressStore`, the API path, and the sync response handler. Do not duplicate validation between client and server.

For each story:

- Both present: `updatedAt` selects the position fields (`sceneId`, `dialogueIndex`, `finished`); tie deterministically favors the **stored/server** record. Missing on one side: preserve the present record.
- `endings` is a de-duplicated stable union; `visited` is likewise a de-duplicated stable union if either side provides it. Preserve the selected record's discovery order first, then append previously unseen entries from the other side. Keep `visited` optional for legacy records.
- Reject records failing the current `isProgress` checks. If `visited` alone is malformed, drop that field but keep its position/endings.
- A merge must be idempotent; a later stale upload must not remove a previously discovered ending or visited act.

**Cross-device limits:** “newer” is determined by the device-produced epoch-millisecond `updatedAt` already in the store. This can legitimately move the Continue position **backward**: a freshly read ch1 on another browser beats an older saved ch9 when that browser signs in. That is acceptable because `visited` remains the union, and users can jump to visited scenes in the story map. Device clock skew can also affect which position wins. Do not add server revisions or a conflict UI.

### Atomic server write

A read/merge/write must run inside **one** Drizzle transaction. Serialize by locking the authenticated `users` row with `FOR NO KEY UPDATE` (Drizzle `.for('no key update')`) before looking up `reading_progress`. It conflicts with another sync's lock (including the **first insert** where no progress row exists), without blocking unrelated foreign-key `FOR KEY SHARE` checks for sessions/bookmarks/character setups. Then read the stored progress, merge, insert/update, and return the result. No in-memory locks or extra transaction service.

This lock is for correctness of the union under simultaneous device syncs, not a broader concurrency framework.

## Browser integration

### Shared lightweight sync operation

Add one small browser helper that:

1. Reads the current local map from `StoryProgressStore`.
2. POSTs it with same-origin session credentials; support a **1,500 ms timeout for the conditional reader-start wait** and optional `keepalive` for hidden/pagehide.
3. On success, **re-reads localStorage** and merges the returned remote map into this freshest local copy before writing the result; otherwise an in-flight reply could overwrite a line read since the request began.
4. Reports success/failure to its caller; a failure never clears local progress or blocks reading.

Add the smallest local-store write method needed to commit an already merged map. Do not add a global Svelte store or background worker. A pagehide keepalive request is best-effort, not durable delivery; catch/recover from fetch rejection (including browser keepalive-budget errors), and let the next normal sync retry.

### Story selection

Derive the three-state auth flag (`signed-in` / `signed-out` / `unavailable`) from existing `getSessionUser` / `SessionResult` in one small server-side helper reused by both Astro pages, then pass it to `StorySelect.svelte`. Avoid redundant client-side session fetching. On mount, import legacy sessions, show the local Continue cards immediately, and, **only if signed in**, sync then recompute cards. On persisted `pageshow`, refresh and sync again when appropriate. No sync requests from signed-out or auth-unavailable visitors.

A discreet line after the Continue section (and before the shelves) uses translations in all three locales:

| State | English line |
| --- | --- |
| Signed in, initial request | “Syncing your progress…” |
| Signed in, synced | “Your progress is saved to your account” |
| Signed out, with local progress | “Progress is saved in this browser only. Sign in to pick it up on any device.” (localized login link) |
| Sync failure | “Couldn't reach your account. Progress is kept in this browser and syncs next time.” |
| Signed out, no progress / auth unavailable | No line; existing auth-degraded banner handles the latter |

Never show an always-spinning state on a failed or timed-out request.

### Reader

Resolve the session in `reader.astro` and supply the auth state to `ReaderManager`. Signed-out readers have no new network behavior.

For signed-in readers:

- Import old local sessions first as today. **Wait up to 1,500 ms for initial sync only when the URL has `story` but no `scene`, `dialogue`, or `restart=1`**, because only this URL shape can use a newly merged position in `selectInitialIntent()`. On timeout/failure, start from local immediately. For explicit deep links, restart links, and no-story URLs, **do not await a network call**: load normally and let the first throttled push sync. Never redirect an already-open reader on a late response.
- Inside the existing debounced `persist()`, use a **leading-edge timestamp check** (`Date.now() - lastPushAt >= 60_000`) to POST at most once per minute during reading; this is the first push for URL shapes that skip initial sync. Do **not** add a trailing throttle timer or POST on every line.
- Reuse existing `visibilitychange`/`pagehide` handlers to flush local progress then make one best-effort `keepalive` POST. Avoid duplicate ordinary/keepalive sends from the same flush or repeated lifecycle events. Existing timers/listeners are cleaned up in `destroy()`; no new throttle timer is needed. A failure/late response never clears local progress or repositions the reader.
- Syncing never requires the connection to be online for local navigation, and signing out leaves the local map intact.

## Testing and rollout

Unit-test sanitization, newer/tied/backward positions, empty maps, one-sided stories, malformed `visited`, stable discovery union, and repeat merges. Test API 401/400/413/200/500, including multibyte-byte-length limits. Component-test auth status lines, local-to-cloud Continue updates, error fallback, and zero signed-out calls. Reader tests cover conditional initial resume, 1,500 ms fallback, leading-edge throttling, pagehide, dedupe, and cleanup.

**Real-DB gate before production:** reuse the existing `postgres:16` service and `bun run drizzle:migrate` step in `.github/workflows/e2e-tests.yml`. Add a focused DB-backed Vitest step immediately afterward (gated on an environment variable set by that job): create a user; run simultaneous first-time `mergeForUser` calls via `Promise.all` and verify the stored union; write and read a compiled-story bookmark **and** a character setup (`train_adventure` plus compiled scene ID for the bookmark). Clean up the test user. The current E2E job **skips draft PRs** (`if: ... draft == false`), so this gate must pass once the implementation is ready for review or via an explicitly triggered workflow before any production migration. Mocked repository or intercepted Playwright calls cannot substitute for this test.

**Migration gate:** Production migrations do not run in the Vercel build. After the real-Postgres CI gate passes, obtain Hapadona's approval and run `bun drizzle:migrate` against production **before merging** the implementation. The table can exist before code ships; removing the three compiled-ID FKs preserves existing query paths. Do not run or claim a production migration before that approval.

## Explicit exclusions

- Reader settings, alternate-language preferences, character names, or signed-out local bookmarks transfer.
- Desktop app, account reset, conflict-picking UI, real-time multi-device sync, offline job queue, new auth framework.
- Visual art, generated images, BGM, SFX, voice content, and story branches.
- A second PR for this ticket.
