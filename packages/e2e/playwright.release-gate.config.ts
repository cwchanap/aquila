import { defineConfig, devices } from '@playwright/test';

/**
 * Remote-only release-gate configuration (HPA-233).
 *
 * Unlike `playwright.config.ts` there is NO `webServer`: this suite exists to
 * prove a *deployed* reader serves a specific release, so there is nothing
 * local to start and nothing local to reuse. `BASE_URL` is required and must be
 * an HTTPS origin that is neither a loopback/unspecified host nor
 * credential-bearing — a violation throws at config load, before Playwright
 * can start any process or open any page.
 */
const CONFIG_NAME = 'playwright.release-gate.config.ts';

function resolveBaseUrl(raw: string | undefined): string {
    if (!raw || raw.trim() === '') {
        throw new Error(
            `${CONFIG_NAME}: BASE_URL is required — point it at the HTTPS ` +
                'origin of the deployed reader, e.g. ' +
                'BASE_URL=https://aquila-preview-xxxx.vercel.app'
        );
    }
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(`${CONFIG_NAME}: BASE_URL "${raw}" is not a valid URL`);
    }
    if (url.protocol !== 'https:') {
        throw new Error(
            `${CONFIG_NAME}: BASE_URL must be HTTPS, received "${raw}"`
        );
    }
    // The raw input (which may carry credentials) is echoed in error messages,
    // so reject credential-bearing URLs before anything else: `url.origin`
    // would silently strip `user:pass@host` and let the raw, logged form
    // through — the gate never runs against an authenticated origin.
    if (url.username !== '' || url.password !== '') {
        throw new Error(
            `${CONFIG_NAME}: BASE_URL must not carry credentials, received ` +
                `"${raw}" — the release gate never runs against an ` +
                'authenticated origin'
        );
    }
    const host = url.hostname.toLowerCase();
    // Loopback and unspecified hosts are rejected outright — the whole
    // 127.0.0.0/8 range (not just 127.0.0.1), 0.0.0.0, the IPv6 forms ::1 and
    // :: (hostname keeps the brackets), and every *.localhost host. A base
    // URL that resolves to the machine running the gate can silently test
    // nothing, so the full range must be unreachable, not just the canonical
    // form.
    const isLoopbackOrUnspecified =
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host === '0.0.0.0' ||
        host === '[::1]' ||
        host === '[::]' ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    if (isLoopbackOrUnspecified) {
        throw new Error(
            `${CONFIG_NAME}: BASE_URL must be a deployed origin, received ` +
                `"${raw}" — the release gate never runs against a local server`
        );
    }
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
        throw new Error(
            `${CONFIG_NAME}: BASE_URL must be a bare origin (no path, query, ` +
                `or fragment), received "${raw}"`
        );
    }
    return url.origin;
}

const baseURL = resolveBaseUrl(process.env.BASE_URL);

export default defineConfig({
    testDir: './tests',
    // Only the deployed-flow spec may run here; the local specs require the
    // dev server this config deliberately cannot provide.
    testMatch: /visual-novel-deployed\.spec\.ts/,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL,
        // A gate failure must leave the evidence behind: traces are kept on
        // failure and screenshots are taken on failure.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'desktop-chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 5'] },
        },
    ],
});
