import { test, expect } from '@playwright/test';
import { BookmarksPage } from './utils';

test.describe('Bookmarks page', () => {
    test('renders the page title and container (en)', async ({ page }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.goto();
        await bookmarks.expectToBeVisible();
    });

    test('renders the page title in zh', async ({ page }) => {
        const bookmarks = new BookmarksPage(page, 'zh');
        await bookmarks.goto();
        await bookmarks.expectToBeVisible();
    });

    test('shows the not-logged-in empty state with a login link', async ({
        page,
    }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.goto();
        // No local bookmarks seeded and not authenticated -> the manager
        // renders the not-logged-in card pointing at the login route.
        await expect(bookmarks.loginLink).toBeVisible();
        await expect(bookmarks.loginLink).toHaveAttribute('href', '/en/login');
    });

    test('renders a seeded local bookmark card', async ({ page }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.seedLocalBookmark({
            bookmarkName: 'E2E checkpoint',
            storyId: 'train_adventure',
            sceneId: 'scene_1',
        });
        await bookmarks.goto();

        await bookmarks.expectLocalSectionVisible();
        await expect(bookmarks.localBookmarkCards()).toHaveCount(1);
        await expect(
            bookmarks.localBookmarkCards().first().locator('h3')
        ).toContainText('E2E checkpoint');
    });

    test('shows a localized error banner when the cloud fetch fails (zh)', async ({
        page,
    }) => {
        const bookmarks = new BookmarksPage(page, 'zh');
        // Force the cloud bookmarks endpoint to return a 500 so the manager
        // falls into the catch branch and renders the error banner.
        await page.route('**/api/bookmarks', route =>
            route.fulfill({ status: 500 })
        );
        await bookmarks.goto();

        // zh error key — guards against the i18n regression where the banner
        // rendered the hardcoded English fetch error message.
        await expect(
            bookmarks.container.getByText('載入書籤失敗，請重試')
        ).toBeVisible();
    });

    test('shows an English error banner when the cloud fetch fails (en)', async ({
        page,
    }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await page.route('**/api/bookmarks', route =>
            route.fulfill({ status: 500 })
        );
        await bookmarks.goto();

        await expect(
            bookmarks.container.getByText(
                'Failed to load bookmarks. Please try again.'
            )
        ).toBeVisible();
    });
});
