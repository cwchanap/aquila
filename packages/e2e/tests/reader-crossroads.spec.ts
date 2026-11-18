import { expect, test, type Locator, type Page } from '@playwright/test';
import { trainAdventureFlow } from '../../stories/src/generated/trainAdventure/flow';
import { scene as act3Dialogue } from '../../stories/src/generated/trainAdventure/scenes/en/act3';
import { scene as oneOptionDialogue } from '../../stories/src/generated/trainAdventure/scenes/b1a_b2a_act8';
import { scene as threeOptionDialogue } from '../../stories/src/generated/trainAdventure/scenes/en/b1b_act8';
import { scene as fourOptionDialogue } from '../../stories/src/generated/trainAdventure/scenes/b1a_b2b_b3b_b4b_b5a_act70';
import { trainAdventureChoiceTextEn } from '../../stories/src/stories/trainAdventure/choices.en';
import { buildChoiceMap } from '../../stories/src/stories/choice-utils';
import {
    chooseRoute,
    MobileReaderPage,
    openCrossroads,
    selectCrossroadsRoute,
} from './utils';

const STORY_ID = 'train_adventure';
const PROGRESS_KEY = 'aquila:storyProgress:v1';
const TOOLBAR_STYLE = 'astro-dev-toolbar { display: none !important; }';

const flow = trainAdventureFlow;
const choices = buildChoiceMap(flow, trainAdventureChoiceTextEn);

function choiceAfter(sceneId: string) {
    const node = flow.nodes.find(
        (entry): entry is Extract<typeof entry, { kind: 'scene' }> =>
            entry.kind === 'scene' && entry.sceneId === sceneId
    );
    const ref = node?.next ?? '';
    const choice = ref.startsWith('choice:')
        ? choices[ref.slice('choice:'.length)]
        : undefined;
    if (!choice?.options.length) {
        throw new Error(
            `reader-crossroads.spec.ts: "${sceneId}" must end at a choice`
        );
    }
    return choice;
}

const VARIANTS = [
    {
        key: 'one-option',
        sceneId: 'b1a_b2a_act8',
        lastLine: oneOptionDialogue.length,
    },
    { key: 'two-option', sceneId: 'act3', lastLine: act3Dialogue.length },
    {
        key: 'three-option',
        sceneId: 'b1b_act8',
        lastLine: threeOptionDialogue.length,
    },
    {
        key: 'four-option',
        sceneId: 'b1a_b2b_b3b_b4b_b5a_act70',
        lastLine: fourOptionDialogue.length,
    },
].map(variant => ({ ...variant, choice: choiceAfter(variant.sceneId) }));

const EXPECTED_COUNTS: Record<string, number> = {
    'one-option': 1,
    'two-option': 2,
    'three-option': 3,
    'four-option': 4,
};
for (const variant of VARIANTS) {
    if (variant.choice.options.length !== EXPECTED_COUNTS[variant.key]) {
        throw new Error(
            `reader-crossroads.spec.ts: "${variant.sceneId}" should offer ` +
                `${EXPECTED_COUNTS[variant.key]} options`
        );
    }
}

const isDesktop = (projectName: string) => projectName === 'chromium';

const lastLineUrl = (sceneId: string, lastLine: number, locale = 'en') =>
    `/${locale}/reader?story=${STORY_ID}&scene=${sceneId}&dialogue=${lastLine}`;

const sceneUrl = (sceneId: string) => new RegExp(`[?&]scene=${sceneId}(?:&|$)`);

const dialogueUrl = (line: number) => new RegExp(`[?&]dialogue=${line}(?:&|$)`);

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const { scrollWidth, innerWidth } = await page.evaluate(() => {
        const browser = globalThis as unknown as {
            document: { documentElement: { scrollWidth: number } };
            innerWidth: number;
        };
        return {
            scrollWidth: browser.document.documentElement.scrollWidth,
            innerWidth: browser.innerWidth,
        };
    });
    expect(
        scrollWidth,
        'page must not overflow horizontally'
    ).toBeLessThanOrEqual(innerWidth + 1);
}

async function expectSafeAreaRule(back: Locator): Promise<void> {
    type StyleRule = {
        cssText: string;
        selectorText?: string;
        cssRules?: ArrayLike<StyleRule>;
    };
    const found = await back.evaluate(button => {
        const browser = globalThis as unknown as {
            document: {
                styleSheets: ArrayLike<{ cssRules: ArrayLike<StyleRule> }>;
            };
        };
        const footer = button.parentElement;
        if (!footer) return false;
        const applies = (selector: string): boolean => {
            try {
                return footer.matches(selector);
            } catch {
                return false;
            }
        };
        const scan = (rules: ArrayLike<StyleRule>): boolean => {
            for (const rule of Array.from(rules)) {
                if (
                    rule.selectorText &&
                    rule.cssText.includes('env(safe-area-inset-bottom)') &&
                    applies(rule.selectorText)
                ) {
                    return true;
                }
                if (rule.cssRules && scan(rule.cssRules)) return true;
            }
            return false;
        };
        for (const sheet of Array.from(browser.document.styleSheets)) {
            try {
                if (scan(sheet.cssRules)) return true;
            } catch {
                continue;
            }
        }
        return false;
    });
    expect(
        found,
        'expected an env(safe-area-inset-bottom) rule applied to the Crossroads footer'
    ).toBe(true);
}

test.describe('Crossroads choice overlay', () => {
    test('offers Choose only on the last line and never auto-opens the overlay', async ({
        page,
    }, testInfo) => {
        const variant = VARIANTS.find(entry => entry.key === 'two-option');
        expect(variant, 'two-option variant exists').toBeDefined();
        if (!variant) return;
        const desktop = isDesktop(testInfo.project.name);
        const choose = page.getByRole('button', {
            name: 'Choose',
            exact: true,
        });
        const dialog = page.getByTestId('crossroads-dialog');

        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine - 1), {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });
        if (desktop) {
            await page
                .getByRole('button', { name: 'Continue', exact: true })
                .click();
        } else {
            await expect(page.getByText('▼', { exact: true })).toBeVisible();
            await expect(choose).toHaveCount(0);
            await page
                .getByRole('button', { name: 'Tap to continue', exact: true })
                .tap();
        }

        await expect(page).toHaveURL(dialogueUrl(variant.lastLine));
        await expect(choose).toBeVisible();
        await expect(dialog).toHaveCount(0);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(choose).toBeVisible();
        await expect(dialog).toHaveCount(0);
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });
        await expect(choose).toBeVisible();
        await expect(dialog).toHaveCount(0);

        await openCrossroads(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(choose).toBeVisible();
        await expect(dialog).toHaveCount(0);
    });

    for (const variant of VARIANTS) {
        test(`fans ${variant.choice.options.length} route card(s) inside the viewport (${variant.key})`, async ({
            page,
        }, testInfo) => {
            await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
                waitUntil: 'domcontentloaded',
            });
            await page.addStyleTag({ content: TOOLBAR_STYLE });
            const dialog = await openCrossroads(page);
            await expect(
                dialog.getByRole('heading', { name: variant.choice.prompt })
            ).toBeVisible();

            const cards = dialog.getByTestId('crossroads-route');
            await expect(cards).toHaveCount(variant.choice.options.length);
            const count = await cards.count();
            const viewport = page.viewportSize();
            expect(viewport, 'viewport is measurable').not.toBeNull();
            if (!viewport) return;

            for (let index = 0; index < count; index += 1) {
                const card = cards.nth(index);
                await card.scrollIntoViewIfNeeded();
                const box = await card.boundingBox();
                expect(box, `route card ${index} is measurable`).not.toBeNull();
                if (!box) continue;
                expect(
                    box.height,
                    `route card ${index} hit area is at least 44px`
                ).toBeGreaterThanOrEqual(44);
                expect(box.x).toBeGreaterThanOrEqual(-1);
                expect(box.x + box.width).toBeLessThanOrEqual(
                    viewport.width + 1
                );
                expect(box.y).toBeGreaterThanOrEqual(-1);
                expect(box.y + box.height).toBeLessThanOrEqual(
                    viewport.height + 1
                );
            }

            const layout = await dialog
                .locator('.route-item')
                .evaluateAll(items =>
                    (
                        items as unknown as {
                            offsetTop: number;
                            offsetLeft: number;
                        }[]
                    ).map(item => ({
                        top: item.offsetTop,
                        left: item.offsetLeft,
                    }))
                );
            expect(layout).toHaveLength(count);
            for (let index = 1; index < layout.length; index += 1) {
                if (isDesktop(testInfo.project.name)) {
                    expect(
                        Math.abs(layout[index].top - layout[0].top),
                        `card ${index} shares the fan row`
                    ).toBeLessThanOrEqual(1);
                    expect(
                        layout[index].left,
                        `card ${index} sits right of card ${index - 1}`
                    ).toBeGreaterThan(layout[index - 1].left);
                } else {
                    expect(
                        layout[index].top,
                        `card ${index} stacks below card ${index - 1}`
                    ).toBeGreaterThan(layout[index - 1].top);
                }
            }

            const back = dialog.getByRole('button', {
                name: 'Back to the last line',
            });
            await back.scrollIntoViewIfNeeded();
            const backBox = await back.boundingBox();
            expect(backBox, 'back control is measurable').not.toBeNull();
            if (backBox) {
                expect(backBox.height).toBeGreaterThanOrEqual(44);
                expect(backBox.y + backBox.height).toBeLessThanOrEqual(
                    viewport.height + 1
                );
            }

            await expectNoHorizontalOverflow(page);
            await expectSafeAreaRule(back);

            await testInfo.attach(`crossroads-${variant.key}.png`, {
                body: await page.screenshot(),
                contentType: 'image/png',
            });
        });
    }

    test('focuses the heading, ignores Enter, and selects with digit keys 1-4', async ({
        page,
    }) => {
        const variant = VARIANTS.find(entry => entry.key === 'four-option');
        expect(variant, 'four-option variant exists').toBeDefined();
        if (!variant) return;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });

        let dialog = await openCrossroads(page);
        await expect(page.locator('#crossroads-title')).toBeFocused();

        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('crossroads-route')).toHaveCount(
            variant.choice.options.length
        );
        await expect(page).toHaveURL(sceneUrl(variant.sceneId));

        for (const [index, option] of variant.choice.options.entries()) {
            if (index > 0) {
                dialog = await openCrossroads(page);
            }
            await page.keyboard.press(String(index + 1));
            await expect(dialog).not.toBeVisible();
            await expect(page).toHaveURL(sceneUrl(option.nextScene));
            await expect(page).toHaveURL(dialogueUrl(1));

            if (index < variant.choice.options.length - 1) {
                await page.goBack();
                await expect(page).toHaveURL(sceneUrl(variant.sceneId));
                await expect(page).toHaveURL(dialogueUrl(variant.lastLine));
                await expect(page.getByTestId('crossroads-dialog')).toHaveCount(
                    0
                );
                await expect(
                    page.getByRole('button', { name: 'Choose', exact: true })
                ).toBeVisible();
            }
        }
    });

    test('closes on Escape, the backdrop and Back to the last line, restoring focus to Choose', async ({
        page,
    }) => {
        const variant = VARIANTS.find(entry => entry.key === 'two-option');
        expect(variant, 'two-option variant exists').toBeDefined();
        if (!variant) return;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });
        await page.addStyleTag({ content: TOOLBAR_STYLE });
        const choose = page.getByRole('button', {
            name: 'Choose',
            exact: true,
        });
        const dialog = page.getByTestId('crossroads-dialog');
        const readProgress = () =>
            page.evaluate(key => {
                const browser = globalThis as unknown as {
                    localStorage: { getItem(name: string): string | null };
                };
                return browser.localStorage.getItem(key);
            }, PROGRESS_KEY);
        const open = async (): Promise<Locator> => {
            await choose.press('Enter');
            await expect(dialog).toBeVisible();
            return dialog;
        };

        await expect(choose).toBeVisible();
        await expect.poll(readProgress, { timeout: 15_000 }).not.toBeNull();
        await page.waitForTimeout(600);
        const settled = await readProgress();

        await open();
        expect(await readProgress()).toBe(settled);
        await dialog.locator('#crossroads-title').click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        expect(await readProgress()).toBe(settled);
        await expect(choose).toBeFocused();
        await expect(page).toHaveURL(dialogueUrl(variant.lastLine));

        await open();
        await page
            .getByTestId('crossroads-scrim')
            .click({ position: { x: 8, y: 8 } });
        await expect(dialog).toHaveCount(0);
        expect(await readProgress()).toBe(settled);
        await expect(choose).toBeFocused();

        await open();
        await dialog
            .getByRole('button', { name: 'Back to the last line' })
            .click();
        await expect(dialog).toHaveCount(0);
        expect(await readProgress()).toBe(settled);
        await expect(choose).toBeFocused();
        await expect(page).toHaveURL(dialogueUrl(variant.lastLine));
    });

    test('selects a route once and updates the URL, progress and story map', async ({
        page,
    }, testInfo) => {
        const variant = VARIANTS.find(entry => entry.key === 'two-option');
        expect(variant, 'two-option variant exists').toBeDefined();
        if (!variant) return;
        const [taken, unread] = variant.choice.options;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });

        const crossroads = await openCrossroads(page);
        await expect(
            crossroads.getByRole('heading', { name: variant.choice.prompt })
        ).toBeVisible();
        await expect(page).toHaveURL(sceneUrl(variant.sceneId));
        await expect(page).toHaveURL(dialogueUrl(variant.lastLine));
        await selectCrossroadsRoute(crossroads, taken.label);

        await expect(page).toHaveURL(sceneUrl(taken.nextScene));
        await expect(page).toHaveURL(dialogueUrl(1));
        await expect(page.getByTestId('crossroads-dialog')).toHaveCount(0);
        await expect(page.getByTestId('reader-ready')).not.toHaveAttribute(
            'inert',
            ''
        );
        // The English primary line renders (not the zh fallback); the prefix
        // shows while the typewriter is still revealing the paragraph.
        await expect(
            page
                .getByTestId('reader-ready')
                .getByText('The air inside the car had gone still')
        ).toBeVisible();

        await expect
            .poll(async () =>
                page.evaluate(
                    ([key, story, scene]) => {
                        const raw = localStorage.getItem(key);
                        const map = raw ? JSON.parse(raw) : {};
                        const record = map[story] as
                            | { sceneId?: string; visited?: string[] }
                            | undefined;
                        return {
                            sceneId: record?.sceneId ?? null,
                            visited: record?.visited ?? [],
                            atScene:
                                record?.sceneId === scene &&
                                Array.isArray(record?.visited) &&
                                record.visited.includes(scene),
                        };
                    },
                    [PROGRESS_KEY, STORY_ID, taken.nextScene] as const
                )
            )
            .toEqual({
                sceneId: taken.nextScene,
                visited: expect.arrayContaining([
                    variant.sceneId,
                    taken.nextScene,
                ]),
                atScene: true,
            });

        const reader = new MobileReaderPage(page);
        if (isDesktop(testInfo.project.name)) {
            await page.getByLabel('Open reader settings').click();
            const settings = page.getByRole('dialog', {
                name: 'Reader settings',
            });
            await expect(settings).toBeVisible();
            await settings.getByRole('button', { name: 'Story map' }).click();
        } else {
            await reader.openMenu();
            await page.getByLabel('Open story map').click();
        }
        const sheet = page.getByRole('dialog', { name: 'Story map' });
        await expect(sheet).toBeVisible();
        const surface = page.getByTestId('story-map-surface');
        await expect(
            surface.getByRole('button', {
                name: `Not read yet — ${unread.label}`,
            })
        ).toBeVisible();
        await expect(
            surface.getByText('You are here', { exact: true })
        ).toBeVisible();
    });

    test('keeps the reader inert while open and interactive again on close', async ({
        page,
    }, testInfo) => {
        const variant = VARIANTS.find(entry => entry.key === 'two-option');
        expect(variant, 'two-option variant exists').toBeDefined();
        if (!variant) return;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });

        const dialog = await openCrossroads(page);
        await expect(dialog).toBeVisible();
        const ready = page.getByTestId('reader-ready');
        await expect(ready).toHaveAttribute('inert', '');
        await expect(ready).toHaveAttribute('aria-hidden', 'true');
        if (isDesktop(testInfo.project.name)) {
            await expect(
                page.locator('#reader-settings-trigger')
            ).toBeDisabled();
        }

        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(ready).not.toHaveAttribute('inert', '');
    });

    test('opens from a phone tap on the last line and a single tap on Choose while chrome is open', async ({
        page,
    }, testInfo) => {
        test.skip(isDesktop(testInfo.project.name));
        const variant = VARIANTS.find(entry => entry.key === 'two-option');
        expect(variant, 'two-option variant exists').toBeDefined();
        if (!variant) return;
        const reader = new MobileReaderPage(page);
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });
        const dialog = page.getByTestId('crossroads-dialog');

        await reader.tapLayer.tap();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

        await reader.menuButton.tap();
        await expect(reader.backToHomeLink).toBeVisible();
        const choose = page.getByRole('button', {
            name: 'Choose',
            exact: true,
        });
        const chooseBox = await choose.boundingBox();
        expect(chooseBox, 'phone Choose control is measurable').not.toBeNull();
        if (chooseBox) {
            expect(chooseBox.height).toBeGreaterThanOrEqual(44);
        }
        await choose.tap();
        await expect(dialog).toBeVisible();
    });

    test('renders the Japanese bilingual and furigana phone case after leaving mobile chrome open', async ({
        page,
    }, testInfo) => {
        test.skip(isDesktop(testInfo.project.name));
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-second-language:v1', 'en');
        });
        const sceneId = 'b1b_act8';
        await page.goto(
            lastLineUrl(sceneId, threeOptionDialogue.length, 'ja'),
            {
                waitUntil: 'domcontentloaded',
            }
        );
        await page.addStyleTag({ content: TOOLBAR_STYLE });
        await page.setViewportSize({ width: 390, height: 480 });
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });

        await page.getByRole('button', { name: 'メニューを開く' }).tap();
        await page.getByRole('button', { name: '選ぶ', exact: true }).tap();
        const dialog = page.getByTestId('crossroads-dialog');
        await expect(dialog).toBeVisible();

        const heading = dialog.locator('#crossroads-title');
        await expect(heading).toBeVisible();
        await expect(heading).toHaveAttribute('lang', 'ja');
        await expect(heading.locator('rt').first()).toHaveText('おやこ');

        const secondLines = dialog.getByTestId('second-line');
        await expect(secondLines).toHaveCount(4);
        await expect(
            secondLines.filter({
                hasText: 'Go with this family, or set out alone?',
            })
        ).toHaveAttribute('lang', 'en');
        await expect(
            secondLines.filter({ hasText: 'Head alone for the Misty Forest' })
        ).toHaveAttribute('lang', 'en');

        const cards = dialog.getByTestId('crossroads-route');
        await expect(cards).toHaveCount(3);
        const scrollport = dialog.locator('.overflow-y-auto');
        const portBox = await scrollport.boundingBox();
        expect(portBox, 'scrollport is measurable').not.toBeNull();
        if (!portBox) return;
        const viewport = page.viewportSize();
        expect(viewport, 'viewport is measurable').not.toBeNull();
        if (!viewport) return;

        const scrollMetrics = await scrollport.evaluate(element => {
            const node = element as unknown as {
                scrollHeight: number;
                clientHeight: number;
                scrollWidth: number;
                clientWidth: number;
                scrollTop: number;
            };
            return {
                scrollHeight: node.scrollHeight,
                clientHeight: node.clientHeight,
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
                scrollTop: node.scrollTop,
            };
        });
        expect(scrollMetrics.scrollHeight).toBeGreaterThan(
            scrollMetrics.clientHeight
        );
        expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(
            scrollMetrics.clientWidth + 1
        );
        const overflowY = await scrollport.evaluate(element => {
            const browser = globalThis as unknown as {
                getComputedStyle(el: unknown): { overflowY: string };
            };
            return browser.getComputedStyle(element).overflowY;
        });
        expect(overflowY).toMatch(/^(auto|scroll)$/);

        const readScrollTop = () =>
            scrollport.evaluate(
                element =>
                    (element as unknown as { scrollTop: number }).scrollTop
            );
        await scrollport.evaluate(element => {
            (element as unknown as { scrollTop: number }).scrollTop = 0;
        });
        const startTop = await readScrollTop();
        expect(startTop).toBeLessThanOrEqual(1);

        if (testInfo.project.name === 'mobile-safari') {
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
        } else {
            await page.mouse.move(
                portBox.x + portBox.width / 2,
                portBox.y + portBox.height / 2
            );
            await page.mouse.wheel(0, 4000);
        }
        await expect.poll(readScrollTop).toBeGreaterThan(startTop);
        const lastCard = cards.nth(2);
        await expect(lastCard).toBeInViewport();

        if (testInfo.project.name === 'mobile-safari') {
            await expect(lastCard).toBeFocused();
            await scrollport.evaluate(element => {
                (element as unknown as { scrollTop: number }).scrollTop = 0;
            });
        } else {
            await page.mouse.wheel(0, -4000);
        }
        await expect.poll(readScrollTop).toBeLessThanOrEqual(1);

        const headingBox = await heading.boundingBox();
        expect(headingBox).not.toBeNull();
        if (headingBox) {
            expect(headingBox.y).toBeGreaterThanOrEqual(portBox.y - 1);
            expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(
                portBox.y + portBox.height + 1
            );
        }

        for (let index = 0; index < 3; index += 1) {
            const card = cards.nth(index);
            await card.scrollIntoViewIfNeeded();
            const cardBox = await card.boundingBox();
            expect(cardBox, `route card ${index} is measurable`).not.toBeNull();
            if (!cardBox) continue;
            expect(cardBox.height).toBeGreaterThanOrEqual(44);
            expect(cardBox.x).toBeGreaterThanOrEqual(portBox.x - 1);
            expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
                portBox.x + portBox.width + 1
            );
            expect(cardBox.y).toBeGreaterThanOrEqual(portBox.y - 1);
            expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(
                portBox.y + portBox.height + 1
            );

            for (const label of [
                card.locator('span[lang="ja"]'),
                card.getByTestId('second-line'),
            ]) {
                const labelBox = await label.boundingBox();
                expect(labelBox).not.toBeNull();
                if (!labelBox) continue;
                expect(labelBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
                expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
                    cardBox.x + cardBox.width + 1
                );
                expect(labelBox.y).toBeGreaterThanOrEqual(cardBox.y - 1);
                expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(
                    cardBox.y + cardBox.height + 1
                );
                expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(
                    portBox.y + portBox.height + 1
                );
            }
        }

        await expectNoHorizontalOverflow(page);
        await testInfo.attach('crossroads-three-option-ja-bilingual.png', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
    });

    test('selects the single route through the shared chooseRoute helper', async ({
        page,
    }) => {
        const variant = VARIANTS.find(entry => entry.key === 'one-option');
        expect(variant, 'one-option variant exists').toBeDefined();
        if (!variant) return;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });
        const option = variant.choice.options[0];
        await chooseRoute(page, option.label);
        await expect(page).toHaveURL(sceneUrl(option.nextScene));
        await expect(page).toHaveURL(dialogueUrl(1));
    });

    test('tap selection on a route card navigates once', async ({
        page,
    }, testInfo) => {
        test.skip(isDesktop(testInfo.project.name));
        const variant = VARIANTS.find(entry => entry.key === 'three-option');
        expect(variant, 'three-option variant exists').toBeDefined();
        if (!variant) return;
        await page.goto(lastLineUrl(variant.sceneId, variant.lastLine), {
            waitUntil: 'domcontentloaded',
        });
        const option = variant.choice.options[1];
        const historyLength = () =>
            page.evaluate(
                () =>
                    (globalThis as unknown as { history: { length: number } })
                        .history.length
            );
        const before = await historyLength();
        await page.getByRole('button', { name: 'Choose', exact: true }).tap();
        const dialog = page.getByTestId('crossroads-dialog');
        await expect(dialog).toBeVisible();
        await dialog
            .getByTestId('crossroads-route')
            .filter({ hasText: option.label })
            .tap();
        await expect(dialog).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl(option.nextScene));
        await expect(page).toHaveURL(dialogueUrl(1));
        expect(await historyLength()).toBe(before + 1);
    });
});
