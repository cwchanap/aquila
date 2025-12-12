import { authorizedFetch } from './auth';

type MaybeElement<T extends HTMLElement> = T | null;

function safeText(value: unknown): string {
    if (typeof value !== 'string') return 'N/A';
    const trimmed = value.trim();
    return trimmed ? trimmed : 'N/A';
}

function getLang(): string {
    const lang = document.documentElement.lang;
    return typeof lang === 'string' && lang.trim() ? lang.trim() : 'en';
}

function setText(el: MaybeElement<HTMLElement>, value: string) {
    if (el) el.textContent = value;
}

function showError(el: MaybeElement<HTMLElement>, value: string) {
    if (!el) return;
    el.textContent = value;
    el.classList.remove('hidden');
}

function hideError(el: MaybeElement<HTMLElement>) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}

export async function initProfileClient(): Promise<void> {
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const errorEl = document.getElementById('profile-error');

    const setProfileFallback = () => {
        setText(nameEl, 'N/A');
        setText(emailEl, 'N/A');
    };

    try {
        const response = await authorizedFetch('/api/me');

        if (response.status === 401) {
            window.location.href = `/${getLang()}/login`;
            return;
        }

        if (!response.ok) {
            console.error('Failed to load /api/me:', {
                status: response.status,
                statusText: response.statusText,
            });
            setProfileFallback();
            showError(errorEl, 'Unable to load your profile.');
            return;
        }

        const data: unknown = await response.json();
        const user =
            data && typeof data === 'object' && 'user' in data
                ? (data as { user?: unknown }).user
                : null;

        const userObj =
            user && typeof user === 'object'
                ? (user as Record<string, unknown>)
                : null;

        setText(nameEl, safeText(userObj?.name));
        setText(emailEl, safeText(userObj?.email));
        hideError(errorEl);
    } catch (error) {
        console.error('Profile load failed:', error);

        if (error instanceof Error && error.message === 'Not authenticated') {
            window.location.href = `/${getLang()}/login`;
            return;
        }

        setProfileFallback();
        showError(errorEl, 'Unable to load your profile.');
    }
}
