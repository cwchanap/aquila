/**
 * Tests for the rate-limit cleanup interval in change-password.ts.
 * Uses vi.useFakeTimers() so the setInterval fires on demand.
 */
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    afterAll,
} from 'vitest';

// Enable fake timers BEFORE module import so setInterval uses them
vi.useFakeTimers();

const mockRequireAuth = vi.fn();
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
const mockFindCredentialAccount = vi.fn();
const mockUpdatePassword = vi.fn();

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
    logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../constants/errorIds.js', () => ({
    ERROR_IDS: { AUTH_PASSWORD_CHANGE_FAILED: 'AUTH_PASSWORD_CHANGE_FAILED' },
}));

// Import the module AFTER mocks and fake timers are established
const { POST } = await import('../auth/change-password');

function makeFormRequest(data: Record<string, string>): Request {
    const body = new FormData();
    for (const [k, v] of Object.entries(data)) body.append(k, v);
    return new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        body,
    });
}

describe('change-password cleanup interval', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireAuth.mockResolvedValue({
            session: { user: { id: 'user-cleanup-test' } },
            error: null,
        });
        mockFindCredentialAccount.mockResolvedValue({
            password: '$2a$10$hash',
            userId: 'user-cleanup-test',
            providerId: 'credential',
        });
        // Return false so recordFailedAttempt() is called → rateLimitMap is populated
        mockBcryptCompare.mockResolvedValue(false);
        mockBcryptHash.mockResolvedValue('$2a$10$newhash');
        mockUpdatePassword.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it('cleanup interval fires and removes stale rate-limit entries (covers lines 38-44)', async () => {
        const formData = {
            currentPassword: 'wrongpass',
            newPassword: 'Newpass123!',
            confirmPassword: 'Newpass123!',
        };

        // Make 4 failed attempts to accumulate towards the 5-attempt lockout threshold.
        // Each returns 400 (wrong password, not yet locked).
        for (let i = 0; i < 4; i++) {
            const res = await POST({
                request: makeFormRequest(formData),
            } as any);
            expect(res.status).toBe(400);
        }

        // Advance time beyond ENTRY_TTL_MS (30 min); the cleanup interval fires and
        // removes the stale entry from rateLimitMap.
        vi.advanceTimersByTime(31 * 60 * 1000);

        // 5th attempt: if cleanup ran the entry was removed, so attempts reset to 1
        // and the response is 400 (wrong password), NOT 429 (locked out).
        const fifthRes = await POST({
            request: makeFormRequest(formData),
        } as any);
        expect(fifthRes.status).toBe(400);
    });
});
