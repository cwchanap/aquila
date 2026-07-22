import {
    chromium,
    devices,
    type Browser,
    type BrowserContextOptions,
    type Page,
    type Response,
} from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READER_ROUTE =
    'http://localhost:5090/en/reader?story=the_seventh_mirror&scene=ch1_act1&dialogue=1';
const READER_READY_SELECTOR = '.novel-reader, .mobile-reader';
const RUN_COUNT = 5;
const READER_READY_TIMEOUT_MS = 300_000;
const RESOURCE_TIMING_BUFFER_SIZE = 5_000;
const FULL_RESULTS_ARTIFACT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../.superpowers/sdd/hpa-232-reader-runtime.json'
);
const MOBILE_CPU_THROTTLING_RATE = 4;
const MOBILE_NETWORK_CONDITIONS = {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 75_000,
};
const DESKTOP_CONTEXT_OPTIONS = devices['Desktop Chrome'];
const MOBILE_CONTEXT_OPTIONS = devices['Pixel 5'];
const SELECTED_STORY_RESOURCE_PATHS = [
    '/stories/theSeventhMirror/index.ts',
    '/generated/theSeventhMirror/dialogue.zh.ts',
    '/stories/theSeventhMirror/choices.zh.ts',
    '/generated/theSeventhMirror/flow.ts',
];

interface ResourceMeasurement {
    url: string;
    durationMs: number | null;
}

interface RunMeasurement {
    scriptDurationMs: number;
    resources: ResourceMeasurement[];
}

interface ProfileMeasurement {
    runs: RunMeasurement[];
    medianScriptDurationMs: number;
}

interface CompactRunMeasurement {
    scriptDurationMs: number;
    resourceCount: number;
    storyResources: ResourceMeasurement[];
}

interface CompactProfileMeasurement {
    runs: CompactRunMeasurement[];
    medianScriptDurationMs: number;
}

function getScriptDurationMs(
    metrics: { name: string; value: number }[]
): number {
    const metric = metrics.find(({ name }) => name === 'ScriptDuration');
    if (!metric) {
        throw new Error('Chrome did not report the ScriptDuration metric.');
    }

    return metric.value * 1_000;
}

function median(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

function isSelectedStoryResource(url: string): boolean {
    return SELECTED_STORY_RESOURCE_PATHS.some(resourcePath =>
        url.includes(resourcePath)
    );
}

function compactProfile(
    profile: ProfileMeasurement
): CompactProfileMeasurement {
    return {
        runs: profile.runs.map(run => ({
            scriptDurationMs: run.scriptDurationMs,
            resourceCount: run.resources.length,
            storyResources: run.resources.filter(resource =>
                isSelectedStoryResource(resource.url)
            ),
        })),
        medianScriptDurationMs: profile.medianScriptDurationMs,
    };
}

async function resourceDurations(page: Page): Promise<Map<string, number>> {
    const entries = await page.evaluate(() =>
        performance
            .getEntriesByType('resource')
            .filter(entry => entry.initiatorType === 'script')
            .map(entry => ({ url: entry.name, durationMs: entry.duration }))
    );

    return new Map(entries.map(entry => [entry.url, entry.durationMs]));
}

function responseDuration(
    response: Response,
    durations: Map<string, number>
): number | null {
    const resourceDuration = durations.get(response.url());
    if (resourceDuration !== undefined) {
        return resourceDuration;
    }

    const { responseEnd } = response.request().timing();
    return responseEnd >= 0 ? responseEnd : null;
}

async function measureRun(
    browser: Browser,
    contextOptions: BrowserContextOptions,
    useMobileThrottling: boolean
): Promise<RunMeasurement> {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const scriptResponses: Response[] = [];
    let readerReady = false;

    page.on('response', response => {
        if (!readerReady && response.request().resourceType() === 'script') {
            scriptResponses.push(response);
        }
    });

    try {
        await cdp.send('Performance.enable');
        await page.addInitScript(bufferSize => {
            performance.setResourceTimingBufferSize(bufferSize);
        }, RESOURCE_TIMING_BUFFER_SIZE);
        if (useMobileThrottling) {
            await cdp.send('Emulation.setCPUThrottlingRate', {
                rate: MOBILE_CPU_THROTTLING_RATE,
            });
            await cdp.send(
                'Network.emulateNetworkConditions',
                MOBILE_NETWORK_CONDITIONS
            );
        }

        const beforeMetrics = await cdp.send('Performance.getMetrics');
        await page.goto(READER_ROUTE, { waitUntil: 'commit' });
        await page.waitForSelector(READER_READY_SELECTOR, {
            state: 'attached',
            timeout: READER_READY_TIMEOUT_MS,
        });
        readerReady = true;
        const afterMetrics = await cdp.send('Performance.getMetrics');
        await Promise.all(scriptResponses.map(response => response.finished()));
        const durations = await resourceDurations(page);
        const resources = scriptResponses.map(response => ({
            url: response.url(),
            durationMs: responseDuration(response, durations),
        }));
        const missingDurations = resources.filter(
            resource => resource.durationMs === null
        );

        if (missingDurations.length > 0) {
            throw new Error(
                `Missing resource timing for ${missingDurations.length} pre-readiness JavaScript response(s).`
            );
        }

        return {
            scriptDurationMs:
                getScriptDurationMs(afterMetrics.metrics) -
                getScriptDurationMs(beforeMetrics.metrics),
            resources,
        };
    } finally {
        await context.close();
    }
}

async function measureProfile(
    browser: Browser,
    profileName: string,
    contextOptions: BrowserContextOptions,
    useMobileThrottling: boolean
): Promise<ProfileMeasurement> {
    const runs: RunMeasurement[] = [];
    for (let run = 0; run < RUN_COUNT; run += 1) {
        process.stderr.write(
            `Measuring ${profileName} run ${run + 1}/${RUN_COUNT}\n`
        );
        runs.push(
            await measureRun(browser, contextOptions, useMobileThrottling)
        );
    }

    return {
        runs,
        medianScriptDurationMs: median(runs.map(run => run.scriptDurationMs)),
    };
}

const browser = await chromium.launch();

try {
    const desktop = await measureProfile(
        browser,
        'desktop',
        DESKTOP_CONTEXT_OPTIONS,
        false
    );
    const mobile = await measureProfile(
        browser,
        'mobile',
        MOBILE_CONTEXT_OPTIONS,
        true
    );
    const fullResults = { desktop, mobile };
    const compactResults = {
        desktop: compactProfile(desktop),
        mobile: compactProfile(mobile),
    };

    await mkdir(path.dirname(FULL_RESULTS_ARTIFACT), { recursive: true });
    await writeFile(
        FULL_RESULTS_ARTIFACT,
        `${JSON.stringify(fullResults, null, 2)}\n`
    );
    process.stdout.write(`${JSON.stringify(compactResults, null, 2)}\n`);
} finally {
    await browser.close();
}
