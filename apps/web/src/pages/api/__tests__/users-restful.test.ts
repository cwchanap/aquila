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

import { GET, POST } from '../users';
import {
    GET as GetById,
    PUT as UpdateById,
    DELETE as DeleteById,
} from '../users/[id]';
import { GET as GetByEmail } from '../users/by-email/[email]';
import { GET as GetByUsername } from '../users/by-username/[username]';

describe('Users API - RESTful Design', () => {
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
        it('lists users with default pagination', async () => {
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

        it('lists users with custom pagination', async () => {
            mockRepo.list.mockResolvedValue([
                { id: 'user123', email: 'test@example.com' },
            ]);

            const response = await GET({
                url: new URL('http://localhost/api/users?limit=10&offset=20'),
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual([
                { id: 'user123', email: 'test@example.com' },
            ]);
            expect(mockRepo.list).toHaveBeenCalledWith(10, 20);
        });

        it('clamps limit to maximum of 100', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?limit=200'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(100, 0);
        });

        it('clamps limit to minimum of 1', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?limit=0'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(1, 0);
        });

        it('defaults limit to 50 when NaN', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?limit=invalid'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(50, 0);
        });

        it('clamps negative offset to 0', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?offset=-10'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(50, 0);
        });

        it('defaults offset to 0 when NaN', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?offset=invalid'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(50, 0);
        });

        it('handles edge case with negative limit', async () => {
            mockRepo.list.mockResolvedValue([]);

            const response = await GET({
                url: new URL('http://localhost/api/users?limit=-5'),
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.list).toHaveBeenCalledWith(1, 0);
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.list.mockRejectedValue(new Error('Database error'));

            const response = await GET({
                url: new URL('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
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

        it('returns 500 on internal server error', async () => {
            mockRepo.create.mockRejectedValue(new Error('Database error'));

            const response = await POST({
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'test@example.com',
                            username: 'tester',
                        }),
                },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
        });
    });

    describe('GET /api/users/[id]', () => {
        it('returns 400 when id is missing', async () => {
            const response = await GetById({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.findById).not.toHaveBeenCalled();
        });

        it('returns 400 when id is empty string', async () => {
            const response = await GetById({
                params: { id: '' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.findById).not.toHaveBeenCalled();
        });

        it('returns 400 when id is whitespace only', async () => {
            const response = await GetById({
                params: { id: '   ' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.findById).not.toHaveBeenCalled();
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.findById.mockResolvedValue(null);

            const response = await GetById({
                params: { id: 'missing' },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
            expect(mockRepo.findById).toHaveBeenCalledWith('missing');
        });

        it('returns a user successfully', async () => {
            mockRepo.findById.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetById({
                params: { id: 'user123' },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.findById).toHaveBeenCalledWith('user123');
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.findById.mockRejectedValue(new Error('Database error'));

            const response = await GetById({
                params: { id: 'user123' },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
            expect(mockRepo.findById).toHaveBeenCalledWith('user123');
        });
    });

    describe('PUT /api/users/[id]', () => {
        it('returns 400 when id is missing', async () => {
            const response = await UpdateById({
                params: {},
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.update.mockResolvedValue(null);

            const response = await UpdateById({
                params: { id: 'missing' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
        });

        it('updates user email', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'updated@example.com',
                username: 'tester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
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

        it('updates user username', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'newtester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            username: 'newtester',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'newtester',
            });
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                username: 'newtester',
            });
        });

        it('updates both email and username', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'updated@example.com',
                username: 'newtester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'updated@example.com',
                            username: 'newtester',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                email: 'updated@example.com',
                username: 'newtester',
            });
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.update.mockRejectedValue(new Error('Database error'));

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: 'updated@example.com',
                        }),
                },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
        });

        it('returns 400 when request body contains invalid JSON', async () => {
            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () => Promise.reject(new SyntaxError('Invalid JSON')),
                },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid JSON in request body',
            });
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it('trims whitespace from email before update', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'updated@example.com',
                username: 'tester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: '  updated@example.com  ',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                email: 'updated@example.com',
            });
        });

        it('trims whitespace from username before update', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'newtester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            username: '  newtester  ',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                username: 'newtester',
            });
        });

        it('returns 422 when both email and username are empty strings', async () => {
            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: '',
                            username: '',
                        }),
                },
            } as any);

            expect(response.status).toBe(422);
            await expect(response.json()).resolves.toEqual({
                error: 'No valid fields to update',
            });
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it('returns 422 when both email and username are whitespace only', async () => {
            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: '   ',
                            username: '  \t\n  ',
                        }),
                },
            } as any);

            expect(response.status).toBe(422);
            await expect(response.json()).resolves.toEqual({
                error: 'No valid fields to update',
            });
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it('returns 422 when request body is empty object', async () => {
            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () => Promise.resolve({}),
                },
            } as any);

            expect(response.status).toBe(422);
            await expect(response.json()).resolves.toEqual({
                error: 'No valid fields to update',
            });
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it('trims and updates when email has trailing/leading whitespace', async () => {
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'new@example.com',
                username: 'tester',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: {
                    json: () =>
                        Promise.resolve({
                            email: '  new@example.com  ',
                            username: '   ',
                        }),
                },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.update).toHaveBeenCalledWith('user123', {
                email: 'new@example.com',
            });
        });
    });

    describe('DELETE /api/users/[id]', () => {
        it('returns 400 when id is missing', async () => {
            const response = await DeleteById({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.delete).not.toHaveBeenCalled();
        });

        it('returns 400 when id is empty string', async () => {
            const response = await DeleteById({
                params: { id: '' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid User ID',
            });
            expect(mockRepo.delete).not.toHaveBeenCalled();
        });

        it('returns 400 when id is whitespace only', async () => {
            const response = await DeleteById({
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

            const response = await DeleteById({
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

            const response = await DeleteById({
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

            const response = await DeleteById({
                params: { id: 'user123' },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
            expect(mockRepo.delete).toHaveBeenCalledWith('user123');
        });
    });

    describe('GET /api/users/by-email/[email]', () => {
        it('returns 400 when email is missing', async () => {
            const response = await GetByEmail({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid email address',
            });
            expect(mockRepo.findByEmail).not.toHaveBeenCalled();
        });

        it('returns 400 when email is empty string', async () => {
            const response = await GetByEmail({
                params: { email: '' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid email address',
            });
            expect(mockRepo.findByEmail).not.toHaveBeenCalled();
        });

        it('returns 400 when email is whitespace only', async () => {
            const response = await GetByEmail({
                params: { email: '   ' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid email address',
            });
            expect(mockRepo.findByEmail).not.toHaveBeenCalled();
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.findByEmail.mockResolvedValue(null);

            const response = await GetByEmail({
                params: { email: 'missing@example.com' },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'missing@example.com'
            );
        });

        it('returns a user successfully', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetByEmail({
                params: { email: 'test@example.com' },
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

        it('trims whitespace from email', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetByEmail({
                params: { email: '  test@example.com  ' },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'test@example.com'
            );
        });

        it('decodes URL-encoded email address', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            // @ sign encoded as %40
            const response = await GetByEmail({
                params: { email: 'test%40example.com' },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'test@example.com'
            );
        });

        it('decodes URL-encoded email with plus sign (space)', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            // + character is URL-encoded as %2B, and space as +
            const response = await GetByEmail({
                params: { email: 'test%2Buser@example.com' },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'test+user@example.com'
            );
        });

        it('returns 400 for malformed URI', async () => {
            // Invalid UTF-8 sequence
            const response = await GetByEmail({
                params: { email: '%E0%A4%A' },
            } as any);

            expect(response.status).toBe(400);
            expect(mockRepo.findByEmail).not.toHaveBeenCalled();
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.findByEmail.mockRejectedValue(new Error('Database error'));

            const response = await GetByEmail({
                params: { email: 'test@example.com' },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
            expect(mockRepo.findByEmail).toHaveBeenCalledWith(
                'test@example.com'
            );
        });
    });

    describe('GET /api/users/by-username/[username]', () => {
        it('returns 400 when username is missing', async () => {
            const response = await GetByUsername({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid username',
            });
            expect(mockRepo.findByUsername).not.toHaveBeenCalled();
        });

        it('returns 400 when username is empty string', async () => {
            const response = await GetByUsername({
                params: { username: '' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid username',
            });
            expect(mockRepo.findByUsername).not.toHaveBeenCalled();
        });

        it('returns 400 when username is whitespace only', async () => {
            const response = await GetByUsername({
                params: { username: '   ' },
            } as any);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid username',
            });
            expect(mockRepo.findByUsername).not.toHaveBeenCalled();
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.findByUsername.mockResolvedValue(null);

            const response = await GetByUsername({
                params: { username: 'missing' },
            } as any);

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'User not found',
            });
            expect(mockRepo.findByUsername).toHaveBeenCalledWith('missing');
        });

        it('returns a user successfully', async () => {
            mockRepo.findByUsername.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetByUsername({
                params: { username: 'tester' },
            } as any);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
            expect(mockRepo.findByUsername).toHaveBeenCalledWith('tester');
        });

        it('trims whitespace from username', async () => {
            mockRepo.findByUsername.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetByUsername({
                params: { username: '  tester  ' },
            } as any);

            expect(response.status).toBe(200);
            expect(mockRepo.findByUsername).toHaveBeenCalledWith('tester');
        });

        it('returns 500 on internal server error', async () => {
            mockRepo.findByUsername.mockRejectedValue(
                new Error('Database error')
            );

            const response = await GetByUsername({
                params: { username: 'tester' },
            } as any);

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: 'Internal server error',
            });
            expect(mockRepo.findByUsername).toHaveBeenCalledWith('tester');
        });
    });
});
