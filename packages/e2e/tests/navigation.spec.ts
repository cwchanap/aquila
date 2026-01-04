import { test, expect } from '@playwright/test';
import { MainMenuPage, StoriesPage } from './utils';

test.describe('Game Flow', () => {
    test('should start a story from the main menu', async ({ page }) => {
        const mainMenu = new MainMenuPage(page);
        const stories = new StoriesPage(page);

        await mainMenu.goto();
        await mainMenu.expectToBeVisible();
        await mainMenu.clickStartGame();

        await expect(page).toHaveURL('/en/stories');
        await stories.expectToBeVisible();
        await stories.selectTrainAdventure();

        await expect(page).toHaveURL(/\/en\/reader/);
        await expect(page.locator('#reader-container')).toBeVisible();
    });
});
