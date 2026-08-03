import {
    getCurrentPointerPath,
    getReleaseManifestPath,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import {
    parseBrowserEvidenceProjectV1,
    type BrowserEvidenceFlowV1,
    type BrowserEvidenceScenarioCaseV1,
} from '@aquila/infra-cloudflare/release-gate';
import type { TestInfo } from '@playwright/test';
import type { ReleaseGateRunContext } from './release-gate-env';

export type ReleaseGateScenarioCase = BrowserEvidenceScenarioCaseV1;

export type ReleaseGateRequestPaths = {
    pointerRequestUrl: string | null;
    manifestRequestUrl: string | null;
    observedUrls: string[];
};

type ExpectedRequestInput = {
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
};

const previewScenarioCaseIds = [
    'direct-open',
    'identity-and-requests',
    'visual-transition',
    'mode-swap',
    'viewport-swap',
    'history-focus',
    'bookmark-restore',
    'omitted-fallback',
    'choice',
    'reload-and-lazy-chunk',
] as const;

const productionScenarioCaseIds = [
    'direct-open',
    'identity-and-decode',
    'progression',
    'read-only',
] as const;

function flowForTarget(
    target: 'preview' | 'production'
): BrowserEvidenceFlowV1 {
    return target === 'preview' ? 'preview-release-gate' : 'production-smoke';
}

function scenarioCaseIds(flow: BrowserEvidenceFlowV1): readonly string[] {
    return flow === 'preview-release-gate'
        ? previewScenarioCaseIds
        : productionScenarioCaseIds;
}

function completeFailedScenarioCases(
    flow: BrowserEvidenceFlowV1,
    scenarioCases: readonly ReleaseGateScenarioCase[]
): ReleaseGateScenarioCase[] {
    const supplied = new Map<string, ReleaseGateScenarioCase>();
    for (const scenarioCase of scenarioCases) {
        if (supplied.has(scenarioCase.id)) {
            throw new Error('Release-gate scenario case ids must be unique');
        }
        supplied.set(scenarioCase.id, scenarioCase);
    }
    const expectedCaseIds = scenarioCaseIds(flow);
    if (
        [...supplied.keys()].some(caseId => !expectedCaseIds.includes(caseId))
    ) {
        throw new Error('Release-gate scenario case id is not configured');
    }
    return expectedCaseIds.map(
        caseId => supplied.get(caseId) ?? { id: caseId, status: 'not-run' }
    );
}

export function sanitizeHttpsRequestUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

/** Collects only public, credential-free URLs before browser navigation. */
export class ReleaseGateRequestRecorder {
    private readonly urls = new Set<string>();
    private readonly methods = new Set<string>();
    private localFixtureRequested = false;

    observe(url: string, method = 'GET'): void {
        try {
            if (new URL(url).pathname.includes('/assets/vn/')) {
                this.localFixtureRequested = true;
            }
        } catch {
            // Malformed requests are excluded from retained evidence below.
        }
        const sanitized = sanitizeHttpsRequestUrl(url);
        if (sanitized !== null) this.urls.add(sanitized);
        this.methods.add(method.toUpperCase());
    }

    observedUrls(): string[] {
        return [...this.urls].sort();
    }

    mutatingMethods(): string[] {
        return [...this.methods]
            .filter(method => !['GET', 'HEAD', 'OPTIONS'].includes(method))
            .sort();
    }

    assertExpectedRequests(
        input: ExpectedRequestInput
    ): ReleaseGateRequestPaths {
        const observedUrls = this.observedUrls();
        if (this.localFixtureRequested) {
            throw new Error(
                'Remote release-gate flow requested a local visual asset fixture path'
            );
        }

        const pointerPath = `/${getCurrentPointerPath(
            input.storyId,
            input.target
        )}`;
        const manifestPath = `/${getReleaseManifestPath(
            input.storyId,
            input.releaseId,
            input.target
        )}`;
        const pointerRequestUrl = observedUrls.find(
            url => new URL(url).pathname === pointerPath
        );
        const manifestRequestUrl = observedUrls.find(
            url => new URL(url).pathname === manifestPath
        );
        if (pointerRequestUrl === undefined) {
            throw new Error(
                'Browser did not request the expected release pointer path'
            );
        }
        if (manifestRequestUrl === undefined) {
            throw new Error(
                'Browser did not request the expected immutable manifest path'
            );
        }

        return { pointerRequestUrl, manifestRequestUrl, observedUrls };
    }

    assertNoUnrelatedStoryRequest(
        unrelatedStoryChunks: readonly string[]
    ): void {
        const observedPathnames = new Set(
            this.observedUrls().map(url => new URL(url).pathname)
        );
        if (
            unrelatedStoryChunks.some(pathname =>
                observedPathnames.has(pathname)
            )
        ) {
            throw new Error('Browser requested an unrelated story chunk');
        }
    }
}

export async function attachReleaseGateEvidence(
    testInfo: TestInfo,
    input: {
        releaseGate: ReleaseGateRunContext;
        project: string;
        requests: ReleaseGateRequestRecorder;
        scenarioCases: ReleaseGateScenarioCase[];
        status?: 'passed' | 'failed';
    }
): Promise<void> {
    const { env, scenario, scenarioSha256 } = input.releaseGate;
    const status = input.status ?? 'passed';
    const flow = flowForTarget(env.target);
    let requestPaths: ReleaseGateRequestPaths;
    try {
        requestPaths = input.requests.assertExpectedRequests({
            storyId: env.storyId,
            target: env.publicationTarget,
            releaseId: env.expectedIdentity.releaseId,
        });
    } catch (error) {
        if (status !== 'failed') throw error;
        requestPaths = {
            pointerRequestUrl: null,
            manifestRequestUrl: null,
            observedUrls: input.requests.observedUrls(),
        };
    }
    const evidence = parseBrowserEvidenceProjectV1({
        schemaVersion: 1,
        flow,
        project: input.project,
        status,
        storyId: scenario.storyId,
        target: env.publicationTarget,
        assetEnvironment: env.expectedIdentity.assetEnvironment,
        releaseId: env.expectedIdentity.releaseId,
        manifestSha256: env.expectedIdentity.manifestSha256,
        scenarioSha256,
        requestPaths: {
            pointerRequestUrl: requestPaths.pointerRequestUrl,
            manifestRequestUrl: requestPaths.manifestRequestUrl,
        },
        scenarioCases:
            status === 'failed'
                ? completeFailedScenarioCases(flow, input.scenarioCases)
                : input.scenarioCases,
        screenshots: [],
    });
    await testInfo.attach('release-gate-evidence', {
        body: Buffer.from(JSON.stringify(evidence)),
        contentType: 'application/json',
    });
}
