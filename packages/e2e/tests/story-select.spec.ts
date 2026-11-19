import { expect, test } from '@playwright/test';
import { MainMenuPage, ReaderPage, StoriesPage } from './utils';

const PROGRESS_KEY = 'aquila:storyProgress:v1';

test.describe('Story select shelves', () => {
    test('separates quick reads from sagas and shows their length', async ({
        page,
    }) => {
        const stories = new StoriesPage(page);
        await stories.goto();
        await stories.expectToBeVisible();

        await expect(stories.quickReadLinks).toHaveCount(5);
        await expect(stories.sagaLinks).toHaveCount(3);
        for (const link of await stories.quickReadLinks.all()) {
            await expect(link).toContainText(/\d+ min/);
        }
        await expect(
            stories.sagas.getByRole('link', { name: 'The Seventh Mirror' })
        ).toContainText('28 chapters');
        await expect(stories.continueReading).toHaveCount(0);
    });

    test('opens a short story in English from its card', async ({ page }) => {
        const stories = new StoriesPage(page);
        const reader = new ReaderPage(page);
        await stories.goto();
        await stories.quickReads
            .getByRole('link', { name: 'The Elevator Game' })
            .click();

        await expect(page).toHaveURL(/\/en\/reader\?story=elevator_game/);
        await expect(reader.ready).toBeVisible();
        await expect(
            reader.ready.locator('[data-story-id="elevator_game"]')
        ).toBeVisible();
        await expect(reader.ready).not.toContainText(/[一-鿿]{4}/);
    });

    test('opens a quick read in Visual Novel mode when it was last used', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        const stories = new StoriesPage(page);
        const reader = new ReaderPage(page);
        await stories.goto();
        await stories.quickReads
            .getByRole('link', { name: 'Day 4,012' })
            .click();

        await expect(
            reader.ready.locator('[data-story-id="day_4012"]')
        ).toBeVisible();
        await expect(page.getByTestId('visual-novel-reader')).toBeVisible();
        expect(
            await page.evaluate(() =>
                localStorage.getItem('aquila:reader-mode:v1')
            )
        ).toBe('visual');
    });

    test('continues a saga saved before per-story progress existed', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            if (localStorage.getItem('aquila:storyProgress:v1')) return;
            localStorage.setItem(
                'aquila:readerState:en',
                JSON.stringify({
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch1_act2',
                    dialogueIndex: 2,
                    locale: 'en',
                    version: 2,
                })
            );
        });
        const stories = new StoriesPage(page);
        const reader = new ReaderPage(page);
        await stories.goto();

        const resume =
            '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=3';
        await expect(stories.continueReading).toHaveAttribute('href', resume);
        await expect(
            stories.sagas.getByRole('link', {
                name: 'The Seventh Mirror',
                exact: true,
            })
        ).toHaveAttribute('href', resume);

        await stories.continueReading.click();
        await expect(page).toHaveURL(/scene=ch1_act2&dialogue=3/);
        await expect(reader.ready).toBeVisible();
    });

    test('keeps a saga bookmark after reading a short story', async ({
        page,
    }) => {
        await page.addInitScript(key => {
            if (localStorage.getItem(key)) return;
            localStorage.setItem(
                key,
                JSON.stringify({
                    the_seventh_mirror: {
                        sceneId: 'ch1_act2',
                        dialogueIndex: 2,
                        updatedAt: 1,
                        finished: false,
                        endings: [],
                    },
                })
            );
        }, PROGRESS_KEY);

        const stories = new StoriesPage(page);
        const reader = new ReaderPage(page);
        await stories.goto();
        await expect(stories.continueReading).toContainText(
            'The Seventh Mirror'
        );
        await expect(stories.continueReading).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=3'
        );

        await stories.quickReads
            .getByRole('link', { name: 'The 3 A.M. Laundromat' })
            .click();
        await expect(
            reader.ready.locator('[data-story-id="three_am_laundromat"]')
        ).toBeVisible();

        await stories.goto();
        await expect(stories.continueReading).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=3'
        );
        await expect(
            stories.quickReads.getByRole('link', {
                name: 'The 3 A.M. Laundromat',
            })
        ).toHaveAttribute('href', /scene=act1&dialogue=1/);
        await expect(
            stories.sagas.getByTestId('start-over-the_seventh_mirror')
        ).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&restart=1'
        );
    });
});

test.describe('Main menu', () => {
    test('opens the collapsed language switcher with the keyboard and saves the choice', async ({
        page,
    }) => {
        await page.goto('/en/');
        const switcher = page.locator(
            'summary[aria-label="English — Choose language"]'
        );
        const japanese = page.getByRole('link', { name: '日本語' });
        await expect(switcher).toHaveText('English');
        await expect(
            switcher.locator('xpath=ancestor::astro-island')
        ).not.toHaveAttribute('ssr');
        await expect(japanese).toBeHidden();
        await switcher.focus();
        await page.keyboard.press('Enter');
        await expect(japanese).toBeVisible();
        await expect(japanese).toHaveAttribute('href', '/ja/');
        await japanese.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL('/ja/');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('aquila:language'))
            )
            .toBe('ja');
        const japaneseSwitcher = page.locator(
            'summary[aria-label="日本語 — 言語を選択"]'
        );
        await expect(japaneseSwitcher).toHaveText('日本語');
        await expect(
            japaneseSwitcher.locator('xpath=ancestor::astro-island')
        ).not.toHaveAttribute('ssr');
        await japaneseSwitcher.click();
        await page.getByRole('link', { name: '中文' }).click();
        await expect(page).toHaveURL('/zh/');
        await expect(
            page.locator('summary[aria-label="中文 — 選擇語言"]')
        ).toHaveText('中文');
    });

    test('orders Start Game, My Progress, Bookmarks with no inert Settings', async ({
        page,
    }) => {
        const menu = new MainMenuPage(page);
        await menu.goto();
        await menu.expectToBeVisible();

        const start = page.getByRole('link', { name: 'Start Game' });
        const progress = page.getByRole('link', { name: 'My Progress' });
        const bookmarks = page.getByRole('button', { name: 'Bookmarks' });
        await expect(start).toHaveAttribute('href', '/en/stories');
        await expect(progress).toHaveAttribute('href', '/en/progress');
        await expect(bookmarks).toBeVisible();
        const actions = page.locator('#start-btn').locator('..');
        await expect(actions.locator(':scope > *')).toHaveCount(3);
        await expect(actions.getByRole('button')).toHaveCount(1);
        await expect(page.locator('a[href$="/characters"]')).toHaveCount(0);

        const startBox = await start.boundingBox();
        const progressBox = await progress.boundingBox();
        const bookmarksBox = await bookmarks.boundingBox();
        expect(startBox).not.toBeNull();
        expect(progressBox).not.toBeNull();
        expect(bookmarksBox).not.toBeNull();
        expect(startBox!.y).toBeLessThan(progressBox!.y);
        expect(progressBox!.y).toBeLessThan(bookmarksBox!.y);

        await progress.click();
        await expect(page).toHaveURL('/en/progress');
        await expect(
            page.getByRole('heading', { name: 'My Progress' })
        ).toBeVisible();
    });

    test('opens the localized progress page from the Chinese menu', async ({
        page,
    }) => {
        const menu = new MainMenuPage(page, 'zh');
        await menu.goto();
        await menu.expectToBeVisible();

        const progress = page.getByRole('link', { name: '我的進度' });
        await expect(progress).toHaveAttribute('href', '/zh/progress');
        await progress.click();
        await expect(page).toHaveURL('/zh/progress');
        await expect(
            page.getByRole('heading', { name: '我的進度' })
        ).toBeVisible();
    });
});

test.describe('Story select in Japanese', () => {
    test('reads a short story in Japanese and tags sagas as Chinese only', async ({
        page,
    }) => {
        const stories = new StoriesPage(page, 'ja');
        const reader = new ReaderPage(page);
        await stories.goto();
        await stories.expectToBeVisible();

        await expect(
            stories.sagas.getByRole('link', { name: '神鏡七日' })
        ).toBeVisible();
        await expect(
            page.getByTestId('language-note-the_seventh_mirror')
        ).toHaveText('中国語のみ');
        await expect(
            page.getByTestId('language-note-elevator_game')
        ).toHaveCount(0);

        await stories.quickReads
            .getByRole('link', { name: 'エレベーターゲーム' })
            .click();
        await expect(page).toHaveURL(/\/ja\/reader\?story=elevator_game/);
        await expect(reader.ready).toBeVisible();
        await expect(reader.ready).toContainText(/[ぁ-ん]/);
        // Japanese text carries furigana by default.
        await expect(reader.ready.locator('ruby rt').first()).toBeAttached();
    });
});
