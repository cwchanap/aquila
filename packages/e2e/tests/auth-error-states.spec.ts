import { test, expect, devices } from '@playwright/test';
import { randomUUID } from 'crypto';

import { MainMenuPage, TestHelpers } from './utils';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;

test.describe('Auth Error States', () => {
    const mobileDevices = ['Pixel 5', 'iPhone 12'] as const;

    for (const deviceName of mobileDevices) {
        test.describe(`Auth Error States - ${deviceName}`, () => {
            const device = {
                ...devices[deviceName],
            } as Record<string, unknown>;
            delete (device as { defaultBrowserType?: unknown })
                .defaultBrowserType;
            test.use(device);

            test('Displays error modal when /api/me fails with 500 after login', async ({
                page,
            }) => {
                const mainMenu = new MainMenuPage(page);
                const helpers = new TestHelpers(page);

                // 1. Signup as a new user to establish a session
                await page.goto('/en/signup');
                const email = uniqueEmail('error-state-test');
                await page.fill('input[name="email"]', email);
                await page.fill('input[name="password"]', 'password123');
                await page.fill('input[name="name"]', 'Error Test User');
                await page.click('#signup-btn');

                // Wait for redirect to localized home (authenticated)
                await page.waitForURL(/\/en\/?$/);
                await helpers.waitForFullLoad();
                await mainMenu.expectToBeVisible();

                // 2. Now setup the network mock for /api/me
                await page.route('**/api/me', route =>
                    route.fulfill({
                        status: 500,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: 'Simulated Internal Server Error',
                        }),
                    })
                );

                // 3. Navigate to root index to trigger the client auth check with mocked failure
                await Promise.all([
                    page.waitForResponse(
                        response =>
                            response.url().includes('/api/me') &&
                            response.status() === 500,
                        { timeout: 10_000 }
                    ),
                    mainMenu.goto('en'),
                ]);

                // 4. Verify that we are NOT redirected to login
                await expect(page).not.toHaveURL(/\/(en|zh)\/login/);

                // 5. Verify the error modal is visible
                await expect(
                    page.getByRole('heading', { name: /Connection Error/i })
                ).toBeVisible();

                const details = page.locator('pre');
                await expect(details).toBeVisible();
                await expect(details).toContainText(/Auth server error: 500/);
            });
        });
    }
});
