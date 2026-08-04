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
        isCheckoutClean: async () => true,
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

    it('rejects an effective remote host override before opening a database connection', async () => {
        let createClientCalls = 0;

        const result = await probeTier1Database(
            {
                DATABASE_URL:
                    'postgresql://postgres:postgres@localhost:5432/aquila_e2e?host=database.example',
            },
            () => {
                createClientCalls += 1;
                throw new Error('must not connect to an overridden host');
            }
        );

        expect(result.healthy).toBe(false);
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

    it('pins normal E2E children to the local server and excludes remote target controls', async () => {
        const stages: Tier1Stage[] = [];
        const originalEnvironment = new Map(
            [
                'AQUILA_PRODUCTION_WEB_ORIGIN',
                'BASE_URL',
                'BETTER_AUTH_URL',
                'CI',
                'DATABASE_URL',
                'KEEP_FOR_TIER1_TEST',
                'PUBLIC_ASSET_BASE_URL',
                'PUBLIC_ASSET_ENVIRONMENT',
                'PUBLIC_ASSET_PREVIEW_ID',
                'PUBLIC_AUTH_URL',
                'RELEASE_GATE_TARGET',
                'TRUSTED_ORIGINS',
                'VERCEL_BRANCH_URL',
                'VERCEL_PROJECT_PRODUCTION_URL',
                'VERCEL_URL',
            ].map(name => [name, process.env[name]])
        );

        Object.assign(process.env, {
            AQUILA_PRODUCTION_WEB_ORIGIN: 'https://production.example.com',
            BASE_URL: 'https://unrelated-server.example.com',
            BETTER_AUTH_URL: 'https://auth.example.com',
            CI: 'false',
            DATABASE_URL:
                'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
            KEEP_FOR_TIER1_TEST: 'preserve-nonsecret-setup',
            PUBLIC_ASSET_BASE_URL: 'https://assets.example.com',
            PUBLIC_ASSET_ENVIRONMENT: 'production',
            PUBLIC_ASSET_PREVIEW_ID: 'remote-preview',
            PUBLIC_AUTH_URL: 'https://public-auth.example.com',
            RELEASE_GATE_TARGET: 'production',
            TRUSTED_ORIGINS: 'https://origin.example.com',
            VERCEL_BRANCH_URL: 'branch.example.com',
            VERCEL_PROJECT_PRODUCTION_URL: 'production.example.com',
            VERCEL_URL: 'deployment.example.com',
        });

        try {
            const result = await runTier1(
                {},
                createDependencies({
                    runCommand: async stage => {
                        stages.push(stage);
                        return { exitCode: 0 };
                    },
                })
            );

            const e2eStages = stages.filter(stage =>
                stage.name.endsWith('-e2e')
            );

            expect(result.exitCode).toBe(0);
            expect(e2eStages).toHaveLength(2);
            for (const stage of e2eStages) {
                const environment = (
                    stage as Tier1Stage & {
                        readonly env?: Readonly<
                            Record<string, string | undefined>
                        >;
                    }
                ).env;

                expect(stage.command).not.toContain(
                    'playwright.release-gate.config.ts'
                );
                expect(environment).toEqual(
                    expect.objectContaining({
                        BASE_URL: 'http://localhost:5090',
                        CI: 'true',
                        DATABASE_URL:
                            'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
                        KEEP_FOR_TIER1_TEST: 'preserve-nonsecret-setup',
                    })
                );
                expect(environment).not.toHaveProperty(
                    'AQUILA_PRODUCTION_WEB_ORIGIN'
                );
                expect(environment).not.toHaveProperty('BETTER_AUTH_URL');
                expect(environment).not.toHaveProperty('PUBLIC_ASSET_BASE_URL');
                expect(environment).not.toHaveProperty(
                    'PUBLIC_ASSET_ENVIRONMENT'
                );
                expect(environment).not.toHaveProperty(
                    'PUBLIC_ASSET_PREVIEW_ID'
                );
                expect(environment).not.toHaveProperty('PUBLIC_AUTH_URL');
                expect(environment).not.toHaveProperty('RELEASE_GATE_TARGET');
                expect(environment).not.toHaveProperty('TRUSTED_ORIGINS');
                expect(environment).not.toHaveProperty('VERCEL_BRANCH_URL');
                expect(environment).not.toHaveProperty(
                    'VERCEL_PROJECT_PRODUCTION_URL'
                );
                expect(environment).not.toHaveProperty('VERCEL_URL');
            }
        } finally {
            for (const [name, value] of originalEnvironment) {
                if (value === undefined) {
                    delete process.env[name];
                } else {
                    process.env[name] = value;
                }
            }
        }
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
        let cleanCheckoutChecks = 0;

        const result = await runTier1(
            { evidencePath: 'evidence/tier1.json' },
            createDependencies({
                isCheckoutClean: async () => {
                    cleanCheckoutChecks += 1;
                    return true;
                },
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
        expect(cleanCheckoutChecks).toBe(2);
    });

    it('refuses evidence from a dirty checkout before probing, running, or emitting', async () => {
        const stderr: string[] = [];
        let probeCalls = 0;
        let commandCalls = 0;
        let evidenceWrites = 0;
        let summaryWrites = 0;

        const result = await runTier1(
            { evidencePath: 'evidence/tier1.json' },
            createDependencies({
                isCheckoutClean: async () => false,
                probeDatabase: async () => {
                    probeCalls += 1;
                    return { healthy: true, majorVersion: 16 };
                },
                runCommand: async () => {
                    commandCalls += 1;
                    return { exitCode: 0 };
                },
                writeEvidence: async () => {
                    evidenceWrites += 1;
                },
                appendWorkflowSummary: async () => {
                    summaryWrites += 1;
                },
                writeStderr: message => stderr.push(message),
            })
        );

        expect(result.exitCode).toBe(2);
        expect(probeCalls).toBe(0);
        expect(commandCalls).toBe(0);
        expect(evidenceWrites).toBe(0);
        expect(summaryWrites).toBe(0);
        expect(stderr.join('')).toContain(
            '[tier1:evidence] refusing to emit evidence from a dirty checkout'
        );
        expect(stderr.join('')).not.toContain('evidence/tier1.json');
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
