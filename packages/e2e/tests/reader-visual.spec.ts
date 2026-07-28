import { expect, test, type Locator, type Page } from '@playwright/test';
import { VisualReaderPage } from './utils';

const READER_PATH =
    '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=';
const MIO_OBJECT =
    '**/vn/objects/a930d03b393e3c2c2005018eef18328b2cc1cab5934628f0e6b8237040a2cccb.webp';
const SECOND_BACKGROUND_OBJECT =
    '**/vn/objects/8bfdc7f3c41049680918be340114f37ed433763672369c86c84ef620b1d8aaba.webp';

function dialogueUrl(line: number): RegExp {
    return new RegExp(`[?&]dialogue=${line}(?:&|$)`);
}

async function expectCanonicalVisualLine(
    page: Page,
    line: number
): Promise<void> {
    await expect(page).toHaveURL(dialogueUrl(line));
    await expect(
        page
            .getByTestId('visual-novel-reader')
            .getByText(new RegExp(`^Page ${line} of \\d+$`))
    ).toBeVisible();
}

async function swapVisualToTextAndBack(
    page: Page,
    line: number
): Promise<void> {
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await expect(page.getByTestId('visual-novel-reader')).not.toBeAttached();
    await expect(page).toHaveURL(dialogueUrl(line));

    await page
        .getByRole('button', { name: 'Visual Novel', exact: true })
        .click();
    await expectCanonicalVisualLine(page, line);
}

async function openAndCloseVisualBacklog(page: Page): Promise<void> {
    const trigger = page.getByRole('button', { name: 'Open history' });
    await trigger.click();

    const backlog = page.getByRole('dialog', { name: 'History' });
    await expect(backlog).toBeVisible();
    const close = backlog.getByRole('button', { name: 'Close history' });
    await expect(close).toBeFocused();
    await close.click();

    await expect(backlog).not.toBeAttached();
    await expect(trigger).toBeFocused();
}

function boxesOverlap(
    left: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
    right: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
): boolean {
    return (
        left.x < right.x + right.width &&
        left.x + left.width > right.x &&
        left.y < right.y + right.height &&
        left.y + left.height > right.y
    );
}

async function expectEssentialControlsNotToOverlapPortrait(
    page: Page
): Promise<void> {
    const visual = new VisualReaderPage(page);
    const portraitBox = await visual.portrait.boundingBox();
    expect(portraitBox, 'the flagship portrait has layout dimensions').not.toBe(
        null
    );
    if (!portraitBox) return;

    const controls = [
        ['reader mode', visual.modeControl],
        ['history', page.getByRole('button', { name: 'Open history' })],
        ['bookmark', page.getByRole('button', { name: '📖 Bookmark' })],
        ['continue', page.getByRole('button', { name: 'Continue' })],
    ] as const;

    for (const [name, locator] of controls) {
        await expect(locator).toBeVisible();
        await expect(locator).toBeEnabled();
        const controlBox = await locator.boundingBox();
        expect(controlBox, `${name} has layout dimensions`).not.toBe(null);
        if (controlBox) {
            expect(
                boxesOverlap(controlBox, portraitBox),
                `${name} overlaps the portrait`
            ).toBe(false);
        }
    }
}

test.describe('Visual novel reader', () => {
    test('renders Yuma right, advances to Mio left, and preserves the URL line', async ({
        page,
    }) => {
        const visual = new VisualReaderPage(page);
        await visual.goto(6);

        await expect(visual.root).toHaveAttribute(
            'data-visual-release-state',
            'ready'
        );
        await expect(visual.activeBackground).toHaveAttribute(
            'data-bg-state',
            'ready'
        );
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-state',
            'ready'
        );
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-slot',
            'right'
        );

        await visual.root.click();

        await expectCanonicalVisualLine(page, 7);
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-state',
            'ready'
        );
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-slot',
            'left'
        );
    });

    test('crossfades line 10 to line 11 without clearing active', async ({
        page,
    }) => {
        let releaseSecondBackground = () => {};
        const secondBackgroundAllowed = new Promise<void>(resolve => {
            releaseSecondBackground = resolve;
        });
        await page.route(SECOND_BACKGROUND_OBJECT, async route => {
            await secondBackgroundAllowed;
            await route.continue();
        });
        const visual = new VisualReaderPage(page);
        try {
            await visual.goto(10);
            await expect(visual.activeBackground).toHaveAttribute(
                'data-bg-state',
                'ready'
            );
            const previousUrl =
                await visual.activeBackground.getAttribute('src');
            expect(previousUrl).not.toBeNull();

            await visual.root.click();

            await expectCanonicalVisualLine(page, 11);
            await expect(visual.stagingBackground).toHaveAttribute(
                'data-bg-state',
                'loading'
            );
            expect(await visual.activeBackground.getAttribute('src')).toBe(
                previousUrl
            );

            releaseSecondBackground();
            await expect(visual.activeBackground).toHaveAttribute(
                'data-bg-state',
                'ready'
            );
            await expect(visual.activeBackground).not.toHaveAttribute(
                'src',
                previousUrl ?? ''
            );
            await expect(visual.stagingBackground).toHaveAttribute(
                'data-bg-state',
                'omitted'
            );
        } finally {
            releaseSecondBackground();
        }
    });

    test('keeps dialogue 7 canonical through Text, Visual, and Text', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'text');
        });
        await page.goto(`${READER_PATH}7`);
        const line = page.getByText('⋯⋯這是什麼？', { exact: true });
        await expect(line).toBeVisible();
        await expect(page).toHaveURL(dialogueUrl(7));

        await page
            .getByRole('button', { name: 'Visual Novel', exact: true })
            .click();
        await expectCanonicalVisualLine(page, 7);
        await expect(line).toBeVisible();

        await page.getByRole('button', { name: 'Text', exact: true }).click();
        await expect(
            page.getByTestId('visual-novel-reader')
        ).not.toBeAttached();
        await expect(page).toHaveURL(dialogueUrl(7));
        await expect(line).toBeVisible();
    });

    test('restores direct links through reload, back, and forward without mode swaps changing lines', async ({
        page,
    }) => {
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expectCanonicalVisualLine(page, 6);

        await page.goto(`${READER_PATH}7`);
        await expectCanonicalVisualLine(page, 7);
        await page.reload();
        await expectCanonicalVisualLine(page, 7);
        await swapVisualToTextAndBack(page, 7);

        await page.goBack();
        await expectCanonicalVisualLine(page, 6);
        await swapVisualToTextAndBack(page, 6);

        await page.goForward();
        await expectCanonicalVisualLine(page, 7);
    });

    test('keeps dialogue and controls usable when the next background returns 404', async ({
        page,
    }) => {
        await page.route(SECOND_BACKGROUND_OBJECT, route =>
            route.fulfill({ status: 404, body: 'missing' })
        );
        const visual = new VisualReaderPage(page);
        await visual.goto(10);
        await expect(visual.activeBackground).toHaveAttribute(
            'data-bg-state',
            'ready'
        );
        const previousUrl = await visual.activeBackground.getAttribute('src');
        expect(previousUrl).not.toBeNull();

        await visual.root.click();

        await expectCanonicalVisualLine(page, 11);
        const status = page.getByRole('status');
        await expect(status).toHaveText('Some visuals are unavailable');
        await expect(status).toHaveAttribute('aria-live', 'polite');
        await expect(visual.activeBackground).toHaveAttribute(
            'src',
            previousUrl!
        );
        await expect(
            page.getByText('現在那面鏡子放在澪自己的桌上。', {
                exact: true,
            })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Open history' })
        ).toBeEnabled();
        await expect(
            page.getByRole('button', { name: 'Visual Novel', exact: true })
        ).toBeEnabled();
    });

    test('keeps the prior background and dialogue when portrait bytes are invalid', async ({
        page,
    }) => {
        await page.route(MIO_OBJECT, route =>
            route.fulfill({
                status: 200,
                contentType: 'image/webp',
                body: 'not-a-valid-webp',
            })
        );
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expect(visual.activeBackground).toHaveAttribute(
            'data-bg-state',
            'ready'
        );
        const previousUrl = await visual.activeBackground.getAttribute('src');
        expect(previousUrl).not.toBeNull();

        await visual.root.click();

        await expectCanonicalVisualLine(page, 7);
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-state',
            'failed'
        );
        await expect(visual.activeBackground).toHaveAttribute(
            'src',
            previousUrl!
        );
        const status = page.getByRole('status');
        await expect(status).toHaveText('Some visuals are unavailable');
        await expect(status).toHaveAttribute('aria-live', 'polite');
        await expect(
            page.getByText('⋯⋯這是什麼？', { exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Open history' })
        ).toBeEnabled();
    });

    test('opens the backlog and restores focus when it closes', async ({
        page,
    }) => {
        const visual = new VisualReaderPage(page);
        await visual.goto(7);

        await openAndCloseVisualBacklog(page);
        await expectCanonicalVisualLine(page, 7);
    });

    test('keeps Train Adventure choices usable without a visual release', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        await page.goto(
            '/en/reader?story=train_adventure&scene=act3&dialogue=47'
        );
        const visual = new VisualReaderPage(page);
        await expect(visual.root).toBeVisible();
        await expect(visual.root).toHaveCSS(
            'background-color',
            'rgb(2, 6, 23)'
        );
        await expect(visual.activeBackground).not.toHaveAttribute('src');
        await expect(visual.stagingBackground).not.toHaveAttribute('src');
        await expect(visual.portrait).not.toHaveAttribute('src');

        await expect(
            page.getByText('TODO: prompt for choice_act3')
        ).toBeVisible();
        await page.getByRole('button', { name: 'TODO: b1a' }).click();
        await expect(page).toHaveURL(/scene=b1a_act4/);
        await expect(page).toHaveURL(dialogueUrl(1));
        await expect(visual.root).toBeVisible();
    });

    test('keeps essential controls unobscured in mobile landscape', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name === 'chromium');
        await page.setViewportSize({ width: 844, height: 390 });
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expect(visual.modeControl).toBeVisible();
        await expect(visual.modeControl).toBeEnabled();
        await visual.root.click();
        await openAndCloseVisualBacklog(page);
        await expectEssentialControlsNotToOverlapPortrait(page);
    });

    test('does not advance the dialogue when the scrollable dialogue box is scrolled', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expectCanonicalVisualLine(page, 6);

        const dialogueBox = visual.root.locator('.dialogue-box');
        await expect(dialogueBox).toBeVisible();

        // Simulate a scroll gesture: pointerdown inside the dialogue box,
        // move vertically beyond the tap threshold, then pointerup. A scroll
        // gesture must not advance the dialogue.
        const box = await dialogueBox.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return;
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 4 });
        await page.mouse.up();

        await expect(page).toHaveURL(dialogueUrl(6));
    });
});

test.describe('Visual novel reader — prefers-reduced-motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('removes nonzero staging transition duration', async ({ page }) => {
        const visual = new VisualReaderPage(page);
        await visual.goto(10);

        await expect
            .poll(async () => {
                const durations = await visual.stagingBackground.evaluate(
                    element =>
                        globalThis
                            .getComputedStyle(element)
                            .transitionDuration.split(',')
                            .map(value => Number.parseFloat(value))
                );
                return durations.every(duration => duration === 0);
            })
            .toBe(true);
        await visual.root.click();
        await expectCanonicalVisualLine(page, 11);
    });
});
