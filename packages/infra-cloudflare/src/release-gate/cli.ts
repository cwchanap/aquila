import { readFile } from 'node:fs/promises';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { parsePublisherReportV1 } from '../publisher/report';
import { PublisherError, publisherExitCode } from '../publisher/errors';
import type { CreateEvidenceReferenceInputV1 } from './evidence';
import type {
    BrowserEvidenceV1,
    GateEvidenceBindingsV1,
    ProductionPointerEvidenceV1,
    R2CandidateEvidenceV1,
    RunVisualNovelReleaseGateInputV1,
} from './gate-runner';
import {
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
    publisherReportPath: string;
    browserEvidencePath: string;
    webIdentityEvidencePath: string;
    manualReviewPath: string;
    workflowApprovalPath: string;
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

/**
 * Task 11 owns these commands' input and result contracts. The CLI only owns
 * their command boundary today, so later services receive their raw argument
 * vector and the same safe streams without this slice inventing a wire type.
 */
export type DeferredReleaseGateCliService = (
    argv: readonly string[],
    dependencies: Pick<
        ReleaseGateCliDependencies,
        'environment' | 'repositoryRoot' | 'stdout' | 'stderr'
    >
) => Promise<number>;

export interface ReleaseGateCliDependencies {
    repositoryRoot: string;
    environment: Readonly<Record<string, string | undefined>>;
    stdout: WritableStream;
    stderr: WritableStream;
    runVerifyPreview?: VerifyPreviewCliService;
    readEvidenceJson?: ReadEvidenceJson;
    createEvidenceReference?: CreateEvidenceReference;
    runVisualNovelReleaseGate?: RunGateCoordinator;
    assertActivationReady?: DeferredReleaseGateCliService;
    smokeProduction?: DeferredReleaseGateCliService;
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
    'publisher-report': { type: 'string' },
    'browser-evidence': { type: 'string' },
    'web-identity-evidence': { type: 'string' },
    'manual-review': { type: 'string' },
    'workflow-approval': { type: 'string' },
    'commit-sha': { type: 'string' },
    'evidence-dir': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
} as const satisfies OptionSchema;

const VERIFY_PREVIEW_HELP = `Usage: assets release-gate verify-preview [options]

Required options:
  --story <story-id>
  --preview-id <preview-id>
  --release <release-id>
  --expect-manifest-sha256 <sha256>
  --asset-base-url <https-url>
  --web-base-url <https-url>
  --publisher-report <relative-evidence-path>
  --browser-evidence <relative-evidence-path>
  --web-identity-evidence <relative-evidence-path>
  --manual-review <relative-evidence-path>
  --workflow-approval <relative-evidence-path>
  --commit-sha <commit-sha>
  --evidence-dir <directory>

Options:
  --json
  --help, -h
`;

const ASSERT_ACTIVATION_READY_HELP =
    'Usage: assets release-gate assert-activation-ready [options]\n';
const SMOKE_PRODUCTION_HELP =
    'Usage: assets release-gate smoke-production [options]\n';

const RETAINED_EVIDENCE = {
    deterministicCi: {
        id: 'ci',
        kind: 'ci-result',
        path: 'ci/result.json',
        mediaType: 'application/json',
    },
    r2Candidate: {
        id: 'r2',
        kind: 'r2-verification',
        path: 'r2/result.json',
        mediaType: 'application/json',
    },
    publicCandidate: {
        id: 'public-candidate',
        kind: 'public-verification',
        path: 'public/candidate.json',
        mediaType: 'application/json',
    },
    publicActiveRelease: {
        id: 'public-active',
        kind: 'public-verification',
        path: 'public/active.json',
        mediaType: 'application/json',
    },
    productionPointerBefore: {
        id: 'pointer-before',
        kind: 'pointer-snapshot',
        path: 'pointer/before.json',
        mediaType: 'application/json',
    },
    productionPointerAfter: {
        id: 'pointer-after',
        kind: 'pointer-snapshot',
        path: 'pointer/after.json',
        mediaType: 'application/json',
    },
} as const;

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

function parseValues(args: readonly string[]): CliValues {
    try {
        const parsed = parseArgs({
            args: [...args],
            options: verifyPreviewOptions,
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
        publisherReportPath: requiredString(values, 'publisher-report'),
        browserEvidencePath: requiredString(values, 'browser-evidence'),
        webIdentityEvidencePath: requiredString(
            values,
            'web-identity-evidence'
        ),
        manualReviewPath: requiredString(values, 'manual-review'),
        workflowApprovalPath: requiredString(values, 'workflow-approval'),
        commitSha: requiredString(values, 'commit-sha'),
        evidenceDir: requiredString(values, 'evidence-dir'),
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
        await readEvidenceJson(
            input.evidenceDir,
            RETAINED_EVIDENCE.deterministicCi.path
        )
    );
    const r2Candidate = (await readEvidenceJson(
        input.evidenceDir,
        RETAINED_EVIDENCE.r2Candidate.path
    )) as R2CandidateEvidenceV1;
    const publicCandidate = parsePublicReleaseVerificationResultV1(
        await readEvidenceJson(
            input.evidenceDir,
            RETAINED_EVIDENCE.publicCandidate.path
        )
    );
    const publicActiveRelease = parsePublicReleaseVerificationResultV1(
        await readEvidenceJson(
            input.evidenceDir,
            RETAINED_EVIDENCE.publicActiveRelease.path
        )
    );
    const webIdentity = parseWebIdentityEvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.webIdentityEvidencePath)
    );
    assertEvidenceUrls(input, webIdentity);
    const browserEvidence = (await readEvidenceJson(
        input.evidenceDir,
        input.browserEvidencePath
    )) as BrowserEvidenceV1;
    const manualReview = parseVisualReviewRecordV1(
        await readEvidenceJson(input.evidenceDir, input.manualReviewPath)
    );
    const workflowApproval = parseWorkflowApprovalEvidenceV1(
        await readEvidenceJson(input.evidenceDir, input.workflowApprovalPath)
    );
    const productionPointerBefore = (await readEvidenceJson(
        input.evidenceDir,
        RETAINED_EVIDENCE.productionPointerBefore.path
    )) as ProductionPointerEvidenceV1;
    const productionPointerAfter = (await readEvidenceJson(
        input.evidenceDir,
        RETAINED_EVIDENCE.productionPointerAfter.path
    )) as ProductionPointerEvidenceV1;

    const reference = (request: CreateEvidenceReferenceInputV1) =>
        createReference(input.evidenceDir, request);
    const evidence: GateEvidenceBindingsV1 = {
        deterministicCi: await reference(RETAINED_EVIDENCE.deterministicCi),
        publisherCandidate: await reference(
            namedEvidenceReference(
                'publisher',
                'publisher-report',
                input.publisherReportPath
            )
        ),
        r2Candidate: await reference(RETAINED_EVIDENCE.r2Candidate),
        publicCandidate: await reference(RETAINED_EVIDENCE.publicCandidate),
        publicActiveRelease: await reference(
            RETAINED_EVIDENCE.publicActiveRelease
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
            RETAINED_EVIDENCE.productionPointerBefore
        ),
        productionPointerAfter: await reference(
            RETAINED_EVIDENCE.productionPointerAfter
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

function commandDependencies(
    dependencies: ReleaseGateCliDependencies
): Pick<
    ReleaseGateCliDependencies,
    'environment' | 'repositoryRoot' | 'stdout' | 'stderr'
> {
    return {
        environment: dependencies.environment,
        repositoryRoot: dependencies.repositoryRoot,
        stdout: dependencies.stdout,
        stderr: dependencies.stderr,
    };
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
        if (dependencies.assertActivationReady !== undefined) {
            return dependencies.assertActivationReady(
                args,
                commandDependencies(dependencies)
            );
        }
        emitDiagnostic('configuration/service-unavailable', json, dependencies);
        return 1;
    }

    if (command === 'smoke-production') {
        if (isHelp(args)) {
            dependencies.stdout.write(SMOKE_PRODUCTION_HELP);
            return 0;
        }
        if (dependencies.smokeProduction !== undefined) {
            return dependencies.smokeProduction(
                args,
                commandDependencies(dependencies)
            );
        }
        emitDiagnostic('configuration/service-unavailable', json, dependencies);
        return 1;
    }

    emitDiagnostic('configuration/unknown-command', json, dependencies);
    return 1;
}
