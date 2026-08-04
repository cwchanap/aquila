import {
    getCurrentPointerPath,
    getReleaseManifestPath,
    isReleaseId,
    isSha256,
    isStoryId,
} from '@aquila/stories/runtime-assets';
import type { GateDiagnosticV1 } from './diagnostics';
import {
    verifyPublicRelease,
    type PublicVerifierDependencies,
} from './public-release-verifier';
import {
    parseBrowserEvidenceV1,
    parsePublicReleaseVerificationInputV1,
    parsePublicReleaseVerificationResultV1,
    type BrowserEvidenceV1,
    type PublicReleaseVerificationResultV1,
} from './schemas';

export type ProductionSmokeInputV1 = {
    storyId: string;
    releaseId: string;
    expectedManifestSha256: string;
    assetBaseUrl: string;
    webBaseUrl: string;
    productionWebOrigin: string;
    browserEvidence: unknown;
};

export type ProductionSmokeCheckV1 = {
    id:
        | 'public-active-release'
        | 'browser-production-flow'
        | 'pointer-revalidation';
    status: 'passed' | 'failed';
};

export type ProductionSmokeReportV1 = {
    schemaVersion: 1;
    status: 'passed' | 'failed';
    storyId: string;
    target: { kind: 'production' };
    releaseId: string;
    manifestSha256: string;
    checks: ProductionSmokeCheckV1[];
    diagnostics: GateDiagnosticV1[];
};

export type ProductionSmokeDependencies = {
    verifyPublicRelease: (
        input: Parameters<typeof verifyPublicRelease>[0],
        dependencies?: Partial<PublicVerifierDependencies>
    ) => Promise<PublicReleaseVerificationResultV1>;
};

export class ProductionSmokeInputError extends Error {
    constructor(
        readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ProductionSmokeInputError';
    }
}

function inputError(code: string, message: string): never {
    throw new ProductionSmokeInputError(code, message);
}

function canonicalHostname(hostname: string): string {
    return hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.+$/, '');
}

function isLocalHostname(hostname: string): boolean {
    const value = canonicalHostname(hostname);
    return (
        value === 'localhost' ||
        value.endsWith('.localhost') ||
        value === '0.0.0.0' ||
        value === '::1' ||
        value === '::' ||
        value.startsWith('::ffff:') ||
        /^127(?:\.\d{1,3}){3}$/.test(value)
    );
}

function parseProductionUrl(value: string, label: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return inputError('input/url', `${label} must be an HTTPS URL`);
    }
    if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.search !== '' ||
        url.hash !== ''
    ) {
        return inputError('input/url', `${label} must be an HTTPS URL`);
    }
    if (isLocalHostname(url.hostname)) {
        return inputError(
            'activation-target/local-origin',
            `${label} must not be local`
        );
    }
    return url;
}

function publicUrl(baseUrl: URL, path: string): string {
    const base = new URL(baseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return new URL(path, base).toString();
}

function canonicalPathSegments(url: URL): string[] {
    let path = url.pathname;
    while (path.includes('%')) {
        let decoded: string;
        try {
            decoded = decodeURIComponent(path);
        } catch {
            inputError(
                'input/url',
                'asset base URL path must use valid percent encoding'
            );
        }
        if (decoded === path) {
            inputError(
                'input/url',
                'asset base URL path cannot be canonicalized'
            );
        }
        path = decoded;
    }
    return path.split('/');
}

function hasPreviewPath(url: URL): boolean {
    return canonicalPathSegments(url).includes('previews');
}

function diagnostic(
    input: ProductionSmokeInputV1,
    code: string
): GateDiagnosticV1 {
    return {
        code,
        stage: 'post-activation-smoke',
        message: 'Production smoke verification failed',
        storyId: input.storyId,
        target: { kind: 'production' },
        releaseId: input.releaseId,
        manifestSha256: input.expectedManifestSha256,
    };
}

function failedReport(
    input: ProductionSmokeInputV1,
    checks: ProductionSmokeCheckV1[],
    code: string
): ProductionSmokeReportV1 {
    return {
        schemaVersion: 1,
        status: 'failed',
        storyId: input.storyId,
        target: { kind: 'production' },
        releaseId: input.releaseId,
        manifestSha256: input.expectedManifestSha256,
        checks,
        diagnostics: [diagnostic(input, code)],
    };
}

function assertInput(input: ProductionSmokeInputV1): {
    assetBaseUrl: URL;
    webBaseUrl: URL;
    browserEvidence: BrowserEvidenceV1;
} {
    if (
        !isStoryId(input.storyId) ||
        !isReleaseId(input.releaseId) ||
        !isSha256(input.expectedManifestSha256)
    ) {
        inputError('input/identity', 'Production smoke identity is invalid');
    }
    const assetBaseUrl = parseProductionUrl(
        input.assetBaseUrl,
        'asset base URL'
    );
    const webBaseUrl = parseProductionUrl(input.webBaseUrl, 'web base URL');
    const productionWebOrigin = parseProductionUrl(
        input.productionWebOrigin,
        'production web origin'
    );
    if (productionWebOrigin.pathname !== '/') {
        inputError(
            'input/production-origin',
            'Production web origin must be an origin'
        );
    }
    if (webBaseUrl.origin !== productionWebOrigin.origin) {
        inputError(
            'activation-target/production-origin',
            'Production smoke must use the configured production origin'
        );
    }
    if (hasPreviewPath(assetBaseUrl)) {
        inputError(
            'activation-target/preview-assets',
            'Production smoke rejects preview asset paths'
        );
    }
    try {
        parsePublicReleaseVerificationInputV1({
            storyId: input.storyId,
            target: { kind: 'production' },
            assetBaseUrl: input.assetBaseUrl,
            browserOrigin: input.webBaseUrl,
            mode: 'active',
            expectedManifestSha256: input.expectedManifestSha256,
            omittedIdentities: [],
        });
    } catch {
        inputError(
            'input/production-verification',
            'Production smoke input is invalid'
        );
    }

    let browserEvidence: BrowserEvidenceV1;
    try {
        browserEvidence = parseBrowserEvidenceV1(input.browserEvidence);
    } catch {
        inputError(
            'input/browser-evidence',
            'Production browser evidence is invalid'
        );
    }
    if (
        browserEvidence.flow !== 'production-smoke' ||
        browserEvidence.status !== 'passed' ||
        browserEvidence.storyId !== input.storyId ||
        browserEvidence.target.kind !== 'production' ||
        browserEvidence.releaseId !== input.releaseId ||
        browserEvidence.manifestSha256 !== input.expectedManifestSha256 ||
        browserEvidence.projects.some(
            project =>
                project.assetEnvironment !== 'production' ||
                project.target.kind !== 'production' ||
                project.releaseId !== input.releaseId ||
                project.manifestSha256 !== input.expectedManifestSha256
        )
    ) {
        inputError(
            'activation-target/browser-identity',
            'Production browser evidence does not match the expected identity'
        );
    }
    return { assetBaseUrl, webBaseUrl, browserEvidence };
}

function browserEvidenceMatchesPublicPaths(
    input: ProductionSmokeInputV1,
    assetBaseUrl: URL,
    evidence: BrowserEvidenceV1
): boolean {
    const expectedPointer = publicUrl(
        assetBaseUrl,
        getCurrentPointerPath(input.storyId, { kind: 'production' })
    );
    const expectedManifest = publicUrl(
        assetBaseUrl,
        getReleaseManifestPath(input.storyId, input.releaseId, {
            kind: 'production',
        })
    );
    return evidence.projects.every(
        project =>
            project.requestPaths.pointerRequestUrl === expectedPointer &&
            project.requestPaths.manifestRequestUrl === expectedManifest
    );
}

/**
 * Verifies an already activated production release through public read-only
 * surfaces. It has no publisher or R2 write dependency.
 */
export async function runProductionSmoke(
    input: ProductionSmokeInputV1,
    suppliedDependencies: Partial<ProductionSmokeDependencies> = {}
): Promise<ProductionSmokeReportV1> {
    const { assetBaseUrl, webBaseUrl, browserEvidence } = assertInput(input);
    const verify =
        suppliedDependencies.verifyPublicRelease ?? verifyPublicRelease;
    const checks: ProductionSmokeCheckV1[] = [
        { id: 'public-active-release', status: 'failed' },
        { id: 'browser-production-flow', status: 'failed' },
        { id: 'pointer-revalidation', status: 'failed' },
    ];

    let publicVerification: PublicReleaseVerificationResultV1;
    try {
        publicVerification = parsePublicReleaseVerificationResultV1(
            await verify({
                storyId: input.storyId,
                target: { kind: 'production' },
                assetBaseUrl: assetBaseUrl.toString(),
                browserOrigin: webBaseUrl.toString(),
                mode: 'active',
                expectedManifestSha256: input.expectedManifestSha256,
                omittedIdentities: [],
            })
        );
    } catch {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/public-verification-unavailable'
        );
    }

    if (
        publicVerification.status !== 'passed' ||
        publicVerification.mode !== 'active' ||
        publicVerification.target.kind !== 'production'
    ) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/public-verification-failed'
        );
    }

    if (publicVerification.storyId !== input.storyId) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/story-mismatch'
        );
    }
    if (publicVerification.releaseId !== input.releaseId) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/release-mismatch'
        );
    }
    if (publicVerification.manifestSha256 !== input.expectedManifestSha256) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/manifest-mismatch'
        );
    }
    checks[0]!.status = 'passed';
    if (
        !publicVerification.checks.some(
            check => check.id === 'pointer.cache' && check.status === 'passed'
        )
    ) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/pointer-revalidation-failed'
        );
    }
    checks[2]!.status = 'passed';

    if (
        !browserEvidenceMatchesPublicPaths(input, assetBaseUrl, browserEvidence)
    ) {
        return failedReport(
            input,
            checks,
            'post-activation-smoke/browser-request-mismatch'
        );
    }
    checks[1]!.status = 'passed';

    return {
        schemaVersion: 1,
        status: 'passed',
        storyId: input.storyId,
        target: { kind: 'production' },
        releaseId: input.releaseId,
        manifestSha256: input.expectedManifestSha256,
        checks,
        diagnostics: [],
    };
}
