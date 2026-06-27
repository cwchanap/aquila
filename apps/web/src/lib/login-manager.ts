import { signIn } from './auth-client';

interface LoginTranslations {
    signInError: string;
}

function getLoginTranslations(): LoginTranslations {
    try {
        const el = document.getElementById('login-translations');
        if (el?.textContent) return JSON.parse(el.textContent);
    } catch {
        /* fallback below */
    }
    // Degenerate-case fallback: the embedded localized JSON (rendered
    // server-side via t('login.signInError')) is missing or corrupt, so the
    // locale-based translation mechanism has already failed. No client-side
    // locale data is available at this point — a generic English message is
    // the last-resort fallback. This path should never trigger in normal
    // operation.
    return { signInError: 'Sign-in failed. Please try again.' };
}

export function initLogin(): void {
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById(
            'google-signin-btn'
        ) as HTMLButtonElement | null;
        const errorMessage = document.getElementById('error-message');
        const translations = getLoginTranslations();
        const locale =
            document
                .querySelector('[data-locale]')
                ?.getAttribute('data-locale') || 'en';

        function showError(message: string) {
            if (errorMessage) {
                errorMessage.textContent = message;
                errorMessage.classList.remove('hidden');
            }
        }
        function hideError() {
            if (errorMessage) errorMessage.classList.add('hidden');
        }

        btn?.addEventListener('click', async () => {
            hideError();
            btn.disabled = true;
            try {
                const { error } = await signIn.social({
                    provider: 'google',
                    callbackURL: `/${locale}/`,
                });
                if (error) {
                    showError(error.message || translations.signInError);
                    btn.disabled = false;
                } else {
                    // Success: the browser is redirecting to Google. Re-enable as a
                    // safety net so a stalled or blocked redirect doesn't strand the
                    // button in a permanently disabled state.
                    btn.disabled = false;
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error(
                        'Google sign-in failed:',
                        e instanceof Error ? e.message : 'unknown'
                    );
                }
                showError(translations.signInError);
                btn.disabled = false;
            }
        });
    });
}
