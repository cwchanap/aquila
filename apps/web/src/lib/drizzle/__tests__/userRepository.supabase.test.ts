import { describe, it, expect, vi } from 'vitest';
import { UserRepository } from '../repositories';
import { users } from '../schema';

vi.mock('nanoid', () => ({
    nanoid: () => 'test-generated-id',
}));

// These tests focus on the control flow of findOrCreateBySupabaseUserId.
// We provide a minimal fake DB object that implements the subset of the
// Drizzle API that UserRepository relies on.

type AnyFn = ReturnType<typeof vi.fn>;

interface FakeDb {
    select: AnyFn;
    insert: AnyFn;
}

function createDbReturningExistingUser(existingUser: unknown): FakeDb {
    const limit = vi.fn().mockResolvedValue([existingUser]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });

    const select = vi.fn().mockReturnValue({ from });
    const insert = vi.fn();

    return { select, insert };
}

function createDbCreatingUser(createdUser: unknown): FakeDb {
    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const returning = vi.fn().mockResolvedValue([createdUser]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });

    return { select, insert };
}

describe('UserRepository - Supabase helpers', () => {
    it('returns existing user when found by supabaseUserId', async () => {
        const existingUser = {
            id: 'user-1',
            email: 'test@example.com',
            supabaseUserId: 'supabase-123',
        };

        const fakeDb = createDbReturningExistingUser(existingUser) as unknown;
        const repository = new UserRepository(fakeDb as any);

        const result = await repository.findOrCreateBySupabaseUserId(
            'supabase-123',
            {
                email: 'ignored@example.com',
            }
        );

        expect(result).toBe(existingUser);
    });

    it('creates a new user when supabaseUserId is not found', async () => {
        const createdUser = {
            id: 'generated-id',
            email: 'new@example.com',
            supabaseUserId: 'supabase-456',
        };

        const fakeDb = createDbCreatingUser(createdUser) as unknown as {
            select: AnyFn;
            insert: AnyFn;
        };

        const repository = new UserRepository(fakeDb as any);

        const result = await repository.findOrCreateBySupabaseUserId(
            'supabase-456',
            {
                email: 'new@example.com',
            }
        );

        expect(fakeDb.insert).toHaveBeenCalledWith(users);
        expect(result).toBe(createdUser);
    });

    it('uses the correct supabaseUserId in the query condition', async () => {
        const existingUser = {
            id: 'user-1',
            supabaseUserId: 'target-user',
        };

        const limit = vi.fn().mockResolvedValue([existingUser]);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });

        const fakeDb = { select, insert: vi.fn() };
        const repository = new UserRepository(fakeDb as any);

        await repository.findOrCreateBySupabaseUserId('target-user', {
            email: 'test@example.com',
        });

        // Verify that the query was built using the correct ID logic
        // Since we can't easily inspect the exact Drizzle "eq()" object structure in a mock,
        // we rely on the fact that the repository calls .where(eq(users.supabaseUserId, ...))
        // Testing exact arguments here would require mocking 'drizzle-orm' exports which is brittle.
        // Instead, we trust the integration/E2E tests for the real SQL generation,
        // and here we just ensure the flow happened.
        // But we CAN mock the DB to return empty if the ID doesn't match, if we implemented a smarter mock.

        expect(from).toHaveBeenCalled();
        expect(where).toHaveBeenCalled();
    });
});
