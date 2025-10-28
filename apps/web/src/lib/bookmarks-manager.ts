import { getTranslations, type Locale } from '@aquila/dialogue';

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
    private bookmarks: Bookmark[] = [];
    private readonly t: ReturnType<typeof getTranslations>;
    private readonly locale: Locale;

    constructor(locale: Locale) {
        this.locale = locale;
        this.t = getTranslations(locale);
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
        try {
            const response = await fetch('/api/bookmarks');

            if (!response.ok) {
                if (response.status === 401) {
                    this.renderNotLoggedIn();
                    return;
                }
                throw new Error('Failed to fetch bookmarks');
            }

            const data = await response.json();
            this.bookmarks = data.bookmarks || [];
            this.renderBookmarks();
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
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

    private renderNotLoggedIn(): void {
        const container = document.getElementById('bookmarks-container');
        if (!container) return;

        container.textContent = '';
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

    private renderBookmarks(): void {
        const container = document.getElementById('bookmarks-container');
        if (!container) return;

        container.textContent = '';

        if (this.bookmarks.length === 0) {
            const card = this.createCard();

            const message = document.createElement('p');
            message.className = 'text-lg text-slate-700 mb-6';
            message.textContent = this.t.bookmarks.noBookmarks;

            const startBtn = this.createButton(
                this.t.bookmarks.startReading,
                `/${this.locale}/reader`
            );

            card.appendChild(message);
            card.appendChild(startBtn);
            container.appendChild(card);
            return;
        }

        this.bookmarks.forEach(bookmark => {
            const card = document.createElement('div');
            card.className =
                'bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300';

            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-start justify-between';

            const content = document.createElement('div');
            content.className = 'flex-1';

            const title = document.createElement('h3');
            title.className = 'text-xl font-bold text-slate-800 mb-2';
            title.textContent = bookmark.bookmarkName;

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
            continueLink.href = `/${bookmark.locale}/reader?story=${encodeURIComponent(bookmark.storyId)}&scene=${encodeURIComponent(bookmark.sceneId)}`;
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
            container.appendChild(card);
        });
    }

    private async deleteBookmark(id: string): Promise<void> {
        if (!confirm(this.t.bookmarks.deleteConfirm)) {
            return;
        }

        try {
            const response = await fetch(`/api/bookmarks/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                this.bookmarks = this.bookmarks.filter(b => b.id !== id);
                this.renderBookmarks();
            } else {
                alert(this.t.bookmarks.deleteFailed);
            }
        } catch (error) {
            console.error('Failed to delete bookmark:', error);
            alert(this.t.bookmarks.deleteFailed);
        }
    }
}
