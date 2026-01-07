import { vi, beforeEach } from 'vitest';

// Mock crypto.randomUUID for consistent test results
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: vi.fn(() => 'test-uuid-123'),
    },
});

// Mock Date.now for consistent timestamps
const mockNow = new Date('2024-01-01T00:00:00.000Z');
vi.useFakeTimers();
vi.setSystemTime(mockNow);

// Mock environment variables
process.env.BETTER_AUTH_URL = 'http://localhost:5090';
process.env.BETTER_AUTH_SECRET = 'test-secret';
process.env.TURSO_DATABASE_URL = 'http://127.0.0.1:8080';
process.env.TURSO_AUTH_TOKEN = 'test-token';

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed-password'),
        compare: vi.fn().mockResolvedValue(true),
    },
}));

// Mock better-auth
vi.mock('better-auth', () => ({
    betterAuth: vi.fn(() => ({
        $Infer: {
            Session: {
                user: {
                    id: 'string',
                    email: 'string',
                    name: 'string',
                    username: 'string',
                },
            },
        },
    })),
}));

vi.mock('better-auth/client', () => ({
    createAuthClient: vi.fn(() => ({
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        useSession: vi.fn(),
    })),
}));

// Mock Drizzle DB instance used in tests
type DbMockChain = {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    into: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
    executeTakeFirst: ReturnType<typeof vi.fn>;
    executeTakeFirstOrThrow: ReturnType<typeof vi.fn>;
};

const createDbMock = (): DbMockChain => {
    const chain = {} as DbMockChain;

    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.into = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.andWhere = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.execute = vi.fn(async () => []);
    chain.executeTakeFirst = vi.fn(async () => undefined);
    chain.executeTakeFirstOrThrow = vi.fn(async () => {
        throw new Error('No rows found');
    });

    return chain;
};

// Export factory function for tests that need isolated mocks
export const createFreshDbMock = createDbMock;

/**
 * Database Mock Usage Patterns:
 *
 * 1. Global Shared Mock (default):
 *    - All tests share the same dbMockInstance
 *    - Automatically reset between tests via global beforeEach
 *    - Suitable for most tests that don't modify mock behavior extensively
 *
 * 2. Isolated Mock per Test:
 *    - Import createFreshDbMock and use it in individual tests
 *    - Completely isolated - no state sharing between tests
 *    - Suitable for tests that need specific mock behaviors or heavy customization
 *
 * Example usage for isolated mocks:
 * ```typescript
 * import { createFreshDbMock } from '../test-setup';
 *
 * describe('My Test', () => {
 *   it('should work with isolated mock', () => {
 *     const db = createFreshDbMock();
 *     // Configure db mock for this specific test
 *     db.select.mockReturnValue(db);
 *     db.execute.mockResolvedValue([{ id: '1' }]);
 *
 *     // Use db in your test
 *   });
 * });
 * ```
 */

// Create shared instance for backward compatibility, but provide reset mechanism
const dbMockInstance = createDbMock();

// Reset function to restore default behaviors
export const resetDbMock = () => {
    const chainReturningMethods: Array<keyof DbMockChain> = [
        'select',
        'insert',
        'update',
        'delete',
        'from',
        'into',
        'values',
        'set',
        'where',
        'andWhere',
        'innerJoin',
        'limit',
        'returning',
    ];

    chainReturningMethods.forEach(method => {
        dbMockInstance[method].mockReset();
        dbMockInstance[method].mockReturnValue(dbMockInstance);
    });

    dbMockInstance.execute.mockReset();
    dbMockInstance.execute.mockResolvedValue([]);

    dbMockInstance.executeTakeFirst.mockReset();
    dbMockInstance.executeTakeFirst.mockResolvedValue(undefined);

    dbMockInstance.executeTakeFirstOrThrow.mockReset();
    dbMockInstance.executeTakeFirstOrThrow.mockImplementation(async () => {
        throw new Error('No rows found');
    });
};

// Global beforeEach to reset database mock between tests
// This prevents state leakage between tests that use the shared dbMockInstance
beforeEach(() => {
    resetDbMock();
});

vi.mock('./drizzle/db.js', () => ({
    db: dbMockInstance,
}));

/**
 * Creates a mock request object for API route testing.
 * This helper is used across multiple test files to simulate Astro request objects.
 *
 * @param cookie - Optional cookie string to set in the request headers
 * @param json - Optional function that returns a Promise with JSON body data
 * @returns A mock request object compatible with Astro API routes
 *
 * @example
 * ```typescript
 * // Simple request without auth
 * const request = makeRequest();
 *
 * // Request with session cookie
 * const request = makeRequest('session=abc123');
 *
 * // Request with JSON body
 * const request = makeRequest('session=abc123', () =>
 *   Promise.resolve({ title: 'My Story' })
 * );
 * ```
 */
export const makeRequest = (
    cookie?: string,
    json?: () => Promise<Record<string, unknown>>
) =>
    ({
        headers: {
            get: (name: string) =>
                name === 'cookie' ? (cookie ?? null) : null,
        },
        json,
    }) as {
        headers: { get: (name: string) => string | null };
        json?: () => Promise<Record<string, unknown>>;
    };
