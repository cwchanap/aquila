import { describe, it, expect, vi, beforeEach } from 'vitest';

const handler = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth.js', () => ({
    auth: {
        handler,
    },
}));

import { ALL } from '../auth/[...all]';

describe('Auth catch-all API', () => {
    beforeEach(() => {
        handler.mockReset();
    });

    it('delegates to auth.handler', async () => {
        const request = new Request('http://localhost/api/auth');
        handler.mockResolvedValue(new Response('ok', { status: 200 }));

        const response = await ALL({ request } as any);

        expect(handler).toHaveBeenCalledWith(request);
        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('ok');
    });
});
