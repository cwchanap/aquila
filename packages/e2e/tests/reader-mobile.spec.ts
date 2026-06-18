import { test, expect } from '@playwright/test';

test.describe('Mobile reader', () => {
    test('shows the VN panel and advances on tap', async ({ page }) => {
        await page.goto('/en/reader');

        const tap = page.getByLabel('Tap to continue');
        await expect(tap).toBeVisible();

        // First tap completes the typewriter; second advances to the next line.
        await tap.click();
        await tap.click();

        // The single-panel reader should still be showing the tap layer.
        await expect(tap).toBeVisible();
    });

    test('opens the menu and the acts drawer', async ({ page }) => {
        await page.goto('/en/reader');

        await page.getByLabel('Open menu').click();
        // The chrome bar contains a link whose text includes "Back to Home".
        await expect(
            page.getByRole('link', { name: /Back to Home/i })
        ).toBeVisible();

        await page.getByLabel('Open acts panel').click();
        // The drawer heading uses the Acts label (t.reader.actPanel = "Acts").
        await expect(page.getByRole('heading', { name: 'Acts' })).toBeVisible();
    });

    test('opens the history backlog', async ({ page }) => {
        await page.goto('/en/reader');

        // Advance one line so the backlog has content.
        const tap = page.getByLabel('Tap to continue');
        await tap.click();
        await tap.click();

        await page.getByLabel('Open menu').click();
        await page.getByLabel('Open history').click();
        await expect(
            page.getByRole('heading', { name: 'History' })
        ).toBeVisible();
    });
});
