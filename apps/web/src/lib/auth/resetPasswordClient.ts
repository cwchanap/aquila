import { getSupabaseAuthClient } from '@/lib/auth';

type ResetPageStrings = {
    invalidOrMissingLink: string;
    startSessionFailed: string;
    sessionNotReady: string;
    passwordMismatch: string;
    updatePasswordFailed: string;
    updatePasswordSuccess: string;
};

type ResetPasswordClientOptions = {
    resetStrings: ResetPageStrings;
};

export function initializeResetPasswordClient({
    resetStrings,
}: ResetPasswordClientOptions) {
    document.addEventListener('DOMContentLoaded', async () => {
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

            try {
                history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search
                );
            } catch {
                void 0;
            }

            if (!access_token || !refresh_token) {
                showError(resetStrings.invalidOrMissingLink);
                submitButtonElement.disabled = true;
                return;
            }

            try {
                const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });

                if (error) {
                    console.error('Session init error:', error);
                    showError(resetStrings.startSessionFailed);
                    sessionReady = false;
                    submitButtonElement.disabled = true;
                    return;
                }

                sessionReady = true;
                submitButtonElement.disabled = false;
            } catch (err) {
                console.error('Session init error:', err);
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
            hideError();
            hideSuccess();

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

            if (!newPassword || newPassword !== confirmPassword) {
                showError(resetStrings.passwordMismatch);
                return;
            }

            try {
                const { error } = await supabase.auth.updateUser({
                    password: newPassword,
                });

                if (error) {
                    console.error('Update password error:', error);
                    showError(resetStrings.updatePasswordFailed);
                    return;
                }

                showSuccess(resetStrings.updatePasswordSuccess);

                setTimeout(() => {
                    window.location.href = `/${document.documentElement.lang || 'en'}/login`;
                }, 1200);
            } catch (err) {
                console.error('Update password error:', err);
                showError(resetStrings.updatePasswordFailed);
            }
        });
    });
}
