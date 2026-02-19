/**
 * Unit tests for change-password API endpoint.
 * Tests rate limiting, password validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    mockRequireAuth,
    mockBcryptCompare,
    mockBcryptHash,
    mockDbSelect,
    mockDbUpdate,
} = vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockBcryptCompare: vi.fn(),
    mockBcryptHash: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
}));

// Capture where clauses for verification
const capturedWhereClauses: { select?: unknown; update?: unknown } = {};

// Mock dependencies
vi.mock('../../../lib/api-utils.js', () => ({
    requireAuth: mockRequireAuth,
    jsonResponse: (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    errorResponse: (
        message: string,
        status = 400,
        _errorId?: string,
        headers?: Record<string, string>
    ) =>
        new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json', ...headers },
        }),
}));

vi.mock('../../../lib/drizzle/db.js', () => {
    const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(clause => {
            capturedWhereClauses.select = clause;
            return selectChain;
        }),
        limit: vi.fn().mockImplementation(() => mockDbSelect()),
    };
    const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(clause => {
            capturedWhereClauses.update = clause;
            return mockDbUpdate();
        }),
    };
    return {
        db: {
            select: () => selectChain,
            update: () => updateChain,
        },
    };
});

vi.mock('../../../lib/drizzle/schema.js', () => ({
    accounts: {
        userId: 'userId',
        providerId: 'providerId',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((_a, _b) => `eq(${_a},${_b})`),
    and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
}));

vi.mock('bcryptjs', () => ({
    default: {
        compare: (...args: unknown[]) => mockBcryptCompare(...args),
        hash: (...args: unknown[]) => mockBcryptHash(...args),
    },
}));

vi.mock('../../../lib/logger.js', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('../../../constants/errorIds.js', () => ({
    ERROR_IDS: {
        AUTH_PASSWORD_CHANGE_FAILED: 'AUTH_PASSWORD_CHANGE_FAILED',
    },
}));

// Import after mocks
const { POST } = await import('../auth/change-password');

function createFormRequest(data: Record<string, string>): Request {
    const body = new FormData();
    for (const [key, value] of Object.entries(data)) {
        body.append(key, value);
    }
    return new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        body,
    });
}

describe('change-password API', () => {
    const mockSession = {
        user: { id: 'user-123' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        capturedWhereClauses.select = undefined;
        capturedWhereClauses.update = undefined;
        mockRequireAuth.mockResolvedValue({
            session: mockSession,
            error: null,
        });
        mockDbSelect.mockResolvedValue([
            {
                password: '$2a$10$hashedpass',
                userId: 'user-123',
                providerId: 'credential',
            },
        ]);
        mockBcryptCompare.mockResolvedValue(true);
        mockBcryptHash.mockResolvedValue('$2a$10$newhashedpass');
        mockDbUpdate.mockResolvedValue(undefined);
    });

    it('returns 401 when not authenticated', async () => {
        const authError = new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
        );
        mockRequireAuth.mockResolvedValue({ session: null, error: authError });

        const request = createFormRequest({
            currentPassword: 'old',
            newPassword: 'newpass',
            confirmPassword: 'newpass',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
        const request = createFormRequest({
            currentPassword: 'old',
            // missing newPassword and confirmPassword
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('required');
    });

    it('returns 400 when passwords do not match', async () => {
        const request = createFormRequest({
            currentPassword: 'old',
            newPassword: 'newpass1',
            confirmPassword: 'newpass2',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('match');
    });

    it('returns 400 when new password is too short', async () => {
        const request = createFormRequest({
            currentPassword: 'old',
            newPassword: '12345',
            confirmPassword: '12345',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('6 characters');
    });

    it('successfully changes password', async () => {
        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
    });

    it('returns 429 after too many attempts', async () => {
        // Use a unique user ID for rate limit testing
        const rateLimitSession = {
            user: { id: `user-rate-test-${Date.now()}` },
        };
        mockRequireAuth.mockResolvedValue({
            session: rateLimitSession,
            error: null,
        });
        mockBcryptCompare.mockResolvedValue(false);

        // Make MAX_ATTEMPTS (5) requests to hit the rate limit
        for (let i = 0; i < 5; i++) {
            const request = createFormRequest({
                currentPassword: 'wrongpass',
                newPassword: 'newpass123',
                confirmPassword: 'newpass123',
            });
            await POST({ request } as any);
        }

        // Next request should be rate limited
        const request = createFormRequest({
            currentPassword: 'wrongpass',
            newPassword: 'newpass123',
            confirmPassword: 'newpass123',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(429);
        const body = await response.json();
        expect(body.error).toContain('Too many attempts');
        expect(response.headers.get('Retry-After')).not.toBeNull();
        const retryAfter = parseInt(response.headers.get('Retry-After')!, 10);
        expect(retryAfter).toBeGreaterThan(0);
    });

    it('uses consistent providerId for select and update queries', async () => {
        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(200);

        // Both queries should use 'credential' as the providerId
        const selectClause = String(capturedWhereClauses.select);
        const updateClause = String(capturedWhereClauses.update);

        // Verify that both queries reference 'credential' providerId
        expect(selectClause).toContain('credential');
        expect(updateClause).toContain('credential');
        expect(selectClause).not.toContain('email');
        expect(updateClause).not.toContain('email');
    });
});
