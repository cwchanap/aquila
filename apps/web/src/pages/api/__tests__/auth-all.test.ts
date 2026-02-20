import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    beforeAll,
    afterAll,
} from 'vitest';
import { auth } from '../../../lib/auth.js';
import { ALL } from '../auth/[...all]';

vi.mock('../../../lib/logger.js', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

let handler: ReturnType<typeof vi.spyOn>;

describe('Auth catch-all API', () => {
    beforeAll(() => {
        handler = vi.spyOn(auth, 'handler');
    });

    beforeEach(() => {
        handler.mockReset();
    });

    afterAll(() => {
        handler.mockRestore();
    });

    it('delegates to auth.handler', async () => {
        const request = new Request('http://localhost/api/auth');
        handler.mockResolvedValue(new Response('ok', { status: 200 }));

        const response = await ALL({ request } as any);

        expect(handler).toHaveBeenCalledWith(request);
        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('ok');
    });

    it('converts 5xx HTML response to 503 JSON', async () => {
        const request = new Request('http://localhost/api/auth/sign-in/email');
        handler.mockResolvedValue(
            new Response('<html><body>Internal Server Error</body></html>', {
                status: 500,
                headers: { 'content-type': 'text/html; charset=utf-8' },
            })
        );

        const response = await ALL({ request } as any);

        expect(response.status).toBe(503);
        expect(response.headers.get('content-type')).toContain(
            'application/json'
        );
        const body = await response.json();
        expect(body.error).toBe('Authentication service unavailable');
    });

    it('passes through 5xx non-HTML responses unchanged', async () => {
        const request = new Request('http://localhost/api/auth/sign-in/email');
        handler.mockResolvedValue(
            new Response(JSON.stringify({ error: 'Something went wrong' }), {
                status: 500,
                headers: { 'content-type': 'application/json' },
            })
        );

        const response = await ALL({ request } as any);

        expect(response.status).toBe(500);
    });

    it('returns 503 JSON when auth.handler throws', async () => {
        const request = new Request('http://localhost/api/auth/sign-in/email');
        handler.mockRejectedValue(new Error('Database connection failed'));

        const response = await ALL({ request } as any);

        expect(response.status).toBe(503);
        expect(response.headers.get('content-type')).toContain(
            'application/json'
        );
        const body = await response.json();
        expect(body.error).toBe('Authentication service unavailable');
    });
});
