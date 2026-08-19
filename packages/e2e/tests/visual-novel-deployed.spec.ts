import {
    expect,
    test,
    type Page,
    type Request,
    type Response,
} from '@playwright/test';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    getAudioReleaseManifestPath,
    getReleaseManifestPath,
    isPreviewId,
    isReleaseId,
    isSha256,
    parseRuntimeAssetManifest,
    parseRuntimeAudioManifest,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import {
    getStoryContent,
    getStoryFlow,
    type StoryFlowConfig,
} from '@aquila/stories/stories';
import type { DialogueMap } from '@aquila/stories/types';
import {
    assetUrl,
    directives,
    fetchJsonFromPage,
    type ProbeContext,
} from './support/r2-browser-probe';
import { findAudioGateAnchors } from './support/audio-gate-anchors';
import { ReaderPage, VisualReaderPage } from './utils';

/**
 * HPA-233 release gate: prove the DEPLOYED reader serves one specific release.
 *
 * Runs only through `playwright.release-gate.config.ts` (no webServer, HTTPS
 * non-loopback BASE_URL required). The flow drives the deployed web app in a
 * real browser, waits until the visual runtime reports its release as `ready`,
 * and then asserts the resolved release identity (`data-asset-*` on the stable
 * `reader-ready` host) against the env-pinned release. It then exercises the
 * reader through background/portrait changes, mode and breakpoint swaps, a
 * bookmark restore, one choice, and a forced-delivery-failure fallback — none
 * of which may block the reader or change the resolved identity.
 *
 * Env: BASE_URL, RELEASE_GATE_STORY_ID (default the_seventh_mirror),
 * RELEASE_GATE_RELEASE_ID, RELEASE_GATE_MANIFEST_SHA256 (required), and
 * RELEASE_GATE_PREVIEW_ID (preview run only — omit it for a production run).
 * Set RELEASE_GATE_AUDIO_RELEASE_ID and RELEASE_GATE_AUDIO_MANIFEST_SHA256
 * together to add the deployed BGM/SFX checks. VERCEL_AUTOMATION_BYPASS_SECRET
 * authenticates protected Vercel previews.
 */

const LOCALE = 'en';
const DEFAULT_STORY_ID = 'the_seventh_mirror';

const STORY_ID = (process.env.RELEASE_GATE_STORY_ID ?? DEFAULT_STORY_ID).trim();
const RELEASE_ID = (process.env.RELEASE_GATE_RELEASE_ID ?? '').trim();
const MANIFEST_SHA256 = (process.env.RELEASE_GATE_MANIFEST_SHA256 ?? '').trim();
const PREVIEW_ID = (process.env.RELEASE_GATE_PREVIEW_ID ?? '').trim();
const AUDIO_RELEASE_ID = (
    process.env.RELEASE_GATE_AUDIO_RELEASE_ID ?? ''
).trim();
const AUDIO_MANIFEST_SHA256 = (
    process.env.RELEASE_GATE_AUDIO_MANIFEST_SHA256 ?? ''
).trim();

const hasAudioReleaseId = AUDIO_RELEASE_ID !== '';
const hasAudioManifestSha256 = AUDIO_MANIFEST_SHA256 !== '';
if (hasAudioReleaseId !== hasAudioManifestSha256) {
    throw new Error(
        'visual-novel-deployed.spec.ts: RELEASE_GATE_AUDIO_RELEASE_ID and ' +
            'RELEASE_GATE_AUDIO_MANIFEST_SHA256 must be set together.'
    );
}
const AUDIO_GATE_ENABLED = hasAudioReleaseId && hasAudioManifestSha256;

function requireGateEnv(value: string, name: string): string {
    if (value === '') {
        throw new Error(
            `visual-novel-deployed.spec.ts: ${name} is required — set it ` +
                'alongside BASE_URL when running the release gate ' +
                '(bun --filter e2e test:release-gate).'
        );
    }
    return value;
}

requireGateEnv(RELEASE_ID, 'RELEASE_GATE_RELEASE_ID');
requireGateEnv(MANIFEST_SHA256, 'RELEASE_GATE_MANIFEST_SHA256');
if (!isReleaseId(RELEASE_ID)) {
    throw new Error(
        `visual-novel-deployed.spec.ts: RELEASE_GATE_RELEASE_ID "${RELEASE_ID}" ` +
            'must look like sha256-<64 hex chars>.'
    );
}
if (!isSha256(MANIFEST_SHA256)) {
    throw new Error(
        `visual-novel-deployed.spec.ts: RELEASE_GATE_MANIFEST_SHA256 ` +
            `"${MANIFEST_SHA256}" must be a 64-character lowercase SHA-256 digest.`
    );
}
if (PREVIEW_ID !== '' && !isPreviewId(PREVIEW_ID)) {
    throw new Error(
        `visual-novel-deployed.spec.ts: RELEASE_GATE_PREVIEW_ID "${PREVIEW_ID}" ` +
            'is not a valid preview id.'
    );
}
if (AUDIO_GATE_ENABLED && !isReleaseId(AUDIO_RELEASE_ID)) {
    throw new Error(
        `visual-novel-deployed.spec.ts: RELEASE_GATE_AUDIO_RELEASE_ID ` +
            `"${AUDIO_RELEASE_ID}" must look like sha256-<64 hex chars>.`
    );
}
if (AUDIO_GATE_ENABLED && !isSha256(AUDIO_MANIFEST_SHA256)) {
    throw new Error(
        `visual-novel-deployed.spec.ts: RELEASE_GATE_AUDIO_MANIFEST_SHA256 ` +
            `"${AUDIO_MANIFEST_SHA256}" must be a 64-character lowercase ` +
            'SHA-256 digest.'
    );
}

const TARGET: PublicationTarget = PREVIEW_ID
    ? { kind: 'preview', previewId: PREVIEW_ID }
    : { kind: 'production' };

/** Preview runs pin the preview id; production runs assert it is absent. */
type RuntimeReleaseIdentity = {
    assetEnvironment: 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

const EXPECTED_IDENTITY: RuntimeReleaseIdentity = {
    assetEnvironment: (PREVIEW_ID ? 'preview' : 'production') as
        | 'preview'
        | 'production',
    previewId: PREVIEW_ID || null,
    releaseId: RELEASE_ID,
    manifestSha256: MANIFEST_SHA256,
};

const EXPECTED_AUDIO_IDENTITY: RuntimeReleaseIdentity = {
    ...EXPECTED_IDENTITY,
    releaseId: AUDIO_RELEASE_ID,
    manifestSha256: AUDIO_MANIFEST_SHA256,
};

// English UI strings, kept in sync with
// packages/stories/src/translations/en.json. The local specs hardcode these
// same strings (reader-visual.spec.ts, MobileReaderPage); importing the
// translations module would pull JSON into a Playwright-processed spec, which
// the transform cannot resolve under Bun.
const t = {
    textMode: 'Text',
    visualNovelMode: 'Visual Novel',
    bookmark: '📖 Bookmark',
    bookmarkSaved: 'Bookmark saved!',
    continueReading: 'Continue Reading',
    visualAssetFallback: 'Some visuals are unavailable',
    openHistory: 'Open history',
} as const;

const PREREQUISITES =
    `Requires the deployed reader at ${process.env.BASE_URL ?? '<BASE_URL>'} to ` +
    `serve release ${RELEASE_ID} of ${STORY_ID} from its configured CDN ` +
    '(HPA-233 release gate).';

const probeFor = (assetBase: string): ProbeContext => ({
    assetBase,
    assetDeadlineMs: RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset,
    prerequisites: PREREQUISITES,
});

const readerUrl = (storyId: string, sceneId: string, dialogue: number) =>
    `/${LOCALE}/reader?story=${storyId}&scene=${sceneId}&dialogue=${dialogue}`;

const dialogueUrl = (line: number) => new RegExp(`[?&]dialogue=${line}(?:&|$)`);

async function expectCanonicalVisualLine(
    page: Page,
    line: number
): Promise<void> {
    await expect(page).toHaveURL(dialogueUrl(line));
    await expect(
        page
            .getByTestId('visual-novel-reader')
            .getByText(new RegExp(`^Page ${line} of \\d+$`))
    ).toBeVisible();
}

/** The leaf reports `ready` once the release validated; wait generously. */
async function waitForVisualReady(page: Page): Promise<void> {
    await expect(page.getByTestId('visual-novel-reader')).toHaveAttribute(
        'data-visual-release-state',
        'ready',
        { timeout: 30_000 }
    );
}

/**
 * The release identity lives on the STABLE `reader-ready` host (Task 2), so it
 * must survive text-mode switches, breakpoint swaps, and full reloads. Missing
 * attributes, a local environment, or a mismatched release/checksum all fail
 * the gate.
 */
async function expectReleaseIdentity(
    page: Page,
    prefix: 'asset' | 'audio',
    expected: RuntimeReleaseIdentity
): Promise<void> {
    const host = new ReaderPage(page).ready;
    await expect(host).toHaveAttribute(
        `data-${prefix}-environment`,
        expected.assetEnvironment
    );
    if (expected.previewId !== null) {
        await expect(host).toHaveAttribute(
            `data-${prefix}-preview-id`,
            expected.previewId
        );
    } else {
        // Production run: the attribute must be ABSENT (the value-less form —
        // `/.+/` would let an empty `data-asset-preview-id=""` through).
        await expect(host).not.toHaveAttribute(`data-${prefix}-preview-id`);
    }
    await expect(host).toHaveAttribute(
        `data-${prefix}-release-id`,
        expected.releaseId
    );
    await expect(host).toHaveAttribute(
        `data-${prefix}-manifest-sha256`,
        expected.manifestSha256
    );
}

async function waitForAudioIdentity(page: Page): Promise<void> {
    await expect(new ReaderPage(page).ready).toHaveAttribute(
        'data-audio-release-id',
        EXPECTED_AUDIO_IDENTITY.releaseId,
        { timeout: 30_000 }
    );
    await expectReleaseIdentity(page, 'audio', EXPECTED_AUDIO_IDENTITY);
}

/**
 * The flow's anchors, computed from the story content the deployed app itself
 * serves (never hardcoded per story): one scene with a portrait change and a
 * later background change, entered at a non-zero position just before the
 * portrait change. Step 3 additionally requires the release to cover the
 * change targets — the gate proves the reader LOADS what the release
 * publishes, not merely that it survives.
 */
type SceneAnchors = {
    sceneId: string;
    startPage: number;
    portraitPage: number;
    backgroundPage: number;
};

function findSceneAnchors(
    dialogue: DialogueMap,
    flow: StoryFlowConfig
): SceneAnchors {
    const scenes = flow.nodes.filter(node => node.kind === 'scene');
    for (const node of scenes) {
        if (node.kind !== 'scene') continue;
        const lines = dialogue[node.sceneId];
        if (!lines || lines.length < 3) continue;
        // First index where the portrait changes (both lines carry one).
        const portraitPair = lines.findIndex(
            (entry, index) =>
                index + 1 < lines.length &&
                entry.portrait !== undefined &&
                lines[index + 1].portrait !== undefined &&
                entry.portrait !== lines[index + 1].portrait
        );
        const backgroundPair = lines.findIndex(
            (entry, index) =>
                index + 1 < lines.length &&
                entry.background !== undefined &&
                lines[index + 1].background !== undefined &&
                entry.background !== lines[index + 1].background
        );
        if (portraitPair < 0 || backgroundPair < 0) continue;
        const startPage = portraitPair + 1;
        const portraitPage = portraitPair + 2;
        const backgroundPage = backgroundPair + 2;
        // Non-zero start position, and both changes must be exercised by
        // advancing forward from the start (portrait first, background later).
        if (startPage < 2 || backgroundPage <= portraitPage) continue;
        return {
            sceneId: node.sceneId,
            startPage,
            portraitPage,
            backgroundPage,
        };
    }
    throw new Error(
        `visual-novel-deployed.spec.ts: story "${STORY_ID}" has no scene with ` +
            'a portrait change followed by a background change at a non-zero ' +
            'position — the release gate needs such a scene to exercise the ' +
            'deployed reader.'
    );
}

/**
 * `train_adventure` is the only story with choice nodes today; the gate story
 * itself (the_seventh_mirror) is linear. The choice step therefore drives the
 * choice-bearing scene of train_adventure — the deployed reader renders it
 * with or without a release (the visual runtime has no resolver for it), which
 * is exactly the "choices must never block" property the gate asserts.
 */
type ChoiceAnchors = {
    sceneId: string;
    dialoguePage: number;
    prompt: string;
    optionLabel: string;
    nextScene: string;
};

function findChoiceAnchors(): ChoiceAnchors {
    const CHOICE_STORY = 'train_adventure';
    const content = getStoryContent(CHOICE_STORY, LOCALE);
    const flow = getStoryFlow(CHOICE_STORY);
    if (!flow) {
        throw new Error(
            `visual-novel-deployed.spec.ts: no flow for "${CHOICE_STORY}".`
        );
    }
    const scene = flow.nodes.find(
        (node): node is Extract<typeof node, { kind: 'scene' }> =>
            node.kind === 'scene' && (node.next?.startsWith('choice:') ?? false)
    );
    if (!scene || !scene.next) {
        throw new Error(
            `visual-novel-deployed.spec.ts: "${CHOICE_STORY}" has no choice scene.`
        );
    }
    const choiceId = scene.next.slice('choice:'.length);
    const choice = content.choices[choiceId];
    const lines = content.dialogue[scene.sceneId];
    const option = choice?.options[0];
    if (!choice || !lines || !option) {
        throw new Error(
            `visual-novel-deployed.spec.ts: "${CHOICE_STORY}" choice ` +
                `"${choiceId}" is malformed.`
        );
    }
    return {
        sceneId: scene.sceneId,
        dialoguePage: lines.length,
        prompt: choice.prompt,
        optionLabel: option.label,
        nextScene: option.nextScene,
    };
}

/**
 * Advance one click per line, asserting the canonical URL each time — a
 * skipped line would otherwise cascade into every later assertion. The reader
 * skips the typewriter effect on a click while a line is still typing (it
 * does not advance), so each click waits for the typewriter to finish first.
 */
async function advanceTo(
    page: Page,
    visual: VisualReaderPage,
    fromPage: number,
    toPage: number
): Promise<void> {
    for (let line = fromPage; line < toPage; line++) {
        await expect(page.getByTestId('visual-typewriter-cursor')).toHaveCount(
            0
        );
        await visual.root.click();
        await expect(page).toHaveURL(dialogueUrl(line + 1));
    }
}

function requireCovered(
    manifest: RuntimeAssetManifestV1,
    type: 'background' | 'portrait',
    key: string,
    what: string
): void {
    const covered = manifest.assets.some(
        asset => asset.identity.type === type && asset.identity.key === key
    );
    if (!covered) {
        throw new Error(
            `The release ${RELEASE_ID} omits the ${type} "${key}" that the ` +
                `reader must load ${what} — the gate cannot prove the reader ` +
                'loads new visuals from this release. Publish a release that ' +
                'covers the exercised scene.'
        );
    }
}

const IMMUTABLE_AUDIO_CACHE_DIRECTIVES = directives(
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl
);

function expectAudioResponse(response: Response, url: string): void {
    expect(response.ok(), `${url} must return a successful response`).toBe(
        true
    );
    const contentType = response.headers()['content-type'];
    expect(
        contentType?.split(';', 1)[0]?.trim().toLowerCase(),
        `${url} must be served as audio/mpeg`
    ).toBe('audio/mpeg');
    expect(
        [...directives(response.headers()['cache-control'])].sort(),
        `cache-control on ${url} must be immutable`
    ).toEqual([...IMMUTABLE_AUDIO_CACHE_DIRECTIVES].sort());
}

const content = getStoryContent(STORY_ID, LOCALE);
const flow = getStoryFlow(STORY_ID);
if (!flow) {
    throw new Error(
        `visual-novel-deployed.spec.ts: unknown story "${STORY_ID}".`
    );
}
const anchors = findSceneAnchors(content.dialogue, flow);
const choiceAnchors = findChoiceAnchors();

test.describe('Deployed visual-novel release gate', () => {
    test('serves the pinned release end to end in a real browser', async ({
        page,
    }) => {
        // The whole flow is one journey through the deployed reader; the two
        // projects (desktop + mobile Chromium) each run it from their own
        // viewport. Two release validations happen (initial load and the
        // return to the gate story after the choice), each with network
        // deadlines from the cache policy.
        test.setTimeout(240_000);
        const visual = new VisualReaderPage(page);

        // -- Step 1: open the story in visual mode at a non-zero position. --
        await page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
            localStorage.setItem('aquila:sfx-enabled:v1', 'true');
            localStorage.setItem('aquila:bgm-enabled:v1', 'true');
        });
        // Capture the release manifest the reader fetches on load so the
        // delivery base and every object URL are derived from the LIVE layout
        // — never hardcoded. waitForResponse is started before goto and bound
        // to the release-readiness budget (30s, matching waitForVisualReady):
        // the manifest must arrive during initial load, so resolving it here
        // rather than through an unbounded response listener fails the test
        // with a clear diagnostic instead of hanging until the 240s timeout.
        const manifestResponse = page.waitForResponse(
            response => response.url().endsWith('/runtime-manifest.json'),
            { timeout: 30_000 }
        );
        await page.goto(
            readerUrl(STORY_ID, anchors.sceneId, anchors.startPage)
        );
        await expect(visual.root).toBeVisible();
        await expectCanonicalVisualLine(page, anchors.startPage);

        let manifestUrl: string;
        try {
            manifestUrl = (await manifestResponse).url();
        } catch {
            throw new Error(
                'The deployed reader never fetched a release manifest ' +
                    `(expected ${RELEASE_ID} of ${STORY_ID}) — is the release ` +
                    'published and pointed at for this deploy?'
            );
        }

        // -- Step 2: release ready, and the exact pinned identity on reader-ready. --
        await waitForVisualReady(page);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);

        // Derive the delivery base from the manifest URL the reader used and
        // probe the manifest from page script (cross-origin, CORS-enforced) —
        // the same browser-side delivery check the gate exists to make.
        const slashIndex = manifestUrl.indexOf('/vn/');
        if (slashIndex < 0) {
            throw new Error(
                `Manifest URL "${manifestUrl}" is not under /vn/ — cannot ` +
                    'derive the delivery base.'
            );
        }
        const assetBase = manifestUrl.slice(0, slashIndex);
        const { body } = await fetchJsonFromPage(
            page,
            assetUrl(
                assetBase,
                getReleaseManifestPath(STORY_ID, RELEASE_ID, TARGET)
            ),
            RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
            probeFor(assetBase)
        );
        const manifest = parseRuntimeAssetManifest(body);
        expect(manifest.storyId).toBe(STORY_ID);
        expect(manifest.releaseId).toBe(RELEASE_ID);

        let bgmUrl: string | null = null;
        let bgmRequestCount = 0;
        let bgmResponseCount = 0;

        const expectNoDuplicateBgmRequest = async (
            action: () => Promise<void>
        ): Promise<void> => {
            const url = bgmUrl;
            if (!AUDIO_GATE_ENABLED || url === null) {
                await action();
                return;
            }

            const requestCountBefore = bgmRequestCount;
            const responseCountBefore = bgmResponseCount;
            const duplicateRequest = page.waitForRequest(
                request =>
                    request.resourceType() === 'media' && request.url() === url,
                { timeout: 2_000 }
            );
            // Convert to a settled result immediately so the rejection
            // handler is attached before action() can exceed the timeout,
            // preventing an unhandled rejection if the action outlasts the
            // 2s wait window.
            const settled = duplicateRequest
                .then(request => ({
                    status: 'fulfilled' as const,
                    value: request,
                }))
                .catch(reason => ({
                    status: 'rejected' as const,
                    reason,
                }));
            await action();
            const result = await settled;
            expect(result.status).toBe('rejected');
            expect(bgmRequestCount).toBe(requestCountBefore);
            expect(bgmResponseCount).toBe(responseCountBefore);
        };

        if (AUDIO_GATE_ENABLED) {
            const audioManifestUrl = assetUrl(
                assetBase,
                getAudioReleaseManifestPath(STORY_ID, AUDIO_RELEASE_ID, TARGET)
            );
            const audioManifestDocument = await fetchJsonFromPage(
                page,
                audioManifestUrl,
                RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
                probeFor(assetBase)
            );
            expect(
                [...directives(audioManifestDocument.cacheControl)].sort(),
                `cache-control on ${audioManifestUrl} must be immutable`
            ).toEqual([...IMMUTABLE_AUDIO_CACHE_DIRECTIVES].sort());
            const audioManifest = parseRuntimeAudioManifest(
                audioManifestDocument.body
            );
            expect(audioManifest.storyId).toBe(STORY_ID);
            expect(audioManifest.releaseId).toBe(AUDIO_RELEASE_ID);
            const audioAnchors = findAudioGateAnchors(
                content.dialogue,
                flow,
                audioManifest
            );

            // BGM is selected by the authored landing line, but playback is
            // gesture-gated. A media response before the gesture would prove
            // the reader started audio merely by landing on the page.
            const bgmAsset = audioManifest.assets.find(
                asset =>
                    asset.identity.type === 'bgm' &&
                    asset.identity.key === audioAnchors.bgm.key
            );
            if (!bgmAsset) {
                throw new Error(
                    'Assertion bug: the selected BGM cue is absent from the ' +
                        'served audio manifest.'
                );
            }
            const selectedBgmUrl = assetUrl(assetBase, bgmAsset.path);
            bgmUrl = selectedBgmUrl;
            const landingMediaUrls: string[] = [];
            const recordLandingMedia = (response: Response): void => {
                if (response.request().resourceType() === 'media') {
                    landingMediaUrls.push(response.url());
                }
            };
            const recordBgmRequest = (request: Request): void => {
                if (
                    request.resourceType() === 'media' &&
                    request.url() === selectedBgmUrl
                ) {
                    bgmRequestCount += 1;
                }
            };
            const recordBgmResponse = (response: Response): void => {
                if (
                    response.request().resourceType() === 'media' &&
                    response.url() === selectedBgmUrl
                ) {
                    bgmResponseCount += 1;
                }
            };
            page.on('request', recordBgmRequest);
            page.on('response', recordLandingMedia);
            page.on('response', recordBgmResponse);
            await page.goto(
                readerUrl(
                    STORY_ID,
                    audioAnchors.bgm.sceneId,
                    audioAnchors.bgm.page
                )
            );
            await expect(visual.root).toBeVisible();
            await expectCanonicalVisualLine(page, audioAnchors.bgm.page);
            await waitForVisualReady(page);
            await waitForAudioIdentity(page);
            // Bounded negative-check: no BGM request occurs within a short
            // settle window after landing, proving the gate holds before the
            // user gesture. The rejection handler is attached immediately so
            // the timeout rejection cannot surface as an unhandled rejection.
            const noBgmBeforeGesture = page.waitForRequest(
                request =>
                    request.resourceType() === 'media' &&
                    request.url() === selectedBgmUrl,
                { timeout: 1_000 }
            );
            const noBgmSettled = noBgmBeforeGesture
                .then(request => ({
                    status: 'fulfilled' as const,
                    value: request,
                }))
                .catch(reason => ({
                    status: 'rejected' as const,
                    reason,
                }));
            const noBgmResult = await noBgmSettled;
            expect(noBgmResult.status).toBe('rejected');
            expect(
                landingMediaUrls,
                'BGM must not load solely from the landing position'
            ).toHaveLength(0);
            expect(bgmRequestCount).toBe(0);
            // The landing-media listener has served its purpose; remove it so
            // it does not remain attached and accumulate data for the rest of
            // the test. The BGM request/response listeners stay for the
            // duplicate-BGM checks below.
            page.off('response', recordLandingMedia);

            const bgmResponse = page.waitForResponse(
                response => response.url() === selectedBgmUrl,
                { timeout: RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset }
            );
            await visual.root.click();
            expectAudioResponse(await bgmResponse, selectedBgmUrl);
            expect(bgmRequestCount).toBe(1);
            expect(bgmResponseCount).toBe(1);

            // BGM is now proven active. Responsive remounts (viewport swaps)
            // must not re-request the track — this duplicate-BGM check is
            // meaningful only while the tracked BGM is actually playing, so it
            // runs here immediately after activation, BEFORE any mode switch
            // that would stop the track and leave nothing to duplicate.
            const bgmLine = audioAnchors.bgm.page;
            await expectNoDuplicateBgmRequest(async () => {
                await page.setViewportSize({ width: 844, height: 390 });
                await expectCanonicalVisualLine(page, bgmLine);
                await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
                await waitForAudioIdentity(page);
            });
            await expectNoDuplicateBgmRequest(async () => {
                await page.setViewportSize({ width: 1280, height: 800 });
                await expectCanonicalVisualLine(page, bgmLine);
                await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
                await waitForAudioIdentity(page);
            });
            // Mode switches are a separate lifecycle: Text mode stops the BGM
            // and resets bgmActivated (ReaderShell.setReaderMode), and
            // switching back to Visual does NOT autoplay (only a gesture
            // activates BGM). The no-duplicate assertion here proves neither
            // switch spurious re-requests the track; it does NOT claim a
            // live track survives the round trip.
            await expectNoDuplicateBgmRequest(async () => {
                await page
                    .getByRole('button', { name: t.textMode, exact: true })
                    .click();
                await expect(
                    page.getByTestId('visual-novel-reader')
                ).not.toBeAttached();
                await expect(page).toHaveURL(dialogueUrl(bgmLine));
                await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
                await waitForAudioIdentity(page);
            });
            await expectNoDuplicateBgmRequest(async () => {
                await page
                    .getByRole('button', {
                        name: t.visualNovelMode,
                        exact: true,
                    })
                    .click();
                await waitForVisualReady(page);
                await expectCanonicalVisualLine(page, bgmLine);
                await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
                await waitForAudioIdentity(page);
            });

            // SFX is eligible only on a forward adjacent transition. Start at
            // the pure helper's predecessor page and require the exact object
            // response while the normal reader click advances to its target.
            const sfxAsset = audioManifest.assets.find(
                asset =>
                    asset.identity.type === 'sfx' &&
                    asset.identity.key === audioAnchors.sfx.key
            );
            if (!sfxAsset) {
                throw new Error(
                    'Assertion bug: the selected SFX cue is absent from the ' +
                        'served audio manifest.'
                );
            }
            const sfxUrl = assetUrl(assetBase, sfxAsset.path);
            await page.goto(
                readerUrl(
                    STORY_ID,
                    audioAnchors.sfx.sceneId,
                    audioAnchors.sfx.fromPage
                )
            );
            await expect(visual.root).toBeVisible();
            await expectCanonicalVisualLine(page, audioAnchors.sfx.fromPage);
            await waitForVisualReady(page);
            await waitForAudioIdentity(page);
            const sfxResponse = page.waitForResponse(
                response => response.url() === sfxUrl,
                { timeout: RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset }
            );
            await advanceTo(
                page,
                visual,
                audioAnchors.sfx.fromPage,
                audioAnchors.sfx.toPage
            );
            expectAudioResponse(await sfxResponse, sfxUrl);
            await expectCanonicalVisualLine(page, audioAnchors.sfx.toPage);
        }

        if (AUDIO_GATE_ENABLED) {
            await page.goto(
                readerUrl(STORY_ID, anchors.sceneId, anchors.startPage)
            );
            await expect(visual.root).toBeVisible();
            await expectCanonicalVisualLine(page, anchors.startPage);
            await waitForVisualReady(page);
            await waitForAudioIdentity(page);
            await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
        }

        // -- Step 3: advance through a portrait change and a background change. --
        // The change targets must be covered by the release (see
        // requireCovered) — the reader must actually LOAD them.
        const dialogue = content.dialogue[anchors.sceneId];
        const portraitAfter = dialogue[anchors.portraitPage - 1].portrait;
        const backgroundAfter = dialogue[anchors.backgroundPage - 1].background;
        if (!portraitAfter || !backgroundAfter) {
            throw new Error(
                'Assertion bug: anchor lines carry no portrait/background.'
            );
        }
        requireCovered(
            manifest,
            'portrait',
            portraitAfter,
            'on the portrait change'
        );
        requireCovered(
            manifest,
            'background',
            backgroundAfter,
            'on the background change'
        );

        const portraitSrcBefore = await visual.portrait.getAttribute('src');
        await advanceTo(page, visual, anchors.startPage, anchors.portraitPage);
        await expect(visual.portrait).toHaveAttribute(
            'data-portrait-state',
            'ready'
        );
        if (portraitSrcBefore !== null) {
            await expect(visual.portrait).not.toHaveAttribute(
                'src',
                portraitSrcBefore
            );
        }

        const backgroundSrcBefore =
            await visual.activeBackground.getAttribute('src');
        await advanceTo(
            page,
            visual,
            anchors.portraitPage,
            anchors.backgroundPage
        );
        await expect(visual.activeBackground).toHaveAttribute(
            'data-bg-state',
            'ready'
        );
        if (backgroundSrcBefore !== null) {
            await expect(visual.activeBackground).not.toHaveAttribute(
                'src',
                backgroundSrcBefore
            );
        }

        // -- Step 4: visual<->text — same line, same identity. --
        const line = anchors.backgroundPage;
        await page
            .getByRole('button', { name: t.textMode, exact: true })
            .click();
        // The visual leaf unmounts in text mode; the canonical line survives in
        // the URL (the text reader renders its own progress widget).
        await expect(
            page.getByTestId('visual-novel-reader')
        ).not.toBeAttached();
        await expect(page).toHaveURL(dialogueUrl(line));
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
        if (AUDIO_GATE_ENABLED) {
            await waitForAudioIdentity(page);
        }

        await page
            .getByRole('button', { name: t.visualNovelMode, exact: true })
            .click();
        await waitForVisualReady(page);
        await expectCanonicalVisualLine(page, line);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
        if (AUDIO_GATE_ENABLED) {
            await waitForAudioIdentity(page);
        }

        // -- Step 5: resize desktop<->mobile — same line, same identity. --
        await page.setViewportSize({ width: 844, height: 390 });
        await expectCanonicalVisualLine(page, line);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
        if (AUDIO_GATE_ENABLED) {
            await waitForAudioIdentity(page);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        await expectCanonicalVisualLine(page, line);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
        if (AUDIO_GATE_ENABLED) {
            await waitForAudioIdentity(page);
        }

        // -- Step 6: restore a bookmark, then take one choice. --
        await page
            .getByRole('button', { name: t.bookmark, exact: true })
            .click();
        const prompt = page.getByRole('dialog', { name: 'Prompt' });
        await expect(prompt).toBeVisible();
        await prompt
            .locator('input[type="text"]')
            .fill(`release-gate ${anchors.sceneId} line ${line}`);
        await prompt.getByRole('button', { name: 'OK' }).click();
        const alert = page.getByRole('alertdialog', { name: 'Alert' });
        await expect(alert).toContainText(t.bookmarkSaved);
        await alert.getByRole('button', { name: 'OK' }).click();
        await expect(alert).not.toBeAttached();

        // Restore through the local bookmarks card: same scene, same line,
        // same identity after a fresh load and re-validation.
        await page.goto(`/${LOCALE}/bookmarks`);
        const card = page.locator('[data-testid="local-bookmark-card"]');
        await expect(card).toBeVisible();
        await card.getByRole('link', { name: t.continueReading }).click();
        await expect(page).toHaveURL(dialogueUrl(line));
        await waitForVisualReady(page);
        await expectCanonicalVisualLine(page, line);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);

        // One choice, computed from the story content the app itself ships.
        await page.goto(
            readerUrl(
                'train_adventure',
                choiceAnchors.sceneId,
                choiceAnchors.dialoguePage
            )
        );
        await expect(visual.root).toBeVisible();
        await expect(page.getByText(choiceAnchors.prompt)).toBeVisible();
        await page
            .getByRole('button', {
                name: choiceAnchors.optionLabel,
                exact: true,
            })
            .click();
        await expect(page).toHaveURL(
            new RegExp(`[?&]scene=${choiceAnchors.nextScene}(?:&|$)`)
        );
        await expect(page).toHaveURL(dialogueUrl(1));
        await expect(visual.root).toBeVisible();

        // -- Step 7: a forced delivery failure must not block. --
        // Return to the gate story one line before its background change. The
        // background on the next line IS covered by the release (requireCovered
        // proved it above), so this is not a manifest omission: it is a FORCED
        // DELIVERY FAILURE — every variant path the manifest exposes for that
        // object (webp and the optional avif, HPA-227), whichever the reader
        // prefers, is intercepted with 404 so its bytes can never arrive, and
        // the reader must keep going.
        //
        // The routes must be installed BEFORE the goto: the reader's
        // warmWithinScene prefetch fires during navigation (visual-state-
        // controller.ts), so routes installed after the page settles would let
        // a fast CDN populate the decoded cache first — the click would then
        // use cached bytes and the fallback banner would never appear. The
        // blocked-request counter additionally proves the reader actually
        // asked for the intercepted asset at least once (prefetch or the
        // click-driven load), so a step whose routes never matched fails
        // loudly instead of asserting nothing.
        const blockedEntry = manifest.assets.find(
            asset =>
                asset.identity.type === 'background' &&
                asset.identity.key === backgroundAfter
        );
        if (!blockedEntry) {
            // requireCovered already proved this key is in the served
            // manifest; a mismatch here is a spec bug and must fail loudly.
            throw new Error(
                'Assertion bug: the background covered in step 3 is no ' +
                    'longer present in the served manifest.'
            );
        }
        const blockedPatterns: string[] = [];
        let blockedRequests = 0;
        for (const variant of [
            blockedEntry.variants.webp,
            blockedEntry.variants.avif,
        ]) {
            if (!variant) continue;
            const pattern = `**/${variant.path}`;
            blockedPatterns.push(pattern);
            await page.route(pattern, route => {
                blockedRequests += 1;
                return route.fulfill({ status: 404, body: 'missing' });
            });
        }
        await page.goto(
            readerUrl(STORY_ID, anchors.sceneId, anchors.backgroundPage - 1)
        );
        await waitForVisualReady(page);
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);

        const fallbackSrcBefore =
            await visual.activeBackground.getAttribute('src');
        await visual.root.click();
        await expect(page).toHaveURL(dialogueUrl(anchors.backgroundPage));
        await expectCanonicalVisualLine(page, anchors.backgroundPage);
        // Fallback surfaced without blocking: the banner names the condition,
        // the prior background stays, and the controls remain usable.
        await expect(page.getByRole('status')).toHaveText(
            t.visualAssetFallback
        );
        if (fallbackSrcBefore !== null) {
            await expect(visual.activeBackground).toHaveAttribute(
                'src',
                fallbackSrcBefore
            );
        }
        // The interception was exercised: the reader asked for the blocked
        // object at least once. Zero means the routes never matched and this
        // step asserted nothing.
        expect(blockedRequests).toBeGreaterThanOrEqual(1);
        for (const pattern of blockedPatterns) {
            await page.unroute(pattern);
        }
        await expect(
            page.getByRole('button', { name: t.openHistory })
        ).toBeEnabled();
        await expect(
            page.getByRole('button', { name: t.visualNovelMode, exact: true })
        ).toBeEnabled();
        await expectReleaseIdentity(page, 'asset', EXPECTED_IDENTITY);
    });
});
