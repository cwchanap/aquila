import { describe, expect, it } from 'bun:test';
import {
    getCurrentPointerPath,
    getReleaseManifestPath,
} from '@aquila/stories/runtime-assets';
import { parseBrowserEvidenceProjectV1 } from '@aquila/infra-cloudflare/release-gate';
import {
    attachReleaseGateEvidence,
    ReleaseGateRequestRecorder,
    sanitizeHttpsRequestUrl,
} from './release-gate-evidence';
import type { ReleaseGateRunContext } from './release-gate-env';

const SHA_A = 'a'.repeat(64);
const RELEASE_ID = `sha256-${SHA_A}`;
const TARGET = { kind: 'preview', previewId: 'hpa-233-fixture' } as const;
const STORY_ID = 'hpa_233_fixture';
const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
const manifestPath = getReleaseManifestPath(STORY_ID, RELEASE_ID, TARGET);
const pointerUrl = `https://assets.example.test/${pointerPath}`;
const manifestUrl = `https://assets.example.test/${manifestPath}`;

describe('release-gate browser evidence', () => {
    it('records only sanitized HTTPS request URLs', () => {
        expect(
            sanitizeHttpsRequestUrl(
                'https://operator:secret@assets.example.test/vn/current.json?signature=secret#fragment'
            )
        ).toBe('https://assets.example.test/vn/current.json');
        expect(
            sanitizeHttpsRequestUrl(
                'http://assets.example.test/vn/current.json'
            )
        ).toBeNull();
    });

    it('requires canonical pointer and immutable manifest requests', () => {
        const recorder = new ReleaseGateRequestRecorder();
        recorder.observe(`${manifestUrl}?signed=private`);
        recorder.observe(`${pointerUrl}?cache-buster=private`);
        recorder.observe('http://assets.example.test/not-stored');

        expect(
            recorder.assertExpectedRequests({
                storyId: STORY_ID,
                target: TARGET,
                releaseId: RELEASE_ID,
            })
        ).toEqual({
            pointerRequestUrl: pointerUrl,
            manifestRequestUrl: manifestUrl,
            observedUrls: [pointerUrl, manifestUrl],
        });
    });

    it('rejects a local visual asset fixture path in a remote run', () => {
        const recorder = new ReleaseGateRequestRecorder();
        recorder.observe(pointerUrl);
        recorder.observe(manifestUrl);
        recorder.observe('https://preview.example.test/assets/vn/fixture.webp');

        expect(() =>
            recorder.assertExpectedRequests({
                storyId: STORY_ID,
                target: TARGET,
                releaseId: RELEASE_ID,
            })
        ).toThrow(/local visual asset fixture/i);
    });

    it('matches configured unrelated deployment pathnames exactly', () => {
        const exact = new ReleaseGateRequestRecorder();
        exact.observe(
            'https://preview.example.test/_astro/train-adventure-collection-only.js?signature=private'
        );
        expect(() =>
            exact.assertNoUnrelatedStoryRequest([
                '/_astro/train-adventure-collection-only.js',
            ])
        ).toThrow(/unrelated story chunk/i);

        const nearMatch = new ReleaseGateRequestRecorder();
        nearMatch.observe(
            'https://preview.example.test/_astro/train-adventure-collection-only-extra.js'
        );
        expect(() =>
            nearMatch.assertNoUnrelatedStoryRequest([
                '/_astro/train-adventure-collection-only.js',
            ])
        ).not.toThrow();
    });

    it('attaches a shared failed project record without requests or raw trace fields', async () => {
        const attachments: Buffer[] = [];
        const releaseGate = {
            env: {
                target: 'preview',
                webBaseUrl: 'https://preview.example.test',
                storyId: STORY_ID,
                publicationTarget: TARGET,
                expectedIdentity: {
                    assetEnvironment: 'preview',
                    previewId: TARGET.previewId,
                    releaseId: RELEASE_ID,
                    manifestSha256: SHA_A,
                },
                scenarioPath: 'fixture.json',
            },
            scenario: { storyId: STORY_ID },
            scenarioSha256: 'b'.repeat(64),
        } as ReleaseGateRunContext;

        await attachReleaseGateEvidence(
            {
                attach: async (
                    _name: string,
                    attachment: { body?: string | Buffer }
                ) => {
                    if (attachment.body !== undefined) {
                        attachments.push(attachment.body as Buffer);
                    }
                },
            } as never,
            {
                releaseGate,
                project: 'release-gate-chromium',
                requests: new ReleaseGateRequestRecorder(),
                scenarioCases: [{ id: 'direct-open', status: 'failed' }],
                status: 'failed',
            }
        );

        expect(attachments).toHaveLength(1);
        const evidence = parseBrowserEvidenceProjectV1(
            JSON.parse(attachments[0]!.toString('utf8'))
        );
        expect(evidence).toMatchObject({
            flow: 'preview-release-gate',
            webBaseUrl: 'https://preview.example.test',
            target: TARGET,
            assetEnvironment: 'preview',
            status: 'failed',
            requestPaths: {
                pointerRequestUrl: null,
                manifestRequestUrl: null,
            },
        });
        expect(evidence.scenarioCases).toHaveLength(10);
        expect(evidence.scenarioCases[0]).toEqual({
            id: 'direct-open',
            status: 'failed',
        });
        expect(JSON.stringify(evidence)).not.toContain('observedUrls');
        expect(JSON.stringify(evidence)).not.toContain('trace');
    });
});
