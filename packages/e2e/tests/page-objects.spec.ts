import { test, expect } from '@playwright/test';
import { MainMenuPage, StoriesPage, TestHelpers, signUpViaUI } from './utils';

test.describe('Page Object Model Example', () => {
    test('should navigate using page objects', async ({ page }) => {
        const mainMenu = new MainMenuPage(page);
        const stories = new StoriesPage(page);
        const helpers = new TestHelpers(page);

        await signUpViaUI(page, { locale: 'en', emailPrefix: 'pomspec' });

        // Navigate to main menu
        await mainMenu.goto('en');
        await helpers.waitForFullLoad();

        // Verify main menu is visible
        await mainMenu.expectToBeVisible();
        await helpers.expectGradientBackground();
        await helpers.expectGlassmorphismContainer();

        // Navigate to stories
        await mainMenu.clickStartGame();
        await helpers.waitForFullLoad();

        // Verify stories page is visible
        await stories.expectToBeVisible();
        await expect(page).toHaveURL('/en/stories');

        // Select train adventure
        await stories.selectTrainAdventure();
        await expect(page).toHaveURL('/en/reader?story=train_adventure');
    });

    test('should handle slow network conditions', async ({
        page,
        browserName,
    }) => {
        const helpers = new TestHelpers(page);
        const mainMenu = new MainMenuPage(page);

        // Skip on non-Chromium browsers as CDP is only available in Chromium
        if (browserName !== 'chromium') {
            test.skip(true, 'Network simulation only available in Chromium');
            return;
        }

        // Simulate slow network
        await helpers.simulateSlowNetwork();

        await signUpViaUI(page, { locale: 'en', emailPrefix: 'pomspec-slow' });

        // Navigate and ensure it still works
        await mainMenu.goto('en');
        await helpers.waitForFullLoad();
        await mainMenu.expectToBeVisible();

        // Reset network conditions
        await helpers.resetNetworkConditions();
    });
});
