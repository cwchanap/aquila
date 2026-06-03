# Bookmarks + Act Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add local bookmarks (localStorage for guests), bookmark page sync UI, and an act navigation side panel to the web story reader.

**Architecture:** Extend existing managers (`ReaderManager`, `BookmarksManager`) with a new `LocalBookmarksStore` utility for localStorage-based bookmarks. Add `ActPanel.svelte` component for act navigation, mounted by `ReaderManager`.

**Tech Stack:** TypeScript, Svelte, localStorage, existing `/api/bookmarks` endpoints, nanoid

**Design doc:** `docs/plans/2026-06-03-bookmarks-act-panel-design.md`

---

### Task 1: Add translation keys

**Files:**
- Modify: `packages/stories/src/translations/en.json:144-165`
- Modify: `packages/stories/src/translations/zh.json:144-165`

**Step 1: Add new keys to `en.json`**

Add these keys inside the `"bookmarks"` object (after line 164, before the closing `}`):

```json
"localBookmarks": "Local Bookmarks",
"cloudBookmarks": "Cloud Bookmarks",
"noLocalBookmarks": "No local bookmarks.",
"syncToCloud": "Sync to Cloud",
"syncAllToCloud": "Sync All to Cloud",
"syncSuccess": "Bookmark synced to cloud!",
"syncFailed": "Failed to sync bookmark to cloud.",
"syncAllSuccess": "All bookmarks synced to cloud!",
"syncAllPartial": "{count} of {total} bookmarks synced.",
"syncAllFailed": "Failed to sync bookmarks.",
"deleteLocal": "Delete",
"deleteLocalConfirm": "Delete this local bookmark?",
"loginToSync": "Log in to sync bookmarks to the cloud"
```

Add these keys inside the `"reader"` object (after line 181, before the closing `}`):

```json
"actPanel": "Acts",
"actLabel": "Act {n}",
"actFinal": "Final",
"actEpilogue": "Epilogue"
```

**Step 2: Add matching keys to `zh.json`**

Same locations, Chinese translations:

Inside `"bookmarks"`:
```json
"localBookmarks": "本機書籤",
"cloudBookmarks": "雲端書籤",
"noLocalBookmarks": "沒有本機書籤。",
"syncToCloud": "同步到雲端",
"syncAllToCloud": "全部同步到雲端",
"syncSuccess": "書籤已同步到雲端！",
"syncFailed": "同步書籤到雲端失敗。",
"syncAllSuccess": "所有書籤已同步到雲端！",
"syncAllPartial": "已同步 {count} / {total} 個書籤。",
"syncAllFailed": "同步書籤失敗。",
"deleteLocal": "刪除",
"deleteLocalConfirm": "確定要刪除此本機書籤嗎？",
"loginToSync": "登入以將書籤同步到雲端"
```

Inside `"reader"`:
```json
"actPanel": "章節",
"actLabel": "第 {n} 章",
"actFinal": "最終章",
"actEpilogue": "尾聲"
```

**Step 3: Verify translations compile**

Run: `bun build`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/stories/src/translations/en.json packages/stories/src/translations/zh.json
git commit -m "feat: add translation keys for local bookmarks and act panel"
```

---

### Task 2: Create LocalBookmarksStore utility

**Files:**
- Create: `apps/web/src/lib/local-bookmarks-store.ts`

**Step 1: Write the utility**

```ts
import { nanoid } from 'nanoid';
import type { Locale } from '@aquila/stories';

export interface LocalBookmark {
    id: string;
    storyId: string;
    sceneId: string;
    bookmarkName: string;
    locale: string;
    createdAt: number;
    updatedAt: number;
}

export class LocalBookmarksStore {
    private static readonly KEY_PREFIX = 'aquila:bookmarks';

    private readonly storageKey: string;

    constructor(private readonly locale: Locale) {
        this.storageKey = `${LocalBookmarksStore.KEY_PREFIX}:${locale}`;
    }

    getAll(): LocalBookmark[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    create(data: {
        storyId: string;
        sceneId: string;
        bookmarkName: string;
    }): LocalBookmark {
        const now = Date.now();
        const bookmark: LocalBookmark = {
            id: nanoid(),
            storyId: data.storyId,
            sceneId: data.sceneId,
            bookmarkName: data.bookmarkName,
            locale: this.locale,
            createdAt: now,
            updatedAt: now,
        };
        const bookmarks = this.getAll();
        bookmarks.unshift(bookmark);
        this.persist(bookmarks);
        return bookmark;
    }

    remove(id: string): void {
        const bookmarks = this.getAll().filter(b => b.id !== id);
        this.persist(bookmarks);
    }

    clear(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(this.storageKey);
        } catch {
            // ignore
        }
    }

    private persist(bookmarks: LocalBookmark[]): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(bookmarks));
        } catch (e) {
            console.error('Failed to persist local bookmarks:', e);
        }
    }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/local-bookmarks-store.ts
git commit -m "feat: add LocalBookmarksStore utility for localStorage bookmarks"
```

---

### Task 3: Update ReaderManager to support local bookmarks

**Files:**
- Modify: `apps/web/src/lib/reader-manager.ts:1-11` (imports)
- Modify: `apps/web/src/lib/reader-manager.ts:245-290` (`handleBookmark`)

**Step 1: Add import and instantiate LocalBookmarksStore**

At `reader-manager.ts` line 1, add to imports:

```ts
import { LocalBookmarksStore } from './local-bookmarks-store';
```

Add a field to the `ReaderManager` class (after `private initialDialogueIndex` on line 22):

```ts
private readonly localBookmarks: LocalBookmarksStore;
```

In the constructor (after line 38 `this.purgeLegacyState();`), add:

```ts
this.localBookmarks = new LocalBookmarksStore(locale);
```

**Step 2: Modify `handleBookmark` to fall back to local storage on 401**

Replace the `handleBookmark` method (lines 245-290) with:

```ts
handleBookmark = async (dialogueNumber?: number): Promise<void> => {
    const translations = this.t;

    const bookmarkName = await showPrompt(
        translations.reader.bookmarkPrompt,
        translations.reader.defaultBookmarkName +
            ' ' +
            this.currentState.sceneId
    );
    if (!bookmarkName) return;

    const storedBookmarkName =
        dialogueNumber && dialogueNumber > 0
            ? `[dlg:${dialogueNumber}] ${bookmarkName}`
            : bookmarkName;

    try {
        const response = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                storyId: this.currentState.storyId,
                sceneId: this.currentState.sceneId,
                bookmarkName: storedBookmarkName,
                locale: this.currentState.locale,
            }),
        });

        if (response.ok) {
            await showAlert(translations.reader.bookmarkSaved);
            return;
        }

        if (response.status === 401) {
            this.localBookmarks.create({
                storyId: this.currentState.storyId,
                sceneId: this.currentState.sceneId,
                bookmarkName: storedBookmarkName,
            });
            await showAlert(translations.reader.bookmarkSaved);
            return;
        }

        const error = await response.json();
        await showAlert(
            translations.reader.bookmarkFailed +
                ' ' +
                (error.error || 'Unknown error')
        );
    } catch (error) {
        console.error('Failed to save bookmark:', error);
        await showAlert(translations.reader.bookmarkError);
    }
};
```

**Step 3: Verify it compiles**

Run: `bun build`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/reader-manager.ts
git commit -m "feat: fallback to localStorage bookmarks when not authenticated"
```

---

### Task 4: Update BookmarksManager to show local + cloud + sync

**Files:**
- Modify: `apps/web/src/lib/bookmarks-manager.ts`

**Step 1: Add import and local bookmarks field**

Add at the top of `bookmarks-manager.ts`:

```ts
import {
    LocalBookmarksStore,
    type LocalBookmark,
} from './local-bookmarks-store';
```

Add fields to the class (after `private readonly locale: Locale;`):

```ts
private cloudBookmarks: Bookmark[] = [];
private localBookmarksList: LocalBookmark[] = [];
private isLoggedIn = false;
private readonly localStore: LocalBookmarksStore;
```

In the constructor, add after `this.t = getTranslations(locale);`:

```ts
this.localStore = new LocalBookmarksStore(locale);
```

**Step 2: Replace `loadBookmarks` method**

Replace the entire `loadBookmarks` method (lines 36-55) with:

```ts
async loadBookmarks(): Promise<void> {
    this.localBookmarksList = this.localStore.getAll();

    try {
        const response = await fetch('/api/bookmarks');

        if (response.status === 401) {
            this.isLoggedIn = false;
            this.renderAll();
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch bookmarks');
        }

        this.isLoggedIn = true;
        const data = await response.json();
        this.cloudBookmarks = Array.isArray(data) ? data : data.data || [];
        this.renderAll();
    } catch (error) {
        console.error('Failed to load bookmarks:', error);
        this.isLoggedIn = false;
        this.renderAll();
    }
}
```

**Step 3: Replace `renderBookmarks` and `renderNotLoggedIn` with `renderAll`**

Remove `renderNotLoggedIn` (lines 78-97). Replace `renderBookmarks` (lines 121-239) with:

```ts
private renderAll(): void {
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    container.textContent = '';

    if (this.isLoggedIn) {
        this.renderSection(
            container,
            this.t.bookmarks.cloudBookmarks,
            this.cloudBookmarks,
            false
        );
    }

    this.renderLocalSection(container);

    if (
        !this.isLoggedIn &&
        this.localBookmarksList.length === 0
    ) {
        const card = this.createCard();
        const message = document.createElement('p');
        message.className = 'text-lg text-slate-700 mb-6';
        message.textContent = this.t.bookmarks.notLoggedIn;
        const loginBtn = this.createButton(
            this.t.bookmarks.loginButton,
            `/${this.locale}/login`
        );
        card.appendChild(message);
        card.appendChild(loginBtn);
        container.appendChild(card);
    }
}

private renderSection(
    container: HTMLElement,
    title: string,
    bookmarks: Bookmark[],
    isLocal: boolean
): void {
    const section = document.createElement('div');
    section.className = 'mb-8';

    const heading = document.createElement('h2');
    heading.className = 'text-2xl font-bold text-slate-800 mb-4';
    heading.textContent = title;
    section.appendChild(heading);

    if (bookmarks.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-slate-500';
        empty.textContent = this.t.bookmarks.noBookmarks;
        section.appendChild(empty);
    } else {
        bookmarks.forEach(bookmark => {
            section.appendChild(
                this.createBookmarkCard(bookmark, isLocal)
            );
        });
    }

    container.appendChild(section);
}

private renderLocalSection(container: HTMLElement): void {
    if (this.localBookmarksList.length === 0 && !this.isLoggedIn) return;

    const section = document.createElement('div');
    section.className = 'mb-8';

    const heading = document.createElement('h2');
    heading.className = 'text-2xl font-bold text-slate-800 mb-4';
    heading.textContent = this.t.bookmarks.localBookmarks;
    section.appendChild(heading);

    if (this.localBookmarksList.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-slate-500';
        empty.textContent = this.t.bookmarks.noLocalBookmarks;
        section.appendChild(empty);
    } else {
        if (this.isLoggedIn) {
            const bulkBtn = document.createElement('button');
            bulkBtn.className =
                'mb-4 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300';
            bulkBtn.textContent = this.t.bookmarks.syncAllToCloud;
            bulkBtn.onclick = () => this.syncAllToCloud();
            section.appendChild(bulkBtn);
        }

        this.localBookmarksList.forEach(bookmark => {
            section.appendChild(this.createLocalBookmarkCard(bookmark));
        });
    }

    if (!this.isLoggedIn && this.localBookmarksList.length > 0) {
        const hint = document.createElement('p');
        hint.className = 'text-sm text-slate-500 mt-4';
        hint.textContent = this.t.bookmarks.loginToSync;
        section.appendChild(hint);
    }

    container.appendChild(section);
}
```

**Step 4: Add `createBookmarkCard`, `createLocalBookmarkCard`, sync methods**

Add these methods to the class:

```ts
private createBookmarkCard(
    bookmark: Bookmark,
    _isLocal: boolean
): HTMLDivElement {
    const card = document.createElement('div');
    card.className =
        'bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300 mb-4';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start justify-between';

    const content = document.createElement('div');
    content.className = 'flex-1';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-slate-800 mb-2';

    let dialogueNumber: number | null = null;
    let displayName = bookmark.bookmarkName;
    const dlgMatch = bookmark.bookmarkName.match(/^\[dlg:(\d+)\]\s*(.*)$/);
    if (dlgMatch) {
        const parsed = parseInt(dlgMatch[1], 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            dialogueNumber = parsed;
        }
        displayName = dlgMatch[2] || bookmark.bookmarkName;
    }
    title.textContent = displayName;

    const details = document.createElement('div');
    details.className = 'space-y-1 text-sm text-slate-600';

    const date = new Date(bookmark.updatedAt).toLocaleDateString(
        this.locale === 'zh' ? 'zh-CN' : 'en-US',
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
    );

    const languageText =
        bookmark.locale === 'zh'
            ? this.t.bookmarks.chinese
            : this.t.bookmarks.english;

    const infos = [
        { label: this.t.bookmarks.story, value: bookmark.storyId },
        { label: this.t.bookmarks.scene, value: bookmark.sceneId },
        { label: this.t.bookmarks.language, value: languageText },
        { label: this.t.bookmarks.savedAt, value: date },
    ];

    infos.forEach(info => {
        const p = document.createElement('p');
        const label = document.createElement('span');
        label.className = 'font-semibold';
        label.textContent = info.label;
        p.appendChild(label);
        p.appendChild(document.createTextNode(' ' + info.value));
        details.appendChild(p);
    });

    const actions = document.createElement('div');
    actions.className = 'flex flex-col gap-2 ml-4';

    const continueLink = document.createElement('a');
    let href = `/${bookmark.locale}/reader?story=${encodeURIComponent(bookmark.storyId)}&scene=${encodeURIComponent(bookmark.sceneId)}`;
    if (dialogueNumber && dialogueNumber > 0) {
        href += `&dialogue=${encodeURIComponent(dialogueNumber.toString())}`;
    }
    continueLink.href = href;
    continueLink.className =
        'px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-center text-sm';
    continueLink.textContent = this.t.bookmarks.continueReading;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = this.t.bookmarks.delete;
    deleteBtn.className =
        'px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm';
    deleteBtn.onclick = () => this.deleteBookmark(bookmark.id);

    actions.appendChild(continueLink);
    actions.appendChild(deleteBtn);

    content.appendChild(title);
    content.appendChild(details);
    wrapper.appendChild(content);
    wrapper.appendChild(actions);
    card.appendChild(wrapper);
    return card;
}

private createLocalBookmarkCard(bookmark: LocalBookmark): HTMLDivElement {
    const card = document.createElement('div');
    card.className =
        'bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-amber-200/50 hover:shadow-2xl transition-all duration-300 mb-4';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start justify-between';

    const content = document.createElement('div');
    content.className = 'flex-1';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-slate-800 mb-2';

    let dialogueNumber: number | null = null;
    let displayName = bookmark.bookmarkName;
    const dlgMatch = bookmark.bookmarkName.match(/^\[dlg:(\d+)\]\s*(.*)$/);
    if (dlgMatch) {
        const parsed = parseInt(dlgMatch[1], 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            dialogueNumber = parsed;
        }
        displayName = dlgMatch[2] || bookmark.bookmarkName;
    }
    title.textContent = displayName;

    const details = document.createElement('div');
    details.className = 'space-y-1 text-sm text-slate-600';

    const date = new Date(bookmark.updatedAt).toLocaleDateString(
        this.locale === 'zh' ? 'zh-CN' : 'en-US',
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
    );

    const infos = [
        { label: this.t.bookmarks.story, value: bookmark.storyId },
        { label: this.t.bookmarks.scene, value: bookmark.sceneId },
        { label: this.t.bookmarks.savedAt, value: date },
    ];

    infos.forEach(info => {
        const p = document.createElement('p');
        const label = document.createElement('span');
        label.className = 'font-semibold';
        label.textContent = info.label;
        p.appendChild(label);
        p.appendChild(document.createTextNode(' ' + info.value));
        details.appendChild(p);
    });

    const actions = document.createElement('div');
    actions.className = 'flex flex-col gap-2 ml-4';

    const continueLink = document.createElement('a');
    let href = `/${bookmark.locale}/reader?story=${encodeURIComponent(bookmark.storyId)}&scene=${encodeURIComponent(bookmark.sceneId)}`;
    if (dialogueNumber && dialogueNumber > 0) {
        href += `&dialogue=${encodeURIComponent(dialogueNumber.toString())}`;
    }
    continueLink.href = href;
    continueLink.className =
        'px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-center text-sm';
    continueLink.textContent = this.t.bookmarks.continueReading;

    if (this.isLoggedIn) {
        const syncBtn = document.createElement('button');
        syncBtn.className =
            'px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm';
        syncBtn.textContent = this.t.bookmarks.syncToCloud;
        syncBtn.onclick = () => this.syncSingleToCloud(bookmark.id);
        actions.appendChild(syncBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = this.t.bookmarks.deleteLocal;
    deleteBtn.className =
        'px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm';
    deleteBtn.onclick = () => this.deleteLocalBookmark(bookmark.id);

    actions.appendChild(continueLink);
    actions.appendChild(deleteBtn);

    content.appendChild(title);
    content.appendChild(details);
    wrapper.appendChild(content);
    wrapper.appendChild(actions);
    card.appendChild(wrapper);
    return card;
}
```

**Step 5: Add sync and delete methods**

```ts
private async syncSingleToCloud(id: string): Promise<void> {
    const bookmark = this.localBookmarksList.find(b => b.id === id);
    if (!bookmark) return;

    try {
        const response = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storyId: bookmark.storyId,
                sceneId: bookmark.sceneId,
                bookmarkName: bookmark.bookmarkName,
                locale: bookmark.locale,
            }),
        });

        if (response.ok) {
            this.localStore.remove(id);
            this.localBookmarksList = this.localBookmarksList.filter(
                b => b.id !== id
            );
            const data = await response.json().catch(() => null);
            if (data) {
                this.cloudBookmarks.unshift(data);
            }
            this.renderAll();
        } else {
            await showAlert(this.t.bookmarks.syncFailed);
        }
    } catch {
        await showAlert(this.t.bookmarks.syncFailed);
    }
}

private async syncAllToCloud(): Promise<void> {
    let synced = 0;
    const total = this.localBookmarksList.length;
    const failedIds: string[] = [];

    for (const bookmark of this.localBookmarksList) {
        try {
            const response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: bookmark.storyId,
                    sceneId: bookmark.sceneId,
                    bookmarkName: bookmark.bookmarkName,
                    locale: bookmark.locale,
                }),
            });

            if (response.ok) {
                this.localStore.remove(bookmark.id);
                const data = await response.json().catch(() => null);
                if (data) {
                    this.cloudBookmarks.unshift(data);
                }
                synced++;
            } else {
                failedIds.push(bookmark.id);
            }
        } catch {
            failedIds.push(bookmark.id);
        }
    }

    this.localBookmarksList = this.localBookmarksList.filter(
        b => failedIds.includes(b.id)
    );
    this.renderAll();

    if (synced === total) {
        await showAlert(this.t.bookmarks.syncAllSuccess);
    } else if (synced > 0) {
        await showAlert(
            this.t.bookmarks.syncAllPartial
                .replace('{count}', synced.toString())
                .replace('{total}', total.toString())
        );
    } else {
        await showAlert(this.t.bookmarks.syncAllFailed);
    }
}

private async deleteLocalBookmark(id: string): Promise<void> {
    const confirmed = await showConfirm(this.t.bookmarks.deleteLocalConfirm);
    if (!confirmed) return;

    this.localStore.remove(id);
    this.localBookmarksList = this.localBookmarksList.filter(
        b => b.id !== id
    );
    this.renderAll();
}
```

**Step 6: Update `deleteBookmark` method**

The existing `deleteBookmark` method (lines 242-261) stays the same but update it to call `this.renderAll()` instead of `this.renderBookmarks()`:

Replace `this.renderBookmarks()` on line 253 with `this.renderAll()`.

**Step 7: Verify it compiles**

Run: `bun build`
Expected: No type errors

**Step 8: Commit**

```bash
git add apps/web/src/lib/bookmarks-manager.ts
git commit -m "feat: show local and cloud bookmarks with sync-to-cloud support"
```

---

### Task 5: Create ActPanel Svelte component

**Files:**
- Create: `apps/web/src/components/ActPanel.svelte`

**Step 1: Write the component**

```svelte
<script lang="ts">
  import { getStoryFlow, getTranslations, type Locale } from '@aquila/stories';

  export let storyId: string;
  export let currentSceneId: string;
  export let onNavigate: (sceneId: string) => void;
  export let locale: Locale = 'en';

  $: t = getTranslations(locale);
  $: acts = computeActs(storyId);
  $: currentAct = extractActName(currentSceneId);

  interface ActInfo {
    label: string;
    sceneId: string;
    sortKey: number;
    rawName: string;
  }

  function extractActName(sceneId: string): string {
    const match = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
  }

  function actLabel(rawName: string): string {
    if (rawName === 'actFinal') return t.reader.actFinal;
    if (rawName === 'actEpilogue') return t.reader.actEpilogue;
    const numMatch = rawName.match(/act(\d+)/);
    if (numMatch) {
      return t.reader.actLabel.replace('{n}', numMatch[1]);
    }
    return rawName;
  }

  function actSortKey(rawName: string): number {
    if (rawName === 'actFinal') return 9998;
    if (rawName === 'actEpilogue') return 9999;
    const numMatch = rawName.match(/act(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
  }

  function computeActs(sid: string): ActInfo[] {
    const flow = getStoryFlow(sid);
    if (!flow) return [];

    const actMap = new Map<string, string>();

    for (const node of flow.nodes) {
      if (node.kind !== 'scene') continue;
      const match = node.sceneId.match(
        /(?:^|_)(act\d+|actFinal|actEpilogue)/
      );
      if (!match) continue;
      const actName = match[1];
      if (!actMap.has(actName)) {
        actMap.set(actName, node.sceneId);
      }
    }

    return Array.from(actMap.entries())
      .map(([rawName, sceneId]) => ({
        label: actLabel(rawName),
        sceneId,
        sortKey: actSortKey(rawName),
        rawName,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
  }
</script>

<div class="fixed inset-0 z-50 flex justify-end" on:click|self={() => onNavigate(currentSceneId)}>
  <div
    class="w-80 max-w-[85vw] h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-white/50 overflow-y-auto"
    on:click|stopPropagation
  >
    <div class="p-6">
      <h2 class="text-xl font-bold text-slate-800 mb-6">
        {t.reader.actPanel}
      </h2>

      <div class="space-y-2">
        {#each acts as act (act.rawName)}
          <button
            on:click={() => handleSelect(act.sceneId)}
            class="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 {act.rawName === currentAct
              ? 'bg-blue-500 text-white font-semibold shadow-md'
              : 'bg-white/60 hover:bg-blue-50 text-slate-700 hover:text-blue-600'}"
          >
            {act.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/components/ActPanel.svelte
git commit -m "feat: add ActPanel Svelte component for act navigation"
```

---

### Task 6: Integrate ActPanel into NovelReader and ReaderManager

**Files:**
- Modify: `apps/web/src/components/NovelReader.svelte:1-19` (props)
- Modify: `apps/web/src/components/NovelReader.svelte:237-252` (back button area)
- Modify: `apps/web/src/components/NovelReader.svelte:350-372` (action buttons area)
- Modify: `apps/web/src/lib/reader-manager.ts:305-355` (`renderReader`)

**Step 1: Add props to NovelReader.svelte**

After `export let initialDialogueIndex: number | null = null;` (line 19), add:

```ts
export let storyId: string = '';
export let currentSceneId: string = '';
export let onNavigate: (sceneId: string) => void = () => {};
```

Add a reactive variable after the existing reactive declarations:

```ts
let showActPanel = false;
```

**Step 2: Add act panel toggle button in the reader header**

After the back button `<a>` element (around line 252), add the toggle button inside the same fixed div:

```svelte
<div class="fixed top-6 left-6 z-10 flex gap-3">
  <a
    href={backUrl}
    class="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
  >
    {t.common.backToHome}
  </a>
  <button
    on:click={() => (showActPanel = !showActPanel)}
    class="px-4 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
  >
    {t.reader.actPanel}
  </button>
</div>
```

Remove the original fixed div (lines 245-252) that only had the back button.

**Step 3: Add ActPanel at the bottom of the template**

Before the closing `</div>` of the root element (before the `<style>` block), add:

```svelte
{#if showActPanel}
  <svelte:component
    this={ActPanelComponent}
    {storyId}
    {currentSceneId}
    onNavigate={(sceneId: string) => {
      showActPanel = false;
      onNavigate(sceneId);
    }}
    {locale}
  />
{/if}
```

Add the import at the top of the `<script>` block (but use dynamic import to avoid SSR issues). Add a variable:

```ts
let ActPanelComponent: any = null;
import('@/components/ActPanel.svelte').then(m => {
  ActPanelComponent = m.default;
});
```

**Step 4: Update ReaderManager.renderReader() to pass new props**

In `reader-manager.ts`, in the `renderReader()` method, add props to the `mount()` call (after `initialDialogueIndex`):

```ts
storyId: this.currentState.storyId,
currentSceneId: this.currentState.sceneId,
onNavigate: (sceneId: string) => this.navigateToScene(sceneId),
```

**Step 5: Verify it compiles**

Run: `bun build`
Expected: No type errors

**Step 6: Commit**

```bash
git add apps/web/src/components/NovelReader.svelte apps/web/src/lib/reader-manager.ts
git commit -m "feat: integrate act side panel into reader"
```

---

### Task 7: Run lint and typecheck

**Step 1: Run lint**

Run: `bun lint`
Expected: No errors. Fix any issues.

**Step 2: Run build**

Run: `bun build`
Expected: Clean build with no errors.

**Step 3: Run unit tests**

Run: `bun --filter web test`
Expected: All existing tests pass.

**Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "chore: lint fixes for bookmarks and act panel"
```
