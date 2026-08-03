import { loadR2DeliveryConfig } from './config';
import {
    PublicReleaseVerificationError,
    verifyPublicRelease,
    type PublicVerifierDependencies,
} from './release-gate/public-release-verifier';
import type {
    PublicReleaseVerificationInputV1,
    PublicReleaseVerificationResultV1,
} from './release-gate/schemas';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_ID = 'smoke';
const TARGET = { kind: 'preview', previewId: PREVIEW_ID } as const;
// Stands in for the web app origin a browser would send, so the public
// delivery service exercises the same CORS policy a reader needs.
export const ORIGIN = 'https://aquila.cwchanap.dev';
// HPA-229 compatibility: this is an authoring-bucket source key, never a
// public-layout helper. The generic verifier proves release-bound documents;
// this legacy smoke additionally proves this known raw source was not copied
// into the delivery host. A 404 is the only definitive absence response.
const SOURCE_PROBE_KEY =
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
let requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;

export type SmokeVerificationResult = {
    publicVerification: PublicReleaseVerificationResultV1;
    sourceKeyAbsent: boolean;
};

export type SmokeVerificationRender = {
    output: string;
    failed: number;
};

/** @internal Overrides the source-probe deadline for deterministic tests. */
export function _setRequestTimeout(ms: number): void {
    requestTimeoutMs = ms;
}

export function buildSmokeVerificationInput(
    assetBaseUrl: string
): PublicReleaseVerificationInputV1 {
    return {
        storyId: STORY_ID,
        target: TARGET,
        assetBaseUrl,
        browserOrigin: ORIGIN,
        mode: 'active',
        omittedIdentities: [],
    };
}

async function sourceKeyIsAbsent(
    assetBaseUrl: string,
    fetchImpl: typeof globalThis.fetch
): Promise<boolean> {
    const base = new URL(assetBaseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const url = new URL(SOURCE_PROBE_KEY, base).toString();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            const error = new Error('source-key probe timed out');
            controller.abort(error);
            reject(error);
        }, requestTimeoutMs);
        timer.unref?.();
    });
    try {
        const response = await Promise.race([
            fetchImpl(url, {
                headers: { origin: ORIGIN },
                signal: controller.signal,
            }),
            deadline,
        ]);
        return response.status === 404;
    } catch {
        return false;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/**
 * Runs the fixed HPA-229 smoke as an active public-release verification while
 * retaining its historical delivery-only source-key isolation check.
 */
export async function verifySmokeRelease(
    assetBaseUrl: string,
    dependencies: Partial<PublicVerifierDependencies> = {}
): Promise<SmokeVerificationResult> {
    const publicVerification = await verifyPublicRelease(
        buildSmokeVerificationInput(assetBaseUrl),
        dependencies
    );
    const sourceKeyAbsent = await sourceKeyIsAbsent(
        assetBaseUrl,
        dependencies.fetch ?? globalThis.fetch
    );
    return { publicVerification, sourceKeyAbsent };
}

/**
 * Preserves the existing human-facing PASS/FAIL style for HPA-229 operators.
 * Structured details remain in the release-gate result; this wrapper never
 * renders raw network errors or public document bodies.
 */
export function formatSmokeVerification(
    verification: SmokeVerificationResult
): SmokeVerificationRender {
    const lines = verification.publicVerification.checks.map(
        check => `${check.status === 'passed' ? 'PASS' : 'FAIL'}  ${check.id}`
    );
    lines.push(
        `${verification.sourceKeyAbsent ? 'PASS' : 'FAIL'}  source key absent from delivery bucket`
    );
    const failed =
        verification.publicVerification.checks.filter(
            check => check.status === 'failed'
        ).length + (verification.sourceKeyAbsent ? 0 : 1);
    lines.push(
        failed === 0
            ? 'All required checks passed.'
            : `${failed} check(s) failed.`
    );
    return { output: `${lines.join('\n')}\n`, failed };
}

function formatFatalSmokeVerification(error: unknown): SmokeVerificationRender {
    const check =
        error instanceof PublicReleaseVerificationError
            ? error.code
            : 'verification/unavailable';
    return {
        output: `FAIL  ${check}\n1 check(s) failed.\n`,
        failed: 1,
    };
}

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const base = `https://${config.hostname}`;
    console.log(
        `Verifying ${base} — story ${STORY_ID}, preview ${PREVIEW_ID}\n`
    );
    const verification = await verifySmokeRelease(base);
    const rendered = formatSmokeVerification(verification);
    process.stdout.write(rendered.output);
    if (rendered.failed > 0) process.exitCode = 1;
}

/* v8 ignore next */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    try {
        await main();
    } catch (error) {
        const rendered = formatFatalSmokeVerification(error);
        process.stdout.write(rendered.output);
        if (rendered.failed > 0) process.exitCode = 1;
    }
}
