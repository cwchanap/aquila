import { describe, expect, it, vi } from 'vitest';
import type { VisualNovelReleaseGateReportV1 } from '../schemas';
import {
    gateReportExitCode,
    renderGateHumanReport,
    renderGateJsonReport,
} from '../report';
import { validGateReport } from '../__fixtures__/valid-evidence';
import { parseVisualNovelReleaseGateReportV1 } from '../schemas';

vi.mock('bun:ffi', () => ({
    FFIType: { i32: 5, ptr: 12 },
    dlopen: () => ({
        close: () => undefined,
        symbols: { close: () => 0, openat: () => -1 },
    }),
    ptr: (value: Uint8Array): Uint8Array => value,
}));

function failedVerificationReport(): VisualNovelReleaseGateReportV1 {
    return parseVisualNovelReleaseGateReportV1({
        ...validGateReport,
        status: 'failed',
        checks: {
            ...validGateReport.checks,
            publicCandidate: {
                status: 'failed',
                evidenceIds: ['public'],
            },
        },
        diagnostics: [
            {
                code: 'verification/manifest-mismatch',
                stage: 'manifest',
                message: 'Public manifest checksum did not match',
            },
        ],
    });
}

describe('release-gate reports', () => {
    it('writes one JSON document with no progress text', () => {
        const document = renderGateJsonReport(validGateReport);

        expect(document).toBe(`${JSON.stringify(validGateReport)}\n`);
        expect(
            parseVisualNovelReleaseGateReportV1(JSON.parse(document))
        ).toEqual(validGateReport);
    });

    it('maps failed verification to existing assets exit code 2', () => {
        expect(gateReportExitCode(failedVerificationReport())).toBe(2);
    });

    it('preserves the established assets exit taxonomy', () => {
        const cases = [
            ['configuration', 1],
            ['storage/unavailable', 3],
            ['concurrency/conflict', 4],
            ['activation-target/guarded', 5],
            ['clock-skew', 5],
            ['non-monotonic-pointer-time', 5],
        ] as const;

        for (const [code, expectedExitCode] of cases) {
            const report = failedVerificationReport();
            report.diagnostics = [
                { code, stage: 'input', message: 'Untrusted diagnostic text' },
            ];
            expect(gateReportExitCode(report)).toBe(expectedExitCode);
        }
    });

    it('renders the required human summary fields without evidence paths', () => {
        const human = renderGateHumanReport(validGateReport);

        expect(human).toContain('status: passed');
        expect(human).toContain('story: the_seventh_mirror');
        expect(human).toContain('target: preview');
        expect(human).toContain('preview: hpa-233');
        expect(human).toContain(`release: ${validGateReport.releaseId}`);
        expect(human).toContain(`checksum: ${validGateReport.manifestSha256}`);
        expect(human).toContain(`commit: ${validGateReport.commitSha}`);
        expect(human).toContain('deterministicCi: passed');
        expect(human).toContain(`evidence: ${validGateReport.evidence.length}`);
        expect(human).toContain('diagnostics: none');
        expect(human).not.toContain('ci/result.json');
    });

    it('redacts untrusted diagnostic details from JSON and human reports', () => {
        const unsafe = failedVerificationReport();
        unsafe.diagnostics = [
            {
                code: 'Authorization: Bearer private-token',
                stage: 'input',
                message:
                    'prompt=private-text path=/Users/alice/private/source.json PUBLIC_ASSET_BUCKET=private-bucket signed=https://private.example/object?signature=secret',
                safePath: 'private/source.json',
                publicUrl: 'https://private-bucket.example/object',
            },
        ];
        unsafe.evidence = [
            ...unsafe.evidence,
            {
                id: 'private-bucket',
                kind: 'playwright-result',
                path: 'private-bucket/screenshot.png',
                sha256: 'f'.repeat(64),
                mediaType: 'image/png',
            },
        ];

        const json = renderGateJsonReport(unsafe);
        const human = renderGateHumanReport(unsafe);
        const output = `${json}${human}`;

        expect(parseVisualNovelReleaseGateReportV1(JSON.parse(json))).toEqual(
            expect.objectContaining({
                diagnostics: [
                    expect.objectContaining({
                        code: 'gate/diagnostic',
                        message: 'Release gate diagnostic',
                    }),
                ],
            })
        );
        expect(output).not.toContain('Authorization');
        expect(output).not.toContain('private-token');
        expect(output).not.toContain('private-text');
        expect(output).not.toContain('/Users/');
        expect(output).not.toContain('PUBLIC_ASSET_BUCKET');
        expect(output).not.toContain('private-bucket');
        expect(output).not.toContain('signature=secret');
        expect(output).not.toContain('private/source.json');
    });

    it('redacts independently sensitive commit and evidence ID fields', () => {
        const unsafe = failedVerificationReport();
        unsafe.commitSha = 'Authorization: Bearer commit-token';
        unsafe.evidence = [
            ...unsafe.evidence,
            {
                id: 'private-bucket',
                kind: 'playwright-result',
                path: 'browser/screenshot.png',
                sha256: 'f'.repeat(64),
                mediaType: 'image/png',
            },
        ];

        const json = renderGateJsonReport(unsafe);
        const human = renderGateHumanReport(unsafe);
        const parsed = parseVisualNovelReleaseGateReportV1(JSON.parse(json));

        expect(parsed.commitSha).toBe('[redacted]');
        expect(parsed.evidence).not.toContainEqual(
            expect.objectContaining({ id: 'private-bucket' })
        );
        expect(`${json}${human}`).not.toContain('Authorization');
        expect(`${json}${human}`).not.toContain('commit-token');
        expect(`${json}${human}`).not.toContain('private-bucket');
    });

    it('replaces token-shaped evidence IDs with public aliases', () => {
        const githubToken = 'ghp_0123456789abcdefghijklmnopqrstuvwxyzABCDEF';
        const accessKey = 'AKIAIOSFODNN7EXAMPLE';
        const unsafe = failedVerificationReport();
        unsafe.evidence = [
            ...unsafe.evidence,
            {
                id: githubToken,
                kind: 'ci-result',
                path: 'ci/evidence.json',
                sha256: 'f'.repeat(64),
                mediaType: 'application/json',
            },
            {
                id: accessKey,
                kind: 'r2-verification',
                path: 'r2/evidence.json',
                sha256: 'e'.repeat(64),
                mediaType: 'application/json',
            },
        ];
        unsafe.checks = {
            ...unsafe.checks,
            deterministicCi: { status: 'passed', evidenceIds: [githubToken] },
            r2Candidate: { status: 'passed', evidenceIds: [accessKey] },
        };

        const json = renderGateJsonReport(unsafe);
        const human = renderGateHumanReport(unsafe);
        const parsed = parseVisualNovelReleaseGateReportV1(JSON.parse(json));

        expect(parsed.evidence).toContainEqual(
            expect.objectContaining({ id: 'ci-2' })
        );
        expect(parsed.evidence).toContainEqual(
            expect.objectContaining({ id: 'r2-2' })
        );
        expect(parsed.checks.deterministicCi.evidenceIds).toEqual(['ci-2']);
        expect(parsed.checks.r2Candidate.evidenceIds).toEqual(['r2-2']);
        expect(`${json}${human}`).not.toContain(githubToken);
        expect(`${json}${human}`).not.toContain(accessKey);
    });
});
