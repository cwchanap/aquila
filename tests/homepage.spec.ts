import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load and display main menu', async ({ page }) => {
    await page.goto('/');

    // Check if the page loads successfully
    await expect(page).toHaveTitle(/Main Menu - Game App/);

    // Check if main menu heading is visible
    await expect(page.locator('body h1').first()).toContainText('Main Menu');

    // Check if Start Game button is visible and functional
    const startButton = page.locator('#start-btn');
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText('Start Game');

    // Check if Settings button is visible
    const settingsButton = page.locator('#settings-btn');
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toContainText('Settings');
  });

  test('should have proper styling and responsive design', async ({ page }) => {
    await page.goto('/');

    // Check if the page has the gradient background
    const mainDiv = page.locator('div.min-h-screen');
    await expect(mainDiv).toHaveClass(/bg-gradient-to-br/);

    // Check if buttons have hover effects
    const startButton = page.locator('#start-btn');
    await expect(startButton).toHaveClass(/hover:bg-white\/30/);
  });

  test('should navigate to stories page when Start Game is clicked', async ({ page }) => {
    await page.goto('/');

    // Click the Start Game button
    await page.click('#start-btn');

    // Wait for navigation and check URL
    await expect(page).toHaveURL('/stories');
  });

  test('should handle settings button click', async ({ page }) => {
    await page.goto('/');

    // Set up console listener to catch the log message
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Click the Settings button
    await page.click('#settings-btn');

    // Check if console message was logged
    await page.waitForTimeout(100); // Small delay to ensure console log is captured
    expect(consoleMessages).toContain('Settings button clicked!');
  });
});
