import { test, expect } from '@playwright/test';
import {
    MainMenuPage,
    StoriesPage,
    TestHelpers,
    signInWithSharedCredentialsViaUI,
    signUpFreshUserViaUI,
} from './utils';

/**
 * User Journey E2E Tests
 *
 * These tests cover the core user flows through the application:
 * - Homepage to game flow
 * - Navigation (forward and back)
 * - Character setup flow
 * - Responsive design (mobile/tablet)
 *
 * UI element assertions and form validation should be in unit tests.
 */

test.describe('Core User Journey', () => {
    test.beforeEach(async ({ page }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
    });

    test('complete flow: homepage → stories → reader', async ({ page }) => {
        const mainMenu = new MainMenuPage(page);
        const stories = new StoriesPage(page);

        // Start at homepage
        await mainMenu.goto('en');
        await expect(page).toHaveTitle(/Main Menu - Game App/);
        await mainMenu.expectToBeVisible();

        // Navigate to stories
        await mainMenu.clickStartGame();
        await expect(page).toHaveURL('/en/stories');
        await stories.expectToBeVisible();

        // Navigate to story reader
        await stories.selectTrainAdventure();
        await expect(page).toHaveURL(/\/en\/reader\?story=train_adventure/);
    });

    test('browser back navigation works correctly', async ({ page }) => {
        // Navigate through the flow
        await page.goto('/en/');
        await page.click('#start-btn');
        await page.click('a[href*="/reader?story=train_adventure"]');

        // Go back to stories page
        await page.goBack();
        await expect(page).toHaveURL('/en/stories');

        // Go back to homepage
        await page.goBack();
        await expect(page).toHaveURL('/en/');
    });
});

test.describe('Character Setup Flow', () => {
    test('complete character setup journey', async ({ page }) => {
        await signUpFreshUserViaUI(page, {
            locale: 'en',
            emailPrefix: 'char-journey',
        });

        // Navigate to stories and select train adventure
        await page.goto('/en/stories');
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await expect(trainAdventureButton).toBeVisible();
        await trainAdventureButton.click();

        // Should reach the reader
        await expect(page).toHaveURL(/\/en\/reader\?story=train_adventure/);
        await expect(page.locator('#reader-container')).toBeVisible();
    });

    test('character name submission redirects to story page', async ({
        page,
    }) => {
        await signUpFreshUserViaUI(page, {
            locale: 'en',
            emailPrefix: 'char-submit',
        });

        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });

        // Fill in character name and submit
        await page.fill('input#character-name', 'Test Hero');
        await page.click('button[type="submit"]');

        // Should navigate to story page
        await page.waitForURL(/\/en\/story\/train_adventure\/?$/, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(/\/en\/story\/train_adventure\/?$/);
    });

    test('invalid story parameter redirects to stories page', async ({
        page,
    }) => {
        await signUpFreshUserViaUI(page, {
            locale: 'en',
            emailPrefix: 'invalid-story',
        });

        await page.goto('/en/story/setup?story=invalid_story');
        await expect(page).toHaveURL('/en/stories');
    });
});

test.describe('Responsive Design', () => {
    test('works on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });

        await page.goto('/en/');
        const helpers = new TestHelpers(page);
        await helpers.expectGlassmorphismContainer();

        // Navigation should still work
        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();
        await startButton.click();
        await expect(page).toHaveURL('/en/stories');
    });

    test('works on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });

        await page.goto('/en/');
        const helpers = new TestHelpers(page);
        await helpers.expectGlassmorphismContainer();

        const startButton = page.locator('#start-btn');
        await expect(startButton).toBeVisible();
    });
});
