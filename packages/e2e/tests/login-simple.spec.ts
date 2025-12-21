import { test, expect } from '@playwright/test';
import { signUpViaUI } from './utils';

test.describe('Simple Login UI Test', () => {
    test('should show login button on localized main page', async ({
        page,
    }) => {
        await page.goto('/en/');

        // Should see login button in top right for the English locale
        await expect(page).toHaveURL('/en/login');
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('should navigate to localized login page', async ({ page }) => {
        await page.goto('/en/');

        // Click login button
        const loginLink = page.getByRole('link', { name: /login/i });
        await loginLink.click();
        await page.waitForURL(/\/en\/login\/?$/);

        // Should be on localized login page
        await expect(page).toHaveURL(/\/en\/login$/);
        await expect(page.locator('h1')).toContainText('Login');
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
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'login-back' });
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
