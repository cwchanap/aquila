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

type TestLocale = 'en' | 'zh';

const sharedCredentialsByLocale = new Map<
    TestLocale,
    { email: string; password: string }
>();

async function assertServerAuthenticated(page: Page, locale: TestLocale) {
    const storiesUrl = `/${locale}/stories`;
    const response = await page.goto(storiesUrl, {
        waitUntil: 'domcontentloaded',
    });

    await expect(page).toHaveURL(new RegExp(`/${locale}/stories/?$`));
    expect(response?.ok()).toBeTruthy();

    await expect
        .poll(async () => {
            const cookies = await page.context().cookies();
            return cookies.some(
                c => c.name.includes('sb-') && c.name.includes('auth-token')
            );
        })
        .toBeTruthy();

    const meResponse = await page.request.get('/api/me');
    expect(meResponse.ok()).toBeTruthy();
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
    const emailPrefix = options?.emailPrefix ?? 'e2e';
    const password = options?.password ?? DEFAULT_TEST_PASSWORD;
    const name = options?.name ?? 'E2E Test User';

    const envEmail =
        process.env.E2E_SHARED_EMAIL ?? process.env.SUPABASE_E2E_EMAIL;
    const envPassword =
        process.env.E2E_SHARED_PASSWORD ?? process.env.SUPABASE_E2E_PASSWORD;

    if (envEmail && envPassword) {
        await signInViaUI(page, {
            locale,
            email: envEmail,
            password: envPassword,
        });
        sharedCredentialsByLocale.set(locale, {
            email: envEmail,
            password: envPassword,
        });
        return { email: envEmail, password: envPassword };
    }

    const existing = sharedCredentialsByLocale.get(locale);
    if (existing && !options?.forceNew) {
        await signInViaUI(page, {
            locale,
            email: existing.email,
            password: existing.password,
        });
        return existing;
    }

    const stableEmail = `${emailPrefix}-shared-${locale}@example.com`;
    const email = options?.forceNew
        ? `${emailPrefix}-${randomUUID()}@example.com`
        : stableEmail;

    if (!options?.forceNew) {
        try {
            await signInViaUI(page, {
                locale,
                email,
                password,
            });
            sharedCredentialsByLocale.set(locale, { email, password });
            return { email, password };
        } catch (err) {
            void err;
        }
    }

    await page.goto(`/${locale}/signup`);
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
    ]);

    if (outcome === 'error') {
        const message = await page.locator('#error-message').innerText();

        if (!options?.forceNew) {
            const lowered = message.toLowerCase();
            if (
                lowered.includes('already') ||
                lowered.includes('registered') ||
                lowered.includes('exists') ||
                lowered.includes('rate limit')
            ) {
                try {
                    await signInViaUI(page, {
                        locale,
                        email,
                        password,
                    });
                    sharedCredentialsByLocale.set(locale, { email, password });
                    return { email, password };
                } catch (err) {
                    void err;
                }
            }
        }

        throw new Error(`Signup failed: ${message}`);
    }

    const url = page.url();
    if (url.endsWith(`/${locale}/login`) || url.includes(`/${locale}/login?`)) {
        await signInViaUI(page, { locale, email, password });
    } else {
        await expect(page).toHaveURL(urlRegex);
    }

    if (!options?.forceNew) {
        sharedCredentialsByLocale.set(locale, { email, password });
    }

    await assertServerAuthenticated(page, locale);

    return { email, password };
}
