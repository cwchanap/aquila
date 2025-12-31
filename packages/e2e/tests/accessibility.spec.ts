import { test, expect } from '@playwright/test';
import { signInWithSharedCredentialsViaUI } from './utils';

/**
 * Accessibility E2E Tests
 *
 * These tests verify basic accessibility requirements that must work
 * in a real browser environment. Detailed ARIA attribute testing
 * should be done in unit/component tests.
 */

test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
        await page.goto('/en/');
    });

    test('main menu has proper heading and accessible buttons', async ({
        page,
    }) => {
        // Check heading structure
        const h1 = page.locator('body h1').first();
        await expect(h1).toBeVisible();
        await expect(h1).toContainText('Main Menu');

        // Check buttons are accessible
        const startButton = page.locator('#start-btn');
        const settingsButton = page.locator('#settings-btn');
        await expect(startButton).toHaveAccessibleName('Start Game');
        await expect(settingsButton).toHaveAccessibleName('Settings');
    });

    test('keyboard navigation works for main actions', async ({
        page,
        browserName,
    }) => {
        // Skip on WebKit due to different tab behavior
        if (browserName === 'webkit') {
            test.skip(
                true,
                'WebKit has different keyboard navigation behavior'
            );
            return;
        }

        const startButton = page.locator('#start-btn');

        // Tab to start button and verify it can be focused
        let startFocused = false;
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Tab');
            startFocused = await startButton.evaluate(el =>
                el.matches(':focus')
            );
            if (startFocused) break;
        }
        expect(startFocused).toBe(true);

        // Enter should activate navigation
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL('/en/stories');
    });
});
