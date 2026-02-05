import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Create mock repository with all methods
const mockRepo = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
};

// Create constructor mock that returns mockRepo
const UserRepositoryConstructor = vi.fn(() => mockRepo);

vi.mock('../../../lib/drizzle/repositories.js', () => ({
    UserRepository: UserRepositoryConstructor,
}));

vi.mock('@/lib/drizzle/repositories.js', () => ({
    UserRepository: UserRepositoryConstructor,
}));

// Mock Better Auth
const mockGetSession = vi.fn();
vi.mock('../../../lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

vi.mock('@/lib/auth.js', () => ({
    auth: {
        api: {
            getSession: mockGetSession,
        },
    },
}));

// Helper to set up mock session
const mockAuthenticatedSession = (userId: string = 'user123') => {
    mockGetSession.mockResolvedValue({
        user: { id: userId, email: 'test@example.com' },
    });
};

const mockUnauthenticatedSession = () => {
    mockGetSession.mockResolvedValue(null);
};

let GET: typeof import('../users').GET;
let GetById: typeof import('../users/[id]').GET;
let UpdateById: typeof import('../users/[id]').PUT;
let DeleteById: typeof import('../users/[id]').DELETE;
let GetByEmail: typeof import('../users/by-email/[email]').GET;
let GetByUsername: typeof import('../users/by-username/[username]').GET;

describe('Users API - Authenticated Endpoints', () => {
    beforeAll(async () => {
        const usersModule = await import('../users');
        GET = usersModule.GET;

        const usersByIdModule = await import('../users/[id]');
        GetById = usersByIdModule.GET;
        UpdateById = usersByIdModule.PUT;
        DeleteById = usersByIdModule.DELETE;

        ({ GET: GetByEmail } = await import('../users/by-email/[email]'));
        ({ GET: GetByUsername } = await import(
            '../users/by-username/[username]'
        ));
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockRepo.findById.mockReset();
        mockRepo.findByEmail.mockReset();
        mockRepo.findByUsername.mockReset();
        mockRepo.list.mockReset();
        mockRepo.create.mockReset();
        mockRepo.update.mockReset();
        mockRepo.delete.mockReset();
        mockGetSession.mockReset();
        // Default to authenticated session
        mockAuthenticatedSession();
    });

    describe('GET /api/users', () => {
        it('returns 401 when not authenticated', async () => {
            mockUnauthenticatedSession();

            const response = await GET({
                request: new Request('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
            expect(data.success).toBe(false);
        });

        it('returns current user data when authenticated', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.findById.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
            });

            const response = await GET({
                request: new Request('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({
                id: 'user123',
                email: 'test@example.com',
            });
            expect(mockRepo.findById).toHaveBeenCalledWith('user123');
        });

        it('returns 404 when user not found', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.findById.mockResolvedValue(null);

            const response = await GET({
                request: new Request('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('User not found');
        });

        it('returns 500 on internal server error', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.findById.mockRejectedValue(new Error('Database error'));

            const response = await GET({
                request: new Request('http://localhost/api/users'),
            } as any);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Failed to fetch user');
            expect(data.success).toBe(false);
        });
    });

    describe('GET /api/users/[id]', () => {
        it('returns 401 when not authenticated', async () => {
            mockUnauthenticatedSession();

            const response = await GetById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123'),
            } as any);

            expect(response.status).toBe(401);
        });

        it('returns 400 when id is missing', async () => {
            const response = await GetById({
                params: {},
                request: new Request('http://localhost/api/users/'),
            } as any);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid User ID');
        });

        it('returns 403 when accessing another user's data', async () => {
            mockAuthenticatedSession('user123');

            const response = await GetById({
                params: { id: 'other-user' },
                request: new Request('http://localhost/api/users/other-user'),
            } as any);

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Forbidden');
        });

        it('returns 404 when user is not found', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.findById.mockResolvedValue(null);

            const response = await GetById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123'),
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('User not found');
        });

        it('returns user data successfully', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.findById.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });

            const response = await GetById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123'),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({
                id: 'user123',
                email: 'test@example.com',
                username: 'tester',
            });
        });
    });

    describe('PUT /api/users/[id]', () => {
        it('returns 401 when not authenticated', async () => {
            mockUnauthenticatedSession();

            const response = await UpdateById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'PUT',
                    body: JSON.stringify({ name: 'New Name' }),
                }),
            } as any);

            expect(response.status).toBe(401);
        });

        it('returns 403 when updating another user's data', async () => {
            mockAuthenticatedSession('user123');

            const response = await UpdateById({
                params: { id: 'other-user' },
                request: new Request('http://localhost/api/users/other-user', {
                    method: 'PUT',
                    body: JSON.stringify({ name: 'New Name' }),
                }),
            } as any);

            expect(response.status).toBe(403);
        });

        it('returns 422 when no valid fields to update', async () => {
            mockAuthenticatedSession('user123');

            const response = await UpdateById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            } as any);

            expect(response.status).toBe(422);
            const data = await response.json();
            expect(data.error).toBe('No valid fields to update');
        });

        it('updates user successfully', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.update.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                name: 'Updated Name',
            });

            const response = await UpdateById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Updated Name' }),
                }),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.name).toBe('Updated Name');
        });
    });

    describe('DELETE /api/users/[id]', () => {
        it('returns 401 when not authenticated', async () => {
            mockUnauthenticatedSession();

            const response = await DeleteById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(401);
        });

        it('returns 403 when deleting another user's account', async () => {
            mockAuthenticatedSession('user123');

            const response = await DeleteById({
                params: { id: 'other-user' },
                request: new Request('http://localhost/api/users/other-user', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(403);
        });

        it('returns 404 when user is not found', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.delete.mockResolvedValue(false);

            const response = await DeleteById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('User not found');
        });

        it('deletes user successfully', async () => {
            mockAuthenticatedSession('user123');
            mockRepo.delete.mockResolvedValue(true);

            const response = await DeleteById({
                params: { id: 'user123' },
                request: new Request('http://localhost/api/users/user123', {
                    method: 'DELETE',
                }),
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.deleted).toBe(true);
        });
    });

    describe('GET /api/users/by-email/[email]', () => {
        it('returns 400 when email is missing', async () => {
            const response = await GetByEmail({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid email address');
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.findByEmail.mockResolvedValue(null);

            const response = await GetByEmail({
                params: { email: 'missing@example.com' },
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('User not found');
        });

        it('returns user successfully', async () => {
            mockRepo.findByEmail.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
            });

            const response = await GetByEmail({
                params: { email: 'test@example.com' },
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.id).toBe('user123');
        });
    });

    describe('GET /api/users/by-username/[username]', () => {
        it('returns 400 when username is missing', async () => {
            const response = await GetByUsername({
                params: {},
            } as any);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid username');
        });

        it('returns 404 when user is not found', async () => {
            mockRepo.findByUsername.mockResolvedValue(null);

            const response = await GetByUsername({
                params: { username: 'missing' },
            } as any);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('User not found');
        });

        it('returns user successfully', async () => {
            mockRepo.findByUsername.mockResolvedValue({
                id: 'user123',
                username: 'tester',
            });

            const response = await GetByUsername({
                params: { username: 'tester' },
            } as any);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.id).toBe('user123');
        });
    });
});
