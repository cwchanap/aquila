import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `signIn` is a function that also carries a `.social` method. Mock it once
// at module load; reset call state between tests via vi.mocked().
vi.mock('../auth-client', () => ({
    signIn: Object.assign(vi.fn(), { social: vi.fn() }),
}));

// Mock the logger so tests can assert production telemetry routing without
// relying on console.error formatting or NODE_ENV-dependent level filtering.
vi.mock('../logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../constants/errorIds', () => ({
    ERROR_IDS: { AUTH_SIGNIN_FAILED: 'AUTH_002' },
}));

// Import after mock so the module sees the mocked signIn.
import { signIn } from '../auth-client';
import { logger } from '../logger';
import { ERROR_IDS } from '../../constants/errorIds';
import { initLogin } from '../login-manager';

const signInSocial = vi.mocked(signIn.social);
const loggerErrorSpy = vi.mocked(logger.error);

/**
 * Build the DOM scaffold initLogin() expects:
 *   - #google-signin-btn  (the click target)
 *   - #error-message      (error display, starts hidden)
 *   - #login-translations (embedded JSON with { signInError })
 *   - [data-locale]       (locale hint, defaults to "en")
 */
function setupDom(opts?: { translations?: string | null; locale?: string }): {
    btn: HTMLButtonElement;
    errorMessage: HTMLDivElement;
} {
    document.body.replaceChildren();

    const btn = document.createElement('button');
    btn.id = 'google-signin-btn';
    btn.type = 'button';
    document.body.appendChild(btn);

    const errorMessage = document.createElement('div');
    errorMessage.id = 'error-message';
    errorMessage.classList.add('hidden');
    document.body.appendChild(errorMessage);

    if (opts?.translations !== null) {
        const t = document.createElement('script');
        t.id = 'login-translations';
        t.type = 'application/json';
        t.textContent =
            opts?.translations ??
            JSON.stringify({ signInError: 'Sign-in failed.' });
        document.body.appendChild(t);
    }

    // Set data-locale on the existing <html> element (happy-dom only allows
    // one documentElement, so we mutate it in place rather than replacing it).
    document.documentElement.setAttribute('data-locale', opts?.locale ?? 'en');

    return { btn, errorMessage };
}

/** Fire DOMContentLoaded so initLogin's listener wires up the click handler. */
function fireReady(): void {
    document.dispatchEvent(
        new Event('DOMContentLoaded', { bubbles: true, cancelable: true })
    );
}

describe('initLogin', () => {
    beforeEach(() => {
        signInSocial.mockReset();
        signIn.mockReset();
        loggerErrorSpy.mockReset();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it('wires a click handler that calls signIn.social with google + locale callbackURL', async () => {
        const { btn } = setupDom({ locale: 'zh' });
        signInSocial.mockResolvedValue({ error: null });

        initLogin();
        fireReady();

        btn.click();
        // signIn.social is awaited inside the click handler
        await vi.waitFor(() => expect(signInSocial).toHaveBeenCalled());

        expect(signInSocial).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: '/zh/',
        });
    });

    it('defaults the locale to "en" when [data-locale] is absent', async () => {
        const { btn } = setupDom();
        // Remove the data-locale attribute to exercise the fallback
        document.documentElement.removeAttribute('data-locale');
        signInSocial.mockResolvedValue({ error: null });

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(signInSocial).toHaveBeenCalled());

        expect(signInSocial).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: '/en/',
        });
    });

    it('disables the button while the social call is in flight, then re-enables on success', async () => {
        const { btn } = setupDom();
        let resolveSocial!: (v: { error: unknown }) => void;
        signInSocial.mockReturnValue(
            new Promise(r => {
                resolveSocial = r;
            })
        );

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(signInSocial).toHaveBeenCalled());
        expect(btn.disabled).toBe(true);

        resolveSocial({ error: null });
        await vi.waitFor(() => expect(btn.disabled).toBe(false));
    });

    it('shows the returned error.message and re-enables the button when signIn.social resolves with an error', async () => {
        const { btn, errorMessage } = setupDom();
        signInSocial.mockResolvedValue({
            error: { message: 'Google says no' },
        });

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(errorMessage.textContent).toBe('Google says no');
        expect(errorMessage.classList.contains('hidden')).toBe(false);
        // Structured-error branch also routes through logger with an errorId
        // so production sign-in failures are visible.
        expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Google sign-in returned an error',
            undefined,
            {
                errorId: ERROR_IDS.AUTH_SIGNIN_FAILED,
                error: 'Google says no',
            }
        );
    });

    it('falls back to the embedded translation when the returned error has no message', async () => {
        const { btn, errorMessage } = setupDom({
            translations: JSON.stringify({ signInError: 'Oops.' }),
        });
        signInSocial.mockResolvedValue({ error: {} });

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(errorMessage.textContent).toBe('Oops.');
        expect(errorMessage.classList.contains('hidden')).toBe(false);
    });

    it('logs via logger (in all envs) and shows the fallback message when signIn.social throws', async () => {
        const { btn, errorMessage } = setupDom({
            translations: JSON.stringify({ signInError: 'Fallback msg' }),
        });
        signInSocial.mockRejectedValue(new Error('network down'));

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Google sign-in failed',
            expect.any(Error),
            { errorId: ERROR_IDS.AUTH_SIGNIN_FAILED }
        );
        expect(loggerErrorSpy.mock.calls[0][1]).toBeInstanceOf(Error);
        expect((loggerErrorSpy.mock.calls[0][1] as Error).message).toBe(
            'network down'
        );
        expect(errorMessage.textContent).toBe('Fallback msg');
        expect(errorMessage.classList.contains('hidden')).toBe(false);
    });

    it('wraps a non-Error throw as an Error (preserving string messages) before logging', async () => {
        const { btn } = setupDom();
        signInSocial.mockRejectedValue('string thrown');

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Google sign-in failed',
            expect.any(Error),
            { errorId: ERROR_IDS.AUTH_SIGNIN_FAILED }
        );
        expect((loggerErrorSpy.mock.calls[0][1] as Error).message).toBe(
            'string thrown'
        );
    });

    it('falls back to "unknown" for a non-string, non-Error throw', async () => {
        const { btn } = setupDom();
        signInSocial.mockRejectedValue({ weird: 'object' });

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Google sign-in failed',
            expect.any(Error),
            { errorId: ERROR_IDS.AUTH_SIGNIN_FAILED }
        );
        expect((loggerErrorSpy.mock.calls[0][1] as Error).message).toBe(
            'unknown'
        );
    });

    it('hides a previously visible error when the button is clicked again', async () => {
        const { btn, errorMessage } = setupDom();
        // Pre-show an error from a prior failed attempt
        errorMessage.textContent = 'old error';
        errorMessage.classList.remove('hidden');

        signInSocial.mockResolvedValue({ error: null });

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(signInSocial).toHaveBeenCalled());

        // hideError() runs synchronously before the await
        expect(errorMessage.classList.contains('hidden')).toBe(true);
    });

    it('uses the generic English fallback when the #login-translations element is missing', async () => {
        const { btn, errorMessage } = setupDom({ translations: null });
        signInSocial.mockRejectedValue(new Error('boom'));

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(errorMessage.textContent).toBe(
            'Sign-in failed. Please try again.'
        );
    });

    it('uses the generic English fallback when #login-translations contains corrupt JSON', async () => {
        const { btn, errorMessage } = setupDom({
            translations: '{not valid json',
        });
        signInSocial.mockRejectedValue(new Error('boom'));

        initLogin();
        fireReady();

        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));

        expect(errorMessage.textContent).toBe(
            'Sign-in failed. Please try again.'
        );
    });

    it('does not throw if the google-signin-btn element is absent', () => {
        // No button in the DOM; initLogin should still register its
        // DOMContentLoaded listener without error.
        document.body.replaceChildren();
        const errorMessage = document.createElement('div');
        errorMessage.id = 'error-message';
        document.body.appendChild(errorMessage);

        expect(() => {
            initLogin();
            fireReady();
        }).not.toThrow();
    });

    it('wires the click handler immediately when the document is already interactive (no DOMContentLoaded needed)', async () => {
        const { btn } = setupDom({ locale: 'en' });
        signInSocial.mockResolvedValue({ error: null });

        // Force the "already ready" branch: readyState is 'interactive', so
        // initLogin must wire up synchronously instead of waiting for
        // DOMContentLoaded (which never fires in this scenario).
        const readyStateSpy = vi
            .spyOn(document, 'readyState', 'get')
            .mockReturnValue('interactive');

        try {
            initLogin();
            // Deliberately do NOT call fireReady() — the handler must already
            // be attached.
            btn.click();
            await vi.waitFor(() => expect(signInSocial).toHaveBeenCalled());
        } finally {
            readyStateSpy.mockRestore();
        }
    });
});
