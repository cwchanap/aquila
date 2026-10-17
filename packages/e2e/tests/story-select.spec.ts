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

    test('opens a quick read as text when Visual Novel mode was last used', async ({
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
        await expect(page.getByTestId('visual-novel-reader')).toHaveCount(0);
        await expect(page.getByTestId('visual-status')).toHaveCount(0);
        expect(
            await page.evaluate(() =>
                localStorage.getItem('aquila:reader-mode:v1')
            )
        ).toBe('visual');
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
