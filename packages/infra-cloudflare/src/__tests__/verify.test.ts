import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicReleaseVerificationResultV1 } from '../release-gate/schemas';

const mocks = vi.hoisted(() => ({
    verifyPublicRelease: vi.fn(),
}));

vi.mock('../release-gate/public-release-verifier', () => ({
    verifyPublicRelease: mocks.verifyPublicRelease,
}));

import {
    ORIGIN,
    buildSmokeVerificationInput,
    formatSmokeVerification,
    verifySmokeRelease,
} from '../verify';

const BASE = 'https://assets.example.test';
const RELEASE_ID = `sha256-${'a'.repeat(64)}`;
const MANIFEST_SHA256 = 'b'.repeat(64);

function passedResult(): PublicReleaseVerificationResultV1 {
    return {
        schemaVersion: 1,
        status: 'passed',
        mode: 'active',
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'smoke' },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        checks: [{ id: 'manifest.integrity', status: 'passed' }],
        diagnostics: [],
    };
}

describe('HPA-229 verify compatibility wrapper', () => {
    beforeEach(() => {
        mocks.verifyPublicRelease.mockReset();
    });

    it('retains the fixed smoke defaults as an active public verification input', () => {
        expect(buildSmokeVerificationInput(BASE)).toEqual({
            storyId: 'the_seventh_mirror',
            target: { kind: 'preview', previewId: 'smoke' },
            assetBaseUrl: BASE,
            browserOrigin: ORIGIN,
            mode: 'active',
            omittedIdentities: [],
        });
    });

    it('delegates the fixed smoke to the public verifier and retains source-key isolation', async () => {
        mocks.verifyPublicRelease.mockResolvedValue(passedResult());
        const requests: string[] = [];
        const fetch = vi.fn(async (input: RequestInfo | URL) => {
            requests.push(typeof input === 'string' ? input : input.toString());
            return new Response('not found', { status: 404 });
        }) as unknown as typeof globalThis.fetch;

        const result = await verifySmokeRelease(BASE, { fetch });

        expect(mocks.verifyPublicRelease).toHaveBeenCalledWith(
            buildSmokeVerificationInput(BASE),
            expect.objectContaining({ fetch })
        );
        expect(result.publicVerification).toEqual(passedResult());
        expect(result.sourceKeyAbsent).toBe(true);
        expect(requests).toContain(
            `${BASE}/the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png`
        );
    });

    it('renders established PASS/FAIL output and treats source leakage as a failure', () => {
        const rendered = formatSmokeVerification({
            publicVerification: {
                ...passedResult(),
                status: 'failed',
                checks: [
                    { id: 'manifest.integrity', status: 'passed' },
                    { id: 'object.integrity', status: 'failed' },
                ],
            },
            sourceKeyAbsent: false,
        });

        expect(rendered.output).toContain('PASS  manifest.integrity');
        expect(rendered.output).toContain('FAIL  object.integrity');
        expect(rendered.output).toContain(
            'FAIL  source key absent from delivery bucket'
        );
        expect(rendered.failed).toBe(2);
    });
});
