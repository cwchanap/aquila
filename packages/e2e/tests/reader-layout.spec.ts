import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
];

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
            const before = await panel.boundingBox();
            expect(before).not.toBeNull();
            await page.clock.runFor(900);
            const during = await panel.boundingBox();
            expect(during).not.toBeNull();
            expect(
                Math.abs(during!.height - before!.height)
            ).toBeLessThanOrEqual(1);
            await page.clock.runFor(3000);
            const later = await panel.boundingBox();
            expect(later).not.toBeNull();
            expect(
                Math.abs(later!.height - before!.height)
            ).toBeLessThanOrEqual(1);
            await reveal.click({ trial: true });
            await reveal.click();
            await page.clock.runFor(100);
            await expect(reveal).toHaveCount(0);
            const after = await panel.boundingBox();
            expect(after).not.toBeNull();
            expect(
                Math.abs(after!.height - before!.height)
            ).toBeLessThanOrEqual(1);
            await expect(page.getByTestId('second-line').last()).toBeAttached();
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
