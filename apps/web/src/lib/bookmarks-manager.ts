import { getTranslations, type Locale } from '@aquila/stories';
import { showAlert, showConfirm } from './ui-dialogs';
import {
    LocalBookmarksStore,
    type LocalBookmark,
} from './local-bookmarks-store';

export interface Bookmark {
    id: string;
    storyId: string;
    sceneId: string;
    bookmarkName: string;
    locale: string;
    createdAt: string;
    updatedAt: string;
}

interface BookmarkCardData {
    bookmarkName: string;
    storyId: string;
    sceneId: string;
    locale: string;
}

export class BookmarksManager {
    private cloudBookmarks: Bookmark[] = [];
    private localBookmarksList: LocalBookmark[] = [];
    private authState: 'unknown' | 'logged-out' | 'logged-in' = 'unknown';
    private readonly t: ReturnType<typeof getTranslations>;
    private readonly locale: Locale;
    private readonly localStore: LocalBookmarksStore;

    constructor(locale: Locale) {
        this.locale = locale;
        this.t = getTranslations(locale);
        this.localStore = new LocalBookmarksStore(locale);
    }

    initializeUI(): void {
        const loadingEl = document.getElementById('loading-text');

        if (loadingEl) loadingEl.textContent = this.t.bookmarks.loading;
    }

    async loadBookmarks(): Promise<void> {
        this.localBookmarksList = this.localStore.getAll();

        try {
            const response = await fetch('/api/bookmarks');

            if (response.status === 401) {
                this.authState = 'logged-out';
                this.renderAll();
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch bookmarks');
            }

            this.authState = 'logged-in';
            const data = await response.json();
            this.cloudBookmarks = Array.isArray(data) ? data : data.data || [];
            this.renderAll();
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
            this.renderAll();
            const container = document.getElementById('bookmarks-container');
            if (container) {
                this.renderCloudErrorBanner(container);
            }
        }
    }

    private createCard(): HTMLDivElement {
        const card = document.createElement('div');
        card.className =
            'bg-blue-950/40 backdrop-blur-xl rounded-2xl p-8 border border-white/15 text-center';
        return card;
    }

    private createButton(text: string, href: string): HTMLAnchorElement {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        link.className =
            'inline-block px-6 py-2.5 rounded-xl bg-linear-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300';
        return link;
    }

    private renderAll(): void {
        const container = document.getElementById('bookmarks-container');
        if (!container) return;

        container.textContent = '';

        if (this.authState === 'logged-in') {
            this.renderSection(
                container,
                this.t.bookmarks.cloudBookmarks,
                this.cloudBookmarks
            );
        }

        this.renderLocalSection(container);

        if (
            this.authState === 'logged-out' &&
            this.localBookmarksList.length === 0
        ) {
            const card = this.createCard();
            const message = document.createElement('p');
            message.className = 'text-white/70 mb-6';
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
        bookmarks: Bookmark[]
    ): void {
        const section = document.createElement('div');
        section.className = 'mb-8';

        const heading = document.createElement('h2');
        heading.className =
            'text-xl font-serif font-semibold text-white/90 mb-4 tracking-tight';
        heading.textContent = title;
        section.appendChild(heading);

        if (bookmarks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-white/65 mb-4';
            empty.textContent = this.t.bookmarks.noBookmarks;
            section.appendChild(empty);

            const startBtn = this.createButton(
                this.t.bookmarks.startReading,
                `/${this.locale}/reader`
            );
            section.appendChild(startBtn);
        } else {
            bookmarks.forEach(bookmark => {
                section.appendChild(this.createBookmarkCard(bookmark));
            });
        }

        container.appendChild(section);
    }

    private renderLocalSection(container: HTMLElement): void {
        if (
            this.localBookmarksList.length === 0 &&
            this.authState !== 'logged-in'
        )
            return;

        const section = document.createElement('div');
        section.className = 'mb-8';

        const heading = document.createElement('h2');
        heading.className =
            'text-xl font-serif font-semibold text-white/90 mb-4 tracking-tight';
        heading.textContent = this.t.bookmarks.localBookmarks;
        section.appendChild(heading);

        if (this.localBookmarksList.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-white/65';
            empty.textContent = this.t.bookmarks.noLocalBookmarks;
            section.appendChild(empty);
        } else {
            if (this.authState === 'logged-in') {
                const bulkBtn = document.createElement('button');
                bulkBtn.className =
                    'mb-4 px-6 py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-300/30 text-emerald-100 font-medium shadow-lg transition-all duration-300';
                bulkBtn.textContent = this.t.bookmarks.syncAllToCloud;
                bulkBtn.onclick = () => this.syncAllToCloud();
                section.appendChild(bulkBtn);
            }

            this.localBookmarksList.forEach(bookmark => {
                section.appendChild(this.createLocalBookmarkCard(bookmark));
            });
        }

        if (
            this.authState === 'logged-out' &&
            this.localBookmarksList.length > 0
        ) {
            const hint = document.createElement('p');
            hint.className = 'text-sm text-white/70 mt-4';
            hint.textContent = this.t.bookmarks.loginToSync;
            section.appendChild(hint);
        }

        container.appendChild(section);
    }

    private renderCloudErrorBanner(container: HTMLElement): void {
        const banner = document.createElement('div');
        banner.className =
            'mb-4 p-4 bg-rose-500/10 border border-rose-300/30 rounded-xl text-rose-100 text-sm';
        banner.textContent = this.t.bookmarks.error;
        container.prepend(banner);
    }

    private formatDate(value: string | number | Date): string {
        return new Date(value).toLocaleDateString(
            this.locale === 'zh' ? 'zh-CN' : 'en-US',
            {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }
        );
    }

    private buildBookmarkCard(
        bookmark: BookmarkCardData,
        options: {
            cardClassName: string;
            cardTestId: string;
            infos: { label: string; value: string }[];
            leadingActions: HTMLButtonElement[];
            deleteButton: HTMLButtonElement;
        }
    ): HTMLDivElement {
        const card = document.createElement('div');
        card.className = options.cardClassName;
        card.dataset.testid = options.cardTestId;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-start justify-between';

        const content = document.createElement('div');
        content.className = 'flex-1';

        const title = document.createElement('h3');
        title.className = 'text-lg font-serif font-semibold text-white mb-2';

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
        details.className = 'space-y-1 text-sm text-white/65';

        options.infos.forEach(info => {
            const p = document.createElement('p');
            const label = document.createElement('span');
            label.className = 'text-white/70 font-medium';
            label.textContent = info.label;
            p.appendChild(label);
            p.appendChild(document.createTextNode(' ' + info.value));
            details.appendChild(p);
        });

        const actions = document.createElement('div');
        actions.className = 'flex flex-col gap-2 ml-4';

        for (const btn of options.leadingActions) {
            actions.appendChild(btn);
        }

        const continueLink = document.createElement('a');
        let href = `/${bookmark.locale}/reader?story=${encodeURIComponent(bookmark.storyId)}&scene=${encodeURIComponent(bookmark.sceneId)}`;
        if (dialogueNumber && dialogueNumber > 0) {
            href += `&dialogue=${encodeURIComponent(dialogueNumber.toString())}`;
        }
        continueLink.href = href;
        continueLink.className =
            'px-4 py-2 rounded-lg bg-linear-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-medium text-center text-sm shadow-lg transition-all duration-300';
        continueLink.textContent = this.t.bookmarks.continueReading;
        actions.appendChild(continueLink);

        actions.appendChild(options.deleteButton);

        content.appendChild(title);
        content.appendChild(details);
        wrapper.appendChild(content);
        wrapper.appendChild(actions);
        card.appendChild(wrapper);
        return card;
    }

    private createBookmarkCard(bookmark: Bookmark): HTMLDivElement {
        const date = this.formatDate(bookmark.updatedAt);

        const languageText =
            bookmark.locale === 'zh'
                ? this.t.bookmarks.chinese
                : this.t.bookmarks.english;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = this.t.bookmarks.delete;
        deleteBtn.className =
            'px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-300/30 text-rose-100 font-medium text-sm transition-all duration-300';
        deleteBtn.dataset.testid = 'delete-cloud-bookmark';
        deleteBtn.onclick = () => this.deleteBookmark(bookmark.id);

        return this.buildBookmarkCard(bookmark, {
            cardClassName:
                'bg-linear-to-br from-blue-950/30 to-slate-900/20 backdrop-blur-xl rounded-2xl p-6 border border-white/15 hover:border-white/30 transition-all duration-300 mb-4',
            cardTestId: 'bookmark-card',
            infos: [
                { label: this.t.bookmarks.story, value: bookmark.storyId },
                { label: this.t.bookmarks.scene, value: bookmark.sceneId },
                { label: this.t.bookmarks.language, value: languageText },
                { label: this.t.bookmarks.savedAt, value: date },
            ],
            leadingActions: [],
            deleteButton: deleteBtn,
        });
    }

    private createLocalBookmarkCard(bookmark: LocalBookmark): HTMLDivElement {
        const date = this.formatDate(bookmark.updatedAt);

        const leadingActions: HTMLButtonElement[] = [];
        if (this.authState === 'logged-in') {
            const syncBtn = document.createElement('button');
            syncBtn.className =
                'px-4 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-300/30 text-emerald-100 font-medium text-sm transition-all duration-300';
            syncBtn.textContent = this.t.bookmarks.syncToCloud;
            syncBtn.onclick = () => this.syncSingleToCloud(bookmark.id);
            leadingActions.push(syncBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = this.t.bookmarks.deleteLocal;
        deleteBtn.className =
            'px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-300/30 text-rose-100 font-medium text-sm transition-all duration-300';
        deleteBtn.dataset.testid = 'delete-local-bookmark';
        deleteBtn.onclick = () => this.deleteLocalBookmark(bookmark.id);

        return this.buildBookmarkCard(bookmark, {
            cardClassName:
                'bg-linear-to-br from-blue-950/30 to-slate-900/20 backdrop-blur-xl rounded-2xl p-6 border border-amber-300/25 hover:border-amber-300/40 transition-all duration-300 mb-4',
            cardTestId: 'local-bookmark-card',
            infos: [
                { label: this.t.bookmarks.story, value: bookmark.storyId },
                { label: this.t.bookmarks.scene, value: bookmark.sceneId },
                { label: this.t.bookmarks.savedAt, value: date },
            ],
            leadingActions,
            deleteButton: deleteBtn,
        });
    }

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
                    this.cloudBookmarks = this.cloudBookmarks.filter(
                        b => b.id !== data.id
                    );
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
                        this.cloudBookmarks = this.cloudBookmarks.filter(
                            b => b.id !== data.id
                        );
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

        this.localBookmarksList = this.localBookmarksList.filter(b =>
            failedIds.includes(b.id)
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
        const confirmed = await showConfirm(
            this.t.bookmarks.deleteLocalConfirm
        );
        if (!confirmed) return;

        this.localStore.remove(id);
        this.localBookmarksList = this.localBookmarksList.filter(
            b => b.id !== id
        );
        this.renderAll();
    }

    private async deleteBookmark(id: string): Promise<void> {
        const confirmed = await showConfirm(this.t.bookmarks.deleteConfirm);
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/bookmarks/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                this.cloudBookmarks = this.cloudBookmarks.filter(
                    b => b.id !== id
                );
                this.renderAll();
            } else {
                await showAlert(this.t.bookmarks.deleteFailed);
            }
        } catch (error) {
            console.error('Failed to delete bookmark:', error);
            await showAlert(this.t.bookmarks.deleteFailed);
        }
    }
}
