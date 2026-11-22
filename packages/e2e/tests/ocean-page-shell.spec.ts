import { expect, test } from '@playwright/test';
import { getTranslations } from '@aquila/stories/translations';

const t = getTranslations('en');

/**
 * The shared Ocean shell puts small Back and tagline text over the light sky
 * gradient. WCAG AA requires 4.5:1 for this text; the gradient's lightest
 * stop is the worst case. The translucent Back pill is composited over that
 * stop before the text contrast is calculated.
 */
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
        await expect(
            page.getByRole('link', { name: t.common.backLabel })
        ).toBeVisible();
        await expect(page.locator('h1 + p')).toBeVisible();

        const contrast = await page.evaluate(() => {
            const back = document.querySelector<HTMLAnchorElement>(
                'a[aria-label="Go back to the previous page"]'
            );
            const tagline = document.querySelector<HTMLElement>('h1 + p');
            const background =
                document.querySelector<HTMLElement>('.bg-linear-to-b');
            if (!back || !tagline || !background) {
                throw new Error('Ocean shell contrast elements not found');
            }

            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const context = canvas.getContext('2d', {
                willReadFrequently: true,
            });
            if (!context) throw new Error('Canvas 2D unavailable');

            const toRgba = (css: string): [number, number, number, number] => {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = css;
                context.fillRect(0, 0, 1, 1);
                return [...context.getImageData(0, 0, 1, 1).data] as [
                    number,
                    number,
                    number,
                    number,
                ];
            };

            const composite = (
                foreground: [number, number, number, number],
                background: [number, number, number, number]
            ): [number, number, number, number] => {
                const alpha =
                    foreground[3] / 255 +
                    (background[3] / 255) * (1 - foreground[3] / 255);
                const channel = (index: number) =>
                    Math.round(
                        (foreground[index] * (foreground[3] / 255) +
                            background[index] *
                                (background[3] / 255) *
                                (1 - foreground[3] / 255)) /
                            alpha
                    );
                return [
                    channel(0),
                    channel(1),
                    channel(2),
                    Math.round(alpha * 255),
                ];
            };

            const luminance = ([red, green, blue]: [
                number,
                number,
                number,
                number,
            ]) => {
                const linear = (value: number) => {
                    const normalized = value / 255;
                    return normalized <= 0.03928
                        ? normalized / 12.92
                        : ((normalized + 0.055) / 1.055) ** 2.4;
                };
                return (
                    0.2126 * linear(red) +
                    0.7152 * linear(green) +
                    0.0722 * linear(blue)
                );
            };

            const ratio = (
                first: [number, number, number, number],
                second: [number, number, number, number]
            ) => {
                const [lighter, darker] = [
                    luminance(first),
                    luminance(second),
                ].sort((a, b) => b - a);
                return (lighter + 0.05) / (darker + 0.05);
            };

            const gradient = getComputedStyle(background).backgroundImage;
            const lightestStop = gradient.match(
                /(?:oklch|oklab|rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8}/i
            )?.[0];
            if (!lightestStop) {
                throw new Error(`Cannot read gradient stop from ${gradient}`);
            }
            const sky = toRgba(lightestStop);
            const opaqueSky = composite(sky, sky);
            const pill = composite(
                toRgba(getComputedStyle(back).backgroundColor),
                opaqueSky
            );
            const backText = composite(
                toRgba(getComputedStyle(back).color),
                pill
            );
            const taglineText = composite(
                toRgba(getComputedStyle(tagline).color),
                opaqueSky
            );

            return {
                back: ratio(backText, pill),
                tagline: ratio(taglineText, opaqueSky),
                backColor: getComputedStyle(back).color,
                taglineColor: getComputedStyle(tagline).color,
            };
        });

        expect(
            contrast.back,
            `Back contrast ${contrast.back.toFixed(2)}:1 (${contrast.backColor})`
        ).toBeGreaterThanOrEqual(4.5);
        expect(
            contrast.tagline,
            `Tagline contrast ${contrast.tagline.toFixed(2)}:1 (${contrast.taglineColor})`
        ).toBeGreaterThanOrEqual(4.5);
    });
}
