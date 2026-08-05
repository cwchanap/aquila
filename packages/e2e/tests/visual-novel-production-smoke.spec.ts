import { expect, test, type Page } from '@playwright/test';
import { probeImageFromPage } from './support/r2-browser-probe';
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
const IMAGE_DECODE_DEADLINE_MS = 15_000;

async function expectExactRoute(page: Page, expected: string): Promise<void> {
    await expect(page).toHaveURL(
        url => `${url.pathname}${url.search}` === expected
    );
}

async function expectSettledProductionIdentity(page: Page): Promise<void> {
    const expected = releaseGate.env.expectedIdentity;
    const visual = page.getByTestId('visual-novel-reader');
    await expect(visual).toHaveAttribute('data-visual-release-state', 'ready');
    const host = page.getByTestId('reader-ready');
    await expect(host).toHaveAttribute('data-asset-environment', 'production');
    await expect(host).toHaveAttribute(
        'data-asset-release-id',
        expected.releaseId
    );
    await expect(host).toHaveAttribute(
        'data-asset-manifest-sha256',
        expected.manifestSha256
    );
    await expect(host).not.toHaveAttribute('data-asset-preview-id');
}

async function gotoVisualRoute(
    page: Page,
    position: { sceneId: string; dialogueIndex: number }
): Promise<void> {
    const route = readerRoute(releaseGate.scenario, position);
    await page.goto(route);
    await expectExactRoute(page, route);
    await expectSettledProductionIdentity(page);
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

test.describe('deployed visual-novel production smoke', () => {
    test.skip(
        releaseGate.env.target !== 'production',
        'Production smoke runs only for RELEASE_GATE_TARGET=production'
    );

    test('opens, decodes, advances, and remains read-only against production', async ({
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

            await runCase(cases, 'identity-and-decode', async () => {
                const visual = page.getByTestId('visual-novel-reader');
                const background = visual.locator('[data-bg-layer="active"]');
                const portrait = visual.getByTestId('visual-portrait');
                await expect(background).toHaveAttribute(
                    'data-bg-state',
                    'ready'
                );
                await expect(portrait).toHaveAttribute(
                    'data-portrait-state',
                    'ready'
                );
                const [backgroundUrl, portraitUrl] = await Promise.all([
                    background.getAttribute('src'),
                    portrait.getAttribute('src'),
                ]);
                expect(backgroundUrl).toBeTruthy();
                expect(portraitUrl).toBeTruthy();
                const [decodedBackground, decodedPortrait] = await Promise.all([
                    probeImageFromPage(
                        page,
                        backgroundUrl!,
                        IMAGE_DECODE_DEADLINE_MS
                    ),
                    probeImageFromPage(
                        page,
                        portraitUrl!,
                        IMAGE_DECODE_DEADLINE_MS
                    ),
                ]);
                expect(decodedBackground.size.width).toBeGreaterThan(0);
                expect(decodedBackground.size.height).toBeGreaterThan(0);
                expect(decodedPortrait.size.width).toBeGreaterThan(0);
                expect(decodedPortrait.size.height).toBeGreaterThan(0);
                requests.assertExpectedRequests({
                    storyId: releaseGate.env.storyId,
                    target: releaseGate.env.publicationTarget,
                    releaseId: releaseGate.env.expectedIdentity.releaseId,
                    assetBaseUrl: releaseGate.env.assetBaseUrl,
                });
            });

            await runCase(cases, 'progression', async () => {
                const { from, to } = releaseGate.scenario.transition;
                await gotoVisualRoute(page, from);
                await page.getByTestId('visual-novel-reader').click();
                await expectExactRoute(
                    page,
                    readerRoute(releaseGate.scenario, to)
                );
                await expectSettledProductionIdentity(page);
            });

            await runCase(cases, 'read-only', async () => {
                expect(requests.mutatingMethods()).toEqual([]);
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
