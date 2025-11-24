import { test, expect } from '@playwright/test';

test.describe('Stories Page', () => {
    test('should load and display story selection', async ({ page }) => {
        await page.goto('/stories');

        // Check if the page loads successfully
        await expect(page).toHaveTitle(/Select Story/);

        // Check if story selection heading is visible
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );

        // Check if Train Adventure button is visible (link may vary based on authentication/character setup)
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await expect(trainAdventureButton).toBeVisible();
        await expect(trainAdventureButton).toContainText('Train Adventure');
    });

    test('should have proper styling consistent with main menu', async ({
        page,
    }) => {
        await page.goto('/stories');

        // Check if the page has the same gradient background
        const mainDiv = page.locator('div.min-h-screen');
        await expect(mainDiv).toHaveClass(/bg-gradient-to-br/);

        // Check if the container has the same styling
        const container = page.locator('div.bg-white\\/10');
        await expect(container).toBeVisible();
        await expect(container).toHaveClass(/backdrop-blur-sm/);
    });

    test('should navigate to train adventure setup when clicked (for non-authenticated users)', async ({
        page,
    }) => {
        await page.goto('/stories');

        // Click the Train Adventure button
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await trainAdventureButton.click();

        // For non-authenticated users, should navigate to setup page
        await expect(page).toHaveURL('/story/setup?story=train_adventure');
    });

    test('should be accessible from main menu', async ({ page }) => {
        // Start from homepage
        await page.goto('/');

        // Click Start Game button
        await page.click('#start-btn');

        // Should navigate to stories page
        await expect(page).toHaveURL('/stories');
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );
    });
});
