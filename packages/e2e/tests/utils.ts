import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * Common test utilities for the Aquila app
 */

export class TestHelpers {
    constructor(private page: Page) {}

    /**
     * Navigate to a page and wait for it to load completely
     */
    async navigateAndWait(url: string) {
        await this.page.goto(url);
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Check if the page has the expected gradient background
     */
    async expectGradientBackground() {
        const background = this.page.locator(
            'div.absolute.inset-0.from-sky-200.via-sky-300.to-blue-400'
        );
        await expect(background).toBeVisible();
        await expect(background).toHaveClass(/from-sky-200/);
        await expect(background).toHaveClass(/via-sky-300/);
        await expect(background).toHaveClass(/to-blue-400/);
    }

    /**
     * Check if the glassmorphism container is present
     */
    async expectGlassmorphismContainer() {
        const container = this.page
            .locator('div.bg-white\\/90.backdrop-blur-md.rounded-3xl')
            .first();
        await expect(container).toBeVisible();
        await expect(container).toHaveClass(/rounded-3xl/);
    }

    /**
     * Wait for any loading states to complete
     */
    async waitForFullLoad() {
        await this.page.waitForLoadState('load');
        await this.page.waitForLoadState('domcontentloaded');
        // Wait for a specific element instead of networkidle to be more reliable
        await this.page.waitForSelector('body', { state: 'visible' });
    }

    /**
     * Take a screenshot with a descriptive name
     */
    async takeScreenshot(name: string) {
        await this.page.screenshot({
            path: `test-results/screenshots/${name}.png`,
            fullPage: true,
        });
    }

    /**
     * Check for console errors and warnings
     */
    async getConsoleMessages() {
        const messages: { type: string; text: string }[] = [];

        this.page.on('console', msg => {
            messages.push({
                type: msg.type(),
                text: msg.text(),
            });
        });

        return messages;
    }

    /**
     * Simulate slow network conditions (Chromium only)
     */
    async simulateSlowNetwork() {
        // Only works with Chromium
        if (
            this.page.context().browser()?.browserType().name() === 'chromium'
        ) {
            const client = await this.page.context().newCDPSession(this.page);
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: (500 * 1024) / 8, // 500kb/s
                uploadThroughput: (500 * 1024) / 8,
                latency: 100,
            });
        }
    }

    /**
     * Reset network conditions to default (Chromium only)
     */
    async resetNetworkConditions() {
        // Only works with Chromium
        if (
            this.page.context().browser()?.browserType().name() === 'chromium'
        ) {
            const client = await this.page.context().newCDPSession(this.page);
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: -1,
                uploadThroughput: -1,
                latency: 0,
            });
        }
    }
}

/**
 * Page Object Model for Main Menu
 */
export class MainMenuPage {
    constructor(private page: Page) {}

    // Locators
    get startButton() {
        return this.page.locator('#start-btn');
    }
    get settingsButton() {
        return this.page.locator('#settings-btn');
    }
    get heading() {
        return this.page.locator('body h1').first();
    }

    // Actions
    async goto(locale?: 'en' | 'zh') {
        await this.page.goto(locale ? `/${locale}/` : '/');
    }

    async clickStartGame() {
        await this.startButton.click();
    }

    async clickSettings() {
        await this.settingsButton.click();
    }

    // Assertions
    async expectToBeVisible() {
        await expect(this.heading).toContainText('Main Menu');
        await expect(this.startButton).toBeVisible();
        await expect(this.settingsButton).toBeVisible();
    }
}

/**
 * Page Object Model for Stories Page
 */
export class StoriesPage {
    constructor(private page: Page) {}

    // Locators
    get heading() {
        return this.page.locator('body h1').first();
    }
    get trainAdventureButton() {
        return this.page.locator('a[href*="/reader?story=train_adventure"]');
    }

    // Actions
    async goto(locale: 'en' | 'zh' = 'en') {
        await this.page.goto(`/${locale}/stories`);
    }

    async selectTrainAdventure() {
        await this.trainAdventureButton.click();
    }

    // Assertions
    async expectToBeVisible() {
        await expect(this.heading).toContainText(
            /Select Your Story|選擇您的故事/
        );
        await expect(this.trainAdventureButton).toBeVisible();
    }
}

export const DEFAULT_TEST_PASSWORD = 'password123';

export type TestLocale = 'en' | 'zh';

const sharedCredentialsByLocale = new Map<
    TestLocale,
    { email: string; password: string }
>();

async function getSupabaseAccessToken(page: Page): Promise<string | undefined> {
    function extractTokenFromParsed(parsed: unknown): string | undefined {
        if (!parsed || typeof parsed !== 'object') return undefined;
        const obj = parsed as {
            access_token?: unknown;
            currentSession?: { access_token?: unknown };
            session?: { access_token?: unknown };
        };
        const tokenCandidate =
            obj.access_token ??
            obj.currentSession?.access_token ??
            obj.session?.access_token;
        if (typeof tokenCandidate === 'string' && tokenCandidate.length > 0) {
            return tokenCandidate;
        }
        return undefined;
    }

    function decodeBase64MaybeUrlSafe(raw: string): string | undefined {
        try {
            const normalized = raw
                .replace(/-/g, '+')
                .replace(/_/g, '/')
                .padEnd(Math.ceil(raw.length / 4) * 4, '=');
            return Buffer.from(normalized, 'base64').toString('utf8');
        } catch {
            return undefined;
        }
    }

    async function tryCookie(): Promise<string | undefined> {
        const cookies = await page.context().cookies();
        const authCookie = cookies.find(
            c => c.name.includes('sb-') && c.name.includes('auth-token')
        );

        const rawValue = authCookie?.value;
        if (!rawValue) return undefined;

        const candidates: string[] = [];
        candidates.push(rawValue);
        try {
            candidates.push(decodeURIComponent(rawValue));
        } catch {
            // ignore
        }

        for (const candidate of candidates) {
            const trimmed = candidate.startsWith('base64-')
                ? candidate.slice('base64-'.length)
                : candidate;

            // 1) Plain JSON
            try {
                const parsed = JSON.parse(trimmed);
                const token = extractTokenFromParsed(parsed);
                if (token) return token;
            } catch {
                // ignore
            }

            // 2) base64/json
            const decoded = decodeBase64MaybeUrlSafe(trimmed);
            if (decoded) {
                const decodedTrimmed = decoded.startsWith('base64-')
                    ? decoded.slice('base64-'.length)
                    : decoded;
                try {
                    const parsed = JSON.parse(decodedTrimmed);
                    const token = extractTokenFromParsed(parsed);
                    if (token) return token;
                } catch {
                    // ignore
                }
            }
        }

        return undefined;
    }

    async function tryLocalStorage(): Promise<string | undefined> {
        try {
            return await page.evaluate(() => {
                const ls = globalThis.localStorage;
                if (!ls) return undefined;
                const keys = Object.keys(ls);
                const key = keys.find(
                    k => k.includes('sb-') && k.includes('auth-token')
                );
                if (!key) return undefined;
                const raw = ls.getItem(key);
                if (!raw) return undefined;
                const parsed = JSON.parse(raw) as {
                    access_token?: unknown;
                    currentSession?: { access_token?: unknown };
                    session?: { access_token?: unknown };
                };
                const tokenCandidate =
                    parsed.access_token ??
                    parsed.currentSession?.access_token ??
                    parsed.session?.access_token;
                return typeof tokenCandidate === 'string' &&
                    tokenCandidate.length > 0
                    ? tokenCandidate
                    : undefined;
            });
        } catch {
            return undefined;
        }
    }

    return (await tryCookie()) ?? (await tryLocalStorage());
}

export async function resetStoryWriterData(
    page: Page,
    locale: TestLocale
): Promise<void> {
    await assertServerAuthenticated(page, locale);
    const accessToken = await getSupabaseAccessToken(page);
    if (!accessToken) {
        throw new Error('Missing Supabase access token; cannot reset stories');
    }

    const headers = {
        Authorization: `Bearer ${accessToken}`,
    };

    const storiesResponse = await page.request.get('/api/stories', {
        headers,
    });

    if (!storiesResponse.ok()) {
        const body = await storiesResponse
            .text()
            .catch(() => '(unable to read response body)');
        throw new Error(
            `Failed to list stories for reset: status=${storiesResponse.status()} body=${body}`
        );
    }

    const stories = (await storiesResponse.json().catch(() => [])) as Array<{
        id?: unknown;
    }>;
    const ids = stories
        .map(s => s.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

    for (const id of ids) {
        const del = await page.request.delete(`/api/stories/${id}`, {
            headers,
        });
        if (!del.ok()) {
            const body = await del.text().catch(() => '(unable to read body)');
            throw new Error(
                `Failed to delete story during reset: id=${id} status=${del.status()} body=${body}`
            );
        }
    }
}

async function assertServerAuthenticated(page: Page, locale: TestLocale) {
    const storiesUrl = `/${locale}/stories`;
    const response = await page.goto(storiesUrl, {
        waitUntil: 'commit',
    });

    await expect(page).toHaveURL(new RegExp(`/${locale}/stories/?$`));
    const status = response?.status();
    if (typeof status === 'number') {
        // Playwright's response.ok() is false for 304, but 304 is still a successful navigation.
        if (!(status === 304 || (status >= 200 && status < 400))) {
            throw new Error(
                `Expected successful navigation to ${storiesUrl}, but got status=${status}`
            );
        }
    }

    await expect
        .poll(async () => {
            const cookies = await page.context().cookies();
            return cookies.some(
                c => c.name.includes('sb-') && c.name.includes('auth-token')
            );
        })
        .toBeTruthy();

    // Our /api/me endpoint expects an Authorization Bearer token (it does not read cookies).
    // Supabase stores the session (including access_token) in an auth cookie; parse it and
    // use the access_token to call /api/me.
    const accessToken = await getSupabaseAccessToken(page);

    if (accessToken) {
        const meResponse = await page.request.get('/api/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!meResponse.ok()) {
            const body = await meResponse
                .text()
                .catch(() => '(unable to read response body)');
            throw new Error(
                `Expected /api/me to succeed, but got status=${meResponse.status()} body=${body}`
            );
        }
    }

    // Many tests expect to be returned to the Main Menu route after authentication.
    // The helper navigates to /:locale/stories for a server-side check, so restore
    // the expected landing page before returning.
    await page.goto(`/${locale}/`, { waitUntil: 'commit' });
    await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
}

export async function signInViaUI(
    page: Page,
    options: {
        locale?: TestLocale;
        email: string;
        password: string;
    }
): Promise<void> {
    const locale = options.locale ?? 'en';

    await page.goto(`/${locale}/login`);
    await page.fill('input[name="email"]', options.email);
    await page.fill('input[name="password"]', options.password);
    await page.click('button[type="submit"]');

    const urlRegex = new RegExp(`/${locale}/?$`);

    const outcome = await Promise.race([
        page.waitForURL(urlRegex, { timeout: 15_000 }).then(() => 'redirect'),
        page
            .locator('#error-message:not(.hidden)')
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => 'error'),
    ]);

    if (outcome === 'error') {
        const message = await page.locator('#error-message').innerText();
        throw new Error(`Login failed: ${message}`);
    }

    await assertServerAuthenticated(page, locale);
}

export async function signUpViaUI(
    page: Page,
    options?: {
        locale?: TestLocale;
        emailPrefix?: string;
        password?: string;
        name?: string;
        forceNew?: boolean;
    }
): Promise<{ email: string; password: string }> {
    const locale = options?.locale ?? 'en';
    const email =
        process.env.E2E_SHARED_EMAIL ??
        process.env.SUPABASE_E2E_EMAIL ??
        'test-aquila@cwchanap.dev';
    const password =
        process.env.E2E_SHARED_PASSWORD ??
        process.env.SUPABASE_E2E_PASSWORD ??
        DEFAULT_TEST_PASSWORD;

    try {
        await signInViaUI(page, {
            locale,
            email,
            password,
        });
    } catch (err) {
        const details = err instanceof Error ? err.message : String(err);
        throw new Error(
            `E2E shared login failed for ${email}. Configure E2E_SHARED_EMAIL/E2E_SHARED_PASSWORD (or SUPABASE_E2E_EMAIL/SUPABASE_E2E_PASSWORD) and ensure the user exists. Original error: ${details}`
        );
    }

    sharedCredentialsByLocale.set(locale, { email, password });
    return { email, password };
}

export async function signUpFreshUserViaUI(
    page: Page,
    options?: {
        locale?: TestLocale;
        emailPrefix?: string;
        password?: string;
        name?: string;
    }
): Promise<{ email: string; password: string }> {
    const locale = options?.locale ?? 'en';
    const password = options?.password ?? DEFAULT_TEST_PASSWORD;
    const emailPrefix = options?.emailPrefix ?? 'e2e';
    const name = options?.name ?? 'E2E Test User';
    const email = `${emailPrefix}-${randomUUID()}@example.com`;

    await page.goto(`/${locale}/signup`, { waitUntil: 'commit' });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="name"]', name);
    await page.click('button[type="submit"]');

    const urlRegex = new RegExp(`/${locale}/?$`);

    const outcome = await Promise.race([
        page.waitForURL(urlRegex, { timeout: 15_000 }).then(() => 'redirect'),
        page
            .locator('#error-message:not(.hidden)')
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => 'error'),
        page
            .getByText(/check your email to confirm/i)
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => 'confirm'),
    ]);

    if (outcome === 'error') {
        const message = await page.locator('#error-message').innerText();
        throw new Error(`Signup failed: ${message}`);
    }

    if (outcome === 'confirm') {
        throw new Error(
            'Signup requires email confirmation (no immediate session). For local/CI E2E, disable email confirmations in Supabase or pre-create users.'
        );
    }

    await assertServerAuthenticated(page, locale);
    return { email, password };
}
