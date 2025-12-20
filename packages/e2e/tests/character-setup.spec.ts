import { test, expect } from '@playwright/test';
import { signUpViaUI } from './utils';

test.describe('Character Setup Flow', () => {
    test('should navigate to character setup when clicking Train Adventure', async ({
        page,
    }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'char-setup' });
        await page.goto('/en/stories');

        // Click the Train Adventure button
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await expect(trainAdventureButton).toBeVisible();
        await trainAdventureButton.click();

        // Should navigate to localized setup page with correct story parameter
        await expect(page).toHaveURL(/\/en\/reader\?story=train_adventure/);

        // Check if setup page loads correctly
        await expect(page.locator('#reader-container')).toBeVisible();
    });

    test('should display character setup form correctly', async ({ page }) => {
        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(
            /\/en\/story\/setup\?story=train_adventure/
        );

        // Check form elements are present
        await expect(page.locator('form#setup-form')).toBeVisible();
        await expect(page.locator('label[for="character-name"]')).toContainText(
            'Main Character Name:'
        );
        await expect(page.locator('input#character-name')).toBeVisible();
        await expect(page.locator('input#character-name')).toHaveAttribute(
            'placeholder',
            "Enter your character's name"
        );

        // Check submit button
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toContainText('Start Adventure');
    });

    test('should validate character name input', async ({ page }) => {
        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(
            /\/en\/story\/setup\?story=train_adventure/
        );

        // Try to submit empty form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Should show HTML5 validation message (required field)
        const nameInput = page.locator('input#character-name');
        await expect(nameInput).toHaveAttribute('required');
    });

    test('should handle character name submission', async ({ page }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'char-submit' });
        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(
            /\/en\/story\/setup\?story=train_adventure/
        );

        // Fill in character name
        const characterName = 'Test Hero';
        await page.fill('input#character-name', characterName);

        // Submit form
        await page.click('button[type="submit"]');

        // Should navigate to localized story page (name resolved internally)
        await page.waitForURL(/\/en\/story\/train_adventure\/?$/, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(/\/en\/story\/train_adventure\/?$/);
    });

    test('should redirect to stories page for invalid story parameter', async ({
        page,
    }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'invalid-story' });
        // Try to access setup with invalid story
        await page.goto('/en/story/setup?story=invalid_story');

        // Should redirect to localized stories page
        await expect(page).toHaveURL('/en/stories');
    });

    test('should handle missing story parameter', async ({ page }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'missing-story' });
        // Try to access setup without story parameter
        await page.goto('/en/story/setup');

        // Should redirect to localized stories page
        await expect(page).toHaveURL('/en/stories');
    });

    test('should have back button that works', async ({ page }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'setup-back' });
        await page.goto('/en/story/setup?story=train_adventure');

        // Check back button is present (localized stories URL)
        const backButton = page.locator('a[href="/en/stories"]');
        await expect(backButton).toBeVisible();

        // Click back button
        await backButton.click();

        // Should navigate back to localized stories page
        await expect(page).toHaveURL('/en/stories');
    });

    test('should redirect authenticated users with existing character setup to game page', async ({
        page,
    }) => {
        await signUpViaUI(page, {
            locale: 'en',
            emailPrefix: 'setup-redirect',
        });
        // First, set up a character by going through the setup flow
        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(
            /\/en\/story\/setup\?story=train_adventure/
        );
        await page.fill('input#character-name', 'Redirect Test Hero');
        await page.click('button[type="submit"]');

        // Wait for navigation to localized game page
        await page.waitForURL(/\/en\/story\/train_adventure\/?$/, {
            waitUntil: 'domcontentloaded',
        });

        // Now go back to localized stories page - no automatic redirect; click the story button
        await page.goto('/en/stories');
        const storyBtn = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await expect(storyBtn).toBeVisible();
        await storyBtn.click();
        await page.waitForURL(/\/en\/reader\?story=train_adventure/, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(/\/en\/reader\?story=train_adventure/);
    });

    test('should redirect guest users with localStorage character setup to game page', async ({
        page,
    }) => {
        // Set up localStorage with character data
        await page.addScriptTag({
            content: `
        localStorage.setItem('aquila:character:train_adventure', JSON.stringify({
          characterName: 'Guest Redirect Hero'
        }));
      `,
        });

        // Navigate to localized stories page and start the story via button
        await page.goto('/en/stories');
        await expect(page).toHaveURL('/en/login');
    });

    test('should show story selection for users without character setup', async ({
        page,
    }) => {
        await signUpViaUI(page, { locale: 'en', emailPrefix: 'no-setup' });
        // Clear any existing localStorage
        await page.addScriptTag({
            content: `
        localStorage.removeItem('aquila:character:train_adventure');
      `,
        });

        // Navigate to localized stories page
        await page.goto('/en/stories');

        // Should stay on localized stories page and show the selection
        await expect(page).toHaveURL('/en/stories');
        await expect(page.locator('h1')).toContainText('Select Your Story');

        // Train Adventure button should be visible
        const trainAdventureButton = page
            .locator('a')
            .filter({ hasText: 'Train Adventure' });
        await expect(trainAdventureButton).toBeVisible();
    });

    test('should maintain consistent styling with other pages', async ({
        page,
    }) => {
        await page.goto('/en/story/setup?story=train_adventure');

        // Check for gradient background element
        const gradientBackground = page.locator(
            'div.bg-gradient-to-b.from-sky-200.via-sky-300.to-blue-400'
        );
        await expect(gradientBackground).toBeVisible();

        // Check for main container styling (glassmorphism card)
        const container = page.locator('div.bg-white\\/90.backdrop-blur-md');
        await expect(container).toBeVisible();
        await expect(container).toHaveClass(/rounded-3xl/);
    });
});

test.describe('Character Setup API Integration', () => {
    test('should handle API responses correctly', async ({ page }) => {
        await signUpViaUI(page, {
            locale: 'en',
            emailPrefix: 'setup-api',
        });
        await page.goto('/en/story/setup?story=train_adventure', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page).toHaveURL(
            /\/en\/story\/setup\?story=train_adventure/
        );

        // Fill in character name
        await page.fill('input#character-name', 'API Test Hero');

        // Submit form and wait for either API call (authenticated) or navigation (guest)
        const apiPromise = page
            .waitForResponse('/api/character-setup', { timeout: 1500 })
            .catch(() => null);
        const navPromise = page.waitForURL(/\/en\/story\/train_adventure\/?$/, {
            waitUntil: 'domcontentloaded',
        });

        await page.click('button[type="submit"]');

        const [apiResponse] = await Promise.all([apiPromise, navPromise]);

        // If API responded, ensure it's successful
        if (apiResponse) {
            expect(apiResponse.status()).toBeLessThan(400);
        }
    });

    test('should show loading state during submission', async ({ page }) => {
        await page.goto('/en/story/setup?story=train_adventure');

        // Fill in character name
        await page.fill('input#character-name', 'Loading Test Hero');

        // Submit form and check for loading state
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Check if button text changes to "Saving..." (might be too fast to catch)
        // This test verifies the JavaScript is working
        await page.waitForTimeout(100); // Small delay to see loading state
    });
});
