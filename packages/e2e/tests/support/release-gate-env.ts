import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
    canonicalJson,
    isStoryId,
    type JsonValue,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import {
    parsePublicationTargetV1,
    parseVisualNovelGateScenarioV1,
    parseWebIdentityEvidenceV1,
    type VisualNovelGateScenarioV1,
} from '@aquila/infra-cloudflare/release-gate';

export type ReleaseGateEnvironment = Record<string, string | undefined>;

export type ExpectedWebIdentity = {
    assetEnvironment: 'preview' | 'production';
    previewId?: string;
    releaseId: string;
    manifestSha256: string;
};

export type ParsedReleaseGateEnv = {
    target: 'preview' | 'production';
    webBaseUrl: string;
    assetBaseUrl: string;
    storyId: string;
    publicationTarget: PublicationTarget;
    expectedIdentity: ExpectedWebIdentity;
    scenarioPath: string;
    evidenceDirectory?: string;
};

export type ParsedReleaseGateScenario = {
    scenario: VisualNovelGateScenarioV1;
    scenarioSha256: string;
};

export type ReleaseGateRunContext = ParsedReleaseGateScenario & {
    env: ParsedReleaseGateEnv;
};

export type ReleaseGatePosition = {
    sceneId: string;
    dialogueIndex: number;
};

function required(env: ReleaseGateEnvironment, name: string): string {
    const value = env[name]?.trim();
    if (value === undefined || value === '') {
        throw new Error(`${name} must be set for release-gate browser tests`);
    }
    return value;
}

function optional(
    env: ReleaseGateEnvironment,
    name: string
): string | undefined {
    const value = env[name]?.trim();
    return value === undefined || value === '' ? undefined : value;
}

function canonicalHttpsOrigin(value: string, name: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be a canonical HTTPS origin`);
    }
    if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.pathname !== '/' ||
        url.search !== '' ||
        url.hash !== ''
    ) {
        throw new Error(`${name} must be a canonical HTTPS origin`);
    }
    return url.origin;
}

/**
 * Scenarios use the reader's canonical zero-based dialogue index. The
 * deployed reader URL deliberately serializes that position as a one-based
 * `dialogue=N` parameter, matching reader-session.ts and bookmark links.
 */
export function buildReleaseGateReaderRoute(
    scenario: Pick<VisualNovelGateScenarioV1, 'storyId' | 'locale'>,
    position: ReleaseGatePosition
): string {
    const query = new URLSearchParams({
        story: scenario.storyId,
        scene: position.sceneId,
        dialogue: String(position.dialogueIndex + 1),
    });
    return `/${scenario.locale}/reader?${query.toString()}`;
}

/**
 * Parses only browser-gate configuration. The remote origin is deliberately
 * owned by Task 7's Playwright config, so a test cannot reinterpret its
 * remote-only or target/origin guard here.
 */
export function parseReleaseGateEnv(
    env: ReleaseGateEnvironment
): ParsedReleaseGateEnv {
    const webBaseUrl = canonicalHttpsOrigin(required(env, 'BASE_URL'), 'BASE_URL');
    const assetBaseUrl = canonicalHttpsOrigin(
        required(env, 'PUBLIC_ASSET_BASE_URL'),
        'PUBLIC_ASSET_BASE_URL'
    );
    const target = required(env, 'RELEASE_GATE_TARGET');
    if (target !== 'preview' && target !== 'production') {
        throw new Error('RELEASE_GATE_TARGET must be preview or production');
    }

    const previewId = optional(env, 'RELEASE_GATE_PREVIEW_ID');
    const evidenceDirectory = optional(env, 'RELEASE_GATE_EVIDENCE_DIR');
    const publicationTarget = parsePublicationTargetV1(
        target === 'preview'
            ? {
                  kind: 'preview',
                  previewId: required(env, 'RELEASE_GATE_PREVIEW_ID'),
              }
            : { kind: 'production' }
    );
    if (target === 'production' && previewId !== undefined) {
        throw new Error(
            'Production release-gate tests reject RELEASE_GATE_PREVIEW_ID'
        );
    }

    const storyId = required(env, 'RELEASE_GATE_STORY_ID');
    if (!isStoryId(storyId)) {
        throw new Error(
            'RELEASE_GATE_STORY_ID must be a lowercase underscore slug'
        );
    }

    const parsedIdentity = parseWebIdentityEvidenceV1({
        schemaVersion: 1,
        target,
        webBaseUrl: 'https://release-gate.invalid',
        assetEnvironment: target,
        ...(previewId === undefined ? {} : { previewId }),
        releaseId: required(env, 'RELEASE_GATE_RELEASE_ID'),
        manifestSha256: required(env, 'RELEASE_GATE_MANIFEST_SHA256'),
        pointerRequestUrl: 'https://release-gate.invalid/current.json',
        manifestRequestUrl:
            'https://release-gate.invalid/runtime-manifest.json',
    });

    return {
        target,
        webBaseUrl,
        assetBaseUrl,
        storyId,
        publicationTarget,
        expectedIdentity: {
            assetEnvironment: parsedIdentity.assetEnvironment,
            ...(parsedIdentity.previewId === undefined
                ? {}
                : { previewId: parsedIdentity.previewId }),
            releaseId: parsedIdentity.releaseId,
            manifestSha256: parsedIdentity.manifestSha256,
        },
        scenarioPath: required(env, 'RELEASE_GATE_SCENARIO'),
        ...(evidenceDirectory === undefined ? {} : { evidenceDirectory }),
    };
}

export function parseReleaseGateScenario(
    text: string,
    expectedStoryId: string
): ParsedReleaseGateScenario {
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(text) as unknown;
    } catch {
        throw new Error('RELEASE_GATE_SCENARIO must contain valid JSON');
    }

    const scenario = parseVisualNovelGateScenarioV1(parsedJson);
    if (scenario.storyId !== expectedStoryId) {
        throw new Error(
            'Release-gate scenario story id must match RELEASE_GATE_STORY_ID'
        );
    }

    return {
        scenario,
        scenarioSha256: createHash('sha256')
            .update(canonicalJson(scenario as JsonValue))
            .digest('hex'),
    };
}

export async function loadReleaseGateRunContext(
    env: ReleaseGateEnvironment
): Promise<ReleaseGateRunContext> {
    const parsedEnv = parseReleaseGateEnv(env);
    let text: string;
    try {
        text = await readFile(parsedEnv.scenarioPath, 'utf8');
    } catch (error) {
        throw new Error('RELEASE_GATE_SCENARIO could not be read', {
            cause: error,
        });
    }

    return {
        env: parsedEnv,
        ...parseReleaseGateScenario(text, parsedEnv.storyId),
    };
}
