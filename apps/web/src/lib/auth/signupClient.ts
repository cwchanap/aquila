import { getTranslations, type Locale } from '@aquila/dialogue';
import { getSupabaseAuthClient } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/constants';

type SignupClientOptions = {
    locale?: Locale | string;
};

const supportedLocales = new Set<Locale>(['en', 'zh']);

function resolveLocale(locale?: Locale | string): Locale {
    if (locale && supportedLocales.has(locale as Locale)) {
        return locale as Locale;
    }

    const dataLocale =
        document.querySelector('[data-locale]')?.getAttribute('data-locale') ??
        '';
    const normalizedDataLocale = dataLocale.trim().toLowerCase();
    if (supportedLocales.has(normalizedDataLocale as Locale)) {
        return normalizedDataLocale as Locale;
    }

    const documentLocale = (document.documentElement.lang ?? '')
        .trim()
        .toLowerCase();
    if (supportedLocales.has(documentLocale as Locale)) {
        return documentLocale as Locale;
    }

    return 'en';
}

export function initializeSignupClient(options: SignupClientOptions = {}) {
    const initialize = () => {
        const signupForm = document.getElementById('signup-form');
        const errorMessage = document.getElementById('error-message');

        if (!(signupForm instanceof HTMLFormElement)) {
            return;
        }

        if (!(errorMessage instanceof HTMLElement)) {
            return;
        }

        const successMessage = document.createElement('div');
        successMessage.className =
            'mt-4 text-emerald-700 text-sm font-semibold p-3 bg-emerald-50 rounded-lg border border-emerald-200 hidden';
        errorMessage.insertAdjacentElement('afterend', successMessage);

        const errorEl = errorMessage;
        const successEl = successMessage;
        const supabase = getSupabaseAuthClient();
        const locale = resolveLocale(options.locale);
        const t = getTranslations(locale);

        function showError(message: string) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            successEl.classList.add('hidden');
        }

        function hideError() {
            errorEl.classList.add('hidden');
        }

        function showSuccess(message: string) {
            successEl.textContent = message;
            successEl.classList.remove('hidden');
            hideError();
        }

        function hideSuccess() {
            successEl.classList.add('hidden');
        }

        signupForm.addEventListener('submit', async event => {
            event.preventDefault();
            hideError();
            hideSuccess();

            const formData = new FormData(signupForm);
            const email = formData.get('email')?.toString() ?? '';
            const password = formData.get('password')?.toString() ?? '';
            const name = formData.get('name')?.toString() ?? '';

            if (!email || !password || !name) {
                showError(t.auth.signupAllFieldsRequired);
                return;
            }

            if (password.length < MIN_PASSWORD_LENGTH) {
                showError(t.auth.passwordTooShort);
                return;
            }

            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                        },
                    },
                });

                if (error) {
                    showError(error.message || t.auth.signupFailed);
                    return;
                }

                // If Supabase returns a session (email confirmation not required), redirect to home
                if (data?.session) {
                    window.location.href = `/${locale}/`;
                    return;
                }

                // Otherwise, show email confirmation instructions and keep the user on the page
                showSuccess(t.auth.signupCheckEmail);

                // Safely add a login link
                const loginLink = document.createElement('a');
                loginLink.href = `/${locale}/login`;
                loginLink.textContent = t.auth.goToLogin;
                loginLink.className =
                    'underline text-emerald-700 font-bold hover:text-emerald-800';
                successEl.appendChild(document.createTextNode(' '));
                successEl.appendChild(loginLink);
            } catch (error) {
                console.error('Signup failed:', error);
                showError(t.auth.signupFailedTryAgain);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, {
            once: true,
        });
    } else {
        initialize();
    }
}
