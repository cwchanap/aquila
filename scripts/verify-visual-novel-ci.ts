import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { canonicalJson, type JsonValue } from '@aquila/stories/runtime-assets';
import {
    parseTier1EvidenceV1,
    type Tier1EvidenceV1,
} from '@aquila/infra-cloudflare/release-gate';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DATABASE_NAME = 'aquila_e2e';
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DATABASE_ENVIRONMENT_EXIT_CODE = 3;

export type Tier1Command = readonly string[];

export type Tier1StageName =
    | 'migrations'
    | 'compile'
    | 'stories-tests'
    | 'web-tests'
    | 'infra-tests'
    | 'reader-visual-e2e'
    | 'reader-lazy-loading-e2e';

export interface Tier1Stage {
    readonly name: Tier1StageName;
    readonly command: Tier1Command;
    readonly cwd?: 'apps/web';
}

export interface Tier1DatabaseProbeResult {
    readonly healthy: boolean;
    readonly majorVersion?: number;
    readonly reason?: string;
}

export interface Tier1CommandResult {
    readonly exitCode: number | null;
}

export interface Tier1EvidenceMetadata {
    readonly commitSha: string;
    readonly lockfileSha256: string;
    readonly bunVersion: string;
    readonly nodeVersion: string;
    readonly playwrightVersion: string;
    readonly completedAt: string;
}

export interface Tier1Dependencies {
    readonly probeDatabase: () => Promise<Tier1DatabaseProbeResult>;
    readonly runCommand: (stage: Tier1Stage) => Promise<Tier1CommandResult>;
    readonly createEvidence: () => Promise<Tier1EvidenceV1>;
    readonly writeEvidence: (path: string, content: string) => Promise<void>;
    readonly appendWorkflowSummary: (digest: string) => Promise<void>;
    readonly writeStdout: (message: string) => void;
    readonly writeStderr: (message: string) => void;
}

export interface Tier1RunOptions {
    readonly dryRun?: boolean;
    readonly evidencePath?: string;
}

export interface Tier1RunResult {
    readonly exitCode: number;
    readonly evidence?: {
        readonly path: string;
        readonly sha256: string;
    };
}

interface Tier1DatabaseClient {
    connect(): Promise<void>;
    query(query: string): Promise<{
        rows: ReadonlyArray<{ server_version_num: string }>;
    }>;
    end(): Promise<void>;
}

type Tier1DatabaseClientFactory = (
    connectionString: string
) => Tier1DatabaseClient;

function createDefaultDatabaseClient(
    connectionString: string
): Tier1DatabaseClient {
    return new Client({
        connectionString,
        connectionTimeoutMillis: 5_000,
    });
}

function validateTier1DatabaseTarget(
    connectionString: string
): string | undefined {
    try {
        const parsed = new URL(connectionString);
        if (
            parsed.protocol !== 'postgres:' &&
            parsed.protocol !== 'postgresql:'
        ) {
            return 'DATABASE_URL must use a PostgreSQL URL';
        }

        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (!LOCAL_DATABASE_HOSTS.has(host)) {
            return 'DATABASE_URL must target a local PostgreSQL service';
        }

        const databaseName = decodeURIComponent(parsed.pathname.slice(1));
        if (databaseName !== TEST_DATABASE_NAME) {
            return `DATABASE_URL must target the ${TEST_DATABASE_NAME} test database`;
        }
    } catch {
        return 'DATABASE_URL must be a valid PostgreSQL URL';
    }

    return undefined;
}

export async function probeTier1Database(
    env: Readonly<Record<string, string | undefined>> = process.env,
    createClient: Tier1DatabaseClientFactory = createDefaultDatabaseClient
): Promise<Tier1DatabaseProbeResult> {
    const connectionString = env.DATABASE_URL?.trim();
    if (!connectionString) {
        return {
            healthy: false,
            reason: 'DATABASE_URL is not set',
        };
    }

    const targetProblem = validateTier1DatabaseTarget(connectionString);
    if (targetProblem) {
        return {
            healthy: false,
            reason: targetProblem,
        };
    }

    let client: Tier1DatabaseClient | undefined;
    try {
        client = createClient(connectionString);
        await client.connect();
        const result = await client.query('SHOW server_version_num');
        const versionNumber = Number.parseInt(
            result.rows[0]?.server_version_num ?? '',
            10
        );
        const majorVersion = Math.floor(versionNumber / 10_000);

        if (majorVersion !== 16) {
            return {
                healthy: false,
                reason: 'Tier 1 requires PostgreSQL 16',
            };
        }

        return { healthy: true, majorVersion };
    } catch {
        return {
            healthy: false,
            reason: 'Unable to connect to the local PostgreSQL test database',
        };
    } finally {
        await client?.end().catch(() => undefined);
    }
}

export function buildTier1Commands(): Tier1Command[] {
    return [
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
    ];
}

function buildTier1Stages(): Tier1Stage[] {
    const [
        compile,
        storiesTests,
        webTests,
        infraTests,
        readerVisualE2e,
        readerLazyLoadingE2e,
    ] = buildTier1Commands();

    return [
        {
            name: 'migrations',
            cwd: 'apps/web',
            command: ['bun', 'run', 'drizzle:migrate'],
        },
        { name: 'compile', command: compile },
        { name: 'stories-tests', command: storiesTests },
        { name: 'web-tests', command: webTests },
        { name: 'infra-tests', command: infraTests },
        { name: 'reader-visual-e2e', command: readerVisualE2e },
        {
            name: 'reader-lazy-loading-e2e',
            command: readerLazyLoadingE2e,
        },
    ];
}

function formatStage(stage: Tier1Stage): string {
    const cwd = stage.cwd ? ` (cwd: ${stage.cwd})` : '';
    return `[tier1:${stage.name}]${cwd} ${stage.command.join(' ')}\n`;
}

function childFailureExitCode(exitCode: number | null): number {
    return Number.isInteger(exitCode) && exitCode > 0 && exitCode <= 255
        ? exitCode
        : 1;
}

async function runDefaultCommand(
    stage: Tier1Stage
): Promise<Tier1CommandResult> {
    return new Promise(resolveCommand => {
        const [command, ...arguments_] = stage.command;
        if (!command) {
            resolveCommand({ exitCode: null });
            return;
        }

        try {
            const child = spawn(command, arguments_, {
                cwd: stage.cwd
                    ? resolve(REPOSITORY_ROOT, stage.cwd)
                    : REPOSITORY_ROOT,
                stdio: 'inherit',
            });
            child.once('error', () => resolveCommand({ exitCode: null }));
            child.once('close', exitCode => resolveCommand({ exitCode }));
        } catch {
            resolveCommand({ exitCode: null });
        }
    });
}

export function createTier1Evidence(
    metadata: Tier1EvidenceMetadata
): Tier1EvidenceV1 {
    return parseTier1EvidenceV1({
        schemaVersion: 1,
        ...metadata,
        commandSetVersion: 1,
        browserMatrix: ['chromium', 'mobile-chrome'],
        status: 'passed',
    });
}

function readCurrentCommitSha(): string {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
    });
    const commitSha = result.stdout.trim();
    if (result.status !== 0 || !commitSha) {
        throw new Error(
            'Unable to resolve the current git commit for Tier 1 evidence'
        );
    }
    return commitSha;
}

async function createDefaultEvidence(): Promise<Tier1EvidenceV1> {
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
    const parsedPlaywrightPackage = JSON.parse(playwrightPackage) as {
        version?: unknown;
    };
    if (
        typeof parsedPlaywrightPackage.version !== 'string' ||
        !parsedPlaywrightPackage.version.trim()
    ) {
        throw new Error('Unable to resolve the installed Playwright version');
    }
    const bunVersion = (process.versions as Record<string, string | undefined>)
        .bun;
    if (!bunVersion) {
        throw new Error('Tier 1 evidence must be emitted by Bun');
    }

    return createTier1Evidence({
        commitSha: readCurrentCommitSha(),
        lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
        bunVersion,
        nodeVersion: process.version,
        playwrightVersion: parsedPlaywrightPackage.version,
        completedAt: new Date().toISOString(),
    });
}

async function writeDefaultEvidence(
    path: string,
    content: string
): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
}

async function appendDefaultWorkflowSummary(digest: string): Promise<void> {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;

    await appendFile(
        summaryPath,
        `Tier 1 evidence canonical SHA-256: \`${digest}\`\n`,
        'utf8'
    );
}

function createDefaultDependencies(): Tier1Dependencies {
    return {
        probeDatabase: () => probeTier1Database(),
        runCommand: runDefaultCommand,
        createEvidence: createDefaultEvidence,
        writeEvidence: writeDefaultEvidence,
        appendWorkflowSummary: appendDefaultWorkflowSummary,
        writeStdout: message => process.stdout.write(message),
        writeStderr: message => process.stderr.write(message),
    };
}

function assertEvidencePath(path: string): void {
    if (!path.trim() || path.includes('\0') || path.startsWith('-')) {
        throw new Error('Expected a non-empty evidence path');
    }
}

function canonicalEvidenceContent(evidence: Tier1EvidenceV1): {
    content: string;
    sha256: string;
} {
    const canonical = canonicalJson(evidence as JsonValue);
    return {
        content: `${canonical}\n`,
        sha256: createHash('sha256').update(canonical).digest('hex'),
    };
}

export async function runTier1(
    options: Tier1RunOptions,
    dependencies: Tier1Dependencies = createDefaultDependencies()
): Promise<Tier1RunResult> {
    if (options.dryRun && options.evidencePath) {
        throw new Error('A dry run cannot emit evidence');
    }
    if (options.evidencePath) {
        assertEvidencePath(options.evidencePath);
    }

    const stages = buildTier1Stages();
    if (options.dryRun) {
        dependencies.writeStdout(
            '[tier1] dry-run only: no database probe, migration, or test command will execute; no Tier 1 evidence will be emitted.\n'
        );
        dependencies.writeStdout(
            `[tier1:database] actual Tier 1 requires local PostgreSQL 16 at DATABASE_URL targeting ${TEST_DATABASE_NAME}.\n`
        );
        for (const stage of stages) {
            dependencies.writeStdout(formatStage(stage));
        }
        return { exitCode: 0 };
    }

    const database = await dependencies.probeDatabase();
    if (!database.healthy) {
        dependencies.writeStderr(
            `[tier1:database] prerequisite failed: ${database.reason ?? 'unknown database error'}\n`
        );
        dependencies.writeStderr(
            `[tier1:database] Tier 1 requires healthy local PostgreSQL 16 at DATABASE_URL targeting ${TEST_DATABASE_NAME}.\n`
        );
        dependencies.writeStderr(
            '[tier1:database] Required migration command: (cd apps/web && bun run drizzle:migrate)\n'
        );
        return { exitCode: DATABASE_ENVIRONMENT_EXIT_CODE };
    }

    for (const stage of stages) {
        dependencies.writeStderr(formatStage(stage));
        let result: Tier1CommandResult;
        try {
            result = await dependencies.runCommand(stage);
        } catch {
            dependencies.writeStderr(
                `[tier1:${stage.name}] command runner failed before reporting an exit code\n`
            );
            return { exitCode: 1 };
        }

        if (result.exitCode !== 0) {
            const exitCode = childFailureExitCode(result.exitCode);
            dependencies.writeStderr(
                `[tier1:${stage.name}] failed with exit code ${exitCode}\n`
            );
            return { exitCode };
        }
    }

    if (!options.evidencePath) {
        return { exitCode: 0 };
    }

    try {
        const evidence = parseTier1EvidenceV1(
            await dependencies.createEvidence()
        );
        const serialized = canonicalEvidenceContent(evidence);
        await dependencies.writeEvidence(
            options.evidencePath,
            serialized.content
        );
        await dependencies.appendWorkflowSummary(serialized.sha256);
        dependencies.writeStderr(
            `[tier1:evidence] canonical SHA-256: ${serialized.sha256}\n`
        );
        return {
            exitCode: 0,
            evidence: {
                path: options.evidencePath,
                sha256: serialized.sha256,
            },
        };
    } catch {
        dependencies.writeStderr(
            '[tier1:evidence] failed to write strict Tier 1 evidence\n'
        );
        return { exitCode: 1 };
    }
}

export function parseTier1Arguments(argv: readonly string[]): Tier1RunOptions {
    let dryRun = false;
    let evidencePath: string | undefined;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--dry-run') {
            if (dryRun) throw new Error('Duplicate --dry-run argument');
            dryRun = true;
            continue;
        }
        if (argument === '--evidence') {
            if (evidencePath !== undefined) {
                throw new Error('Duplicate --evidence argument');
            }
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error('--evidence requires a path');
            }
            assertEvidencePath(value);
            evidencePath = value;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }

    if (dryRun && evidencePath !== undefined) {
        throw new Error('A dry run cannot emit evidence');
    }
    return dryRun ? { dryRun: true } : { dryRun: false, evidencePath };
}

async function main(): Promise<void> {
    try {
        const result = await runTier1(
            parseTier1Arguments(process.argv.slice(2))
        );
        process.exitCode = result.exitCode;
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`[tier1] ${message}\n`);
        process.exitCode = 1;
    }
}

if (import.meta.main) {
    await main();
}
