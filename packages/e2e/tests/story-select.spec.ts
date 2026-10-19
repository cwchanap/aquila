import { expect, test } from '@playwright/test';
import { ReaderPage, StoriesPage } from './utils';

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

    test('opens a quick read with its artwork when Visual Novel mode was last used', async ({
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
        await expect(page.getByTestId('visual-novel-reader')).toHaveAttribute(
            'data-visual-release-state',
            'ready'
        );
        await expect(page.locator('[data-bg-layer="active"]')).toHaveAttribute(
            'data-bg-state',
            'ready'
        );
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
        ).toHaveAttribute('href', '/en/reader?story=the_seventh_mirror');
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
