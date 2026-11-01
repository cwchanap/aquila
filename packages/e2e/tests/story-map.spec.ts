import { expect, test, type Locator, type Page } from '@playwright/test';
import { elevatorGameFlow } from '../../stories/src/generated/elevatorGame/flow';
import { scene as act3Dialogue } from '../../stories/src/generated/elevatorGame/scenes/en/act3';
import { elevatorGameChoiceTextEn } from '../../stories/src/stories/elevatorGame/choices.en';
import { buildChoiceMap } from '../../stories/src/stories/choice-utils';
import { MobileReaderPage } from './utils';

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
const JUMP_TO_ACT3 = 'Jump to Act 3';
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
const CURRENT_CAPTION = 'Current position';
const LOCATE_CURRENT = 'Locate current position';

const t = {
    openSettings: 'Open reader settings',
    settingsTitle: 'Reader settings',
    storyMap: 'Story map',
    openMenu: 'Open menu',
    openStoryMap: 'Open story map',
    closeStoryMap: 'Close story map',
    unread: 'Not read yet',
} as const;

const readerUrl = (sceneId: string, dialogue: number) =>
    `/en/reader?story=${STORY_ID}&scene=${sceneId}&dialogue=${dialogue}`;

const sceneUrl = (sceneId: string) => new RegExp(`[?&]scene=${sceneId}(?:&|$)`);

const isDesktop = (projectName: string) => projectName === 'chromium';

async function openStoryMap(page: Page, projectName: string): Promise<Locator> {
    if (isDesktop(projectName)) {
        await page.getByLabel(t.openSettings).click();
        const settings = page.getByRole('dialog', { name: t.settingsTitle });
        await expect(settings).toBeVisible();
        await settings.getByRole('button', { name: t.storyMap }).click();
    } else {
        await page.getByLabel(t.openMenu).click();
        await page.getByLabel(t.openStoryMap).click();
    }
    const sheet = page.getByRole('dialog', { name: t.storyMap });
    await expect(sheet).toBeVisible();
    return sheet;
}

async function readThroughChoice(page: Page): Promise<void> {
    await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
    await expect(page.getByText(choice.prompt)).toBeVisible();
    await page
        .getByRole('button', { name: takenOption.label, exact: true })
        .click();
    await expect(page).toHaveURL(sceneUrl(takenOption.nextScene));
}

test.describe('Story map', () => {
    test('keeps the unchosen route unread and jumps back to the choice prompt', async ({
        page,
    }, testInfo) => {
        await readThroughChoice(page);
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');

        const unreadNode = surface.getByRole('button', {
            name: `${t.unread} — ${unreadOption.label}`,
        });
        await expect(unreadNode).toBeVisible();
        await expect(unreadNode).toContainText('?');

        await surface.getByRole('button', { name: DECISION_NAME }).click();
        const details = page.getByTestId('story-map-details');
        await expect(details.getByText(choice.prompt)).toBeVisible();
        await expect(details.getByText(t.unread)).toBeVisible();

        await details
            .getByRole('button', { name: JUMP_TO_ACT3 })
            .click({ position: { x: 24, y: 22 } });
        await expect(sheet).not.toBeVisible();
        await expect(page).toHaveURL(sceneUrl(CHOICE_SCENE_ID));
        await expect(page).toHaveURL(
            new RegExp(`[?&]dialogue=${LAST_LINE}(?:&|$)`)
        );
        await expect(page.getByText(choice.prompt)).toBeVisible();
        await expect(
            page.getByRole('button', { name: takenOption.label, exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: unreadOption.label, exact: true })
        ).toBeVisible();
        await expect(
            page.locator(
                isDesktop(testInfo.project.name)
                    ? SETTINGS_TRIGGER
                    : MENU_TRIGGER
            )
        ).toBeFocused();
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
        await expect(page.getByText(choice.prompt)).toBeVisible();
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
                    label: el.getAttribute('aria-label'),
                    cls: typeof el.className === 'string' ? el.className : '',
                };
            },
            [point.x, point.y] as [number, number]
        );
        expect(hit?.tag).toBe('BUTTON');
        expect(hit?.label).toBe(t.closeStoryMap);
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
        await page.goto(
            `/en/reader?story=train_adventure&scene=${TRAIN_CURRENT}&dialogue=1`
        );
        const sheet = await openStoryMap(page, testInfo.project.name);
        const surface = page.getByTestId('story-map-surface');
        const caption = surface.getByText(CURRENT_CAPTION, { exact: true });
        await expect(caption).toBeVisible();

        const captionInView = async () => {
            const surfaceBox = await surface.boundingBox();
            const captionBox = await caption.boundingBox();
            if (!surfaceBox || !captionBox) return false;
            return (
                captionBox.x >= surfaceBox.x - 0.5 &&
                captionBox.x + captionBox.width <=
                    surfaceBox.x + surfaceBox.width + 0.5 &&
                captionBox.y >= surfaceBox.y - 0.5 &&
                captionBox.y + captionBox.height <=
                    surfaceBox.y + surfaceBox.height + 0.5
            );
        };
        await expect
            .poll(captionInView, {
                message:
                    'caption fully inside the surface after opening auto-scroll',
            })
            .toBe(true);

        await surface.evaluate(el => {
            el.scrollTo({ left: 0 });
        });
        await sheet.getByRole('button', { name: LOCATE_CURRENT }).click();
        await expect
            .poll(captionInView, {
                message:
                    'caption fully inside the surface after Locate current',
            })
            .toBe(true);
    });

    test('moves focus into the sheet on a phone and restores it to the menu trigger', async ({
        page,
    }, testInfo) => {
        test.skip(
            isDesktop(testInfo.project.name),
            'the phone chrome opener only exists on mobile projects'
        );
        await page.goto(readerUrl(CHOICE_SCENE_ID, LAST_LINE));
        await expect(page.getByText(choice.prompt)).toBeVisible();
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
});
