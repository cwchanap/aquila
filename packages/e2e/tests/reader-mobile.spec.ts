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

    test('navigates to a different act from the drawer', async ({ page }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        // The reader starts at act1 (train_adventure flow start). Open the
        // drawer and click a non-active act to verify the onNavigate wiring
        // fires through to the reader-manager and the scene changes.
        await reader.openMenu();
        await reader.openActs();
        await expect(reader.actsHeadingLocator).toBeVisible();

        // The active act (Act 1) is rendered with bg-blue-500; pick a button
        // that is NOT the active one. Act 2 is the linear next scene.
        const act2Button = reader.actButtons.filter({ hasText: 'Act 2' });
        await expect(act2Button).toBeVisible();
        await act2Button.click();

        // The drawer closes on selection (onClose is called after onNavigate).
        await expect(reader.actsHeadingLocator).not.toBeVisible();

        // The reader-manager pushes the new scene onto the URL (deep-link
        // contract): scene=act2 must now be present.
        await expect(page).toHaveURL(/scene=act2/);
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

// Reduced-motion handling: the reader gates bounce/pulse/transition animations
// behind Tailwind's motion-safe: variant (which compiles to
// @media (prefers-reduced-motion: no-preference)). These tests run in a real
// browser context with reducedMotion: 'reduce' and verify via getComputedStyle
// that the animations are actually suppressed — not just that the class is
// present. This catches regressions where someone drops the motion-safe: prefix.
test.describe('Mobile reader — prefers-reduced-motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('suppresses the bounce chevron animation', async ({ page }) => {
        const reader = new MobileReaderPage(page);
        await reader.goto();

        // Complete the typewriter on line 0 so the ▼ chevron renders.
        await reader.tapToAdvance(1);

        const chevron = page.getByText('▼');
        await expect(chevron).toBeVisible();

        // With reduced-motion preferred, motion-safe:animate-bounce must NOT
        // apply, so animation-name resolves to 'none' in the real browser.
        // getComputedStyle is a browser global inside evaluate; the e2e
        // tsconfig has no DOM lib, so access it via globalThis.
        const animationName = await chevron.evaluate(
            el =>
                (
                    globalThis as {
                        getComputedStyle: (el: Element) => {
                            animationName: string;
                        };
                    }
                ).getComputedStyle(el).animationName
        );
        expect(animationName).toBe('none');
    });
});
