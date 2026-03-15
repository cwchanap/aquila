import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks to ensure they're available before imports
function createChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};

    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.into = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);

    return chain;
}

const mockDb = vi.hoisted(() => createChain());

vi.mock('../db.js', () => ({
    db: mockDb,
}));

import { BaseRepository } from '../base-repository';
import type { DrizzleDB } from '../db';

// Concrete subclass for testing the abstract BaseRepository
type TestRecord = { id: string; name: string };

class TestRepository extends BaseRepository<any, TestRecord> {
    protected table = { _: { name: 'test_table' } } as any;
    protected idColumn = { name: 'id' } as any;
}

describe('BaseRepository', () => {
    let repo: TestRepository;

    beforeEach(() => {
        // Reset chain methods
        const chainMethods = [
            'select',
            'insert',
            'update',
            'delete',
            'from',
            'into',
            'values',
            'set',
            'where',
            'limit',
            'offset',
            'orderBy',
            'returning',
        ];
        chainMethods.forEach(key => {
            mockDb[key].mockReset();
            mockDb[key].mockReturnValue(mockDb);
        });

        repo = new TestRepository(mockDb as unknown as DrizzleDB);
    });

    describe('constructor', () => {
        it('uses provided db instance', () => {
            const customRepo = new TestRepository(
                mockDb as unknown as DrizzleDB
            );
            expect(customRepo).toBeInstanceOf(TestRepository);
        });

        it('falls back to default db when no instance provided', () => {
            // This will use the mocked db from '../db.js'
            const defaultRepo = new TestRepository();
            expect(defaultRepo).toBeInstanceOf(TestRepository);
        });
    });

    describe('findById()', () => {
        it('returns the record when found', async () => {
            const mockRecord: TestRecord = {
                id: 'record-1',
                name: 'Test Record',
            };
            mockDb.limit.mockResolvedValue([mockRecord]);

            const result = await repo.findById('record-1');

            expect(result).toEqual(mockRecord);
        });

        it('returns undefined when no record is found', async () => {
            mockDb.limit.mockResolvedValue([]);

            const result = await repo.findById('nonexistent-id');

            expect(result).toBeUndefined();
        });

        it('calls select on the db', async () => {
            mockDb.limit.mockResolvedValue([]);

            await repo.findById('test-id');

            expect(mockDb.select).toHaveBeenCalledTimes(1);
        });

        it('calls from with the table', async () => {
            mockDb.limit.mockResolvedValue([]);

            await repo.findById('test-id');

            expect(mockDb.from).toHaveBeenCalledWith(repo['table']);
        });

        it('calls where with the id condition', async () => {
            mockDb.limit.mockResolvedValue([]);

            await repo.findById('test-id');

            expect(mockDb.where).toHaveBeenCalledTimes(1);
        });

        it('calls limit(1) to restrict results', async () => {
            mockDb.limit.mockResolvedValue([]);

            await repo.findById('test-id');

            expect(mockDb.limit).toHaveBeenCalledWith(1);
        });

        it('returns only the first result when multiple records returned', async () => {
            const records: TestRecord[] = [
                { id: 'record-1', name: 'First' },
                { id: 'record-2', name: 'Second' },
            ];
            mockDb.limit.mockResolvedValue(records);

            const result = await repo.findById('record-1');

            expect(result).toEqual(records[0]);
        });
    });

    describe('delete()', () => {
        it('returns true when a record was deleted', async () => {
            mockDb.returning.mockResolvedValue([{ id: 'record-1' }]);

            const result = await repo.delete('record-1');

            expect(result).toBe(true);
        });

        it('returns false when no record was deleted', async () => {
            mockDb.returning.mockResolvedValue([]);

            const result = await repo.delete('nonexistent-id');

            expect(result).toBe(false);
        });

        it('calls delete on the db', async () => {
            mockDb.returning.mockResolvedValue([]);

            await repo.delete('test-id');

            expect(mockDb.delete).toHaveBeenCalledTimes(1);
        });

        it('calls delete with the table', async () => {
            mockDb.returning.mockResolvedValue([]);

            await repo.delete('test-id');

            expect(mockDb.delete).toHaveBeenCalledWith(repo['table']);
        });

        it('calls where with the id condition', async () => {
            mockDb.returning.mockResolvedValue([]);

            await repo.delete('test-id');

            expect(mockDb.where).toHaveBeenCalledTimes(1);
        });

        it('calls returning to get deleted record ids', async () => {
            mockDb.returning.mockResolvedValue([]);

            await repo.delete('test-id');

            expect(mockDb.returning).toHaveBeenCalledTimes(1);
        });

        it('returns true when multiple records deleted', async () => {
            mockDb.returning.mockResolvedValue([
                { id: 'record-1' },
                { id: 'record-2' },
            ]);

            const result = await repo.delete('record-1');

            expect(result).toBe(true);
        });
    });
});
