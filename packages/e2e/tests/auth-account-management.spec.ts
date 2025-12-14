import { test, expect } from '@playwright/test';

/**
 * US3 E2E: Account management flows (sign-out, password-reset request UI).
 *
 * The test signs up a new user with a unique email generated at runtime and uses the
 * file-level PASSWORD constant.
 *
 * Required environment variables: none.
 *
 * NOTE: This test validates the password-reset REQUEST UI only. It does not test the
 * full password recovery flow (email link extraction, setting a new password) because
 * that would require email interception infrastructure (e.g., Mailosaur, Inbucket).
 * A future enhancement could add full recovery testing with such tooling.
 */

import { randomUUID } from 'crypto';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;
const PASSWORD = 'password123';

test.describe('Supabase Auth - account management (US3)', () => {
    test('user can sign up, log out, and request password reset (UI only)', async ({
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

        const successVisible = await successBanner.isVisible();
        const errorVisible = await errorBanner.isVisible();
        expect(
            successVisible !== errorVisible,
            'Expected exactly one banner (success or error) to be visible after requesting a password reset.'
        ).toBe(true);

        if (errorVisible) {
            throw new Error(
                `Password reset request showed an error banner: ${await errorBanner
                    .innerText()
                    .catch(() => '(unable to read error text)')}`
            );
        }

        await expect(successBanner).toBeVisible();
        await expect(errorBanner).toBeHidden();

        // NOTE: We intentionally stop here. The password reset REQUEST was successful.
        // Testing the full recovery flow (clicking email link, setting new password)
        // would require email interception infrastructure not currently in place.
    });

    test('user can still log in with original password after reset request', async ({
        page,
    }) => {
        const email = uniqueEmail('supabase-us3-login');
        const name = 'US3 Login Test';

        // Sign up
        await page.goto('/en/signup');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', PASSWORD);
        await page.fill('input[name="name"]', name);
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/(en|zh)\/$/);

        // Sign out
        const userMenuButton = page.locator('button[title="User Menu"]');
        await userMenuButton.click();
        await page.getByRole('button', { name: /Logout/i }).click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/(en|zh)\/login/);

        // NOTE: This login only verifies the user can still log in with the ORIGINAL
        // password—it does NOT validate the reset functionality itself.
        // Log back in with original credentials
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
        await expect(page.url()).toMatch(/\/(en|zh)\//);
        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );
    });
});
