# HPA-703 — Account Reading Progress Sync and Cloud Bookmarks Design

**Status:** Proposed for review. This is a documentation-only draft PR; implement the approved changes in the **same PR**, not a follow-up PR.

- Linear: https://linear.app/cwchanap/issue/HPA-703/sync-reading-progress-to-the-account-and-fix-cloud-bookmarks
- Implementation checklist: [2026-11-10-hpa-703-reading-progress-sync.md](../plans/2026-11-10-hpa-703-reading-progress-sync.md)
- Scope: Aquila web reader and story selection, the progress API/persistence, and the existing cloud-bookmark foreign-key fix. No image, audio, or story-writing work.

## Problem and verified baseline

Aquila currently persists per-story progress in localStorage under `aquila:storyProgress:v1` via `apps/web/src/lib/story-progress-store.ts`. The record stores `sceneId`, `dialogueIndex`, `updatedAt`, `finished`, `endings`, and optional `visited`; it is shared across reading languages. `StorySelect.svelte` imports legacy reader sessions into this store and builds Continue cards. `ReaderManager` imports the same sessions and selects the opening intent from the URL and stored progress.

There is no account-backed progress API. A signed-in user starting on another browser cannot see their prior Continue position.

Cloud bookmarks have a separate schema mismatch: `bookmarks.story_id` and `bookmarks.scene_id` reference `stories` and `scenes`, which are Story Writer tables. Published, compiled stories use logical story/scene IDs that are not rows in those tables. Their authenticated bookmark insert can therefore violate the FK constraints. Existing API tests mock the repository, so the production error is a **schema-supported diagnosis, not yet a live reproduction**.

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

## Data and API contract

Define `readingProgress` in `schema.ts`, backed by table `reading_progress`:

| Column | Type | Rule |
| --- | --- | --- |
| `user_id` | text | primary key; FK `users.id` with cascade delete |
| `data` | jsonb | non-null progress map; default empty object |
| `updated_at` | timestamp | non-null; update on write |

The JSON structure is `Record<string, StoryProgress>`, using existing logical compiled-story IDs as keys. Do **not** add FKs to `stories` or `scenes`, because those tables do not contain compiled story entries.

For `bookmarks`, remove only the `story_id` and `scene_id` foreign keys. Keep both columns non-null text, the `user_id` user FK, and current indexes/uniqueness. No API or repository rewrite is needed for bookmark CRUD.

Generate **one** Drizzle migration for these changes using `bun --cwd apps/web drizzle:generate`; review its SQL and metadata. Do not edit prior migrations or hand-edit the Drizzle journal.

### Request and response

`POST /api/progress`:

- Request JSON: `{ "progress": { "<story-id>": { /* existing StoryProgress */ } } }`
- Response HTTP 200 JSON: `{ "progress": { "<story-id>": { /* merged StoryProgress */ } } }`
- Signed out: 401; auth system unavailable: existing `requireAuth` 503.
- Malformed envelope or JSON: 400; request exceeding a small documented cap (propose **48 KiB**, safely under typical 64 KiB keepalive budgets): 413; database failure: 500.
- Authenticate before processing or storing user data; user ID comes **only** from the session.
- Use Zod for the envelope, and the shared progress sanitizer below for individual records. An invalid individual story record is **dropped** (the current local-store behavior), not a reason to erase unrelated valid stories.

Do not rely on `Content-Length` alone for the cap; a bounded read must also reject a large body when the header is absent or incorrect. The existing API response helper can return the raw `{ progress }` object.

### Merge semantics

Extract pure normalization/merging into `apps/web/src/lib/story-progress.ts` (or an equivalently small web-only module) and use the **same functions** in `StoryProgressStore`, the API path, and the sync response handler. Do not duplicate validation between client and server.

For each story:

- Both present: `updatedAt` selects the position fields (`sceneId`, `dialogueIndex`, `finished`); tie deterministically favors the **stored/server** record. Missing on one side: preserve the present record.
- `endings` is a de-duplicated stable union; `visited` is likewise a de-duplicated stable union if either side provides it. Preserve the selected record's discovery order first, then append previously unseen entries from the other side. Keep `visited` optional for legacy records.
- Reject records failing the current `isProgress` checks. If `visited` alone is malformed, drop that field but keep its position/endings.
- A merge must be idempotent; a later stale upload must not remove a previously discovered ending or visited act.

**Cross-device limits:** “newer” is determined by the device-produced epoch-millisecond `updatedAt` already in the store. Clock skew can affect which position wins. We accept this existing timestamp rule for the MVP; do not add server revisions or a conflict UI.

### Atomic server write

A read/merge/write must run inside **one** Drizzle transaction. Serialize by locking the authenticated `users` row (`FOR UPDATE`) before looking up `reading_progress`. This also protects the **first insert**, when there is no progress row to lock yet. Then read the current progress, run the pure merge, and insert/update the same user's row. No in-memory locks or separate transaction service.

This lock is for correctness of the union under simultaneous device syncs, not a broader concurrency framework.

## Browser integration

### Shared lightweight sync operation

Add one small browser helper that:

1. Reads the current local map from `StoryProgressStore`.
2. POSTs it with same-origin session credentials and an optional short timeout/`keepalive` mode.
3. On success, **re-reads localStorage** and merges the returned remote map into this freshest local copy before writing the result; otherwise an in-flight reply could overwrite a line read since the request began.
4. Reports success/failure to its caller; a failure never clears local progress or blocks reading.

Add the smallest local-store write method needed to commit an already merged map. Do not add a global Svelte store or background worker. A pagehide keepalive request is best-effort, not durable delivery; the next normal sync supplies eventual retry.

### Story selection

Pass a simple server-rendered auth state from `stories/index.astro` to `StorySelect.svelte`: signed-in, signed-out, or auth-unavailable. Avoid redundant client-side session fetching. On mount, import legacy sessions, show the local Continue cards immediately, and, **only if signed in**, sync then recompute cards. On persisted `pageshow`, refresh and sync again when appropriate. No sync requests from signed-out or auth-unavailable visitors.

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

- At first initialization, **import old local sessions first**, then attempt one short, bounded sync **before** `selectInitialIntent()`. On timeout or failure, start immediately from the local position. Preserve explicitly supplied scene/dialogue and restart routes.
- After local persistence, throttle cloud pushes to no more than approximately once per minute while reading. Do **not** POST on every dialogue line.
- Reuse existing `visibilitychange`/`pagehide` handlers to flush local progress, then attempt a best-effort `keepalive` push. Ensure listeners/timers are cleaned up in `destroy()` and no late result repositions an active reading session.
- Syncing never requires the connection to be online for local navigation, and signing out leaves the local map intact.

## Testing and rollout

Unit-test sanitization, newer/tied positions, empty maps, one-sided stories, malformed `visited`, stable discovery union, and repeat merges. Test API 401/400/413/200/500 plus transactional read-merge-write with sequential concurrent-device scenarios (including first-write). Component-test the auth-state status lines, local-then-cloud Continue updates, error fallback, and no calls while signed out. Reader tests must cover initial resume precedence, timeout fallback, throttling, pagehide, and cleanup. A migrated deployment must verify real compiled-story bookmark POST/list; mocked API tests cannot prove the DB fix.

**Migration gate:** Production migrations do not run in the Vercel build. Before merging the implementation, get Hapadona's approval and run `bun drizzle:migrate` against the production database. The table can exist before code ships; removal of the two bookmark FKs is compatible with current query paths. Do not run or claim a production migration as part of this design-only draft.

## Explicit exclusions

- Reader settings, alternate-language preferences, character names, or signed-out local bookmarks transfer.
- Desktop app, account reset, conflict-picking UI, real-time multi-device sync, offline job queue, new auth framework.
- Visual art, generated images, BGM, SFX, voice content, and story branches.
- A second PR for this ticket.
