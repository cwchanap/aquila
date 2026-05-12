/**
 * Tests for scripts/drizzle-migrate-safe.mjs
 *
 * The script is a pure ESM runner: it reads env, optionally blocks on
 * CockroachDB detection, then always calls spawnSync + process.exit.
 * We use vi.resetModules() + dynamic import so each test gets a fresh
 * module execution, and we make the process.exit mock throw so that
 * execution stops at the exit point (matching real semantics).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Stable mock ref created before vi.mock hoisting ──────────────────────
const spawnSyncMock = vi.fn();

vi.mock('node:child_process', () => ({
    spawnSync: spawnSyncMock,
    default: { spawnSync: spawnSyncMock },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

class ProcessExitError extends Error {
    constructor(public readonly code: number | string | null | undefined) {
        super(`process.exit(${code})`);
        this.name = 'ProcessExitError';
    }
}

/** Dynamically (re-)imports the script after the module registry is reset. */
async function runScript(): Promise<void> {
    await import('../../scripts/drizzle-migrate-safe.mjs');
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('drizzle-migrate-safe', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let originalDatabaseUrl: string | undefined;
    let originalAllowCockroachMigrations: string | undefined;

    beforeEach(() => {
        originalDatabaseUrl = process.env.DATABASE_URL;
        originalAllowCockroachMigrations =
            process.env.ALLOW_COCKROACH_MIGRATIONS;

        vi.resetModules();
        vi.clearAllMocks();

        // Make process.exit throw so that code stops at the exit point,
        // matching real semantics without actually killing the test runner.
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
            throw new ProcessExitError(code);
        });
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        // Default: regular PostgreSQL URL, successful spawn
        process.env.DATABASE_URL = 'postgresql://localhost:5432/aquila_test';
        delete process.env.ALLOW_COCKROACH_MIGRATIONS;
        spawnSyncMock.mockReturnValue({ status: 0, error: undefined });
    });

    afterEach(() => {
        exitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        if (originalDatabaseUrl === undefined) {
            delete process.env.DATABASE_URL;
        } else {
            process.env.DATABASE_URL = originalDatabaseUrl;
        }
        if (originalAllowCockroachMigrations === undefined) {
            delete process.env.ALLOW_COCKROACH_MIGRATIONS;
        } else {
            process.env.ALLOW_COCKROACH_MIGRATIONS =
                originalAllowCockroachMigrations;
        }
    });

    // ── hasCockroachSignature paths ────────────────────────────────────────

    describe('CockroachDB URL detection', () => {
        it('blocks migration for URL containing port 26257', async () => {
            process.env.DATABASE_URL = 'postgresql://localhost:26257/test';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('WARNING')
            );
            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(spawnSyncMock).not.toHaveBeenCalled();
        });

        it('blocks migration for URL containing "cockroach"', async () => {
            process.env.DATABASE_URL =
                'postgresql://free-tier.cockroachlabs.cloud/db';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(spawnSyncMock).not.toHaveBeenCalled();
        });

        it('blocks migration for URL containing "crdb"', async () => {
            process.env.DATABASE_URL =
                'postgresql://crdb-host.example.com:5432/db';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(spawnSyncMock).not.toHaveBeenCalled();
        });

        it('allows CockroachDB URL when ALLOW_COCKROACH_MIGRATIONS=true', async () => {
            process.env.DATABASE_URL = 'postgresql://localhost:26257/test';
            process.env.ALLOW_COCKROACH_MIGRATIONS = 'true';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            // Should not have blocked — spawnSync is called before exit
            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.arrayContaining(['drizzle-kit', 'migrate']),
                expect.objectContaining({ stdio: 'inherit' })
            );
            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('treats empty DATABASE_URL as non-cockroach and runs migration', async () => {
            process.env.DATABASE_URL = '';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).not.toHaveBeenCalledWith(1);
            expect(spawnSyncMock).toHaveBeenCalled();
        });

        it('treats missing DATABASE_URL as non-cockroach and runs migration', async () => {
            delete process.env.DATABASE_URL;

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).not.toHaveBeenCalledWith(1);
            expect(spawnSyncMock).toHaveBeenCalled();
        });
    });

    // ── spawnSync result paths ─────────────────────────────────────────────

    describe('spawnSync result handling', () => {
        it('exits with spawnSync status 0 on success', async () => {
            spawnSyncMock.mockReturnValue({ status: 0, error: undefined });

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('exits with non-zero status when drizzle-kit returns failure', async () => {
            spawnSyncMock.mockReturnValue({ status: 1, error: undefined });

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('falls back to exit(0) when spawnSync status is null', async () => {
            spawnSyncMock.mockReturnValue({ status: null, error: undefined });

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('logs error and exits 1 when spawnSync returns an error object', async () => {
            const spawnError = new Error('ENOENT');
            spawnSyncMock.mockReturnValue({ status: null, error: spawnError });

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to spawn'),
                spawnError
            );
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('uses spawnSync status (not 1) when error and non-null status', async () => {
            const spawnError = new Error('spawn failed');
            spawnSyncMock.mockReturnValue({ status: 2, error: spawnError });

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(exitSpy).toHaveBeenCalledWith(2);
        });

        it('passes process.env to spawnSync', async () => {
            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.any(Array),
                expect.objectContaining({ env: process.env })
            );
        });

        it('passes drizzle.config.ts path to spawnSync args', async () => {
            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.arrayContaining([
                    '--config',
                    expect.stringContaining('drizzle.config.ts'),
                ]),
                expect.any(Object)
            );
        });
    });
});
