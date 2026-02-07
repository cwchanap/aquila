/**
 * Mock database utilities for testing repositories.
 */
import { vi } from 'vitest';

/**
 * Create a mock Drizzle DB instance with chainable query methods.
 */
export function createMockDb() {
    const mockChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        transaction: vi.fn(
            (fn: (tx: ReturnType<typeof createMockDb>) => Promise<unknown>) =>
                fn(createMockDb())
        ),
    };
    return mockChain;
}

/**
 * Create a mock repository with common methods.
 */
export function createMockRepository<T>() {
    return {
        findById: vi.fn<[string], Promise<T | undefined>>(),
        findByUser: vi.fn<[string], Promise<T[]>>(),
        findByUserId: vi.fn<[string], Promise<T[]>>(),
        create: vi.fn<[Partial<T>], Promise<T>>(),
        update: vi.fn<[string, Partial<T>], Promise<T | undefined>>(),
        delete: vi.fn<[string], Promise<boolean>>(),
        list: vi.fn<[number?, number?], Promise<T[]>>(),
    };
}
