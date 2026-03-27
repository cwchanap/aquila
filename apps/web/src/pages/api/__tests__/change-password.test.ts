/**
 * Unit tests for change-password API endpoint.
 * Tests rate limiting, password validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    mockRequireAuth,
    mockBcryptCompare,
    mockBcryptHash,
    mockFindCredentialAccount,
    mockUpdatePassword,
} = vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockBcryptCompare: vi.fn(),
    mockBcryptHash: vi.fn(),
    mockFindCredentialAccount: vi.fn(),
    mockUpdatePassword: vi.fn(),
}));

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

vi.mock('../../../lib/drizzle/repositories.js', () => ({
    AccountRepository: vi.fn().mockImplementation(function () {
        return {
            findCredentialAccount: mockFindCredentialAccount,
            updatePassword: mockUpdatePassword,
        };
    }),
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
        mockRequireAuth.mockResolvedValue({
            session: mockSession,
            error: null,
        });
        mockFindCredentialAccount.mockResolvedValue({
            password: '$2a$10$hashedpass',
            userId: 'user-123',
            providerId: 'credential',
        });
        mockBcryptCompare.mockResolvedValue(true);
        mockBcryptHash.mockResolvedValue('$2a$10$newhashedpass');
        mockUpdatePassword.mockResolvedValue(undefined);
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

    it('returns 404 when no credential account exists for the user', async () => {
        mockFindCredentialAccount.mockResolvedValue(null);

        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toContain('Account not found');
    });

    it('returns 400 when current password is incorrect', async () => {
        mockBcryptCompare.mockResolvedValue(false);

        const request = createFormRequest({
            currentPassword: 'wrongpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('incorrect');
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

    it('returns 429 after too many failed password attempts', async () => {
        // Use a unique user ID for rate limit testing to avoid cross-test contamination
        const rateLimitUserId = `user-rate-test-${Date.now()}`;
        const rateLimitSession = { user: { id: rateLimitUserId } };
        mockRequireAuth.mockResolvedValue({
            session: rateLimitSession,
            error: null,
        });
        // Wrong password triggers rate limit counting
        mockBcryptCompare.mockResolvedValue(false);

        // Make MAX_ATTEMPTS (5) requests with wrong password to hit the rate limit
        for (let i = 0; i < 5; i++) {
            const request = createFormRequest({
                currentPassword: 'wrongpass',
                newPassword: 'newpass123',
                confirmPassword: 'newpass123',
            });
            await POST({ request } as any);
        }

        // The 5th request should trigger lockout, so subsequent requests are also locked
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

    it('does not count validation failures toward the rate limit', async () => {
        // Use a unique user ID for this test
        const userId = `user-validation-test-${Date.now()}`;
        const session = { user: { id: userId } };
        mockRequireAuth.mockResolvedValue({ session, error: null });

        // Make 10 requests that fail validation (missing fields) - should NOT count toward rate limit
        for (let i = 0; i < 10; i++) {
            const request = createFormRequest({ currentPassword: 'old' });
            const response = await POST({ request } as any);
            expect(response.status).toBe(400);
        }

        // A valid request should still succeed (not rate limited)
        mockBcryptCompare.mockResolvedValue(true);
        const validRequest = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });
        const response = await POST({ request: validRequest } as any);
        expect(response.status).toBe(200);
    });

    it('uses credential providerId for account lookup and update', async () => {
        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(200);

        // Both repository calls should use the authenticated user's ID
        expect(mockFindCredentialAccount).toHaveBeenCalledWith('user-123');
        expect(mockUpdatePassword).toHaveBeenCalledWith(
            'user-123',
            expect.stringMatching(/^\$2/)
        );
    });

    it('returns 400 when new password is too long', async () => {
        const longPassword = 'a'.repeat(257); // exceeds MAX_PASSWORD_LENGTH (256)
        const request = createFormRequest({
            currentPassword: 'old',
            newPassword: longPassword,
            confirmPassword: longPassword,
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('256 characters');
    });

    it('returns 500 on unexpected internal error', async () => {
        mockRequireAuth.mockRejectedValueOnce(new Error('Unexpected failure'));

        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toContain('Failed to change password');
    });

    it('returns 404 when account has no password field', async () => {
        mockFindCredentialAccount.mockResolvedValue({
            userId: 'user-123',
            providerId: 'credential',
            password: null, // no password
        });

        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toContain('Account not found');
    });

    it('successfully changes password for legacy users with email providerId', async () => {
        // Simulate a legacy account with providerId 'email' (from Simple Auth)
        mockFindCredentialAccount.mockResolvedValue({
            password: '$2a$10$hashedpass',
            userId: 'user-legacy-123',
            providerId: 'email',
        });

        const legacySession = { user: { id: 'user-legacy-123' } };
        mockRequireAuth.mockResolvedValue({
            session: legacySession,
            error: null,
        });

        const request = createFormRequest({
            currentPassword: 'oldpass',
            newPassword: 'newpassword',
            confirmPassword: 'newpassword',
        });

        const response = await POST({ request } as any);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        // Verify repository was called with the legacy user ID
        expect(mockFindCredentialAccount).toHaveBeenCalledWith(
            'user-legacy-123'
        );
        expect(mockUpdatePassword).toHaveBeenCalledWith(
            'user-legacy-123',
            expect.stringMatching(/^\$2/)
        );
    });
});
