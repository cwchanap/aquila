import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
    parseReleaseGateTarV1,
    parseReleaseGateWorkflowInputs,
    parseVercelDeploymentStdout,
    validateReleaseGateArtifactProvenance,
} from '../../../scripts/release-gate-workflow-evidence';
import { validReleaseId } from '../__fixtures__/valid-evidence';

const ENTRY_WORKFLOW_PATH = fileURLToPath(
    new URL(
        '../../../../../.github/workflows/visual-novel-release-gate.yml',
        import.meta.url
    )
);
const LIVE_WORKFLOW_PATH = fileURLToPath(
    new URL(
        '../../../../../.github/workflows/visual-novel-release-live.yml',
        import.meta.url
    )
);
const HELPER_PATH = fileURLToPath(
    new URL(
        '../../../scripts/release-gate-workflow-evidence.ts',
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

type WorkflowStep = {
    env?: Record<string, unknown>;
    id?: string;
    if?: string;
    name?: string;
    run?: string;
    uses?: string;
    with?: Record<string, unknown>;
};

type WorkflowJob = {
    environment?: string;
    if?: string;
    permissions?: Record<string, string>;
    services?: Record<string, { image?: string }>;
    steps?: WorkflowStep[];
};

type Workflow = {
    concurrency?: Record<string, unknown>;
    on: Record<string, unknown>;
    permissions?: Record<string, string>;
    jobs: Record<string, WorkflowJob>;
};

function loadWorkflow(path: string): Workflow {
    return parse(readFileSync(path, 'utf8')) as Workflow;
}

function byName(job: WorkflowJob, name: string): WorkflowStep | undefined {
    return job.steps?.find(step => step.name === name);
}

describe('release-gate workflow evidence', () => {
    it('fails closed on unsafe dispatch input before checkout-dependent use', () => {
        expect(parseReleaseGateWorkflowInputs(validInputs)).toMatchObject(
            validInputs
        );
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

    it('rejects unsafe archive entries and deployment-output injection', () => {
        const header = new Uint8Array(512);
        const encoder = new TextEncoder();
        header.set(encoder.encode('../outside.json'));
        header.set(encoder.encode('0000444\0'), 100);
        header.set(encoder.encode('0000000\0'), 108);
        header.set(encoder.encode('0000000\0'), 116);
        header.set(encoder.encode('00000000002\0'), 124);
        header.set(encoder.encode('00000000000\0'), 136);
        header.fill(0x20, 148, 156);
        header.set(encoder.encode('0'), 156);
        header.set(encoder.encode('ustar\0'), 257);
        header.set(encoder.encode('00'), 263);
        const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
        header.set(
            encoder.encode(`${checksum.toString(8).padStart(6, '0')}\0 `),
            148
        );
        const archive = new Uint8Array(512 + 512 + 1024);
        archive.set(header);
        archive.set(encoder.encode('{}'), 512);
        expect(() => parseReleaseGateTarV1(archive)).toThrow(/safe|traversal/i);
        expect(() =>
            parseVercelDeploymentStdout(
                'https://aquila-abc123.vercel.app\nworkflow_output=forged\n',
                'https://vercel.app'
            )
        ).toThrow(/exactly one/i);
    });

    it('accepts only a successful exact main live prepare artifact', () => {
        const provenance = {
            repository: 'aquila/example',
            workflowRef:
                'aquila/example/.github/workflows/visual-novel-release-live.yml@refs/heads/main',
            workflowSha: 'b'.repeat(40),
            runId: '123',
            runAttempt: 1,
            jobName: 'seal-candidate',
            conclusion: 'success',
            phase: 'prepare',
            artifactId: '456',
            artifactName: 'visual-novel-sealed-candidate-123-1',
            artifactDigest: 'c'.repeat(64),
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
        };
        const expected = {
            repository: 'aquila/example',
            candidateCommitSha: CANDIDATE_COMMIT_SHA,
            prepareRunId: '123',
        };

        expect(
            validateReleaseGateArtifactProvenance(provenance, expected)
        ).toMatchObject({ artifactDigest: `sha256:${'c'.repeat(64)}` });
        expect(
            validateReleaseGateArtifactProvenance(
                {
                    ...provenance,
                    workflowRef:
                        '.github/workflows/visual-novel-release-live.yml@main',
                },
                expected
            )
        ).toMatchObject({ runId: '123' });
        expect(() =>
            validateReleaseGateArtifactProvenance(
                {
                    ...provenance,
                    workflowRef:
                        'aquila/example/.github/workflows/visual-novel-release-gate.yml@refs/heads/main',
                },
                expected
            )
        ).toThrow(/main/i);
    });
});

describe('visual-novel release trust-boundary workflow contract', () => {
    it('keeps the branch-selected dispatch entry unprivileged and moves authority to default-branch workflow_run', () => {
        const entry = loadWorkflow(ENTRY_WORKFLOW_PATH);
        const live = loadWorkflow(LIVE_WORKFLOW_PATH);
        const dispatch = entry.on.workflow_dispatch as {
            inputs: Record<string, unknown>;
        };
        const workflowRun = live.on.workflow_run as {
            branches?: string[];
            types?: string[];
            workflows?: string[];
        };

        expect(Object.keys(dispatch.inputs)).toEqual([
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
        expect(entry.permissions).toEqual({ contents: 'read' });
        expect(entry.jobs['candidate-build']?.environment).toBeUndefined();
        expect(entry.jobs['candidate-build']?.permissions).toEqual({
            contents: 'read',
        });
        expect(JSON.stringify(entry)).not.toContain('secrets.');
        expect(JSON.stringify(entry)).not.toContain('id-token');
        expect(JSON.stringify(entry)).not.toContain('attestations');
        expect(JSON.stringify(entry)).not.toContain('artifact-metadata');

        expect(live.on.workflow_dispatch).toBeUndefined();
        expect(workflowRun).toMatchObject({
            workflows: ['Visual Novel Release Candidate Entry'],
            types: ['completed'],
            branches: ['main'],
        });
        expect(live.concurrency?.['cancel-in-progress']).toBe(false);
        const upstream = live.jobs['entry-provenance']!;
        expect(upstream.if).toContain('github.event.workflow_run.conclusion');
        expect(upstream.if).toContain(
            "github.event.workflow_run.head_branch == 'main'"
        );
        const download = byName(
            upstream,
            'Download exact candidate entry artifact'
        );
        expect(JSON.stringify(download)).toContain(
            'github.event.workflow_run.id'
        );
        expect(JSON.stringify(download)).toContain('run-id');
        expect(JSON.stringify(upstream.steps)).toContain(
            'validate-upstream-candidate-entry'
        );
    });

    it('seals only raw candidate bytes before protected Vercel or R2 work', () => {
        const entry = loadWorkflow(ENTRY_WORKFLOW_PATH);
        const live = loadWorkflow(LIVE_WORKFLOW_PATH);
        const candidate = entry.jobs['candidate-build']!;
        const sealer = live.jobs['seal-candidate']!;
        const prepare = live.jobs['prepare-live']!;
        const finalize = live.jobs['finalize-live']!;

        expect(candidate.services?.postgres?.image).toBe('postgres:16');
        expect(byName(candidate, 'Checkout candidate')).toBeDefined();
        expect(byName(candidate, 'Run Tier 1')?.run).toContain(
            '--evidence .release-gate/evidence/tier1.json'
        );
        expect(
            byName(candidate, 'Build credential-free candidate output')
        ).toBeDefined();
        expect(byName(candidate, 'Package raw candidate output')).toBeDefined();
        expect(
            byName(candidate, 'Upload raw candidate output')?.with
        ).toMatchObject({
            'include-hidden-files': true,
            'if-no-files-found': 'error',
        });

        expect(sealer.permissions).toEqual({
            contents: 'read',
            actions: 'read',
        });
        expect(JSON.stringify(sealer)).not.toContain('secrets.');
        expect(JSON.stringify(sealer)).not.toContain('id-token');
        expect(
            byName(sealer, 'Safely extract raw candidate output')
        ).toBeDefined();
        expect(byName(sealer, 'Seal candidate output')).toBeDefined();
        expect(
            byName(sealer, 'Upload sealed candidate artifact')?.with
        ).toMatchObject({
            'include-hidden-files': true,
            'if-no-files-found': 'error',
        });

        for (const job of [prepare, finalize]) {
            expect(job.services?.postgres?.image).toBe('postgres:16');
            expect(job.permissions).toMatchObject({
                'id-token': 'write',
                attestations: 'write',
                'artifact-metadata': 'write',
            });
            expect(
                byName(job, 'Safely extract sealed candidate output')
            ).toBeDefined();
            expect(
                byName(job, 'Rehash sealed output immediately before deploy')
            ).toBeDefined();
            expect(
                byName(job, 'Rehash sealed output immediately after deploy')
            ).toBeDefined();
            expect(JSON.stringify(job)).not.toContain('Checkout candidate');
        }
        expect(prepare.environment).toBe('visual-novel-release-preview');
        expect(finalize.environment).toBe('visual-novel-release-approval');
        expect(
            byName(prepare, 'Attest sealed candidate artifact')
        ).toBeDefined();
        expect(
            byName(prepare, 'Deploy the sealed prebuilt output')?.run
        ).toContain('vercel@${VERCEL_CLI_VERSION}" deploy --prebuilt');
    });

    it('binds finalization to trusted prepare and entry artifacts without production activation', () => {
        const live = loadWorkflow(LIVE_WORKFLOW_PATH);
        const finalize = live.jobs['finalize-live']!;
        const helper = readFileSync(HELPER_PATH, 'utf8');
        const finalText = JSON.stringify(finalize);

        expect(
            byName(finalize, 'Resolve exact prepare artifact provenance')?.run
        ).toContain('validate-prepare-provenance');
        expect(
            byName(finalize, 'Download exact candidate entry artifact')?.with
        ).toMatchObject({
            'run-id': '${{ needs.entry-provenance.outputs.entry_run_id }}',
        });
        expect(
            byName(
                finalize,
                'Materialize approved manual review from candidate entry'
            )?.run
        ).toContain('materialize-candidate-entry-manual-review');
        expect(
            byName(finalize, 'Validate approved manual review')?.run
        ).toContain('validate-manual-review');
        expect(finalText).toContain('validate-tier1-reuse');
        expect(finalText).not.toContain('--confirm-production');
        expect(finalText).not.toContain(
            'assets rollback --environment production'
        );
        expect(finalText).not.toContain(
            'assets activate --environment production'
        );
        expect(helper).toContain('packageCandidateEntry');
        expect(helper).toContain('validateUpstreamCandidateEntry');
        expect(helper).toContain('materializeCandidateEntryManualReview');
        expect(helper).toContain('visual-novel-release-live.yml');
    });
});
