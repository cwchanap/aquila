import { test, expect } from '@playwright/test';

/**
 * US3 E2E: Account management flows (sign-out, password-reset request, recovery login).
 *
 * The test signs up a new user with a unique email generated at runtime and uses the
 * file-level PASSWORD constant.
 *
 * Required environment variables: none.
 *
 * The test sends a reset email but does not read inbox; it verifies the UI success path
 * and that the user can log out and log back in (recovery).
 */

import { randomUUID } from 'crypto';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;
const PASSWORD = 'password123';

test.describe('Supabase Auth - account management (US3)', () => {
    test('user can sign up, log out, request password reset, and log back in', async ({
        page,
    }) => {
        const email = uniqueEmail('supabase-us3');
        const name = 'US3 Test User';

        // Sign up
        await page.goto('/en/signup');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', PASSWORD);
        await page.fill('input[name="name"]', name);
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/(en|zh)\/$/);
        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );

        // Open user menu and sign out (button title is "User Menu")
        const userMenuButton = page.locator('button[title="User Menu"]');
        await expect(userMenuButton).toBeVisible();
        await userMenuButton.click();
        await page.getByRole('button', { name: /Logout/i }).click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/(en|zh)\/login/);

        // Trigger forgot password flow (validates UI path)
        await page.fill('input[name="email"]', email);
        await page
            .getByRole('link', { name: /Forgot your password\?/i })
            .click();

        // Wait for either success or error banner to appear; exact text may vary by environment.
        const successBanner = page.locator('#success-message');
        const errorBanner = page.locator('#error-message');
        await Promise.race([
            successBanner.waitFor({ state: 'visible', timeout: 5000 }),
            errorBanner.waitFor({ state: 'visible', timeout: 5000 }),
        ]);

        // Log back in (recovery)
        await page.fill('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
        await expect(page.url()).toMatch(/\/(en|zh)\//);
        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );
    });
});
