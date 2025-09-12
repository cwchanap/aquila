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

// Mock @libsql/client
vi.mock('@libsql/client', () => ({
    createClient: vi.fn(() => ({
        execute: vi.fn(),
        batch: vi.fn(),
        close: vi.fn(),
    })),
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

// Mock Kysely
vi.mock('kysely', () => ({
    Kysely: vi.fn(() => ({
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        destroy: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('@libsql/kysely-libsql', () => ({
    LibsqlDialect: vi.fn(() => ({})),
}));
