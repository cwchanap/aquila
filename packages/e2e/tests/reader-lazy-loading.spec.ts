import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { ReaderPage } from './utils';

const SEVENTH_MIRROR_DIRECT_LINK =
    '/en/reader?story=the_seventh_mirror&scene=ch1_act1&dialogue=3';
const MIDNIGHT_DIRECT_LINK =
    '/en/reader?story=dont_save_me_before_midnight&scene=act1&dialogue=1';

const STORY_MODULE_SEGMENTS = {
    seventhMirror: '/stories/theSeventhMirror/',
    trainAdventure: '/stories/trainAdventure/',
    midnight: '/stories/dontSaveMeBeforeMidnight/',
} as const;

const isSeventhMirrorEntryUrl = (url: URL) =>
    isStoryEntryRequest(url.href, STORY_MODULE_SEGMENTS.seventhMirror);
const isMidnightEntryUrl = (url: URL) =>
    isStoryEntryRequest(url.href, STORY_MODULE_SEGMENTS.midnight);

function isStoryModuleRequest(url: string, segment: string): boolean {
    return decodeURIComponent(new URL(url).pathname).includes(segment);
}

function isStoryEntryRequest(url: string, segment: string): boolean {
    return (
        isStoryModuleRequest(url, segment) &&
        decodeURIComponent(new URL(url).pathname).endsWith('/index.ts')
    );
}

async function expectCanonicalUrl(page: Page, pathAndQuery: string) {
    await expect(page).toHaveURL(
        url => `${url.pathname}${url.search}` === pathAndQuery
    );
}

async function expectReadyStory(
    reader: ReaderPage,
    storyId: 'the_seventh_mirror' | 'dont_save_me_before_midnight'
) {
    await expect(reader.ready).toBeVisible();
    await expect(
        reader.ready.locator(`[data-story-id="${storyId}"]`)
    ).toBeVisible();
}

async function dispatchPopstate(page: Page, pathAndQuery: string) {
    await page.evaluate(destination => {
        const browser = globalThis as unknown as {
            history: {
                pushState: (state: null, title: string, url: string) => void;
            };
            dispatchEvent: (event: unknown) => boolean;
            PopStateEvent: new (type: string) => unknown;
        };
        browser.history.pushState(null, '', destination);
        browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    }, pathAndQuery);
}

test.describe('Reader lazy story loading', () => {
    test('requests only the selected story and restores the exact direct link', async ({
        page,
    }) => {
        const reader = new ReaderPage(page);
        const scriptUrls: string[] = [];
        page.on('request', request => {
            if (request.resourceType() === 'script') {
                scriptUrls.push(request.url());
            }
        });

        await page.goto(SEVENTH_MIRROR_DIRECT_LINK);
        await expectReadyStory(reader, 'the_seventh_mirror');

        expect(
            scriptUrls.some(url =>
                isStoryEntryRequest(url, STORY_MODULE_SEGMENTS.seventhMirror)
            )
        ).toBe(true);
        expect(
            scriptUrls.some(url =>
                isStoryModuleRequest(url, STORY_MODULE_SEGMENTS.trainAdventure)
            )
        ).toBe(false);
        expect(
            scriptUrls.some(url =>
                isStoryModuleRequest(url, STORY_MODULE_SEGMENTS.midnight)
            )
        ).toBe(false);
        await expectCanonicalUrl(page, SEVENTH_MIRROR_DIRECT_LINK);
        await expect(reader.progressAt(3)).toBeVisible();
    });

    test('retries a one-shot aborted module import by reloading the preserved URL', async ({
        page,
    }) => {
        const reader = new ReaderPage(page);
        let aborted = false;
        await page.route(isSeventhMirrorEntryUrl, async route => {
            if (!aborted) {
                aborted = true;
                await route.abort();
                return;
            }
            await route.continue();
        });

        await page.goto(SEVENTH_MIRROR_DIRECT_LINK);
        await expect(reader.loadError).toBeVisible();
        await expectCanonicalUrl(page, SEVENTH_MIRROR_DIRECT_LINK);

        const [navigation] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            reader.loadError.getByRole('button', { name: 'Retry' }).click(),
        ]);
        expect(navigation).not.toBeNull();
        expect(navigation?.request().resourceType()).toBe('document');
        expect(navigation?.request().frame()).toBe(page.mainFrame());
        await expectReadyStory(reader, 'the_seventh_mirror');
        await expectCanonicalUrl(page, SEVENTH_MIRROR_DIRECT_LINK);
        await expect(reader.progressAt(3)).toBeVisible();
        expect(aborted).toBe(true);
    });

    test('navigates within a loaded story without downloading its entry again', async ({
        page,
    }) => {
        const reader = new ReaderPage(page);
        const storyEntryRequests: string[] = [];
        page.on('request', request => {
            if (
                isStoryEntryRequest(
                    request.url(),
                    STORY_MODULE_SEGMENTS.seventhMirror
                )
            ) {
                storyEntryRequests.push(request.url());
            }
        });

        await page.goto(SEVENTH_MIRROR_DIRECT_LINK);
        await expectReadyStory(reader, 'the_seventh_mirror');
        expect(storyEntryRequests).toHaveLength(1);

        await page.getByRole('button', { name: 'Open acts panel' }).click();
        await page.getByRole('button', { name: 'Act 2', exact: true }).click();
        await expect(page).toHaveURL(/scene=ch1_act2/);
        await expectReadyStory(reader, 'the_seventh_mirror');
        expect(storyEntryRequests).toHaveLength(1);
    });

    test('keeps the latest story after rapid A to B to A popstate navigation', async ({
        page,
    }) => {
        const reader = new ReaderPage(page);
        await page.goto(SEVENTH_MIRROR_DIRECT_LINK);
        await expectReadyStory(reader, 'the_seventh_mirror');

        let midnightEntryUrl: string | undefined;
        let releaseMidnight!: () => void;
        const releaseMidnightPromise = new Promise<void>(resolve => {
            releaseMidnight = resolve;
        });

        const blockMidnightEntry = async (route: Route) => {
            midnightEntryUrl = route.request().url();
            await releaseMidnightPromise;
            await route.continue();
        };
        await page.route(isMidnightEntryUrl, blockMidnightEntry);

        try {
            await dispatchPopstate(page, MIDNIGHT_DIRECT_LINK);
            await expect
                .poll(() => midnightEntryUrl, {
                    message:
                        'the exact intermediate story entry request starts',
                })
                .toBeTruthy();

            await dispatchPopstate(page, SEVENTH_MIRROR_DIRECT_LINK);
            await expectCanonicalUrl(page, SEVENTH_MIRROR_DIRECT_LINK);
            await expectReadyStory(reader, 'the_seventh_mirror');

            const capturedEntryUrl = midnightEntryUrl!;
            releaseMidnight();
            const moduleEvaluation = await page.evaluate(async entryUrl => {
                await import(entryUrl);
                return 'module-evaluated';
            }, capturedEntryUrl);
            expect(moduleEvaluation).toBe('module-evaluated');

            const loaderChainDrain = await page.evaluate(async () => {
                await Promise.resolve();
                await Promise.resolve();
                return 'loader-chain-drained';
            });
            expect(loaderChainDrain).toBe('loader-chain-drained');

            await expectCanonicalUrl(page, SEVENTH_MIRROR_DIRECT_LINK);
            await expectReadyStory(reader, 'the_seventh_mirror');
        } finally {
            releaseMidnight();
            await page.unroute(isMidnightEntryUrl, blockMidnightEntry);
        }
    });
});
