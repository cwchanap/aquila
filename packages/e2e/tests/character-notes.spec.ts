import { expect, test, type Locator, type Page } from '@playwright/test';
import { getTranslations } from '@aquila/stories/translations';
import { expectNoHorizontalOverflow } from './utils';

const t = getTranslations('en');
const notesT = t.notes;

const STORY_ID = 'train_adventure';
const PROGRESS_KEY = 'aquila:storyProgress:v1';
const MODE_KEY = 'aquila:reader-mode:v1';
const SEED_COUNT_KEY = 'aquila:e2e:character-notes-seeds';
// The dev server compiles story modules lazily; two parallel Playwright
// workers can stall its responses for >5s, so hydration and async data waits
// need more than Playwright's 5s default.
const ASYNC_LOAD_TIMEOUT = 15_000;

const readerUrl = (dialogue: number, scene = 'act1') =>
    `/en/reader?story=${STORY_ID}&scene=${scene}&dialogue=${dialogue}`;

const readerPosition = async (page: Page) => {
    const stored = await page.evaluate(
        key => JSON.parse(localStorage.getItem(key) ?? 'null'),
        PROGRESS_KEY
    );
    const record = stored?.[STORY_ID] ?? null;
    return {
        url: page.url(),
        sceneId: record?.sceneId ?? null,
        dialogueIndex: record?.dialogueIndex ?? null,
        visited: record?.visited ?? [],
        endings: record?.endings ?? [],
        finished: record?.finished ?? false,
    };
};

const currentLine = async (page: Page) => {
    const passage = page.locator('.passage-visible').first();
    await expect(passage).toBeVisible();
    return (await passage.innerText()).trim();
};

/** Persisted position only; URLs change with navigation by design. */
const savedPosition = async (page: Page) => {
    const { sceneId, dialogueIndex, visited, endings, finished } =
        await readerPosition(page);
    return { sceneId, dialogueIndex, visited, endings, finished };
};

async function seedInstantTyping(page: Page): Promise<void> {
    await page.addInitScript(() => {
        localStorage.setItem('aquila:reader-typing-speed:v1', 'instant');
    });
}

async function openDesktopNotes(page: Page) {
    await page.locator('#reader-notes-trigger').click();
    const sheet = page.getByRole('dialog', { name: notesT.title });
    await expect(sheet).toBeVisible();
    return sheet;
}

/**
 * Blur the sheet's first control so Enter/Space cannot activate Close. The
 * background reader must still refuse the same keys it uses to advance.
 */
async function expectKeyboardCannotAdvance(
    page: Page,
    sheet: Locator,
    line: string,
    position: Awaited<ReturnType<typeof readerPosition>>
): Promise<void> {
    await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur()
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace');

    await expect(sheet).toBeVisible();
    expect(page.url()).toBe(position.url);
    expect(await readerPosition(page)).toEqual(position);
    expect(await currentLine(page)).toBe(line);
}

test.describe('desktop character notes', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('opens and closes notes without moving the reader or leaking a later fact', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.goto(readerUrl(5));
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            page.getByText('Page 5 of 60', { exact: true })
        ).toBeVisible();

        await expect
            .poll(async () => (await readerPosition(page)).dialogueIndex)
            .toBe(4);
        const position = await readerPosition(page);
        const line = await currentLine(page);
        expect(position.sceneId).toBe('act1');

        const notesTrigger = page.locator('#reader-notes-trigger');
        await expect(notesTrigger).toBeVisible();
        const notesBox = await notesTrigger.boundingBox();
        const settingsBox = await page
            .locator('#reader-settings-trigger')
            .boundingBox();
        expect(notesBox).not.toBeNull();
        expect(settingsBox).not.toBeNull();
        expect(notesBox!.width).toBe(44);
        expect(notesBox!.height).toBe(44);
        expect(settingsBox!.width).toBe(44);
        expect(settingsBox!.height).toBe(44);
        // The Notes trigger is the sibling immediately left of Settings with
        // the same top. Plugins may add their own controls; geometry, not DOM
        // order, is the contract here.
        expect(Math.abs(notesBox!.y - settingsBox!.y)).toBeLessThanOrEqual(1);
        expect(settingsBox!.x - (notesBox!.x + notesBox!.width)).toBe(12);

        const sheet = await openDesktopNotes(page);
        await expect(sheet.getByText('Characters met: 1')).toBeVisible();
        await expect(
            sheet.getByRole('button', { name: /Li Jie/ })
        ).toContainText('0 Notes');
        await expect(
            sheet.getByRole('listitem', { name: notesT.locked })
        ).toHaveCount(2);
        await expect(sheet.getByText('Twenty-eight.')).toHaveCount(0);

        // One tab reaches the cast row; focus never leaves the sheet.
        await page.keyboard.press('Tab');
        expect(
            await page.evaluate(() =>
                document
                    .querySelector('[aria-labelledby="reader-notes-title"]')
                    ?.contains(document.activeElement)
            )
        ).toBe(true);

        await expectKeyboardCannotAdvance(page, sheet, line, position);

        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        await expect(notesTrigger).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);

        await openDesktopNotes(page);
        await page.locator('[data-testid="notes-scrim"]').click({
            position: { x: 4, y: 4 },
        });
        await expect(
            page.getByRole('dialog', { name: notesT.title })
        ).toHaveCount(0);
        await expect(notesTrigger).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);
    });

    test('unlocks the age fact exactly at the act1 marker boundary', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.goto(readerUrl(5));
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            page.getByText('Page 5 of 60', { exact: true })
        ).toBeVisible();

        let sheet = await openDesktopNotes(page);
        await expect(
            sheet.getByRole('button', { name: /Li Jie/ })
        ).toContainText('0 Notes');
        await expect(sheet.getByText('Twenty-eight.')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);

        // The age unlock marker applies to act1 entry index 5, so line 6 is
        // the first line on which the fact may appear.
        await page
            .getByTestId('reader-ready')
            .getByRole('button', { name: t.reader.continue })
            .click();
        await expect(
            page.getByText('Page 6 of 60', { exact: true })
        ).toBeVisible();
        await expect(page).toHaveURL(/dialogue=6/);

        sheet = await openDesktopNotes(page);
        await expect(
            sheet.getByRole('button', { name: /Li Jie/ })
        ).toContainText('1 Notes');
        await expect(sheet.getByText('Twenty-eight.')).toBeVisible();
        await expect(sheet.getByText('Act 1')).toBeVisible();
        await expect(
            sheet.getByRole('listitem', { name: notesT.locked })
        ).toHaveCount(1);
    });

    test('opens over the visual novel reader and blocks its arrow keys', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.addInitScript(key => {
            localStorage.setItem(key, 'visual');
        }, MODE_KEY);
        await page.goto(readerUrl(5));
        await expect(page.getByTestId('visual-novel-reader')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            page.getByText('Page 5 of 60', { exact: true })
        ).toBeVisible();

        const position = await readerPosition(page);
        const line = await currentLine(page);
        const sheet = await openDesktopNotes(page);

        await expect(sheet.getByText('Characters met: 1')).toBeVisible();
        // Portraits are optional: a validated release may show Li Jie's base
        // portrait, but a portrait must never carry a name in its alt text,
        // and unavailable portraits fall back to initials.
        await expect(sheet.locator('.characters img[alt=""]')).toHaveCount(
            await sheet.locator('.characters img').count()
        );
        expect(
            await sheet.locator('.characters img').count()
        ).toBeLessThanOrEqual(2);
        await expect(
            sheet.locator('.avatar').filter({ hasText: '?' }).first()
        ).toBeVisible();

        await expectKeyboardCannotAdvance(page, sheet, line, position);

        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        await expect(page.locator('#reader-notes-trigger')).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);
    });
});

test.describe('phone character notes', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
    });

    test('recovers focus if it is lost during sheet activation', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.goto(readerUrl(5));
        await expect(page.locator('.mobile-reader')).toBeVisible({
            timeout: 15_000,
        });
        await page.locator('#mobile-reader-menu-trigger').tap();
        await page.evaluate(closeLabel => {
            const loseFocusOnce = (event: FocusEvent) => {
                const target = event.target as HTMLElement;
                if (target.getAttribute('aria-label') !== closeLabel) return;
                document.removeEventListener('focusin', loseFocusOnce);
                target.blur();
            };
            document.addEventListener('focusin', loseFocusOnce);
        }, notesT.close);
        await page
            .getByRole('button', { name: notesT.title, exact: true })
            .tap();
        const sheet = page.getByRole('dialog', { name: notesT.title });
        await expect(
            sheet.getByRole('button', { name: notesT.close })
        ).toBeFocused();
    });

    test('opens from the auto-hiding text toolbar and handles the nested native detail', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.goto(readerUrl(5));
        await expect(page.locator('.mobile-reader')).toBeVisible({
            timeout: 15_000,
        });
        const line = await currentLine(page);
        await expect
            .poll(async () => (await readerPosition(page)).dialogueIndex)
            .toBe(4);
        const position = await readerPosition(page);

        // Ordinary phone text mode uses the toolbar entry, not a floating
        // button beside the hidden Settings trigger.
        await expect(page.locator('#reader-notes-trigger')).toHaveCount(0);
        const menuTrigger = page.locator('#mobile-reader-menu-trigger');
        await expect(menuTrigger).toBeVisible();
        await menuTrigger.tap();

        const toolbarNotes = page.getByRole('button', {
            name: notesT.title,
            exact: true,
        });
        await expect(toolbarNotes).toBeVisible();
        const toolbarBox = await toolbarNotes.boundingBox();
        expect(toolbarBox!.width).toBe(44);
        expect(toolbarBox!.height).toBe(44);
        await toolbarNotes.tap();

        const sheet = page.getByRole('dialog', { name: notesT.title });
        await expect(sheet).toBeVisible();
        const close = sheet.getByRole('button', { name: notesT.close });
        await expect(close).toBeFocused();
        await expect(menuTrigger).toHaveText('☰');
        await expect(sheet.getByText('Characters met: 1')).toBeVisible();
        await expect(close).toBeFocused();
        await expectNoHorizontalOverflow(page);
        // A tap on the sheet surface must not reach the background reader.
        await sheet.getByRole('heading', { name: notesT.title }).first().tap();
        expect(await currentLine(page)).toBe(line);

        const columns = await page
            .locator('.cast ul')
            .evaluate(
                element =>
                    getComputedStyle(element).gridTemplateColumns.split(/\s+/)
                        .length
            );
        expect(columns).toBe(3);
        const firstRowHeights = await sheet
            .locator('.cast li')
            .evaluateAll(items =>
                items.slice(0, 3).map(item => ({
                    row: item.getBoundingClientRect().height,
                    card: item.querySelector('button')!.getBoundingClientRect()
                        .height,
                }))
            );
        expect(firstRowHeights).toHaveLength(3);
        for (const { row, card } of firstRowHeights) {
            expect(card).toBeCloseTo(row, 1);
        }
        await expect(close).toBeFocused();

        const closeBox = await close.boundingBox();
        expect(closeBox!.width).toBeGreaterThanOrEqual(44);
        expect(closeBox!.height).toBeGreaterThanOrEqual(44);

        // Focus wraps within the outer sheet: Shift+Tab from the first
        // control leaves the sheet's own content, and Tab returns to Close.
        await page.keyboard.press('Shift+Tab');
        expect(
            await sheet.evaluate(element =>
                element.contains(document.activeElement)
            )
        ).toBe(true);
        expect(
            await page.evaluate(() =>
                document.activeElement?.getAttribute('aria-label')
            )
        ).not.toBe(notesT.close);
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();

        // The phone text leaf has its own window Enter/Space handler. It must
        // be inert while Notes is open, just like the desktop leaves.
        await expectKeyboardCannotAdvance(page, sheet, line, position);

        // Tap a met card: a native modal detail opens over the sheet.
        await sheet.getByRole('button', { name: /Li Jie/ }).tap();
        const detail = page.getByRole('dialog', { name: 'Li Jie' });
        await expect(detail).toBeVisible();
        const back = detail.getByRole('button', { name: notesT.back });
        await expect(back).toBeFocused();
        const backBox = await back.boundingBox();
        expect(backBox!.width).toBeGreaterThanOrEqual(44);
        expect(backBox!.height).toBeGreaterThanOrEqual(44);
        await page.keyboard.press('Tab');
        await expect(back).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(back).toBeFocused();

        // First Escape is the native dialog's cancel: it closes the detail
        // only, returning focus to the selected card.
        await page.keyboard.press('Escape');
        await expect(detail).toHaveCount(0);
        await expect(sheet).toBeVisible();
        await expect(
            sheet.getByRole('button', { name: /Li Jie/ })
        ).toBeFocused();

        // Second Escape closes the shared sheet and restores the persistent
        // toolbar trigger (the opener unmounted with the chrome).
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        await expect(menuTrigger).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);

        // Back inside the native detail also returns to the sheet.
        await menuTrigger.tap();
        await page
            .getByRole('button', { name: notesT.title, exact: true })
            .tap();
        await expect(sheet).toBeVisible();
        await expect(close).toBeFocused();
        await sheet.getByRole('button', { name: /Li Jie/ }).tap();
        await expect(detail).toBeVisible();
        await detail.getByRole('button', { name: notesT.back }).tap();
        await expect(detail).toHaveCount(0);
        await expect(sheet).toBeVisible();
        await expect(
            sheet.getByRole('button', { name: /Li Jie/ })
        ).toBeFocused();

        await close.tap();
        await expect(sheet).toHaveCount(0);
        await expect(menuTrigger).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);
    });

    test('shows the shared sheet over phone visual novel mode', async ({
        page,
    }) => {
        await seedInstantTyping(page);
        await page.addInitScript(key => {
            localStorage.setItem(key, 'visual');
        }, MODE_KEY);
        await page.goto(readerUrl(5));
        await expect(page.getByTestId('visual-novel-reader')).toBeVisible({
            timeout: 15_000,
        });
        const line = await currentLine(page);
        const position = await readerPosition(page);

        const notesTrigger = page.locator('#reader-notes-trigger');
        await expect(notesTrigger).toBeVisible();
        await expect(page.locator('#mobile-reader-menu-trigger')).toHaveCount(
            0
        );
        await notesTrigger.tap();

        const sheet = page.getByRole('dialog', { name: notesT.title });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText('Characters met: 1')).toBeVisible();
        await expectNoHorizontalOverflow(page);
        expect(
            await sheet.locator('.characters img').count()
        ).toBeLessThanOrEqual(2);
        await expect(sheet.locator('.characters img[alt=""]')).toHaveCount(
            await sheet.locator('.characters img').count()
        );

        await expectKeyboardCannotAdvance(page, sheet, line, position);

        const closeBox = await sheet
            .getByRole('button', { name: notesT.close })
            .boundingBox();
        expect(closeBox!.width).toBeGreaterThanOrEqual(44);
        expect(closeBox!.height).toBeGreaterThanOrEqual(44);

        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        await expect(notesTrigger).toBeFocused();
        expect(await readerPosition(page)).toEqual(position);
        expect(await currentLine(page)).toBe(line);
    });
});

test.describe('signed-out progress character notes', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('opens Characters from My Progress, returns and continues at the saved line', async ({
        page,
    }) => {
        // This journey performs two full page loads and a Back reload; lazy
        // dev-server compiles can push it beyond the 30s default.
        test.setTimeout(60_000);
        await page.addInitScript(
            ([key, countKey]) => {
                // Seed once per browser session. A separate sentinel survives
                // the progress key being deleted by the app, so a later
                // document cannot silently restore the fixture before the
                // assertions read the app's own saved state.
                const sentinel = 'aquila:e2e:character-notes-progress-seeded';
                if (sessionStorage.getItem(sentinel) === '1') return;
                sessionStorage.setItem(sentinel, '1');
                localStorage.setItem(countKey, '1');
                const now = Date.now();
                localStorage.setItem(
                    key,
                    JSON.stringify({
                        train_adventure: {
                            sceneId: 'act2',
                            dialogueIndex: 5,
                            updatedAt: now - 3_600_000,
                            finished: false,
                            endings: [],
                            visited: ['act1', 'act2'],
                        },
                        the_seventh_mirror: {
                            sceneId: 'ch2_act1',
                            dialogueIndex: 9,
                            updatedAt: now - 7_200_000,
                            finished: false,
                            endings: [],
                            visited: ['ch1_act1', 'ch2_act1'],
                        },
                    })
                );
            },
            [PROGRESS_KEY, SEED_COUNT_KEY] as const
        );
        await seedInstantTyping(page);
        await page.goto('/en/progress');
        await expect(page.getByTestId('count-started')).toContainText('2', {
            timeout: ASYNC_LOAD_TIMEOUT,
        });
        await expect
            .poll(() =>
                page.evaluate(key => localStorage.getItem(key), SEED_COUNT_KEY)
            )
            .toBe('1');

        const row = page.locator('a[data-story-id="train_adventure"]');
        const savedHref =
            '/en/reader?story=train_adventure&scene=act2&dialogue=6';
        await expect(row).toHaveAttribute('href', savedHref);
        const saved = await savedPosition(page);
        const seedCount = () =>
            page.evaluate(key => localStorage.getItem(key), SEED_COUNT_KEY);

        const chip = page.getByRole('link', { name: /Characters\s+8/ });
        await expect(chip).toBeVisible({ timeout: ASYNC_LOAD_TIMEOUT });
        await expect(chip).toHaveAttribute(
            'href',
            '/en/notes?story=train_adventure'
        );

        // Two sibling destinations inside the row wrapper; neither nests in
        // the other, so keyboard and screen-reader navigation stay separate.
        const siblings = await page.evaluate(() => {
            const rowLink = document.querySelector(
                'a[data-story-id="train_adventure"]'
            );
            const item = rowLink?.closest('li');
            const links = item ? [...item.querySelectorAll('a')] : [];
            return {
                count: links.length,
                nested: links.some(link =>
                    Boolean(link.parentElement?.closest('a'))
                ),
                names: links.map(link => link.textContent?.trim() ?? ''),
            };
        });
        expect(siblings.count).toBe(2);
        expect(siblings.nested).toBe(false);
        expect(siblings.names[1]).toMatch(/Characters\s+8/);

        const mirrorItem = page
            .locator('a[data-story-id="the_seventh_mirror"]')
            .locator('xpath=..');
        await expect(mirrorItem.locator('a')).toHaveCount(1);
        await expect(
            mirrorItem.getByRole('link', { name: /Characters/ })
        ).toHaveCount(0);

        await chip.click();
        await expect(page).toHaveURL('/en/notes?story=train_adventure');
        await expect(page.getByText('Characters met: 8')).toBeVisible({
            timeout: ASYNC_LOAD_TIMEOUT,
        });
        expect(await savedPosition(page)).toEqual(saved);
        expect(await seedCount()).toBe('1');
        await expect(page.locator('.cast button')).toHaveCount(16);
        await expect(
            page.locator('.cast button[aria-label="Unknown character"]')
        ).toHaveCount(8);
        await expect(page.locator('.characters img')).toHaveCount(0);
        await expect(page.locator('.avatar').first()).toHaveText('LJ');

        // Only the already-known canonical name may be in the page; the
        // other fifteen names stay hidden in text, aria, alt and URLs.
        const hiddenNames = [
            'Tanaka Kenta',
            'Suzuki Asuka',
            'Takahashi Misaki',
            'Sato Takumi',
            'Saito Ren',
            'Yamamoto Koji',
            'Ito Nana',
            'Ito Makoto',
            'Kobayashi Shota',
            'Kobayashi Tomoko',
            'Kobayashi Yudai',
            'Kobayashi Hina',
            'Nakamura Hayato',
            'Shimizu Emi',
            'Ling Mo',
        ];
        const pageHtml = await page.locator('body').innerHTML();
        for (const name of hiddenNames) {
            expect(pageHtml, `${name} must stay hidden`).not.toContain(name);
        }

        await page.goBack();
        await expect(page.getByTestId('count-started')).toContainText('2', {
            timeout: ASYNC_LOAD_TIMEOUT,
        });
        await expect(row).toHaveAttribute('href', savedHref);
        await expect(chip).toBeVisible({ timeout: ASYNC_LOAD_TIMEOUT });
        expect(await savedPosition(page)).toEqual(saved);
        expect(await seedCount()).toBe('1');

        await row.click();
        await expect(page).toHaveURL(
            /\/en\/reader\?story=train_adventure&scene=act2&dialogue=6/
        );
        await expect(page.getByTestId('reader-ready')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            page.getByText('Page 6 of 69', { exact: true })
        ).toBeVisible();
        expect(await savedPosition(page)).toEqual(saved);
        expect(await seedCount()).toBe('1');
    });
});
