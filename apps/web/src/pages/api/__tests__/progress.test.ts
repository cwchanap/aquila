import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must use vi.hoisted() for variables used in vi.mock()
const { mockGetSession, mockMergeForUser } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockMergeForUser: vi.fn(),
}));

vi.mock('@/lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

vi.mock('../../../lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

vi.mock('@/lib/drizzle/repositories', () => ({
    ReadingProgressRepository: vi.fn(function () {
        return { mergeForUser: mockMergeForUser };
    }),
}));

import { POST } from '../progress';

const validRecord = {
    sceneId: 'act1',
    dialogueIndex: 3,
    updatedAt: 1000,
    finished: false,
    endings: ['ending_a'],
    visited: ['act1'],
};

const post = (body: string | Record<string, unknown>) =>
    POST({
        request: new Request('http://localhost/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
    } as any);

describe('POST /api/progress', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetSession.mockReset();
        mockMergeForUser.mockReset();
        mockGetSession.mockResolvedValue({
            user: { id: 'session-user', email: 'reader@example.com' },
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('rejects anonymous requests before any merge', async () => {
        mockGetSession.mockResolvedValue(null);

        const response = await post({
            progress: { train_adventure: validRecord },
        });

        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe('Unauthorized');
        expect(mockMergeForUser).not.toHaveBeenCalled();
    });

    it('returns 503 when the auth service is degraded', async () => {
        mockGetSession.mockRejectedValue(new Error('Auth service down'));

        const response = await post({ progress: {} });

        expect(response.status).toBe(503);
        expect((await response.json()).error).toBe(
            'Authentication service unavailable'
        );
        expect(mockMergeForUser).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
        const response = await post('{not json');

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('Malformed JSON');
        expect(mockMergeForUser).not.toHaveBeenCalled();
    });

    it.each([{}, { progress: [] }, { progress: null }, { progress: 'map' }])(
        'returns 400 for a malformed body shape %j',
        async body => {
            const response = await post(body);

            expect(response.status).toBe(400);
            expect(mockMergeForUser).not.toHaveBeenCalled();
        }
    );

    it('returns 409 when the upload names a different account than the session', async () => {
        // A tab that outlived its sign-in still carries the previous
        // account's id; its map must not merge into the new session's row.
        const response = await post({
            progress: { train_adventure: validRecord },
            accountId: 'previous-account',
        });

        expect(response.status).toBe(409);
        expect(mockMergeForUser).not.toHaveBeenCalled();
    });

    it('returns 413 for a body over 48 KiB of UTF-8 bytes without Content-Length', async () => {
        const body = JSON.stringify({
            progress: { train_adventure: { note: 'é'.repeat(24 * 1024) } },
            accountId: 'session-user',
        });
        // Under the cap as JavaScript characters, over it as UTF-8 bytes.
        expect(body.length).toBeLessThan(48 * 1024);
        expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(
            48 * 1024
        );

        const request = new Request('http://localhost/api/progress', {
            method: 'POST',
            body,
        });
        expect(request.headers.has('content-length')).toBe(false);

        const response = await POST({ request } as any);

        expect(response.status).toBe(413);
        expect(mockMergeForUser).not.toHaveBeenCalled();
    });

    it('merges the sanitized map for the session user and returns it', async () => {
        const merged = {
            train_adventure: { ...validRecord, dialogueIndex: 9 },
        };
        mockMergeForUser.mockResolvedValue(merged);

        const response = await post({
            progress: { train_adventure: validRecord },
            accountId: 'session-user',
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ progress: merged });
        expect(mockMergeForUser).toHaveBeenCalledTimes(1);
        expect(mockMergeForUser).toHaveBeenCalledWith('session-user', {
            train_adventure: validRecord,
        });
    });

    it('drops malformed individual records instead of failing the request', async () => {
        mockMergeForUser.mockResolvedValue({ valid: validRecord });

        const response = await post({
            progress: {
                valid: validRecord,
                invalid: { sceneId: 42 },
                empty: null,
            },
            accountId: 'session-user',
        });

        expect(response.status).toBe(200);
        expect(mockMergeForUser).toHaveBeenCalledWith('session-user', {
            valid: validRecord,
        });
    });

    it('returns 500 when the repository fails', async () => {
        mockMergeForUser.mockRejectedValue(new Error('Database failure'));

        const response = await post({
            progress: {},
            accountId: 'session-user',
        });

        expect(response.status).toBe(500);
        expect((await response.json()).error).toBe(
            'Failed to sync reading progress'
        );
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});
