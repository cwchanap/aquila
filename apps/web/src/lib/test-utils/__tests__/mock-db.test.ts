import { describe, it, expect } from 'vitest';
import { createMockDb, createMockRepository } from '../mock-db';

describe('mock-db test utilities', () => {
    describe('createMockDb', () => {
        it('returns an object with all query chain methods', () => {
            const db = createMockDb();
            expect(typeof db.select).toBe('function');
            expect(typeof db.from).toBe('function');
            expect(typeof db.where).toBe('function');
            expect(typeof db.limit).toBe('function');
            expect(typeof db.orderBy).toBe('function');
            expect(typeof db.offset).toBe('function');
            expect(typeof db.innerJoin).toBe('function');
            expect(typeof db.leftJoin).toBe('function');
            expect(typeof db.insert).toBe('function');
            expect(typeof db.values).toBe('function');
            expect(typeof db.update).toBe('function');
            expect(typeof db.set).toBe('function');
            expect(typeof db.delete).toBe('function');
            expect(typeof db.returning).toBe('function');
            expect(typeof db.transaction).toBe('function');
        });

        it('chain methods return the same chain object (fluent interface)', () => {
            const db = createMockDb();
            expect(db.select()).toBe(db);
            expect(db.from()).toBe(db);
            expect(db.where()).toBe(db);
            expect(db.limit()).toBe(db);
            expect(db.orderBy()).toBe(db);
            expect(db.offset()).toBe(db);
            expect(db.innerJoin()).toBe(db);
            expect(db.leftJoin()).toBe(db);
            expect(db.insert()).toBe(db);
            expect(db.values()).toBe(db);
            expect(db.update()).toBe(db);
            expect(db.set()).toBe(db);
            expect(db.delete()).toBe(db);
        });

        it('returning resolves to empty array by default', async () => {
            const db = createMockDb();
            const result = await db.returning();
            expect(result).toEqual([]);
        });

        it('transaction calls the callback with a new mock db', async () => {
            const db = createMockDb();
            const result = await db.transaction(async tx => {
                expect(typeof tx.select).toBe('function');
                return 'done';
            });
            expect(result).toBe('done');
        });
    });

    describe('createMockRepository', () => {
        it('returns an object with all CRUD methods as vi.fn', () => {
            const repo = createMockRepository<{ id: string; name: string }>();
            expect(typeof repo.findById).toBe('function');
            expect(typeof repo.findByUser).toBe('function');
            expect(typeof repo.findByUserId).toBe('function');
            expect(typeof repo.create).toBe('function');
            expect(typeof repo.update).toBe('function');
            expect(typeof repo.delete).toBe('function');
            expect(typeof repo.list).toBe('function');
        });

        it('mock methods can be configured to return values', async () => {
            const repo = createMockRepository<{ id: string; name: string }>();
            const mockItem = { id: '1', name: 'Test' };
            repo.findById.mockResolvedValue(mockItem);

            const result = await repo.findById('1');
            expect(result).toEqual(mockItem);
        });

        it('mock methods can be configured to return arrays', async () => {
            const repo = createMockRepository<{ id: string; name: string }>();
            const items = [
                { id: '1', name: 'A' },
                { id: '2', name: 'B' },
            ];
            repo.findByUserId.mockResolvedValue(items);

            const result = await repo.findByUserId('user-1');
            expect(result).toEqual(items);
        });
    });
});
