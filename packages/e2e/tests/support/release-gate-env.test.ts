import { describe, expect, it } from 'bun:test';
import {
    buildReleaseGateReaderRoute,
    parseReleaseGateEnv,
    parseReleaseGateScenario,
} from './release-gate-env';

const SHA_A = 'a'.repeat(64);
const RELEASE_ID = `sha256-${SHA_A}`;

const PREVIEW_ENV = {
    BASE_URL: 'https://preview.example.test',
    RELEASE_GATE_TARGET: 'preview',
    RELEASE_GATE_STORY_ID: 'hpa_233_fixture',
    RELEASE_GATE_PREVIEW_ID: 'hpa-233-fixture',
    RELEASE_GATE_RELEASE_ID: RELEASE_ID,
    RELEASE_GATE_MANIFEST_SHA256: SHA_A,
    RELEASE_GATE_SCENARIO:
        'fixtures/visual-release-gates/hpa_233_fixture.v1.json',
};

const SCENARIO = {
    schemaVersion: 1,
    storyId: 'hpa_233_fixture',
    locale: 'en',
    directOpen: { sceneId: 'opening', dialogueIndex: 1 },
    transition: {
        from: { sceneId: 'opening', dialogueIndex: 1 },
        to: { sceneId: 'opening', dialogueIndex: 2 },
        backgroundChanges: true,
        portraitChanges: true,
    },
    bookmark: { sceneId: 'opening', dialogueIndex: 2 },
    omittedFallback: {
        sceneId: 'opening',
        dialogueIndex: 3,
        identity: 'portrait:characters/release_gate/missing',
    },
    choice: {
        sceneId: 'branch',
        dialogueIndex: 0,
        choiceIndex: 0,
        expectedSceneId: 'result',
    },
    unrelatedStoryChunks: ['/_astro/train-adventure-collection-only.js'],
} as const;

describe('release-gate environment and scenario parsing', () => {
    it('requires preview id for preview and rejects it for production', () => {
        const withoutPreviewId = {
            ...PREVIEW_ENV,
            RELEASE_GATE_PREVIEW_ID: undefined,
        };
        expect(() => parseReleaseGateEnv(withoutPreviewId)).toThrow();
        expect(() =>
            parseReleaseGateEnv({
                ...PREVIEW_ENV,
                RELEASE_GATE_TARGET: 'production',
            })
        ).toThrow();
    });

    it('preserves the canonical sha256 release-id contract', () => {
        expect(() =>
            parseReleaseGateEnv({
                ...PREVIEW_ENV,
                RELEASE_GATE_RELEASE_ID: 'rel_aaaaaaaaaaaaaaaa',
            })
        ).toThrow();

        expect(parseReleaseGateEnv(PREVIEW_ENV)).toMatchObject({
            target: 'preview',
            webBaseUrl: 'https://preview.example.test',
            storyId: 'hpa_233_fixture',
            publicationTarget: {
                kind: 'preview',
                previewId: 'hpa-233-fixture',
            },
            expectedIdentity: {
                assetEnvironment: 'preview',
                previewId: 'hpa-233-fixture',
                releaseId: RELEASE_ID,
                manifestSha256: SHA_A,
            },
        });
    });

    it('retains BASE_URL as one canonical deployed origin', () => {
        expect(
            parseReleaseGateEnv({
                ...PREVIEW_ENV,
                BASE_URL: 'https://PREVIEW.example.test:443/',
            }).webBaseUrl
        ).toBe('https://preview.example.test');
        expect(() =>
            parseReleaseGateEnv({
                ...PREVIEW_ENV,
                BASE_URL: 'https://preview.example.test/reader',
            })
        ).toThrow(/origin/i);
    });

    it('strictly parses a scenario, binds it to the requested story, and hashes canonical JSON', () => {
        const canonical = parseReleaseGateScenario(
            JSON.stringify(SCENARIO),
            'hpa_233_fixture'
        );
        const reordered = parseReleaseGateScenario(
            JSON.stringify({
                unrelatedStoryChunks: [
                    '/_astro/train-adventure-collection-only.js',
                ],
                choice: SCENARIO.choice,
                omittedFallback: SCENARIO.omittedFallback,
                bookmark: SCENARIO.bookmark,
                transition: SCENARIO.transition,
                directOpen: SCENARIO.directOpen,
                locale: 'en',
                storyId: 'hpa_233_fixture',
                schemaVersion: 1,
            }),
            'hpa_233_fixture'
        );

        expect(canonical.scenario).toEqual(SCENARIO);
        expect(canonical.scenarioSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(reordered.scenarioSha256).toBe(canonical.scenarioSha256);
        expect(() =>
            parseReleaseGateScenario(JSON.stringify(SCENARIO), 'another_story')
        ).toThrow(/story/i);
    });

    it('maps the scenario zero-based active line to the reader one-based URL', () => {
        expect(buildReleaseGateReaderRoute(SCENARIO, SCENARIO.directOpen)).toBe(
            '/en/reader?story=hpa_233_fixture&scene=opening&dialogue=2'
        );
    });
});
