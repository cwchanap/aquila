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
});
