import { test, expect } from '@playwright/test';

test.describe('Navigation Flow', () => {
    test('should complete full user journey from homepage to story setup', async ({
        page,
    }) => {
        // Start at homepage
        await page.goto('/');
        await expect(page).toHaveTitle(/Main Menu - Game App/);

        // Navigate to stories
        await page.click('#start-btn');
        await expect(page).toHaveURL('/stories');
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );

        // Navigate to story setup
        await page.click('a[href="/story/setup?story=train_adventure"]');
        await expect(page).toHaveURL('/story/setup?story=train_adventure');
    });

    test('should handle browser back navigation correctly', async ({
        page,
    }) => {
        // Navigate through the flow
        await page.goto('/');
        await page.click('#start-btn');
        await page.click('a[href="/story/setup?story=train_adventure"]');

        // Go back to stories page
        await page.goBack();
        await expect(page).toHaveURL('/stories');
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );

        // Go back to homepage
        await page.goBack();
        await expect(page).toHaveURL('/');
        await expect(page.locator('body h1').first()).toContainText(
            'Main Menu'
        );
    });
});

test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await page.goto('/');

        // Check if elements are still visible and properly sized
        const container = page.locator('div.max-w-md');
        await expect(container).toBeVisible();

        // Check if buttons are properly sized for mobile
        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();

        // Click should still work on mobile
        await startButton.click();
        await expect(page).toHaveURL('/stories');
    });

    test('should work on tablet viewport', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.goto('/');

        // Check if layout adapts properly
        const container = page.locator('div.max-w-md');
        await expect(container).toBeVisible();

        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();
    });
});
