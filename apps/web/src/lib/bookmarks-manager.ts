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

export class BookmarksManager {
    private cloudBookmarks: Bookmark[] = [];
    private localBookmarksList: LocalBookmark[] = [];
    private isLoggedIn = false;
    private readonly t: ReturnType<typeof getTranslations>;
    private readonly locale: Locale;
    private readonly localStore: LocalBookmarksStore;

    constructor(locale: Locale) {
        this.locale = locale;
        this.t = getTranslations(locale);
        this.localStore = new LocalBookmarksStore(locale);
    }

    initializeUI(): void {
        const titleEl = document.getElementById('page-title');
        const descEl = document.getElementById('page-description');
        const backBtn = document.getElementById('back-button');
        const loadingEl = document.getElementById('loading-text');

        if (titleEl) titleEl.textContent = this.t.bookmarks.title;
        if (descEl) descEl.textContent = this.t.bookmarks.description;
        if (backBtn) backBtn.textContent = this.t.bookmarks.backToHome;
        if (loadingEl) loadingEl.textContent = this.t.bookmarks.loading;
    }

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
            this.renderError();
        }
    }

    private createCard(): HTMLDivElement {
        const card = document.createElement('div');
        card.className =
            'bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/50 text-center';
        return card;
    }

    private createButton(
        text: string,
        href: string,
        isPrimary = true
    ): HTMLAnchorElement {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        link.className = isPrimary
            ? 'inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300'
            : 'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all duration-300';
        return link;
    }

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

        if (!this.isLoggedIn && this.localBookmarksList.length === 0) {
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
            empty.className = 'text-slate-500 mb-4';
            empty.textContent = this.t.bookmarks.noBookmarks;
            section.appendChild(empty);

            const startBtn = this.createButton(
                this.t.bookmarks.startReading,
                `/${this.locale}/reader`
            );
            section.appendChild(startBtn);
        } else {
            bookmarks.forEach(bookmark => {
                section.appendChild(this.createBookmarkCard(bookmark, isLocal));
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

    private renderError(): void {
        const container = document.getElementById('bookmarks-container');
        if (!container) return;

        container.textContent = '';
        const card = this.createCard();

        const message = document.createElement('p');
        message.className = 'text-lg text-red-600 mb-4';
        message.textContent = this.t.bookmarks.error;

        const retryBtn = document.createElement('button');
        retryBtn.textContent = this.t.bookmarks.retry;
        retryBtn.className =
            'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all duration-300';
        retryBtn.onclick = () => location.reload();

        card.appendChild(message);
        card.appendChild(retryBtn);
        container.appendChild(card);
    }

    private createBookmarkCard(
        bookmark: Bookmark,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
