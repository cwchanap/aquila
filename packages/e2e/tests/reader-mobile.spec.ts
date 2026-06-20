import { test, expect } from '@playwright/test';
import { MobileReaderPage } from './utils';

test.describe('Mobile reader', () => {
    test('shows the VN panel and advances on tap', async ({ page }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        await expect(reader.tapLayer).toBeVisible();

        // First tap completes the typewriter; second advances to the next line.
        await reader.tapToAdvance(2);

        // The single-panel reader should still be showing the tap layer.
        await expect(reader.tapLayer).toBeVisible();
    });

    test('shows the persistent back button without opening the menu', async ({
        page,
    }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        // The ◀ control is persistent: visible while the hamburger chrome is
        // closed, and disabled on the first line.
        await expect(reader.previousLineButton).toBeVisible();
        await expect(reader.previousLineButton).toBeDisabled();
        // The chrome-only Home link must NOT be reachable without opening menu.
        await expect(reader.backToHomeLink).not.toBeVisible();
    });

    test('opens the menu and the acts drawer', async ({ page }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        await reader.openMenu();
        // The chrome bar contains a link whose text includes "Back to Home".
        await expect(reader.backToHomeLink).toBeVisible();

        await reader.openActs();
        // The drawer heading uses the Acts label (t.reader.actPanel = "Acts").
        await expect(reader.actsHeadingLocator).toBeVisible();
    });

    test('opens the history backlog', async ({ page }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        // Advance one line so the backlog has content.
        await reader.tapToAdvance(2);

        await reader.openMenu();
        await reader.openHistory();
        await expect(reader.historyHeadingLocator).toBeVisible();
    });

    test('saves a bookmark tagged with the current dialogue number', async ({
        page,
    }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        // Two taps: first completes the typewriter on line 0, second advances
        // to line 1 (currentDialogueIndex = 1). The bookmark control reports
        // currentDialogueIndex + 1, so the stored tag must be [dlg:2].
        await reader.tapToAdvance(2);

        await reader.openMenu();
        await reader.saveBookmark('E2E checkpoint');

        // The bookmark flow posts to /api/bookmarks; without a session the API
        // returns 401 and the reader-manager falls back to LocalBookmarksStore.
        // Wait for the success alert (or dismiss it) before reading storage.
        await expect(reader.alertDialog).toBeVisible();
        await reader.alertDialog.getByRole('button', { name: 'OK' }).click();

        const bookmarks = await reader.localBookmarks();
        expect(bookmarks.length).toBeGreaterThan(0);
        const saved = bookmarks.find(b =>
            b.bookmarkName.includes('E2E checkpoint')
        );
        expect(saved).toBeDefined();
        // The [dlg:N] tag is the load-bearing contract with the reader-manager
        // deep-link format — verifies the +1 offset survived the round trip.
        expect(saved?.bookmarkName).toMatch(/\[dlg:2\]/);
    });
});
