import { expect, test, type Locator, type Page } from '@playwright/test';
import { getTranslations, type Locale } from '@aquila/stories/translations';
import { elevatorGameFlow } from '../../stories/src/generated/elevatorGame/flow';
import { scene as act3Dialogue } from '../../stories/src/generated/elevatorGame/scenes/en/act3';
import { scene as endingDialogue } from '../../stories/src/generated/elevatorGame/scenes/en/b1a_act4';
import { elevatorGameChoiceTextEn } from '../../stories/src/stories/elevatorGame/choices.en';
import { buildChoiceMap } from '../../stories/src/stories/choice-utils';
import { VARIANTS } from './support/train-adventure-choices';
import {
    expectNoHorizontalOverflow,
    MobileReaderPage,
    openCrossroads,
    selectCrossroadsRoute,
} from './utils';

const STORY_ID = 'elevator_game';
const CHOICE_SCENE_ID = 'act3';

const flow = elevatorGameFlow;
const choiceScene = flow.nodes.find(
    (node): node is Extract<typeof node, { kind: 'scene' }> =>
        node.kind === 'scene' && node.sceneId === CHOICE_SCENE_ID
);
const choiceRef = choiceScene?.next ?? '';
const choiceId = choiceRef.startsWith('choice:')
    ? choiceRef.slice('choice:'.length)
    : '';
const choices = buildChoiceMap(flow, elevatorGameChoiceTextEn);
const sceneDialogue = act3Dialogue;
const maybeChoice = choiceId ? choices[choiceId] : undefined;
if (
    !sceneDialogue?.length ||
    !maybeChoice ||
    !maybeChoice.options[0] ||
    !maybeChoice.options[1]
) {
    throw new Error(
        `story-map.spec.ts: "${STORY_ID}" must expose scene "${CHOICE_SCENE_ID}" ` +
            'with dialogue ending at a two-option choice.'
    );
}
const choice = maybeChoice;
const [takenOption, unreadOption] = choice.options;
const LAST_LINE = sceneDialogue.length;
const DECISION_NAME = `Decision · ${choice.options.length} options`;
const JUMP_TO_DECISION = 'Jump to this decision';
const MENU_TRIGGER = '#mobile-reader-menu-trigger';
const SETTINGS_TRIGGER = '#reader-settings-trigger';
const TRAIN_VISITED = [
    'act1',
    'act2',
    'act3',
    'b1a_act4',
    'b1a_act5',
    'b1a_act6',
    'b1a_b2a_act7',
    'b1a_b2a_act8',
    'b1a_b2b_act7',
    'b1b_act4',
];
const TRAIN_CURRENT = 'b1a_b2a_act8';
const CURRENT_CAPTION = 'You are here';
const LOCATE_CURRENT = 'Locate current position';

const t = {
    closeStoryMap: 'Close story map',
    unread: 'Not read yet',
} as const;

const readerUrl = (sceneId: string, dialogue: number) =>
    `/en/reader?story=${STORY_ID}&scene=${sceneId}&dialogue=${dialogue}`;

const sceneUrl = (sceneId: string) => new RegExp(`[?&]scene=${sceneId}(?:&|$)`);

const isDesktop = (projectName: string) => projectName === 'chromium';

async function openStoryMap(
    page: Page,
    projectName: string,
    locale: Locale = 'en'
): Promise<Locator> {
    const reader = getTranslations(locale).reader;
    const storyMap = reader.storyMap;
    if (isDesktop(projectName)) {
        await page.getByLabel(reader.openSettings).click();
        const settings = page.getByRole('dialog', {
            name: reader.settingsTitle,
        });
        await expect(settings).toBeVisible();
        await settings.getByRole('button', { name: storyMap.title }).click();
    } else {
        await page.getByLabel(reader.openMenu).click();
        await page.getByLabel(storyMap.open).click();
    }
    const sheet = page.getByRole('dialog', { name: storyMap.title });
    await expect(sheet).toBeVisible();
    return sheet;
}

async function readThroughChoice(page: Page): Promise<void> {
    await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
    const crossroads = await openCrossroads(page);
    await expect(
        crossroads.getByRole('heading', { name: choice.prompt })
    ).toBeVisible();
    await selectCrossroadsRoute(crossroads, takenOption.label);
    await expect(page).toHaveURL(sceneUrl(takenOption.nextScene));
}

const TRAIN_STORY_ID = 'train_adventure';
const JUMP_TO_ENDING = 'Read this ending again';
const DESKTOP_CARD_HEIGHT = 84;
const MOBILE_CARD_HEIGHT = 92;

async function expectMobileCurrentLayout(card: Locator): Promise<void> {
    const details = card.locator('h3').locator('..');
    const act = details.locator('p').nth(0);
    const line = details.locator('p').nth(1);
    const stats = card.locator('ul li');
    await expect(act).toBeVisible();
    await expect(line).toBeVisible();
    await expect(stats).toHaveCount(3);
    const actBox = await act.boundingBox();
    const lineBox = await line.boundingBox();
    expect(actBox).not.toBeNull();
    expect(lineBox).not.toBeNull();
    if (!actBox || !lineBox)
        throw new Error('Current position is not measurable');
    expect(
        Math.abs(actBox.y + actBox.height / 2 - lineBox.y - lineBox.height / 2)
    ).toBeLessThanOrEqual(3);
    let previousRight = -Infinity;
    for (const stat of await stats.all()) {
        await expect(stat).toBeVisible();
        const count = await stat.locator('strong').boundingBox();
        const label = await stat.locator('span').boundingBox();
        expect(count).not.toBeNull();
        expect(label).not.toBeNull();
        if (!count || !label)
            throw new Error('Current stats are not measurable');
        expect(count.y).toBeGreaterThanOrEqual(actBox.y + actBox.height - 1);
        expect(
            Math.abs(count.y + count.height / 2 - label.y - label.height / 2)
        ).toBeLessThanOrEqual(3);
        expect(count.x).toBeGreaterThan(previousRight);
        previousRight = label.x + label.width;
    }
}

type TrainVariant = (typeof VARIANTS)[number];

function trainVariant(key: string): TrainVariant {
    const variant = VARIANTS.find(entry => entry.key === key);
    if (!variant) {
        throw new Error(
            `story-map.spec.ts: missing "${key}" train_adventure fixture`
        );
    }
    return variant;
}

const TRAIN = {
    one: trainVariant('one-option'),
    two: trainVariant('two-option'),
    three: trainVariant('three-option'),
    four: trainVariant('four-option'),
} as const;

/** Seeds a passed choice through the shared progress fixture: the preceding
 * scene and at least one child must be visited or buildStoryMap hides it. */
async function seedTrainMap(
    page: Page,
    sceneIds: string[],
    currentSceneId: string,
    endings: string[] = [],
    locale: Locale = 'en'
): Promise<void> {
    await new MobileReaderPage(page).seedVisitedScenes(
        TRAIN_STORY_ID,
        sceneIds,
        currentSceneId,
        endings
    );
    await page.goto(
        `/${locale}/reader?story=${TRAIN_STORY_ID}&scene=${currentSceneId}&dialogue=1`,
        { waitUntil: 'domcontentloaded' }
    );
    await expect(page.getByTestId('reader-ready')).toBeVisible({
        timeout: 15_000,
    });
}

/** Localized labels for the bounded zh/ja coverage: the map node and the
 * status-card heading format the four-option decision slightly differently in
 * Japanese, and the ending is the actFinal scene of the train fixture. */
function localizedStoryMapText(locale: Locale) {
    const reader = getTranslations(locale).reader;
    const storyMap = reader.storyMap;
    const options = storyMap.options.other.replace('{n}', '4');
    return {
        storyMap,
        decisionNodeName: storyMap.decisionNode
            .replace('{decision}', storyMap.decision)
            .replace('{options}', options),
        decisionHeading: `${storyMap.decision} · ${options}`,
        endingHeading: storyMap.endingLabel.replace('{label}', reader.actFinal),
    };
}

interface SurfaceState {
    x: number;
    y: number;
    width: number;
    height: number;
    scrollLeft: number;
    scrollTop: number;
    scrollWidth: number;
    scrollHeight: number;
    svgWidth: number;
    svgHeight: number;
}

async function readSurfaceState(surface: Locator): Promise<SurfaceState> {
    return surface.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const svg = element.querySelector('svg');
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
            svgWidth: Number(svg?.getAttribute('width') ?? 0),
            svgHeight: Number(svg?.getAttribute('height') ?? 0),
        };
    });
}

/** Waits for the opening auto-scroll to stop before geometry comparisons. */
async function settleMapSurface(
    page: Page,
    surface: Locator
): Promise<SurfaceState> {
    let previous = await readSurfaceState(surface);
    for (let attempt = 0; attempt < 60; attempt += 1) {
        await page.evaluate(
            () =>
                new Promise<void>(resolve => {
                    const browser = globalThis as unknown as {
                        requestAnimationFrame(callback: () => void): number;
                    };
                    browser.requestAnimationFrame(() =>
                        browser.requestAnimationFrame(() => resolve())
                    );
                })
        );
        const next = await readSurfaceState(surface);
        const stable = (Object.keys(previous) as (keyof SurfaceState)[]).every(
            key => previous[key] === next[key]
        );
        if (stable) return next;
        previous = next;
    }
    throw new Error('story-map.spec.ts: story map surface did not settle');
}

interface CardMetrics {
    x: number;
    y: number;
    width: number;
    height: number;
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
}

async function readCardMetrics(card: Locator): Promise<CardMetrics> {
    const box = await card.boundingBox();
    if (!box) {
        throw new Error('story-map.spec.ts: status card has no bounding box');
    }
    const scroll = await card.evaluate(element => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
    }));
    return { ...box, ...scroll };
}

function expectCardFits(card: CardMetrics, height: number): void {
    expect(Math.abs(card.height - height)).toBeLessThanOrEqual(1);
    // One device pixel of sub-pixel rounding is not silent clipping.
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1);
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
}

async function expectHeadingUnclipped(heading: Locator): Promise<void> {
    const size = await heading.evaluate(element => ({
        scroll: element.scrollWidth,
        client: element.clientWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
}

async function expectActionInsideCard(
    action: Locator,
    card: Locator
): Promise<void> {
    const actionBox = await action.boundingBox();
    const cardBox = await card.boundingBox();
    expect(actionBox, 'card action is measurable').not.toBeNull();
    expect(cardBox, 'status card is measurable').not.toBeNull();
    if (!actionBox || !cardBox) return;
    expect(actionBox.height).toBeGreaterThanOrEqual(44);
    expect(actionBox.width).toBeGreaterThanOrEqual(44);
    const overflow = await action.evaluate(element => ({
        horizontal: element.scrollWidth - element.clientWidth,
        vertical: element.scrollHeight - element.clientHeight,
    }));
    expect(overflow.horizontal).toBeLessThanOrEqual(1);
    expect(overflow.vertical).toBeLessThanOrEqual(1);
    expect(actionBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(actionBox.y).toBeGreaterThanOrEqual(cardBox.y - 1);
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 1
    );
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(
        cardBox.y + cardBox.height + 1
    );
}

/** Activates a map node without letting Playwright scroll the surface first,
 * so the comparison isolates the selection itself. */
async function activateMapNode(node: Locator): Promise<void> {
    await node.evaluate(element => {
        (element as unknown as { click(): void }).click();
    });
}

async function expectDesktopHeaderOrder(sheet: Locator): Promise<void> {
    const title = await sheet.locator('#story-map-title').boundingBox();
    const card = await sheet.getByTestId('story-map-status-card').boundingBox();
    const close = await sheet
        .getByRole('button', { name: t.closeStoryMap })
        .boundingBox();
    expect(title).not.toBeNull();
    expect(card).not.toBeNull();
    expect(close).not.toBeNull();
    if (!title || !card || !close) return;
    expect(title.x + title.width).toBeLessThanOrEqual(card.x);
    expect(card.x + card.width).toBeLessThanOrEqual(close.x);
    expect(title.y).toBeLessThan(card.y + card.height);
    expect(card.y).toBeLessThan(close.y + close.height);
}

async function expectDecisionChip(
    chip: Locator,
    expected: { status: string; label: string; dot: string }
): Promise<void> {
    await expect(
        chip.getByText(`${expected.status} — ${expected.label}`, {
            exact: true,
        })
    ).toHaveCount(1);
    await expect(chip.locator('[aria-hidden="true"]')).toHaveCount(2);
    const dot = await chip
        .locator('span')
        .first()
        .evaluate(element => {
            const browser = globalThis as unknown as {
                getComputedStyle(target: unknown): {
                    backgroundColor: string;
                    borderStyle: string;
                };
            };
            const style = browser.getComputedStyle(element);
            return {
                className:
                    typeof element.className === 'string'
                        ? element.className
                        : '',
                background: style.backgroundColor,
                borderStyle: style.borderStyle,
            };
        });
    expect(dot.className).toContain(expected.dot);
    if (expected.dot === 'border-dotted') {
        expect(dot.borderStyle).toBe('dotted');
        expect(dot.background).toBe('rgba(0, 0, 0, 0)');
    } else {
        expect(dot.background).not.toBe('rgba(0, 0, 0, 0)');
    }
}

async function expectCurrentCaptionInsideSurface(
    surface: Locator,
    message: string
): Promise<void> {
    const caption = surface.getByText(CURRENT_CAPTION, { exact: true });
    await expect(caption).toBeVisible();
    await expect
        .poll(
            async () => {
                const usable = await surface.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    return {
                        left: rect.left + element.clientLeft,
                        right:
                            rect.left +
                            element.clientLeft +
                            element.clientWidth,
                        top: rect.top + element.clientTop,
                        bottom:
                            rect.top + element.clientTop + element.clientHeight,
                    };
                });
                const box = await caption.boundingBox();
                if (!box) return false;
                return (
                    box.x >= usable.left - 0.5 &&
                    box.x + box.width <= usable.right + 0.5 &&
                    box.y >= usable.top - 0.5 &&
                    box.y + box.height <= usable.bottom + 0.5
                );
            },
            { message }
        )
        .toBe(true);
}

test.describe('Story map', () => {
    test('places the desktop title before the status card and close button', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop header layout');
        await page.goto(readerUrl('act1', 0));
        const sheet = await openStoryMap(page, testInfo.project.name);
        await expectDesktopHeaderOrder(sheet);
    });

    for (const mode of ['text', 'visual']) {
        test(`completes an ending, remembers it in the catalogue, and resumes in ${mode} mode`, async ({
            page,
        }, testInfo) => {
            test.setTimeout(60_000);
            await page.addInitScript(
                mode => localStorage.setItem('aquila:reader-mode:v1', mode),
                mode
            );
            await page.goto(readerUrl('b1a_act4', endingDialogue.length - 1), {
                waitUntil: 'domcontentloaded',
            });
            await expect(page.getByTestId('reader-ready')).toBeVisible();
            // Astro's development toolbar covers the visual footer on mobile.
            await page.addStyleTag({
                content: 'astro-dev-toolbar { display: none !important; }',
            });
            const advance =
                mode === 'text' && !isDesktop(testInfo.project.name)
                    ? page.getByRole('button', {
                          name: 'Tap to continue',
                          exact: true,
                      })
                    : page.getByRole('button', {
                          name: 'Continue',
                          exact: true,
                      });
            await advance.click();
            await expect(
                page.getByText('Complete', { exact: true })
            ).toBeVisible();
            const complete =
                mode === 'text' && !isDesktop(testInfo.project.name)
                    ? advance
                    : page.getByRole('button', {
                          name: 'Complete',
                          exact: true,
                      });
            await complete.click();
            const ending = page.getByRole('dialog', { name: 'Ending Act 4' });
            await expect(ending).toBeVisible();
            await expect(ending).toContainText('The Elevator Game');
            await expect(page.getByTestId('reader-ready')).toHaveAttribute(
                'inert',
                ''
            );
            await ending
                .getByRole('button', { name: 'Read this ending again' })
                .click();
            await expect(page).toHaveURL(/scene=b1a_act4&dialogue=1(?![0-9])/);
            await expect(ending).not.toBeVisible();
            await page.goto(readerUrl('b1a_act4', endingDialogue.length), {
                waitUntil: 'domcontentloaded',
            });
            await page.addStyleTag({
                content: 'astro-dev-toolbar { display: none !important; }',
            });
            await expect(
                page.getByText('Complete', { exact: true })
            ).toBeVisible();
            await complete.click();
            await ending
                .getByRole('button', { name: 'Story map', exact: true })
                .click();
            const map = page.getByRole('dialog', {
                name: 'Story map',
                exact: true,
            });
            await expect(map).toBeVisible();
            await expect(map.locator(':focus')).toHaveCount(1);
            await expect(map).toContainText('Explored acts');
            await expect(map.locator('[data-kind="ending"]')).toHaveCount(1);
            await page
                .getByRole('button', { name: 'Close story map', exact: true })
                .click();
            await complete.click();
            await ending.getByRole('link', { name: 'Back to stories' }).click();
            const card = page.locator('[data-story-id="elevator_game"]');
            await expect(card).toContainText('1 of 2 endings');

            await page.goto('/en/reader?story=elevator_game', {
                waitUntil: 'domcontentloaded',
            });
            await expect(page).toHaveURL(
                new RegExp(`scene=b1a_act4&dialogue=${endingDialogue.length}`)
            );
            await expect(
                page.getByText('Complete', { exact: true })
            ).toBeVisible();
            await page.goto('/en/stories', { waitUntil: 'domcontentloaded' });
            await expect(card).toContainText('1 of 2 endings');
            await card.click();
            await expect(page).toHaveURL(/scene=act1&dialogue=1(?![0-9])/);
        });
    }

    test('keeps the unchosen route unread and jumps back to the choice prompt', async ({
        page,
    }, testInfo) => {
        await page.setViewportSize(
            isDesktop(testInfo.project.name)
                ? { width: 1440, height: 900 }
                : { width: 390, height: 844 }
        );
        await readThroughChoice(page);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');

        const unreadNode = surface.getByRole('button', {
            name: `${t.unread} — ${unreadOption.label}`,
        });
        await expect(unreadNode).toBeVisible();
        await expect(unreadNode).toContainText('?');

        await surface.getByRole('button', { name: DECISION_NAME }).click();
        const statusCard = page.getByTestId('story-map-status-card');
        await expect(statusCard.getByText(choice.prompt)).toBeVisible();
        const jump = statusCard.getByRole('button', { name: JUMP_TO_DECISION });
        await expect(jump).toBeVisible();
        await expectHeadingUnclipped(
            statusCard.getByRole('heading', { name: DECISION_NAME })
        );
        const cardMetrics = await readCardMetrics(statusCard);
        expectCardFits(
            cardMetrics,
            isDesktop(testInfo.project.name)
                ? DESKTOP_CARD_HEIGHT
                : MOBILE_CARD_HEIGHT
        );
        await expectActionInsideCard(jump, statusCard);
        if (isDesktop(testInfo.project.name)) {
            expect(cardMetrics.width).toBeLessThanOrEqual(700);
            await expectDesktopHeaderOrder(sheet);
        } else {
            const prompt = await statusCard
                .getByText(choice.prompt)
                .boundingBox();
            expect(prompt?.width).toBeGreaterThanOrEqual(190);
        }
        await testInfo.attach('story-map-decision-follow-up.png', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
        await jump.click({ position: { x: 24, y: 22 } });
        await expect(sheet).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl(CHOICE_SCENE_ID));
        await expect(page).toHaveURL(
            new RegExp(`[?&]dialogue=${LAST_LINE}(?:&|$)`)
        );
        await expect(
            page.locator(
                isDesktop(testInfo.project.name)
                    ? SETTINGS_TRIGGER
                    : MENU_TRIGGER
            )
        ).toBeFocused();
        await expect(
            page.getByRole('button', { name: 'Choose', exact: true })
        ).toBeVisible();
        const crossroads = await openCrossroads(page);
        await expect(
            crossroads.getByRole('heading', { name: choice.prompt })
        ).toBeVisible();
        await expect(
            crossroads
                .getByTestId('crossroads-route')
                .filter({ hasText: takenOption.label })
        ).toBeVisible();
        await expect(
            crossroads
                .getByTestId('crossroads-route')
                .filter({ hasText: unreadOption.label })
        ).toBeVisible();
    });

    test('cancelling Crossroads restores focus to Choose without navigating', async ({
        page,
    }) => {
        await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
        const crossroads = await openCrossroads(page);
        await page.keyboard.press('Escape');
        await expect(crossroads).not.toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Choose', exact: true })
        ).toBeFocused();
        await expect(page).toHaveURL(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
    });

    test('centers a short graph and keeps its choice labels clear of the decision', async ({
        page,
    }, testInfo) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await readThroughChoice(page);
        await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const boxes = await surface.evaluate((root, label) => {
            const decision = root.querySelector('[data-kind="decision"]');
            const routeLabel = [
                ...root.querySelectorAll('[data-edge-label]'),
            ].find(el => el.textContent?.trim() === label);
            const graph = root.firstElementChild;
            if (!decision || !routeLabel || !graph) return null;
            return {
                decision: decision.getBoundingClientRect().toJSON(),
                label: routeLabel.getBoundingClientRect().toJSON(),
                graph: graph.getBoundingClientRect().toJSON(),
                surface: root.getBoundingClientRect().toJSON(),
            };
        }, takenOption.label);
        expect(boxes).not.toBeNull();
        expect(boxes!.label.left).toBeGreaterThanOrEqual(boxes!.decision.right);
        if (boxes!.graph.height < boxes!.surface.height) {
            expect(
                Math.abs(
                    boxes!.graph.y +
                        boxes!.graph.height / 2 -
                        (boxes!.surface.y + boxes!.surface.height / 2)
                )
            ).toBeLessThan(2);
        }
    });

    test('shows the next unread marker next to the current act on open', async ({
        page,
    }, testInfo) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await readThroughChoice(page);
        await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const next = surface.getByRole('button', {
            name: `${t.unread} — ${takenOption.label}`,
        });
        await expect
            .poll(async () => {
                const viewport = await surface.boundingBox();
                const marker = await next.boundingBox();
                return !!(
                    viewport &&
                    marker &&
                    marker.x >= viewport.x &&
                    marker.x + marker.width <= viewport.x + viewport.width
                );
            })
            .toBe(true);
    });

    test('paints the taken route as a gradient, not a flat stroke', async ({
        page,
    }, testInfo) => {
        await readThroughChoice(page);
        await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const routePaths = surface.locator('path[data-edge-status="route"]');
        await expect(routePaths.first()).toHaveAttribute(
            'stroke',
            'url(#story-map-route)'
        );
        expect(await routePaths.count()).toBeGreaterThanOrEqual(2);

        const raster = await surface.evaluate(async root => {
            const svg = root.querySelector('svg');
            if (!svg) return { ok: false as const, reason: 'missing svg' };
            const routePaths = Array.from(
                svg.querySelectorAll('path[data-edge-status="route"]')
            );
            if (routePaths.length === 0) {
                return { ok: false as const, reason: 'no route edges' };
            }
            const clone = svg.cloneNode(true) as Element;
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.querySelectorAll('text').forEach(el => {
                el.parentNode?.removeChild(el);
            });
            const xml = new XMLSerializer().serializeToString(clone);
            const width = Number(svg.getAttribute('width'));
            const height = Number(svg.getAttribute('height'));
            const image = new Image();
            await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () =>
                    reject(new Error('failed to rasterize the map svg'));
                image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
            });
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return { ok: false as const, reason: 'no 2d context' };
            ctx.drawImage(image, 0, 0, width, height);
            const segments: {
                x: number;
                y: number;
                r: number;
                g: number;
                b: number;
                a: number;
            }[][] = [];
            let skipped = 0;
            for (const path of routePaths) {
                const match = (path.getAttribute('d') ?? '').match(
                    /^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+L\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/
                );
                if (!match) {
                    skipped += 1;
                    continue;
                }
                const [x0, y0, x1, y1] = match.slice(1).map(Number);
                segments.push(
                    [0.2, 0.5, 0.8].map(fraction => {
                        const x = Math.round(x0 + (x1 - x0) * fraction);
                        const y = Math.round(y0 + (y1 - y0) * fraction);
                        const data = ctx.getImageData(x, y, 1, 1).data;
                        return {
                            x,
                            y,
                            r: data[0],
                            g: data[1],
                            b: data[2],
                            a: data[3],
                        };
                    })
                );
            }
            return {
                ok: true as const,
                total: routePaths.length,
                skipped,
                segments,
            };
        });
        if (!raster.ok) {
            throw new Error(
                `story-map.spec.ts: cannot rasterize the map — ${raster.reason}`
            );
        }
        expect(raster.total).toBeGreaterThanOrEqual(2);
        expect(raster.segments.length).toBe(raster.total - raster.skipped);
        expect(raster.segments.length).toBeGreaterThan(0);
        for (const segment of raster.segments) {
            const [start, middle, end] = segment;
            for (const pixel of segment) {
                expect(pixel.a).toBeGreaterThan(200);
                expect(pixel.b).toBeGreaterThan(180);
                expect(pixel.r).toBeLessThan(90);
            }
            expect(middle.g).toBeGreaterThan(start.g);
            expect(end.g).toBeGreaterThan(middle.g);
        }
    });

    test('closes the sheet when a pointer hits the desktop backdrop', async ({
        page,
    }, testInfo) => {
        test.skip(
            !isDesktop(testInfo.project.name),
            'the sheet fills the phone viewport, leaving no visible backdrop'
        );
        await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
        await expect(
            page.getByRole('button', { name: 'Choose', exact: true })
        ).toBeVisible();
        const sheet = await openStoryMap(page, testInfo.project.name);

        const box = await sheet.boundingBox();
        if (!box) {
            throw new Error('story-map.spec.ts: sheet has no bounding box');
        }
        const point = {
            x: Math.max(4, Math.floor(box.x / 2)),
            y: Math.floor(box.y + box.height / 2),
        };
        const hit = await page.evaluate(
            ([px, py]: [number, number]) => {
                const el = document.elementFromPoint(px, py);
                if (!el) return null;
                return {
                    tag: el.tagName,
                    testid: el.getAttribute('data-testid'),
                    cls: typeof el.className === 'string' ? el.className : '',
                };
            },
            [point.x, point.y] as [number, number]
        );
        expect(hit?.tag).toBe('BUTTON');
        expect(hit?.testid).toBe('story-map-scrim');
        expect(hit?.cls).toContain('fixed inset-0');

        await page.mouse.click(point.x, point.y);
        await expect(sheet).not.toBeVisible();
        await expect(page.locator(SETTINGS_TRIGGER)).toBeFocused();
    });

    test('keeps the current-position caption inside the scrolled surface', async ({
        page,
    }, testInfo) => {
        const reader = new MobileReaderPage(page);
        await reader.seedVisitedScenes('train_adventure', TRAIN_VISITED);
        if (isDesktop(testInfo.project.name)) {
            await page.setViewportSize({ width: 1280, height: 600 });
        }
        await page.goto(
            `/en/reader?story=train_adventure&scene=${TRAIN_CURRENT}&dialogue=1`
        );
        await page.addStyleTag({
            content:
                '[data-testid="story-map-surface"] { scrollbar-gutter: stable; }',
        });
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        await expectCurrentCaptionInsideSurface(
            surface,
            'caption fully inside the surface after opening auto-scroll'
        );

        await surface.evaluate(el => {
            el.scrollTo({ left: 0 });
        });
        await sheet.getByRole('button', { name: LOCATE_CURRENT }).click();
        await expectCurrentCaptionInsideSurface(
            surface,
            'caption fully inside the surface after Locate current'
        );
    });

    test('moves focus into the sheet on a phone and restores it to the menu trigger', async ({
        page,
    }, testInfo) => {
        test.skip(
            isDesktop(testInfo.project.name),
            'the phone chrome opener only exists on mobile projects'
        );
        await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
        await expect(
            page.getByRole('button', { name: 'Choose', exact: true })
        ).toBeVisible();
        const sheet = await openStoryMap(page, testInfo.project.name);

        const focusInsideDialog = () =>
            page.evaluate(() => {
                const el = document.activeElement as Element | null;
                return el ? el.closest('[role="dialog"]') !== null : false;
            });
        await expect.poll(focusInsideDialog).toBe(true);

        await sheet.getByLabel(t.closeStoryMap).click();
        await expect(sheet).not.toBeVisible();
        await expect(page.locator(MENU_TRIGGER)).toBeFocused();
    });

    test('measures the 95vw sheet and one fixed-height status card at 1440 and 1024', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop geometry');
        test.setTimeout(60_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const taken = TRAIN.four.choice.options[0];
        await seedTrainMap(
            page,
            [TRAIN.four.sceneId, taken.nextScene],
            TRAIN.four.sceneId
        );
        await page.setViewportSize({ width: 1440, height: 900 });
        const sheet = await openStoryMap(page, testInfo.project.name);
        const card = sheet.getByTestId('story-map-status-card');
        const surface = page.getByTestId('story-map-surface');

        const expectSheetGeometry = async (size: {
            width: number;
            height: number;
        }) => {
            const box = await sheet.boundingBox();
            expect(box, 'sheet is measurable').not.toBeNull();
            if (!box) return;
            expect(Math.abs(box.width - size.width * 0.95)).toBeLessThanOrEqual(
                2
            );
            expect(
                Math.abs(box.height - size.height * 0.85)
            ).toBeLessThanOrEqual(2);
            await expect(
                sheet.getByTestId('story-map-status-card')
            ).toHaveCount(1);
            await expect(
                sheet.locator('aside, [data-testid="story-map-details"]')
            ).toHaveCount(0);
            await expectNoHorizontalOverflow(page);
            await expectDesktopHeaderOrder(sheet);
        };

        await expectSheetGeometry({ width: 1440, height: 900 });
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);

        const decision = surface.getByRole('button', {
            name: /^Decision · 4 options/,
        });
        await expect(decision).toHaveCount(1);
        await activateMapNode(decision);
        await expect(
            card.getByRole('heading', { name: /Decision · 4 options/i })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        await expectActionInsideCard(
            card.getByRole('button', { name: JUMP_TO_DECISION }),
            card
        );
        const wide = await readSurfaceState(surface);

        await page.setViewportSize({ width: 1024, height: 768 });
        await expectSheetGeometry({ width: 1024, height: 768 });
        const narrowCard = await readCardMetrics(card);
        expectCardFits(narrowCard, DESKTOP_CARD_HEIGHT);
        await expectActionInsideCard(
            card.getByRole('button', { name: JUMP_TO_DECISION }),
            card
        );
        const narrow = await readSurfaceState(surface);
        expect(narrow.svgWidth).toBe(wide.svgWidth);
        expect(narrow.svgHeight).toBe(wide.svgHeight);
        expect(narrowCard.width).toBeLessThanOrEqual(1024 * 0.65 + 1);
        await testInfo.attach('story-map-desktop-decision.png', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
    });

    test('keeps the map surface fixed across current, decision, unread and completed ending', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop geometry');
        test.setTimeout(60_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const [first, second] = TRAIN.four.choice.options;
        await seedTrainMap(
            page,
            [TRAIN.four.sceneId, first.nextScene, second.nextScene],
            first.nextScene,
            [first.nextScene]
        );
        await page.setViewportSize({ width: 1024, height: 768 });
        const sheet = await openStoryMap(page, testInfo.project.name);
        const card = sheet.getByTestId('story-map-status-card');
        const surface = page.getByTestId('story-map-surface');
        await expect(card).toHaveAttribute('aria-live', 'polite');
        await expect(card).toHaveAttribute('data-accent', 'route');
        await expect(
            card.getByText(CURRENT_CAPTION, { exact: true })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        const baseline = await settleMapSurface(page, surface);

        const expectSurfaceUnchanged = async () => {
            expect(await readSurfaceState(surface)).toEqual(baseline);
            expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        };

        await activateMapNode(
            surface.getByRole('button', { name: /^Decision · 4 options/ })
        );
        await expect(card).toHaveAttribute('data-accent', 'decision');
        await expect(card).toContainText(TRAIN.four.choice.prompt);
        await expect(card.locator('li')).toHaveCount(4);
        const chipList = card.locator('ul');
        const chipOverflow = await chipList.evaluate(element => ({
            width: element.scrollWidth - element.clientWidth,
            height: element.scrollHeight - element.clientHeight,
        }));
        expect(chipOverflow.width).toBeLessThanOrEqual(1);
        expect(chipOverflow.height).toBeLessThanOrEqual(1);
        await expectDecisionChip(card.locator('li').nth(0), {
            status: 'Your route',
            label: first.label,
            dot: 'bg-blue-500',
        });
        await expectDecisionChip(card.locator('li').nth(1), {
            status: 'Explored',
            label: second.label,
            dot: 'bg-teal-500',
        });
        for (const [index, option] of TRAIN.four.choice.options
            .slice(2)
            .entries()) {
            await expectDecisionChip(card.locator('li').nth(index + 2), {
                status: 'Not read yet',
                label: option.label,
                dot: 'border-dotted',
            });
        }
        await expectActionInsideCard(
            card.getByRole('button', { name: JUMP_TO_DECISION }),
            card
        );
        await expectSurfaceUnchanged();

        await activateMapNode(surface.locator('[data-kind="unknown"]').first());
        await expect(card).toHaveAttribute('data-accent', 'unread');
        await expect(card).toHaveText('Not read yet');
        await expect(
            card.getByRole('button', { name: /^Jump to/ })
        ).toHaveCount(0);
        await expect(card).not.toContainText(TRAIN.four.choice.prompt);
        await expectSurfaceUnchanged();

        await expect(surface.locator('[data-kind="ending"]')).toHaveCount(1);
        await activateMapNode(surface.locator('[data-kind="ending"]'));
        await expect(card).toHaveAttribute('data-accent', 'explored');
        await expect(
            card.getByRole('heading', { name: /^Ending / })
        ).toBeVisible();
        await expect(
            card.getByRole('button', { name: JUMP_TO_ENDING })
        ).toBeVisible();
        await expectSurfaceUnchanged();

        await sheet.getByRole('button', { name: LOCATE_CURRENT }).click();
        await expect(
            card.getByText(CURRENT_CAPTION, { exact: true })
        ).toBeVisible();
        await expect(card).toHaveAttribute('data-accent', 'route');
        await settleMapSurface(page, surface);
        await expectSurfaceUnchanged();
    });

    for (const key of ['two', 'three', 'four'] as const) {
        const variant = TRAIN[key];
        const optionCount = variant.choice.options.length;
        test(`shows ${optionCount} option decisions with status-dot chips`, async ({
            page,
        }, testInfo) => {
            test.skip(!isDesktop(testInfo.project.name), 'Desktop chips');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const [taken, ...unread] = variant.choice.options;
            await seedTrainMap(
                page,
                [variant.sceneId, taken.nextScene],
                variant.sceneId
            );
            const sheet = await openStoryMap(page, testInfo.project.name);
            const surface = page.getByTestId('story-map-surface');
            const card = sheet.getByTestId('story-map-status-card');
            const decision = surface.getByRole('button', {
                name: new RegExp(`^Decision · ${optionCount} option`),
            });
            await expect(decision).toHaveCount(1);
            await activateMapNode(decision);
            await expect(card.locator('li')).toHaveCount(optionCount);
            await expectDecisionChip(card.locator('li').nth(0), {
                status: 'Explored',
                label: taken.label,
                dot: 'bg-teal-500',
            });
            for (const [index, option] of unread.entries()) {
                await expectDecisionChip(card.locator('li').nth(index + 1), {
                    status: 'Not read yet',
                    label: option.label,
                    dot: 'border-dotted',
                });
            }
            expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        });
    }

    test('keeps a one-option choice a linear map link, not a decision card', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop map shape');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const variant = TRAIN.one;
        expect(variant.choice.options).toHaveLength(1);
        const next = variant.choice.options[0].nextScene;
        await seedTrainMap(page, [variant.sceneId, next], variant.sceneId);
        await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        await expect(page.getByTestId('story-map-status-card')).toContainText(
            CURRENT_CAPTION
        );
        await expect(
            surface.getByRole('button', { name: /^Decision · 1 option/ })
        ).toHaveCount(0);
        await expect(
            surface.getByRole('button', { name: /^Decision · 2 options/ })
        ).toHaveCount(2);

        const positions = await surface.evaluate(
            (root, [sceneId, childId]) => {
                const read = (id: string) => {
                    const element = root.querySelector(
                        `[data-node-id="${id}"]`
                    );
                    if (!element) return null;
                    const rect = element.getBoundingClientRect();
                    return { x: rect.x, y: rect.y, width: rect.width };
                };
                return { scene: read(sceneId), child: read(childId) };
            },
            [variant.sceneId, next] as const
        );
        expect(
            positions.scene,
            'one-option scene is on the map'
        ).not.toBeNull();
        expect(
            positions.child,
            'one-option child is on the map'
        ).not.toBeNull();
        if (!positions.scene || !positions.child) return;
        expect(positions.child.y).toBe(positions.scene.y);
        // sceneWidth 44 + sceneGap 16: the child is the next node on the row.
        expect(positions.child.x - positions.scene.x).toBe(60);
    });

    test('jumps to a run start with an unclipped action at the critical desktop width', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop jump semantics');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1024, height: 768 });
        const two = TRAIN.two;
        const child = two.choice.options[0].nextScene;
        await seedTrainMap(page, [two.sceneId, child], two.sceneId);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const card = sheet.getByTestId('story-map-status-card');
        await surface.getByRole('button', { name: /^Act 4/ }).click();
        await expect(
            card.getByRole('heading', { name: 'Act 4', exact: true })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        const jump = card.getByRole('button', { name: 'Jump to Act 4' });
        await expectActionInsideCard(jump, card);
        await jump.click();
        await expect(sheet).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl(child));
        await expect(page).toHaveURL(/[?&]dialogue=1(?:&|$)/);
        await expect(page.locator(SETTINGS_TRIGGER)).toBeFocused();
    });

    test('folds a run and jumps to a scene start with an unclipped action at the critical desktop width', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop jump semantics');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1024, height: 768 });
        const four = TRAIN.four;
        const endingScene = four.choice.options[0].nextScene;
        await seedTrainMap(page, [four.sceneId, endingScene], endingScene, [
            endingScene,
        ]);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const card = sheet.getByTestId('story-map-status-card');
        await surface
            .getByRole('button', { name: 'Expand Acts 1–3', exact: true })
            .click();
        await expect(
            card.getByRole('heading', { name: 'Acts 1–3', exact: true })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        await expectActionInsideCard(
            card.getByRole('button', { name: 'Jump to Acts 1–3' }),
            card
        );
        await surface
            .getByRole('button', { name: 'Collapse Acts 1–3' })
            .click();
        const folded = surface.getByRole('button', {
            name: 'Expand Acts 1–3',
            exact: true,
        });
        await expect(folded).toBeVisible();
        await expect(folded).toBeFocused();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        await folded.click();
        await surface
            .getByRole('button', { name: 'Act 2', exact: true })
            .click();
        await expect(
            card.getByRole('heading', { name: 'Act 2', exact: true })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        const jump = card.getByRole('button', { name: 'Jump to Act 2' });
        await expectActionInsideCard(jump, card);
        await jump.click();
        await expect(sheet).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl('act2'));
        await expect(page).toHaveURL(/[?&]dialogue=1(?:&|$)/);
    });

    test('jumps to a completed ending start with an unclipped action at the critical desktop width', async ({
        page,
    }, testInfo) => {
        test.skip(!isDesktop(testInfo.project.name), 'Desktop jump semantics');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1024, height: 768 });
        const four = TRAIN.four;
        const endingScene = four.choice.options[0].nextScene;
        await seedTrainMap(page, [four.sceneId, endingScene], endingScene, [
            endingScene,
        ]);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const card = sheet.getByTestId('story-map-status-card');
        await expect(surface.locator('[data-kind="ending"]')).toHaveCount(1);
        await surface.locator('[data-kind="ending"]').click();
        await expect(
            card.getByRole('heading', { name: /^Ending / })
        ).toBeVisible();
        expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
        const jump = card.getByRole('button', { name: JUMP_TO_ENDING });
        await expectActionInsideCard(jump, card);
        await jump.click();
        await expect(sheet).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl(endingScene));
        await expect(page).toHaveURL(/[?&]dialogue=1(?:&|$)/);
    });

    test('closes on Escape with a polite live status card and restores the opener', async ({
        page,
    }, testInfo) => {
        const two = TRAIN.two;
        const child = two.choice.options[0].nextScene;
        await seedTrainMap(page, [two.sceneId, child], two.sceneId);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const card = sheet.getByTestId('story-map-status-card');
        await expect(card).toHaveAttribute('aria-live', 'polite');
        await expect(card).toContainText(CURRENT_CAPTION);
        await expect(sheet.locator(':focus')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(sheet).not.toBeVisible();
        await expect(
            page.locator(
                isDesktop(testInfo.project.name)
                    ? SETTINGS_TRIGGER
                    : MENU_TRIGGER
            )
        ).toBeFocused();
    });

    test('keeps the phone sheet full screen with a hidden-chip decision card in both orientations', async ({
        page,
    }, testInfo) => {
        test.skip(isDesktop(testInfo.project.name), 'Phone sizes');
        test.setTimeout(90_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const variant = TRAIN.four;
        const [taken, second] = variant.choice.options;
        // WebKit keeps the old document hit-test height when enlarged after navigation.
        await page.setViewportSize({ width: 390, height: 844 });
        await seedTrainMap(
            page,
            [variant.sceneId, taken.nextScene, second.nextScene],
            variant.sceneId,
            [taken.nextScene]
        );
        for (const size of [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
        ]) {
            await page.setViewportSize(size);
            const sheet = await openStoryMap(page, testInfo.project.name);
            const card = sheet.getByTestId('story-map-status-card');
            const surface = page.getByTestId('story-map-surface');
            const box = await sheet.boundingBox();
            expect(box, 'phone sheet is measurable').not.toBeNull();
            if (!box) continue;
            expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.width - size.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(box.height - size.height)).toBeLessThanOrEqual(2);
            await expect(
                sheet.getByTestId('story-map-status-card')
            ).toHaveCount(1);
            await expect(
                sheet.locator('aside, [data-testid="story-map-details"]')
            ).toHaveCount(0);
            await expectNoHorizontalOverflow(page);

            const title = await sheet.locator('#story-map-title').boundingBox();
            const close = await sheet
                .getByRole('button', { name: t.closeStoryMap })
                .boundingBox();
            const currentCard = await readCardMetrics(card);
            expectCardFits(currentCard, MOBILE_CARD_HEIGHT);
            await expectMobileCurrentLayout(card);
            expect(title).not.toBeNull();
            expect(close).not.toBeNull();
            if (title && close) {
                expect(currentCard.y).toBeGreaterThanOrEqual(
                    Math.min(title.y + title.height, close.y + close.height) - 1
                );
            }

            await activateMapNode(
                surface.getByRole('button', { name: /^Decision · 4 options/ })
            );
            await expect(
                card.getByRole('heading', { name: /Decision · 4 options/i })
            ).toBeVisible();
            await expectHeadingUnclipped(
                card.getByRole('heading', { name: /Decision · 4 options/i })
            );
            const chips = card.locator('ul');
            await expect(chips).toHaveCount(1);
            await expect(chips).toHaveCSS('display', 'none');
            await expect(
                card.getByText(taken.label, { exact: true })
            ).toBeHidden();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: JUMP_TO_DECISION }),
                card
            );
            if (
                size.width === 390 &&
                testInfo.project.name === 'mobile-chrome'
            ) {
                await testInfo.attach('story-map-phone-decision.png', {
                    body: await page.screenshot(),
                    contentType: 'image/png',
                });
            }

            // Run, scene and completed-ending cards share the same bounded
            // seed but exercise the widest actions left on a phone card.
            await surface
                .getByRole('button', { name: 'Expand Acts 1–3', exact: true })
                .click();
            await expect(
                card.getByRole('heading', { name: 'Acts 1–3', exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: 'Jump to Acts 1–3' }),
                card
            );
            await surface
                .getByRole('button', { name: 'Collapse Acts 1–3' })
                .click();
            await expect(
                card.getByRole('heading', { name: 'Acts 1–3', exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: 'Jump to Acts 1–3' }),
                card
            );
            await surface
                .getByRole('button', { name: 'Expand Acts 1–3', exact: true })
                .click();
            await surface
                .getByRole('button', { name: 'Act 2', exact: true })
                .click();
            await expect(
                card.getByRole('heading', { name: 'Act 2', exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: 'Jump to Act 2' }),
                card
            );
            await surface.locator('[data-kind="ending"]').click();
            await expect(
                card.getByRole('heading', { name: /^Ending / })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: JUMP_TO_ENDING }),
                card
            );

            await expect(
                sheet.getByRole('group', { name: 'Story map legend' })
            ).toBeVisible();
            const locate = sheet.getByRole('button', {
                name: LOCATE_CURRENT,
            });
            await expect(locate).toBeVisible();
            const overflow = await surface.evaluate(element => {
                const browser = globalThis as unknown as {
                    getComputedStyle(target: unknown): {
                        overflowX: string;
                        overflowY: string;
                    };
                };
                const style = browser.getComputedStyle(element);
                return {
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                };
            });
            expect(overflow.overflowX).toMatch(/^(auto|scroll)$/);
            expect(overflow.overflowY).toMatch(/^(auto|scroll)$/);
            if (testInfo.project.name === 'mobile-safari') {
                await surface.locator('[data-node-id]').first().focus();
            }
            await surface.evaluate(element => {
                element.scrollTo({ left: 0, top: 0 });
            });
            const before = await surface.evaluate(element => ({
                left: element.scrollLeft,
                top: element.scrollTop,
            }));
            if (testInfo.project.name === 'mobile-safari') {
                await page.keyboard.press('ArrowRight');
            } else {
                await surface.hover();
                await page.mouse.wheel(200, 160);
            }
            // Browser input is asynchronous: poll for the real browser scroll
            // instead of reading once, and never substitute a programmatic
            // scroll for input that the browser refused.
            await expect
                .poll(
                    async () => {
                        const after = await surface.evaluate(element => ({
                            left: element.scrollLeft,
                            top: element.scrollTop,
                        }));
                        return (
                            after.left > before.left || after.top > before.top
                        );
                    },
                    {
                        message:
                            'map surface scrolls from user input before Locate',
                        timeout: 5_000,
                    }
                )
                .toBe(true);
            await locate.tap();
            await expect(
                card.getByText(CURRENT_CAPTION, { exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectCurrentCaptionInsideSurface(
                surface,
                'caption inside the phone surface after Locate current'
            );
            if (
                size.width === 390 &&
                testInfo.project.name === 'mobile-chrome'
            ) {
                await testInfo.attach('story-map-phone-current.png', {
                    body: await page.screenshot(),
                    contentType: 'image/png',
                });
            }
            await page.keyboard.press('Escape');
            await expect(sheet).not.toBeVisible();
        }
    });

    for (const locale of ['zh', 'ja'] as const) {
        test(`keeps the ${locale} current, four-option decision and ending cards unclipped at 1024px`, async ({
            page,
        }, testInfo) => {
            test.skip(
                !isDesktop(testInfo.project.name),
                'Desktop locale layout'
            );
            test.setTimeout(90_000);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const {
                storyMap,
                decisionNodeName,
                decisionHeading,
                endingHeading,
            } = localizedStoryMapText(locale);
            const variant = TRAIN.four;
            const [taken, second] = variant.choice.options;
            await seedTrainMap(
                page,
                [variant.sceneId, taken.nextScene, second.nextScene],
                variant.sceneId,
                [taken.nextScene],
                locale
            );
            await page.setViewportSize({ width: 1024, height: 768 });
            const sheet = await openStoryMap(
                page,
                testInfo.project.name,
                locale
            );
            const card = sheet.getByTestId('story-map-status-card');
            const surface = page.getByTestId('story-map-surface');

            await expect(
                card.getByText(storyMap.youAreHere, { exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
            await expectNoHorizontalOverflow(page);

            await activateMapNode(
                surface.getByRole('button', {
                    name: new RegExp(`^${decisionNodeName}`),
                })
            );
            await expect(
                card.getByRole('heading', {
                    name: decisionHeading,
                    exact: true,
                })
            ).toBeVisible();
            await expectHeadingUnclipped(
                card.getByRole('heading', {
                    name: decisionHeading,
                    exact: true,
                })
            );
            expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
            const decisionJump = card.getByRole('button', {
                name: storyMap.jumpToDecision,
            });
            await expect(decisionJump).toBeVisible();
            await expectActionInsideCard(decisionJump, card);

            await expect(surface.locator('[data-kind="ending"]')).toHaveCount(
                1
            );
            await activateMapNode(surface.locator('[data-kind="ending"]'));
            await expect(
                card.getByRole('heading', {
                    name: endingHeading,
                    exact: true,
                })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), DESKTOP_CARD_HEIGHT);
            const endingJump = card.getByRole('button', {
                name: storyMap.jumpToEnding,
            });
            await expect(endingJump).toBeVisible();
            await expectActionInsideCard(endingJump, card);
        });

        test(`keeps the ${locale} current, four-option decision and ending cards unclipped at 390px`, async ({
            page,
        }, testInfo) => {
            test.skip(isDesktop(testInfo.project.name), 'Phone locale layout');
            test.setTimeout(90_000);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const {
                storyMap,
                decisionNodeName,
                decisionHeading,
                endingHeading,
            } = localizedStoryMapText(locale);
            const variant = TRAIN.four;
            const [taken, second] = variant.choice.options;
            await seedTrainMap(
                page,
                [variant.sceneId, taken.nextScene, second.nextScene],
                variant.sceneId,
                [taken.nextScene],
                locale
            );
            await page.setViewportSize({ width: 390, height: 844 });
            const sheet = await openStoryMap(
                page,
                testInfo.project.name,
                locale
            );
            const card = sheet.getByTestId('story-map-status-card');
            const surface = page.getByTestId('story-map-surface');

            await expect(
                card.getByText(storyMap.youAreHere, { exact: true })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectMobileCurrentLayout(card);
            await expectNoHorizontalOverflow(page);

            await activateMapNode(
                surface.getByRole('button', {
                    name: new RegExp(`^${decisionNodeName}`),
                })
            );
            await expect(
                card.getByRole('heading', {
                    name: decisionHeading,
                    exact: true,
                })
            ).toBeVisible();
            await expectHeadingUnclipped(
                card.getByRole('heading', {
                    name: decisionHeading,
                    exact: true,
                })
            );
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            const decisionJump = card.getByRole('button', {
                name: storyMap.jumpToDecision,
            });
            await expect(decisionJump).toBeVisible();
            await expectActionInsideCard(decisionJump, card);

            await expect(surface.locator('[data-kind="ending"]')).toHaveCount(
                1
            );
            await activateMapNode(surface.locator('[data-kind="ending"]'));
            await expect(
                card.getByRole('heading', {
                    name: endingHeading,
                    exact: true,
                })
            ).toBeVisible();
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            const endingJump = card.getByRole('button', {
                name: storyMap.jumpToEnding,
            });
            await expect(endingJump).toBeVisible();
            await expectActionInsideCard(endingJump, card);

            await page.setViewportSize({ width: 844, height: 390 });
            await activateMapNode(
                surface.getByRole('button', {
                    name: new RegExp(`^${decisionNodeName}`),
                })
            );
            await expectHeadingUnclipped(
                card.getByRole('heading', {
                    name: decisionHeading,
                    exact: true,
                })
            );
            expectCardFits(await readCardMetrics(card), MOBILE_CARD_HEIGHT);
            await expectActionInsideCard(
                card.getByRole('button', { name: storyMap.jumpToDecision }),
                card
            );
            await expectNoHorizontalOverflow(page);
        });
    }
});
