import { signIn } from './auth-client';
import { logger } from './logger.js';
import { ERROR_IDS } from '../constants/errorIds.js';

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
    function setupLogin(): void {
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
                    // better-auth returned a structured error (e.g. provider
                    // misconfigured, OAuth rejected). Surface it to the user
                    // and log with an errorId so production sign-in failures
                    // are visible in log aggregators (previously DEV-only).
                    logger.error(
                        'Google sign-in returned an error',
                        undefined,
                        {
                            errorId: ERROR_IDS.AUTH_SIGNIN_FAILED,
                            error: error.message,
                        }
                    );
                    showError(error.message || translations.signInError);
                    btn.disabled = false;
                } else {
                    // Success: the browser is redirecting to Google. Re-enable as a
                    // safety net so a stalled or blocked redirect doesn't strand the
                    // button in a permanently disabled state.
                    btn.disabled = false;
                }
            } catch (e) {
                // Log in all environments (not just DEV) so production
                // sign-in failures are visible. Wrap non-Error throws so the
                // original message is preserved in the log entry.
                logger.error(
                    'Google sign-in failed',
                    e instanceof Error
                        ? e
                        : new Error(typeof e === 'string' ? e : 'unknown'),
                    { errorId: ERROR_IDS.AUTH_SIGNIN_FAILED }
                );
                showError(translations.signInError);
                btn.disabled = false;
            }
        });
    }

    // If the document is already interactive/complete (e.g. the script loaded
    // after DOMContentLoaded fired via defer or late injection), wire up
    // immediately — otherwise the listener below never fires and the sign-in
    // button stays dead.
    if (
        document.readyState === 'interactive' ||
        document.readyState === 'complete'
    ) {
        setupLogin();
    } else {
        document.addEventListener('DOMContentLoaded', setupLogin);
    }
}
