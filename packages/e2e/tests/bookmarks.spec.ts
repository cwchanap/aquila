import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BookmarksPage } from './utils';

type SsrAuthState = 'signed-in' | 'signed-out' | 'unavailable';

/** Rewrites the server-rendered auth state on the bookmarks document so the
 *  client's signed-in/unavailable branches are reachable without an OAuth
 *  session. */
async function useSsrAuthState(page: Page, authState: SsrAuthState) {
    await page.route(
        url =>
            url.pathname.endsWith('/bookmarks') &&
            !url.pathname.startsWith('/api/'),
        async route => {
            const response = await route.fetch();
            const html = await response.text();
            await route.fulfill({
                response,
                body: html.replace(
                    /data-auth-state="[^"]*"/,
                    `data-auth-state="${authState}"`
                ),
            });
        }
    );
}

test.describe('Bookmarks page', () => {
    test('server-renders loading text and auth state before hydration', async ({
        request,
    }) => {
        const response = await request.get('/en/bookmarks');
        const html = await response.text();

        expect(html).toContain('Loading bookmarks...');
        expect(html).toMatch(
            /data-auth-state="(signed-in|signed-out|unavailable)"/
        );
    });

    test('replaces the server loading text on mount', async ({ page }) => {
        await useSsrAuthState(page, 'signed-out');
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.goto();

        await expect(bookmarks.loginLink).toBeVisible();
        await expect(bookmarks.container).not.toContainText(
            'Loading bookmarks...'
        );
    });

    test('skips the cloud request for a known signed-out visitor', async ({
        page,
    }) => {
        await useSsrAuthState(page, 'signed-out');
        const cloudRequests: string[] = [];
        page.on('request', request => {
            if (new URL(request.url()).pathname === '/api/bookmarks') {
                cloudRequests.push(request.url());
            }
        });
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.goto();

        await expect(bookmarks.loginLink).toBeVisible();
        expect(cloudRequests).toHaveLength(0);
    });

    test('shows local cards and a cloud loading label before a signed-in response', async ({
        page,
    }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.seedLocalBookmark({
            bookmarkName: 'E2E checkpoint',
            storyId: 'train_adventure',
            sceneId: 'scene_1',
        });
        await useSsrAuthState(page, 'signed-in');

        let releaseCloud!: () => void;
        const cloudGate = new Promise<void>(resolve => {
            releaseCloud = resolve;
        });
        await page.route('**/api/bookmarks', async route => {
            await cloudGate;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '[]',
            });
        });

        await bookmarks.goto();
        await expect(bookmarks.localBookmarkCards()).toHaveCount(1);
        await expect(
            bookmarks.container.getByText('Loading bookmarks...')
        ).toBeVisible();
        await expect(
            bookmarks.container.getByText('No bookmarks yet.')
        ).toHaveCount(0);
        await expect(
            bookmarks.container.getByRole('button', { name: 'Sync to Cloud' })
        ).toHaveCount(0);
        await expect(
            bookmarks.container.getByRole('button', {
                name: 'Sync All to Cloud',
            })
        ).toHaveCount(0);

        releaseCloud();
        await expect(
            bookmarks.container.getByText('No bookmarks yet.')
        ).toBeVisible();
        await expect(
            bookmarks.container.getByText('Loading bookmarks...')
        ).toHaveCount(0);
        await expect(
            bookmarks.container.getByRole('button', { name: 'Sync to Cloud' })
        ).toHaveCount(1);
    });

    test('renders the page title and container (en)', async ({ page }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.goto();
        await bookmarks.expectToBeVisible();
        await expect(page).toHaveTitle('My Bookmarks');
    });

    test('renders the page title in zh', async ({ page }) => {
        const bookmarks = new BookmarksPage(page, 'zh');
        await bookmarks.goto();
        await bookmarks.expectToBeVisible();
        await expect(page).toHaveTitle('我的書籤');
    });

    test('renders the page title in ja', async ({ page }) => {
        await page.goto('/ja/bookmarks');
        await expect(page).toHaveTitle('しおり');
        await expect(
            page.getByRole('heading', { name: 'しおり' })
        ).toBeVisible();
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
        // Force the unavailable (fetching) branch even when the anonymous
        // visitor is server-rendered as signed out.
        await useSsrAuthState(page, 'unavailable');
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

    test('shows an English error banner and keeps local cards without the empty state on a signed-in cloud failure', async ({
        page,
    }) => {
        const bookmarks = new BookmarksPage(page, 'en');
        await bookmarks.seedLocalBookmark({
            bookmarkName: 'E2E checkpoint',
            storyId: 'train_adventure',
            sceneId: 'scene_1',
        });
        await useSsrAuthState(page, 'signed-in');
        await page.route('**/api/bookmarks', route =>
            route.fulfill({ status: 500 })
        );
        await bookmarks.goto();

        await expect(bookmarks.localBookmarkCards()).toHaveCount(1);
        await expect(
            bookmarks.container.getByText(
                'Failed to load bookmarks. Please try again.'
            )
        ).toBeVisible();
        await expect(
            bookmarks.container.getByText('No bookmarks yet.')
        ).toHaveCount(0);
        await expect(
            bookmarks.container.getByText('Start Reading')
        ).toHaveCount(0);
    });
});
