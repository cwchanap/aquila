import { getSupabaseAuthClient } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';

type ResetPageStrings = {
    invalidOrMissingLink: string;
    startSessionFailed: string;
    sessionNotReady: string;
    passwordRequired: string;
    passwordTooShort: string;
    passwordMismatch: string;
    updatePasswordFailed: string;
    updatePasswordSuccess: string;
};

type ResetPasswordClientOptions = {
    resetStrings: ResetPageStrings;
};

function redactError(error: unknown): string {
    const isDevelopment =
        (typeof process !== 'undefined' && process.env?.NODE_ENV) ===
        'development';

    if (!error) {
        return 'Unknown error';
    }

    if (isDevelopment) {
        const sensitiveKeys = new Set([
            'access_token',
            'refresh_token',
            'token',
            'id_token',
            'user',
            'email',
            'phone',
            'headers',
            'body',
        ]);

        const replacer = (_key: string, value: unknown): unknown => {
            if (sensitiveKeys.has(_key)) {
                return '[REDACTED]';
            }
            return value;
        };

        try {
            return JSON.stringify(error, replacer, 2);
        } catch {
            return String(error);
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
    }

    return 'An error occurred';
}

export function initializeResetPasswordClient({
    resetStrings,
}: ResetPasswordClientOptions) {
    const initialize = async () => {
        const form = document.getElementById('reset-form');
        const errorEl = document.getElementById('reset-error');
        const successEl = document.getElementById('reset-success');

        if (!(form instanceof HTMLFormElement)) return;
        if (!(errorEl instanceof HTMLElement)) return;
        if (!(successEl instanceof HTMLElement)) return;

        const submitButton = form.querySelector('button[type="submit"]');
        if (!(submitButton instanceof HTMLButtonElement)) return;

        const resetForm: HTMLFormElement = form;
        const errorElement: HTMLElement = errorEl;
        const successElement: HTMLElement = successEl;
        const submitButtonElement: HTMLButtonElement = submitButton;

        const supabase = getSupabaseAuthClient();
        let sessionReady = false;
        let isSubmitting = false;

        submitButtonElement.disabled = true;

        function showError(message: string) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }

        function hideError() {
            errorElement.classList.add('hidden');
        }

        function showSuccess(message: string) {
            successElement.textContent = message;
            successElement.classList.remove('hidden');
        }

        function hideSuccess() {
            successElement.classList.add('hidden');
        }

        async function initializeSessionFromHash() {
            sessionReady = false;
            submitButtonElement.disabled = true;

            const hashParams = new URLSearchParams(
                window.location.hash.replace('#', '')
            );
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            if (!access_token || !refresh_token) {
                showError(resetStrings.invalidOrMissingLink);
                submitButtonElement.disabled = true;
                return;
            }

            try {
                history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search
                );
            } catch {
                void 0;
            }

            try {
                const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });

                if (error) {
                    console.error('Session init error:', redactError(error));
                    showError(resetStrings.startSessionFailed);
                    sessionReady = false;
                    submitButtonElement.disabled = true;
                    return;
                }

                sessionReady = true;
                submitButtonElement.disabled = false;
            } catch (err) {
                console.error('Session init error:', redactError(err));
                showError(resetStrings.startSessionFailed);
                sessionReady = false;
                submitButtonElement.disabled = true;
            }
        }

        await initializeSessionFromHash();

        const newPasswordInput = resetForm.querySelector('#new-password');
        const confirmPasswordInput =
            resetForm.querySelector('#confirm-password');
        const newPasswordInputElement =
            newPasswordInput instanceof HTMLInputElement
                ? newPasswordInput
                : null;
        const confirmPasswordInputElement =
            confirmPasswordInput instanceof HTMLInputElement
                ? confirmPasswordInput
                : null;

        resetForm.addEventListener('submit', async e => {
            e.preventDefault();

            if (isSubmitting) {
                return;
            }

            isSubmitting = true;
            submitButtonElement.disabled = true;
            submitButtonElement.setAttribute('aria-disabled', 'true');

            hideError();
            hideSuccess();
            try {
                if (!sessionReady) {
                    showError(resetStrings.sessionNotReady);
                    return;
                }

                const newPassword = newPasswordInputElement
                    ? newPasswordInputElement.value
                    : '';
                const confirmPassword = confirmPasswordInputElement
                    ? confirmPasswordInputElement.value
                    : '';

                if (!newPassword || !confirmPassword) {
                    showError(resetStrings.passwordRequired);
                    return;
                }

                if (newPassword.length < MIN_PASSWORD_LENGTH) {
                    showError(resetStrings.passwordTooShort);
                    return;
                }

                if (newPassword !== confirmPassword) {
                    showError(resetStrings.passwordMismatch);
                    return;
                }

                const { error } = await supabase.auth.updateUser({
                    password: newPassword,
                });

                if (error) {
                    console.error('Update password error:', redactError(error));
                    showError(resetStrings.updatePasswordFailed);
                    return;
                }

                showSuccess(resetStrings.updatePasswordSuccess);

                setTimeout(() => {
                    const rawLang = document.documentElement.lang;
                    const normalized = (rawLang ?? '').trim().toLowerCase();
                    const allowedLocales = new Set(['en', 'zh']);
                    const safeLocale = allowedLocales.has(normalized)
                        ? normalized
                        : 'en';
                    window.location.href = `/${safeLocale}/login`;
                }, 1200);
            } catch (err) {
                console.error('Update password error:', redactError(err));
                showError(resetStrings.updatePasswordFailed);
            } finally {
                isSubmitting = false;
                submitButtonElement.disabled = !sessionReady;
                submitButtonElement.removeAttribute('aria-disabled');
            }
        });
    };

    if (document.readyState !== 'loading') {
        void initialize();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            void initialize();
        });
    }
}
