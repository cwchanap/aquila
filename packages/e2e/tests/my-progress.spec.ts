import { expect, test, type Page } from '@playwright/test';

const PROGRESS_KEY = 'aquila:storyProgress:v1';

function seedSignedOutProgress(page: Page) {
    return page.addInitScript(key => {
        const now = Date.now();
        localStorage.setItem(
            key,
            JSON.stringify({
                the_seventh_mirror: {
                    sceneId: 'ch2_act1',
                    dialogueIndex: 0,
                    updatedAt: now - 2 * 60 * 60 * 1000,
                    finished: false,
                    endings: [],
                },
                elevator_game: {
                    sceneId: 'b1a_act4',
                    dialogueIndex: 9,
                    updatedAt: now - 24 * 60 * 60 * 1000,
                    finished: true,
                    endings: ['b1a_act4'],
                },
            })
        );
    }, PROGRESS_KEY);
}

function watchProgressApi(page: Page): string[] {
    const calls: string[] = [];
    page.on('request', request => {
        if (request.url().includes('/api/progress')) {
            calls.push(request.url());
        }
    });
    return calls;
}

test.describe('My Progress signed out', () => {
    test('shows the empty local view with a sign-in tip and no cloud calls', async ({
        page,
    }) => {
        const apiCalls = watchProgressApi(page);
        await page.goto('/en/progress');

        await expect(
            page.getByRole('heading', { name: 'My Progress' })
        ).toBeVisible();
        const saveCard = page.getByTestId('save-card');
        await expect(saveCard).toContainText('Saved in this browser only');
        await expect(
            saveCard.getByRole('link', { name: 'Sign in' })
        ).toHaveAttribute('href', '/en/login');

        await expect(
            page.getByRole('heading', { name: 'Nothing read yet' })
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Browse stories' })
        ).toHaveAttribute('href', '/en/stories');
        await expect(page.getByTestId('count-started')).toHaveCount(0);
        await expect(
            page.getByRole('link', { name: 'Go back to the previous page' })
        ).toHaveAttribute('href', '/en/');
        expect(apiCalls).toEqual([]);
    });

    test('lists saved places most recent first with counts, statuses and actions', async ({
        page,
    }) => {
        await seedSignedOutProgress(page);
        const apiCalls = watchProgressApi(page);
        await page.goto('/en/progress');

        const saveCard = page.getByTestId('save-card');
        await expect(saveCard).toContainText('Saved in this browser only');
        await expect(
            saveCard.getByRole('link', { name: 'Sign in' })
        ).toHaveAttribute('href', '/en/login');

        await expect(page.getByTestId('count-started')).toContainText('2');
        await expect(page.getByTestId('count-started')).toContainText('/ 8');
        await expect(page.getByTestId('count-finished')).toContainText('1');
        await expect(page.getByTestId('count-endings')).toContainText('1');
        await expect(page.getByTestId('count-endings')).toContainText('/ 43');

        await expect(
            page.getByRole('heading', { name: 'Your stories' })
        ).toBeVisible();
        await expect(page.getByText('Most recent first')).toBeVisible();

        const rows = page.locator('a[data-story-id]');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toHaveAttribute(
            'data-story-id',
            'the_seventh_mirror'
        );
        await expect(rows.nth(1)).toHaveAttribute(
            'data-story-id',
            'elevator_game'
        );

        const mirror = rows.nth(0);
        await expect(mirror).toContainText('The Seventh Mirror');
        await expect(mirror).toContainText('Chapter 2 of 28');
        await expect(mirror).toContainText('Last read 2 hours ago');
        await expect(mirror).toContainText('Continue');
        await expect(mirror).toHaveAttribute(
            'href',
            '/en/reader?story=the_seventh_mirror&scene=ch2_act1&dialogue=1'
        );

        const elevator = rows.nth(1);
        await expect(elevator).toContainText('The Elevator Game');
        await expect(elevator).toContainText('1 of 2 endings');
        await expect(elevator).toContainText('Last read yesterday');
        await expect(elevator).toContainText('Read again');
        await expect(elevator).toHaveAttribute(
            'href',
            '/en/reader?story=elevator_game&restart=1'
        );

        const browse = page.getByTestId('browse-stories');
        await expect(browse).toContainText('6 stories not started yet');
        await expect(browse).toHaveAttribute('href', '/en/stories');
        expect(apiCalls).toEqual([]);
    });

    test('continues a saved place from its row link', async ({ page }) => {
        await seedSignedOutProgress(page);
        await page.goto('/en/progress');

        await page.locator('a[data-story-id="the_seventh_mirror"]').click();
        await expect(page).toHaveURL(
            /\/en\/reader\?story=the_seventh_mirror&scene=ch2_act1&dialogue=1/
        );
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 30_000,
        });
    });

    test('restarts a finished story from its row link', async ({ page }) => {
        await seedSignedOutProgress(page);
        await page.goto('/en/progress');

        await page.locator('a[data-story-id="elevator_game"]').click();
        await expect(page).toHaveURL(
            /\/en\/reader\?story=elevator_game&restart=1/
        );
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 30_000,
        });
    });

    test('opens story selection from the browse link', async ({ page }) => {
        await seedSignedOutProgress(page);
        await page.goto('/en/progress');

        await page.getByTestId('browse-stories').click();
        await expect(page).toHaveURL('/en/stories');
        await expect(
            page.getByRole('heading', { name: 'Select Your Story' })
        ).toBeVisible();
    });

    test('omits the last-read label for records without a real read time', async ({
        page,
    }) => {
        await page.addInitScript(key => {
            localStorage.setItem(
                key,
                JSON.stringify({
                    train_adventure: {
                        sceneId: 'act2',
                        dialogueIndex: 4,
                        updatedAt: 0,
                        finished: false,
                        endings: [],
                    },
                })
            );
        }, PROGRESS_KEY);
        await page.goto('/en/progress');

        const row = page.locator('a[data-story-id="train_adventure"]');
        await expect(row).toHaveAttribute(
            'href',
            '/en/reader?story=train_adventure&scene=act2&dialogue=5'
        );
        await expect(row).not.toContainText('Last read');
    });

    test('keeps a finished story counted after it is restarted', async ({
        page,
    }) => {
        await page.addInitScript(key => {
            localStorage.setItem(
                key,
                JSON.stringify({
                    elevator_game: {
                        sceneId: 'a1_act1',
                        dialogueIndex: 0,
                        updatedAt: Date.now() - 60 * 60 * 1000,
                        finished: false,
                        endings: ['b1a_act4'],
                    },
                })
            );
        }, PROGRESS_KEY);
        await page.goto('/en/progress');

        await expect(page.getByTestId('count-finished')).toContainText('1');
        await expect(page.getByTestId('count-endings')).toContainText('1');
        const row = page.locator('a[data-story-id="elevator_game"]');
        await expect(row).toContainText('1 of 2 endings');
        await expect(row).toContainText('Continue');
        await expect(row).toHaveAttribute(
            'href',
            '/en/reader?story=elevator_game&scene=a1_act1&dialogue=1'
        );
    });
});

test.describe('My Progress localized', () => {
    test('renders the populated view in Chinese', async ({ page }) => {
        await seedSignedOutProgress(page);
        await page.goto('/zh/progress');

        await expect(
            page.getByRole('heading', { name: '我的進度' })
        ).toBeVisible();
        const saveCard = page.getByTestId('save-card');
        await expect(saveCard).toContainText('僅儲存在此瀏覽器');
        await expect(
            saveCard.getByRole('link', { name: '登入' })
        ).toHaveAttribute('href', '/zh/login');

        const mirror = page.locator('a[data-story-id="the_seventh_mirror"]');
        await expect(mirror).toContainText('神鏡七日');
        await expect(mirror).toContainText('第 2 章，共 28 章');
        await expect(mirror).toContainText('小時前');
        await expect(mirror).toContainText('繼續');
        await expect(mirror).toHaveAttribute(
            'href',
            '/zh/reader?story=the_seventh_mirror&scene=ch2_act1&dialogue=1'
        );

        const browse = page.getByTestId('browse-stories');
        await expect(browse).toContainText('還有 6 個故事未開始');
        await expect(browse).toHaveAttribute('href', '/zh/stories');
    });

    test('renders the empty view in Japanese', async ({ page }) => {
        await page.goto('/ja/progress');

        await expect(
            page.getByRole('heading', { name: 'マイプログレス' })
        ).toBeVisible();
        const saveCard = page.getByTestId('save-card');
        await expect(saveCard).toContainText('このブラウザにのみ保存');
        await expect(
            saveCard.getByRole('link', { name: 'ログイン' })
        ).toHaveAttribute('href', '/ja/login');
        await expect(
            page.getByRole('heading', { name: 'まだ読んでいません' })
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: '物語を探す' })
        ).toHaveAttribute('href', '/ja/stories');
    });
});

test.describe('Retired routes', () => {
    test('the removed character-setup route returns 404', async ({ page }) => {
        const response = await page.goto('/en/characters');
        expect(response?.status()).toBe(404);
    });
});
