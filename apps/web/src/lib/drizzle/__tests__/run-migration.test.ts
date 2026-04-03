import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dotenv to prevent loading .env file
vi.mock('dotenv', () => ({
    config: vi.fn(),
}));

// Mock fs module to control file system operations
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('fs', async importOriginal => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        readdirSync: mockReaddirSync,
        readFileSync: mockReadFileSync,
        default: {
            ...actual,
            readdirSync: mockReaddirSync,
            readFileSync: mockReadFileSync,
        },
    };
});

// Mock pg module to control database interactions
const mockQuery = vi.fn();
const mockPoolEnd = vi.fn();
const mockPoolConstructor = vi.fn();

vi.mock('pg', () => ({
    Pool: mockPoolConstructor,
}));

describe('run-migration.ts', () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ['DATABASE_URL', 'NODE_ENV', 'DB_CA_PATH']) {
            savedEnv[key] = process.env[key];
        }

        mockQuery.mockReset();
        mockPoolEnd.mockReset().mockResolvedValue(undefined);
        mockPoolConstructor.mockReset().mockImplementation(function () {
            return { query: mockQuery, end: mockPoolEnd };
        });
        mockReaddirSync.mockReset();
        mockReadFileSync.mockReset();

        vi.resetModules();
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        vi.restoreAllMocks();
    });

    it('creates Pool with ssl=false in non-production', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue([]);
        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString: 'postgres://localhost/testdb',
                ssl: false,
                max: 1,
            })
        );
    });

    it('ends pool connection after completion', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue([]);
        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
    });

    it('returns early when no .sql migration files are found', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        // Only non-sql files
        mockReaddirSync.mockReturnValue(['readme.txt', 'not-sql.md']);

        await import('../run-migration');

        // Pool.end is still called in finally, but no queries for migration
        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
    });

    it('creates tracking table and applies unapplied migration files', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied -> not applied
            .mockResolvedValueOnce({ rows: [] }) // execute migration statement
            .mockResolvedValueOnce({ rows: [] }); // insert into tracking table

        await import('../run-migration');

        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('skips migration files that were already applied', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // already applied

        await import('../run-migration');

        // Should only call query twice (tracking table + check), not execute or insert
        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('handles multiple SQL statements separated by breakpoints', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue(
            'CREATE TABLE foo (id INT);\n--> statement-breakpoint\nCREATE TABLE bar (id INT);'
        );

        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied -> not applied
            .mockResolvedValueOnce({ rows: [] }) // execute statement 1
            .mockResolvedValueOnce({ rows: [] }) // execute statement 2
            .mockResolvedValueOnce({ rows: [] }); // insert into tracking table

        await import('../run-migration');

        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        expect(mockQuery).toHaveBeenCalledTimes(5);
    });

    it('applies multiple migration files in order', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_first.sql', '0002_second.sql']);
        mockReadFileSync.mockReturnValue('SELECT 1;');

        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        // create tracking table (1) + per file: check (1) + execute (1) + insert (1) = 1 + 2*3 = 7
        await vi.waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(7));
    });

    it('sorts migration files alphabetically before applying', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        // Files returned in reverse order - should be sorted alphabetically
        mockReaddirSync.mockReturnValue(['0002_second.sql', '0001_first.sql']);
        mockReadFileSync.mockReturnValue('SELECT 1;');

        const queryParams: string[] = [];
        mockQuery.mockImplementation((_sql: string, params?: string[]) => {
            if (params && params[0]) queryParams.push(params[0]);
            return Promise.resolve({ rows: [] });
        });

        await import('../run-migration');

        // Wait for migration to finish, then check order
        await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        // 0001_first.sql should appear before 0002_second.sql (alphabetical sorting)
        expect(queryParams.indexOf('0001_first.sql')).toBeLessThan(
            queryParams.indexOf('0002_second.sql')
        );
    });

    it('filters out non-sql files from the migrations directory', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue([
            '0001_init.sql',
            'journal.json',
            'snapshot.ts',
        ]);
        mockReadFileSync.mockReturnValue('SELECT 1;');

        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        // Only 0001_init.sql should be processed: tracking table (1) + check (1) + execute (1) + insert (1) = 4
        await vi.waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(4));
    });

    it('creates Pool with ssl.ca object in production when DB_CA_PATH is set', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'production';
        process.env.DB_CA_PATH = '/fake/ca.pem';

        const fakeCert = Buffer.from('fake-cert');
        mockReadFileSync.mockImplementation((p: unknown) => {
            if (String(p).includes('ca.pem')) return fakeCert;
            return 'SELECT 1;';
        });
        mockReaddirSync.mockReturnValue([]);
        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString: 'postgres://localhost/testdb',
                ssl: { ca: fakeCert },
                max: 1,
            })
        );
    });

    it('inserts migration filename into tracking table after successful application', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        const insertCalls: Array<{ sql: string; params?: string[] }> = [];
        mockQuery.mockImplementation((sql: string, params?: string[]) => {
            insertCalls.push({ sql, params });
            return Promise.resolve({ rows: [] });
        });

        await import('../run-migration');

        // Last call should be the tracking insert with the migration filename
        const insertCall = insertCalls.find(
            c =>
                c.sql.includes('INSERT INTO') &&
                c.params?.[0] === '0001_init.sql'
        );
        expect(insertCall).toBeDefined();
    });

    // runMigration() is called at module scope without `await`, so errors it
    // throws become unhandled promise rejections.  vitest's catchError skips
    // reporting when process.listeners('unhandledRejection').length > 1
    // (it assumes user code handles it).  We register a capturing listener to
    // raise the count to ≥ 2, run the test body, then wait until the
    // rejection event fires so the listener is still present.  The helper
    // returns the captured rejection reason and fails the test if no rejection
    // occurs within 200 ms, ensuring the test actually exercises the error path.
    async function captureNextUnhandledRejection(
        fn: () => Promise<void>
    ): Promise<unknown> {
        let resolveCapture: (reason: unknown) => void = () => {};
        const capturedRejection = new Promise<unknown>(
            r => (resolveCapture = r)
        );
        const absorb: NodeJS.UnhandledRejectionListener = reason =>
            resolveCapture(reason);
        process.on('unhandledRejection', absorb);
        try {
            await fn();
            // The unhandledRejection event fires after the module-level
            // runMigration() promise settles (nextTick phase), which may be
            // after vi.waitFor() resolves.  Race with a rejecting deadline so
            // the test fails fast if no rejection ever occurs.
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () =>
                        reject(
                            new Error(
                                'Expected an unhandled rejection from runMigration() but none occurred within 200ms'
                            )
                        ),
                    200
                );
            });
            try {
                return await Promise.race([capturedRejection, timeoutPromise]);
            } finally {
                clearTimeout(timeoutId);
            }
        } finally {
            process.off('unhandledRejection', absorb);
        }
    }

    it('throws formatted error when SQL statement fails with duplicate object code 42P07', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        const dupError = Object.assign(new Error('relation already exists'), {
            code: '42P07',
        });
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied → not applied
            .mockRejectedValueOnce(dupError); // SQL execution fails

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reason = await captureNextUnhandledRejection(async () => {
            await import('../run-migration');
            await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        });

        expect(reason).toMatchObject({
            message: expect.stringContaining('Duplicate object detected'),
        });
        expect(console.error).toHaveBeenCalledWith(
            '❌ Migration failed:',
            expect.objectContaining({
                message: expect.stringContaining('Duplicate object detected'),
            })
        );
    });

    it('throws formatted error when SQL statement fails with duplicate object code 42710', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE INDEX idx ON test (id);');

        const dupError = Object.assign(new Error('index already exists'), {
            code: '42710',
        });
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied
            .mockRejectedValueOnce(dupError); // SQL execution fails

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reason = await captureNextUnhandledRejection(async () => {
            await import('../run-migration');
            await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        });

        expect(reason).toMatchObject({
            message: expect.stringContaining('Duplicate object detected'),
        });
        expect(console.error).toHaveBeenCalledWith(
            '❌ Migration failed:',
            expect.objectContaining({
                message: expect.stringContaining('Duplicate object detected'),
            })
        );
    });

    it('throws formatted error when SQL statement fails with duplicate object code 42P16', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        const dupError = Object.assign(
            new Error('multiple primary keys for table "test" are not allowed'),
            { code: '42P16' }
        );
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied
            .mockRejectedValueOnce(dupError); // SQL execution fails

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reason = await captureNextUnhandledRejection(async () => {
            await import('../run-migration');
            await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        });

        expect(reason).toMatchObject({
            message: expect.stringContaining('Duplicate object detected'),
        });
        expect(console.error).toHaveBeenCalledWith(
            '❌ Migration failed:',
            expect.objectContaining({
                message: expect.stringContaining('Duplicate object detected'),
            })
        );
    });

    it('throws formatted error when SQL error message contains "already exists"', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        // Error has no matching code, but message contains "already exists"
        const dupError = new Error('table "users" already exists');
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied
            .mockRejectedValueOnce(dupError); // SQL execution fails

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reason = await captureNextUnhandledRejection(async () => {
            await import('../run-migration');
            await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        });

        expect(reason).toMatchObject({
            message: expect.stringContaining('Duplicate object detected'),
        });
        expect(console.error).toHaveBeenCalledWith(
            '❌ Migration failed:',
            expect.objectContaining({
                message: expect.stringContaining('Duplicate object detected'),
            })
        );
    });

    it('re-throws generic SQL errors that are not duplicate object errors', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue(['0001_init.sql']);
        mockReadFileSync.mockReturnValue('CREATE TABLE test (id INT);');

        const genericError = new Error('column "bad_col" does not exist');
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // create tracking table
            .mockResolvedValueOnce({ rows: [] }) // check if already applied
            .mockRejectedValueOnce(genericError); // generic SQL error

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reason = await captureNextUnhandledRejection(async () => {
            await import('../run-migration');
            await vi.waitFor(() => expect(mockPoolEnd).toHaveBeenCalled());
        });

        // The outer catch re-throws the original error unchanged
        expect(reason).toBe(genericError);
        expect(console.error).toHaveBeenCalledWith(
            '❌ Migration failed:',
            genericError
        );
    });
});
