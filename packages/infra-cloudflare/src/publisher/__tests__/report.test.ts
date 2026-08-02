import { describe, expect, it } from 'vitest';
import type { PublicationTarget } from '@aquila/stories/runtime-assets';
import {
    createHumanProgressSink,
    normalizeReportDiagnostics,
    publisherReportExitCode,
    renderHumanReport,
    renderJsonReport,
    type PublisherReportV1,
} from '../report';
import type { PublisherCommandName } from '../types';

const target: PublicationTarget = { kind: 'preview', previewId: 'hpa-230' };

function report(
    status: PublisherReportV1['status'] = 'success'
): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: 'plan',
        status,
        storyId: 'example_story',
        target,
        counts: {
            included: 1,
            omitted: 0,
            objectsCreated: 2,
            objectsReused: 0,
            manifestsCreated: 1,
            manifestsReused: 0,
            pointersWritten: 0,
        },
        actions: [],
        warnings: [],
        errors: [],
    };
}

describe('publisher reports', () => {
    it('supports every public publisher command and distinct final statuses', () => {
        const commands = [
            'plan',
            'publish',
            'mirror-preview',
            'activate',
            'verify',
            'releases',
            'rollback',
        ] satisfies PublisherCommandName[];
        const statuses: PublisherReportV1['status'][] = [
            'success',
            'no-op',
            'failed',
            'conflict',
        ];

        expect(commands).toHaveLength(7);
        expect(statuses.map(status => report(status).status)).toEqual(statuses);
    });

    it('maps both successful mutation and no-op to exit code zero', () => {
        expect(publisherReportExitCode(report('success'))).toBe(0);
        expect(publisherReportExitCode(report('no-op'))).toBe(0);
        expect(publisherReportExitCode(report('conflict'))).toBe(4);
        expect(publisherReportExitCode(report('failed'))).not.toBe(0);
    });

    it('renders a stable public JSON shape without prompts or absolute paths', () => {
        const unsafe = report() as PublisherReportV1 & {
            prompt: string;
            repositoryRoot: string;
        };
        unsafe.prompt = 'a secret authoring prompt';
        unsafe.repositoryRoot = '/Users/alice/private/aquila';
        unsafe.encoderFingerprint = {
            schemaVersion: 1,
            policyId: 'aquila-vn-encoder-v1',
            sharpVersion: 'private-bucket',
            libvipsVersion: 'Authorization-secret',
            platform: 'private-provider' as NodeJS.Platform,
            arch: 'request-secret',
        };
        unsafe.actions = [
            {
                stage: 'private-provider',
                kind: 'include',
                identity: 'request:provider-private-object',
                key: 'private-bucket/request.json',
            },
        ];
        unsafe.coverage = {
            storyId: 'example_story',
            byType: {
                background: {
                    total: 1,
                    included: 1,
                    omitted: 0,
                    unclassified: 0,
                },
                portrait: {
                    total: 0,
                    included: 0,
                    omitted: 0,
                    unclassified: 0,
                },
            },
            bySection: {
                '/Users/alice/private': {
                    total: 1,
                    included: 1,
                    omitted: 0,
                    unclassified: 0,
                },
            },
            totals: {
                total: 1,
                included: 1,
                omitted: 0,
                unclassified: 0,
            },
            prompt: 'nested secret prompt',
        } as PublisherReportV1['coverage'];
        unsafe.warnings = [
            {
                code: 'Authorization: Bearer private-token',
                stage: 'aws-s3-private-provider',
                message:
                    'private authoring prompt Authorization: Bearer private-token bucket=private-bucket request={secret} path="/Volumes/My Team/private image.png" uri=file:///Volumes/team/private.png',
                identity: 'request:provider-private-object',
                safePath: '/Volumes/My Team/private image.png',
                sampleIdentities: [
                    'Authorization: Bearer sample-token',
                    'prompt:private-story-text',
                ],
            },
        ];

        const json = renderJsonReport(unsafe);
        const parsed = JSON.parse(json) as Record<string, unknown>;

        expect(parsed).not.toHaveProperty('prompt');
        expect(parsed).not.toHaveProperty('repositoryRoot');
        expect(json).not.toContain('secret authoring prompt');
        expect(json).not.toContain('/Users/');
        expect(json).not.toContain('/opt/');
        expect(json).not.toContain('/Volumes/');
        expect(json).not.toContain('file://');
        expect(json).not.toContain('Authorization');
        expect(json).not.toContain('private-token');
        expect(json).not.toContain('sample-token');
        expect(json).not.toContain('private-bucket');
        expect(json).not.toContain('request={secret}');
        expect(json).not.toContain('private authoring prompt');
        expect(json).not.toContain('private-story-text');
        expect(json).not.toContain('provider-private-object');
        expect(json).not.toContain('private-provider');
        expect(json).not.toContain('request-secret');
        expect(json.endsWith('\n')).toBe(true);
    });

    it('writes bounded human progress only to the supplied stderr stream', () => {
        let stderr = '';
        let stdout = '';
        const sink = createHumanProgressSink({
            write(chunk) {
                stderr += String(chunk);
                return true;
            },
        });

        sink({
            stage: 'encode',
            completed: 2,
            total: 3,
            message:
                'Authorization: Bearer progress-token provider=aws bucket=private-bucket prompt=private-text request={raw} path="/Volumes/My Team/private image.png"',
        });

        expect(stderr).toBe('encode 2/3\n');
        expect(stdout).toBe('');
        expect(renderHumanReport(report())).toContain('status: success');
        stdout = '';
    });

    it('aggregates repeated diagnostics with bounded sorted samples', () => {
        const diagnostics = Array.from({ length: 12 }, (_, index) => ({
            code: 'source/aspect-ratio',
            stage: 'source',
            message: 'Source aspect ratio differs from the background policy',
            assetType: 'background' as const,
            identity: `background:${String.fromCharCode(122 - index)}`,
            safePath: `${String.fromCharCode(122 - index)}.png`,
        }));

        expect(normalizeReportDiagnostics(diagnostics)).toEqual([
            expect.objectContaining({
                count: 12,
                sampleIdentities: [
                    'background:o',
                    'background:p',
                    'background:q',
                    'background:r',
                    'background:s',
                ],
                sampleSafePaths: ['o.png', 'p.png', 'q.png', 'r.png', 's.png'],
            }),
        ]);
    });

    it('groups equivalent diagnostics only by code and asset type', () => {
        const input = [
            {
                code: 'source/aspect-ratio',
                stage: 'source',
                message: 'second message with private request text',
                assetType: 'background' as const,
                identity: 'background:b',
            },
            {
                code: 'source/aspect-ratio',
                stage: 'encode',
                message: 'first message with Authorization token',
                assetType: 'background' as const,
                identity: 'background:a',
            },
        ];

        const forward = normalizeReportDiagnostics(input);
        const reverse = normalizeReportDiagnostics([...input].reverse());

        expect(forward).toEqual(reverse);
        expect(forward).toEqual([
            expect.objectContaining({
                code: 'source/aspect-ratio',
                stage: 'encode',
                message:
                    'Source aspect ratio differs from the background policy',
                assetType: 'background',
                count: 2,
                sampleIdentities: ['background:a', 'background:b'],
            }),
        ]);
    });

    it('preserves canonical CJK and spaced logical identities and sections', () => {
        const canonicalIdentity = 'background:第一章/鏡 房/夜';
        const input = report();
        input.actions = [
            {
                stage: 'input',
                kind: 'include',
                identity: canonicalIdentity,
            },
        ];
        input.warnings = [
            {
                code: 'source/aspect-ratio',
                stage: 'source',
                message: 'untrusted message is replaced',
                assetType: 'background',
                identity: canonicalIdentity,
            },
        ];
        input.coverage = {
            storyId: 'example_story',
            byType: {
                background: {
                    total: 1,
                    included: 1,
                    omitted: 0,
                    unclassified: 0,
                },
                portrait: {
                    total: 0,
                    included: 0,
                    omitted: 0,
                    unclassified: 0,
                },
            },
            bySection: {
                '第一章/鏡 房/夜': {
                    total: 1,
                    included: 1,
                    omitted: 0,
                    unclassified: 0,
                },
            },
            totals: {
                total: 1,
                included: 1,
                omitted: 0,
                unclassified: 0,
            },
        };

        const json = renderJsonReport(input);

        expect(json).toContain(canonicalIdentity);
        expect(json).toContain('第一章/鏡 房/夜');
        expect(json).not.toContain('untrusted message is replaced');
    });
});
