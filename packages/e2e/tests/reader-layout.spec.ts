import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
];

const primaryText =
    'Late night on the Chuo Line platform at Shinjuku Station. The departure board glowed a cold white against the dark, its numbers flicking over with a mechanical indifference. Ten to midnight — the last train bound for Takao was about to pull in.';
const secondaryText =
    '深夜，新宿車站的中央線月台。電子顯示板在黑夜中閃爍著冷白色的光芒，數字跳動間透出一種機械式的冷漠。午夜十一點五十分——最後一班往高尾方向的列車，即將進站。';

async function box(locator: Locator) {
    const rect = await locator.boundingBox();
    expect(rect).not.toBeNull();
    return rect!;
}

function expectSameBox(
    actual: Awaited<ReturnType<typeof box>>,
    expected: Awaited<ReturnType<typeof box>>
) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(
            Math.abs(actual[key] - expected[key]),
            `${key} changed`
        ).toBeLessThanOrEqual(1);
    }
}

async function scrollIfNeeded(region: Locator): Promise<void> {
    const result = await region.evaluate(element => {
        const node = element as HTMLElement;
        const overflow = node.scrollHeight > node.clientHeight;
        node.scrollTop = node.scrollHeight;
        return { overflow, scrollTop: node.scrollTop };
    });
    if (result.overflow) expect(result.scrollTop).toBeGreaterThan(0);
}

async function separate(a: Locator, b: Locator): Promise<void> {
    const first = await a.boundingBox();
    const second = await b.boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;
    expect(
        first.x < second.x + second.width &&
            first.x + first.width > second.x &&
            first.y < second.y + second.height &&
            first.y + first.height > second.y
    ).toBe(false);
}

async function openReader(page: Page, mode: string): Promise<void> {
    await page.addInitScript(mode => {
        localStorage.setItem('aquila:reader-mode:v1', mode);
        localStorage.setItem('aquila:reader-second-language:v1', 'zh');
        localStorage.setItem('aquila:reader-typing-speed:v1', 'normal');
    }, mode);
    await page.clock.install();
    await page.goto('/en/reader?story=train_adventure&scene=act1&dialogue=1');
    await expect(page.getByTestId('reader-ready')).toBeVisible({
        timeout: 15_000,
    });
    await page.addStyleTag({
        content: 'astro-dev-toolbar { display: none !important; }',
    });
}

for (const viewport of viewports) {
    for (const mode of ['visual', 'text']) {
        test(`${mode} bilingual dialogue stays usable at ${viewport.width}x${viewport.height}`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport);
            await openReader(page, mode);
            const reveal = page.getByRole('button', { name: 'Reveal text' });
            await expect(reveal).toBeVisible();
            const mobileText = mode === 'text' && viewport.width < 1024;
            const panel =
                mode === 'visual'
                    ? page.getByTestId('visual-dialogue-box')
                    : mobileText
                      ? page
                            .locator('.mobile-reader p.pointer-events-auto')
                            .locator('..')
                      : page.locator('.novel-reader main > div');
            const scroller =
                mode === 'visual'
                    ? page.getByTestId('visual-dialogue-body')
                    : mobileText
                      ? page.locator('.mobile-reader p.pointer-events-auto')
                      : page.locator(
                            '.novel-reader main [class*="overflow-y-auto"]'
                        );
            const topControl =
                mode === 'visual'
                    ? page.getByRole('button', { name: 'Open reader settings' })
                    : mobileText
                      ? page.getByRole('button', { name: 'Open menu' })
                      : null;
            const footer =
                mode === 'visual'
                    ? page.getByTestId('visual-dialogue-footer')
                    : mobileText
                      ? panel.locator(':scope > div:last-child')
                      : page.locator('.novel-reader .text-center');
            const portrait =
                mode === 'visual'
                    ? page.getByTestId('visual-portrait-left')
                    : null;
            if (portrait) {
                // Train Adventure has no bundled release; load the local portrait
                // fixture into the real visual reader's portrait element.
                await portrait.evaluate((img: HTMLImageElement) => {
                    img.src =
                        '/assets/vn/objects/de3db15c3c91dde3097a312fdb0d18e5283b7d39bbb686822773adfe98a8cd90.webp';
                });
                await expect
                    .poll(() =>
                        portrait.evaluate(
                            (img: HTMLImageElement) => img.naturalWidth
                        )
                    )
                    .toBeGreaterThan(0);
            }
            const before = await box(panel);
            const footerBefore = await box(footer);
            const portraitBefore = portrait ? await box(portrait) : null;
            await page.clock.runFor(900);
            expectSameBox(await box(panel), before);
            expectSameBox(await box(footer), footerBefore);
            if (portrait && portraitBefore)
                expectSameBox(await box(portrait), portraitBefore);
            await page.clock.runFor(3000);
            expectSameBox(await box(panel), before);
            expectSameBox(await box(footer), footerBefore);
            if (portrait && portraitBefore)
                expectSameBox(await box(portrait), portraitBefore);
            await reveal.click({ trial: true });
            await reveal.click();
            await page.clock.runFor(100);
            await expect(reveal).toHaveCount(0);
            expectSameBox(await box(panel), before);
            expectSameBox(await box(footer), footerBefore);
            if (portrait && portraitBefore)
                expectSameBox(await box(portrait), portraitBefore);
            const passage = scroller.locator('.passage-visible');
            await expect(passage.locator('[lang="en"]')).toHaveText(
                primaryText
            );
            await expect(passage.getByTestId('second-line')).toHaveText(
                secondaryText
            );
            await scrollIfNeeded(scroller);
            if (topControl) {
                await separate(panel, topControl);
                await topControl.click({ trial: true });
            }
            if (mode === 'visual') {
                const history = page.getByRole('button', {
                    name: 'Open history',
                });
                const status = page.getByRole('status');
                if (await status.isVisible()) await separate(history, status);
                await history.click({ trial: true });
            }
            if (mobileText) {
                await separate(
                    page.getByRole('button', { name: 'Previous line' }),
                    topControl!
                );
                await page.clock.resume();
                await topControl!.click();
                await page
                    .getByRole('button', { name: 'Reading settings' })
                    .click();
                const speed = page.getByRole('group', { name: 'Typing speed' });
                await expect(speed).toBeVisible();
                await speed
                    .getByRole('button', { name: 'Fast', exact: true })
                    .click({ trial: true });
                const japanese = page
                    .getByTestId('second-language-picker')
                    .getByRole('button', { name: '日本語', exact: true });
                await japanese.click({ timeout: 5_000 });
                await expect(japanese).toHaveAttribute('aria-pressed', 'true');
                expect(
                    await page.evaluate(() =>
                        localStorage.getItem('aquila:reader-second-language:v1')
                    )
                ).toBe('ja');
                await page.getByRole('button', { name: 'Close menu' }).click();
                await expect(
                    page.getByRole('button', { name: 'Open menu' })
                ).toBeVisible();
            }
            if (!mobileText) {
                const action = page.getByRole('button', {
                    name: 'Continue',
                    exact: true,
                });
                await expect(action).toBeVisible();
                await action.click({ trial: true });
                await separate(action, scroller);
            }
        });
    }
}

for (const viewport of viewports) {
    test(`loaded visual portrait stays anchored during a long line at ${viewport.width}x${viewport.height}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
            localStorage.setItem('aquila:reader-typing-speed:v1', 'normal');
        });
        await page.clock.install();
        await page.goto(
            '/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=8'
        );
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });
        await page.addStyleTag({
            content: 'astro-dev-toolbar { display: none !important; }',
        });
        const portrait = page.getByTestId('visual-portrait-left');
        await expect(portrait).toHaveAttribute('data-portrait-state', 'ready');
        await page
            .getByRole('button', { name: 'Continue', exact: true })
            .click();
        const reveal = page.getByRole('button', { name: 'Reveal text' });
        await expect(reveal).toBeVisible();
        const panel = page.getByTestId('visual-dialogue-box');
        const footer = page.getByTestId('visual-dialogue-footer');
        const before = await Promise.all([
            box(panel),
            box(portrait),
            box(footer),
        ]);
        await page.clock.runFor(900);
        for (const [index, locator] of [panel, portrait, footer].entries()) {
            expectSameBox(await box(locator), before[index]);
        }
        await reveal.click();
        await page.clock.runFor(100);
        await expect(reveal).toHaveCount(0);
        for (const [index, locator] of [panel, portrait, footer].entries()) {
            expectSameBox(await box(locator), before[index]);
        }
        await expect(
            panel.locator('.passage-visible .dialogue-text')
        ).toHaveText(
            '澪當時罵他亂講話，把鏡子扔回他桌上。悠真沒生氣，反而笑得很得意，像真的送了什麼不得了的禮物——那種早就算準了的笑。'
        );
    });
}

for (const viewport of viewports) {
    for (const mode of ['visual', 'text']) {
        test(`${mode} choice action remains clickable at ${viewport.width}x${viewport.height}`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport);
            await page.addInitScript(mode => {
                localStorage.setItem('aquila:reader-mode:v1', mode);
                localStorage.setItem('aquila:reader-second-language:v1', 'zh');
            }, mode);
            await page.goto(
                '/en/reader?story=train_adventure&scene=act3&dialogue=47'
            );
            await expect(page.getByTestId('reader-ready')).toBeVisible({
                timeout: 15_000,
            });
            await page.addStyleTag({
                content: 'astro-dev-toolbar { display: none !important; }',
            });
            const choose = page.getByRole('button', {
                name: 'Choose',
                exact: true,
            });
            await expect(choose).toBeVisible();
            await choose.click();
            await expect(page.getByRole('dialog')).toBeVisible();
        });
    }
}
