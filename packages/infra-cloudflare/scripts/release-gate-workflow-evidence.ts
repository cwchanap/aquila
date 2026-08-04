import { createHash } from 'node:crypto';
import {
    appendFile,
    lstat,
    mkdir,
    readFile,
    readdir,
    writeFile,
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
    parseTier1EvidenceV1,
    parseVisualNovelGateScenarioV1,
    parseVisualReviewRecordV1,
    parseWebIdentityEvidenceV1,
    parseWorkflowApprovalEvidenceV1,
    type Tier1EvidenceV1,
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
const VITE_MANIFEST_PATH = 'apps/web/dist/client/.vite/manifest.json';
const STORY_CHUNK_METADATA_PATH =
    'apps/web/dist/client/.vite/story-chunk-modules.json';
const VERCEL_OUTPUT_PATH = 'apps/web/.vercel/output';
const CANDIDATE_COMMIT_SHA_RE = /^[a-f0-9]{40}$/;
const POSITIVE_INTEGER_RE = /^[1-9][0-9]*$/;
const ARTIFACT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

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

type Tier1ArtifactRecordV1 = {
    schemaVersion: 1;
    mode: 'prepared' | 'reused' | 'rerun';
    candidateCommitSha: string;
    tier1ArtifactSha256: string;
    tier1: Tier1EvidenceV1;
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
        .sort((left, right) => left.localeCompare(right));
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

async function hashDirectory(directory: string): Promise<string> {
    const root = resolve(directory);
    const files: Array<{ path: string; sha256: string }> = [];

    const visit = async (current: string): Promise<void> => {
        const entries = await readdir(current, { withFileTypes: true });
        for (const entry of entries.sort((left, right) =>
            left.name.localeCompare(right.name)
        )) {
            const path = resolve(current, entry.name);
            const stat = await lstat(path);
            if (stat.isSymbolicLink()) {
                throw new Error(
                    'Prebuilt output must not contain symbolic links'
                );
            }
            if (stat.isDirectory()) {
                await visit(path);
                continue;
            }
            if (!stat.isFile()) {
                throw new Error(
                    'Prebuilt output contains an unsupported filesystem entry'
                );
            }
            const relativePath = relative(root, path).split(sep).join('/');
            if (!isSafeRelativePath(relativePath)) {
                throw new Error('Prebuilt output contains an unsafe path');
            }
            files.push({
                path: relativePath,
                sha256: sha256(await readFile(path)),
            });
        }
    };

    await visit(root);
    if (files.length === 0) {
        throw new Error('Prebuilt output must contain files');
    }
    return canonicalSha256(files as JsonValue);
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

async function readJson(path: string, label: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch {
        throw new Error(`${label} could not be read as JSON`);
    }
}

async function writeCanonicalJson(
    path: string,
    value: JsonValue
): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${canonicalJson(value)}\n`, 'utf8');
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
        .sort((left, right) => left.localeCompare(right));
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
    const deploymentUrl = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_DEPLOYMENT_URL'
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
    const files: string[] = [];

    const visit = async (directory: string): Promise<void> => {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries.sort((left, right) =>
            left.name.localeCompare(right.name)
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
            if (!stat.isFile()) {
                throw new Error(
                    'Retained publisher artifact contains an unsupported filesystem entry'
                );
            }
            const relativePath = relative(root, path).split(sep).join('/');
            if (!isSafeRelativePath(relativePath)) {
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
    const result = await verifyPublicRelease({
        storyId: inputs.storyId,
        target:
            mode === 'candidate'
                ? { kind: 'production' }
                : { kind: 'preview', previewId: inputs.previewId },
        assetBaseUrl: inputs.assetBaseUrl,
        browserOrigin: attestation.deploymentUrl,
        mode,
        ...(mode === 'candidate'
            ? {
                  releaseId: inputs.releaseId,
                  expectedManifestSha256: inputs.manifestSha256,
              }
            : {}),
        omittedIdentities: summary.omittedIdentities,
    });
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

async function proveProductionPointerUnchanged(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
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
    const beforePointer = asRecord(before, 'Production pointer before snapshot')
        .productionPointer as JsonValue;
    const afterPointer = asRecord(after, 'Production pointer after snapshot')
        .productionPointer as JsonValue;
    if (canonicalJson(beforePointer) !== canonicalJson(afterPointer)) {
        throw new Error('Production pointer changed during the release gate');
    }
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    await Promise.all([
        writeCanonicalJson(
            resolve(evidenceRoot, 'production-pointer-before.json'),
            before
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'production-pointer-after.json'),
            after
        ),
        writeCanonicalJson(
            resolve(evidenceRoot, 'production-pointer-proof.json'),
            {
                schemaVersion: 1,
                storyId: inputs.storyId,
                previewId: inputs.previewId,
                unchanged: true,
            } as JsonValue
        ),
    ]);
}

async function extractWebIdentity(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const materialized = await loadMaterializedContract(inputs);
    const attestation = await loadDeploymentAttestation(inputs, materialized);
    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const browser = parseBrowserEvidenceV1(
        await readJson(
            resolve(evidenceRoot, 'browser-evidence.json'),
            'Browser evidence'
        )
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
    const reviewPath = resolveRepositoryPath(inputs.manualReviewPath);
    const review = parseVisualReviewRecordV1(
        await readJson(reviewPath, 'Manual review record')
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
    const startedAtUnixSeconds = Number(
        requiredString(record, 'RELEASE_GATE_STAGE_STARTED_AT')
    );
    const endedAtUnixSeconds = Number(
        requiredString(record, 'RELEASE_GATE_STAGE_ENDED_AT')
    );
    if (
        !Number.isSafeInteger(startedAtUnixSeconds) ||
        !Number.isSafeInteger(endedAtUnixSeconds) ||
        startedAtUnixSeconds <= 0 ||
        endedAtUnixSeconds < startedAtUnixSeconds
    ) {
        throw new Error('Release-gate stage timing is invalid');
    }

    const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
    const timingPath = resolve(evidenceRoot, 'stage-timings.json');
    let stages: Array<{
        stage: string;
        startedAtUnixSeconds: number;
        endedAtUnixSeconds: number;
        elapsedSeconds: number;
    }> = [];

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
            const priorStarted = timing.startedAtUnixSeconds;
            const priorEnded = timing.endedAtUnixSeconds;
            const priorElapsed = timing.elapsedSeconds;
            if (
                !/^[a-z][a-z0-9-]{0,63}$/.test(priorStage) ||
                typeof priorStarted !== 'number' ||
                typeof priorEnded !== 'number' ||
                typeof priorElapsed !== 'number' ||
                !Number.isSafeInteger(priorStarted) ||
                !Number.isSafeInteger(priorEnded) ||
                !Number.isSafeInteger(priorElapsed) ||
                priorStarted <= 0 ||
                priorEnded < priorStarted ||
                priorElapsed !== priorEnded - priorStarted
            ) {
                throw new Error('Stage timing artifact is invalid');
            }
            return {
                stage: priorStage,
                startedAtUnixSeconds: priorStarted,
                endedAtUnixSeconds: priorEnded,
                elapsedSeconds: priorElapsed,
            };
        });
    }
    if (stages.some(entry => entry.stage === stage)) {
        throw new Error('Release-gate stage timing already exists');
    }
    const timing = {
        stage,
        startedAtUnixSeconds,
        endedAtUnixSeconds,
        elapsedSeconds: endedAtUnixSeconds - startedAtUnixSeconds,
    };
    stages.push(timing);
    await writeCanonicalJson(timingPath, {
        schemaVersion: 1,
        stages,
    } as JsonValue);
    const summaryPath = environment.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
        await appendFile(
            summaryPath,
            `- ${stage}: ${timing.elapsedSeconds}s\n`,
            'utf8'
        );
    }
}

async function currentTier1Runtime(): Promise<{
    lockfileSha256: string;
    bunVersion: string;
    nodeVersion: string;
    playwrightVersion: string;
}> {
    const [lockfile, playwrightPackage] = await Promise.all([
        readFile(resolve(REPOSITORY_ROOT, 'bun.lock')),
        readFile(
            resolve(
                REPOSITORY_ROOT,
                'node_modules/@playwright/test/package.json'
            ),
            'utf8'
        ),
    ]);
    const parsedPackage = asRecord(
        JSON.parse(playwrightPackage) as unknown,
        'Playwright package metadata'
    );
    const playwrightVersion = requiredString(parsedPackage, 'version');
    const bunVersion = (process.versions as Record<string, string | undefined>)
        .bun;
    if (!bunVersion) {
        throw new Error('Tier 1 artifact validation must run under Bun');
    }
    return {
        lockfileSha256: sha256(lockfile),
        bunVersion,
        nodeVersion: process.version,
        playwrightVersion,
    };
}

function parseTier1ArtifactRecord(value: unknown): Tier1ArtifactRecordV1 {
    const record = asRecord(value, 'Tier 1 reuse record');
    const mode = requiredString(record, 'mode');
    if (mode !== 'prepared' && mode !== 'reused' && mode !== 'rerun') {
        throw new Error('Tier 1 reuse record mode is invalid');
    }
    const candidateCommitSha = requiredString(record, 'candidateCommitSha');
    const tier1ArtifactSha256 = requiredString(record, 'tier1ArtifactSha256');
    if (
        record.schemaVersion !== 1 ||
        !CANDIDATE_COMMIT_SHA_RE.test(candidateCommitSha) ||
        !isSha256(tier1ArtifactSha256)
    ) {
        throw new Error('Tier 1 reuse record is invalid');
    }
    return {
        schemaVersion: 1,
        mode,
        candidateCommitSha,
        tier1ArtifactSha256,
        tier1: parseTier1EvidenceV1(record.tier1),
    };
}

function tier1ReuseMismatch(
    record: Tier1ArtifactRecordV1,
    tier1Bytes: Uint8Array,
    inputs: ReleaseGateWorkflowInputs,
    runtime: Awaited<ReturnType<typeof currentTier1Runtime>>
): string | undefined {
    const tier1 = parseTier1EvidenceV1(
        JSON.parse(new TextDecoder().decode(tier1Bytes)) as unknown
    );
    if (record.mode !== 'prepared') return 'prepare-mode';
    if (record.candidateCommitSha !== inputs.candidateCommitSha) {
        return 'candidate-commit';
    }
    if (record.tier1ArtifactSha256 !== sha256(tier1Bytes)) {
        return 'artifact-digest';
    }
    if (
        canonicalJson(record.tier1 as JsonValue) !==
        canonicalJson(tier1 as JsonValue)
    ) {
        return 'evidence-content';
    }
    if (tier1.commitSha !== inputs.candidateCommitSha) return 'tier1-commit';
    if (tier1.lockfileSha256 !== runtime.lockfileSha256) return 'lockfile';
    if (tier1.bunVersion !== runtime.bunVersion) return 'bun-version';
    if (tier1.nodeVersion !== runtime.nodeVersion) return 'node-version';
    if (tier1.playwrightVersion !== runtime.playwrightVersion) {
        return 'playwright-version';
    }
    if (tier1.commandSetVersion !== 1) return 'command-set';
    if (
        tier1.browserMatrix[0] !== 'chromium' ||
        tier1.browserMatrix[1] !== 'mobile-chrome' ||
        tier1.status !== 'passed'
    ) {
        return 'browser-matrix-or-status';
    }
    return undefined;
}

async function recordTier1Artifact(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    const mode = optionalString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_TIER1_MODE'
    );
    if (mode !== 'prepared' && mode !== 'reused' && mode !== 'rerun') {
        throw new Error(
            'RELEASE_GATE_TIER1_MODE must be prepared, reused, or rerun'
        );
    }
    const evidencePath = resolveRepositoryPath(
        `${EVIDENCE_DIRECTORY}/tier1.json`
    );
    const bytes = await readFile(evidencePath);
    const tier1 = parseTier1EvidenceV1(
        JSON.parse(new TextDecoder().decode(bytes)) as unknown
    );
    const runtime = await currentTier1Runtime();
    const mismatch = tier1ReuseMismatch(
        {
            schemaVersion: 1,
            mode: 'prepared',
            candidateCommitSha: inputs.candidateCommitSha,
            tier1ArtifactSha256: sha256(bytes),
            tier1,
        },
        bytes,
        inputs,
        runtime
    );
    if (mismatch !== undefined) {
        throw new Error(
            `Fresh Tier 1 evidence does not bind this run: ${mismatch}`
        );
    }
    await writeCanonicalJson(
        resolve(resolveRepositoryPath(EVIDENCE_DIRECTORY), 'tier1-reuse.json'),
        {
            schemaVersion: 1,
            mode,
            candidateCommitSha: inputs.candidateCommitSha,
            tier1ArtifactSha256: sha256(bytes),
            tier1,
        } as JsonValue
    );
}

async function readPrepareTier1Artifact(root: string): Promise<{
    tier1Bytes: Uint8Array;
    record: unknown;
}> {
    // upload-artifact may preserve the submitted evidence directory or strip
    // its common prefix. Accept only these documented layouts, and reject an
    // ambiguous artifact rather than selecting a convenient file.
    const layouts = [
        root,
        resolve(root, 'evidence'),
        resolve(root, '.release-gate/evidence'),
    ];
    const matches: Array<{ tier1Bytes: Uint8Array; record: unknown }> = [];
    for (const directory of layouts) {
        try {
            const [tier1Bytes, record] = await Promise.all([
                readFile(resolve(directory, 'tier1.json')),
                readJson(
                    resolve(directory, 'tier1-reuse.json'),
                    'Tier 1 reuse record'
                ),
            ]);
            matches.push({ tier1Bytes, record });
        } catch {
            // The caller treats a missing layout as a rerun condition.
        }
    }
    if (matches.length !== 1) {
        throw new Error(
            'Prepare artifact has no unique Tier 1 evidence layout'
        );
    }
    return matches[0];
}

async function validateTier1Reuse(
    environment: Readonly<Record<string, string | undefined>>
): Promise<void> {
    const inputs = workflowInputsFromEnvironment(environment);
    if (inputs.phase !== 'finalize') {
        throw new Error('Tier 1 reuse validation is finalization-only');
    }
    const prepareDirectory = requiredString(
        asRecord(environment, 'Workflow environment'),
        'RELEASE_GATE_PREPARE_EVIDENCE_DIRECTORY'
    );
    const root = resolve(prepareDirectory);
    let reusable = false;
    let reason = 'prepare-evidence-unavailable';
    try {
        const [{ tier1Bytes, record }, runtime] = await Promise.all([
            readPrepareTier1Artifact(root),
            currentTier1Runtime(),
        ]);
        const mismatch = tier1ReuseMismatch(
            parseTier1ArtifactRecord(record),
            tier1Bytes,
            inputs,
            runtime
        );
        if (mismatch === undefined) {
            const evidenceRoot = resolveRepositoryPath(EVIDENCE_DIRECTORY);
            await mkdir(evidenceRoot, { recursive: true });
            await writeFile(resolve(evidenceRoot, 'tier1.json'), tier1Bytes);
            reusable = true;
            reason = 'exact-match';
        } else {
            reason = mismatch;
        }
    } catch {
        // A malformed, unavailable, or tampered prepare artifact is never
        // trusted. The workflow reruns Tier 1 rather than fabricating reuse.
        reusable = false;
        reason = 'prepare-evidence-unavailable';
    }
    await appendOutput(environment, 'reusable', reusable ? 'true' : 'false');
    await appendOutput(environment, 'reuse_reason', reason);
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
    if (command === 'prove-production-pointer-unchanged') {
        await proveProductionPointerUnchanged(process.env);
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
    if (command === 'record-tier1-artifact') {
        await recordTier1Artifact(process.env);
        return;
    }
    if (command === 'validate-tier1-reuse') {
        await validateTier1Reuse(process.env);
        return;
    }
    throw new Error(
        'Usage: release-gate-workflow-evidence.ts <validate-inputs|materialize-scenario|attest-deployment|validate-publisher-candidate|verify-public|record-r2-candidate|prove-production-pointer-unchanged|extract-web-identity|validate-manual-review|write-workflow-approval|record-stage-timing|record-tier1-artifact|validate-tier1-reuse>'
    );
}

if (import.meta.main) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`release-gate workflow evidence: ${message}\n`);
        process.exitCode = 2;
    }
}
