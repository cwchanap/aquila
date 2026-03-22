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
        mockPoolConstructor.mockReset().mockReturnValue({
            query: mockQuery,
            end: mockPoolEnd,
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

        expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('returns early when no .sql migration files are found', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        // Only non-sql files
        mockReaddirSync.mockReturnValue(['readme.txt', 'not-sql.md']);

        await import('../run-migration');

        // Pool.end is still called in finally, but no queries for migration
        expect(mockPoolEnd).toHaveBeenCalled();
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

        expect(mockQuery).toHaveBeenCalledTimes(4);
        expect(mockPoolEnd).toHaveBeenCalled();
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
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(mockPoolEnd).toHaveBeenCalled();
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
        expect(mockQuery).toHaveBeenCalledTimes(7);
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
        expect(mockQuery).toHaveBeenCalledTimes(4);
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
});
