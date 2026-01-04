import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const uniqueEmail = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

export class MainMenuPage {
    constructor(
        private page: Page,
        private locale: 'en' | 'zh' = 'en'
    ) {}

    get startButton() {
        return this.page.locator('#start-btn');
    }

    get heading() {
        return this.page.locator('body h1').first();
    }

    async goto() {
        await this.page.goto(`/${this.locale}/`);
    }

    async clickStartGame() {
        await this.startButton.click();
    }

    async expectToBeVisible() {
        await expect(this.heading).toContainText('Main Menu');
        await expect(this.startButton).toBeVisible();
    }
}

export class StoriesPage {
    constructor(
        private page: Page,
        private locale: 'en' | 'zh' = 'en'
    ) {}

    get heading() {
        return this.page.locator('body h1').first();
    }

    get trainAdventureLink() {
        return this.page.getByRole('link', { name: 'Train Adventure' });
    }

    async goto() {
        await this.page.goto(`/${this.locale}/stories`);
    }

    async selectTrainAdventure() {
        await this.trainAdventureLink.click();
    }

    async expectToBeVisible() {
        await expect(this.heading).toContainText('Select Your Story');
        await expect(this.trainAdventureLink).toBeVisible();
    }
}
