import { expect, test } from '@playwright/test';
import { getTranslations } from '@aquila/stories/translations';
import { composite, contrastRatio, readCssColor } from './utils';

const t = getTranslations('en');

test.use({ viewport: { width: 1440, height: 900 } });

// Sample the lightest sky stop, not each text position.
const routes = [
    '/en/notes?story=train_adventure',
    '/en/progress',
    '/en/stories',
];

for (const route of routes) {
    test(`Ocean shell Back and tagline contrast: ${route}`, async ({
        page,
    }) => {
        await page.goto(route);
        const back = page.getByRole('link', { name: t.common.backLabel });
        const tagline = page.locator('h1 + p');
        await expect(back).toBeVisible();
        await expect(tagline).toBeVisible();
        const gradient = await page
            .locator('.bg-linear-to-b')
            .evaluate(element => getComputedStyle(element).backgroundImage);
        const firstStop = gradient.match(
            /(?:oklch|oklab|rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8}/i
        )?.[0];
        if (!firstStop)
            throw new Error(`Cannot read gradient stop from ${gradient}`);
        const sky = await readCssColor(page, firstStop);
        const backStyle = await back.evaluate(element => ({
            background: getComputedStyle(element).backgroundColor,
            color: getComputedStyle(element).color,
        }));
        const taglineColor = await tagline.evaluate(
            element => getComputedStyle(element).color
        );
        const pill = composite(
            await readCssColor(page, backStyle.background),
            sky
        );
        const backText = composite(
            await readCssColor(page, backStyle.color),
            pill
        );
        const taglineText = composite(
            await readCssColor(page, taglineColor),
            sky
        );
        expect(contrastRatio(backText, pill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(taglineText, sky)).toBeGreaterThanOrEqual(4.5);
    });
}
