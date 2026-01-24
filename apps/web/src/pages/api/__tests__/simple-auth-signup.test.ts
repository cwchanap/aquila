import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    beforeAll,
} from 'vitest';
import { UserAlreadyExistsError } from '../../../lib/errors.js';
import { SimpleAuthService } from '../../../lib/simple-auth.js';

const mockDbSelect = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/drizzle/db.js', () => ({
    db: {
        select: mockDbSelect,
    },
}));

vi.mock('../../../lib/logger.js', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

let POST: typeof import('../simple-auth/signup').POST;
let signUp: ReturnType<typeof vi.spyOn>;
let createSession: ReturnType<typeof vi.spyOn>;

describe('Signup API', () => {
    let originalNodeEnv: string | undefined;

    beforeAll(async () => {
        signUp = vi.spyOn(SimpleAuthService, 'signUp');
        createSession = vi.spyOn(SimpleAuthService, 'createSession');
        ({ POST } = await import('../simple-auth/signup'));
    });

    beforeEach(() => {
        vi.clearAllMocks();
        originalNodeEnv = process.env.NODE_ENV;

        const limit = vi.fn().mockResolvedValue([]);
        const from = vi.fn().mockReturnValue({ limit });
        mockDbSelect.mockReturnValue({ from });
    });

    afterEach(() => {
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
            return;
        }
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('returns 400 when required fields are missing', async () => {
        const request = {
            json: vi.fn().mockResolvedValue({
                email: '',
                password: '',
                name: '',
            }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'Missing required fields',
        });
        expect(signUp).not.toHaveBeenCalled();
    });

    it('returns 409 when email is already in use', async () => {
        signUp.mockRejectedValue(new UserAlreadyExistsError());

        const request = {
            json: vi.fn().mockResolvedValue({
                email: 'duplicate@example.com',
                password: 'password123',
                name: 'Duplicate User',
            }),
        } as any;

        const response = await POST({
            request,
            cookies: { set: vi.fn() },
        } as any);

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: 'Email already in use',
        });
        expect(createSession).not.toHaveBeenCalled();
    });

    it('creates a session cookie on successful signup', async () => {
        signUp.mockResolvedValue({
            id: 'user-1',
            email: 'USER@Example.COM',
            name: 'User',
            username: null,
        });
        createSession.mockResolvedValue('session-123');

        const cookies = { set: vi.fn() };
        const request = {
            json: vi.fn().mockResolvedValue({
                email: '  USER@Example.COM  ',
                password: 'password123',
                name: 'User',
            }),
        } as any;

        const response = await POST({ request, cookies } as any);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'user-1',
                email: 'USER@Example.COM',
                name: 'User',
                username: null,
            },
        });
        expect(signUp).toHaveBeenCalledWith(
            'USER@Example.COM',
            'password123',
            'User'
        );
        expect(createSession).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'USER@Example.COM',
            name: 'User',
            username: null,
        });
        expect(cookies.set).toHaveBeenCalledWith(
            'session',
            'session-123',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
                path: '/',
            })
        );
    });

    describe('session cookie secure flag', () => {
        it('sets secure: true in production', async () => {
            process.env.NODE_ENV = 'production';

            signUp.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-123');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                    name: 'User',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-123',
                expect.objectContaining({
                    secure: true,
                })
            );
        });

        it('sets secure: false in development', async () => {
            process.env.NODE_ENV = 'development';

            signUp.mockResolvedValue({
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                username: null,
            });
            createSession.mockResolvedValue('session-123');

            const cookies = { set: vi.fn() };
            const request = {
                json: vi.fn().mockResolvedValue({
                    email: 'user@example.com',
                    password: 'password123',
                    name: 'User',
                }),
            } as any;

            await POST({ request, cookies } as any);

            expect(cookies.set).toHaveBeenCalledWith(
                'session',
                'session-123',
                expect.objectContaining({
                    secure: false,
                })
            );
        });
    });
});
