import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Remove the global mock registered by test-setup.ts so we can test the real implementation
vi.unmock('@/lib/drizzle/db.js');

// Mock external dependencies used by db.ts
const mockPoolConstructor = vi.fn();
vi.mock('pg', () => ({
    Pool: mockPoolConstructor,
}));

const mockDrizzleFn = vi.fn();
vi.mock('drizzle-orm/node-postgres', () => ({
    drizzle: mockDrizzleFn,
}));

describe('Database module (db.ts)', () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // Save env vars that db.ts reads
        for (const key of [
            'DATABASE_URL',
            'NODE_ENV',
            'DB_ALLOW_SELF_SIGNED',
            'DB_POOL_MAX',
        ]) {
            savedEnv[key] = process.env[key];
        }

        mockPoolConstructor.mockClear();
        mockPoolConstructor.mockReturnValue({ isPool: true });
        mockDrizzleFn.mockClear();
        mockDrizzleFn.mockReturnValue({ select: vi.fn(), insert: vi.fn() });

        // Reset module registry so _db module-level cache is cleared each test
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

    it('throws when DATABASE_URL is not set', async () => {
        delete process.env.DATABASE_URL;
        const { db } = await import('../db');
        expect(() => (db as unknown as Record<string, unknown>).select).toThrow(
            'DATABASE_URL environment variable is not set'
        );
    });

    it('creates Pool with the DATABASE_URL connection string', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        delete process.env.DB_ALLOW_SELF_SIGNED;

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString: 'postgres://localhost/testdb',
            })
        );
    });

    it('sets ssl=false when not production and DB_ALLOW_SELF_SIGNED is not set', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        delete process.env.DB_ALLOW_SELF_SIGNED;

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ ssl: false })
        );
    });

    it('sets ssl.rejectUnauthorized=true in production without self-signed', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'production';
        delete process.env.DB_ALLOW_SELF_SIGNED;

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                ssl: { rejectUnauthorized: true },
            })
        );
    });

    it('sets ssl.rejectUnauthorized=false in production with DB_ALLOW_SELF_SIGNED=true', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'production';
        process.env.DB_ALLOW_SELF_SIGNED = 'true';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                ssl: { rejectUnauthorized: false },
            })
        );
    });

    it('sets ssl.rejectUnauthorized=false outside production with DB_ALLOW_SELF_SIGNED=true', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'development';
        process.env.DB_ALLOW_SELF_SIGNED = 'true';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                ssl: { rejectUnauthorized: false },
            })
        );
    });

    it('uses default pool max of 10 when DB_POOL_MAX is not set', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        delete process.env.DB_POOL_MAX;

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ max: 10 })
        );
    });

    it('uses custom pool max when DB_POOL_MAX is a valid positive integer', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        process.env.DB_POOL_MAX = '5';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ max: 5 })
        );
    });

    it('falls back to default 10 when DB_POOL_MAX is not a valid number', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        process.env.DB_POOL_MAX = 'not-a-number';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ max: 10 })
        );
    });

    it('falls back to default 10 when DB_POOL_MAX is zero', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        process.env.DB_POOL_MAX = '0';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ max: 10 })
        );
    });

    it('falls back to default 10 when DB_POOL_MAX is negative', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';
        process.env.DB_POOL_MAX = '-1';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ max: 10 })
        );
    });

    it('calls drizzle with the Pool instance and schema', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockDrizzleFn).toHaveBeenCalledWith(
            { isPool: true },
            expect.objectContaining({ schema: expect.any(Object) })
        );
    });

    it('caches the db instance — Pool constructor called only once per module lifecycle', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;
        void (db as unknown as Record<string, unknown>).insert;
        void (db as unknown as Record<string, unknown>).update;

        expect(mockPoolConstructor).toHaveBeenCalledTimes(1);
        expect(mockDrizzleFn).toHaveBeenCalledTimes(1);
    });

    it('forwards property access to the underlying drizzle instance', async () => {
        process.env.DATABASE_URL = 'postgres://localhost/testdb';
        process.env.NODE_ENV = 'test';

        const mockSelectFn = vi.fn();
        mockDrizzleFn.mockReturnValue({ select: mockSelectFn });

        const { db } = await import('../db');
        const selectProp = (db as unknown as Record<string, unknown>).select;

        expect(selectProp).toBe(mockSelectFn);
    });
});
