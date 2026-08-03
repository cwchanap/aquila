import {
    getCurrentPointerPath,
    getReleaseManifestPath,
    isSafeRelativePath,
    isSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { parseWebIdentityEvidenceV1 } from '@aquila/infra-cloudflare/release-gate';
import type { TestInfo } from '@playwright/test';
import type {
    ExpectedWebIdentity,
    ReleaseGateRunContext,
} from './release-gate-env';

export type ReleaseGateScenarioCase = {
    id: string;
    status: 'passed' | 'failed' | 'not-run';
};

export type ReleaseGateRequestPaths = {
    pointerRequestUrl: string | null;
    manifestRequestUrl: string | null;
    observedUrls: string[];
};

export type ReleaseGateBrowserEvidenceV1 = {
    schemaVersion: 1;
    project: string;
    storyId: string;
    target: 'preview' | 'production';
    previewId?: string;
    releaseId: string;
    manifestSha256: string;
    scenarioSha256: string;
    identity: ExpectedWebIdentity;
    requestPaths: ReleaseGateRequestPaths;
    scenarioCases: ReleaseGateScenarioCase[];
    status: 'passed' | 'failed';
    traces: string[];
    screenshots: string[];
};

type ExpectedRequestInput = {
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
};

function requireNonEmptyString(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${name} must be a non-empty string`);
    }
    return value;
}

function safeEvidenceUrl(value: unknown, name: string): string | null {
    if (value === null) return null;
    const url = requireNonEmptyString(value, name);
    if (sanitizeHttpsRequestUrl(url) !== url) {
        throw new Error(`${name} must be a sanitized HTTPS URL`);
    }
    return url;
}

function safeRelativeArtifactPath(value: unknown, name: string): string {
    const path = requireNonEmptyString(value, name);
    if (!isSafeRelativePath(path)) {
        throw new Error(`${name} must be a safe relative path`);
    }
    return path;
}

function storyChunkSegments(storyId: string): string[] {
    const camel = storyId.replace(/_([a-z])/g, (_, letter: string) =>
        letter.toUpperCase()
    );
    return [storyId, storyId.split('_').join('-'), camel];
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

    assertNoUnrelatedStoryRequest(unrelatedStoryIds: readonly string[]): void {
        for (const storyId of unrelatedStoryIds) {
            const requested = this.observedUrls().find(url => {
                const path = decodeURIComponent(new URL(url).pathname);
                return storyChunkSegments(storyId).some(segment =>
                    path.includes(`/stories/${segment}/`)
                );
            });
            if (requested !== undefined) {
                throw new Error(
                    `Browser requested an unrelated story chunk for ${storyId}`
                );
            }
        }
    }
}

function validateIdentity(
    input: Pick<
        ReleaseGateBrowserEvidenceV1,
        'target' | 'previewId' | 'releaseId' | 'manifestSha256' | 'identity'
    >
): ExpectedWebIdentity {
    const identity = parseWebIdentityEvidenceV1({
        schemaVersion: 1,
        target: input.target,
        webBaseUrl: 'https://release-gate.invalid',
        assetEnvironment: input.identity.assetEnvironment,
        ...(input.identity.previewId === undefined
            ? {}
            : { previewId: input.identity.previewId }),
        releaseId: input.identity.releaseId,
        manifestSha256: input.identity.manifestSha256,
        pointerRequestUrl: 'https://release-gate.invalid/current.json',
        manifestRequestUrl:
            'https://release-gate.invalid/runtime-manifest.json',
    });
    if (
        input.previewId !== identity.previewId ||
        input.releaseId !== identity.releaseId ||
        input.manifestSha256 !== identity.manifestSha256
    ) {
        throw new Error(
            'Browser evidence identity must match its top-level release fields'
        );
    }
    return {
        assetEnvironment: identity.assetEnvironment,
        ...(identity.previewId === undefined
            ? {}
            : { previewId: identity.previewId }),
        releaseId: identity.releaseId,
        manifestSha256: identity.manifestSha256,
    };
}

/**
 * Produces the closed browser-evidence shape used by the custom reporter.
 * Every URL is checked again so test attachments cannot reintroduce a signed
 * URL, credentials, headers, or other private request data into retained JSON.
 */
export function createReleaseGateBrowserEvidence(
    input: ReleaseGateBrowserEvidenceV1
): ReleaseGateBrowserEvidenceV1 {
    if (input.schemaVersion !== 1) {
        throw new Error('schemaVersion must be 1 for browser evidence');
    }
    const project = requireNonEmptyString(input.project, 'project');
    const storyId = requireNonEmptyString(input.storyId, 'storyId');
    if (input.target !== 'preview' && input.target !== 'production') {
        throw new Error('target must be preview or production');
    }
    if (!isSha256(input.scenarioSha256)) {
        throw new Error('scenarioSha256 must be a SHA-256 digest');
    }
    const identity = validateIdentity(input);
    const observedUrls = input.requestPaths.observedUrls.map((url, index) =>
        safeEvidenceUrl(url, `requestPaths.observedUrls[${index}]`)
    );
    if (observedUrls.some(url => url === null)) {
        throw new Error('Observed request URLs must be present HTTPS URLs');
    }

    const scenarioCases = input.scenarioCases.map((scenarioCase, index) => {
        const id = requireNonEmptyString(
            scenarioCase.id,
            `scenarioCases[${index}].id`
        );
        if (!['passed', 'failed', 'not-run'].includes(scenarioCase.status)) {
            throw new Error(`scenarioCases[${index}].status is invalid`);
        }
        return { id, status: scenarioCase.status };
    });
    if (input.status !== 'passed' && input.status !== 'failed') {
        throw new Error('status must be passed or failed');
    }

    return {
        schemaVersion: 1,
        project,
        storyId,
        target: input.target,
        ...(input.previewId === undefined
            ? {}
            : { previewId: input.previewId }),
        releaseId: identity.releaseId,
        manifestSha256: identity.manifestSha256,
        scenarioSha256: input.scenarioSha256,
        identity,
        requestPaths: {
            pointerRequestUrl: safeEvidenceUrl(
                input.requestPaths.pointerRequestUrl,
                'requestPaths.pointerRequestUrl'
            ),
            manifestRequestUrl: safeEvidenceUrl(
                input.requestPaths.manifestRequestUrl,
                'requestPaths.manifestRequestUrl'
            ),
            observedUrls: [...new Set(observedUrls as string[])].sort(),
        },
        scenarioCases,
        status: input.status,
        traces: input.traces.map((path, index) =>
            safeRelativeArtifactPath(path, `traces[${index}]`)
        ),
        screenshots: input.screenshots.map((path, index) =>
            safeRelativeArtifactPath(path, `screenshots[${index}]`)
        ),
    };
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
    let requestPaths: ReleaseGateRequestPaths;
    try {
        requestPaths = input.requests.assertExpectedRequests({
            storyId: env.storyId,
            target: env.publicationTarget,
            releaseId: env.expectedIdentity.releaseId,
        });
    } catch (error) {
        if (input.status !== 'failed') throw error;
        requestPaths = {
            pointerRequestUrl: null,
            manifestRequestUrl: null,
            observedUrls: input.requests.observedUrls(),
        };
    }
    const evidence = createReleaseGateBrowserEvidence({
        schemaVersion: 1,
        project: input.project,
        storyId: scenario.storyId,
        target: env.target,
        ...(env.expectedIdentity.previewId === undefined
            ? {}
            : { previewId: env.expectedIdentity.previewId }),
        releaseId: env.expectedIdentity.releaseId,
        manifestSha256: env.expectedIdentity.manifestSha256,
        scenarioSha256,
        identity: env.expectedIdentity,
        requestPaths,
        scenarioCases: input.scenarioCases,
        status: input.status ?? 'passed',
        traces: [],
        screenshots: [],
    });
    await testInfo.attach('release-gate-evidence', {
        body: Buffer.from(JSON.stringify(evidence)),
        contentType: 'application/json',
    });
}
