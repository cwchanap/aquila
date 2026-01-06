import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRepo = vi.hoisted(() => ({
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));

const UserRepository = vi.hoisted(() => vi.fn(() => mockRepo));

vi.mock('../../../lib/drizzle/repositories.js', () => ({
    UserRepository,
}));

import { GET, POST, PUT, DELETE } from '../users';

describe('Users API', () => {
    beforeEach(() => {
        UserRepository.mockClear();
        mockRepo.findById.mockReset();
        mockRepo.findByEmail.mockReset();
        mockRepo.findByUsername.mockReset();
        mockRepo.list.mockReset();
        mockRepo.create.mockReset();
        mockRepo.update.mockReset();
        mockRepo.delete.mockReset();
    });

    describe('GET /api/users', () => {
        it('returns a user by id', async () => {
            mockRepo.findById.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GET({
                url: new URL('http://localhost/api/users?id=user123'),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.findById).toHaveBeenCalledWith('user123');
        });

        it('returns 404 when user id is not found', async () => {
            mockRepo.findById.mockResolvedValue(null);

            const response = await GET({
                url: new URL('http://localhost/api/users?id=missing'),
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
        });

        it('returns a user by email', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GET({
                url: new URL(
                    'http://localhost/api/users?email=test@example.com'
                ),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'test@example.com'
            );
        });

        it('returns a user by username', async () => {
            mockRepo.findByUsername.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GET({
                url: new URL('http://localhost/api/users?username=tester'),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.findByUsername).toHaveBeenCalledWith('tester');
        });

        it('lists users when no filters are provided', async () => {
            mockRepo.list.mockResolvedValue([
                { id: 'user123', email: 'test@example.com' },
            ]);

            const response = await GET({
                url: new URL('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual([
                { id: 'user123', email: 'test@example.com' },
            ]);
            expect(mockRepo.list).toHaveBeenCalledWith(50, 0);
        });
    });

    describe('POST /api/users', () => {
        it('returns 400 when required fields are missing', async () => {
            const response = await POST({
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'test@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Missing required fields: email, username',
            });
        });

        it('creates a user when input is valid', async () => {
            mockRepo.create.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await POST({
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'test@example.com',
                            username: 'tester',
                        }),
                },
            } as any);

            expect(response.status).toBe(201);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                username: 'tester',
            });
        });
    });

    describe('PUT /api/users', () => {
        it('returns 400 when id is missing', async () => {
            const response = await PUT({
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'User ID is required',
            });
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.update.mockResolvedValue(null);

            const response = await PUT({
                request: {
                    json: () =>
                        Promise.resolve({
                            id: 'missing',
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
        });

        it('updates a user', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'updated@example.com',
                username: 'tester',
            });

            const response = await PUT({
                request: {
                    json: () =>
                        Promise.resolve({
                            id: 'user123',
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'updated@example.com',
                username: 'tester',
            });
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                email: 'updated@example.com',
            });
        });
    });

    describe('DELETE /api/users', () => {
        it('returns 400 when id is missing', async () => {
            const response = await DELETE({
                url: new URL('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'User ID is required',
            });
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.delete.mockResolvedValue(null);

            const response = await DELETE({
                url: new URL('http://localhost/api/users?id=missing'),
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
        });

        it('deletes a user', async () => {
            mockRepo.delete.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
            });

            const response = await DELETE({
                url: new URL('http://localhost/api/users?id=user123'),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                message: 'User deleted successfully',
            });
            expect(mockRepo.delete).toHaveBeenCalledWith('user123');
        });
    });
});
