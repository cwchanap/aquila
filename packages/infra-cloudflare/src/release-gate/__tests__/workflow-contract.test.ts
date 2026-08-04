import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
    createDeploymentAttestation,
    parseReleaseGateTarV1,
    materializeReleaseGateScenario,
    parseVercelDeploymentStdout,
    parseReleaseGateWorkflowInputs,
    validateReleaseGateArtifactProvenance,
} from '../../../scripts/release-gate-workflow-evidence';
import {
    validGateScenario,
    validReleaseId,
} from '../__fixtures__/valid-evidence';

const WORKFLOW_PATH = fileURLToPath(
    new URL(
        '../../../../../.github/workflows/visual-novel-release-gate.yml',
        import.meta.url
    )
);

const CANDIDATE_COMMIT_SHA = 'f'.repeat(40);
const MANIFEST_SHA256 = 'a'.repeat(64);

const validInputs = {
    phase: 'prepare',
    candidateCommitSha: CANDIDATE_COMMIT_SHA,
    storyId: 'the_seventh_mirror',
    previewId: 'hpa-233',
    releaseId: validReleaseId,
    manifestSha256: MANIFEST_SHA256,
    publisherReportRunId: '123456',
    publisherReportArtifact: 'publisher-candidate',
    assetBaseUrl: 'https://assets.aquila.example',
    webBaseUrl: 'https://vercel.app',
    productionWebOrigin: 'https://aquila.example',
    scenarioPath:
        'packages/e2e/fixtures/visual-release-gates/hpa_233_fixture.v1.json',
    prepareRunId: '',
    manualReviewPath: '',
} as const;

const viteManifest = {
    'stories/trainAdventure/index.ts': {
        file: '_astro/train-adventure.js',
        src: 'stories/trainAdventure/index.ts',
        isDynamicEntry: true,
    },
    'stories/dontSaveMeBeforeMidnight/index.ts': {
        file: '_astro/dont-save-me-before-midnight.js',
        src: 'stories/dontSaveMeBeforeMidnight/index.ts',
        isDynamicEntry: true,
    },
    'stories/theSeventhMirror/index.ts': {
        file: '_astro/the-seventh-mirror.js',
        src: 'stories/theSeventhMirror/index.ts',
        isDynamicEntry: true,
    },
} as const;

const storyChunkModules = {
    schemaVersion: 1,
    chunks: {
        '_astro/train-adventure.js': [
            'packages/stories/src/stories/trainAdventure/index.ts',
        ],
        '_astro/dont-save-me-before-midnight.js': [
            'packages/stories/src/stories/dontSaveMeBeforeMidnight/index.ts',
        ],
        '_astro/the-seventh-mirror.js': [
            'packages/stories/src/stories/theSeventhMirror/index.ts',
        ],
    },
} as const;

function createTarEntry(
    path: string,
    contents: string,
    type = '0'
): Uint8Array {
    const header = new Uint8Array(512);
    const encoder = new TextEncoder();
    const write = (offset: number, length: number, value: string) => {
        header.set(encoder.encode(value).slice(0, length), offset);
    };
    write(0, 100, path);
    write(100, 8, '0000444\0');
    write(108, 8, '0000000\0');
    write(116, 8, '0000000\0');
    write(124, 12, `${contents.length.toString(8).padStart(11, '0')}\0`);
    write(136, 12, '00000000000\0');
    header.fill(0x20, 148, 156);
    write(156, 1, type);
    write(257, 6, 'ustar\0');
    write(263, 2, '00');
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    write(148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);

    const payload = encoder.encode(contents);
    const paddedLength = Math.ceil(payload.length / 512) * 512;
    const entry = new Uint8Array(512 + paddedLength);
    entry.set(header);
    entry.set(payload, 512);
    return entry;
}

function createTar(
    entries: Array<{ path: string; contents: string; type?: string }>
): Uint8Array {
    const encoded = entries.map(entry =>
        createTarEntry(entry.path, entry.contents, entry.type)
    );
    const total = encoded.reduce((sum, entry) => sum + entry.length, 1024);
    const archive = new Uint8Array(total);
    let offset = 0;
    for (const entry of encoded) {
        archive.set(entry, offset);
        offset += entry.length;
    }
    return archive;
}

describe('release-gate workflow evidence', () => {
    it('fails closed on unsafe dispatch input before checkout-dependent use', () => {
        expect(parseReleaseGateWorkflowInputs(validInputs)).toMatchObject({
            ...validInputs,
            phase: 'prepare',
        });
        expect(() =>
            parseReleaseGateWorkflowInputs({
                ...validInputs,
                scenarioPath: '../outside.json',
            })
        ).toThrow(/scenario path/i);
        expect(() =>
            parseReleaseGateWorkflowInputs({
                ...validInputs,
                phase: 'finalize',
                prepareRunId: '',
                manualReviewPath: '',
            })
        ).toThrow(/prepare run id/i);
    });

    it('materializes exact unrelated public chunk paths from the candidate Vite output before hashing', () => {
        const materialized = materializeReleaseGateScenario({
            scenario: validGateScenario,
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
            manifestSha256: MANIFEST_SHA256,
            viteManifest,
            storyChunkModules,
            buildOutputSha256: 'b'.repeat(64),
        });

        expect(materialized.scenario.unrelatedStoryChunks).toEqual([
            '/_astro/dont-save-me-before-midnight.js',
            '/_astro/train-adventure.js',
        ]);
        expect(materialized.scenarioSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(materialized.mapping).toMatchObject({
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
            manifestSha256: MANIFEST_SHA256,
            storyId: 'the_seventh_mirror',
        });
        expect(() =>
            materializeReleaseGateScenario({
                scenario: validGateScenario,
                candidateCommitSha: CANDIDATE_COMMIT_SHA,
                manifestSha256: MANIFEST_SHA256,
                viteManifest,
                storyChunkModules: {
                    ...storyChunkModules,
                    chunks: {
                        ...storyChunkModules.chunks,
                        '_astro/train-adventure.js': undefined,
                    },
                },
                buildOutputSha256: 'b'.repeat(64),
            })
        ).toThrow(/metadata/i);
    });

    it('uses code-point ordering for output mappings, including real Vercel path characters', () => {
        const materialized = materializeReleaseGateScenario({
            scenario: validGateScenario,
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
            manifestSha256: MANIFEST_SHA256,
            viteManifest: {
                ...viteManifest,
                'stories/trainAdventure/index.ts': {
                    ...viteManifest['stories/trainAdventure/index.ts'],
                    file: '_astro/index.g.js',
                },
                'stories/dontSaveMeBeforeMidnight/index.ts': {
                    ...viteManifest[
                        'stories/dontSaveMeBeforeMidnight/index.ts'
                    ],
                    file: '_astro/index.J.js',
                },
            },
            storyChunkModules: {
                schemaVersion: 1,
                chunks: {
                    '_astro/index.g.js': [
                        'packages/stories/src/stories/trainAdventure/index.ts',
                    ],
                    '_astro/index.J.js': [
                        'packages/stories/src/stories/dontSaveMeBeforeMidnight/index.ts',
                    ],
                    '_astro/the-seventh-mirror.js': [
                        'packages/stories/src/stories/theSeventhMirror/index.ts',
                    ],
                },
            },
            buildOutputSha256: 'b'.repeat(64),
        });

        expect(materialized.scenario.unrelatedStoryChunks).toEqual([
            '/_astro/index.J.js',
            '/_astro/index.g.js',
        ]);
        expect(
            parseReleaseGateTarV1(
                createTar([
                    {
                        path: 'vercel-output/functions/_render.func/apps/web/src/pages/[locale]/index.astro',
                        contents: 'safe Vercel output path',
                    },
                ])
            ).entries[0]?.path
        ).toContain('[locale]');
    });

    it('binds only the prebuilt deployment URL that satisfies the requested origin policy', () => {
        const materialized = materializeReleaseGateScenario({
            scenario: validGateScenario,
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
            manifestSha256: MANIFEST_SHA256,
            viteManifest,
            storyChunkModules,
            buildOutputSha256: 'b'.repeat(64),
        });
        const attestation = createDeploymentAttestation({
            materialized,
            deploymentUrl: 'https://aquila-abc123.vercel.app',
            requestedWebBaseUrl: 'https://vercel.app',
        });

        expect(attestation.deploymentUrl).toBe(
            'https://aquila-abc123.vercel.app'
        );
        expect(attestation.candidateCommitSha).toBe(CANDIDATE_COMMIT_SHA);
        expect(attestation.mappingSha256).toBe(materialized.mappingSha256);
        expect(() =>
            createDeploymentAttestation({
                materialized,
                deploymentUrl: 'https://other.example',
                requestedWebBaseUrl: 'https://vercel.app',
            })
        ).toThrow(/allowed origin/i);
    });

    it('rejects deployment CLI stdout injection before it can become a workflow output', () => {
        expect(
            parseVercelDeploymentStdout(
                'https://aquila-abc123.vercel.app\n',
                'https://vercel.app'
            )
        ).toBe('https://aquila-abc123.vercel.app');
        expect(() =>
            parseVercelDeploymentStdout(
                'https://aquila-abc123.vercel.app\nworkflow_output=forged\n',
                'https://vercel.app'
            )
        ).toThrow(/exactly one/i);
        expect(() =>
            parseVercelDeploymentStdout(
                '\u001b[31mhttps://aquila-abc123.vercel.app\u001b[0m\n',
                'https://vercel.app'
            )
        ).toThrow(/control|ansi/i);
    });

    it('rejects traversal, link, duplicate, and case-colliding archive entries before extraction', () => {
        expect(() =>
            parseReleaseGateTarV1(
                createTar([
                    {
                        path: 'vercel-output/static/.vite/manifest.json',
                        contents: '{}',
                    },
                    {
                        path: '../outside.json',
                        contents: '{}',
                    },
                ])
            )
        ).toThrow(/safe relative path|traversal/i);
        expect(() =>
            parseReleaseGateTarV1(
                createTar([
                    { path: 'vercel-output/link', contents: '', type: '2' },
                ])
            )
        ).toThrow(/regular files or directories/i);
        expect(() =>
            parseReleaseGateTarV1(
                createTar([
                    { path: 'vercel-output/entry.js', contents: 'one' },
                    { path: 'vercel-output/entry.js', contents: 'two' },
                ])
            )
        ).toThrow(/duplicate/i);
        expect(() =>
            parseReleaseGateTarV1(
                createTar([
                    { path: 'vercel-output/Entry.js', contents: 'one' },
                    { path: 'vercel-output/entry.js', contents: 'two' },
                ])
            )
        ).toThrow(/case-colliding/i);
    });

    it('accepts only a successful exact main prepare artifact provenance', () => {
        const provenance = {
            repository: 'aquila/example',
            workflowRef:
                'aquila/example/.github/workflows/visual-novel-release-gate.yml@refs/heads/main',
            workflowSha: 'b'.repeat(40),
            runId: '123',
            runAttempt: 1,
            jobName: 'seal-candidate',
            conclusion: 'success',
            phase: 'prepare',
            artifactId: '456',
            artifactName: 'visual-novel-sealed-candidate-123-1',
            artifactDigest: `sha256:${'c'.repeat(64)}`,
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
        } as const;
        expect(
            validateReleaseGateArtifactProvenance(provenance, {
                repository: 'aquila/example',
                candidateCommitSha: CANDIDATE_COMMIT_SHA,
                prepareRunId: '123',
            })
        ).toMatchObject({
            artifactId: '456',
            artifactDigest: `sha256:${'c'.repeat(64)}`,
        });
        expect(() =>
            validateReleaseGateArtifactProvenance(
                { ...provenance, conclusion: 'failure' },
                {
                    repository: 'aquila/example',
                    candidateCommitSha: CANDIDATE_COMMIT_SHA,
                    prepareRunId: '123',
                }
            )
        ).toThrow(/successful/i);
        expect(() =>
            validateReleaseGateArtifactProvenance(
                {
                    ...provenance,
                    workflowRef:
                        'aquila/example/.github/workflows/visual-novel-release-gate.yml@refs/heads/feature',
                },
                {
                    repository: 'aquila/example',
                    candidateCommitSha: CANDIDATE_COMMIT_SHA,
                    prepareRunId: '123',
                }
            )
        ).toThrow(/main/i);
    });
});

describe('visual-novel-release-gate workflow contract', () => {
    it('declares the exact phased protected interface without production mutation', () => {
        const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
            on: { workflow_dispatch: { inputs: Record<string, unknown> } };
            jobs: Record<string, Record<string, unknown>>;
        };
        const inputs = workflow.on.workflow_dispatch.inputs;

        expect(Object.keys(inputs)).toEqual([
            'phase',
            'candidate_commit_sha',
            'story_id',
            'preview_id',
            'release_id',
            'manifest_sha256',
            'publisher_report_run_id',
            'publisher_report_artifact',
            'asset_base_url',
            'web_base_url',
            'production_web_origin',
            'scenario_path',
            'prepare_run_id',
            'manual_review_path',
        ]);
        expect(
            (
                inputs.phase as {
                    options: string[];
                }
            ).options
        ).toEqual(['prepare', 'finalize']);
        expect(workflow.jobs['finalize-live']?.environment).toBe(
            'visual-novel-release-approval'
        );
        expect(JSON.stringify(workflow)).not.toContain('--confirm-production');
        expect(JSON.stringify(workflow)).not.toContain(
            'assets rollback --environment production'
        );
        expect(JSON.stringify(workflow)).not.toContain(
            'assets activate --environment production'
        );
    });

    it('seals the secretless candidate output before each trusted Vercel handoff', () => {
        const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
            jobs: Record<
                string,
                {
                    services?: Record<string, { image?: string }>;
                    steps?: Array<{
                        name?: string;
                        run?: string;
                        env?: unknown;
                    }>;
                }
            >;
        };

        const candidateJob = workflow.jobs['candidate-build']!;
        expect(candidateJob.services?.postgres?.image).toBe('postgres:16');
        const candidateSteps = candidateJob.steps ?? [];
        const candidateIndexOf = (name: string) =>
            candidateSteps.findIndex(step => step.name === name);
        expect(candidateIndexOf('Run database migrations')).toBeGreaterThan(-1);
        expect(candidateIndexOf('Run Tier 1')).toBeGreaterThan(
            candidateIndexOf('Run database migrations')
        );
        expect(candidateIndexOf('Checkout candidate')).toBeGreaterThan(
            candidateIndexOf('Validate dispatch inputs')
        );
        expect(
            candidateIndexOf('Build credential-free candidate output')
        ).toBeGreaterThan(candidateIndexOf('Run Tier 1'));
        expect(
            candidateIndexOf('Package raw candidate output')
        ).toBeGreaterThan(
            candidateIndexOf('Build credential-free candidate output')
        );

        for (const phase of ['prepare-live', 'finalize-live']) {
            const job = workflow.jobs[phase]!;
            expect(job.services?.postgres?.image).toBe('postgres:16');
            const steps = job.steps ?? [];
            const indexOf = (name: string) =>
                steps.findIndex(step => step.name === name);
            expect(indexOf('Run database migrations')).toBeGreaterThan(-1);
            expect(
                indexOf('Safely extract sealed candidate output')
            ).toBeGreaterThan(indexOf('Run database migrations'));
        }

        const sealerSteps = workflow.jobs['seal-candidate']!.steps ?? [];
        const indexOf = (name: string) =>
            sealerSteps.findIndex(step => step.name === name);
        expect(indexOf('Checkout trusted workflow source')).toBeGreaterThan(-1);
        expect(indexOf('Safely extract raw candidate output')).toBeGreaterThan(
            indexOf('Checkout trusted workflow source')
        );
        expect(indexOf('Seal candidate output')).toBeGreaterThan(
            indexOf('Safely extract raw candidate output')
        );

        const prepareSteps = workflow.jobs['prepare-live']!.steps ?? [];
        const prepareIndexOf = (name: string) =>
            prepareSteps.findIndex(step => step.name === name);
        expect(
            prepareIndexOf('Deploy the sealed prebuilt output')
        ).toBeGreaterThan(
            prepareIndexOf('Rehash sealed output immediately before deploy')
        );
        expect(
            prepareIndexOf('Attest prebuilt deployment binding')
        ).toBeGreaterThan(prepareIndexOf('Deploy the sealed prebuilt output'));
        expect(
            prepareIndexOf('Run remote browser release flow')
        ).toBeGreaterThan(prepareIndexOf('Attest prebuilt deployment binding'));

        const deploy =
            prepareSteps[prepareIndexOf('Deploy the sealed prebuilt output')]!;
        expect(deploy.run).toContain('vercel deploy --prebuilt');
        const browser =
            prepareSteps[prepareIndexOf('Run remote browser release flow')]!;
        expect(JSON.stringify(browser)).toContain(
            'steps.deployment-attestation.outputs.deployment_url'
        );
        expect(JSON.stringify(browser)).not.toContain('inputs.web_base_url');

        expect(deploy.run).toContain(
            '> "$RUNNER_TEMP/release-gate-vercel/deploy.stdout"'
        );
        expect(deploy.run).not.toContain('GITHUB_OUTPUT');
    });

    it('uses only validated outputs in shell work, reuses Tier 1 only under an exact match, and retains safe failure evidence', () => {
        const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
            jobs: Record<
                string,
                {
                    steps?: Array<{
                        id?: string;
                        if?: string;
                        name?: string;
                        run?: string;
                        with?: Record<string, unknown>;
                    }>;
                }
            >;
        };
        const allSteps = Object.values(workflow.jobs).flatMap(
            job => job.steps ?? []
        );
        for (const step of allSteps) {
            expect(step.run ?? '').not.toMatch(/\$\{\{\s*inputs\./);
        }

        const finalizeSteps = workflow.jobs['finalize-live']!.steps ?? [];
        const byName = (name: string) =>
            finalizeSteps.find(step => step.name === name);
        const provenance = byName('Resolve exact prepare artifact provenance');
        expect(provenance?.run).toContain('validate-prepare-provenance');
        const publisher = byName(
            'Resolve retained publisher artifact provenance'
        );
        expect(publisher?.run).toContain(
            'validate-publisher-artifact-provenance'
        );
        const candidate = workflow.jobs['candidate-build']!.steps ?? [];
        const tier1 = candidate.find(step => step.name === 'Run Tier 1');
        expect(tier1?.run).toContain(
            '--evidence .release-gate/evidence/tier1.json'
        );
        expect(JSON.stringify(finalizeSteps)).not.toContain('Run Tier 1');
        expect(JSON.stringify(finalizeSteps)).not.toContain(
            'validate-tier1-reuse'
        );

        const uploads = allSteps.filter(step =>
            step.name?.startsWith('Upload ')
        );
        expect(uploads.length).toBeGreaterThanOrEqual(2);
        for (const upload of uploads) {
            expect(upload.if).toBe('${{ always() }}');
            const paths = String(upload.with?.path ?? '');
            expect(paths).not.toContain('.vercel');
            expect(paths).not.toContain('node_modules');
            expect(paths).not.toContain('.env');
        }
    });

    it('keeps candidate code secretless and admits only a sealed, rehashed output to protected live lanes', () => {
        const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
            concurrency?: Record<string, unknown>;
            jobs: Record<
                string,
                {
                    environment?: string;
                    permissions?: Record<string, string>;
                    steps?: Array<{
                        id?: string;
                        if?: string;
                        name?: string;
                        run?: string;
                        uses?: string;
                        with?: Record<string, unknown>;
                    }>;
                }
            >;
        };
        const candidate = workflow.jobs['candidate-build'];
        const sealer = workflow.jobs['seal-candidate'];
        const prepare = workflow.jobs['prepare-live'];
        const finalize = workflow.jobs['finalize-live'];

        expect(candidate?.environment).toBeUndefined();
        expect(candidate?.permissions).toEqual({ contents: 'read' });
        expect(JSON.stringify(candidate)).not.toContain('secrets.');
        expect(JSON.stringify(candidate)).not.toContain('vercel pull');
        expect(sealer?.permissions).toMatchObject({
            'id-token': 'write',
            attestations: 'write',
            'artifact-metadata': 'write',
        });
        expect(prepare?.environment).toBe('visual-novel-release-preview');
        expect(finalize?.environment).toBe('visual-novel-release-approval');
        expect(workflow.concurrency?.['cancel-in-progress']).toBe(false);

        for (const job of [prepare, finalize]) {
            const steps = job?.steps ?? [];
            const sealedExtraction = steps.find(
                step => step.name === 'Safely extract sealed candidate output'
            );
            expect(JSON.stringify(sealedExtraction)).toContain(
                'RELEASE_GATE_SEALED_PRODUCER_WORKFLOW_SHA'
            );
            expect(JSON.stringify(sealedExtraction)).toContain(
                'RELEASE_GATE_SEALED_PRODUCER_RUN_ID'
            );
            expect(JSON.stringify(sealedExtraction)).toContain(
                'RELEASE_GATE_SEALED_PRODUCER_RUN_ATTEMPT'
            );
            if (job === finalize) {
                expect(JSON.stringify(sealedExtraction)).toContain(
                    'steps.prepare-provenance.outputs.sealed_producer_workflow_sha'
                );
            }
            expect(
                steps.some(
                    step =>
                        step.name ===
                        'Rehash sealed output immediately before deploy'
                )
            ).toBe(true);
            expect(
                steps.some(
                    step =>
                        step.name ===
                        'Rehash sealed output immediately after deploy'
                )
            ).toBe(true);
            const diagnostics = steps.find(
                step => step.name === 'Finalize live failure diagnostics'
            );
            expect(diagnostics?.if).toBe('${{ always() }}');
            expect(JSON.stringify(job)).not.toContain('Checkout candidate');
        }
    });
});
