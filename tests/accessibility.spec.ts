import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Check for proper heading hierarchy
    const h1 = page.locator('body h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Main Menu');
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/');

    // Check if buttons are accessible
    const startButton = page.locator('#start-btn');
    const settingsButton = page.locator('#settings-btn');

    // Check if buttons have proper text content (accessible to screen readers)
    await expect(startButton).toHaveAccessibleName('Start Game');
    await expect(settingsButton).toHaveAccessibleName('Settings');

    // Check if buttons are keyboard accessible
    await startButton.focus();
    await expect(startButton).toBeFocused();

    await settingsButton.focus();
    await expect(settingsButton).toBeFocused();
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for viewport meta tag
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', 'width=device-width');

    // Check for charset
    const charsetMeta = page.locator('meta[charset]');
    await expect(charsetMeta).toHaveAttribute('charset', 'utf-8');

    // Check for favicon
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', '/favicon.svg');
  });

  test('should support keyboard navigation', async ({ page, browserName }) => {
    await page.goto('/');

    // Skip keyboard test on WebKit (Safari) as it has different tab behavior
    if (browserName === 'webkit') {
      test.skip(true, 'WebKit has different keyboard navigation behavior');
      return;
    }

    // Tab through the interface
    await page.keyboard.press('Tab');
    await expect(page.locator('#start-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#settings-btn')).toBeFocused();

    // Test Enter key activation
    await page.keyboard.press('Enter');
    
    // Should trigger the settings button click (console log)
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    await page.waitForTimeout(100);
  });
});

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds (adjust as needed)
    expect(loadTime).toBeLessThan(3000);

    // Check if main content is visible
    await expect(page.locator('body h1').first()).toBeVisible();
  });

  test('should have no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait a bit to catch any async errors
    await page.waitForTimeout(1000);

    // Should have no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});
