import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Common test utilities for the Aquila app
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a page and wait for it to load completely
   */
  async navigateAndWait(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if the page has the expected gradient background
   */
  async expectGradientBackground() {
    const mainDiv = this.page.locator('div.min-h-screen');
    await expect(mainDiv).toHaveClass(/bg-gradient-to-br/);
    await expect(mainDiv).toHaveClass(/from-blue-500/);
    await expect(mainDiv).toHaveClass(/to-green-500/);
  }

  /**
   * Check if the glassmorphism container is present
   */
  async expectGlassmorphismContainer() {
    const container = this.page.locator('div.bg-white\\/10');
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/backdrop-blur-sm/);
    await expect(container).toHaveClass(/rounded-2xl/);
  }

  /**
   * Wait for any loading states to complete
   */
  async waitForFullLoad() {
    await this.page.waitForLoadState('load');
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for a specific element instead of networkidle to be more reliable
    await this.page.waitForSelector('body', { state: 'visible' });
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Check for console errors and warnings
   */
  async getConsoleMessages() {
    const messages: { type: string; text: string }[] = [];
    
    this.page.on('console', msg => {
      messages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    return messages;
  }

  /**
   * Simulate slow network conditions (Chromium only)
   */
  async simulateSlowNetwork() {
    // Only works with Chromium
    if (this.page.context().browser()?.browserType().name() === 'chromium') {
      const client = await this.page.context().newCDPSession(this.page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 500 * 1024 / 8, // 500kb/s
        uploadThroughput: 500 * 1024 / 8,
        latency: 100
      });
    }
  }

  /**
   * Reset network conditions to default (Chromium only)
   */
  async resetNetworkConditions() {
    // Only works with Chromium
    if (this.page.context().browser()?.browserType().name() === 'chromium') {
      const client = await this.page.context().newCDPSession(this.page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0
      });
    }
  }
}

/**
 * Page Object Model for Main Menu
 */
export class MainMenuPage {
  constructor(private page: Page) {}

  // Locators
  get startButton() { return this.page.locator('#start-btn'); }
  get settingsButton() { return this.page.locator('#settings-btn'); }
  get heading() { return this.page.locator('body h1').first(); }

  // Actions
  async goto() {
    await this.page.goto('/');
  }

  async clickStartGame() {
    await this.startButton.click();
  }

  async clickSettings() {
    await this.settingsButton.click();
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.heading).toContainText('Main Menu');
    await expect(this.startButton).toBeVisible();
    await expect(this.settingsButton).toBeVisible();
  }
}

/**
 * Page Object Model for Stories Page
 */
export class StoriesPage {
  constructor(private page: Page) {}

  // Locators
  get heading() { return this.page.locator('body h1').first(); }
  get trainAdventureButton() {
    return this.page.locator('a').filter({ hasText: 'Train Adventure' });
  }

  // Actions
  async goto() {
    await this.page.goto('/stories');
  }

  async selectTrainAdventure() {
    await this.trainAdventureButton.click();
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.heading).toContainText('Select Your Story');
    await expect(this.trainAdventureButton).toBeVisible();
  }
}
