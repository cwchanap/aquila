import { expect, test, type Locator, type Page } from '@playwright/test';
import { VisualReaderPage } from './utils';

const READER_PATH =
    '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=';
const MIO_OBJECT =
    '**/vn/objects/6556ca83ebbe31cbc236d0c1ce3d544a1d1cfa0ec627852a12e3259feb8ca4c1.webp';
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
    const visual = new VisualReaderPage(page);
    await visual.chooseMode('Text');
    await expect(page.getByTestId('visual-novel-reader')).not.toBeAttached();
    await expect(page).toHaveURL(dialogueUrl(line));

    await visual.chooseMode('Visual Novel');
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
        ['reader settings', visual.settingsButton],
        ['history', page.getByRole('button', { name: 'Open history' })],
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

    test('keeps the dialogue panel geometry stable across responsive viewports', async ({
        page,
    }) => {
        const viewports = [
            { width: 1280, height: 800, expectedHeight: 288 },
            { width: 390, height: 844, expectedHeight: 0.4 * 844 },
            { width: 844, height: 390, expectedHeight: 152 },
        ] as const;

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            const visual = new VisualReaderPage(page);
            await visual.goto(6);

            const initialBox = await visual.dialogueBox.boundingBox();
            expect(
                initialBox,
                'dialogue box is measurable after navigation'
            ).not.toBe(null);
            if (!initialBox) continue;
            expect(
                Math.abs(initialBox.height - viewport.expectedHeight),
                `dialogue height at ${viewport.width}x${viewport.height}`
            ).toBeLessThanOrEqual(1);
            await expect(visual.dialogueBody).toBeVisible();
            await expect(visual.dialogueFooter).toBeVisible();

            // Deep links restore a nonzero line as already revealed. Advance
            // once so the next line gives us a real in-flight typewriter
            // measurement before the completion click below.
            await expect(
                page.getByTestId('visual-typewriter-cursor')
            ).not.toBeAttached();
            await visual.root.click();
            await expect(page).toHaveURL(dialogueUrl(7));
            await expect(
                page.getByTestId('visual-typewriter-cursor')
            ).toBeVisible();
            const typingBox = await visual.dialogueBox.boundingBox();
            expect(
                typingBox,
                'dialogue box is measurable while typing'
            ).not.toBe(null);
            if (!typingBox) continue;
            expect(
                Math.abs(typingBox.height - initialBox.height),
                `typing height delta at ${viewport.width}x${viewport.height}`
            ).toBeLessThanOrEqual(1);

            await visual.root.click();
            await expect(
                page.getByTestId('visual-typewriter-cursor')
            ).not.toBeAttached();
            const completeBox = await visual.dialogueBox.boundingBox();
            expect(
                completeBox,
                'dialogue box is measurable after typing'
            ).not.toBe(null);
            if (!completeBox) continue;
            expect(
                Math.abs(completeBox.height - initialBox.height),
                `completed height delta at ${viewport.width}x${viewport.height}`
            ).toBeLessThanOrEqual(1);
            await expect(visual.dialogueBody).toBeVisible();
            await expect(visual.dialogueFooter).toBeVisible();

            const historyBox = await page
                .getByRole('button', { name: 'Open history' })
                .boundingBox();
            expect(historyBox, 'History is measurable').not.toBe(null);
            if (!historyBox) continue;
            expect(historyBox.x).toBeGreaterThanOrEqual(
                completeBox.x + completeBox.width - historyBox.width - 16 - 1
            );
            expect(historyBox.x + historyBox.width).toBeLessThanOrEqual(
                completeBox.x + completeBox.width + 1
            );
            expect(historyBox.y).toBeGreaterThanOrEqual(completeBox.y - 1);
            expect(historyBox.y + historyBox.height).toBeLessThanOrEqual(
                completeBox.y + completeBox.height / 2
            );

            await expect(visual.portrait).toHaveAttribute(
                'data-portrait-state',
                'ready'
            );
            const portraitBox = await visual.portrait.boundingBox();
            expect(portraitBox, 'portrait is measurable').not.toBe(null);
            if (portraitBox) {
                expect(portraitBox.y + portraitBox.height).toBeLessThanOrEqual(
                    completeBox.y - 12 + 1
                );
            }
        }
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

        const visual = new VisualReaderPage(page);
        await visual.chooseMode('Visual Novel');
        await expectCanonicalVisualLine(page, 7);
        await expect(line).toBeVisible();

        await visual.chooseMode('Text');
        await expect(
            page.getByTestId('visual-novel-reader')
        ).not.toBeAttached();
        await expect(page).toHaveURL(dialogueUrl(7));
        await expect(line).toBeVisible();
    });

    test('switches mobile Text to Visual without changing the canonical line and restores Settings focus', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'text');
        });
        await page.goto(`${READER_PATH}7`);
        await expect(page).toHaveURL(dialogueUrl(7));

        const menuButton = page.getByRole('button', { name: 'Open menu' });
        await menuButton.click();
        await page.getByRole('button', { name: 'Visual Novel' }).click();

        await expect(page.getByTestId('visual-novel-reader')).toBeVisible();
        await expect(page).toHaveURL(dialogueUrl(7));
        await expect(
            page.getByRole('button', { name: 'Open reader settings' })
        ).toBeFocused();
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
        await visual.openSettings();
        await expect(
            visual.settingsDialog.getByRole('button', { name: 'Visual Novel' })
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

    test('keeps History clear of long choice content on mobile portrait', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        await page.goto(
            '/en/reader?story=train_adventure&scene=act3&dialogue=47'
        );
        const visual = new VisualReaderPage(page);
        await expect(visual.root).toBeVisible();
        await expect(visual.dialogueBody).toBeVisible();
        await expect(
            visual.dialogueBody.locator('.dialogue-text')
        ).toBeVisible();

        const history = page.getByRole('button', { name: 'Open history' });
        const historyBox = await history.boundingBox();
        const dialogueBox = await visual.dialogueBody
            .locator('.dialogue-text')
            .boundingBox();
        expect(historyBox, 'History is measurable').not.toBe(null);
        expect(dialogueBox, 'dialogue text is measurable').not.toBe(null);
        if (!historyBox || !dialogueBox) return;
        expect(
            boxesOverlap(historyBox, dialogueBox),
            'History must not cover the first visible dialogue text'
        ).toBe(false);

        await visual.dialogueBody.evaluate(element => {
            element.scrollTop = element.scrollHeight;
        });
        const bodyBox = await visual.dialogueBody.boundingBox();
        expect(bodyBox, 'dialogue body is measurable after scrolling').not.toBe(
            null
        );
        if (!bodyBox) return;

        const content = visual.dialogueBody.locator(':scope > *');
        for (let index = 0; index < (await content.count()); index += 1) {
            const contentBox = await content.nth(index).boundingBox();
            if (!contentBox) continue;
            const visibleInBody =
                contentBox.y < bodyBox.y + bodyBox.height &&
                contentBox.y + contentBox.height > bodyBox.y;
            if (visibleInBody) {
                expect(
                    boxesOverlap(historyBox, contentBox),
                    `visible dialogue content ${index} must not sit beneath History`
                ).toBe(false);
            }
        }
    });

    test('scrolls the dialogue body from the keyboard without advancing', async ({
        page,
    }, testInfo) => {
        // The mobile projects model touch-only devices; keep this keyboard
        // interaction proof on desktop Chromium while retaining the mobile
        // viewport geometry and component-level accessibility contract.
        test.skip(testInfo.project.name !== 'chromium');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        await page.goto(
            '/en/reader?story=train_adventure&scene=act3&dialogue=47'
        );
        const visual = new VisualReaderPage(page);
        const body = visual.dialogueBody;
        await expect(visual.root).toBeVisible();
        await expect(body).toHaveAttribute('role', 'region');
        await expect(body).toHaveAttribute('aria-label', 'Dialogue content');
        await expect(body).toHaveAttribute('tabindex', '0');
        await expect(body).not.toHaveAttribute('data-reader-interactive');

        const beforeUrl = page.url();
        const beforeDialogue = await body.locator('.dialogue-text').innerText();
        const beforeFooter = await visual.dialogueFooter.boundingBox();
        expect(
            beforeFooter,
            'footer is measurable before keyboard scrolling'
        ).not.toBe(null);
        if (!beforeFooter) return;

        const keys = [
            ['Space', ' '],
            ['PageDown', 'PageDown'],
            ['ArrowDown', 'ArrowDown'],
        ] as const;
        for (const [label, key] of keys) {
            await body.evaluate(element => {
                (element as HTMLElement).scrollTop = 0;
            });
            await body.focus();
            await expect(body).toBeFocused();
            await body.press(key);
            await expect
                .poll(() =>
                    body.evaluate(element => (element as HTMLElement).scrollTop)
                )
                .toBeGreaterThan(0);

            expect(page.url(), `${label} changed the reader URL`).toBe(
                beforeUrl
            );
            expect(
                await body.locator('.dialogue-text').innerText(),
                `${label} changed the dialogue line`
            ).toBe(beforeDialogue);
            const afterFooter = await visual.dialogueFooter.boundingBox();
            expect(afterFooter, `${label} left the footer measurable`).not.toBe(
                null
            );
            if (afterFooter) {
                expect(
                    Math.abs(afterFooter.y - beforeFooter.y)
                ).toBeLessThanOrEqual(1);
                expect(
                    Math.abs(afterFooter.height - beforeFooter.height)
                ).toBeLessThanOrEqual(1);
            }
        }
    });

    test('advances on a stationary dialogue-body tap', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expectCanonicalVisualLine(page, 6);

        await visual.dialogueBody.click();

        await expectCanonicalVisualLine(page, 7);
    });

    test('does not advance after a moved dialogue-body pointer gesture', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expectCanonicalVisualLine(page, 6);

        const body = await visual.dialogueBody.boundingBox();
        expect(body, 'dialogue body is measurable').not.toBe(null);
        if (!body) return;
        const startX = body.x + body.width / 2;
        const startY = body.y + body.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 4 });
        await page.mouse.up();

        await expectCanonicalVisualLine(page, 6);
    });

    test('keeps essential controls unobscured in mobile landscape', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name === 'chromium');
        await page.setViewportSize({ width: 844, height: 390 });
        const visual = new VisualReaderPage(page);
        await visual.goto(6);
        await expect(visual.settingsButton).toBeVisible();
        await expect(visual.settingsButton).toBeEnabled();
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

    test('keeps Settings accessible when a replacement load fails with the History overlay open', async ({
        page,
    }) => {
        const visual = new VisualReaderPage(page);
        await visual.goto(6);

        // Open the History overlay — leafOverlayOpen becomes true, which
        // normally disables the shell's Settings trigger.
        const historyTrigger = page.getByRole('button', {
            name: 'Open history',
        });
        await historyTrigger.click();
        const backlog = page.getByRole('dialog', { name: 'History' });
        await expect(backlog).toBeVisible();

        // Block the replacement story's entry module so the cross-story
        // popstate navigation fails with loadStatus = 'error' while the
        // old payload (and the History overlay) remain mounted.
        const MIDNIGHT_SEGMENT = '/stories/dontSaveMeBeforeMidnight/';
        await page.route(
            url =>
                decodeURIComponent(url.pathname).includes(MIDNIGHT_SEGMENT) &&
                decodeURIComponent(url.pathname).endsWith('/index.ts'),
            route => route.abort()
        );

        // Trigger a cross-story navigation via popstate — the reader is
        // already mounted, so this is a replacement load, not a fresh mount.
        await page.evaluate(() => {
            history.pushState(
                null,
                '',
                '/en/reader?story=dont_save_me_before_midnight&scene=act1&dialogue=1'
            );
            dispatchEvent(new PopStateEvent('popstate'));
        });

        // The replacement load fails — the error alert appears on top of
        // the preserved payload.
        await expect(page.getByRole('alert')).toBeVisible();

        // The Settings trigger must remain accessible even though the
        // History overlay is still open (leafOverlayOpen is true). Without
        // the !isBlocking guard on triggerUnavailable, the trigger would be
        // disabled and the user would be unable to reach Home/mode/retry.
        await expect(visual.settingsButton).toBeEnabled();
        await visual.openSettings();
        await expect(visual.settingsDialog).toBeVisible();
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
