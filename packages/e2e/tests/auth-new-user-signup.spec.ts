import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;

/**
 * US2 E2E: New Supabase user signup and first-play journey.
 *
 * This test assumes that email confirmation is either disabled or configured so
 * that `auth.signUp` results in an active session for the new user in the test
 * environment.
 */

test.describe('Supabase Auth - new user signup (US2)', () => {
    test('new user can sign up via /en/signup and reach main menu', async ({
        page,
    }) => {
        await page.goto('/en/signup');

        const email = uniqueEmail('supabase-signup');

        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Supabase Test User');
        await page.click('button[type="submit"]');

        await page.waitForLoadState('networkidle');

        await expect(page.url()).toMatch(/\/(en|zh)\//);

        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );

        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();
        await startButton.click();
        await expect(page).toHaveURL(/\/(en|zh)\/stories$/);
    });
});
