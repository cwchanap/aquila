import { test, expect } from '@playwright/test';

test.describe('Simple Login UI Test', () => {
    test('should show login button on main page', async ({ page }) => {
        await page.goto('http://localhost:5090');

        // Should see login button in top right
        const loginButton = page.locator('a[href="/login"]');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toHaveText('Login');
    });

    test('should navigate to login page', async ({ page }) => {
        await page.goto('http://localhost:5090');

        // Click login button
        await page.click('a[href="/login"]');

        // Should be on login page
        await expect(page).toHaveURL('http://localhost:5090/login');
        await expect(page.locator('h1')).toHaveText('Login');
    });

    test('should have login form elements', async ({ page }) => {
        await page.goto('http://localhost:5090/login');

        // Should have form elements
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('input[name="name"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('button#signup-btn')).toBeVisible();
    });

    test('should have back button', async ({ page }) => {
        await page.goto('http://localhost:5090/login');

        // Should have back button
        const backButton = page.locator('a[href="/"]').first();
        await expect(backButton).toBeVisible();

        // Click back button
        await backButton.click();

        // Should navigate back to home
        await expect(page).toHaveURL('http://localhost:5090/');
    });
});
