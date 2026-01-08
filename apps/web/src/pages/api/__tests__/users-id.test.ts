import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRepo = vi.hoisted(() => ({
    delete: vi.fn(),
}));

const UserRepository = vi.hoisted(() => vi.fn(() => mockRepo));

vi.mock('../../../lib/drizzle/repositories.js', () => ({
    UserRepository,
}));

import { DELETE } from '@/pages/api/users/[id]';

describe('Users API - DELETE /api/users/[id]', () => {
    beforeEach(() => {
        UserRepository.mockClear();
        mockRepo.delete.mockReset();
    });

    describe('DELETE /api/users/[id]', () => {
        it('returns 400 when id is missing', async () => {
            const response = await DELETE({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.delete).not.toHaveBeenCalled();
        });

        it('returns 400 when id is empty string', async () => {
            const response = await DELETE({
                params: { id: '' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.delete).not.toHaveBeenCalled();
        });

        it('returns 400 when id is whitespace only', async () => {
            const response = await DELETE({
                params: { id: '   ' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.delete).not.toHaveBeenCalled();
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.delete.mockResolvedValue(null);

            const response = await DELETE({
                params: { id: 'missing' },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
            expect(mockRepo.delete).toHaveBeenCalledWith('missing');
        });

        it('deletes a user successfully', async () => {
            mockRepo.delete.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await DELETE({
                params: { id: 'user123' },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                message: 'User deleted successfully',
            });
            expect(mockRepo.delete).toHaveBeenCalledWith('user123');
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.delete.mockRejectedValue(new Error('Database error'));

            const response = await DELETE({
                params: { id: 'user123' },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
            expect(mockRepo.delete).toHaveBeenCalledWith('user123');
        });
    });
});
