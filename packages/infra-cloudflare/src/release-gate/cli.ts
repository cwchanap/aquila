import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { isSafeRelativePath } from '@aquila/stories/runtime-assets';
import { parsePublisherReportV1 } from '../publisher/report';
import { PublisherError, publisherExitCode } from '../publisher/errors';
import type { CreateEvidenceReferenceInputV1 } from './evidence';
import type {
    ActivationAssertionDependencies,
    ActivationReadyResultV1,
    AssertActivationReadyInputV1,
} from './activation-assertion';
import type {
    ProductionSmokeDependencies,
    ProductionSmokeInputV1,
    ProductionSmokeReportV1,
} from './production-smoke';
import type {
    GateEvidenceBindingsV1,
    ProductionPointerEvidenceV1,
    R2CandidateEvidenceV1,
    RunVisualNovelReleaseGateInputV1,
} from './gate-runner';
import {
    parseBrowserEvidenceV1,
    parsePublicReleaseVerificationInputV1,
    parseGateDiagnosticV1,
    parsePublicReleaseVerificationResultV1,
    parseTier1EvidenceV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    type GateEvidenceReferenceV1,
    type VisualNovelReleaseGateReportV1,
} from './schemas';
import { gateDiagnosticExitCode } from './exit-codes';
interface WritableStream {
    write(chunk: string): unknown;
}

export type VerifyPreviewCliInputV1 = {
    storyId: string;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    assetBaseUrl: string;
    webBaseUrl: string;
    tier1EvidencePath: string;
    publisherReportPath: string;
    r2CandidateEvidencePath: string;
    publicCandidateEvidencePath: string;
    publicActiveEvidencePath: string;
    browserEvidencePath: string;
    webIdentityEvidencePath: string;
    manualReviewPath: string;
    workflowApprovalPath: string;
    productionPointerBeforePath: string;
    productionPointerAfterPath: string;
    commitSha: string;
    evidenceDir: string;
};

export type VerifyPreviewCliService = (
    input: VerifyPreviewCliInputV1
) => Promise<VisualNovelReleaseGateReportV1>;

type ReadEvidenceJson = (
    evidenceDir: string,
    relativePath: string
) => Promise<unknown>;

type CreateEvidenceReference = (
    evidenceDir: string,
    input: CreateEvidenceReferenceInputV1
) => Promise<GateEvidenceReferenceV1>;

type RunGateCoordinator = (
    input: RunVisualNovelReleaseGateInputV1
) => Promise<VisualNovelReleaseGateReportV1>;

type ReadJsonFile = (path: string) => Promise<unknown>;

type AssertActivationReadyService = (
    input: AssertActivationReadyInputV1,
    dependencies?: Partial<ActivationAssertionDependencies>
) => Promise<ActivationReadyResultV1>;

type RunProductionSmokeService = (
    input: ProductionSmokeInputV1,
    dependencies?: Partial<ProductionSmokeDependencies>
) => Promise<ProductionSmokeReportV1>;

export interface ReleaseGateCliDependencies {
    repositoryRoot: string;
    environment: Readonly<Record<string, string | undefined>>;
    stdout: WritableStream;
    stderr: WritableStream;
    runVerifyPreview?: VerifyPreviewCliService;
    readEvidenceJson?: ReadEvidenceJson;
    createEvidenceReference?: CreateEvidenceReference;
    runVisualNovelReleaseGate?: RunGateCoordinator;
    readJsonFile?: ReadJsonFile;
    assertActivationReady?: AssertActivationReadyService;
    runProductionSmoke?: RunProductionSmokeService;
}

type CliValues = Readonly<Record<string, string | boolean | undefined>>;
type OptionSchema = NonNullable<ParseArgsConfig['options']>;

const verifyPreviewOptions = {
    story: { type: 'string' },
    'preview-id': { type: 'string' },
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    'asset-base-url': { type: 'string' },
    'web-base-url': { type: 'string' },
    'tier1-evidence': { type: 'string' },
    'publisher-report': { type: 'string' },
    'r2-candidate-evidence': { type: 'string' },
    'public-candidate-evidence': { type: 'string' },
    'public-active-evidence': { type: 'string' },
    'browser-evidence': { type: 'string' },
    'web-identity-evidence': { type: 'string' },
    'manual-review': { type: 'string' },
    'workflow-approval': { type: 'string' },
    'production-pointer-before': { type: 'string' },
    'production-pointer-after': { type: 'string' },
    'commit-sha': { type: 'string' },
    'evidence-dir': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
} as const satisfies OptionSchema;

const assertActivationReadyOptions = {
    report: { type: 'string' },
    story: { type: 'string' },
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    'commit-sha': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
} as const satisfies OptionSchema;

const smokeProductionOptions = {
    story: { type: 'string' },
    release: { type: 'string' },
    'expect-manifest-sha256': { type: 'string' },
    'asset-base-url': { type: 'string' },
    'web-base-url': { type: 'string' },
    'browser-evidence': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
} as const satisfies OptionSchema;

const VERIFY_PREVIEW_HELP = `Usage: assets release-gate verify-preview [options]

Required identity and execution options:
  --story <story-id>
  --preview-id <preview-id>
  --release <release-id>
  --expect-manifest-sha256 <sha256>
  --asset-base-url <https-url>
  --web-base-url <https-url>
  --commit-sha <commit-sha>
  --evidence-dir <directory>

Required retained evidence paths:
  --tier1-evidence <relative-evidence-path>             deterministic CI Tier 1 result
  --publisher-report <relative-evidence-path>           no-activation production candidate report
  --r2-candidate-evidence <relative-evidence-path>      deep R2 candidate verification
  --public-candidate-evidence <relative-evidence-path>  public candidate verification
  --public-active-evidence <relative-evidence-path>     active preview public verification
  --web-identity-evidence <relative-evidence-path>      deployed preview web identity
  --browser-evidence <relative-evidence-path>           desktop/mobile browser flow evidence
  --manual-review <relative-evidence-path>              approved visual review record
  --workflow-approval <relative-evidence-path>          protected environment approval
  --production-pointer-before <relative-evidence-path>  production pointer snapshot before gate
  --production-pointer-after <relative-evidence-path>   production pointer snapshot after gate

Options:
  --json
  --help, -h
`;

const ASSERT_ACTIVATION_READY_HELP = `Usage: assets release-gate assert-activation-ready [options]

Required retained report and exact identity:
  --report <safe-relative-path>
  --story <story-id>
  --release <release-id>
  --expect-manifest-sha256 <sha256>
  --commit-sha <commit-sha>

Options:
  --json
  --help, -h
`;

const SMOKE_PRODUCTION_HELP = `Usage: assets release-gate smoke-production [options]

Required exact production identity and browser evidence:
  --story <story-id>
  --release <release-id>
  --expect-manifest-sha256 <sha256>
  --asset-base-url <https-url>
  --web-base-url <https-url>
  --browser-evidence <safe-relative-path>

Environment:
  AQUILA_PRODUCTION_WEB_ORIGIN=<https-origin>

Options:
  --json
  --help, -h
`;

class ReleaseGateCliError extends Error {
    constructor(
        readonly code: string,
        readonly exitCode: 1 | 2 | 3 | 4 | 5
    ) {
        super('Release gate CLI input is invalid');
        this.name = 'ReleaseGateCliError';
    }
}

function configurationError(code: string): never {
    throw new ReleaseGateCliError(code, 1);
}

function inputError(code: string): never {
    throw new ReleaseGateCliError(code, 2);
}

function requiredString(values: CliValues, key: string): string {
    const value = values[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
        return configurationError(`configuration/missing-${key}`);
    }
    return value.trim();
}

function requiredEvidencePath(values: CliValues, key: string): string {
    const path = requiredString(values, key);
    if (!isSafeRelativePath(path)) {
        return inputError(`input/invalid-${key}`);
    }
    return path;
}

function parseValues(
    args: readonly string[],
    options: OptionSchema = verifyPreviewOptions
): CliValues {
    try {
        const parsed = parseArgs({
            args: [...args],
            options,
            strict: true,
            allowPositionals: false,
        });
        const values: Record<string, string | boolean | undefined> = {};
        for (const [key, value] of Object.entries(parsed.values)) {
            if (Array.isArray(value)) {
                return configurationError('configuration/repeated-option');
            }
            values[key] = value;
        }
        return values;
    } catch (error) {
        if (error instanceof ReleaseGateCliError) throw error;
        return configurationError('configuration/invalid-option');
    }
}

function parseVerifyPreviewInput(values: CliValues): VerifyPreviewCliInputV1 {
    const storyId = requiredString(values, 'story');
    const previewId = requiredString(values, 'preview-id');
    const releaseId = requiredString(values, 'release');
    const manifestSha256 = requiredString(values, 'expect-manifest-sha256');
    const assetBaseUrl = requiredString(values, 'asset-base-url');
    const webBaseUrl = requiredString(values, 'web-base-url');

    try {
        parsePublicReleaseVerificationInputV1({
            storyId,
            target: { kind: 'preview', previewId },
            assetBaseUrl,
            browserOrigin: webBaseUrl,
            mode: 'candidate',
            releaseId,
            expectedManifestSha256: manifestSha256,
            omittedIdentities: [],
        });
    } catch {
        return inputError('input/verify-preview-identity');
    }

    return {
        storyId,
        previewId,
        releaseId,
        manifestSha256,
        assetBaseUrl,
        webBaseUrl,
        tier1EvidencePath: requiredEvidencePath(values, 'tier1-evidence'),
        publisherReportPath: requiredEvidencePath(values, 'publisher-report'),
        r2CandidateEvidencePath: requiredEvidencePath(
            values,
            'r2-candidate-evidence'
        ),
        publicCandidateEvidencePath: requiredEvidencePath(
            values,
            'public-candidate-evidence'
        ),
        publicActiveEvidencePath: requiredEvidencePath(
            values,
            'public-active-evidence'
        ),
        browserEvidencePath: requiredEvidencePath(values, 'browser-evidence'),
        webIdentityEvidencePath: requiredEvidencePath(
            values,
            'web-identity-evidence'
        ),
        manualReviewPath: requiredEvidencePath(values, 'manual-review'),
        workflowApprovalPath: requiredEvidencePath(values, 'workflow-approval'),
        productionPointerBeforePath: requiredEvidencePath(
            values,
            'production-pointer-before'
        ),
        productionPointerAfterPath: requiredEvidencePath(
            values,
            'production-pointer-after'
        ),
        commitSha: requiredString(values, 'commit-sha'),
        evidenceDir: requiredString(values, 'evidence-dir'),
    };
}

function requiredRepositoryPath(values: CliValues, key: string): string {
    const path = requiredString(values, key);
    if (!isSafeRelativePath(path)) {
        return inputError(`input/invalid-${key}`);
    }
    return path;
}

type AssertActivationReadyCliInputV1 = {
    reportPath: string;
    storyId: string;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
};

function parseAssertActivationReadyInput(
    values: CliValues
): AssertActivationReadyCliInputV1 {
    return {
        reportPath: requiredRepositoryPath(values, 'report'),
        storyId: requiredString(values, 'story'),
        releaseId: requiredString(values, 'release'),
        manifestSha256: requiredString(values, 'expect-manifest-sha256'),
        commitSha: requiredString(values, 'commit-sha'),
    };
}

type SmokeProductionCliInputV1 = {
    storyId: string;
    releaseId: string;
    manifestSha256: string;
    assetBaseUrl: string;
    webBaseUrl: string;
    browserEvidencePath: string;
};

function parseSmokeProductionInput(
    values: CliValues
): SmokeProductionCliInputV1 {
    return {
        storyId: requiredString(values, 'story'),
        releaseId: requiredString(values, 'release'),
        manifestSha256: requiredString(values, 'expect-manifest-sha256'),
        assetBaseUrl: requiredString(values, 'asset-base-url'),
        webBaseUrl: requiredString(values, 'web-base-url'),
        browserEvidencePath: requiredRepositoryPath(values, 'browser-evidence'),
    };
}

async function defaultReadEvidenceJson(
    evidenceDir: string,
    relativePath: string
): Promise<unknown> {
    const evidence = await import('./evidence');
    const path = evidence.resolveEvidencePath(evidenceDir, relativePath);
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
        if (error instanceof evidence.GateEvidenceError) throw error;
        throw evidence.gateInputError(
            'evidence/json-invalid',
            'Evidence JSON is invalid'
        );
    }
}

async function defaultReadJsonFile(path: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch {
        return inputError('input/json-invalid');
    }
}

function repositoryPath(repositoryRoot: string, relativePath: string): string {
    return resolve(repositoryRoot, relativePath);
}

function assertPreviewWebOrigin(
    input: VerifyPreviewCliInputV1,
    environment: Readonly<Record<string, string | undefined>>
): void {
    const productionWebOrigin = environment.AQUILA_PRODUCTION_WEB_ORIGIN;
    if (productionWebOrigin === undefined || productionWebOrigin.length === 0) {
        throw new ReleaseGateCliError(
            'environment/production-web-origin-missing',
            3
        );
    }
    try {
        parsePublicReleaseVerificationInputV1({
            storyId: input.storyId,
            target: { kind: 'preview', previewId: input.previewId },
            assetBaseUrl: input.assetBaseUrl,
            browserOrigin: productionWebOrigin,
            mode: 'candidate',
            releaseId: input.releaseId,
            expectedManifestSha256: input.manifestSha256,
            omittedIdentities: [],
        });
    } catch {
        throw new ReleaseGateCliError(
            'environment/production-web-origin-invalid',
            3
        );
    }
    if (
        new URL(input.webBaseUrl).origin === new URL(productionWebOrigin).origin
    ) {
        throw new ReleaseGateCliError(
            'activation-target/preview-web-origin',
            5
        );
    }
}

function assertEvidenceUrls(
    input: VerifyPreviewCliInputV1,
    webIdentity: ReturnType<typeof parseWebIdentityEvidenceV1>
): void {
    if (
        new URL(webIdentity.webBaseUrl).toString() !==
        new URL(input.webBaseUrl).toString()
    ) {
        inputError('input/web-base-url-mismatch');
    }
    const assetOrigin = new URL(input.assetBaseUrl).origin;
    if (
        new URL(webIdentity.pointerRequestUrl).origin !== assetOrigin ||
        new URL(webIdentity.manifestRequestUrl).origin !== assetOrigin
    ) {
        inputError('input/asset-base-url-mismatch');
    }
}

function namedEvidenceReference(
    id: string,
    kind: GateEvidenceReferenceV1['kind'],
    path: string
): CreateEvidenceReferenceInputV1 {
    return { id, kind, path, mediaType: 'application/json' };
}

async function createVerifyPreviewInput(
    input: VerifyPreviewCliInputV1,
    dependencies: ReleaseGateCliDependencies
): Promise<RunVisualNovelReleaseGateInputV1> {
    const readEvidenceJson =
        dependencies.readEvidenceJson ?? defaultReadEvidenceJson;
    const createReference =
        dependencies.createEvidenceReference ??
        (await import('./evidence')).createEvidenceReference;

    const publisherReport = parsePublisherReportV1(
        await readEvidenceJson(input.evidenceDir, input.publisherReportPath)
    );
    const tier1 = parseTier1EvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.tier1EvidencePath)
    );
    const r2Candidate = (await readEvidenceJson(
        input.evidenceDir,
        input.r2CandidateEvidencePath
    )) as R2CandidateEvidenceV1;
    const publicCandidate = parsePublicReleaseVerificationResultV1(
        await readEvidenceJson(
            input.evidenceDir,
            input.publicCandidateEvidencePath
        )
    );
    const publicActiveRelease = parsePublicReleaseVerificationResultV1(
        await readEvidenceJson(
            input.evidenceDir,
            input.publicActiveEvidencePath
        )
    );
    const webIdentity = parseWebIdentityEvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.webIdentityEvidencePath)
    );
    assertEvidenceUrls(input, webIdentity);
    const browserEvidence = parseBrowserEvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.browserEvidencePath)
    );
    const manualReview = parseVisualReviewRecordV1(
        await readEvidenceJson(input.evidenceDir, input.manualReviewPath)
    );
    const workflowApproval = parseWorkflowApprovalEvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.workflowApprovalPath)
    );
    const productionPointerBefore = (await readEvidenceJson(
        input.evidenceDir,
        input.productionPointerBeforePath
    )) as ProductionPointerEvidenceV1;
    const productionPointerAfter = (await readEvidenceJson(
        input.evidenceDir,
        input.productionPointerAfterPath
    )) as ProductionPointerEvidenceV1;

    const reference = (request: CreateEvidenceReferenceInputV1) =>
        createReference(input.evidenceDir, request);
    const evidence: GateEvidenceBindingsV1 = {
        deterministicCi: await reference(
            namedEvidenceReference('ci', 'ci-result', input.tier1EvidencePath)
        ),
        publisherCandidate: await reference(
            namedEvidenceReference(
                'publisher',
                'publisher-report',
                input.publisherReportPath
            )
        ),
        r2Candidate: await reference(
            namedEvidenceReference(
                'r2',
                'r2-verification',
                input.r2CandidateEvidencePath
            )
        ),
        publicCandidate: await reference(
            namedEvidenceReference(
                'public-candidate',
                'public-verification',
                input.publicCandidateEvidencePath
            )
        ),
        publicActiveRelease: await reference(
            namedEvidenceReference(
                'public-active',
                'public-verification',
                input.publicActiveEvidencePath
            )
        ),
        webIdentity: await reference(
            namedEvidenceReference(
                'web',
                'web-identity',
                input.webIdentityEvidencePath
            )
        ),
        browserFlows: await reference(
            namedEvidenceReference(
                'browser',
                'playwright-result',
                input.browserEvidencePath
            )
        ),
        manualReview: await reference(
            namedEvidenceReference(
                'manual',
                'manual-review',
                input.manualReviewPath
            )
        ),
        workflowApproval: await reference(
            namedEvidenceReference(
                'workflow',
                'workflow-approval',
                input.workflowApprovalPath
            )
        ),
        productionPointerBefore: await reference(
            namedEvidenceReference(
                'pointer-before',
                'pointer-snapshot',
                input.productionPointerBeforePath
            )
        ),
        productionPointerAfter: await reference(
            namedEvidenceReference(
                'pointer-after',
                'pointer-snapshot',
                input.productionPointerAfterPath
            )
        ),
    };

    return {
        identity: {
            storyId: input.storyId,
            target: { kind: 'preview', previewId: input.previewId },
            previewId: input.previewId,
            releaseId: input.releaseId,
            manifestSha256: input.manifestSha256,
            commitSha: input.commitSha,
            scenarioSha256: manualReview.scenarioSha256,
        },
        evidenceDir: input.evidenceDir,
        tier1,
        publisherReport,
        r2Candidate,
        publicCandidate,
        publicActiveRelease,
        webIdentity,
        browserEvidence,
        manualReview,
        workflowApproval,
        productionPointerBefore,
        productionPointerAfter,
        evidence,
    };
}

async function executeVerifyPreview(
    input: VerifyPreviewCliInputV1,
    dependencies: ReleaseGateCliDependencies
): Promise<VisualNovelReleaseGateReportV1> {
    const gateInput = await createVerifyPreviewInput(input, dependencies);
    const runGate =
        dependencies.runVisualNovelReleaseGate ??
        (await import('./gate-runner')).runVisualNovelReleaseGate;
    return runGate(gateInput);
}

async function executeAssertActivationReady(
    input: AssertActivationReadyCliInputV1,
    dependencies: ReleaseGateCliDependencies
): Promise<ActivationReadyResultV1> {
    const reportPath = repositoryPath(
        dependencies.repositoryRoot,
        input.reportPath
    );
    const readJsonFile = dependencies.readJsonFile ?? defaultReadJsonFile;
    const assertActivationReady =
        dependencies.assertActivationReady ??
        (await import('./activation-assertion')).assertActivationReady;
    return assertActivationReady(
        {
            evidenceDir: dirname(reportPath),
            report: await readJsonFile(reportPath),
            expected: {
                storyId: input.storyId,
                releaseId: input.releaseId,
                manifestSha256: input.manifestSha256,
                commitSha: input.commitSha,
            },
        },
        {}
    );
}

async function executeProductionSmoke(
    input: SmokeProductionCliInputV1,
    dependencies: ReleaseGateCliDependencies
): Promise<ProductionSmokeReportV1> {
    const productionWebOrigin =
        dependencies.environment.AQUILA_PRODUCTION_WEB_ORIGIN;
    if (
        productionWebOrigin === undefined ||
        productionWebOrigin.trim() === ''
    ) {
        throw new ReleaseGateCliError(
            'environment/production-web-origin-missing',
            3
        );
    }
    const browserEvidencePath = repositoryPath(
        dependencies.repositoryRoot,
        input.browserEvidencePath
    );
    const readJsonFile = dependencies.readJsonFile ?? defaultReadJsonFile;
    const runProductionSmoke =
        dependencies.runProductionSmoke ??
        (await import('./production-smoke')).runProductionSmoke;
    return runProductionSmoke(
        {
            storyId: input.storyId,
            releaseId: input.releaseId,
            expectedManifestSha256: input.manifestSha256,
            assetBaseUrl: input.assetBaseUrl,
            webBaseUrl: input.webBaseUrl,
            productionWebOrigin,
            browserEvidence: await readJsonFile(browserEvidencePath),
        },
        {}
    );
}

function emitDiagnostic(
    code: string,
    json: boolean,
    dependencies: Pick<ReleaseGateCliDependencies, 'stdout' | 'stderr'>
): void {
    const diagnostic = parseGateDiagnosticV1({
        code,
        stage: 'input',
        message: 'Release gate command did not run',
    });
    if (json) {
        dependencies.stdout.write(`${JSON.stringify(diagnostic)}\n`);
        return;
    }
    dependencies.stderr.write(`release-gate: ${diagnostic.code}\n`);
}

function emitActivationReadyResult(
    result: ActivationReadyResultV1,
    json: boolean,
    dependencies: Pick<ReleaseGateCliDependencies, 'stdout' | 'stderr'>
): void {
    if (json) {
        dependencies.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    dependencies.stderr.write(`status: ${result.status}\n`);
}

function emitProductionSmokeReport(
    report: ProductionSmokeReportV1,
    json: boolean,
    dependencies: Pick<ReleaseGateCliDependencies, 'stdout' | 'stderr'>
): void {
    if (json) {
        dependencies.stdout.write(`${JSON.stringify(report)}\n`);
        return;
    }
    const lines = [
        `status: ${report.status}`,
        `story: ${report.storyId}`,
        `release: ${report.releaseId}`,
        `checksum: ${report.manifestSha256}`,
        'checks:',
        ...report.checks.map(check => `- ${check.id}: ${check.status}`),
    ];
    if (report.diagnostics.length > 0) {
        lines.push('diagnostics:');
        lines.push(...report.diagnostics.map(item => `- ${item.code}`));
    }
    dependencies.stderr.write(`${lines.join('\n')}\n`);
}

async function emitGateReport(
    report: VisualNovelReleaseGateReportV1,
    json: boolean,
    dependencies: Pick<ReleaseGateCliDependencies, 'stdout' | 'stderr'>
): Promise<number> {
    const { gateReportExitCode, renderGateHumanReport, renderGateJsonReport } =
        await import('./report');
    if (json) {
        dependencies.stdout.write(renderGateJsonReport(report));
    } else {
        dependencies.stderr.write(renderGateHumanReport(report));
    }
    return gateReportExitCode(report);
}

function gateEvidenceErrorCode(error: unknown): string | undefined {
    if (
        typeof error !== 'object' ||
        error === null ||
        !('name' in error) ||
        !('code' in error) ||
        error.name !== 'GateEvidenceError' ||
        typeof error.code !== 'string'
    ) {
        return undefined;
    }
    return error.code;
}

function serviceErrorCode(error: unknown): string | undefined {
    if (
        typeof error !== 'object' ||
        error === null ||
        !('name' in error) ||
        !('code' in error) ||
        (error.name !== 'ActivationAssertionError' &&
            error.name !== 'ProductionSmokeInputError') ||
        typeof error.code !== 'string'
    ) {
        return undefined;
    }
    return error.code;
}

function errorResult(error: unknown): {
    code: string;
    exitCode: 1 | 2 | 3 | 4 | 5;
} {
    if (error instanceof ReleaseGateCliError) {
        return { code: error.code, exitCode: error.exitCode };
    }
    const evidenceCode = gateEvidenceErrorCode(error);
    if (evidenceCode !== undefined) {
        return {
            code: evidenceCode,
            exitCode: evidenceCode === 'evidence/root-unavailable' ? 3 : 2,
        };
    }
    const serviceCode = serviceErrorCode(error);
    if (serviceCode !== undefined) {
        return {
            code: serviceCode,
            exitCode: gateDiagnosticExitCode(serviceCode),
        };
    }
    if (error instanceof PublisherError) {
        return {
            code: `publisher/${error.code}`,
            exitCode: publisherExitCode(error) as 1 | 2 | 3 | 4 | 5,
        };
    }
    return { code: 'input/verify-preview-failed', exitCode: 2 };
}

function jsonMode(argv: readonly string[]): boolean {
    return argv.includes('--json');
}

function isHelp(argv: readonly string[]): boolean {
    return argv.includes('--help') || argv.includes('-h');
}

export async function runReleaseGateCli(
    argv: readonly string[],
    dependencies: ReleaseGateCliDependencies
): Promise<number> {
    const command = argv[0];
    const args = argv.slice(1);
    const json = jsonMode(args);

    if (command === 'verify-preview') {
        if (isHelp(args)) {
            dependencies.stdout.write(VERIFY_PREVIEW_HELP);
            return 0;
        }
        try {
            const values = parseValues(args);
            const input = parseVerifyPreviewInput(values);
            assertPreviewWebOrigin(input, dependencies.environment);
            const runVerifyPreview =
                dependencies.runVerifyPreview ??
                (verifyInput =>
                    executeVerifyPreview(verifyInput, dependencies));
            const report = await runVerifyPreview(input);
            return await emitGateReport(
                report,
                values.json === true,
                dependencies
            );
        } catch (error) {
            const result = errorResult(error);
            emitDiagnostic(result.code, json, dependencies);
            return result.exitCode;
        }
    }

    if (command === 'assert-activation-ready') {
        if (isHelp(args)) {
            dependencies.stdout.write(ASSERT_ACTIVATION_READY_HELP);
            return 0;
        }
        try {
            const values = parseValues(args, assertActivationReadyOptions);
            const result = await executeAssertActivationReady(
                parseAssertActivationReadyInput(values),
                dependencies
            );
            emitActivationReadyResult(
                result,
                values.json === true,
                dependencies
            );
            return 0;
        } catch (error) {
            const result = errorResult(error);
            emitDiagnostic(result.code, json, dependencies);
            return result.exitCode;
        }
    }

    if (command === 'smoke-production') {
        if (isHelp(args)) {
            dependencies.stdout.write(SMOKE_PRODUCTION_HELP);
            return 0;
        }
        try {
            const values = parseValues(args, smokeProductionOptions);
            const report = await executeProductionSmoke(
                parseSmokeProductionInput(values),
                dependencies
            );
            emitProductionSmokeReport(
                report,
                values.json === true,
                dependencies
            );
            return report.status === 'passed'
                ? 0
                : gateDiagnosticExitCode(report.diagnostics[0]?.code ?? '');
        } catch (error) {
            const result = errorResult(error);
            emitDiagnostic(result.code, json, dependencies);
            return result.exitCode;
        }
    }

    emitDiagnostic('configuration/unknown-command', json, dependencies);
    return 1;
}
