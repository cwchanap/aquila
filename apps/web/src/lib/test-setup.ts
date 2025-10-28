import { vi } from 'vitest';

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

const dbMockInstance = createDbMock();

vi.mock('./drizzle/db.js', () => ({
    db: dbMockInstance,
}));
