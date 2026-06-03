# Bookmarks + Act Side Panel Design

Date: 2026-06-03

## Overview

Three features for the web story reader:

1. **Local bookmarks** — localStorage-based bookmarks for guests (non-authenticated users)
2. **Bookmark page with sync** — show local and cloud bookmarks; one-way upload sync from local to cloud
3. **Act side panel** — navigation panel in the reader to jump between acts

## Approach

Extend existing managers (`BookmarksManager`, `ReaderManager`) and add a `LocalBookmarksStore` utility. Add an `ActPanel.svelte` component. No new database tables or API endpoints.

## Feature 1: Local Bookmarks

### Current State

`ReaderManager.handleBookmark()` POSTs to `/api/bookmarks` which requires auth. On 401, it shows an error.

### New Behavior

- `LocalBookmarksStore` utility class at `apps/web/src/lib/local-bookmarks-store.ts`
- localStorage key: `aquila:bookmarks:{locale}`
- `ReaderManager.handleBookmark()` tries API first; on 401, falls back to `LocalBookmarksStore.create()`
- Same "bookmark saved" confirmation either way

### Data Model

```ts
interface LocalBookmark {
  id: string;          // nanoid
  storyId: string;
  sceneId: string;
  bookmarkName: string; // includes [dlg:N] prefix
  locale: string;
  createdAt: number;    // Date.now()
  updatedAt: number;
}
```

## Feature 2: Bookmark Page with Sync

### Current State

`BookmarksManager` fetches `/api/bookmarks` and renders cards. On 401 shows "not logged in" with login link.

### New Behavior

- `BookmarksManager.loadBookmarks()` always loads local bookmarks from `LocalBookmarksStore`. If logged in, also fetches cloud bookmarks.
- Three rendered sections:
  1. **Cloud Bookmarks** (logged in only) — existing card UI, unchanged
  2. **Local Bookmarks** (always shown) — same card UI with "Sync to Cloud" button per bookmark (logged in only)
  3. **Bulk Sync** button (logged in + has local bookmarks) — uploads all local bookmarks via sequential POSTs to `/api/bookmarks`, removes from localStorage on success
- "Not logged in" state: show local bookmarks + message suggesting login for cloud sync

### Sync Behavior

- One-way upload only (local → cloud)
- Per-bookmark: POST to `/api/bookmarks` (existing upsert endpoint), on success remove from `LocalBookmarksStore`
- Bulk sync: iterate all local bookmarks, POST each, remove successfully synced ones
- No new API endpoints — uses existing `POST /api/bookmarks` with `upsertByScene`

## Feature 3: Act Side Panel

### Current State

`NovelReader.svelte` has linear navigation only (Enter to advance, Backspace to go back). No way to jump to specific acts.

### New Behavior

- Toggle button (icon) in the NovelReader header area
- Clicking opens a slide-out side panel from the right, overlaying the reader
- Act list derived from flow config at runtime:
  - Regex: `/(?:^|_)(act\d+|actFinal|actEpilogue)/` extracts act name from scene IDs
  - Sorted: Act 1, Act 2, ... Act N, Final, Epilogue
  - Works for both Train Adventure (`act1`, `b1a_act4`, `b1a_b2a_b3a_b4a_act13`) and Don't Save Me (`ch1_act1`)
- Each act navigates to the first scene ID matching that act
- Current act highlighted based on reader position
- Close on click-outside, ESC, or act selection

### Component Structure

- `ActPanel.svelte` — new Svelte component, props: `{ storyId, currentSceneId, onNavigate, locale }`
- `ReaderManager` passes `onNavigate: (sceneId: string) => void` which calls `navigateToScene()`
- Act list computed from `getStoryFlow(storyId).nodes`

## File Changes

| File | Change |
|---|---|
| `apps/web/src/lib/local-bookmarks-store.ts` | **New** — localStorage bookmark CRUD |
| `apps/web/src/lib/reader-manager.ts` | Modify `handleBookmark()` — fallback to local on 401 |
| `apps/web/src/lib/bookmarks-manager.ts` | Modify — load local, render sections, sync buttons |
| `apps/web/src/components/ActPanel.svelte` | **New** — act navigation side panel |
| `apps/web/src/components/NovelReader.svelte` | Add toggle button, mount ActPanel |
| `packages/stories/src/translations/en.json` | Add sync/act panel keys |
| `packages/stories/src/translations/zh.json` | Same keys in Chinese |

## Out of Scope

- No new database tables or API endpoints
- No bidirectional sync or conflict resolution
- No explicit act metadata manifest
- No act panel for desktop/Tauri (web reader only)
