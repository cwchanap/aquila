import { test, expect } from '@playwright/test';
import { signInWithSharedCredentialsViaUI, TestHelpers } from './utils';

test.describe('Stories Page', () => {
    test('should load and display story selection', async ({ page }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
        await page.goto('/en/stories');

        // Check if the page loads successfully
        await expect(page).toHaveTitle(/Select Story/);

        // Check if story selection heading is visible
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );

        // Check if Train Adventure button is visible (link may vary based on authentication/character setup)
        const trainAdventureButton = page.locator(
            'a[href*="/reader?story=train_adventure"]'
        );
        await expect(trainAdventureButton).toBeVisible();
        await expect(trainAdventureButton).toContainText('Train Adventure');
    });

    test('should have proper styling consistent with main menu', async ({
        page,
    }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
        await page.goto('/en/stories');

        const helpers = new TestHelpers(page);

        // Check if the page has the same gradient background
        await helpers.expectGradientBackground();

        // Check if the container has the same styling
        await helpers.expectGlassmorphismContainer();
    });

    test('should navigate to train adventure setup when clicked (for authenticated users)', async ({
        page,
    }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
        await page.goto('/en/stories');

        // Click the Train Adventure button
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await trainAdventureButton.click();
        await expect(page).toHaveURL('/en/reader?story=train_adventure');
    });

    test('should be accessible from main menu', async ({ page }) => {
        await signInWithSharedCredentialsViaUI(page, {
            locale: 'en',
        });
        // Start from homepage
        await page.goto('/en/');

        // Click Start Game button
        await page.click('#start-btn');

        // Should navigate to stories page
        await expect(page).toHaveURL('/en/stories');
        await expect(page.locator('body h1').first()).toContainText(
            'Select Your Story'
        );
    });
});
