import { createHash } from 'node:crypto';
import { describe, expect, it } from 'bun:test';
import {
    buildTier1Commands,
    createTier1Evidence,
    parseTier1Arguments,
    probeTier1Database,
    runTier1,
    type Tier1Dependencies,
    type Tier1EvidenceMetadata,
    type Tier1Stage,
} from '../verify-visual-novel-ci';
import { canonicalJson, type JsonValue } from '@aquila/stories/runtime-assets';
import { parseTier1EvidenceV1 } from '@aquila/infra-cloudflare/release-gate';

const FIXED_METADATA: Tier1EvidenceMetadata = {
    commitSha: 'a'.repeat(40),
    lockfileSha256: 'b'.repeat(64),
    bunVersion: '1.3.1',
    nodeVersion: 'v22.10.0',
    playwrightVersion: '1.55.0',
    completedAt: '2026-08-03T12:00:00.000Z',
};

function createDependencies(
    overrides: Partial<Tier1Dependencies> = {}
): Tier1Dependencies {
    return {
        probeDatabase: async () => ({
            healthy: true,
            majorVersion: 16,
        }),
        runCommand: async () => ({ exitCode: 0 }),
        createEvidence: async () => createTier1Evidence(FIXED_METADATA),
        writeEvidence: async () => undefined,
        appendWorkflowSummary: async () => undefined,
        writeStdout: () => undefined,
        writeStderr: () => undefined,
        ...overrides,
    };
}

describe('buildTier1Commands', () => {
    it('runs visual E2E on desktop/mobile and lazy E2E on desktop only', () => {
        expect(buildTier1Commands()).toEqual([
            ['bun', 'run', 'compile:check'],
            ['bun', '--filter', '@aquila/stories', 'test'],
            ['bun', '--filter', 'web', 'test'],
            ['bun', '--filter', '@aquila/infra-cloudflare', 'test'],
            [
                'bun',
                '--filter',
                'e2e',
                'test:e2e',
                'tests/reader-visual.spec.ts',
                '--project=chromium',
                '--project=mobile-chrome',
            ],
            [
                'bun',
                '--filter',
                'e2e',
                'test:e2e',
                'tests/reader-lazy-loading.spec.ts',
                '--project=chromium',
            ],
        ]);
    });
});

describe('Tier 1 database prerequisite', () => {
    it('rejects a missing DATABASE_URL before opening a database connection', async () => {
        let createClientCalls = 0;

        const result = await probeTier1Database({}, () => {
            createClientCalls += 1;
            throw new Error('must not connect without a target');
        });

        expect(result.healthy).toBe(false);
        expect(createClientCalls).toBe(0);
    });

    it('rejects a non-local or non-test database target before opening a connection', async () => {
        let createClientCalls = 0;
        const createClient = () => {
            createClientCalls += 1;
            throw new Error('must not connect to an unsafe target');
        };

        const remote = await probeTier1Database(
            {
                DATABASE_URL:
                    'postgresql://postgres:postgres@database.example/aquila_e2e',
            },
            createClient
        );
        const wrongDatabase = await probeTier1Database(
            {
                DATABASE_URL:
                    'postgresql://postgres:postgres@localhost:5432/aquila',
            },
            createClient
        );

        expect(remote.healthy).toBe(false);
        expect(wrongDatabase.healthy).toBe(false);
        expect(createClientCalls).toBe(0);
    });

    it('accepts only a healthy PostgreSQL 16 test database', async () => {
        const calls: string[] = [];
        let ended = false;

        const healthy = await probeTier1Database(
            {
                DATABASE_URL:
                    'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
            },
            connectionString => {
                calls.push(connectionString);
                return {
                    connect: async () => undefined,
                    query: async () => ({
                        rows: [{ server_version_num: '160004' }],
                    }),
                    end: async () => {
                        ended = true;
                    },
                };
            }
        );
        const wrongVersion = await probeTier1Database(
            {
                DATABASE_URL:
                    'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
            },
            () => ({
                connect: async () => undefined,
                query: async () => ({
                    rows: [{ server_version_num: '150009' }],
                }),
                end: async () => undefined,
            })
        );

        expect(healthy).toEqual({ healthy: true, majorVersion: 16 });
        expect(wrongVersion.healthy).toBe(false);
        expect(calls).toEqual([
            'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
        ]);
        expect(ended).toBe(true);
    });

    it('returns environment code 3 and migration guidance when the database is unavailable', async () => {
        const stderr: string[] = [];
        const stages: Tier1Stage[] = [];

        const result = await runTier1(
            {},
            createDependencies({
                probeDatabase: async () => ({
                    healthy: false,
                    reason: 'connection refused',
                }),
                runCommand: async stage => {
                    stages.push(stage);
                    return { exitCode: 0 };
                },
                writeStderr: message => stderr.push(message),
            })
        );

        expect(result.exitCode).toBe(3);
        expect(stages).toEqual([]);
        expect(stderr.join('')).toContain(
            'Required migration command: (cd apps/web && bun run drizzle:migrate)'
        );
    });
});

describe('runTier1', () => {
    it('runs the app migration before the fixed command plan and streams stable stage ownership', async () => {
        const stages: Tier1Stage[] = [];
        const stderr: string[] = [];

        const result = await runTier1(
            {},
            createDependencies({
                runCommand: async stage => {
                    stages.push(stage);
                    return { exitCode: 0 };
                },
                writeStderr: message => stderr.push(message),
            })
        );

        expect(result.exitCode).toBe(0);
        expect(stages.map(stage => stage.name)).toEqual([
            'migrations',
            'compile',
            'stories-tests',
            'web-tests',
            'infra-tests',
            'reader-visual-e2e',
            'reader-lazy-loading-e2e',
        ]);
        expect(stages[0]).toEqual({
            name: 'migrations',
            cwd: 'apps/web',
            command: ['bun', 'run', 'drizzle:migrate'],
        });
        expect(stages[5].command).toEqual([
            'bun',
            '--filter',
            'e2e',
            'test:e2e',
            'tests/reader-visual.spec.ts',
            '--project=chromium',
            '--project=mobile-chrome',
        ]);
        expect(stages[6].command).toEqual([
            'bun',
            '--filter',
            'e2e',
            'test:e2e',
            'tests/reader-lazy-loading.spec.ts',
            '--project=chromium',
        ]);
        expect(stderr.join('')).toContain('[tier1:migrations]');
        expect(stderr.join('')).toContain('[tier1:reader-visual-e2e]');
        expect(stderr.join('')).toContain('[tier1:reader-lazy-loading-e2e]');
    });

    it('stops at the first failed child command and preserves its exit code', async () => {
        const stages: string[] = [];
        let evidenceWrites = 0;

        const result = await runTier1(
            { evidencePath: 'evidence/tier1.json' },
            createDependencies({
                runCommand: async stage => {
                    stages.push(stage.name);
                    return {
                        exitCode: stage.name === 'web-tests' ? 2 : 0,
                    };
                },
                writeEvidence: async () => {
                    evidenceWrites += 1;
                },
            })
        );

        expect(result.exitCode).toBe(2);
        expect(stages).toEqual([
            'migrations',
            'compile',
            'stories-tests',
            'web-tests',
        ]);
        expect(evidenceWrites).toBe(0);
    });

    it('prints a credential-free dry run with migration before the two exact Playwright splits', async () => {
        const stdout: string[] = [];
        let probeCalls = 0;
        let commandCalls = 0;

        const result = await runTier1(
            { dryRun: true },
            createDependencies({
                probeDatabase: async () => {
                    probeCalls += 1;
                    return { healthy: true, majorVersion: 16 };
                },
                runCommand: async () => {
                    commandCalls += 1;
                    return { exitCode: 0 };
                },
                writeStdout: message => stdout.push(message),
            })
        );

        const output = stdout.join('');
        expect(result.exitCode).toBe(0);
        expect(probeCalls).toBe(0);
        expect(commandCalls).toBe(0);
        expect(output.indexOf('bun run drizzle:migrate')).toBeLessThan(
            output.indexOf('tests/reader-visual.spec.ts')
        );
        expect(output).toContain('--project=chromium --project=mobile-chrome');
        expect(output).toContain(
            'tests/reader-lazy-loading.spec.ts --project=chromium'
        );
        expect(output).toContain(
            'no database probe, migration, or test command will execute'
        );
    });

    it('emits canonical strict evidence and writes its digest only outside the document', async () => {
        const writes: Array<{ path: string; content: string }> = [];
        const summaryDigests: string[] = [];

        const result = await runTier1(
            { evidencePath: 'evidence/tier1.json' },
            createDependencies({
                writeEvidence: async (path, content) => {
                    writes.push({ path, content });
                },
                appendWorkflowSummary: async digest => {
                    summaryDigests.push(digest);
                },
            })
        );

        const expectedEvidence = {
            schemaVersion: 1,
            ...FIXED_METADATA,
            commandSetVersion: 1,
            browserMatrix: ['chromium', 'mobile-chrome'],
            status: 'passed',
        };
        const expectedDigest = createHash('sha256')
            .update(canonicalJson(expectedEvidence as JsonValue))
            .digest('hex');
        const written = writes[0];

        expect(result.exitCode).toBe(0);
        expect(result.evidence).toEqual({
            path: 'evidence/tier1.json',
            sha256: expectedDigest,
        });
        expect(written.path).toBe('evidence/tier1.json');
        expect(written.content).toBe(
            `${canonicalJson(expectedEvidence as JsonValue)}\n`
        );
        const parsed = JSON.parse(written.content);
        expect(parseTier1EvidenceV1(parsed)).toEqual(expectedEvidence);
        expect(parsed).not.toHaveProperty('sha256');
        expect(parsed).not.toHaveProperty('digest');
        expect(summaryDigests).toEqual([expectedDigest]);
    });
});

describe('parseTier1Arguments', () => {
    it('refuses to create evidence from a dry run', () => {
        expect(parseTier1Arguments(['--dry-run'])).toEqual({
            dryRun: true,
        });
        expect(
            parseTier1Arguments(['--evidence', 'evidence/tier1.json'])
        ).toEqual({
            dryRun: false,
            evidencePath: 'evidence/tier1.json',
        });
        expect(() =>
            parseTier1Arguments([
                '--dry-run',
                '--evidence',
                'evidence/tier1.json',
            ])
        ).toThrow('cannot emit evidence');
    });
});
