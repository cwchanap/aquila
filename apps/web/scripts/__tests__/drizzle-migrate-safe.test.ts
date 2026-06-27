/**
 * Tests for scripts/drizzle-migrate-safe.ts
 *
 * The script is a pure ESM runner: it is a thin wrapper that calls
 * spawnSync(drizzle-kit migrate) + process.exit.
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
    await import('../../scripts/drizzle-migrate-safe.ts');
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('drizzle-migrate-safe', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let originalDatabaseUrl: string | undefined;

    beforeEach(() => {
        originalDatabaseUrl = process.env.DATABASE_URL;

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

        it('passes env with resolved DATABASE_URL to spawnSync', async () => {
            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.any(Array),
                expect.objectContaining({
                    env: expect.objectContaining({
                        DATABASE_URL: 'postgresql://localhost:5432/aquila_test',
                    }),
                })
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

    // ── connection-string fallback chain ───────────────────────────────────

    describe('connection-string fallback', () => {
        let originalPostgresUrl: string | undefined;
        let originalAquilaDbUrl: string | undefined;
        let originalAquilaPostgresUrl: string | undefined;

        beforeEach(() => {
            originalPostgresUrl = process.env.POSTGRES_URL;
            originalAquilaDbUrl = process.env.aquila_DATABASE_URL;
            originalAquilaPostgresUrl = process.env.aquila_POSTGRES_URL;
            // Remove DATABASE_URL so the fallback chain is exercised
            delete process.env.DATABASE_URL;
        });

        afterEach(() => {
            if (originalPostgresUrl === undefined) {
                delete process.env.POSTGRES_URL;
            } else {
                process.env.POSTGRES_URL = originalPostgresUrl;
            }
            if (originalAquilaDbUrl === undefined) {
                delete process.env.aquila_DATABASE_URL;
            } else {
                process.env.aquila_DATABASE_URL = originalAquilaDbUrl;
            }
            if (originalAquilaPostgresUrl === undefined) {
                delete process.env.aquila_POSTGRES_URL;
            } else {
                process.env.aquila_POSTGRES_URL = originalAquilaPostgresUrl;
            }
        });

        it('injects POSTGRES_URL as DATABASE_URL when DATABASE_URL is unset', async () => {
            process.env.POSTGRES_URL = 'postgres://remote-host:5432/db';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.any(Array),
                expect.objectContaining({
                    env: expect.objectContaining({
                        DATABASE_URL: 'postgres://remote-host:5432/db',
                    }),
                })
            );
        });

        it('injects aquila_DATABASE_URL when DATABASE_URL and POSTGRES_URL are unset', async () => {
            delete process.env.POSTGRES_URL;
            process.env.aquila_DATABASE_URL = 'postgres://aquila-host:5432/db';

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            expect(spawnSyncMock).toHaveBeenCalledWith(
                'bunx',
                expect.any(Array),
                expect.objectContaining({
                    env: expect.objectContaining({
                        DATABASE_URL: 'postgres://aquila-host:5432/db',
                    }),
                })
            );
        });

        it('passes process.env unchanged when no connection string env var is set', async () => {
            delete process.env.DATABASE_URL;
            delete process.env.POSTGRES_URL;
            delete process.env.aquila_DATABASE_URL;
            delete process.env.aquila_POSTGRES_URL;

            await expect(runScript()).rejects.toBeInstanceOf(ProcessExitError);

            // resolvedUrl is undefined → childEnv === process.env (no
            // DATABASE_URL injection). Verify the spawn env is exactly
            // process.env and that no DATABASE_URL was injected.
            const callArgs = spawnSyncMock.mock.calls[0][2] as {
                env: Record<string, string | undefined>;
            };
            expect(callArgs.env).toBe(process.env);
            expect(callArgs.env.DATABASE_URL).toBeUndefined();
        });
    });
});
