import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
    appendFile,
    chmod,
    lstat,
    mkdir,
    open,
    readdir,
    rm,
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    canonicalJson,
    isPreviewId,
    isReleaseId,
    isSafeRelativePath,
    isSha256,
    isStoryId,
    type JsonValue,
} from '@aquila/stories/runtime-assets';
import { validateCandidatePublisherEvidence } from '../src/release-gate/candidate-evidence';
import { verifyPublicRelease } from '../src/release-gate/public-release-verifier';
import {
    parseBrowserEvidenceV1,
    parsePublicReleaseVerificationInputV1,
    parseTier1EvidenceV1,
    parseVisualNovelGateScenarioV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    type BrowserEvidenceV1,
    type Tier1EvidenceV1,
    type PublicReleaseVerificationInputV1,
    type VisualNovelGateScenarioV1,
} from '../src/release-gate/schemas';
import { parsePublisherReportV1 } from '../src/publisher/report';
import {
    materializeStoryChunkPaths,
    type ChunkModuleMetadata,
    type Manifest,
} from '../../../apps/web/scripts/assert-story-chunks';
import {
    REGISTERED_STORY_IDS,
    isRegisteredStoryId,
} from '../../../packages/stories/src/story-metadata';

const REPOSITORY_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../..'
);
const EVIDENCE_DIRECTORY = '.release-gate/evidence';
const VITE_MANIFEST_PATH = 'apps/web/.vercel/output/static/.vite/manifest.json';
const STORY_CHUNK_METADATA_PATH =
    'apps/web/.vercel/output/static/.vite/story-chunk-modules.json';
const VERCEL_OUTPUT_PATH = 'apps/web/.vercel/output';
const CANDIDATE_COMMIT_SHA_RE = /^[a-f0-9]{40}$/;
const POSITIVE_INTEGER_RE = /^[1-9][0-9]*$/;
const ARTIFACT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ARTIFACT_DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const BARE_ARTIFACT_DIGEST_RE = /^[a-f0-9]{64}$/;
const TAR_BLOCK_SIZE = 512;
const MAX_TAR_BYTES = 512 * 1024 * 1024;
const MAX_TAR_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_TAR_ENTRIES = 20_000;
const OUTPUT_API_VERSION = 3;
const CANDIDATE_ENTRY_WORKFLOW_NAME = 'Visual Novel Release Candidate Entry';
const CANDIDATE_ENTRY_WORKFLOW_FILE_PATH =
    '.github/workflows/visual-novel-release-gate.yml';
const CANDIDATE_ENTRY_WORKFLOW_API_PATH = `${CANDIDATE_ENTRY_WORKFLOW_FILE_PATH}@main`;
const LIVE_RELEASE_GATE_WORKFLOW_PATH =
    '.github/workflows/visual-novel-release-live.yml';

export const RELEASE_GATE_ARCHIVE_LIMITS = {
    maxArchiveBytes: MAX_TAR_BYTES,
    maxEntryBytes: MAX_TAR_ENTRY_BYTES,
    maxEntries: MAX_TAR_ENTRIES,
} as const;

export type ReleaseGateWorkflowPhase = 'prepare' | 'finalize';

export type ReleaseGateWorkflowInputs = {
    phase: ReleaseGateWorkflowPhase;
    candidateCommitSha: string;
    storyId: string;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    publisherReportRunId: string;
    publisherReportArtifact: string;
    assetBaseUrl: string;
    /**
     * A strict origin suffix policy only. The prebuilt deployment URL returned
     * by Vercel, never this requested value, is the browser/gate authority.
     */
    webBaseUrl: string;
    productionWebOrigin: string;
    scenarioPath: string;
    prepareRunId: string;
    manualReviewPath: string;
};

type CandidateEntryRequestV1 = {
    schemaVersion: 1;
    source: {
        repository: string;
        workflowRef: string;
        workflowSha: string;
        runId: string;
        runAttempt: number;
    };
    input: ReleaseGateWorkflowInputs;
};

export type StoryChunkMappingV1 = {
    schemaVersion: 1;
    candidateCommitSha: string;
    manifestSha256: string;
    buildOutputSha256: string;
    storyId: string;
    storyChunks: Record<string, string>;
    unrelatedStoryChunks: string[];
};

export type MaterializedReleaseGateScenario = {
    scenario: VisualNovelGateScenarioV1;
    scenarioSha256: string;
    mapping: StoryChunkMappingV1;
    mappingSha256: string;
};

export type DeploymentAttestationV1 = {
    schemaVersion: 1;
    candidateCommitSha: string;
    storyId: string;
    manifestSha256: string;
    buildOutputSha256: string;
    scenarioSha256: string;
    mappingSha256: string;
    deploymentUrl: string;
    requestedAllowedOrigin: string;
};

type InputRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): InputRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value as InputRecord;
}

function requiredString(input: InputRecord, key: string): string {
    const value = input[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${key} is required`);
    }
    return value.trim();
}

function optionalString(input: InputRecord, key: string): string {
    const value = input[key];
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
        throw new Error(`${key} must be a string`);
    }
    return value.trim();
}

function positiveInteger(input: InputRecord, key: string): number {
    const value = input[key];
    const normalized =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && POSITIVE_INTEGER_RE.test(value)
              ? Number(value)
              : Number.NaN;
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
        throw new Error(`${key} must be a positive integer`);
    }
    return normalized;
}

function parseHttpsUrl(
    value: string,
    label: string,
    options: { originOnly: boolean }
): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${label} must be an absolute HTTPS URL`);
    }
    if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.search !== '' ||
        url.hash !== ''
    ) {
        throw new Error(`${label} must be a credential-free HTTPS URL`);
    }
    if (options.originOnly && url.pathname !== '/') {
        throw new Error(`${label} must be an origin`);
    }
    return url;
}

function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/\.+$/, '');
}

function canonicalOrigin(url: URL): string {
    return url.origin;
}

function assertSafeScenarioPath(path: string, label: string): void {
    if (!isSafeRelativePath(path) || !path.endsWith('.json')) {
        throw new Error(`${label} must be a safe relative JSON path`);
    }
}

function sha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

function canonicalSha256(value: JsonValue): string {
    return sha256(canonicalJson(value));
}

/**
 * `actions/upload-artifact` returns a bare SHA-256 while the Actions REST
 * API returns `sha256:<hex>`. Persist one canonical form so a producer cannot
 * influence comparison semantics through presentation alone.
 */
function normalizeArtifactDigest(value: string, label: string): string {
    if (ARTIFACT_DIGEST_RE.test(value)) return value;
    if (BARE_ARTIFACT_DIGEST_RE.test(value)) return `sha256:${value}`;
    throw new Error(`${label} digest is invalid`);
}

function isMainReleaseGateWorkflowReference(
    workflowRef: string,
    repository: string
): boolean {
    return (
        workflowRef ===
            `${repository}/${LIVE_RELEASE_GATE_WORKFLOW_PATH}@refs/heads/main` ||
        workflowRef === `${LIVE_RELEASE_GATE_WORKFLOW_PATH}@main`
    );
}

function compareCanonicalStrings(left: string, right: string): number {
    return left === right ? 0 : left < right ? -1 : 1;
}

function hasForbiddenControlCharacters(value: string): boolean {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (
            codePoint !== undefined &&
            ((codePoint >= 0x00 && codePoint <= 0x1f) ||
                (codePoint >= 0x7f && codePoint <= 0x9f))
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Vercel's Output API legitimately contains names such as `[locale]` and
 * `.vc-config.json`, which are not valid runtime-asset paths. Archive and
 * extraction safety therefore uses this narrower filesystem grammar instead
 * of the public-URL grammar: printable paths only, no separators supplied by
 * another platform, no empty/dot/traversal segments, and no absolute form.
 */
function isSafeReleaseGateOutputPath(value: string): boolean {
    return (
        value.length > 0 &&
        value.length <= 2048 &&
        value === value.normalize('NFC') &&
        !value.includes('\\') &&
        !value.includes('\0') &&
        !hasForbiddenControlCharacters(value) &&
        !value.startsWith('/') &&
        !value.endsWith('/') &&
        value
            .split('/')
            .every(
                segment =>
                    segment.length > 0 && segment !== '.' && segment !== '..'
            )
    );
}

/**
 * Validates every dispatch input before the workflow uses one in checkout,
 * artifact paths, command flags, or a deployment policy.
 */
export function parseReleaseGateWorkflowInputs(
    value: unknown
): ReleaseGateWorkflowInputs {
    const input = asRecord(value, 'Workflow inputs');
    const phase = requiredString(input, 'phase');
    if (phase !== 'prepare' && phase !== 'finalize') {
        throw new Error('phase must be prepare or finalize');
    }

    const candidateCommitSha = requiredString(input, 'candidateCommitSha');
    if (!CANDIDATE_COMMIT_SHA_RE.test(candidateCommitSha)) {
        throw new Error(
            'candidate commit SHA must be a lowercase 40-character SHA'
        );
    }

    const storyId = requiredString(input, 'storyId');
    if (!isStoryId(storyId) || !isRegisteredStoryId(storyId)) {
        throw new Error('story id must name a registered visual-novel story');
    }

    const previewId = requiredString(input, 'previewId');
    if (!isPreviewId(previewId)) {
        throw new Error('preview id is invalid');
    }
    const releaseId = requiredString(input, 'releaseId');
    if (!isReleaseId(releaseId)) {
        throw new Error('release id is invalid');
    }
    const manifestSha256 = requiredString(input, 'manifestSha256');
    if (!isSha256(manifestSha256)) {
        throw new Error('manifest SHA-256 is invalid');
    }

    const publisherReportRunId = requiredString(input, 'publisherReportRunId');
    if (!POSITIVE_INTEGER_RE.test(publisherReportRunId)) {
        throw new Error('publisher report run id must be a positive integer');
    }
    const publisherReportArtifact = requiredString(
        input,
        'publisherReportArtifact'
    );
    if (!ARTIFACT_NAME_RE.test(publisherReportArtifact)) {
        throw new Error('publisher report artifact has unsafe characters');
    }

    const assetBaseUrl = requiredString(input, 'assetBaseUrl');
    parseHttpsUrl(assetBaseUrl, 'asset base URL', { originOnly: false });
    const webBaseUrl = requiredString(input, 'webBaseUrl');
    parseHttpsUrl(webBaseUrl, 'web base URL', { originOnly: true });
    const productionWebOrigin = requiredString(input, 'productionWebOrigin');
    parseHttpsUrl(productionWebOrigin, 'production web origin', {
        originOnly: true,
    });

    const scenarioPath = requiredString(input, 'scenarioPath');
    assertSafeScenarioPath(scenarioPath, 'scenario path');
    const prepareRunId = optionalString(input, 'prepareRunId');
    const manualReviewPath = optionalString(input, 'manualReviewPath');

    if (phase === 'finalize') {
        if (!POSITIVE_INTEGER_RE.test(prepareRunId)) {
            throw new Error('prepare run id is required for finalize');
        }
        assertSafeScenarioPath(manualReviewPath, 'manual review path');
    } else if (prepareRunId !== '' || manualReviewPath !== '') {
        throw new Error(
            'prepare must not accept finalize-only prepare run id or manual review path'
        );
    }

    return {
        phase,
        candidateCommitSha,
        storyId,
        previewId,
        releaseId,
        manifestSha256,
        publisherReportRunId,
        publisherReportArtifact,
        assetBaseUrl,
        webBaseUrl,
        productionWebOrigin,
        scenarioPath,
        prepareRunId,
        manualReviewPath,
    };
}

function assertExactReleaseGateInputIdentity(
    expected: ReleaseGateWorkflowInputs,
    actual: ReleaseGateWorkflowInputs,
    label: string
): void {
    const fields: Array<keyof ReleaseGateWorkflowInputs> = [
        'phase',
        'candidateCommitSha',
        'storyId',
        'previewId',
        'releaseId',
        'manifestSha256',
        'publisherReportRunId',
        'publisherReportArtifact',
        'assetBaseUrl',
        'webBaseUrl',
        'productionWebOrigin',
        'scenarioPath',
        'prepareRunId',
        'manualReviewPath',
    ];
    for (const field of fields) {
        if (expected[field] !== actual[field]) {
            throw new Error(`${label} differs at ${field}`);
        }
    }
}

function parseCandidateEntryRequest(value: unknown): CandidateEntryRequestV1 {
    const record = asRecord(value, 'Candidate entry request');
    const source = asRecord(record.source, 'Candidate entry source');
    const request: CandidateEntryRequestV1 = {
        schemaVersion: record.schemaVersion as 1,
        source: {
            repository: requiredString(source, 'repository'),
            workflowRef: requiredString(source, 'workflowRef'),
            workflowSha: requiredString(source, 'workflowSha'),
            runId: requiredString(source, 'runId'),
            runAttempt: positiveInteger(source, 'runAttempt'),
        },
        input: parseReleaseGateWorkflowInputs(record.input),
    };
    if (
        request.schemaVersion !== 1 ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.source.repository) ||
        !CANDIDATE_COMMIT_SHA_RE.test(request.source.workflowSha) ||
        !POSITIVE_INTEGER_RE.test(request.source.runId)
    ) {
        throw new Error('Candidate entry request is invalid');
    }
    return request;
}

export function validateCandidateEntryWorkflowProvenance(
    eventValue: unknown,
    runValue: unknown,
    requestValue: unknown,
    expected: {
        repository: string;
        upstreamRunId: string;
    }
): {
    runId: string;
    runAttempt: number;
    headSha: string;
    input: ReleaseGateWorkflowInputs;
} {
    const event = asRecord(eventValue, 'Workflow run event');
    const eventRun = asRecord(event.workflow_run, 'Workflow run event run');
    const eventRepository = asRecord(
        event.repository,
        'Workflow run event repository'
    );
    const eventRunRepository = asRecord(
        eventRun.repository,
        'Workflow run event source repository'
    );
    const run = asRecord(runValue, 'Upstream candidate entry run metadata');
    const request = parseCandidateEntryRequest(requestValue);
    const runId = positiveInteger(run, 'id').toString();
    const runAttempt = positiveInteger(run, 'run_attempt');
    const headSha = requiredString(run, 'head_sha');
    const runRepository = asRecord(
        run.repository,
        'Upstream candidate entry repository'
    );
    const runtimeWorkflowRef = `${expected.repository}/${CANDIDATE_ENTRY_WORKFLOW_FILE_PATH}@refs/heads/main`;
    if (
        !POSITIVE_INTEGER_RE.test(expected.upstreamRunId) ||
        requiredString(event, 'action') !== 'completed' ||
        positiveInteger(eventRun, 'id').toString() !== expected.upstreamRunId ||
        positiveInteger(eventRun, 'run_attempt') !== runAttempt ||
        requiredString(eventRun, 'name') !== CANDIDATE_ENTRY_WORKFLOW_NAME ||
        requiredString(eventRun, 'event') !== 'workflow_dispatch' ||
        requiredString(eventRun, 'conclusion') !== 'success' ||
        requiredString(eventRun, 'head_branch') !== 'main' ||
        requiredString(eventRun, 'head_sha') !== headSha ||
        requiredString(eventRun, 'path') !==
            CANDIDATE_ENTRY_WORKFLOW_FILE_PATH ||
        requiredString(eventRepository, 'full_name') !== expected.repository ||
        requiredString(eventRunRepository, 'full_name') !==
            expected.repository ||
        runId !== expected.upstreamRunId ||
        requiredString(run, 'name') !== CANDIDATE_ENTRY_WORKFLOW_NAME ||
        requiredString(run, 'event') !== 'workflow_dispatch' ||
        requiredString(run, 'conclusion') !== 'success' ||
        requiredString(run, 'head_branch') !== 'main' ||
        requiredString(run, 'path') !== CANDIDATE_ENTRY_WORKFLOW_API_PATH ||
        requiredString(runRepository, 'full_name') !== expected.repository ||
        !CANDIDATE_COMMIT_SHA_RE.test(headSha) ||
        request.source.repository !== expected.repository ||
        request.source.workflowRef !== runtimeWorkflowRef ||
        request.source.workflowSha !== headSha ||
        request.source.runId !== runId ||
        request.source.runAttempt !== runAttempt
    ) {
        throw new Error(
            'Upstream candidate entry is not the exact successful main dispatch run'
        );
    }
    return {
        runId,
        runAttempt,
        headSha,
        input: request.input,
    };
}

function parseManifest(value: unknown): Manifest {
    const manifest = asRecord(value, 'Vite manifest');
    for (const [key, entry] of Object.entries(manifest)) {
        const record = asRecord(entry, `Vite manifest entry ${key}`);
        if (typeof record.file !== 'string' || record.file.trim() === '') {
            throw new Error(
                `Vite manifest entry ${key} must name an emitted file`
            );
        }
    }
    return manifest as Manifest;
}

function parseStoryChunkModules(value: unknown): ChunkModuleMetadata {
    const metadata = asRecord(value, 'Story chunk metadata');
    if (metadata.schemaVersion !== 1) {
        throw new Error('Story chunk metadata must use schema version 1');
    }
    const chunks = asRecord(metadata.chunks, 'Story chunk metadata chunks');
    for (const [file, modules] of Object.entries(chunks)) {
        if (
            !Array.isArray(modules) ||
            modules.some(moduleId => typeof moduleId !== 'string')
        ) {
            throw new Error(`Story chunk metadata for ${file} is invalid`);
        }
    }
    return metadata as unknown as ChunkModuleMetadata;
}

/**
 * Replaces the fixture-only unrelated chunk field with the exact public paths
 * emitted for the other registered stories in this candidate build. The hash
 * is calculated only after this replacement.
 */
export function materializeReleaseGateScenario(input: {
    scenario: unknown;
    candidateCommitSha: string;
    manifestSha256: string;
    viteManifest: unknown;
    storyChunkModules: unknown;
    buildOutputSha256: string;
}): MaterializedReleaseGateScenario {
    if (!CANDIDATE_COMMIT_SHA_RE.test(input.candidateCommitSha)) {
        throw new Error(
            'candidate commit SHA must be a lowercase 40-character SHA'
        );
    }
    if (!isSha256(input.manifestSha256) || !isSha256(input.buildOutputSha256)) {
        throw new Error('release-gate build binding requires SHA-256 digests');
    }

    const scenario = parseVisualNovelGateScenarioV1(input.scenario);
    if (!isRegisteredStoryId(scenario.storyId)) {
        throw new Error(
            'Scenario story id is not registered for chunk mapping'
        );
    }
    const storyChunks = materializeStoryChunkPaths(
        parseManifest(input.viteManifest),
        parseStoryChunkModules(input.storyChunkModules)
    );
    const unrelatedStoryChunks = Object.entries(storyChunks)
        .filter(([storyId]) => storyId !== scenario.storyId)
        .map(([, path]) => path)
        .sort(compareCanonicalStrings);
    if (unrelatedStoryChunks.length === 0) {
        throw new Error(
            'Same-build story chunk mapping has no unrelated story chunks'
        );
    }

    const materializedScenario = parseVisualNovelGateScenarioV1({
        ...scenario,
        unrelatedStoryChunks,
    });
    const mapping: StoryChunkMappingV1 = {
        schemaVersion: 1,
        candidateCommitSha: input.candidateCommitSha,
        manifestSha256: input.manifestSha256,
        buildOutputSha256: input.buildOutputSha256,
        storyId: materializedScenario.storyId,
        storyChunks,
        unrelatedStoryChunks,
    };
    const scenarioSha256 = canonicalSha256(materializedScenario as JsonValue);
    const mappingSha256 = canonicalSha256(mapping as JsonValue);

    return {
        scenario: materializedScenario,
        scenarioSha256,
        mapping,
        mappingSha256,
    };
}

/**
 * Uses the CLI-returned URL as the only deployment authority. The user input
 * is an allow-list suffix policy, never a fallback browser origin.
 */
export function createDeploymentAttestation(input: {
    materialized: MaterializedReleaseGateScenario;
    deploymentUrl: string;
    requestedWebBaseUrl: string;
}): DeploymentAttestationV1 {
    const deployment = parseHttpsUrl(input.deploymentUrl, 'deployment URL', {
        originOnly: true,
    });
    const requested = parseHttpsUrl(
        input.requestedWebBaseUrl,
        'requested web base URL',
        { originOnly: true }
    );
    const deploymentHost = normalizeHostname(deployment.hostname);
    const requestedHost = normalizeHostname(requested.hostname);
    if (
        deployment.port !== requested.port ||
        (deploymentHost !== requestedHost &&
            !deploymentHost.endsWith(`.${requestedHost}`))
    ) {
        throw new Error(
            'Prebuilt deployment URL does not satisfy the requested allowed origin policy'
        );
    }

    return {
        schemaVersion: 1,
        candidateCommitSha: input.materialized.mapping.candidateCommitSha,
        storyId: input.materialized.mapping.storyId,
        manifestSha256: input.materialized.mapping.manifestSha256,
        buildOutputSha256: input.materialized.mapping.buildOutputSha256,
        scenarioSha256: input.materialized.scenarioSha256,
        mappingSha256: input.materialized.mappingSha256,
        deploymentUrl: canonicalOrigin(deployment),
        requestedAllowedOrigin: canonicalOrigin(requested),
    };
}

function assertAllowedDeploymentOrigin(deployment: URL, requested: URL): void {
    const deploymentHost = normalizeHostname(deployment.hostname);
    const requestedHost = normalizeHostname(requested.hostname);
    if (
        deployment.port !== requested.port ||
        (deploymentHost !== requestedHost &&
            !deploymentHost.endsWith(`.${requestedHost}`))
    ) {
        throw new Error(
            'Prebuilt deployment URL does not satisfy the requested allowed origin policy'
        );
    }
}

/**
 * Parses the Vercel CLI's stdout before it is ever written to GITHUB_OUTPUT.
 * Vercel's deployment authority is one canonical origin line; status text,
 * ANSI controls, and a second line are all fail-closed instead of being
 * treated as harmless CLI noise.
 */
export function parseVercelDeploymentStdout(
    stdout: string,
    requestedWebBaseUrl: string
): string {
    if (new TextEncoder().encode(stdout).byteLength > 4 * 1024) {
        throw new Error('Vercel deployment stdout is too large');
    }
    if (stdout.includes('\r') || stdout.includes('\0')) {
        throw new Error('Vercel deployment stdout contains control characters');
    }
    const line = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
    if (
        line.length === 0 ||
        line.includes('\n') ||
        hasForbiddenControlCharacters(line)
    ) {
        throw new Error(
            'Vercel deployment stdout must contain exactly one control-free URL line'
        );
    }
    const deployment = parseHttpsUrl(line, 'deployment URL', {
        originOnly: true,
    });
    const requested = parseHttpsUrl(
        requestedWebBaseUrl,
        'requested web base URL',
        { originOnly: true }
    );
    const canonical = canonicalOrigin(deployment);
    if (line !== canonical) {
        throw new Error(
            'Vercel deployment stdout must be one canonical HTTPS origin'
        );
    }
    assertAllowedDeploymentOrigin(deployment, requested);
    return canonical;
}

type TarEntryKind = 'file' | 'directory';

export type ReleaseGateTarEntryV1 = {
    path: string;
    kind: TarEntryKind;
    mode: number;
    bytes: Uint8Array;
    sha256: string;
};

export type ReleaseGateTarV1 = {
    entries: ReleaseGateTarEntryV1[];
    totalFileBytes: number;
};

function isZeroTarBlock(bytes: Uint8Array, offset: number): boolean {
    for (let index = offset; index < offset + TAR_BLOCK_SIZE; index += 1) {
        if (bytes[index] !== 0) return false;
    }
    return true;
}

function tarFieldText(
    header: Uint8Array,
    offset: number,
    length: number,
    label: string
): string {
    const field = header.slice(offset, offset + length);
    const zeroIndex = field.indexOf(0);
    const meaningful = zeroIndex === -1 ? field : field.slice(0, zeroIndex);
    try {
        const value = new TextDecoder('utf-8', { fatal: true }).decode(
            meaningful
        );
        if (/[^\x20-\x7e]/.test(value)) {
            throw new Error('control');
        }
        return value;
    } catch {
        throw new Error(`Release-gate tar ${label} is not safe text`);
    }
}

function tarOctal(
    header: Uint8Array,
    offset: number,
    length: number,
    label: string
): number {
    const raw = tarFieldText(header, offset, length, label)
        .trim()
        .replace(/^0+(?=[0-7])/, '');
    if (raw !== '' && !/^[0-7]+$/.test(raw)) {
        throw new Error(`Release-gate tar ${label} is invalid`);
    }
    const value = raw === '' ? 0 : Number.parseInt(raw, 8);
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Release-gate tar ${label} is invalid`);
    }
    return value;
}

function tarChecksum(header: Uint8Array): number {
    let sum = 0;
    for (let index = 0; index < TAR_BLOCK_SIZE; index += 1) {
        sum += index >= 148 && index < 156 ? 0x20 : header[index]!;
    }
    return sum;
}

function canonicalTarPath(
    name: string,
    prefix: string,
    kind: TarEntryKind
): string {
    const raw = prefix === '' ? name : `${prefix}/${name}`;
    const path = kind === 'directory' ? raw.replace(/\/$/, '') : raw;
    if (
        path === '' ||
        path.includes('\0') ||
        !isSafeReleaseGateOutputPath(path) ||
        path.split('/').some(segment => segment === '' || segment === '.')
    ) {
        throw new Error(
            'Release-gate tar entry must have a safe relative path'
        );
    }
    return path;
}

/**
 * Strict USTAR reader for candidate output. It accepts only files and
 * directories, validates checksums and bounded sizes, and rejects all link,
 * device, traversal, duplicate, and case-collision forms before extraction.
 */
export function parseReleaseGateTarV1(bytes: Uint8Array): ReleaseGateTarV1 {
    if (
        bytes.byteLength < TAR_BLOCK_SIZE * 2 ||
        bytes.byteLength > MAX_TAR_BYTES ||
        bytes.byteLength % TAR_BLOCK_SIZE !== 0
    ) {
        throw new Error('Release-gate tar has an invalid bounded size');
    }

    const entries: ReleaseGateTarEntryV1[] = [];
    const paths = new Set<string>();
    const foldedPaths = new Set<string>();
    let totalFileBytes = 0;
    let offset = 0;
    let foundEnd = false;

    while (offset < bytes.byteLength) {
        if (isZeroTarBlock(bytes, offset)) {
            if (
                offset + TAR_BLOCK_SIZE >= bytes.byteLength ||
                !isZeroTarBlock(bytes, offset + TAR_BLOCK_SIZE)
            ) {
                throw new Error(
                    'Release-gate tar must end with two zero blocks'
                );
            }
            for (
                let trailing = offset + TAR_BLOCK_SIZE * 2;
                trailing < bytes.byteLength;
                trailing += 1
            ) {
                if (bytes[trailing] !== 0) {
                    throw new Error(
                        'Release-gate tar has nonzero trailing data'
                    );
                }
            }
            foundEnd = true;
            break;
        }

        if (entries.length >= MAX_TAR_ENTRIES) {
            throw new Error('Release-gate tar has too many entries');
        }
        const header = bytes.slice(offset, offset + TAR_BLOCK_SIZE);
        const expectedChecksum = tarOctal(header, 148, 8, 'checksum');
        if (expectedChecksum !== tarChecksum(header)) {
            throw new Error('Release-gate tar checksum is invalid');
        }
        const name = tarFieldText(header, 0, 100, 'name');
        const prefix = tarFieldText(header, 345, 155, 'prefix');
        const typeFlag =
            header[156] === 0 ? '0' : String.fromCharCode(header[156]!);
        const kind: TarEntryKind =
            typeFlag === '0'
                ? 'file'
                : typeFlag === '5'
                  ? 'directory'
                  : (() => {
                        throw new Error(
                            'Release-gate tar may contain only regular files or directories'
                        );
                    })();
        const size = tarOctal(header, 124, 12, 'size');
        if (
            (kind === 'directory' && size !== 0) ||
            size > MAX_TAR_ENTRY_BYTES
        ) {
            throw new Error('Release-gate tar entry size is invalid');
        }
        const path = canonicalTarPath(name, prefix, kind);
        const foldedPath = path.toLocaleLowerCase('en-US');
        if (paths.has(path)) {
            throw new Error('Release-gate tar contains a duplicate path');
        }
        if (foldedPaths.has(foldedPath)) {
            throw new Error('Release-gate tar contains case-colliding paths');
        }
        const dataStart = offset + TAR_BLOCK_SIZE;
        const paddedSize = Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
        const nextOffset = dataStart + paddedSize;
        if (nextOffset > bytes.byteLength) {
            throw new Error('Release-gate tar entry is truncated');
        }
        const payload = bytes.slice(dataStart, dataStart + size);
        totalFileBytes += size;
        if (totalFileBytes > MAX_TAR_BYTES) {
            throw new Error('Release-gate tar content exceeds its byte limit');
        }
        paths.add(path);
        foldedPaths.add(foldedPath);
        entries.push({
            path,
            kind,
            mode: tarOctal(header, 100, 8, 'mode'),
            bytes: payload,
            sha256: sha256(payload),
        });
        offset = nextOffset;
    }

    if (!foundEnd || entries.length === 0) {
        throw new Error('Release-gate tar has no complete entries');
    }
    const filePaths = new Set(
        entries.filter(entry => entry.kind === 'file').map(entry => entry.path)
    );
    for (const entry of entries) {
        const segments = entry.path.split('/');
        for (let index = 1; index < segments.length; index += 1) {
            if (filePaths.has(segments.slice(0, index).join('/'))) {
                throw new Error(
                    'Release-gate tar has a file/directory path collision'
                );
            }
        }
    }
    return { entries, totalFileBytes };
}

export type ReleaseGateArtifactProvenanceV1 = {
    repository: string;
    workflowRef: string;
    workflowSha: string;
    runId: string;
    runAttempt: number;
    jobName: string;
    conclusion: string;
    phase: string;
    artifactId: string;
    artifactName: string;
    artifactDigest: string;
    candidateCommitSha: string;
};

export function validateReleaseGateArtifactProvenance(
    value: unknown,
    expected: {
        repository: string;
        candidateCommitSha: string;
        prepareRunId: string;
    }
): ReleaseGateArtifactProvenanceV1 {
    const record = asRecord(value, 'Release-gate artifact provenance');
    const provenance: ReleaseGateArtifactProvenanceV1 = {
        repository: requiredString(record, 'repository'),
        workflowRef: requiredString(record, 'workflowRef'),
        workflowSha: requiredString(record, 'workflowSha'),
        runId: requiredString(record, 'runId'),
        runAttempt: positiveInteger(record, 'runAttempt'),
        jobName: requiredString(record, 'jobName'),
        conclusion: requiredString(record, 'conclusion'),
        phase: requiredString(record, 'phase'),
        artifactId: requiredString(record, 'artifactId'),
        artifactName: requiredString(record, 'artifactName'),
        artifactDigest: normalizeArtifactDigest(
            requiredString(record, 'artifactDigest'),
            'Release-gate artifact'
        ),
        candidateCommitSha: requiredString(record, 'candidateCommitSha'),
    };
    if (
        provenance.repository !== expected.repository ||
        !isMainReleaseGateWorkflowReference(
            provenance.workflowRef,
            expected.repository
        ) ||
        !CANDIDATE_COMMIT_SHA_RE.test(provenance.workflowSha) ||
        provenance.runId !== expected.prepareRunId ||
        !Number.isSafeInteger(provenance.runAttempt) ||
        provenance.runAttempt <= 0 ||
        provenance.jobName !== 'seal-candidate' ||
        provenance.conclusion !== 'success' ||
        provenance.phase !== 'prepare' ||
        !POSITIVE_INTEGER_RE.test(provenance.artifactId) ||
        provenance.artifactName !==
            `visual-novel-sealed-candidate-${provenance.runId}-${provenance.runAttempt}` ||
        !ARTIFACT_DIGEST_RE.test(provenance.artifactDigest) ||
        provenance.candidateCommitSha !== expected.candidateCommitSha
    ) {
        throw new Error(
            'Release-gate artifact provenance is not a successful exact main prepare artifact'
        );
    }
    return provenance;
}

function assertAbsolutePathInside(
    path: string,
    root: string,
    label: string
): string {
    if (path.includes('\0')) {
        throw new Error(`${label} contains a NUL byte`);
    }
    const resolvedRoot = resolve(root);
    const resolvedPath = resolve(path);
    const relativePath = relative(resolvedRoot, resolvedPath);
    if (
        relativePath === '' ||
        relativePath === '..' ||
        relativePath.startsWith(`..${sep}`) ||
        relativePath.split(sep).some(segment => segment === '')
    ) {
        throw new Error(`${label} escapes its trusted root`);
    }
    return resolvedPath;
}

async function assertRealDirectory(path: string, label: string): Promise<void> {
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${label} must be a real directory`);
    }
}

async function readRegularFileNoLinks(
    path: string,
    root: string,
    label: string,
    maxBytes = MAX_TAR_BYTES
): Promise<Uint8Array> {
    const resolvedRoot = resolve(root);
    const resolvedPath = assertAbsolutePathInside(path, resolvedRoot, label);
    await assertRealDirectory(resolvedRoot, `${label} root`);
    const segments = relative(resolvedRoot, resolvedPath).split(sep);
    let current = resolvedRoot;
    for (const segment of segments.slice(0, -1)) {
        current = resolve(current, segment);
        await assertRealDirectory(current, `${label} parent`);
    }
    const stat = await lstat(resolvedPath);
    if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.nlink !== 1 ||
        stat.size > maxBytes
    ) {
        throw new Error(`${label} must be one bounded non-linked regular file`);
    }
    const handle = await open(
        resolvedPath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    );
    try {
        const opened = await handle.stat();
        if (
            !opened.isFile() ||
            opened.nlink !== 1 ||
            opened.size !== stat.size
        ) {
            throw new Error(`${label} changed while being opened`);
        }
        return new Uint8Array(await handle.readFile());
    } finally {
        await handle.close();
    }
}

async function createFreshRealDirectory(
    path: string,
    root: string,
    label: string
): Promise<string> {
    const resolvedRoot = resolve(root);
    const resolvedPath = assertAbsolutePathInside(path, resolvedRoot, label);
    await assertRealDirectory(resolvedRoot, `${label} root`);
    const parent = dirname(resolvedPath);
    const relativeParent = relative(resolvedRoot, parent);
    let current = resolvedRoot;
    if (relativeParent !== '') {
        for (const segment of relativeParent.split(sep)) {
            if (!isSafeRelativePath(segment)) {
                throw new Error(`${label} has an unsafe parent path`);
            }
            current = resolve(current, segment);
            try {
                await mkdir(current, { mode: 0o700 });
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error;
                }
            }
            await assertRealDirectory(current, `${label} parent`);
        }
    }
    try {
        await mkdir(resolvedPath, { mode: 0o700 });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
        throw new Error(`${label} must be a fresh directory`);
    }
    await assertRealDirectory(resolvedPath, label);
    return resolvedPath;
}

async function writeFileNoFollow(
    path: string,
    root: string,
    bytes: Uint8Array | string,
    mode: number,
    label: string
): Promise<void> {
    const resolvedRoot = resolve(root);
    const resolvedPath = assertAbsolutePathInside(path, resolvedRoot, label);
    const parent = dirname(resolvedPath);
    await assertRealDirectory(parent, `${label} parent`);
    const handle = await open(
        resolvedPath,
        fsConstants.O_WRONLY |
            fsConstants.O_CREAT |
            fsConstants.O_EXCL |
            fsConstants.O_NOFOLLOW,
        mode
    );
    try {
        await handle.writeFile(bytes);
    } finally {
        await handle.close();
    }
}

function tarHeader(
    path: string,
    size: number,
    mode: number,
    typeFlag: '0' | '5'
): Uint8Array {
    const header = new Uint8Array(TAR_BLOCK_SIZE);
    const encoder = new TextEncoder();
    const write = (offset: number, length: number, value: string) => {
        const encoded = encoder.encode(value);
        if (encoded.byteLength > length) {
            throw new Error('Release-gate canonical tar field is too long');
        }
        header.set(encoded, offset);
    };
    const slash = path.lastIndexOf('/');
    const name = path.length <= 100 ? path : path.slice(slash + 1);
    const prefix = path.length <= 100 ? '' : path.slice(0, slash);
    if (
        name.length === 0 ||
        name.length > 100 ||
        prefix.length > 155 ||
        (path.length > 100 && slash <= 0)
    ) {
        throw new Error('Release-gate canonical tar path is too long');
    }
    write(0, 100, name);
    write(100, 8, `${mode.toString(8).padStart(7, '0')}\0`);
    write(108, 8, '0000000\0');
    write(116, 8, '0000000\0');
    write(124, 12, `${size.toString(8).padStart(11, '0')}\0`);
    write(136, 12, '00000000000\0');
    header.fill(0x20, 148, 156);
    write(156, 1, typeFlag);
    write(257, 6, 'ustar\0');
    write(263, 2, '00');
    write(345, 155, prefix);
    const checksum = tarChecksum(header);
    write(148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
    return header;
}

function createCanonicalOutputTar(
    entries: Array<{ path: string; bytes: Uint8Array }>
): Uint8Array {
    const sorted = [...entries].sort((left, right) =>
        compareCanonicalStrings(left.path, right.path)
    );
    const blocks = sorted.map(entry => {
        const header = tarHeader(
            entry.path,
            entry.bytes.byteLength,
            0o444,
            '0'
        );
        const paddedSize =
            Math.ceil(entry.bytes.byteLength / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
        const block = new Uint8Array(TAR_BLOCK_SIZE + paddedSize);
        block.set(header);
        block.set(entry.bytes, TAR_BLOCK_SIZE);
        return block;
    });
    const archive = new Uint8Array(
        blocks.reduce(
            (sum, block) => sum + block.byteLength,
            TAR_BLOCK_SIZE * 2
        )
    );
    let offset = 0;
    for (const block of blocks) {
        archive.set(block, offset);
        offset += block.byteLength;
    }
    return archive;
}

export type ReleaseGateOutputEntryV1 = {
    path: string;
    byteLength: number;
    sha256: string;
};

export type ReleaseGateOutputTreeV1 = {
    entries: ReleaseGateOutputEntryV1[];
    treeSha256: string;
    totalBytes: number;
};

async function collectReleaseGateOutputTree(
    root: string,
    label: string
): Promise<ReleaseGateOutputTreeV1> {
    await assertRealDirectory(root, label);
    const entries: ReleaseGateOutputEntryV1[] = [];
    let totalBytes = 0;

    const visit = async (directory: string): Promise<void> => {
        const children = await readdir(directory, { withFileTypes: true });
        for (const child of children.sort((left, right) =>
            compareCanonicalStrings(left.name, right.name)
        )) {
            const path = resolve(directory, child.name);
            const stat = await lstat(path);
            if (stat.isSymbolicLink()) {
                throw new Error(`${label} must not contain symbolic links`);
            }
            if (stat.isDirectory()) {
                await visit(path);
                continue;
            }
            if (!stat.isFile() || stat.nlink !== 1) {
                throw new Error(
                    `${label} must contain only non-linked regular files`
                );
            }
            const relativePath = relative(root, path).split(sep).join('/');
            if (!isSafeReleaseGateOutputPath(relativePath)) {
                throw new Error(`${label} contains an unsafe output path`);
            }
            if (
                entries.length >= MAX_TAR_ENTRIES ||
                stat.size > MAX_TAR_ENTRY_BYTES
            ) {
                throw new Error(`${label} exceeds its entry limits`);
            }
            totalBytes += stat.size;
            if (totalBytes > MAX_TAR_BYTES) {
                throw new Error(`${label} exceeds its byte limit`);
            }
            const bytes = await readRegularFileNoLinks(path, root, label);
            entries.push({
                path: relativePath,
                byteLength: bytes.byteLength,
                sha256: sha256(bytes),
            });
        }
    };

    await visit(root);
    if (entries.length === 0) {
        throw new Error(`${label} must contain output files`);
    }
    return {
        entries,
        treeSha256: canonicalSha256(entries as JsonValue),
        totalBytes,
    };
}

async function ensureDirectoryTree(
    root: string,
    relativeDirectory: string,
    label: string
): Promise<string> {
    if (relativeDirectory === '') return root;
    if (!isSafeReleaseGateOutputPath(relativeDirectory)) {
        throw new Error(`${label} has an unsafe directory path`);
    }
    let current = root;
    for (const segment of relativeDirectory.split('/')) {
        current = resolve(current, segment);
        try {
            await mkdir(current, { mode: 0o700 });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error;
            }
        }
        await assertRealDirectory(current, label);
    }
    return current;
}

async function safelyExtractTar(
    archive: ReleaseGateTarV1,
    root: string,
    parentRoot: string,
    label: string
): Promise<void> {
    const destination = await createFreshRealDirectory(root, parentRoot, label);
    const directories = archive.entries
        .filter(entry => entry.kind === 'directory')
        .sort((left, right) => compareCanonicalStrings(left.path, right.path));
    for (const entry of directories) {
        await ensureDirectoryTree(destination, entry.path, label);
    }
    const files = archive.entries
        .filter(entry => entry.kind === 'file')
        .sort((left, right) => compareCanonicalStrings(left.path, right.path));
    for (const entry of files) {
        const parent = dirname(entry.path);
        if (parent !== '.') {
            await ensureDirectoryTree(destination, parent, label);
        }
        await writeFileNoFollow(
            resolve(destination, entry.path),
            destination,
            entry.bytes,
            0o600,
            label
        );
        await chmod(resolve(destination, entry.path), 0o444);
    }
    const lockDown = async (directory: string): Promise<void> => {
        const children = await readdir(directory, { withFileTypes: true });
        for (const child of children) {
            if (child.isDirectory()) {
                await lockDown(resolve(directory, child.name));
            }
        }
        await chmod(directory, 0o555);
    };
    await lockDown(destination);
}

function requiredTarFile(
    archive: ReleaseGateTarV1,
    path: string,
    label: string
): ReleaseGateTarEntryV1 {
    const matches = archive.entries.filter(
        entry => entry.kind === 'file' && entry.path === path
    );
    if (matches.length !== 1) {
        throw new Error(`${label} must contain exactly one ${path}`);
    }
    return matches[0]!;
}

function assertRawCandidateArchiveLayout(archive: ReleaseGateTarV1): void {
    requiredTarFile(archive, 'tier1.json', 'Raw candidate archive');
    requiredTarFile(archive, 'scenario-template.json', 'Raw candidate archive');
    requiredTarFile(archive, 'candidate-lockfile', 'Raw candidate archive');
    for (const entry of archive.entries) {
        if (
            entry.path === 'tier1.json' ||
            entry.path === 'scenario-template.json' ||
            entry.path === 'candidate-lockfile' ||
            entry.path === 'vercel-output' ||
            entry.path.startsWith('vercel-output/')
        ) {
            continue;
        }
        throw new Error('Raw candidate archive has an unexpected entry');
    }
    if (
        !archive.entries.some(
            entry =>
                entry.kind === 'file' && entry.path.startsWith('vercel-output/')
        )
    ) {
        throw new Error('Raw candidate archive has no Vercel output files');
    }
}

function assertSealedCandidateArchiveLayout(archive: ReleaseGateTarV1): void {
    for (const entry of archive.entries) {
        if (
            entry.path === 'vercel-output' ||
            entry.path.startsWith('vercel-output/')
        ) {
            continue;
        }
        throw new Error('Sealed Vercel output archive has an unexpected entry');
    }
    if (
        !archive.entries.some(
            entry =>
                entry.kind === 'file' && entry.path.startsWith('vercel-output/')
        )
    ) {
        throw new Error('Sealed Vercel output archive has no output files');
    }
}

function outputTreeFromTar(archive: ReleaseGateTarV1): {
    entries: Array<{ path: string; bytes: Uint8Array }>;
    tree: ReleaseGateOutputTreeV1;
} {
    assertSealedCandidateArchiveLayout(archive);
    const entries = archive.entries
        .filter(entry => entry.kind === 'file')
        .map(entry => {
            const path = entry.path.slice('vercel-output/'.length);
            if (!isSafeReleaseGateOutputPath(path)) {
                throw new Error(
                    'Sealed Vercel output archive has an unsafe path'
                );
            }
            return { path, bytes: entry.bytes };
        })
        .sort((left, right) => compareCanonicalStrings(left.path, right.path));
    const manifest = entries.map(entry => ({
        path: entry.path,
        byteLength: entry.bytes.byteLength,
        sha256: sha256(entry.bytes),
    }));
    return {
        entries,
        tree: {
            entries: manifest,
            treeSha256: canonicalSha256(manifest as JsonValue),
            totalBytes: manifest.reduce(
                (sum, entry) => sum + entry.byteLength,
                0
            ),
        },
    };
}

function jsonFromTarEntry(
    entry: ReleaseGateTarEntryV1,
    label: string
): unknown {
    try {
        return JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes)
        ) as unknown;
    } catch {
        throw new Error(`${label} is not valid JSON`);
    }
}

function outputEntryBytes(
    entries: Array<{ path: string; bytes: Uint8Array }>,
    path: string,
    label: string
): Uint8Array {
    const matches = entries.filter(entry => entry.path === path);
    if (matches.length !== 1) {
        throw new Error(`${label} is missing from the sealed Vercel output`);
    }
    return matches[0]!.bytes;
}

function materializeFromOutputEntries(input: {
    scenario: unknown;
    candidateCommitSha: string;
    manifestSha256: string;
    entries: Array<{ path: string; bytes: Uint8Array }>;
    treeSha256: string;
}): {
    materialized: MaterializedReleaseGateScenario;
    viteManifestSha256: string;
    storyChunkModulesSha256: string;
} {
    const viteManifestBytes = outputEntryBytes(
        input.entries,
        'static/.vite/manifest.json',
        'Vite manifest'
    );
    const storyChunkModuleBytes = outputEntryBytes(
        input.entries,
        'static/.vite/story-chunk-modules.json',
        'Story chunk module metadata'
    );
    const materialized = materializeReleaseGateScenario({
        scenario: input.scenario,
        candidateCommitSha: input.candidateCommitSha,
        manifestSha256: input.manifestSha256,
        viteManifest: jsonFromTarEntry(
            {
                path: 'static/.vite/manifest.json',
                kind: 'file',
                mode: 0o444,
                bytes: viteManifestBytes,
                sha256: sha256(viteManifestBytes),
            },
            'Vite manifest'
        ),
        storyChunkModules: jsonFromTarEntry(
            {
                path: 'static/.vite/story-chunk-modules.json',
                kind: 'file',
                mode: 0o444,
                bytes: storyChunkModuleBytes,
                sha256: sha256(storyChunkModuleBytes),
            },
            'Story chunk module metadata'
        ),
        buildOutputSha256: input.treeSha256,
    });
    const paths = new Set(input.entries.map(entry => entry.path));
    for (const pathname of Object.values(materialized.mapping.storyChunks)) {
        if (!paths.has(`static/${pathname.slice(1)}`)) {
            throw new Error(
                'Story chunk mapping must reference regular output files in the sealed entry manifest'
            );
        }
    }
    return {
        materialized,
        viteManifestSha256: sha256(viteManifestBytes),
        storyChunkModulesSha256: sha256(storyChunkModuleBytes),
    };
}

export type CandidateBuildContractV1 = {
    schemaVersion: 1;
    outputApiVersion: 3;
    phase: 'prepare';
    input: ReleaseGateWorkflowInputs;
    producer: {
        repository: string;
        workflowRef: string;
        workflowSha: string;
        runId: string;
        runAttempt: number;
        jobName: 'seal-candidate';
        candidateRawArtifactId: string;
        candidateRawArtifactDigest: string;
    };
    candidateLockfileSha256: string;
    tier1CanonicalSha256: string;
    toolchain: {
        bunVersion: string;
        nodeVersion: string;
        playwrightVersion: string;
        commandSetVersion: 1;
        browserMatrix: ['chromium', 'mobile-chrome'];
    };
    output: {
        archiveName: 'vercel-output.v1.tar';
        archiveSha256: string;
        treeSha256: string;
        totalBytes: number;
        entryLimits: typeof RELEASE_GATE_ARCHIVE_LIMITS;
        entries: ReleaseGateOutputEntryV1[];
        viteManifestSha256: string;
        storyChunkModulesSha256: string;
    };
    scenario: VisualNovelGateScenarioV1;
    scenarioSha256: string;
    mapping: StoryChunkMappingV1;
    mappingSha256: string;
};

function parseCandidateBuildContract(value: unknown): CandidateBuildContractV1 {
    const record = asRecord(value, 'Candidate build contract');
    const inputRecord = asRecord(
        record.input,
        'Candidate build contract input'
    );
    const input = parseReleaseGateWorkflowInputs({
        ...inputRecord,
        // A sealed artifact always represents a prepare candidate, even when
        // it is later consumed by the protected finalize lane.
        phase: 'prepare',
        prepareRunId: '',
        manualReviewPath: '',
    });
    const producer = asRecord(record.producer, 'Candidate build producer');
    const output = asRecord(record.output, 'Candidate build output');
    const entryLimits = asRecord(
        output.entryLimits,
        'Candidate output entry limits'
    );
    const scenario = parseVisualNovelGateScenarioV1(record.scenario);
    const mapping = parseMaterializedContract({
        scenario,
        scenarioSha256: requiredString(record, 'scenarioSha256'),
        mapping: record.mapping,
        mappingSha256: requiredString(record, 'mappingSha256'),
    }).mapping;
    const entries = Array.isArray(output.entries)
        ? output.entries.map(value => {
              const entry = asRecord(value, 'Candidate output entry');
              const path = requiredString(entry, 'path');
              const byteLength = positiveInteger(entry, 'byteLength');
              const digest = requiredString(entry, 'sha256');
              if (!isSafeReleaseGateOutputPath(path) || !isSha256(digest)) {
                  throw new Error('Candidate output entry is invalid');
              }
              return { path, byteLength, sha256: digest };
          })
        : (() => {
              throw new Error('Candidate output entries are required');
          })();
    const contract: CandidateBuildContractV1 = {
        schemaVersion: 1,
        outputApiVersion: OUTPUT_API_VERSION,
        phase: 'prepare',
        input,
        producer: {
            repository: requiredString(producer, 'repository'),
            workflowRef: requiredString(producer, 'workflowRef'),
            workflowSha: requiredString(producer, 'workflowSha'),
            runId: requiredString(producer, 'runId'),
            runAttempt: positiveInteger(producer, 'runAttempt'),
            jobName: requiredString(producer, 'jobName') as 'seal-candidate',
            candidateRawArtifactId: requiredString(
                producer,
                'candidateRawArtifactId'
            ),
            candidateRawArtifactDigest: requiredString(
                producer,
                'candidateRawArtifactDigest'
            ),
        },
        candidateLockfileSha256: requiredString(
            record,
            'candidateLockfileSha256'
        ),
        tier1CanonicalSha256: requiredString(record, 'tier1CanonicalSha256'),
        toolchain: (() => {
            const toolchain = asRecord(record.toolchain, 'Candidate toolchain');
            return {
                bunVersion: requiredString(toolchain, 'bunVersion'),
                nodeVersion: requiredString(toolchain, 'nodeVersion'),
                playwrightVersion: requiredString(
                    toolchain,
                    'playwrightVersion'
                ),
                commandSetVersion: positiveInteger(
                    toolchain,
                    'commandSetVersion'
                ) as 1,
                browserMatrix: (() => {
                    const matrix = toolchain.browserMatrix;
                    if (
                        !Array.isArray(matrix) ||
                        matrix.length !== 2 ||
                        matrix[0] !== 'chromium' ||
                        matrix[1] !== 'mobile-chrome'
                    ) {
                        throw new Error('Candidate browser matrix is invalid');
                    }
                    return ['chromium', 'mobile-chrome'] as [
                        'chromium',
                        'mobile-chrome',
                    ];
                })(),
            };
        })(),
        output: {
            archiveName: requiredString(
                output,
                'archiveName'
            ) as 'vercel-output.v1.tar',
            archiveSha256: requiredString(output, 'archiveSha256'),
            treeSha256: requiredString(output, 'treeSha256'),
            totalBytes: positiveInteger(output, 'totalBytes'),
            entryLimits: RELEASE_GATE_ARCHIVE_LIMITS,
            entries,
            viteManifestSha256: requiredString(output, 'viteManifestSha256'),
            storyChunkModulesSha256: requiredString(
                output,
                'storyChunkModulesSha256'
            ),
        },
        scenario,
        scenarioSha256: requiredString(record, 'scenarioSha256'),
        mapping,
        mappingSha256: requiredString(record, 'mappingSha256'),
    };
    if (
        record.schemaVersion !== 1 ||
        record.outputApiVersion !== OUTPUT_API_VERSION ||
        record.phase !== 'prepare' ||
        contract.producer.workflowRef !==
            `${contract.producer.repository}/${LIVE_RELEASE_GATE_WORKFLOW_PATH}@refs/heads/main` ||
        !CANDIDATE_COMMIT_SHA_RE.test(contract.producer.workflowSha) ||
        !POSITIVE_INTEGER_RE.test(contract.producer.runId) ||
        contract.producer.jobName !== 'seal-candidate' ||
        !POSITIVE_INTEGER_RE.test(contract.producer.candidateRawArtifactId) ||
        !ARTIFACT_DIGEST_RE.test(
            contract.producer.candidateRawArtifactDigest
        ) ||
        !isSha256(contract.candidateLockfileSha256) ||
        !isSha256(contract.tier1CanonicalSha256) ||
        contract.toolchain.commandSetVersion !== 1 ||
        contract.output.archiveName !== 'vercel-output.v1.tar' ||
        !isSha256(contract.output.archiveSha256) ||
        !isSha256(contract.output.treeSha256) ||
        !isSha256(contract.output.viteManifestSha256) ||
        !isSha256(contract.output.storyChunkModulesSha256) ||
        entryLimits.maxArchiveBytes !== MAX_TAR_BYTES ||
        entryLimits.maxEntryBytes !== MAX_TAR_ENTRY_BYTES ||
        entryLimits.maxEntries !== MAX_TAR_ENTRIES ||
        contract.output.entries.length === 0 ||
        canonicalSha256(contract.scenario as JsonValue) !==
            contract.scenarioSha256 ||
        canonicalSha256(contract.mapping as JsonValue) !==
            contract.mappingSha256
    ) {
        throw new Error('Candidate build contract is invalid');
    }
    return contract;
}

function requiredAbsoluteEnvironmentPath(
    environment: Readonly<Record<string, string | undefined>>,
    key: string,
    label: string
): string {
    const value = requiredString(
        asRecord(environment, 'Workflow environment'),
        key
    );
    if (!value.startsWith(sep) || value.includes('\0')) {
        throw new Error(`${label} must be an absolute path`);
    }
    return resolve(value);
}

async function assertDirectoryTreeNoLinks(
    root: string,
    label: string
): Promise<void> {
    await assertRealDirectory(root, label);
    let entryCount = 0;
    let byteCount = 0;
    const visit = async (directory: string): Promise<void> => {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            entryCount += 1;
            if (entryCount > MAX_TAR_ENTRIES) {
                throw new Error(`${label} has too many filesystem entries`);
            }
            const path = resolve(directory, entry.name);
            const stat = await lstat(path);
            if (stat.isSymbolicLink()) {
                throw new Error(`${label} must not contain symbolic links`);
            }
            if (stat.isDirectory()) {
                await visit(path);
                continue;
            }
            if (
                !stat.isFile() ||
                stat.nlink !== 1 ||
                stat.size > MAX_TAR_ENTRY_BYTES
            ) {
                throw new Error(
                    `${label} must contain only bounded non-linked regular files`
                );
            }
            byteCount += stat.size;
            if (byteCount > MAX_TAR_BYTES) {
                throw new Error(`${label} exceeds its byte limit`);
            }
        }
    };
    await visit(root);
}

function trustedWorkflowProvenance(
    environment: Readonly<Record<string, string | undefined>>,
    expectedJob: string
): {
    repository: string;
    workflowRef: string;
    workflowSha: string;
    runId: string;
    runAttempt: number;
    jobName: string;
} {
    const record = asRecord(environment, 'Workflow environment');
    const repository = requiredString(record, 'GITHUB_REPOSITORY');
    const workflowRef = requiredString(record, 'GITHUB_WORKFLOW_REF');
    const workflowSha = requiredString(record, 'GITHUB_WORKFLOW_SHA');
    const runId = requiredString(record, 'GITHUB_RUN_ID');
    const runAttempt = positiveInteger(record, 'GITHUB_RUN_ATTEMPT');
    const jobName = requiredString(record, 'GITHUB_JOB');
    if (
        workflowRef !==
            `${repository}/${LIVE_RELEASE_GATE_WORKFLOW_PATH}@refs/heads/main` ||
        !CANDIDATE_COMMIT_SHA_RE.test(workflowSha) ||
        !POSITIVE_INTEGER_RE.test(runId) ||
        jobName !== expectedJob
    ) {
        throw new Error(
            'Trusted release-gate work must execute from the immutable main workflow context'
        );
    }
    return {
        repository,
        workflowRef,
        workflowSha,
        runId,
        runAttempt,
        jobName,
    };
}

function assertExactCandidateInputIdentity(
    contractInput: ReleaseGateWorkflowInputs,
    inputs: ReleaseGateWorkflowInputs
): void {
    const fields: Array<keyof ReleaseGateWorkflowInputs> = [
        'candidateCommitSha',
        'storyId',
        'previewId',
        'releaseId',
        'manifestSha256',
        'publisherReportRunId',
        'publisherReportArtifact',
        'assetBaseUrl',
        'webBaseUrl',
        'productionWebOrigin',
        'scenarioPath',
    ];
    for (const field of fields) {
        if (contractInput[field] !== inputs[field]) {
            throw new Error(
                `Sealed candidate input identity differs at ${field}`
            );
        }
    }
}

function parseCandidateTier1(
    bytes: Uint8Array,
    inputs: ReleaseGateWorkflowInputs,
    candidateLockfileSha256: string
): Tier1EvidenceV1 {
    let tier1: Tier1EvidenceV1;
    try {
        tier1 = parseTier1EvidenceV1(
            JSON.parse(
                new TextDecoder('utf-8', { fatal: true }).decode(bytes)
            ) as unknown
        );
    } catch {
        throw new Error('Candidate Tier 1 evidence is invalid');
    }
    if (
        tier1.commitSha !== inputs.candidateCommitSha ||
        tier1.lockfileSha256 !== candidateLockfileSha256 ||
        tier1.commandSetVersion !== 1 ||
        tier1.browserMatrix[0] !== 'chromium' ||
        tier1.browserMatrix[1] !== 'mobile-chrome' ||
        tier1.status !== 'passed'
    ) {
        throw new Error(
            'Candidate Tier 1 evidence does not bind the sealed candidate'
        );
    }
    return tier1;
}

function assertTier1MatchesSealedContract(
    tier1: Tier1EvidenceV1,
    contract: CandidateBuildContractV1
): void {
    if (
        canonicalSha256(tier1 as JsonValue) !== contract.tier1CanonicalSha256 ||
        tier1.bunVersion !== contract.toolchain.bunVersion ||
        tier1.nodeVersion !== contract.toolchain.nodeVersion ||
        tier1.playwrightVersion !== contract.toolchain.playwrightVersion ||
        tier1.commandSetVersion !== contract.toolchain.commandSetVersion ||
        tier1.browserMatrix[0] !== contract.toolchain.browserMatrix[0] ||
        tier1.browserMatrix[1] !== contract.toolchain.browserMatrix[1] ||
        tier1.status !== 'passed'
    ) {
        throw new Error('Sealed candidate Tier 1 does not match its contract');
    }
}

function exactOutputArchiveFromRawCandidate(rawArchive: ReleaseGateTarV1): {
    archiveBytes: Uint8Array;
    archive: ReleaseGateTarV1;
    output: ReturnType<typeof outputTreeFromTar>;
} {
    const sourceEntries = rawArchive.entries
        .filter(
            entry =>
                entry.kind === 'file' && entry.path.startsWith('vercel-output/')
        )
        .map(entry => ({ path: entry.path, bytes: entry.bytes }));
    const archiveBytes = createCanonicalOutputTar(sourceEntries);
    const archive = parseReleaseGateTarV1(archiveBytes);
    const output = outputTreeFromTar(archive);
    return { archiveBytes, archive, output };
}

function verifyOutputApiV3(
    entries: Array<{ path: string; bytes: Uint8Array }>
): void {
    const config = asRecord(
        jsonFromTarEntry(
            {
                path: 'config.json',
                kind: 'file',
                mode: 0o444,
                bytes: outputEntryBytes(
                    entries,
                    'config.json',
                    'Vercel Output API config'
                ),
                sha256: '',
            },
            'Vercel Output API config'
        ),
        'Vercel Output API config'
    );
    if (config.version !== OUTPUT_API_VERSION) {
        throw new Error('Sealed Vercel output must use Output API version 3');
    }
}

async function validateTrustedWorkflowContext(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const expectedJob = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_EXPECTED_TRUSTED_JOB'
    );
    trustedWorkflowProvenance(environment, expectedJob);
    await assertRealDirectory(REPOSITORY_ROOT, 'Trusted repository root');
}

async function inspectRawCandidateArtifact(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const rawRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_RAW_CANDIDATE_ROOT',
        'Raw candidate artifact root'
    );
    await assertDirectoryTreeNoLinks(rawRoot, 'Raw candidate artifact root');
    const archive = parseReleaseGateTarV1(
        await readRegularFileNoLinks(
            resolve(rawRoot, 'candidate-output.v1.tar'),
            rawRoot,
            'Raw candidate archive'
        )
    );
    assertRawCandidateArchiveLayout(archive);
}

/**
 * Takes a secretless candidate archive and produces a small, canonical sealed
 * subject. This command is intentionally run only from the workflow SHA on
 * main; it parses bytes and never imports, executes, or installs candidate
 * code.
 */
async function sealCandidateArtifact(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'prepare') {
        throw new Error('Only prepare may seal a candidate artifact');
    }
    const producer = trustedWorkflowProvenance(environment, 'seal-candidate');
    const rawRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_RAW_CANDIDATE_ROOT',
        'Raw candidate artifact root'
    );
    const trustedInputRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_TRUSTED_CANDIDATE_INPUT_ROOT',
        'Trusted candidate input root'
    );
    await Promise.all([
        assertDirectoryTreeNoLinks(rawRoot, 'Raw candidate artifact root'),
        assertDirectoryTreeNoLinks(
            trustedInputRoot,
            'Trusted candidate input root'
        ),
    ]);
    const [rawBytes, trustedLockfile] = await Promise.all([
        readRegularFileNoLinks(
            resolve(rawRoot, 'candidate-output.v1.tar'),
            rawRoot,
            'Raw candidate archive'
        ),
        readRegularFileNoLinks(
            resolve(trustedInputRoot, 'candidate-lockfile'),
            trustedInputRoot,
            'Trusted candidate lockfile'
        ),
    ]);
    const rawArchive = parseReleaseGateTarV1(rawBytes);
    assertRawCandidateArchiveLayout(rawArchive);
    const rawLockfile = requiredTarFile(
        rawArchive,
        'candidate-lockfile',
        'Raw candidate archive'
    ).bytes;
    if (sha256(rawLockfile) !== sha256(trustedLockfile)) {
        throw new Error(
            'Candidate raw archive lockfile differs from trusted git data'
        );
    }
    const candidateLockfileSha256 = sha256(trustedLockfile);
    const tier1Bytes = requiredTarFile(
        rawArchive,
        'tier1.json',
        'Raw candidate archive'
    ).bytes;
    const tier1 = parseCandidateTier1(
        tier1Bytes,
        inputs,
        candidateLockfileSha256
    );
    const { archiveBytes, output } =
        exactOutputArchiveFromRawCandidate(rawArchive);
    verifyOutputApiV3(output.entries);
    const materialized = materializeFromOutputEntries({
        scenario: jsonFromTarEntry(
            requiredTarFile(
                rawArchive,
                'scenario-template.json',
                'Raw candidate archive'
            ),
            'Raw candidate scenario template'
        ),
        candidateCommitSha: inputs.candidateCommitSha,
        manifestSha256: inputs.manifestSha256,
        entries: output.entries,
        treeSha256: output.tree.treeSha256,
    });
    const rawArtifactId = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_RAW_CANDIDATE_ARTIFACT_ID'
    );
    const rawArtifactDigest = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_RAW_CANDIDATE_ARTIFACT_DIGEST'
    );
    const normalizedRawArtifactDigest = normalizeArtifactDigest(
        rawArtifactDigest,
        'Raw candidate artifact'
    );
    if (
        !POSITIVE_INTEGER_RE.test(rawArtifactId) ||
        !ARTIFACT_DIGEST_RE.test(normalizedRawArtifactDigest)
    ) {
        throw new Error('Raw candidate artifact identity is invalid');
    }
    const sealedRoot = await createFreshRealDirectory(
        resolveRepositoryPath('.release-gate/sealed-candidate'),
        REPOSITORY_ROOT,
        'Sealed candidate directory'
    );
    const contract: CandidateBuildContractV1 = {
        schemaVersion: 1,
        outputApiVersion: OUTPUT_API_VERSION,
        phase: 'prepare',
        input: inputs,
        producer: {
            ...producer,
            jobName: 'seal-candidate',
            candidateRawArtifactId: rawArtifactId,
            candidateRawArtifactDigest: normalizedRawArtifactDigest,
        },
        candidateLockfileSha256,
        tier1CanonicalSha256: canonicalSha256(tier1 as JsonValue),
        toolchain: {
            bunVersion: tier1.bunVersion,
            nodeVersion: tier1.nodeVersion,
            playwrightVersion: tier1.playwrightVersion,
            commandSetVersion: tier1.commandSetVersion,
            browserMatrix: [tier1.browserMatrix[0], tier1.browserMatrix[1]],
        },
        output: {
            archiveName: 'vercel-output.v1.tar',
            archiveSha256: sha256(archiveBytes),
            treeSha256: output.tree.treeSha256,
            totalBytes: output.tree.totalBytes,
            entryLimits: RELEASE_GATE_ARCHIVE_LIMITS,
            entries: output.tree.entries,
            viteManifestSha256: materialized.viteManifestSha256,
            storyChunkModulesSha256: materialized.storyChunkModulesSha256,
        },
        scenario: materialized.materialized.scenario,
        scenarioSha256: materialized.materialized.scenarioSha256,
        mapping: materialized.materialized.mapping,
        mappingSha256: materialized.materialized.mappingSha256,
    };
    await Promise.all([
        writeFileNoFollow(
            resolve(sealedRoot, 'candidate-build-contract.v1.json'),
            sealedRoot,
            `${canonicalJson(contract as unknown as JsonValue)}\n`,
            0o444,
            'Sealed candidate build contract'
        ),
        writeFileNoFollow(
            resolve(sealedRoot, 'tier1.json'),
            sealedRoot,
            `${canonicalJson(tier1 as JsonValue)}\n`,
            0o444,
            'Sealed candidate Tier 1 evidence'
        ),
        writeFileNoFollow(
            resolve(sealedRoot, 'vercel-output.v1.tar'),
            sealedRoot,
            archiveBytes,
            0o444,
            'Sealed Vercel output archive'
        ),
    ]);
    await appendOutput(
        environment,
        'sealed_contract_sha256',
        canonicalSha256(contract as unknown as JsonValue)
    );
    await appendOutput(
        environment,
        'sealed_output_tree_sha256',
        output.tree.treeSha256
    );
}

async function removeExistingOutputDirectory(
    outputRoot: string,
    parentRoot: string
): Promise<void> {
    const resolvedParent = resolve(parentRoot);
    const resolvedOutput = assertAbsolutePathInside(
        outputRoot,
        resolvedParent,
        'Trusted Vercel output'
    );
    await assertRealDirectory(resolvedParent, 'Trusted Vercel output parent');
    try {
        await assertDirectoryTreeNoLinks(
            resolvedOutput,
            'Existing trusted Vercel output'
        );
        await rm(resolvedOutput, {
            recursive: true,
            force: false,
            maxRetries: 2,
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
}

function assertContractOutput(
    contract: CandidateBuildContractV1,
    archiveBytes: Uint8Array,
    output: ReturnType<typeof outputTreeFromTar>
): void {
    if (
        sha256(archiveBytes) !== contract.output.archiveSha256 ||
        output.tree.treeSha256 !== contract.output.treeSha256 ||
        output.tree.totalBytes !== contract.output.totalBytes ||
        canonicalJson(output.tree.entries as unknown as JsonValue) !==
            canonicalJson(contract.output.entries as unknown as JsonValue)
    ) {
        throw new Error(
            'Sealed Vercel output does not match its contract manifest'
        );
    }
}

async function ingestSealedCandidateArtifact(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const expectedJob =
        inputs.phase === 'prepare' ? 'prepare-live' : 'finalize-live';
    trustedWorkflowProvenance(environment, expectedJob);
    const artifactRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_SEALED_ARTIFACT_ROOT',
        'Sealed candidate artifact root'
    );
    await assertDirectoryTreeNoLinks(
        artifactRoot,
        'Sealed candidate artifact root'
    );
    const [contractBytes, tier1Bytes, archiveBytes] = await Promise.all([
        readRegularFileNoLinks(
            resolve(artifactRoot, 'candidate-build-contract.v1.json'),
            artifactRoot,
            'Sealed candidate contract'
        ),
        readRegularFileNoLinks(
            resolve(artifactRoot, 'tier1.json'),
            artifactRoot,
            'Sealed candidate Tier 1 evidence'
        ),
        readRegularFileNoLinks(
            resolve(artifactRoot, 'vercel-output.v1.tar'),
            artifactRoot,
            'Sealed Vercel output archive'
        ),
    ]);
    const contract = parseCandidateBuildContract(
        JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(contractBytes)
        ) as unknown
    );
    assertExactCandidateInputIdentity(contract.input, inputs);
    const tier1 = parseCandidateTier1(
        tier1Bytes,
        inputs,
        contract.candidateLockfileSha256
    );
    assertTier1MatchesSealedContract(tier1, contract);
    const artifactId = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_SEALED_ARTIFACT_ID'
    );
    const artifactDigest = normalizeArtifactDigest(
        requiredString(
            asRecord(environment, 'Workflow environment'),
            'RELEASE_GATE_SEALED_ARTIFACT_DIGEST'
        ),
        'Sealed candidate artifact'
    );
    const expectedProducerWorkflowSha = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_SEALED_PRODUCER_WORKFLOW_SHA'
    );
    const expectedProducerRunId = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_SEALED_PRODUCER_RUN_ID'
    );
    const expectedProducerRunAttempt = positiveInteger(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_SEALED_PRODUCER_RUN_ATTEMPT'
    );
    if (
        contract.producer.workflowSha !== expectedProducerWorkflowSha ||
        contract.producer.runId !== expectedProducerRunId ||
        contract.producer.runAttempt !== expectedProducerRunAttempt
    ) {
        throw new Error(
            'Sealed artifact contract does not match resolved producer provenance'
        );
    }
    const prepareRunId =
        inputs.phase === 'prepare'
            ? contract.producer.runId
            : inputs.prepareRunId;
    validateReleaseGateArtifactProvenance(
        {
            ...contract.producer,
            conclusion: 'success',
            phase: 'prepare',
            artifactId,
            artifactName: `visual-novel-sealed-candidate-${contract.producer.runId}-${contract.producer.runAttempt}`,
            artifactDigest,
            candidateCommitSha: contract.input.candidateCommitSha,
        },
        {
            repository: contract.producer.repository,
            candidateCommitSha: inputs.candidateCommitSha,
            prepareRunId,
        }
    );
    const archive = parseReleaseGateTarV1(archiveBytes);
    const output = outputTreeFromTar(archive);
    assertContractOutput(contract, archiveBytes, output);
    verifyOutputApiV3(output.entries);
    const materialized = materializeFromOutputEntries({
        scenario: contract.scenario,
        candidateCommitSha: inputs.candidateCommitSha,
        manifestSha256: inputs.manifestSha256,
        entries: output.entries,
        treeSha256: output.tree.treeSha256,
    });
    if (
        materialized.materialized.scenarioSha256 !== contract.scenarioSha256 ||
        materialized.materialized.mappingSha256 !== contract.mappingSha256 ||
        materialized.viteManifestSha256 !==
            contract.output.viteManifestSha256 ||
        materialized.storyChunkModulesSha256 !==
            contract.output.storyChunkModulesSha256
    ) {
        throw new Error('Sealed output mapping or scenario binding changed');
    }
    if (
        canonicalSha256(contract.scenario as JsonValue) !==
        contract.scenarioSha256
    ) {
        throw new Error('Sealed candidate scenario digest is invalid');
    }
    const outputParent = resolveRepositoryPath('apps/web/.vercel');
    await assertRealDirectory(
        outputParent,
        'Trusted Vercel project link directory'
    );
    const outputRoot = resolve(outputParent, 'output');
    await removeExistingOutputDirectory(outputRoot, outputParent);
    const extractedArchive: ReleaseGateTarV1 = {
        entries: archive.entries.map(entry => {
            const path = entry.path.slice('vercel-output/'.length);
            if (!path || !isSafeReleaseGateOutputPath(path)) {
                throw new Error(
                    'Sealed Vercel output has an unsafe extraction path'
                );
            }
            return { ...entry, path };
        }),
        totalFileBytes: archive.totalFileBytes,
    };
    await safelyExtractTar(
        extractedArchive,
        outputRoot,
        outputParent,
        'Trusted sealed Vercel output'
    );
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await Promise.all([
        writeCanonicalJson(resolve(evidenceRoot, 'build-contract.json'), {
            scenario: contract.scenario,
            scenarioSha256: contract.scenarioSha256,
            mapping: contract.mapping,
            mappingSha256: contract.mappingSha256,
        } as JsonValue),
        writeCanonicalJson(
            resolve(evidenceRoot, 'scenario.json'),
            contract.scenario as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'sealed-scenario-provenance.json'),
            {
                schemaVersion: 1,
                candidateCommitSha: inputs.candidateCommitSha,
                scenarioSha256: contract.scenarioSha256,
                mappingSha256: contract.mappingSha256,
                artifactId,
                artifactDigest,
            } as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'tier1.json'),
            tier1 as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'sealed-artifact-provenance.json'),
            {
                schemaVersion: 1,
                artifactId,
                artifactDigest,
                producer: contract.producer,
                candidateCommitSha: inputs.candidateCommitSha,
            } as JsonValue
        ),
    ]);
}

/**
 * Finalize never executes candidate code. It can only reuse Tier 1 when the
 * trusted API provenance, sealed subject, evidence digest, and current
 * toolchain are exact; any mismatch requires a fresh secretless prepare run.
 */
async function validateTier1Reuse(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'finalize') {
        throw new Error('Tier 1 reuse validation is finalization-only');
    }
    const current = trustedWorkflowProvenance(environment, 'finalize-live');
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const writeFreshUpstreamRequired = async (): Promise<void> => {
        await writeCanonicalJson(resolve(evidenceRoot, 'tier1-reuse.json'), {
            schemaVersion: 1,
            mode: 'fresh-upstream-required',
            reason: 'exact-provenance-or-toolchain-mismatch',
            candidateCommitSha: inputs.candidateCommitSha,
        } as JsonValue);
        if (environment.GITHUB_STEP_SUMMARY) {
            await appendFile(
                environment.GITHUB_STEP_SUMMARY,
                '- Tier 1 reuse: fresh upstream prepare required; protected lane did not rerun candidate code.\n',
                'utf8'
            );
        }
    };

    try {
        const artifactRoot = requiredAbsoluteEnvironmentPath(
            environment,
            'RELEASE_GATE_SEALED_ARTIFACT_ROOT',
            'Sealed candidate artifact root'
        );
        const [
            contractValue,
            tier1Value,
            resolvedProvenanceValue,
            sealedValue,
        ] = await Promise.all([
            readJson(
                resolve(artifactRoot, 'candidate-build-contract.v1.json'),
                'Sealed candidate contract',
                artifactRoot
            ),
            readJson(
                resolve(evidenceRoot, 'tier1.json'),
                'Sealed candidate Tier 1 evidence'
            ),
            readJson(
                resolve(
                    evidenceRoot,
                    'resolved-prepare-artifact-provenance.json'
                ),
                'Resolved prepare artifact provenance'
            ),
            readJson(
                resolve(evidenceRoot, 'sealed-artifact-provenance.json'),
                'Sealed artifact provenance'
            ),
        ]);
        const contract = parseCandidateBuildContract(contractValue);
        assertExactCandidateInputIdentity(contract.input, inputs);
        const tier1 = parseCandidateTier1(
            new TextEncoder().encode(canonicalJson(tier1Value as JsonValue)),
            inputs,
            contract.candidateLockfileSha256
        );
        assertTier1MatchesSealedContract(tier1, contract);

        const prepareProvenance = validateReleaseGateArtifactProvenance(
            resolvedProvenanceValue,
            {
                repository: current.repository,
                candidateCommitSha: inputs.candidateCommitSha,
                prepareRunId: inputs.prepareRunId,
            }
        );
        const sealedProvenance = asRecord(
            sealedValue,
            'Sealed artifact provenance'
        );
        const sealedArtifactId = requiredString(sealedProvenance, 'artifactId');
        const sealedArtifactDigest = normalizeArtifactDigest(
            requiredString(sealedProvenance, 'artifactDigest'),
            'Sealed artifact provenance'
        );
        const sealedProducer = asRecord(
            sealedProvenance.producer,
            'Sealed artifact producer'
        );
        if (
            prepareProvenance.workflowSha !== contract.producer.workflowSha ||
            prepareProvenance.runId !== contract.producer.runId ||
            prepareProvenance.runAttempt !== contract.producer.runAttempt ||
            prepareProvenance.jobName !== contract.producer.jobName ||
            sealedArtifactId !== prepareProvenance.artifactId ||
            sealedArtifactDigest !== prepareProvenance.artifactDigest ||
            canonicalJson(sealedProducer as JsonValue) !==
                canonicalJson(contract.producer as unknown as JsonValue)
        ) {
            throw new Error('Sealed Tier 1 provenance is not exact');
        }

        const runtime = {
            bunVersion: requiredString(
                asRecord(environment, 'Workflow environment'),
                'RELEASE_GATE_TIER1_RUNTIME_BUN_VERSION'
            ),
            nodeVersion: requiredString(
                asRecord(environment, 'Workflow environment'),
                'RELEASE_GATE_TIER1_RUNTIME_NODE_VERSION'
            ),
            playwrightVersion: requiredString(
                asRecord(environment, 'Workflow environment'),
                'RELEASE_GATE_TIER1_RUNTIME_PLAYWRIGHT_VERSION'
            ),
        };
        if (
            runtime.bunVersion !== contract.toolchain.bunVersion ||
            runtime.nodeVersion !== contract.toolchain.nodeVersion ||
            runtime.playwrightVersion !== contract.toolchain.playwrightVersion
        ) {
            throw new Error('Current toolchain differs from sealed Tier 1');
        }

        const reuse = {
            schemaVersion: 1,
            mode: 'reused',
            phase: 'prepare',
            candidateCommitSha: inputs.candidateCommitSha,
            candidateLockfileSha256: contract.candidateLockfileSha256,
            tier1CanonicalSha256: contract.tier1CanonicalSha256,
            producer: contract.producer,
            artifact: {
                id: prepareProvenance.artifactId,
                digest: prepareProvenance.artifactDigest,
            },
            toolchain: contract.toolchain,
        } as JsonValue;
        await writeCanonicalJson(
            resolve(evidenceRoot, 'tier1-reuse.json'),
            reuse
        );
        await appendOutput(environment, 'tier1_reuse_mode', 'reused');
        if (environment.GITHUB_STEP_SUMMARY) {
            await appendFile(
                environment.GITHUB_STEP_SUMMARY,
                '- Tier 1 reuse: reused (exact sealed prepare provenance and toolchain).\n',
                'utf8'
            );
        }
    } catch {
        await writeFreshUpstreamRequired();
        throw new Error(
            'Tier 1 reuse requires a fresh secretless prepare candidate; protected finalize will not rerun candidate code'
        );
    }
}

async function verifySealedOutput(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const phase = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_OUTPUT_CHECK_PHASE'
    );
    if (phase !== 'predeploy' && phase !== 'postdeploy') {
        throw new Error('Release-gate output check phase is invalid');
    }
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const materialized = parseMaterializedContract(
        await readJson(
            resolve(evidenceRoot, 'build-contract.json'),
            'Build contract'
        )
    );
    const persistedScenario = parseVisualNovelGateScenarioV1(
        await readJson(
            resolve(evidenceRoot, 'scenario.json'),
            'Persisted sealed scenario'
        )
    );
    if (
        materialized.mapping.candidateCommitSha !== inputs.candidateCommitSha ||
        materialized.mapping.manifestSha256 !== inputs.manifestSha256 ||
        canonicalSha256(persistedScenario as JsonValue) !==
            materialized.scenarioSha256 ||
        canonicalJson(persistedScenario as JsonValue) !==
            canonicalJson(materialized.scenario as JsonValue)
    ) {
        throw new Error(
            'Sealed output contract does not match dispatch identity'
        );
    }
    const contract = parseCandidateBuildContract(
        await readJson(
            resolve(
                requiredAbsoluteEnvironmentPath(
                    environment,
                    'RELEASE_GATE_SEALED_ARTIFACT_ROOT',
                    'Sealed candidate artifact root'
                ),
                'candidate-build-contract.v1.json'
            ),
            'Sealed candidate contract',
            requiredAbsoluteEnvironmentPath(
                environment,
                'RELEASE_GATE_SEALED_ARTIFACT_ROOT',
                'Sealed candidate artifact root'
            )
        )
    );
    const outputRoot = resolveRepositoryPath(VERCEL_OUTPUT_PATH);
    const tree = await collectReleaseGateOutputTree(
        outputRoot,
        'Trusted sealed output'
    );
    if (
        tree.treeSha256 !== contract.output.treeSha256 ||
        tree.totalBytes !== contract.output.totalBytes ||
        canonicalJson(tree.entries as unknown as JsonValue) !==
            canonicalJson(contract.output.entries as unknown as JsonValue)
    ) {
        throw new Error(
            'Trusted sealed output no longer matches the sealed contract'
        );
    }
    const [viteManifest, storyChunkModules] = await Promise.all([
        readJson(resolveRepositoryPath(VITE_MANIFEST_PATH), 'Vite manifest'),
        readJson(
            resolveRepositoryPath(STORY_CHUNK_METADATA_PATH),
            'Story chunk module metadata'
        ),
    ]);
    const rematerialized = materializeReleaseGateScenario({
        scenario: contract.scenario,
        candidateCommitSha: inputs.candidateCommitSha,
        manifestSha256: inputs.manifestSha256,
        viteManifest,
        storyChunkModules,
        buildOutputSha256: tree.treeSha256,
    });
    if (
        rematerialized.scenarioSha256 !== contract.scenarioSha256 ||
        rematerialized.mappingSha256 !== contract.mappingSha256
    ) {
        throw new Error('Trusted sealed output Vite mapping changed');
    }
    await writeCanonicalJson(
        resolve(evidenceRoot, `${phase}-output-check.json`),
        {
            schemaVersion: 1,
            phase,
            treeSha256: tree.treeSha256,
            totalBytes: tree.totalBytes,
            scenarioSha256: rematerialized.scenarioSha256,
            mappingSha256: rematerialized.mappingSha256,
        } as JsonValue
    );
}

/**
 * Finalize never selects an artifact by a mutable display name. It receives
 * the Actions API responses downloaded by trusted shell commands, validates
 * the producing main run/job/artifact as one subject, then emits only
 * canonical scalar IDs for the following download step.
 */
async function validatePrepareProvenance(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'finalize') {
        throw new Error('Prepare provenance validation is finalization-only');
    }
    const current = trustedWorkflowProvenance(environment, 'finalize-live');
    const metadataRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_PREPARE_METADATA_ROOT',
        'Prepare metadata root'
    );
    await assertDirectoryTreeNoLinks(metadataRoot, 'Prepare metadata root');
    const [runValue, jobsValue, artifactsValue] = await Promise.all([
        readJson(
            resolve(metadataRoot, 'run.json'),
            'Prepare run metadata',
            metadataRoot
        ),
        readJson(
            resolve(metadataRoot, 'jobs.json'),
            'Prepare job metadata',
            metadataRoot
        ),
        readJson(
            resolve(metadataRoot, 'artifacts.json'),
            'Prepare artifact metadata',
            metadataRoot
        ),
    ]);
    const run = asRecord(runValue, 'Prepare run metadata');
    const jobs = asRecord(jobsValue, 'Prepare job metadata');
    const artifacts = asRecord(artifactsValue, 'Prepare artifact metadata');
    const jobRecords = Array.isArray(jobs.jobs) ? jobs.jobs : [];
    const matchingJobs = jobRecords.filter(job => {
        const record = asRecord(job, 'Prepare job');
        return (
            requiredString(record, 'name') === 'seal-candidate' &&
            requiredString(record, 'conclusion') === 'success'
        );
    });
    if (matchingJobs.length !== 1) {
        throw new Error(
            'Prepare run must have exactly one successful seal-candidate job'
        );
    }
    const runId = positiveInteger(run, 'id').toString();
    const runAttempt = positiveInteger(run, 'run_attempt');
    const path = requiredString(run, 'path');
    const headSha = requiredString(run, 'head_sha');
    const headBranch = requiredString(run, 'head_branch');
    if (
        runId !== inputs.prepareRunId ||
        requiredString(run, 'conclusion') !== 'success' ||
        headBranch !== 'main' ||
        !isMainReleaseGateWorkflowReference(path, current.repository) ||
        !CANDIDATE_COMMIT_SHA_RE.test(headSha)
    ) {
        throw new Error(
            'Prepare run is not an exact successful main release-gate run'
        );
    }
    const expectedArtifactName = `visual-novel-sealed-candidate-${runId}-${runAttempt}`;
    const artifactRecords = Array.isArray(artifacts.artifacts)
        ? artifacts.artifacts
        : [];
    const matchingArtifacts = artifactRecords.filter(artifact => {
        const record = asRecord(artifact, 'Prepare artifact');
        return (
            requiredString(record, 'name') === expectedArtifactName &&
            record.expired === false
        );
    });
    if (matchingArtifacts.length !== 1) {
        throw new Error(
            'Prepare run must retain exactly one sealed candidate artifact'
        );
    }
    const artifact = asRecord(matchingArtifacts[0], 'Prepare artifact');
    const provenance = validateReleaseGateArtifactProvenance(
        {
            repository: current.repository,
            workflowRef: path,
            workflowSha: headSha,
            runId,
            runAttempt,
            jobName: 'seal-candidate',
            conclusion: 'success',
            phase: 'prepare',
            artifactId: positiveInteger(artifact, 'id').toString(),
            artifactName: expectedArtifactName,
            artifactDigest: requiredString(artifact, 'digest'),
            candidateCommitSha: inputs.candidateCommitSha,
        },
        {
            repository: current.repository,
            candidateCommitSha: inputs.candidateCommitSha,
            prepareRunId: inputs.prepareRunId,
        }
    );
    await writeCanonicalJson(
        resolve(
            resolveRepositoryPath(EVIDENCE_DIRECTORY),
            'resolved-prepare-artifact-provenance.json'
        ),
        { schemaVersion: 1, ...provenance } as JsonValue
    );
    await appendOutput(
        environment,
        'sealed_artifact_id',
        provenance.artifactId
    );
    await appendOutput(
        environment,
        'sealed_artifact_digest',
        provenance.artifactDigest
    );
    await appendOutput(
        environment,
        'sealed_producer_workflow_sha',
        provenance.workflowSha
    );
    await appendOutput(environment, 'sealed_producer_run_id', provenance.runId);
    await appendOutput(
        environment,
        'sealed_producer_run_attempt',
        provenance.runAttempt.toString()
    );
}

async function validatePublisherArtifactProvenance(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const expectedJob =
        inputs.phase === 'prepare' ? 'prepare-live' : 'finalize-live';
    const current = trustedWorkflowProvenance(environment, expectedJob);
    const metadataRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_PUBLISHER_METADATA_ROOT',
        'Publisher metadata root'
    );
    await assertDirectoryTreeNoLinks(metadataRoot, 'Publisher metadata root');
    const [runValue, artifactsValue] = await Promise.all([
        readJson(
            resolve(metadataRoot, 'run.json'),
            'Publisher run metadata',
            metadataRoot
        ),
        readJson(
            resolve(metadataRoot, 'artifacts.json'),
            'Publisher artifact metadata',
            metadataRoot
        ),
    ]);
    const run = asRecord(runValue, 'Publisher run metadata');
    const artifacts = asRecord(artifactsValue, 'Publisher artifact metadata');
    const runId = positiveInteger(run, 'id').toString();
    const path = requiredString(run, 'path');
    if (
        runId !== inputs.publisherReportRunId ||
        requiredString(run, 'conclusion') !== 'success' ||
        requiredString(run, 'head_branch') !== 'main' ||
        path !== '.github/workflows/r2-publisher-preview.yml@main'
    ) {
        throw new Error(
            'Publisher artifact must come from a successful main publisher workflow'
        );
    }
    const candidates = (
        Array.isArray(artifacts.artifacts) ? artifacts.artifacts : []
    ).filter(artifact => {
        const record = asRecord(artifact, 'Publisher artifact');
        return (
            requiredString(record, 'name') === inputs.publisherReportArtifact &&
            record.expired === false
        );
    });
    if (candidates.length !== 1) {
        throw new Error(
            'Publisher run must retain exactly one named report artifact'
        );
    }
    const artifact = asRecord(candidates[0], 'Publisher artifact');
    const artifactId = positiveInteger(artifact, 'id').toString();
    const artifactDigest = normalizeArtifactDigest(
        requiredString(artifact, 'digest'),
        'Publisher artifact'
    );
    await writeCanonicalJson(
        resolve(
            resolveRepositoryPath(EVIDENCE_DIRECTORY),
            'publisher-artifact-provenance.json'
        ),
        {
            schemaVersion: 1,
            repository: current.repository,
            runId,
            workflowPath: path,
            artifactId,
            artifactName: inputs.publisherReportArtifact,
            artifactDigest,
            conclusion: 'success',
        } as JsonValue
    );
    await appendOutput(environment, 'publisher_artifact_id', artifactId);
    await appendOutput(
        environment,
        'publisher_artifact_digest',
        artifactDigest
    );
}

async function validateVercelPreviewContract(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const record = asRecord(environment, 'Workflow environment');
    const token = requiredString(record, 'VERCEL_TOKEN');
    const organization = requiredString(record, 'VERCEL_ORG_ID');
    const project = requiredString(record, 'VERCEL_PROJECT_ID');
    const credentialFree = requiredString(
        record,
        'RELEASE_GATE_VERCEL_PREVIEW_CREDENTIAL_FREE'
    );
    if (
        token.length < 8 ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(organization) ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(project) ||
        credentialFree !== 'true'
    ) {
        throw new Error(
            'The release gate requires a scoped credential-free Vercel preview project'
        );
    }
}

async function hashDirectory(directory: string): Promise<string> {
    return (await collectReleaseGateOutputTree(directory, 'Prebuilt output'))
        .treeSha256;
}

function resolveRepositoryPath(relativePath: string): string {
    if (!isSafeRelativePath(relativePath)) {
        throw new Error('Workflow path must be a safe relative path');
    }
    const path = resolve(REPOSITORY_ROOT, relativePath);
    if (
        path !== REPOSITORY_ROOT &&
        !path.startsWith(`${REPOSITORY_ROOT}${sep}`)
    ) {
        throw new Error('Workflow path escapes the repository');
    }
    return path;
}

async function readJson(
    path: string,
    label: string,
    root = REPOSITORY_ROOT
): Promise<unknown> {
    try {
        const bytes = await readRegularFileNoLinks(path, root, label);
        return JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        ) as unknown;
    } catch {
        throw new Error(`${label} could not be read as JSON`);
    }
}

async function writeFileSafely(
    path: string,
    root: string,
    bytes: Uint8Array | string,
    label: string
): Promise<void> {
    const resolvedRoot = resolve(root);
    const resolvedPath = assertAbsolutePathInside(path, resolvedRoot, label);
    await assertRealDirectory(resolvedRoot, `${label} root`);
    const parent = dirname(resolvedPath);
    const relativeParent = relative(resolvedRoot, parent).split(sep).join('/');
    await ensureDirectoryTree(resolvedRoot, relativeParent, `${label} parent`);

    let handle: Awaited<ReturnType<typeof open>>;
    try {
        const existing = await lstat(resolvedPath);
        if (
            !existing.isFile() ||
            existing.isSymbolicLink() ||
            existing.nlink !== 1
        ) {
            throw new Error(
                `${label} must not replace a linked or non-file path`
            );
        }
        handle = await open(
            resolvedPath,
            fsConstants.O_WRONLY | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW
        );
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        handle = await open(
            resolvedPath,
            fsConstants.O_WRONLY |
                fsConstants.O_CREAT |
                fsConstants.O_EXCL |
                fsConstants.O_NOFOLLOW,
            0o600
        );
    }
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1) {
            throw new Error(`${label} changed while being opened`);
        }
        await handle.writeFile(bytes);
    } finally {
        await handle.close();
    }
}

async function writeCanonicalJson(
    path: string,
    value: JsonValue
): Promise<void> {
    await writeFileSafely(
        path,
        REPOSITORY_ROOT,
        `${canonicalJson(value)}\n`,
        'Release-gate canonical JSON'
    );
}

function workflowInputsFromEnvironment(
    environment: Readonly<Record<string, string | undefined>>
): ReleaseGateWorkflowInputs {
    return parseReleaseGateWorkflowInputs({
        phase: environment.RELEASE_GATE_INPUT_PHASE,
        candidateCommitSha: environment.RELEASE_GATE_INPUT_CANDIDATE_COMMIT_SHA,
        storyId: environment.RELEASE_GATE_INPUT_STORY_ID,
        previewId: environment.RELEASE_GATE_INPUT_PREVIEW_ID,
        releaseId: environment.RELEASE_GATE_INPUT_RELEASE_ID,
        manifestSha256: environment.RELEASE_GATE_INPUT_MANIFEST_SHA256,
        publisherReportRunId:
            environment.RELEASE_GATE_INPUT_PUBLISHER_REPORT_RUN_ID,
        publisherReportArtifact:
            environment.RELEASE_GATE_INPUT_PUBLISHER_REPORT_ARTIFACT,
        assetBaseUrl: environment.RELEASE_GATE_INPUT_ASSET_BASE_URL,
        webBaseUrl: environment.RELEASE_GATE_INPUT_WEB_BASE_URL,
        productionWebOrigin:
            environment.RELEASE_GATE_INPUT_PRODUCTION_WEB_ORIGIN,
        scenarioPath: environment.RELEASE_GATE_INPUT_SCENARIO_PATH,
        prepareRunId: environment.RELEASE_GATE_INPUT_PREPARE_RUN_ID,
        manualReviewPath: environment.RELEASE_GATE_INPUT_MANUAL_REVIEW_PATH,
    });
}

async function appendOutput(
    environment: Readonly<Record<string, string | undefined>>,
    key: string,
    value: string
): Promise<void> {
    if (!value || value.includes('\n') || value.includes('\r')) {
        throw new Error(`Refusing unsafe workflow output for ${key}`);
    }
    const outputPath = environment.GITHUB_OUTPUT;
    if (outputPath) {
        await appendFile(outputPath, `${key}=${value}\n`, 'utf8');
    } else {
        process.stdout.write(`${key}=${value}\n`);
    }
}

async function emitValidatedInputs(
    inputs: ReleaseGateWorkflowInputs,
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const values: Record<string, string> = {
        phase: inputs.phase,
        candidate_commit_sha: inputs.candidateCommitSha,
        story_id: inputs.storyId,
        preview_id: inputs.previewId,
        release_id: inputs.releaseId,
        manifest_sha256: inputs.manifestSha256,
        publisher_report_run_id: inputs.publisherReportRunId,
        publisher_report_artifact: inputs.publisherReportArtifact,
        asset_base_url: inputs.assetBaseUrl,
        web_base_url: inputs.webBaseUrl,
        production_web_origin: inputs.productionWebOrigin,
        scenario_path: inputs.scenarioPath,
        prepare_run_id: inputs.prepareRunId || 'none',
        manual_review_path: inputs.manualReviewPath || 'none',
    };
    for (const [key, value] of Object.entries(values)) {
        await appendOutput(environment, key, value);
    }
}

/**
 * The dispatch workflow can execute a branch-selected revision, so its
 * artifact is deliberately treated as hostile transport. This packages the
 * validated request for the default-branch workflow_run consumer without
 * granting the dispatch job deployment authority.
 */
async function packageCandidateEntry(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const record = asRecord(environment, 'Workflow environment');
    const entryRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_CANDIDATE_ENTRY_ROOT',
        'Candidate entry artifact root'
    );
    const rootParent = dirname(entryRoot);
    await assertRealDirectory(rootParent, 'Candidate entry artifact parent');
    const freshRoot = await createFreshRealDirectory(
        entryRoot,
        rootParent,
        'Candidate entry artifact root'
    );
    const request: CandidateEntryRequestV1 = {
        schemaVersion: 1,
        source: {
            repository: requiredString(record, 'GITHUB_REPOSITORY'),
            workflowRef: requiredString(record, 'GITHUB_WORKFLOW_REF'),
            workflowSha: requiredString(record, 'GITHUB_WORKFLOW_SHA'),
            runId: requiredString(record, 'GITHUB_RUN_ID'),
            runAttempt: positiveInteger(record, 'GITHUB_RUN_ATTEMPT'),
        },
        input: inputs,
    };
    parseCandidateEntryRequest(request);
    await writeFileNoFollow(
        resolve(freshRoot, 'entry-request.v1.json'),
        freshRoot,
        `${canonicalJson(request as unknown as JsonValue)}\n`,
        0o444,
        'Candidate entry request'
    );
    if (inputs.phase === 'finalize') {
        const review = parseVisualReviewRecordV1(
            await readJson(
                resolveRepositoryPath(inputs.manualReviewPath),
                'Manual review record'
            )
        );
        await writeFileNoFollow(
            resolve(freshRoot, 'manual-review.json'),
            freshRoot,
            `${canonicalJson(review as JsonValue)}\n`,
            0o444,
            'Candidate entry manual review'
        );
    }
}

/**
 * Validates the REST metadata and downloaded bytes for the just-completed
 * secretless entry run. Nothing in this function executes entry/candidate
 * code: it only parses bounded files and exports validated scalar identity.
 */
async function validateUpstreamCandidateEntry(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const current = trustedWorkflowProvenance(environment, 'entry-provenance');
    const upstreamRunId = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_UPSTREAM_RUN_ID'
    );
    if (!POSITIVE_INTEGER_RE.test(upstreamRunId)) {
        throw new Error('Upstream candidate entry run ID is invalid');
    }
    const metadataRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_UPSTREAM_METADATA_ROOT',
        'Upstream candidate entry metadata root'
    );
    const entryRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_CANDIDATE_ENTRY_ROOT',
        'Candidate entry artifact root'
    );
    const eventPath = requiredAbsoluteEnvironmentPath(
        environment,
        'GITHUB_EVENT_PATH',
        'Workflow run event path'
    );
    await Promise.all([
        assertDirectoryTreeNoLinks(
            metadataRoot,
            'Upstream candidate entry metadata root'
        ),
        assertDirectoryTreeNoLinks(entryRoot, 'Candidate entry artifact root'),
    ]);
    const [eventValue, runValue, artifactsValue, requestValue] =
        await Promise.all([
            readJson(eventPath, 'Workflow run event', dirname(eventPath)),
            readJson(
                resolve(metadataRoot, 'run.json'),
                'Upstream candidate entry run metadata',
                metadataRoot
            ),
            readJson(
                resolve(metadataRoot, 'artifacts.json'),
                'Upstream candidate entry artifact metadata',
                metadataRoot
            ),
            readJson(
                resolve(entryRoot, 'entry-request.v1.json'),
                'Candidate entry request',
                entryRoot
            ),
        ]);
    const artifacts = asRecord(
        artifactsValue,
        'Upstream candidate entry artifact metadata'
    );
    const provenance = validateCandidateEntryWorkflowProvenance(
        eventValue,
        runValue,
        requestValue,
        {
            repository: current.repository,
            upstreamRunId,
        }
    );
    const { runId, runAttempt } = provenance;
    const expectedArtifactName = `visual-novel-raw-candidate-${runId}-${runAttempt}`;
    const candidates = (
        Array.isArray(artifacts.artifacts) ? artifacts.artifacts : []
    ).filter(artifact => {
        const candidate = asRecord(artifact, 'Candidate entry artifact');
        const workflowRun = asRecord(
            candidate.workflow_run,
            'Candidate entry artifact workflow run'
        );
        return (
            requiredString(candidate, 'name') === expectedArtifactName &&
            candidate.expired === false &&
            positiveInteger(workflowRun, 'id').toString() === runId
        );
    });
    if (candidates.length !== 1) {
        throw new Error(
            'Upstream candidate entry must retain exactly one exact raw artifact'
        );
    }
    const artifact = asRecord(candidates[0], 'Candidate entry artifact');
    const artifactId = positiveInteger(artifact, 'id').toString();
    const artifactDigest = normalizeArtifactDigest(
        requiredString(artifact, 'digest'),
        'Candidate entry artifact'
    );
    if (provenance.input.phase === 'prepare') {
        await readRegularFileNoLinks(
            resolve(entryRoot, 'candidate-output.v1.tar'),
            entryRoot,
            'Candidate entry raw output archive'
        );
    } else {
        parseVisualReviewRecordV1(
            await readJson(
                resolve(entryRoot, 'manual-review.json'),
                'Candidate entry manual review',
                entryRoot
            )
        );
    }
    await emitValidatedInputs(provenance.input, environment);
    await appendOutput(environment, 'entry_run_id', runId);
    await appendOutput(environment, 'entry_run_attempt', runAttempt.toString());
    await appendOutput(environment, 'raw_artifact_id', artifactId);
    await appendOutput(environment, 'raw_artifact_digest', artifactDigest);
}

async function materializeCandidateEntryManualReview(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'finalize') {
        throw new Error('Candidate entry manual review is finalization-only');
    }
    const entryRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_CANDIDATE_ENTRY_ROOT',
        'Candidate entry artifact root'
    );
    await assertDirectoryTreeNoLinks(
        entryRoot,
        'Candidate entry artifact root'
    );
    const [requestValue, reviewValue] = await Promise.all([
        readJson(
            resolve(entryRoot, 'entry-request.v1.json'),
            'Candidate entry request',
            entryRoot
        ),
        readJson(
            resolve(entryRoot, 'manual-review.json'),
            'Candidate entry manual review',
            entryRoot
        ),
    ]);
    const request = parseCandidateEntryRequest(requestValue);
    assertExactReleaseGateInputIdentity(
        inputs,
        request.input,
        'Candidate entry request identity'
    );
    const review = parseVisualReviewRecordV1(reviewValue);
    await writeCanonicalJson(
        resolve(
            resolveRepositoryPath(EVIDENCE_DIRECTORY),
            'candidate-entry-manual-review.json'
        ),
        review as JsonValue
    );
}

async function materializeFromBuild(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const [scenario, viteManifest, storyChunkModules, buildOutputSha256] =
        await Promise.all([
            readJson(resolveRepositoryPath(inputs.scenarioPath), 'Scenario'),
            readJson(
                resolveRepositoryPath(VITE_MANIFEST_PATH),
                'Vite manifest'
            ),
            readJson(
                resolveRepositoryPath(STORY_CHUNK_METADATA_PATH),
                'Story chunk metadata'
            ),
            hashDirectory(resolveRepositoryPath(VERCEL_OUTPUT_PATH)),
        ]);
    const materialized = materializeReleaseGateScenario({
        scenario,
        candidateCommitSha: inputs.candidateCommitSha,
        manifestSha256: inputs.manifestSha256,
        viteManifest,
        storyChunkModules,
        buildOutputSha256,
    });
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await Promise.all([
        writeCanonicalJson(
            resolve(evidenceRoot, 'scenario.json'),
            materialized.scenario as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'story-chunk-mapping.json'),
            materialized.mapping as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'build-contract.json'),
            materialized as JsonValue
        ),
    ]);
    await appendOutput(
        environment,
        'scenario_sha256',
        materialized.scenarioSha256
    );
    await appendOutput(
        environment,
        'mapping_sha256',
        materialized.mappingSha256
    );
    await appendOutput(environment, 'build_output_sha256', buildOutputSha256);
}

function parseMaterializedContract(
    value: unknown
): MaterializedReleaseGateScenario {
    const record = asRecord(value, 'Build contract');
    const scenario = parseVisualNovelGateScenarioV1(record.scenario);
    const scenarioSha256 = requiredString(record, 'scenarioSha256');
    const mapping = asRecord(record.mapping, 'Build contract mapping');
    const mappingSha256 = requiredString(record, 'mappingSha256');
    if (!isSha256(scenarioSha256) || !isSha256(mappingSha256)) {
        throw new Error('Build contract has invalid digests');
    }
    const storyChunksRecord = asRecord(
        mapping.storyChunks,
        'Build contract story chunks'
    );
    const storyChunks: Record<string, string> = {};
    for (const [storyId, pathname] of Object.entries(storyChunksRecord)) {
        if (
            !isRegisteredStoryId(storyId) ||
            typeof pathname !== 'string' ||
            pathname.length < 2 ||
            !pathname.startsWith('/') ||
            pathname.startsWith('//') ||
            pathname.includes('?') ||
            pathname.includes('#') ||
            pathname.includes('%') ||
            !isSafeRelativePath(pathname.slice(1))
        ) {
            throw new Error('Build contract story chunks are invalid');
        }
        storyChunks[storyId] = pathname;
    }
    const unrelatedStoryChunks = Array.isArray(mapping.unrelatedStoryChunks)
        ? mapping.unrelatedStoryChunks.map(value => {
              if (typeof value !== 'string') {
                  throw new Error(
                      'Build contract unrelated story chunks are invalid'
                  );
              }
              return value;
          })
        : (() => {
              throw new Error(
                  'Build contract unrelated story chunks are invalid'
              );
          })();
    const parsedMapping: StoryChunkMappingV1 = {
        schemaVersion: 1,
        candidateCommitSha: requiredString(mapping, 'candidateCommitSha'),
        manifestSha256: requiredString(mapping, 'manifestSha256'),
        buildOutputSha256: requiredString(mapping, 'buildOutputSha256'),
        storyId: requiredString(mapping, 'storyId'),
        storyChunks,
        unrelatedStoryChunks,
    };
    const expectedUnrelatedStoryChunks = Object.entries(storyChunks)
        .filter(([storyId]) => storyId !== scenario.storyId)
        .map(([, pathname]) => pathname)
        .sort(compareCanonicalStrings);
    if (
        mapping.schemaVersion !== 1 ||
        !CANDIDATE_COMMIT_SHA_RE.test(parsedMapping.candidateCommitSha) ||
        !isSha256(parsedMapping.manifestSha256) ||
        !isSha256(parsedMapping.buildOutputSha256) ||
        !isRegisteredStoryId(parsedMapping.storyId) ||
        parsedMapping.storyId !== scenario.storyId ||
        Object.keys(storyChunks).length !== REGISTERED_STORY_IDS.length ||
        REGISTERED_STORY_IDS.some(
            storyId => storyChunks[storyId] === undefined
        ) ||
        new Set(Object.values(storyChunks)).size !==
            Object.keys(storyChunks).length ||
        JSON.stringify(parsedMapping.unrelatedStoryChunks) !==
            JSON.stringify(expectedUnrelatedStoryChunks) ||
        JSON.stringify(scenario.unrelatedStoryChunks) !==
            JSON.stringify(expectedUnrelatedStoryChunks) ||
        canonicalSha256(scenario as JsonValue) !== scenarioSha256 ||
        canonicalSha256(parsedMapping as JsonValue) !== mappingSha256
    ) {
        throw new Error('Build contract binding is invalid');
    }
    return { scenario, scenarioSha256, mapping: parsedMapping, mappingSha256 };
}

async function attestDeployment(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const materialized = parseMaterializedContract(
        await readJson(
            resolve(evidenceRoot, 'build-contract.json'),
            'Build contract'
        )
    );
    if (
        materialized.mapping.candidateCommitSha !== inputs.candidateCommitSha ||
        materialized.mapping.storyId !== inputs.storyId ||
        materialized.mapping.manifestSha256 !== inputs.manifestSha256
    ) {
        throw new Error(
            'Build contract does not match validated dispatch identity'
        );
    }
    const stdoutRoot = requiredAbsoluteEnvironmentPath(
        environment,
        'RELEASE_GATE_VERCEL_STDOUT_ROOT',
        'Vercel stdout root'
    );
    await assertDirectoryTreeNoLinks(stdoutRoot, 'Vercel stdout root');
    const stdout = new TextDecoder('utf-8', { fatal: true }).decode(
        await readRegularFileNoLinks(
            resolve(stdoutRoot, 'deploy.stdout'),
            stdoutRoot,
            'Vercel deployment stdout',
            4 * 1024
        )
    );
    const deploymentUrl = parseVercelDeploymentStdout(
        stdout,
        inputs.webBaseUrl
    );
    const attestation = createDeploymentAttestation({
        materialized,
        deploymentUrl,
        requestedWebBaseUrl: inputs.webBaseUrl,
    });
    await writeCanonicalJson(
        resolve(evidenceRoot, 'deployment-attestation.json'),
        attestation as JsonValue
    );
    await appendOutput(
        environment,
        'deployment_url',
        attestation.deploymentUrl
    );
}

function requireSafeRelativeEnvironmentPath(
    environment: Readonly<Record<string, string | undefined>>,
    key: string,
    label: string
): string {
    const value = requiredString(
        asRecord(environment, 'Workflow environment'),
        key
    );
    if (!isSafeRelativePath(value)) {
        throw new Error(`${label} must be a safe relative path`);
    }
    return value;
}

async function listSafeJsonFiles(root: string): Promise<string[]> {
    await assertDirectoryTreeNoLinks(root, 'Retained publisher artifact');
    const files: string[] = [];

    const visit = async (directory: string): Promise<void> => {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries.sort((left, right) =>
            compareCanonicalStrings(left.name, right.name)
        )) {
            const path = resolve(directory, entry.name);
            const stat = await lstat(path);
            if (stat.isSymbolicLink()) {
                throw new Error(
                    'Retained publisher artifact must not contain symbolic links'
                );
            }
            if (stat.isDirectory()) {
                await visit(path);
                continue;
            }
            if (!stat.isFile() || stat.nlink !== 1) {
                throw new Error(
                    'Retained publisher artifact contains an unsupported filesystem entry'
                );
            }
            const relativePath = relative(root, path).split(sep).join('/');
            if (!isSafeReleaseGateOutputPath(relativePath)) {
                throw new Error(
                    'Retained publisher artifact contains an unsafe path'
                );
            }
            if (path.endsWith('.json')) {
                if (stat.size > 4 * 1024 * 1024) {
                    throw new Error(
                        'Retained publisher JSON report is too large'
                    );
                }
                files.push(path);
            }
        }
    };

    await visit(root);
    return files;
}

function assertMaterializedIdentity(
    materialized: MaterializedReleaseGateScenario,
    inputs: ReleaseGateWorkflowInputs
): void {
    if (
        materialized.mapping.candidateCommitSha !== inputs.candidateCommitSha ||
        materialized.mapping.storyId !== inputs.storyId ||
        materialized.mapping.manifestSha256 !== inputs.manifestSha256 ||
        materialized.scenario.storyId !== inputs.storyId
    ) {
        throw new Error(
            'Build contract does not match validated dispatch identity'
        );
    }
}

async function loadMaterializedContract(
    inputs: ReleaseGateWorkflowInputs
): Promise<MaterializedReleaseGateScenario> {
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const materialized = parseMaterializedContract(
        await readJson(
            resolve(evidenceRoot, 'build-contract.json'),
            'Build contract'
        )
    );
    assertMaterializedIdentity(materialized, inputs);
    return materialized;
}

async function loadDeploymentAttestation(
    inputs: ReleaseGateWorkflowInputs,
    materialized: MaterializedReleaseGateScenario
): Promise<DeploymentAttestationV1> {
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const retained = await readJson(
        resolve(evidenceRoot, 'deployment-attestation.json'),
        'Deployment attestation'
    );
    const retainedRecord = asRecord(retained, 'Deployment attestation');
    const expected = createDeploymentAttestation({
        materialized,
        deploymentUrl: requiredString(retainedRecord, 'deploymentUrl'),
        requestedWebBaseUrl: inputs.webBaseUrl,
    });
    if (
        canonicalJson(retained as JsonValue) !==
        canonicalJson(expected as JsonValue)
    ) {
        throw new Error('Deployment attestation binding is invalid');
    }
    return expected;
}

async function validatePublisherCandidate(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const materialized = await loadMaterializedContract(inputs);
    const artifactDirectory = resolveRepositoryPath(
        requireSafeRelativeEnvironmentPath(
            environment,
            'RELEASE_GATE_PUBLISHER_REPORT_DIRECTORY',
            'Publisher report directory'
        )
    );
    const matchingReports: Array<{
        report: ReturnType<typeof parsePublisherReportV1>;
        summary: ReturnType<typeof validateCandidatePublisherEvidence>;
    }> = [];
    const identity = {
        storyId: inputs.storyId,
        target: { kind: 'preview' as const, previewId: inputs.previewId },
        previewId: inputs.previewId,
        releaseId: inputs.releaseId,
        manifestSha256: inputs.manifestSha256,
        commitSha: inputs.candidateCommitSha,
        scenarioSha256: materialized.scenarioSha256,
    };

    for (const path of await listSafeJsonFiles(artifactDirectory)) {
        let report: ReturnType<typeof parsePublisherReportV1>;
        let summary: ReturnType<typeof validateCandidatePublisherEvidence>;
        try {
            report = parsePublisherReportV1(
                await readJson(path, 'Retained publisher report')
            );
            summary = validateCandidatePublisherEvidence(report, identity);
        } catch {
            continue;
        }
        matchingReports.push({ report, summary });
    }

    if (matchingReports.length !== 1) {
        throw new Error(
            'Retained publisher artifact must contain exactly one matching immutable candidate report'
        );
    }

    const match = matchingReports[0];
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await Promise.all([
        writeCanonicalJson(
            resolve(evidenceRoot, 'publisher-report.json'),
            match.report as unknown as JsonValue
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'publisher-candidate-validation.json'),
            {
                schemaVersion: 1,
                storyId: inputs.storyId,
                previewId: inputs.previewId,
                releaseId: inputs.releaseId,
                manifestSha256: inputs.manifestSha256,
                candidateCommitSha: inputs.candidateCommitSha,
                scenarioSha256: materialized.scenarioSha256,
                summary: match.summary,
            } as JsonValue
        ),
    ]);
}

async function loadCandidateSummary(
    inputs: ReleaseGateWorkflowInputs,
    materialized: MaterializedReleaseGateScenario
): Promise<ReturnType<typeof validateCandidatePublisherEvidence>> {
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const report = parsePublisherReportV1(
        await readJson(
            resolve(evidenceRoot, 'publisher-report.json'),
            'Publisher report'
        )
    );
    return validateCandidatePublisherEvidence(report, {
        storyId: inputs.storyId,
        target: { kind: 'preview', previewId: inputs.previewId },
        previewId: inputs.previewId,
        releaseId: inputs.releaseId,
        manifestSha256: inputs.manifestSha256,
        commitSha: inputs.candidateCommitSha,
        scenarioSha256: materialized.scenarioSha256,
    });
}

export function createWorkflowPublicVerificationInput(input: {
    mode: 'candidate' | 'active';
    storyId: string;
    previewId: string;
    assetBaseUrl: string;
    browserOrigin: string;
    releaseId: string;
    expectedManifestSha256: string;
    omittedIdentities: string[];
}): PublicReleaseVerificationInputV1 {
    return parsePublicReleaseVerificationInputV1({
        storyId: input.storyId,
        target:
            input.mode === 'candidate'
                ? { kind: 'production' }
                : { kind: 'preview', previewId: input.previewId },
        assetBaseUrl: input.assetBaseUrl,
        browserOrigin: input.browserOrigin,
        mode: input.mode,
        ...(input.mode === 'candidate'
            ? {
                  releaseId: input.releaseId,
                  expectedManifestSha256: input.expectedManifestSha256,
              }
            : {}),
        omittedIdentities: input.omittedIdentities,
    });
}

async function verifyPublicEvidence(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const mode = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_PUBLIC_MODE'
    );
    if (mode !== 'candidate' && mode !== 'active') {
        throw new Error(
            'Public release verification mode must be candidate or active'
        );
    }
    const materialized = await loadMaterializedContract(inputs);
    const attestation = await loadDeploymentAttestation(inputs, materialized);
    const summary = await loadCandidateSummary(inputs, materialized);
    const result = await verifyPublicRelease(
        createWorkflowPublicVerificationInput({
            mode,
            storyId: inputs.storyId,
            previewId: inputs.previewId,
            assetBaseUrl: inputs.assetBaseUrl,
            browserOrigin: attestation.deploymentUrl,
            releaseId: inputs.releaseId,
            expectedManifestSha256: inputs.manifestSha256,
            omittedIdentities: summary.omittedIdentities,
        })
    );
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await writeCanonicalJson(
        resolve(evidenceRoot, `public-${mode}.json`),
        result as JsonValue
    );
    if (result.status !== 'passed') {
        throw new Error(`Public ${mode} verification failed`);
    }
}

async function recordR2CandidateEvidence(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const reportPath = resolveRepositoryPath(
        requireSafeRelativeEnvironmentPath(
            environment,
            'RELEASE_GATE_R2_VERIFY_REPORT_PATH',
            'R2 verification report path'
        )
    );
    const report = parsePublisherReportV1(
        await readJson(reportPath, 'R2 verification report')
    );
    if (
        report.command !== 'verify' ||
        report.status !== 'success' ||
        report.target.kind !== 'production' ||
        report.storyId !== inputs.storyId ||
        report.releaseId !== inputs.releaseId ||
        report.manifestSha256 !== inputs.manifestSha256
    ) {
        throw new Error(
            'Deep R2 verification report does not match dispatch identity'
        );
    }
    await writeCanonicalJson(
        resolve(resolveRepositoryPath(EVIDENCE_DIRECTORY), 'r2-candidate.json'),
        {
            schemaVersion: 1,
            status: 'passed',
            depth: 'deep',
            storyId: inputs.storyId,
            target: { kind: 'production' },
            releaseId: inputs.releaseId,
            manifestSha256: inputs.manifestSha256,
        } as JsonValue
    );
}

function parsePointerSnapshot(
    value: unknown,
    inputs: ReleaseGateWorkflowInputs,
    label: string
): JsonValue {
    const snapshot = asRecord(value, label);
    if (
        snapshot.schemaVersion !== 1 ||
        snapshot.storyId !== inputs.storyId ||
        snapshot.previewId !== inputs.previewId ||
        !Object.hasOwn(snapshot, 'productionPointer')
    ) {
        throw new Error(`${label} does not match dispatch identity`);
    }
    return snapshot as JsonValue;
}

type ProductionPointerProofStatus = 'unchanged' | 'changed' | 'unproven';

async function writeProductionPointerProof(input: {
    status: ProductionPointerProofStatus;
    reason: string;
    inputs?: ReleaseGateWorkflowInputs;
}): Promise<void> {
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await writeCanonicalJson(
        resolve(evidenceRoot, 'production-pointer-proof.json'),
        {
            schemaVersion: 1,
            status: input.status,
            reason: input.reason,
            ...(input.inputs
                ? {
                      storyId: input.inputs.storyId,
                      previewId: input.inputs.previewId,
                      unchanged: input.status === 'unchanged',
                  }
                : {}),
        } as JsonValue
    );
}

/**
 * Install an unproven marker before the first credentialed pointer capture.
 * If a later stage aborts, the failure artifact remains explicit rather than
 * falsely implying that production was observed unchanged.
 */
async function initializeProductionPointerProof(): Promise<void> {
    await writeProductionPointerProof({
        status: 'unproven',
        reason: 'pointer-capture-not-complete',
    });
}

/**
 * This finalizer never reports an unproven capture as a positive proof and
 * deliberately avoids propagating capture errors. The following success-only
 * assertion turns a non-unchanged result into the job failure when no earlier
 * stage has already failed.
 */
async function finalizeProductionPointerProof(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    let inputs: ReleaseGateWorkflowInputs;
    try {
        inputs = workflowInputsFromEnvironment(environment);
    } catch {
        await writeProductionPointerProof({
            status: 'unproven',
            reason: 'validated-identity-unavailable',
        });
        return;
    }

    try {
        const beforePath = resolveRepositoryPath(
            requireSafeRelativeEnvironmentPath(
                environment,
                'RELEASE_GATE_POINTER_BEFORE_PATH',
                'Production pointer before path'
            )
        );
        const afterPath = resolveRepositoryPath(
            requireSafeRelativeEnvironmentPath(
                environment,
                'RELEASE_GATE_POINTER_AFTER_PATH',
                'Production pointer after path'
            )
        );
        const before = parsePointerSnapshot(
            await readJson(beforePath, 'Production pointer before snapshot'),
            inputs,
            'Production pointer before snapshot'
        );
        const after = parsePointerSnapshot(
            await readJson(afterPath, 'Production pointer after snapshot'),
            inputs,
            'Production pointer after snapshot'
        );
        const beforePointer = asRecord(
            before,
            'Production pointer before snapshot'
        ).productionPointer as JsonValue;
        const afterPointer = asRecord(
            after,
            'Production pointer after snapshot'
        ).productionPointer as JsonValue;
        const unchanged =
            canonicalJson(beforePointer) === canonicalJson(afterPointer);
        await Promise.all([
            writeCanonicalJson(
                resolve(
                    resolveRepositoryPath(EVIDENCE_DIRECTORY),
                    'production-pointer-before.json'
                ),
                before
            ),
            writeCanonicalJson(
                resolve(
                    resolveRepositoryPath(EVIDENCE_DIRECTORY),
                    'production-pointer-after.json'
                ),
                after
            ),
            writeProductionPointerProof({
                status: unchanged ? 'unchanged' : 'changed',
                reason: unchanged
                    ? 'matching-production-pointer-snapshots'
                    : 'production-pointer-values-differ',
                inputs,
            }),
        ]);
    } catch {
        await writeProductionPointerProof({
            status: 'unproven',
            reason: 'pointer-snapshot-unavailable',
            inputs,
        });
    }
}

async function requireProductionPointerProof(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const proof = asRecord(
        await readJson(
            resolve(evidenceRoot, 'production-pointer-proof.json'),
            'Production pointer proof'
        ),
        'Production pointer proof'
    );
    if (
        proof.schemaVersion !== 1 ||
        proof.status !== 'unchanged' ||
        proof.storyId !== inputs.storyId ||
        proof.previewId !== inputs.previewId ||
        proof.unchanged !== true
    ) {
        throw new Error(
            'A successful release gate requires a proven unchanged production pointer'
        );
    }
}

export function assertBrowserEvidenceDeployment(
    input: unknown,
    deploymentUrl: string
): BrowserEvidenceV1 {
    const browser = parseBrowserEvidenceV1(input);
    if (browser.webBaseUrl !== deploymentUrl) {
        throw new Error(
            'Browser evidence does not match the attested deployment origin'
        );
    }
    return browser;
}

async function extractWebIdentity(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const materialized = await loadMaterializedContract(inputs);
    const attestation = await loadDeploymentAttestation(inputs, materialized);
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const browser = assertBrowserEvidenceDeployment(
        await readJson(
            resolve(evidenceRoot, 'browser-evidence.json'),
            'Browser evidence'
        ),
        attestation.deploymentUrl
    );
    if (
        browser.status !== 'passed' ||
        browser.flow !== 'preview-release-gate' ||
        browser.storyId !== inputs.storyId ||
        browser.target.kind !== 'preview' ||
        browser.target.previewId !== inputs.previewId ||
        browser.releaseId !== inputs.releaseId ||
        browser.manifestSha256 !== inputs.manifestSha256 ||
        browser.scenarioSha256 !== materialized.scenarioSha256
    ) {
        throw new Error(
            'Browser evidence does not match the attested preview identity'
        );
    }
    const pointerUrls = new Set(
        browser.projects.map(project => project.requestPaths.pointerRequestUrl)
    );
    const manifestUrls = new Set(
        browser.projects.map(project => project.requestPaths.manifestRequestUrl)
    );
    if (
        pointerUrls.size !== 1 ||
        manifestUrls.size !== 1 ||
        pointerUrls.has(null) ||
        manifestUrls.has(null)
    ) {
        throw new Error(
            'Browser projects did not retain one settled web identity'
        );
    }
    const pointerRequestUrl = [...pointerUrls][0];
    const manifestRequestUrl = [...manifestUrls][0];
    if (
        typeof pointerRequestUrl !== 'string' ||
        typeof manifestRequestUrl !== 'string'
    ) {
        throw new Error('Browser projects did not retain valid request URLs');
    }
    const identity = parseWebIdentityEvidenceV1({
        schemaVersion: 1,
        target: 'preview',
        webBaseUrl: attestation.deploymentUrl,
        assetEnvironment: 'preview',
        previewId: inputs.previewId,
        releaseId: inputs.releaseId,
        manifestSha256: inputs.manifestSha256,
        pointerRequestUrl,
        manifestRequestUrl,
    });
    await writeCanonicalJson(
        resolve(evidenceRoot, 'web-identity.json'),
        identity as JsonValue
    );
}

async function validateManualReview(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'finalize') {
        throw new Error('Manual review validation is finalization-only');
    }
    const materialized = await loadMaterializedContract(inputs);
    const summary = await loadCandidateSummary(inputs, materialized);
    const review = parseVisualReviewRecordV1(
        await readJson(
            resolve(
                resolveRepositoryPath(EVIDENCE_DIRECTORY),
                'candidate-entry-manual-review.json'
            ),
            'Candidate entry manual review'
        )
    );
    if (
        review.decision !== 'approved' ||
        review.storyId !== inputs.storyId ||
        review.previewId !== inputs.previewId ||
        review.releaseId !== inputs.releaseId ||
        review.manifestSha256 !== inputs.manifestSha256 ||
        review.scenarioSha256 !== materialized.scenarioSha256 ||
        review.includedCount !== summary.includedCount ||
        review.omittedCount !== summary.omittedCount
    ) {
        throw new Error(
            'Manual review does not approve the exact release-gate identity'
        );
    }
    await writeCanonicalJson(
        resolve(
            resolveRepositoryPath(EVIDENCE_DIRECTORY),
            'manual-review.json'
        ),
        review as JsonValue
    );
}

async function writeWorkflowApproval(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const record = asRecord(environment, 'Workflow environment');
    const approval = parseWorkflowApprovalEvidenceV1({
        schemaVersion: 1,
        repository: requiredString(record, 'GITHUB_REPOSITORY'),
        workflowRef: requiredString(record, 'GITHUB_WORKFLOW_REF'),
        runId: Number(requiredString(record, 'GITHUB_RUN_ID')),
        runAttempt: Number(requiredString(record, 'GITHUB_RUN_ATTEMPT')),
        jobId: requiredString(record, 'GITHUB_JOB'),
        actor: requiredString(record, 'GITHUB_ACTOR'),
        environment: 'visual-novel-release-approval',
        conclusion: 'success',
    });
    await writeCanonicalJson(
        resolve(
            resolveRepositoryPath(EVIDENCE_DIRECTORY),
            'workflow-approval.json'
        ),
        approval as JsonValue
    );
}

async function recordStageTiming(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const record = asRecord(environment, 'Workflow environment');
    const stage = requiredString(record, 'RELEASE_GATE_STAGE_NAME');
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(stage)) {
        throw new Error('Release-gate stage name is invalid');
    }
    const status =
        optionalString(record, 'RELEASE_GATE_STAGE_STATUS') || 'unknown';
    if (
        !['success', 'failure', 'cancelled', 'skipped', 'unknown'].includes(
            status
        )
    ) {
        throw new Error('Release-gate stage status is invalid');
    }
    const startedAtNanoseconds = optionalString(
        record,
        'RELEASE_GATE_STAGE_STARTED_AT_NANOSECONDS'
    );
    const endedAtNanoseconds = process.hrtime.bigint();

    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const timingPath = resolve(evidenceRoot, 'stage-timings.json');
    let stages: JsonValue[] = [];

    let timingArtifactExists = false;
    try {
        await lstat(timingPath);
        timingArtifactExists = true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    if (timingArtifactExists) {
        const prior = asRecord(
            await readJson(timingPath, 'Stage timings'),
            'Stage timings'
        );
        if (prior.schemaVersion !== 1 || !Array.isArray(prior.stages)) {
            throw new Error('Stage timing artifact is invalid');
        }
        stages = prior.stages.map(value => {
            const timing = asRecord(value, 'Stage timing');
            const priorStage = requiredString(timing, 'stage');
            const priorStatus = optionalString(timing, 'status') || 'unknown';
            const timingStatus =
                optionalString(timing, 'timingStatus') || 'recorded';
            if (
                !/^[a-z][a-z0-9-]{0,63}$/.test(priorStage) ||
                ![
                    'success',
                    'failure',
                    'cancelled',
                    'skipped',
                    'unknown',
                ].includes(priorStatus) ||
                !['recorded', 'unavailable'].includes(timingStatus)
            ) {
                throw new Error('Stage timing artifact is invalid');
            }
            if (timingStatus === 'unavailable') {
                if (typeof timing.reason !== 'string') {
                    throw new Error('Stage timing artifact is invalid');
                }
                return {
                    stage: priorStage,
                    status: priorStatus,
                    timingStatus,
                    reason: timing.reason,
                } as JsonValue;
            }
            const priorStarted = requiredString(timing, 'startedAtNanoseconds');
            const priorEnded = requiredString(timing, 'endedAtNanoseconds');
            const priorElapsed = requiredString(timing, 'elapsedNanoseconds');
            if (
                !/^[1-9][0-9]*$/.test(priorStarted) ||
                !/^[1-9][0-9]*$/.test(priorEnded) ||
                !/^[0-9]+$/.test(priorElapsed) ||
                BigInt(priorEnded) < BigInt(priorStarted) ||
                BigInt(priorElapsed) !==
                    BigInt(priorEnded) - BigInt(priorStarted)
            ) {
                throw new Error('Stage timing artifact is invalid');
            }
            return {
                stage: priorStage,
                status: priorStatus,
                timingStatus,
                startedAtNanoseconds: priorStarted,
                endedAtNanoseconds: priorEnded,
                elapsedNanoseconds: priorElapsed,
            } as JsonValue;
        });
    }
    if (stages.some(entry => asRecord(entry, 'Stage timing').stage === stage)) {
        throw new Error('Release-gate stage timing already exists');
    }
    const timing: JsonValue = ((): JsonValue => {
        if (!/^[1-9][0-9]*$/.test(startedAtNanoseconds)) {
            return {
                stage,
                status,
                timingStatus: 'unavailable',
                reason: 'start-marker-unavailable',
            };
        }
        const started = BigInt(startedAtNanoseconds);
        if (endedAtNanoseconds < started) {
            return {
                stage,
                status,
                timingStatus: 'unavailable',
                reason: 'monotonic-clock-moved-backwards',
            };
        }
        return {
            stage,
            status,
            timingStatus: 'recorded',
            startedAtNanoseconds,
            endedAtNanoseconds: endedAtNanoseconds.toString(),
            elapsedNanoseconds: (endedAtNanoseconds - started).toString(),
        };
    })();
    stages.push(timing);
    await writeCanonicalJson(timingPath, {
        schemaVersion: 1,
        stages,
    } as JsonValue);
    const summaryPath = environment.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
        const renderedTiming = asRecord(timing, 'Stage timing');
        await appendFile(
            summaryPath,
            renderedTiming.timingStatus === 'recorded'
                ? `- ${stage}: ${renderedTiming.status} ${renderedTiming.elapsedNanoseconds}ns (monotonic)\n`
                : `- ${stage}: ${renderedTiming.status} timing unavailable (${renderedTiming.reason})\n`,
            'utf8'
        );
    }
}

async function main(argv: readonly string[]): Promise<void> {
    const command = argv[0];
    if (command === 'validate-inputs') {
        await emitValidatedInputs(
            workflowInputsFromEnvironment(process.env),
            process.env
        );
        return;
    }
    if (command === 'package-candidate-entry') {
        await packageCandidateEntry(process.env);
        return;
    }
    if (command === 'validate-upstream-candidate-entry') {
        await validateUpstreamCandidateEntry(process.env);
        return;
    }
    if (command === 'materialize-candidate-entry-manual-review') {
        await materializeCandidateEntryManualReview(process.env);
        return;
    }
    if (command === 'validate-trusted-workflow-context') {
        await validateTrustedWorkflowContext(process.env);
        return;
    }
    if (command === 'seal-candidate-artifact') {
        await sealCandidateArtifact(process.env);
        return;
    }
    if (command === 'inspect-raw-candidate-artifact') {
        await inspectRawCandidateArtifact(process.env);
        return;
    }
    if (command === 'ingest-sealed-candidate-artifact') {
        await ingestSealedCandidateArtifact(process.env);
        return;
    }
    if (command === 'verify-sealed-output') {
        await verifySealedOutput(process.env);
        return;
    }
    if (command === 'validate-prepare-provenance') {
        await validatePrepareProvenance(process.env);
        return;
    }
    if (command === 'validate-tier1-reuse') {
        await validateTier1Reuse(process.env);
        return;
    }
    if (command === 'validate-publisher-artifact-provenance') {
        await validatePublisherArtifactProvenance(process.env);
        return;
    }
    if (command === 'validate-vercel-preview-contract') {
        await validateVercelPreviewContract(process.env);
        return;
    }
    if (command === 'materialize-scenario') {
        await materializeFromBuild(process.env);
        return;
    }
    if (command === 'attest-deployment') {
        await attestDeployment(process.env);
        return;
    }
    if (command === 'validate-publisher-candidate') {
        await validatePublisherCandidate(process.env);
        return;
    }
    if (command === 'verify-public') {
        await verifyPublicEvidence(process.env);
        return;
    }
    if (command === 'record-r2-candidate') {
        await recordR2CandidateEvidence(process.env);
        return;
    }
    if (command === 'initialize-production-pointer-proof') {
        await initializeProductionPointerProof();
        return;
    }
    if (command === 'finalize-production-pointer-proof') {
        await finalizeProductionPointerProof(process.env);
        return;
    }
    if (command === 'require-production-pointer-proof') {
        await requireProductionPointerProof(process.env);
        return;
    }
    if (command === 'extract-web-identity') {
        await extractWebIdentity(process.env);
        return;
    }
    if (command === 'validate-manual-review') {
        await validateManualReview(process.env);
        return;
    }
    if (command === 'write-workflow-approval') {
        await writeWorkflowApproval(process.env);
        return;
    }
    if (command === 'record-stage-timing') {
        await recordStageTiming(process.env);
        return;
    }
    throw new Error(
        'Usage: release-gate-workflow-evidence.ts <validate-inputs|package-candidate-entry|validate-upstream-candidate-entry|materialize-candidate-entry-manual-review|validate-trusted-workflow-context|inspect-raw-candidate-artifact|seal-candidate-artifact|ingest-sealed-candidate-artifact|verify-sealed-output|validate-prepare-provenance|validate-tier1-reuse|validate-publisher-artifact-provenance|validate-vercel-preview-contract|materialize-scenario|attest-deployment|validate-publisher-candidate|verify-public|record-r2-candidate|initialize-production-pointer-proof|finalize-production-pointer-proof|require-production-pointer-proof|extract-web-identity|validate-manual-review|write-workflow-approval|record-stage-timing>'
    );
}

const isMainModule =
    (import.meta as ImportMeta & { main?: boolean }).main === true;

if (isMainModule) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`release-gate workflow evidence: ${message}\n`);
        process.exitCode = 2;
    }
}
