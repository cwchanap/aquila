import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;

test.describe('Auth Error States', () => {
    test('Displays error banner when /api/me fails with 500 after login', async ({
        page,
    }) => {
        // 1. Signup as a new user to establish a session
        await page.goto('/en/signup');
        const email = uniqueEmail('error-state-test');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Error Test User');
        await page.click('button[type="submit"]');

        // Wait for redirect to home
        await page.waitForURL(/\/en\/?$/);

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

        // 3. Reload the page to trigger the auth check again with the mocked failure
        await page.reload();

        // 4. Verify that we are NOT redirected to login
        expect(page.url()).not.toContain('/login');

        // 5. Verify the error banner is visible
        const errorBanner = page.locator('text=Connection Error');
        await expect(errorBanner).toBeVisible();
        await expect(page.locator('text=Auth server error: 500')).toBeVisible();
    });
});
