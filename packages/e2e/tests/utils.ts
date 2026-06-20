import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const uniqueEmail = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

export class MainMenuPage {
    constructor(
        private page: Page,
        private locale: 'en' | 'zh' = 'en'
    ) {}

    private get menuHeading() {
        const headings = {
            en: 'Main Menu',
            zh: '主選單',
        };
        return headings[this.locale];
    }

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
        await expect(this.heading).toContainText(this.menuHeading);
        await expect(this.startButton).toBeVisible();
    }
}

export class StoriesPage {
    constructor(
        private page: Page,
        private locale: 'en' | 'zh' = 'en'
    ) {}

    private get trainAdventureText() {
        const storyNames = {
            en: 'Train Adventure',
            zh: '火車冒險',
        };
        return storyNames[this.locale];
    }

    private get storiesHeading() {
        const headings = {
            en: 'Select Your Story',
            zh: '選擇您的故事',
        };
        return headings[this.locale];
    }

    get heading() {
        return this.page.locator('body h1').first();
    }

    get trainAdventureLink() {
        return this.page.getByRole('link', { name: this.trainAdventureText });
    }

    async goto() {
        await this.page.goto(`/${this.locale}/stories`);
    }

    async selectTrainAdventure() {
        await this.trainAdventureLink.click();
    }

    async expectToBeVisible() {
        await expect(this.heading).toContainText(this.storiesHeading);
        await expect(this.trainAdventureLink).toBeVisible();
    }
}

export class MobileReaderPage {
    constructor(
        private page: Page,
        private locale: 'en' | 'zh' = 'en'
    ) {}

    private get actsHeading() {
        const headings = { en: 'Acts', zh: '章節' };
        return headings[this.locale];
    }

    private get historyHeading() {
        const headings = { en: 'History', zh: '歷史' };
        return headings[this.locale];
    }

    get tapLayer() {
        return this.page.getByLabel('Tap to continue');
    }

    get menuButton() {
        return this.page.getByLabel('Open menu');
    }

    get actsButton() {
        return this.page.getByLabel('Open acts panel');
    }

    get historyButton() {
        return this.page.getByLabel('Open history');
    }

    get backToHomeLink() {
        return this.page.getByRole('link', { name: /Back to Home/i });
    }

    get actsHeadingLocator() {
        return this.page.getByRole('heading', { name: this.actsHeading });
    }

    get historyHeadingLocator() {
        return this.page.getByRole('heading', { name: this.historyHeading });
    }

    async goto() {
        await this.page.goto(`/${this.locale}/reader`);
    }

    async openMenu() {
        await this.menuButton.click();
    }

    async openActs() {
        await this.actsButton.click();
    }

    async openHistory() {
        await this.historyButton.click();
    }

    async tapToAdvance(times = 1) {
        for (let i = 0; i < times; i++) {
            await this.tapLayer.click();
        }
    }
}
