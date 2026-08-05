import { expect, test, type Page } from '@playwright/test';
import {
    buildReleaseGateReaderRoute as readerRoute,
    loadReleaseGateRunContext,
} from './support/release-gate-env';
import {
    attachReleaseGateEvidence,
    ReleaseGateRequestRecorder,
    type ReleaseGateScenarioCase,
} from './support/release-gate-evidence';

const releaseGate = await loadReleaseGateRunContext(process.env);

async function expectExactRoute(page: Page, expected: string): Promise<void> {
    await expect(page).toHaveURL(
        url => `${url.pathname}${url.search}` === expected
    );
}

async function expectShellIdentity(page: Page): Promise<void> {
    const expected = releaseGate.env.expectedIdentity;
    const host = page.getByTestId('reader-ready');
    await expect(host).toHaveAttribute(
        'data-asset-environment',
        expected.assetEnvironment
    );
    await expect(host).toHaveAttribute(
        'data-asset-release-id',
        expected.releaseId
    );
    await expect(host).toHaveAttribute(
        'data-asset-manifest-sha256',
        expected.manifestSha256
    );
    if (expected.previewId !== undefined) {
        await expect(host).toHaveAttribute(
            'data-asset-preview-id',
            expected.previewId
        );
    } else {
        await expect(host).not.toHaveAttribute('data-asset-preview-id');
    }
}

async function expectSettledIdentity(page: Page): Promise<void> {
    const visual = page.getByTestId('visual-novel-reader');
    await expect(visual).toHaveAttribute('data-visual-release-state', 'ready');
    await expectShellIdentity(page);
}

async function gotoVisualRoute(
    page: Page,
    position: { sceneId: string; dialogueIndex: number }
): Promise<void> {
    const route = readerRoute(releaseGate.scenario, position);
    await page.goto(route);
    await expectExactRoute(page, route);
    await expectSettledIdentity(page);
}

async function advanceTo(
    page: Page,
    expected: { sceneId: string; dialogueIndex: number }
): Promise<void> {
    const route = readerRoute(releaseGate.scenario, expected);
    await page.getByTestId('visual-novel-reader').click();
    await expectExactRoute(page, route);
}

async function runCase(
    cases: ReleaseGateScenarioCase[],
    id: string,
    action: () => Promise<void>
): Promise<void> {
    try {
        await test.step(id, action);
        cases.push({ id, status: 'passed' });
    } catch (error) {
        cases.push({ id, status: 'failed' });
        throw error;
    }
}

async function swapVisualToTextAndBack(page: Page): Promise<void> {
    const route = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await expect(page.getByTestId('visual-novel-reader')).not.toBeAttached();
    await expectExactRoute(page, route);
    await expectShellIdentity(page);

    await page
        .getByRole('button', { name: 'Visual Novel', exact: true })
        .click();
    await expectExactRoute(page, route);
    await expectSettledIdentity(page);
}

async function restoreScenarioBookmark(page: Page): Promise<void> {
    const { locale, storyId, bookmark } = releaseGate.scenario;
    const bookmarkName = `[dlg:${bookmark.dialogueIndex + 1}] Release gate checkpoint`;
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, JSON.stringify([value])),
        {
            key: `aquila:bookmarks:${locale}`,
            value: {
                id: 'release-gate-bookmark',
                storyId,
                sceneId: bookmark.sceneId,
                bookmarkName,
                locale,
                createdAt: 1,
                updatedAt: 1,
            },
        }
    );

    await page.goto(`/${locale}/bookmarks`);
    const card = page.getByTestId('local-bookmark-card');
    await expect(card).toBeVisible();
    await card.getByRole('link').click();
    await expectExactRoute(page, readerRoute(releaseGate.scenario, bookmark));
    await expectSettledIdentity(page);
}

test.describe('deployed visual-novel preview release gate', () => {
    test.skip(
        releaseGate.env.target !== 'preview',
        'Preview flow runs only for RELEASE_GATE_TARGET=preview'
    );

    test('proves the configured preview candidate through the complete reader flow', async ({
        page,
    }, testInfo) => {
        const requests = new ReleaseGateRequestRecorder();
        const cases: ReleaseGateScenarioCase[] = [];
        page.on('request', request =>
            requests.observe(request.url(), request.method())
        );
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        let status: 'passed' | 'failed' = 'passed';

        try {
            await runCase(cases, 'direct-open', async () => {
                await gotoVisualRoute(page, releaseGate.scenario.directOpen);
            });

            await runCase(cases, 'identity-and-requests', async () => {
                const requestPaths = requests.assertExpectedRequests({
                    storyId: releaseGate.env.storyId,
                    target: releaseGate.env.publicationTarget,
                    releaseId: releaseGate.env.expectedIdentity.releaseId,
                    assetBaseUrl: releaseGate.env.assetBaseUrl,
                });
                expect(requestPaths.pointerRequestUrl).not.toBeNull();
                expect(requestPaths.manifestRequestUrl).not.toBeNull();
            });

            await runCase(cases, 'visual-transition', async () => {
                const { from, to, backgroundChanges, portraitChanges } =
                    releaseGate.scenario.transition;
                await gotoVisualRoute(page, from);
                const visual = page.getByTestId('visual-novel-reader');
                const activeBackground = visual.locator(
                    '[data-bg-layer="active"]'
                );
                const portrait = visual.getByTestId('visual-portrait');
                await expect(activeBackground).toHaveAttribute(
                    'data-bg-state',
                    'ready'
                );
                await expect(portrait).toHaveAttribute(
                    'data-portrait-state',
                    'ready'
                );
                const priorBackground =
                    await activeBackground.getAttribute('src');
                const priorPortrait = await portrait.getAttribute('src');
                expect(priorBackground).toBeTruthy();
                expect(priorPortrait).toBeTruthy();

                await advanceTo(page, to);
                await expect(activeBackground).toHaveAttribute(
                    'data-bg-state',
                    'ready'
                );
                await expect(portrait).toHaveAttribute(
                    'data-portrait-state',
                    'ready'
                );
                if (backgroundChanges) {
                    await expect(activeBackground).not.toHaveAttribute(
                        'src',
                        priorBackground!
                    );
                }
                if (portraitChanges) {
                    await expect(portrait).not.toHaveAttribute(
                        'src',
                        priorPortrait!
                    );
                }
                await expectSettledIdentity(page);
            });

            await runCase(cases, 'mode-swap', async () => {
                await swapVisualToTextAndBack(page);
            });

            await runCase(cases, 'viewport-swap', async () => {
                const route = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
                await page
                    .getByRole('button', { name: 'Text', exact: true })
                    .click();
                await expectShellIdentity(page);
                await page.setViewportSize({ width: 390, height: 844 });
                await expectExactRoute(page, route);
                await expectShellIdentity(page);
                await page.setViewportSize({ width: 1280, height: 800 });
                await expectExactRoute(page, route);
                await expectShellIdentity(page);
                await page
                    .getByRole('button', { name: 'Visual Novel', exact: true })
                    .click();
                await expectSettledIdentity(page);
            });

            await runCase(cases, 'history-focus', async () => {
                const trigger = page.getByRole('button', {
                    name: 'Open history',
                });
                await trigger.click();
                const history = page.getByRole('dialog', { name: 'History' });
                await expect(history).toBeVisible();
                const close = history.getByRole('button', {
                    name: 'Close history',
                });
                await expect(close).toBeFocused();
                await close.click();
                await expect(history).not.toBeAttached();
                await expect(trigger).toBeFocused();
            });

            await runCase(cases, 'bookmark-restore', async () => {
                await restoreScenarioBookmark(page);
            });

            await runCase(cases, 'omitted-fallback', async () => {
                const position = releaseGate.scenario.omittedFallback;
                await gotoVisualRoute(page, position);
                const visual = page.getByTestId('visual-novel-reader');
                const fallbackLayer = visual.locator(
                    `[data-visual-identity="${position.identity}"]`
                );
                await expect(fallbackLayer).toHaveCount(1);
                await expect
                    .poll(async () =>
                        fallbackLayer.evaluateAll(nodes =>
                            nodes.some(node =>
                                ['missing', 'failed'].includes(
                                    node.getAttribute('data-bg-state') ??
                                        node.getAttribute(
                                            'data-portrait-state'
                                        ) ??
                                        ''
                                )
                            )
                        )
                    )
                    .toBe(true);
                const previousDialogue = new URL(page.url()).searchParams.get(
                    'dialogue'
                );
                await visual.click();
                await expect
                    .poll(() =>
                        new URL(page.url()).searchParams.get('dialogue')
                    )
                    .not.toBe(previousDialogue);
                await expect(visual).toBeVisible();
            });

            await runCase(cases, 'choice', async () => {
                await gotoVisualRoute(page, releaseGate.scenario.choice);
                const choice = page
                    .getByTestId('visual-novel-reader')
                    .locator('.choices button')
                    .nth(releaseGate.scenario.choice.choiceIndex);
                await expect(choice).toBeVisible();
                await choice.click();
                await expect(page).toHaveURL(
                    url =>
                        url.pathname ===
                            `/${releaseGate.scenario.locale}/reader` &&
                        url.searchParams.get('story') ===
                            releaseGate.scenario.storyId &&
                        url.searchParams.get('scene') ===
                            releaseGate.scenario.choice.expectedSceneId
                );
                await expectSettledIdentity(page);
            });

            await runCase(cases, 'reload-and-lazy-chunk', async () => {
                await page.reload();
                await expect(page).toHaveURL(
                    url =>
                        url.pathname ===
                        `/${releaseGate.scenario.locale}/reader`
                );
                await expectSettledIdentity(page);
                requests.assertNoUnrelatedStoryRequest(
                    releaseGate.scenario.unrelatedStoryChunks
                );
                requests.assertExpectedRequests({
                    storyId: releaseGate.env.storyId,
                    target: releaseGate.env.publicationTarget,
                    releaseId: releaseGate.env.expectedIdentity.releaseId,
                    assetBaseUrl: releaseGate.env.assetBaseUrl,
                });
            });
        } catch (error) {
            status = 'failed';
            throw error;
        } finally {
            await attachReleaseGateEvidence(testInfo, {
                releaseGate,
                project: testInfo.project.name,
                requests,
                scenarioCases: cases,
                status,
            });
        }
    });
});
