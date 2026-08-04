import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
    createDeploymentAttestation,
    materializeReleaseGateScenario,
    parseReleaseGateWorkflowInputs,
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
        expect(workflow.jobs.finalize?.environment).toBe(
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

    it('uses one validated same-build Vercel handoff before scenario hashing and browser execution', () => {
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

        for (const phase of ['prepare', 'finalize']) {
            const job = workflow.jobs[phase]!;
            expect(job.services?.postgres?.image).toBe('postgres:16');
            const steps = job.steps ?? [];
            const indexOf = (name: string) =>
                steps.findIndex(step => step.name === name);
            expect(indexOf('Run database migrations')).toBeGreaterThan(-1);
            expect(indexOf('Run Tier 1')).toBeGreaterThan(
                indexOf('Run database migrations')
            );
        }

        const prepareSteps = workflow.jobs.prepare!.steps ?? [];
        const indexOf = (name: string) =>
            prepareSteps.findIndex(step => step.name === name);
        expect(indexOf('Validate dispatch inputs')).toBeGreaterThan(-1);
        expect(indexOf('Checkout candidate')).toBeGreaterThan(
            indexOf('Validate dispatch inputs')
        );
        expect(indexOf('Build Vercel preview output')).toBeGreaterThan(
            indexOf('Checkout candidate')
        );
        expect(indexOf('Materialize same-build story chunks')).toBeGreaterThan(
            indexOf('Build Vercel preview output')
        );
        expect(indexOf('Deploy the same prebuilt output')).toBeGreaterThan(
            indexOf('Materialize same-build story chunks')
        );
        expect(indexOf('Attest prebuilt deployment binding')).toBeGreaterThan(
            indexOf('Deploy the same prebuilt output')
        );
        expect(indexOf('Run remote browser release flow')).toBeGreaterThan(
            indexOf('Attest prebuilt deployment binding')
        );

        const deploy =
            prepareSteps[indexOf('Deploy the same prebuilt output')]!;
        expect(deploy.run).toContain('vercel deploy --prebuilt');
        const browser =
            prepareSteps[indexOf('Run remote browser release flow')]!;
        expect(JSON.stringify(browser)).toContain(
            'steps.deploy-preview.outputs.deployment_url'
        );
        expect(JSON.stringify(browser)).not.toContain('inputs.web_base_url');
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

        const finalizeSteps = workflow.jobs.finalize!.steps ?? [];
        const byName = (name: string) =>
            finalizeSteps.find(step => step.name === name);
        const reuse = byName('Validate retained Tier 1 reuse');
        expect(reuse?.run).toContain('validate-tier1-reuse');
        expect(reuse?.run).toContain('tier1-reuse.json');
        const tier1 = byName('Run Tier 1');
        expect(tier1?.if).toContain("reusable != 'true'");
        expect(tier1?.run).toContain(
            '--evidence .release-gate/evidence/tier1.json'
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
});
