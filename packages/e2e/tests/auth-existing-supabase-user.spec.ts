import { test, expect } from '@playwright/test';
import { DEFAULT_TEST_PASSWORD } from './utils';

/**
 * US1 E2E: Existing Supabase user signs in and reaches Aquila main menu.
 *
 * This test assumes you have a valid Supabase user available. To run it,
 * set the following environment variables for Playwright:
 *
 *   SUPABASE_E2E_EMAIL
 *   SUPABASE_E2E_PASSWORD
 *
 * If either variable is missing, the test will be skipped.
 */

const SUPABASE_E2E_EMAIL =
    process.env.E2E_SHARED_EMAIL ??
    process.env.SUPABASE_E2E_EMAIL ??
    'test-aquila@cwchanap.dev';
const SUPABASE_E2E_PASSWORD =
    process.env.E2E_SHARED_PASSWORD ??
    process.env.SUPABASE_E2E_PASSWORD ??
    DEFAULT_TEST_PASSWORD;

test.describe('Supabase Auth - existing user sign-in (US1)', () => {
    test('existing Supabase user can sign in via /en/login and reach main menu', async ({
        page,
    }) => {
        // Start on the localized login page
        await page.goto('/en/login');

        // Fill Supabase email/password form
        await page.fill('input[name="email"]', SUPABASE_E2E_EMAIL!);
        await page.fill('input[name="password"]', SUPABASE_E2E_PASSWORD!);
        await page.click('button[type="submit"]');

        // After successful login, user should be redirected to localized home
        // (the client code currently uses locale to choose /en/ or /zh/)
        await page.waitForLoadState('networkidle');
        await expect(page.url()).toMatch(/\/(en|zh)\//);

        // Hitting the root index should no longer send us back to /auth,
        // because getCurrentUser() should resolve to a valid Application User
        await page.goto('/');

        // Verify we did not get bounced to /auth
        await expect(page).not.toHaveURL('/auth');

        // Main menu should be visible (Heading includes 'Main Menu')
        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );

        // Sanity-check: stories navigation still works while authenticated
        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();
        await startButton.click();
        await expect(page).toHaveURL(/\/(en|zh)\/stories$/);
    });
});
