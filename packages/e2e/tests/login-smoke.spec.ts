import { test, expect } from '@playwright/test';

test.describe('Better-Auth Login Functionality', () => {
    test('should navigate to login page', async ({ page }) => {
        await page.goto('/en/');

        // Click login button
        const loginLink = page.getByRole('link', { name: /login/i });
        await loginLink.click();
        await page.waitForURL(/\/en\/login\/?$/);

        // Should be on localized login page
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // And a link to the signup page
        await expect(page.locator('a[href="/en/signup"]')).toBeVisible();
    });
});
