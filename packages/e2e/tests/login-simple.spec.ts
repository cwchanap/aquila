import { test, expect } from '@playwright/test';
import { signInWithSharedCredentialsViaUI } from './utils';

test.describe('Simple Login UI Test', () => {
    test('should redirect unauthenticated users to localized login page', async ({
        page,
    }) => {
        // Navigate to localized root as unauthenticated
        await page.goto('/en/');

        // Should be redirected to /en/login
        await page.waitForURL(/\/en\/login/);
        await expect(page).toHaveURL(/\/en\/login/);

        // Verify login form is visible
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('should navigate to localized login page', async ({ page }) => {
        await page.goto('/en/');

        // Unauthenticated users are redirected to the localized login page
        await page.waitForURL(/\/en\/login\/?$/);

        // Should be on localized login page
        await expect(page).toHaveURL(/\/en\/login\/?$/);
        await expect(
            page.getByRole('heading', { name: 'Login' })
        ).toBeVisible();
    });

    test('should have login and account-management UI elements', async ({
        page,
    }) => {
        await page.goto('/en/login');

        // Core form elements for Supabase email/password login
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // Link to signup page
        const signupLink = page
            .locator('a')
            .filter({ hasText: 'Sign up here' });
        await expect(signupLink).toBeVisible();

        // Forgot-password trigger link
        const forgotLink = page
            .locator('a')
            .filter({ hasText: 'Forgot your password?' });
        await expect(forgotLink).toBeVisible();
    });

    test('should have back button to localized home', async ({ page }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
        await page.goto('/en/login');

        // Should have back button that returns to localized home
        const backButton = page.locator('a[href="/en/"]').first();
        await expect(backButton).toBeVisible();

        // Click back button
        await backButton.click();

        // Should navigate back to localized home
        await expect(page).toHaveURL(/\/en\/?$/);
    });
});
